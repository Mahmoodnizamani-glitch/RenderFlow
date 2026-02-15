package com.renderflow.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.Instant

@Entity(tableName = "template_schemas")
data class TemplateSchemaEntity(
    @PrimaryKey
    @ColumnInfo(name = "composition_id")
    val compositionId: String,

    @ColumnInfo(name = "schema_json")
    val schemaJson: String,

    @ColumnInfo(name = "schema_version")
    val schemaVersion: Int = 1,

    @ColumnInfo(name = "fetched_at")
    val fetchedAt: Long = Instant.now().toEpochMilli(),
)
