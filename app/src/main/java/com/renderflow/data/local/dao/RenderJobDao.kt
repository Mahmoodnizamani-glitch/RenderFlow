package com.renderflow.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.renderflow.data.local.entity.RenderJobEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RenderJobDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(job: RenderJobEntity)

    @Query("SELECT * FROM render_jobs WHERE project_id = :projectId ORDER BY created_at DESC")
    fun observeByProject(projectId: String): Flow<List<RenderJobEntity>>

    @Query("SELECT * FROM render_jobs WHERE id = :id")
    suspend fun getById(id: String): RenderJobEntity?

    @Query("UPDATE render_jobs SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: String)

    @Query("UPDATE render_jobs SET status = :status, result_url = :resultUrl WHERE id = :id")
    suspend fun updateResult(id: String, status: String, resultUrl: String)
}
