package com.renderflow.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.Instant
import java.util.UUID

@Entity(
    tableName = "render_jobs",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["project_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("project_id")],
)
data class RenderJobEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    @ColumnInfo(name = "project_id")
    val projectId: String,

    val status: String = RenderStatus.PENDING,

    @ColumnInfo(name = "result_url")
    val resultUrl: String? = null,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = Instant.now().toEpochMilli(),
)

object RenderStatus {
    const val PENDING = "PENDING"
    const val QUEUED = "QUEUED"
    const val RENDERING = "RENDERING"
    const val DONE = "DONE"
    const val FAILED = "FAILED"
}
