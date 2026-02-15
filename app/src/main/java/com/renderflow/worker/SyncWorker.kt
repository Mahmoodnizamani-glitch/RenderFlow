package com.renderflow.worker

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.renderflow.data.repository.RenderRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Periodic WorkManager worker that drains the offline pending actions queue.
 * Picks the oldest pending action, attempts to process it, and either
 * removes it or increments the retry counter.
 *
 * Scheduled to run periodically when network is available.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val renderRepository: RenderRepository,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val pendingCount = renderRepository.getPendingActionCount()
            Log.i(TAG, "Sync worker started, $pendingCount actions pending")

            if (pendingCount == 0) {
                Log.d(TAG, "No pending actions to process")
                return Result.success()
            }

            var processedCount = 0
            var failedCount = 0

            // Process pending actions FIFO, up to batch limit
            repeat(minOf(pendingCount, MAX_BATCH_SIZE)) {
                val action = renderRepository.popOldestPendingAction()
                if (action != null) {
                    try {
                        processPendingAction(action.id, action.actionType, action.payloadJson)
                        renderRepository.removePendingAction(action.id)
                        processedCount++
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to process action ${action.id}: ${e.message}")
                        if (action.retryCount < MAX_ACTION_RETRIES) {
                            renderRepository.incrementPendingActionRetry(action.id)
                        } else {
                            Log.e(TAG, "Max retries reached for action ${action.id}, removing")
                            renderRepository.removePendingAction(action.id)
                        }
                        failedCount++
                    }
                }
            }

            Log.i(TAG, "Sync complete: $processedCount processed, $failedCount failed")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Sync worker failed: ${e.message}")
            Result.retry()
        }
    }

    /**
     * Route a pending action to its handler.
     * In production, each action type would be dispatched to the
     * appropriate API client.
     */
    private suspend fun processPendingAction(id: Long, actionType: String, payload: String) {
        Log.d(TAG, "Processing action $id: type=$actionType")

        when (actionType) {
            com.renderflow.data.local.entity.ActionType.SUBMIT_RENDER -> {
                val json = kotlinx.serialization.json.Json.decodeFromString<kotlinx.serialization.json.JsonObject>(payload)
                val jobId = json["jobId"]?.kotlinx.serialization.json.jsonPrimitive?.content
                    ?: throw IllegalArgumentException("Missing jobId")
                val projectId = json["projectId"]?.kotlinx.serialization.json.jsonPrimitive?.content
                    ?: throw IllegalArgumentException("Missing projectId")
                val propsJson = json["propsJson"]?.kotlinx.serialization.json.jsonPrimitive?.content ?: "{}"

                val success = renderRepository.submitRemoteRender(jobId, projectId, propsJson)
                if (!success) {
                    throw Exception("Remote submission failed for job $jobId")
                }
            }
            else -> {
                Log.w(TAG, "Unknown action type: $actionType")
            }
        }
    }

    companion object {
        const val WORK_NAME = "sync_worker"
        private const val TAG = "SyncWorker"
        private const val MAX_BATCH_SIZE = 10
        private const val MAX_ACTION_RETRIES = 5
    }
}
