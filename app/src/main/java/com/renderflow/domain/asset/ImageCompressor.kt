package com.renderflow.domain.asset

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject

/**
 * On-device image compression using BitmapFactory downsampling
 * and JPEG/WebP re-encoding. Designed for processing user-selected
 * images before upload.
 */
class ImageCompressor @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    /**
     * Compresses an image URI into a smaller file.
     *
     * @param sourceUri URI pointing to the original image (content:// or file://)
     * @param outputDir Directory to write the compressed file
     * @param maxWidth Max width dimension (height scales proportionally)
     * @param maxHeight Max height dimension (width scales proportionally)
     * @param quality JPEG/WebP quality 0-100
     * @return File pointing to the compressed image, or null on failure
     */
    suspend fun compress(
        sourceUri: Uri,
        outputDir: File,
        maxWidth: Int = MAX_DIMENSION,
        maxHeight: Int = MAX_DIMENSION,
        quality: Int = DEFAULT_QUALITY,
    ): Result<File> = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(sourceUri)
                ?: return@withContext Result.failure(
                    IllegalArgumentException("Cannot open source URI: $sourceUri"),
                )

            // Step 1: Decode bounds only (no pixel allocation)
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeStream(inputStream, null, options)
            inputStream.close()

            val originalWidth = options.outWidth
            val originalHeight = options.outHeight
            if (originalWidth <= 0 || originalHeight <= 0) {
                return@withContext Result.failure(
                    IllegalArgumentException("Invalid image dimensions: ${originalWidth}x$originalHeight"),
                )
            }

            // Step 2: Calculate sample size for downsampling
            val sampleSize = calculateSampleSize(originalWidth, originalHeight, maxWidth, maxHeight)

            // Step 3: Decode with downsampling
            val decodeStream = context.contentResolver.openInputStream(sourceUri)
                ?: return@withContext Result.failure(
                    IllegalArgumentException("Cannot reopen source URI: $sourceUri"),
                )
            val decodeOptions = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
            val bitmap = BitmapFactory.decodeStream(decodeStream, null, decodeOptions)
            decodeStream.close()

            if (bitmap == null) {
                return@withContext Result.failure(
                    IllegalArgumentException("Failed to decode image from URI: $sourceUri"),
                )
            }

            // Step 4: Scale to exact target if still over limits
            val scaledBitmap = scaleToFit(bitmap, maxWidth, maxHeight)

            // Step 5: Compress and write to file
            if (!outputDir.exists()) {
                outputDir.mkdirs()
            }
            val outputFile = File(outputDir, "compressed_${System.currentTimeMillis()}.webp")

            FileOutputStream(outputFile).use { fos ->
                @Suppress("DEPRECATION")
                scaledBitmap.compress(Bitmap.CompressFormat.WEBP, quality, fos)
                fos.flush()
            }

            // Recycle bitmaps
            if (scaledBitmap !== bitmap) {
                scaledBitmap.recycle()
            }
            bitmap.recycle()

            Log.d(TAG, "Compressed image: ${originalWidth}x$originalHeight -> " +
                "${scaledBitmap.width}x${scaledBitmap.height}, size=${outputFile.length()} bytes")

            Result.success(outputFile)
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied reading URI: ${e.message}")
            Result.failure(e)
        } catch (e: Exception) {
            Log.e(TAG, "Compression failed: ${e.message}")
            Result.failure(e)
        }
    }

    companion object {
        private const val TAG = "ImageCompressor"
        private const val MAX_DIMENSION = 1920
        private const val DEFAULT_QUALITY = 80

        fun calculateSampleSize(
            rawWidth: Int,
            rawHeight: Int,
            maxWidth: Int,
            maxHeight: Int,
        ): Int {
            var sampleSize = 1
            if (rawHeight > maxHeight || rawWidth > maxWidth) {
                val halfHeight = rawHeight / 2
                val halfWidth = rawWidth / 2
                while ((halfHeight / sampleSize) >= maxHeight &&
                    (halfWidth / sampleSize) >= maxWidth
                ) {
                    sampleSize *= 2
                }
            }
            return sampleSize
        }

        fun scaleToFit(bitmap: Bitmap, maxWidth: Int, maxHeight: Int): Bitmap {
            if (bitmap.width <= maxWidth && bitmap.height <= maxHeight) {
                return bitmap
            }
            val ratio = minOf(
                maxWidth.toFloat() / bitmap.width,
                maxHeight.toFloat() / bitmap.height,
            )
            val newWidth = (bitmap.width * ratio).toInt()
            val newHeight = (bitmap.height * ratio).toInt()
            return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
        }
    }
}
