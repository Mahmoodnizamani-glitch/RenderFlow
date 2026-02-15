package com.renderflow.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.Instant
import java.util.UUID

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    val name: String,

    @ColumnInfo(name = "composition_id")
    val compositionId: String,

    @ColumnInfo(name = "template_url")
    val templateUrl: String,

    @ColumnInfo(name = "props_json")
    val propsJson: String = "{}",

    val version: Int = 1,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = Instant.now().toEpochMilli(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = Instant.now().toEpochMilli(),
)
