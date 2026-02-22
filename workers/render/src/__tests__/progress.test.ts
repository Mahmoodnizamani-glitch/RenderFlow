/**
 * Unit tests for the ProgressReporter.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressReporter } from '../pipeline/progress.js';
import type { ProgressData } from '../types.js';

describe('ProgressReporter', () => {
    let reported: ProgressData[];
    let callback: (data: ProgressData) => Promise<void>;

    beforeEach(() => {
        reported = [];
        callback = async (data: ProgressData) => {
            reported.push(data);
        };
    });

    // -------------------------------------------------------------------
    // Stage management
    // -------------------------------------------------------------------

    describe('setStage', () => {
        it('reports stage change immediately', async () => {
            const reporter = new ProgressReporter(callback, 100);

            await reporter.setStage('bundling');

            expect(reported).toHaveLength(1);
            expect(reported[0]!.stage).toBe('bundling');
            expect(reported[0]!.currentFrame).toBe(0);
        });

        it('updates the current stage', async () => {
            const reporter = new ProgressReporter(callback, 100);

            await reporter.setStage('rendering');
            expect(reporter.getStage()).toBe('rendering');

            await reporter.setStage('uploading');
            expect(reporter.getStage()).toBe('uploading');
        });
    });

    // -------------------------------------------------------------------
    // Frame reporting
    // -------------------------------------------------------------------

    describe('onFrame', () => {
        it('reports on every 5th frame', async () => {
            const reporter = new ProgressReporter(callback, 100);

            // Frames 1-4 should not trigger a report
            for (let i = 1; i <= 4; i++) {
                await reporter.onFrame(i);
            }
            expect(reported).toHaveLength(0);

            // Frame 5 should trigger
            await reporter.onFrame(5);
            expect(reported).toHaveLength(1);
            expect(reported[0]!.currentFrame).toBe(5);
        });

        it('reports frame 0 (start)', async () => {
            const reporter = new ProgressReporter(callback, 100);
            await reporter.onFrame(0);
            expect(reported).toHaveLength(1);
            expect(reported[0]!.currentFrame).toBe(0);
        });

        it('does not report the same frame twice', async () => {
            const reporter = new ProgressReporter(callback, 100);

            await reporter.onFrame(5);
            await reporter.onFrame(5);

            expect(reported).toHaveLength(1);
        });

        it('calculates percentage correctly', async () => {
            const reporter = new ProgressReporter(callback, 200);

            await reporter.onFrame(50);
            expect(reported[0]!.percentage).toBe(25);

            // Wait for throttle
            await new Promise((r) => setTimeout(r, 2100));

            await reporter.onFrame(100);
            expect(reported[1]!.percentage).toBe(50);
        });

        it('caps percentage at 100', async () => {
            const reporter = new ProgressReporter(callback, 50);

            await reporter.forceReport(100);
            expect(reported[0]!.percentage).toBe(100);
        });

        it('handles zero totalFrames', async () => {
            const reporter = new ProgressReporter(callback, 0);

            await reporter.forceReport(10);
            expect(reported[0]!.percentage).toBe(0);
        });
    });

    // -------------------------------------------------------------------
    // Throttling
    // -------------------------------------------------------------------

    describe('throttling', () => {
        it('throttles reports to max every 2 seconds', async () => {
            const reporter = new ProgressReporter(callback, 1000);

            // First report should go through
            await reporter.onFrame(5);
            expect(reported).toHaveLength(1);

            // Immediate subsequent reports should be throttled
            await reporter.onFrame(10);
            expect(reported).toHaveLength(1); // Still 1

            // Wait for throttle interval
            await new Promise((r) => setTimeout(r, 2100));

            await reporter.onFrame(15);
            expect(reported).toHaveLength(2); // Now 2
        });
    });

    // -------------------------------------------------------------------
    // forceReport
    // -------------------------------------------------------------------

    describe('forceReport', () => {
        it('ignores throttling', async () => {
            const reporter = new ProgressReporter(callback, 100);

            await reporter.forceReport(10);
            await reporter.forceReport(20);
            await reporter.forceReport(30);

            expect(reported).toHaveLength(3);
        });

        it('includes all progress data fields', async () => {
            const reporter = new ProgressReporter(callback, 100);
            await reporter.setStage('rendering');

            await reporter.forceReport(50);

            const report = reported[reported.length - 1]!;
            expect(report).toEqual({
                currentFrame: 50,
                totalFrames: 100,
                percentage: 50,
                stage: 'rendering',
            });
        });
    });
});
