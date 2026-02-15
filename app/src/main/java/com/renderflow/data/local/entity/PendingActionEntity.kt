package com.renderflow.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.Instant

@Entity(tableName = "pending_actions")
data class PendingActionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "action_type")
    val actionType: String,

    @ColumnInfo(name = "payload_json")
    val payloadJson: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = Instant.now().toEpochMilli(),

    @ColumnInfo(name = "retry_count")
    val retryCount: Int = 0,
)

object ActionType {
    const val SUBMIT_RENDER = "SUBMIT_RENDER"
    const val UPLOAD_ASSET = "UPLOAD_ASSET"
    const val SYNC_PROJECT = "SYNC_PROJECT"
}
