/**
 * Render pipeline orchestrator.
 *
 * Executes the 6-step render pipeline:
 *   1. FETCH — Download code bundle from R2 URL
 *   2. PREPARE — Write to temp dir, install deps if detected
 *   3. BUNDLE — Remotion webpack bundler
 *   4. RENDER — renderMedia with composition settings
 *   5. UPLOAD — Upload rendered file to R2
 *   6. CLEANUP — Delete temp directory
 *
 * Each step is isolated with its own error handling so failures
 * are correctly classified for retry decisions.
 */
import { mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

import type {
    RenderJobData,
    TypedRenderSettings,
    RenderResult,
    OutputFormat,
} from '../types.js';
import {
    VALID_FORMATS,
    FORMAT_TO_CODEC,
    FORMAT_TO_EXTENSION,
    FORMAT_TO_MIME,
} from '../types.js';
import { RenderError } from '../errors.js';
import { ProgressReporter, type ProgressCallback } from './progress.js';
import { type StorageClient, buildRenderStoragePath } from './storage.js';
import type { ChildLogger } from '../config/logger.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Settings parser
// ---------------------------------------------------------------------------

/**
 * Extract typed render settings from the generic record.
 * Falls back to sensible defaults for missing fields.
 */
export function parseRenderSettings(raw: Record<string, unknown>): TypedRenderSettings {
    const width = typeof raw['width'] === 'number' ? raw['width'] : 1920;
    const height = typeof raw['height'] === 'number' ? raw['height'] : 1080;
    const fps = typeof raw['fps'] === 'number' ? raw['fps'] : 30;
    const durationInFrames = typeof raw['durationInFrames'] === 'number' ? raw['durationInFrames'] : 150;
    const rawFormat = typeof raw['format'] === 'string' ? raw['format'] : 'mp4';
    const format: OutputFormat = VALID_FORMATS.has(rawFormat) ? (rawFormat as OutputFormat) : 'mp4';
    const quality = typeof raw['quality'] === 'number' ? raw['quality'] : undefined;

    return { width, height, fps, durationInFrames, format, quality };
}

// ---------------------------------------------------------------------------
// Step 1: FETCH
// ---------------------------------------------------------------------------

/**
 * Download the code bundle from the provided URL.
 * Returns the raw buffer of the downloaded content.
 */
export async function fetchCodeBundle(
    codeUrl: string,
    log: ChildLogger,
): Promise<Uint8Array> {
    log.info('Fetching code bundle', { codeUrl });

    const response = await fetch(codeUrl);
    if (!response.ok) {
        throw RenderError.code(
            `Failed to download code bundle: HTTP ${response.status} ${response.statusText}`,
        );
    }

    const buffer = new Uint8Array(await response.arrayBuffer());

    if (buffer.length === 0) {
        throw RenderError.code('Code bundle is empty');
    }

    log.info('Code bundle downloaded', { sizeBytes: buffer.length });
    return buffer;
}

// ---------------------------------------------------------------------------
// Step 2: PREPARE
// ---------------------------------------------------------------------------

/**
 * Write code bundle to a temp directory and install dependencies
 * if a package.json is detected.
 *
 * The temp directory is isolated per job to prevent cross-contamination.
 */
export async function prepareWorkspace(
    codeBuffer: Uint8Array,
    jobId: string,
    log: ChildLogger,
): Promise<string> {
    const workDir = join(tmpdir(), `renderflow-${jobId}-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    log.info('Preparing workspace', { workDir });

    // Write the code bundle as index.tsx (entry point for Remotion)
    const codePath = join(workDir, 'index.tsx');
    await writeFile(codePath, codeBuffer);

    // Create a minimal package.json if one doesn't exist in the bundle
    const pkgPath = join(workDir, 'package.json');
    const minimalPkg = JSON.stringify({
        name: `render-${jobId}`,
        private: true,
        dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            remotion: '^4.0.0',
        },
    });
    await writeFile(pkgPath, minimalPkg);

    // Install dependencies
    log.info('Installing dependencies', { workDir });
    try {
        await execFileAsync('npm', ['install', '--production', '--no-audit', '--no-fund'], {
            cwd: workDir,
            timeout: 120_000, // 2 minute timeout for npm install
            env: {
                ...process.env,
                // Restrict environment variables exposed to user code
                HOME: tmpdir(),
                PATH: process.env['PATH'],
                NODE_ENV: 'production',
            },
        });
    } catch (err) {
        throw RenderError.code(
            `Failed to install dependencies: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err : undefined,
        );
    }

    log.info('Workspace prepared', { workDir });
    return workDir;
}

// ---------------------------------------------------------------------------
// Step 3: BUNDLE
// ---------------------------------------------------------------------------

/**
 * Use Remotion's webpack bundler to create a servable bundle
 * from the user's code.
 */
