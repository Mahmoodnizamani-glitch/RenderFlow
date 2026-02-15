package com.renderflow.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.renderflow.data.local.entity.AssetRecordEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AssetRecordDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(asset: AssetRecordEntity)

    @Query("SELECT * FROM asset_records WHERE project_id = :projectId ORDER BY created_at DESC")
    fun observeByProject(projectId: String): Flow<List<AssetRecordEntity>>

    @Query("SELECT * FROM asset_records WHERE id = :id")
    suspend fun getById(id: String): AssetRecordEntity?

    @Query("UPDATE asset_records SET upload_status = :status WHERE id = :id")
    suspend fun updateUploadStatus(id: String, status: String)

    @Query("UPDATE asset_records SET upload_status = :status, remote_url = :remoteUrl WHERE id = :id")
    suspend fun updateUploadResult(id: String, status: String, remoteUrl: String)
}
