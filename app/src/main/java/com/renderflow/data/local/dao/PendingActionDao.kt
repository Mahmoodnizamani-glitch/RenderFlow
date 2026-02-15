package com.renderflow.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.renderflow.data.local.entity.PendingActionEntity

@Dao
interface PendingActionDao {

    @Insert
    suspend fun insert(action: PendingActionEntity): Long

    @Query("SELECT * FROM pending_actions ORDER BY created_at ASC LIMIT 1")
    suspend fun getOldest(): PendingActionEntity?

    @Query("DELETE FROM pending_actions WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT COUNT(*) FROM pending_actions")
    suspend fun count(): Int

    @Query("UPDATE pending_actions SET retry_count = retry_count + 1 WHERE id = :id")
    suspend fun incrementRetry(id: Long)

    @Query("SELECT * FROM pending_actions WHERE action_type = :actionType ORDER BY created_at ASC")
    suspend fun getByType(actionType: String): List<PendingActionEntity>
}
