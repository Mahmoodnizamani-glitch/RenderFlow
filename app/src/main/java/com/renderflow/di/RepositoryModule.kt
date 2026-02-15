package com.renderflow.di

import com.renderflow.data.local.dao.AssetRecordDao
import com.renderflow.data.local.dao.PendingActionDao
import com.renderflow.data.local.dao.ProjectDao
import com.renderflow.data.local.dao.RenderJobDao
import com.renderflow.data.local.dao.TemplateSchemaDao
import com.renderflow.data.repository.ProjectRepository
import com.renderflow.data.repository.RenderRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideProjectRepository(
        projectDao: ProjectDao,
        templateSchemaDao: TemplateSchemaDao,
    ): ProjectRepository = ProjectRepository(projectDao, templateSchemaDao)

    @Provides
    @Singleton
    fun provideRenderRepository(
        renderJobDao: RenderJobDao,
        pendingActionDao: PendingActionDao,
        assetRecordDao: AssetRecordDao,
    ): RenderRepository = RenderRepository(renderJobDao, pendingActionDao, assetRecordDao)
}
