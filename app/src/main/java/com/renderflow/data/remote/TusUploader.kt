package com.renderflow.data.remote

import android.util.Log
import io.tus.java.client.TusClient
import io.tus.java.client.TusExecutor
import io.tus.java.client.TusURLMemoryStore
import io.tus.java.client.TusUpload
import io.tus.java.client.TusUploader
import java.io.File
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TusUploader @Inject constructor() {

    private val client = TusClient()

    init {
        // ideally base URL comes from config/build types
        client.setUploadCreationURL(URL("https://master.tus.io/files/"))
        client.enableResuming(TusURLMemoryStore())
    }

    /**
     * Uploads the file using TUS protocol.
     * Blocks until completion or throws Exception.
     * WorkManager will handle retries.
     */
    fun upload(file: File, assetId: String): String {
        val upload = TusUpload(file)
        upload.metadata = mapOf("filename" to file.name, "assetId" to assetId)

        Log.d(TAG, "Starting TUS upload for $assetId (size: ${file.length()})")

        // Resume if possible, otherwise create new
        val uploader = client.resumeOrCreateUpload(upload)
        uploader.chunkSize = 1024 * 1024 // 1MB

        do {
            val totalBytes = upload.size
            val bytesUploaded = uploader.offset
            // Calculate progress if needed
        } while (uploader.uploadChunk() > -1)

        uploader.finish()
        Log.i(TAG, "TUS upload finished. URL: ${uploader.uploadURL}")
        return uploader.uploadURL.toString()
    }

    companion object {
        private const val TAG = "TusUploader"
    }
}
