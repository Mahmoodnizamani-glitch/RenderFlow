package com.renderflow.worker

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.renderflow.data.local.entity.UploadStatus
import com.renderflow.data.repository.RenderRepository
import com.renderflow.domain.asset.ImageCompressor
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.io.File

/**
 * WorkManager worker that compresses and uploads an asset.
 * Implements on-device compression before upload, with resumable
 * upload stub (TUS protocol interface).
 */
@HiltWorker
class AssetUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val renderRepository: RenderRepository,
    private val imageCompressor: ImageCompressor,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val assetId = inputData.getString(KEY_ASSET_ID)
            ?: return Result.failure().also {
                Log.e(TAG, "Missing assetId in worker input data")
            }

        val localUri = inputData.getString(KEY_LOCAL_URI)
            ?: return Result.failure().also {
                Log.e(TAG, "Missing localUri in worker input data")
            }

        return try {
            Log.i(TAG, "Processing asset upload: $assetId")

            // Step 1: Compress image on-device
            renderRepository.updateAssetUploadStatus(assetId, UploadStatus.COMPRESSING)

            val compressedDir = File(applicationContext.cacheDir, "compressed")
            val compressResult = imageCompressor.compress(
                sourceUri = Uri.parse(localUri),
                outputDir = compressedDir,
            )

            val compressedFile = compressResult.getOrElse { error ->
                Log.e(TAG, "Compression failed for $assetId: ${error.message}")
                renderRepository.updateAssetUploadStatus(assetId, UploadStatus.FAILED)
                return Result.failure()
            }

            // Step 2: Upload (stub — TUS protocol in production)
            renderRepository.updateAssetUploadStatus(assetId, UploadStatus.UPLOADING)

            val remoteUrl = simulateTusUpload(compressedFile, assetId)

            // Step 3: Update asset record with remote URL
            renderRepository.updateAssetRemoteUri(assetId, remoteUrl)
            renderRepository.updateAssetUploadStatus(assetId, UploadStatus.UPLOADED)

            // Clean up compressed file
            compressedFile.delete()

            Log.i(TAG, "Asset uploaded successfully: $assetId -> $remoteUrl")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Asset upload failed for $assetId: ${e.message}")

            if (runAttemptCount < MAX_RETRIES) {
                Log.i(TAG, "Will retry (attempt ${runAttemptCount + 1}/$MAX_RETRIES)")
                Result.retry()
            } else {
                renderRepository.updateAssetUploadStatus(assetId, UploadStatus.FAILED)
                Result.failure()
            }
        }
    }

    /**
     * Placeholder for TUS resumable upload.
     * In production, this would implement the TUS protocol
     * for reliable, resumable file uploads.
     */
    private suspend fun simulateTusUpload(file: File, assetId: String): String {
        // TUS upload logic would go here:
        // val tusClient = TusClient(uploadUrl)
        // val upload = TusUpload(file)
        // tusClient.resumeOrCreateUpload(upload)
        Log.d(TAG, "TUS upload stub for asset: $assetId, size=${file.length()} bytes")
        return "https://cdn.renderflow.io/assets/$assetId"
    }

    companion object {
        const val KEY_ASSET_ID = "asset_id"
        const val KEY_LOCAL_URI = "local_uri"
        private const val TAG = "AssetUploadWorker"
        private const val MAX_RETRIES = 3
    }
}