export async function bundleProject(
    workDir: string,
    log: ChildLogger,
): Promise<string> {
    log.info('Bundling project', { workDir });

    const entryPoint = join(workDir, 'index.tsx');

    try {
        const bundleUrl = await bundle({
            entryPoint,
            onProgress: (progress: number) => {
                log.debug('Bundle progress', { progress: Math.round(progress * 100) });
            },
        });

        log.info('Bundle complete', { bundleUrl });
        return bundleUrl;
    } catch (err) {
        throw RenderError.bundle(
            `Webpack bundling failed: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err : undefined,
        );
    }
}

// ---------------------------------------------------------------------------
// Step 4: RENDER
// ---------------------------------------------------------------------------

/**
 * Render the video using Remotion's `renderMedia`.
 * Reports frame progress via the provided reporter.
 */
export async function renderVideo(
    bundleUrl: string,
    settings: TypedRenderSettings,
    compositionSettings: Record<string, unknown>,
    outputDir: string,
    reporter: ProgressReporter,
    log: ChildLogger,
): Promise<string> {
    log.info('Starting render', {
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        durationInFrames: settings.durationInFrames,
        format: settings.format,
        codec: FORMAT_TO_CODEC[settings.format],
    });

    const outputPath = join(outputDir, `output.${FORMAT_TO_EXTENSION[settings.format]}`);
    const codec = FORMAT_TO_CODEC[settings.format];

    try {
        // Select the composition from the bundle
        const composition = await selectComposition({
            serveUrl: bundleUrl,
            id: 'Main',
            inputProps: compositionSettings,
        });

        // Override composition settings with job settings
        const compositionWithOverrides = {
            ...composition,
            width: settings.width,
            height: settings.height,
            fps: settings.fps,
            durationInFrames: settings.durationInFrames,
        };

        await renderMedia({
            composition: compositionWithOverrides,
            serveUrl: bundleUrl,
            codec,
            outputLocation: outputPath,
            inputProps: compositionSettings,
            onProgress: async ({ renderedFrames }) => {
                await reporter.onFrame(renderedFrames);
            },
            chromiumOptions: {
                // Security: disable GPU in container
                gl: 'swangle',
            },
        });

        log.info('Render complete', { outputPath });
        return outputPath;
    } catch (err) {
        throw RenderError.render(
            `Render failed: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err : undefined,
        );
    }
}

// ---------------------------------------------------------------------------
// Step 5: UPLOAD
// ---------------------------------------------------------------------------

/**
 * Upload the rendered file to R2 storage.
 * Returns the public URL and file size.
 */
export async function uploadResult(
    localPath: string,
    userId: string,
    jobId: string,
    format: OutputFormat,
    storage: StorageClient,
    log: ChildLogger,
): Promise<{ outputUrl: string; outputSize: number }> {
    const filename = `output.${FORMAT_TO_EXTENSION[format]}`;
    const storagePath = buildRenderStoragePath(userId, jobId, filename);
    const contentType = FORMAT_TO_MIME[format];

    log.info('Uploading result', { storagePath, contentType });

    try {
        const fileStat = await stat(localPath);
        const outputUrl = await storage.uploadFile(localPath, storagePath, contentType);

        log.info('Upload complete', { outputUrl, sizeBytes: fileStat.size });

        return { outputUrl, outputSize: fileStat.size };
    } catch (err) {
        throw RenderError.upload(
            `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err : undefined,
        );
    }
}

// ---------------------------------------------------------------------------
// Step 6: CLEANUP
// ---------------------------------------------------------------------------

/**
 * Remove the temporary working directory.
 * Logs but does not throw on failure — cleanup errors should not
 * cause the job to fail after a successful render.
 */
export async function cleanupWorkspace(
    workDir: string,
    log: ChildLogger,
): Promise<void> {
    try {
        await rm(workDir, { recursive: true, force: true });
        log.info('Workspace cleaned up', { workDir });
    } catch (err) {
        log.warn('Failed to cleanup workspace', {
            workDir,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

export interface PipelineOptions {
    jobData: RenderJobData;
    storage: StorageClient;
    progressCallback: ProgressCallback;
    log: ChildLogger;
    abortSignal?: AbortSignal;
}

/**
 * Execute the full render pipeline end-to-end.
 *
 * Returns the output URL and file size on success.
 * Throws a classified `RenderError` on failure.
 */
export async function executeRenderPipeline(options: PipelineOptions): Promise<RenderResult> {
    const { jobData, storage, progressCallback, log, abortSignal } = options;
    const settings = parseRenderSettings(jobData.renderSettings);
    const reporter = new ProgressReporter(progressCallback, settings.durationInFrames);
    const startTime = Date.now();

    let workDir: string | null = null;

    try {
        // Check for cancellation before starting
        if (abortSignal?.aborted) {
            throw RenderError.timeout('Job was cancelled before execution');
        }

        // Step 1: FETCH
        await reporter.setStage('fetching');
        const codeBuffer = await fetchCodeBundle(jobData.codeUrl, log);

        // Step 2: PREPARE
        await reporter.setStage('preparing');
        workDir = await prepareWorkspace(codeBuffer, jobData.renderJobId, log);

        // Step 3: BUNDLE
        await reporter.setStage('bundling');
        const bundleUrl = await bundleProject(workDir, log);

        // Step 4: RENDER
        await reporter.setStage('rendering');
        const outputPath = await renderVideo(
            bundleUrl,
            settings,
            jobData.compositionSettings,
            workDir,
            reporter,
            log,
        );

        // Step 5: UPLOAD
        await reporter.setStage('uploading');
        const { outputUrl, outputSize } = await uploadResult(
            outputPath,
            jobData.userId,
            jobData.renderJobId,
            settings.format,
            storage,
            log,
        );

        // Final progress report
        await reporter.forceReport(settings.durationInFrames);

        const durationMs = Date.now() - startTime;
        log.info('Pipeline complete', { durationMs, outputUrl, outputSize });

        return { outputUrl, outputSize, durationMs };
    } finally {
        // Step 6: CLEANUP (always runs)
        if (workDir) {
            await cleanupWorkspace(workDir, log);
        }
    }
}
