package com.renderflow.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.renderflow.data.local.dao.AssetRecordDao
import com.renderflow.data.local.dao.PendingActionDao
import com.renderflow.data.local.dao.ProjectDao
import com.renderflow.data.local.dao.RenderJobDao
import com.renderflow.data.local.dao.TemplateSchemaDao
import com.renderflow.data.local.entity.AssetRecordEntity
import com.renderflow.data.local.entity.PendingActionEntity
import com.renderflow.data.local.entity.ProjectEntity
import com.renderflow.data.local.entity.RenderJobEntity
import com.renderflow.data.local.entity.TemplateSchemaEntity

@Database(
    entities = [
        ProjectEntity::class,
        RenderJobEntity::class,
        TemplateSchemaEntity::class,
        AssetRecordEntity::class,
        PendingActionEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class RenderFlowDatabase : RoomDatabase() {
    abstract fun projectDao(): ProjectDao
    abstract fun renderJobDao(): RenderJobDao
    abstract fun templateSchemaDao(): TemplateSchemaDao
    abstract fun assetRecordDao(): AssetRecordDao
    abstract fun pendingActionDao(): PendingActionDao
}
