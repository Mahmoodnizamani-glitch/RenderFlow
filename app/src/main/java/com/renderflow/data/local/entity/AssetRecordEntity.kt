package com.renderflow.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.Instant
import java.util.UUID

@Entity(
    tableName = "asset_records",
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
data class AssetRecordEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    @ColumnInfo(name = "project_id")
    val projectId: String,

    @ColumnInfo(name = "local_uri")
    val localUri: String,

    @ColumnInfo(name = "remote_url")
    val remoteUrl: String? = null,

    @ColumnInfo(name = "upload_status")
    val uploadStatus: String = UploadStatus.PENDING,

    @ColumnInfo(name = "compressed_size")
    val compressedSize: Long = 0L,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = Instant.now().toEpochMilli(),
)

object UploadStatus {
    const val PENDING = "PENDING"
    const val COMPRESSING = "COMPRESSING"
    const val UPLOADING = "UPLOADING"
    const val UPLOADED = "UPLOADED"
    const val DONE = "DONE"
    const val FAILED = "FAILED"
}
