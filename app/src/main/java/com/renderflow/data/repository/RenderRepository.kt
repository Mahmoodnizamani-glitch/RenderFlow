package com.renderflow.data.repository

import com.renderflow.data.local.dao.AssetRecordDao
import com.renderflow.data.local.dao.PendingActionDao
import com.renderflow.data.local.dao.RenderJobDao
import com.renderflow.data.local.entity.ActionType
import com.renderflow.data.local.entity.PendingActionEntity
import com.renderflow.data.local.entity.RenderJobEntity
import com.renderflow.data.local.entity.RenderStatus
import com.renderflow.data.local.entity.UploadStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID
import javax.inject.Inject

class RenderRepository @Inject constructor(
    private val renderJobDao: RenderJobDao,
    private val pendingActionDao: PendingActionDao,
    private val assetRecordDao: AssetRecordDao,
) {
    fun observeRenderJobs(projectId: String): Flow<List<RenderJobEntity>> =
        renderJobDao.observeByProject(projectId)

    suspend fun submitRender(projectId: String, propsJson: String): String {
        val jobId = UUID.randomUUID().toString()

        renderJobDao.upsert(
            RenderJobEntity(
                id = jobId,
                projectId = projectId,
                status = RenderStatus.PENDING,
            ),
        )

        val payload = buildJsonObject {
            put("jobId", jobId)
            put("projectId", projectId)
            put("propsJson", propsJson)
        }

        pendingActionDao.insert(
            PendingActionEntity(
                actionType = ActionType.SUBMIT_RENDER,
                payloadJson = Json.encodeToString(payload),
            ),
        )

        return jobId
    }

    // --- Render job status ---

    suspend fun updateRenderJobStatus(jobId: String, status: String) {
        renderJobDao.updateStatus(jobId, status)
    }

    suspend fun updateRenderJobResult(jobId: String, status: String, resultUrl: String) {
        renderJobDao.updateResult(jobId, status, resultUrl)
    }

    // --- Asset upload ---

    suspend fun updateAssetUploadStatus(assetId: String, status: String) {
        assetRecordDao.updateUploadStatus(assetId, status)
    }

    suspend fun updateAssetRemoteUri(assetId: String, remoteUrl: String) {
        assetRecordDao.updateUploadResult(assetId, UploadStatus.UPLOADED, remoteUrl)
    }

    // --- Pending actions (offline queue) ---

    suspend fun getPendingActionCount(): Int = pendingActionDao.count()

    suspend fun popOldestPendingAction(): PendingActionEntity? =
        pendingActionDao.getOldest()

    suspend fun removePendingAction(id: Long) {
        pendingActionDao.deleteById(id)
    }

    suspend fun incrementPendingActionRetry(id: Long) {
        pendingActionDao.incrementRetry(id)
    }
}
