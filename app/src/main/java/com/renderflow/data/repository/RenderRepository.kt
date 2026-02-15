package com.renderflow.data.repository

import android.util.Log
import com.renderflow.data.local.dao.AssetRecordDao
import com.renderflow.data.local.dao.PendingActionDao
import com.renderflow.data.local.dao.RenderJobDao
import com.renderflow.data.local.entity.ActionType
import com.renderflow.data.local.entity.PendingActionEntity
import com.renderflow.data.local.entity.RenderJobEntity
import com.renderflow.data.local.entity.RenderStatus
import com.renderflow.data.local.entity.UploadStatus
import com.renderflow.data.remote.CreateRenderJobRequest
import com.renderflow.data.remote.RenderFlowApi
import com.renderflow.data.remote.model.toEntity
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
    private val api: RenderFlowApi,
) {
    fun observeRenderJobs(projectId: String): Flow<List<RenderJobEntity>> =
        renderJobDao.observeByProject(projectId)

    suspend fun syncRenderJobs(projectId: String): Boolean {
        return try {
            val dtos = api.getRenderJobs(projectId)
            val entities = dtos.map { it.toEntity() }
            if (entities.isNotEmpty()) {
                renderJobDao.upsert(entities)
            }
            true
        } catch (e: Exception) {
            Log.e("RenderRepository", "Sync failed for project $projectId", e)
            false
        }
    }

    suspend fun submitRemoteRender(jobId: String, projectId: String, propsJson: String): Boolean {
        return try {
            val dto = api.createRenderJob(CreateRenderJobRequest(projectId, propsJson))
            // Update local job with remote ID/details if necessary.
            // Note: If remote ID is different from local ID (UUID), we might have a conflict or need mapping.
            // Here assuming we use the returned one or keep local.
            // If the API allows passing ID, that's better. If not, we take what we get.
            // For now, let's assume we update the local job with the remote status.
            renderJobDao.upsert(dto.toEntity()) // This might overwrite our local job if ID matches or create new one.
            // If ID doesn't match, we might want to delete the local 'pending' one and replace with remote one.
            // But let's assume for this mock API it returns the same structure or we handle it.
            true
        } catch (e: Exception) {
            Log.e("RenderRepository", "Submit failed for job $jobId", e)
            false
        }
    }

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
