package com.renderflow.worker

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.renderflow.data.local.entity.RenderStatus
import com.renderflow.data.repository.RenderRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * WorkManager worker that submits a render job to the backend.
 * Handles offline-first: if submission fails, the pending action
 * remains in the queue for retry via WorkManager's exponential backoff.
 */
@HiltWorker
class RenderSubmitWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val renderRepository: RenderRepository,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val jobId = inputData.getString(KEY_JOB_ID)
            ?: return Result.failure().also {
                Log.e(TAG, "Missing jobId in worker input data")
            }

        return try {
            Log.i(TAG, "Submitting render job: $jobId")

            // Update status to RENDERING
            renderRepository.updateRenderJobStatus(jobId, RenderStatus.RENDERING)

            // In a full implementation, this would make an API call to the render backend.
            // For now, we simulate the submission and mark as pending on the server side.
            // The actual API client would be injected here.
            simulateApiSubmission(jobId)

            Log.i(TAG, "Render job submitted successfully: $jobId")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Render submission failed for job $jobId: ${e.message}")

            if (runAttemptCount < MAX_RETRIES) {
                Log.i(TAG, "Will retry (attempt ${runAttemptCount + 1}/$MAX_RETRIES)")
                Result.retry()
            } else {
                renderRepository.updateRenderJobStatus(jobId, RenderStatus.FAILED)
                Result.failure()
            }
        }
    }

    /**
     * Placeholder for actual API submission.
     * In production, this would call the Remotion render API.
     */
    private suspend fun simulateApiSubmission(jobId: String) {
        // API call would go here:
        // val response = renderApi.submitJob(jobId, propsJson)
        // renderRepository.updateRenderJobResult(jobId, RenderStatus.DONE, response.resultUrl)
        Log.d(TAG, "API submission stub for job: $jobId")
    }

    companion object {
        const val KEY_JOB_ID = "render_job_id"
        private const val TAG = "RenderSubmitWorker"
        private const val MAX_RETRIES = 3
    }
}
