/**
 * Asset routes.
 *
 * POST   /projects/:id/assets     — Upload file
 * GET    /projects/:id/assets     — List project assets
 * DELETE /assets/:id              — Delete asset + R2 file
 * POST   /assets/presigned-url    — Get presigned upload URL
 *
 * All routes require authentication.
 */
import '@fastify/multipart';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getDatabase } from '../db/connection.js';
import { authenticate } from '../middleware/authenticate.js';
import { initStorage } from '../services/storage.service.js';
import * as assetService from '../services/asset.service.js';
import { AppError } from '../errors/errors.js';
import { getEnv } from '../config/env.js';
import { MAX_FILE_SIZE } from '../utils/file-validation.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ProjectIdParamsSchema = z.object({
    id: z.string().uuid('Invalid project ID'),
});

const AssetIdParamsSchema = z.object({
    id: z.string().uuid('Invalid asset ID'),
});

const PresignedUrlBodySchema = z.object({
    projectId: z.string().uuid('Invalid project ID'),
    filename: z.string().min(1).max(255),
    contentType: z.string().min(1).max(127),
});

// ---------------------------------------------------------------------------
// Serialiser
// ---------------------------------------------------------------------------

function serialiseAsset(row: assetService.AssetRow) {
    return {
        id: row.id,
        userId: row.userId,
        projectId: row.projectId,
        name: row.name,
        type: row.type,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        storagePath: row.storagePath,
        cdnUrl: row.cdnUrl,
        metadata: row.metadata,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function assetRoutes(app: FastifyInstance): Promise<void> {
    // All asset routes require authentication
    app.addHook('preHandler', authenticate);

    // -----------------------------------------------------------------------
    // POST /projects/:id/assets — Upload file
    // -----------------------------------------------------------------------

    app.post(
        '/projects/:id/assets',
        {
            config: {
                rateLimit: { max: 10, timeWindow: 60_000 }, // 10/min
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id: projectId } = ProjectIdParamsSchema.parse(request.params);

            const file = await request.file();
            if (!file) {
                throw AppError.validation('No file was uploaded');
            }

            // Read file into buffer (limited by multipart config)
            const buffer = await file.toBuffer();

            if (buffer.length > MAX_FILE_SIZE) {
                throw AppError.validation(
                    `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB size limit`,
                );
            }

            const db = getDatabase();
            const env = getEnv();
            const storage = initStorage(env);

            const asset = await assetService.createAssetFromUpload(
                db,
                request.userId,
                projectId,
                file.filename,
                buffer,
                storage,
            );

            return reply.status(201).send({ asset: serialiseAsset(asset) });
        },
    );

    // -----------------------------------------------------------------------
    // GET /projects/:id/assets — List project assets
    // -----------------------------------------------------------------------

    app.get(
        '/projects/:id/assets',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id: projectId } = ProjectIdParamsSchema.parse(request.params);
            const db = getDatabase();

            const assets = await assetService.listProjectAssets(
                db,
                projectId,
                request.userId,
            );

            return reply.status(200).send({
                data: assets.map(serialiseAsset),
            });
        },
    );

    // -----------------------------------------------------------------------
    // DELETE /assets/:id — Delete asset + R2 file
    // -----------------------------------------------------------------------

    app.delete(
        '/assets/:id',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id: assetId } = AssetIdParamsSchema.parse(request.params);
            const db = getDatabase();
            const env = getEnv();
            const storage = initStorage(env);

            await assetService.deleteAsset(
                db,
                assetId,
                request.userId,
                storage,
            );

            return reply.status(200).send({ message: 'Asset deleted successfully' });
        },
    );

    // -----------------------------------------------------------------------
    // POST /assets/presigned-url — Get presigned upload URL
    // -----------------------------------------------------------------------

    app.post(
        '/assets/presigned-url',
        {
            config: {
                rateLimit: { max: 10, timeWindow: 60_000 }, // 10/min
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = PresignedUrlBodySchema.parse(request.body);
            const db = getDatabase();
            const env = getEnv();
            const storage = initStorage(env);

            const result = await assetService.generateAssetPresignedUrl(
                db,
                request.userId,
                body.projectId,
                body.filename,
                body.contentType,
                storage,
            );

            return reply.status(200).send(result);
        },
    );
}
