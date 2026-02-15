package com.renderflow.di

import android.content.Context
import androidx.room.Room
import com.renderflow.data.local.RenderFlowDatabase
import com.renderflow.data.local.dao.AssetRecordDao
import com.renderflow.data.local.dao.PendingActionDao
import com.renderflow.data.local.dao.ProjectDao
import com.renderflow.data.local.dao.RenderJobDao
import com.renderflow.data.local.dao.TemplateSchemaDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): RenderFlowDatabase {
        return Room.databaseBuilder(
            context,
            RenderFlowDatabase::class.java,
            "renderflow.db",
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideProjectDao(database: RenderFlowDatabase): ProjectDao = database.projectDao()

    @Provides
    fun provideRenderJobDao(database: RenderFlowDatabase): RenderJobDao = database.renderJobDao()

    @Provides
    fun provideTemplateSchemaDao(database: RenderFlowDatabase): TemplateSchemaDao =
        database.templateSchemaDao()

    @Provides
    fun provideAssetRecordDao(database: RenderFlowDatabase): AssetRecordDao =
        database.assetRecordDao()

    @Provides
    fun providePendingActionDao(database: RenderFlowDatabase): PendingActionDao =
        database.pendingActionDao()
}
