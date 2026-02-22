/**
 * Rate-limited progress reporter for the render pipeline.
 *
 * Reports to BullMQ on every 5th frame, throttled to max once per 2 seconds.
 * Tracks the current pipeline stage for status visibility.
 */
import type { RenderStage, ProgressData } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProgressCallback = (data: ProgressData) => Promise<void>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRAME_REPORT_INTERVAL = 5;
const MIN_REPORT_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// ProgressReporter
// ---------------------------------------------------------------------------

export class ProgressReporter {
    private readonly callback: ProgressCallback;
    private readonly totalFrames: number;
    private stage: RenderStage = 'fetching';
    private lastReportTime = 0;
    private lastReportedFrame = -1;

    constructor(callback: ProgressCallback, totalFrames: number) {
        this.callback = callback;
        this.totalFrames = totalFrames;
    }

    /**
     * Update the current pipeline stage.
     * Immediately reports the stage change.
     */
    async setStage(stage: RenderStage): Promise<void> {
        this.stage = stage;
        await this.forceReport(0);
    }

    /**
     * Report frame progress. Only emits if:
     *   1. The frame is on a 5th-frame boundary, AND
     *   2. At least 2 seconds have elapsed since the last report
     */
    async onFrame(currentFrame: number): Promise<void> {
        if (currentFrame % FRAME_REPORT_INTERVAL !== 0) return;
        if (currentFrame === this.lastReportedFrame) return;

        const now = Date.now();
        if (now - this.lastReportTime < MIN_REPORT_INTERVAL_MS) return;

        await this.forceReport(currentFrame);
    }

    /**
     * Force a progress report regardless of throttling.
     * Used for stage transitions and the final frame.
     */
    async forceReport(currentFrame: number): Promise<void> {
        const percentage = this.totalFrames > 0
            ? Math.min(100, Math.round((currentFrame / this.totalFrames) * 100))
            : 0;

        const data: ProgressData = {
            currentFrame,
            totalFrames: this.totalFrames,
            percentage,
            stage: this.stage,
        };

        this.lastReportTime = Date.now();
        this.lastReportedFrame = currentFrame;

        await this.callback(data);
    }

    /** Returns the current stage. */
    getStage(): RenderStage {
        return this.stage;
    }
}
