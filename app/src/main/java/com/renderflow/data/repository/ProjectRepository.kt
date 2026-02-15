package com.renderflow.data.repository

import com.renderflow.data.local.dao.ProjectDao
import com.renderflow.data.local.dao.TemplateSchemaDao
import com.renderflow.data.local.entity.ProjectEntity
import com.renderflow.data.local.entity.TemplateSchemaEntity
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

class ProjectRepository @Inject constructor(
    private val projectDao: ProjectDao,
    private val templateSchemaDao: TemplateSchemaDao,
) {
    fun observeAllProjects(): Flow<List<ProjectEntity>> = projectDao.observeAll()

    fun observeProject(id: String): Flow<ProjectEntity?> = projectDao.observeById(id)

    suspend fun getProject(id: String): ProjectEntity? = projectDao.getById(id)

    suspend fun createProject(
        name: String,
        compositionId: String,
        templateUrl: String,
    ): String {
        val id = UUID.randomUUID().toString()
        val now = Instant.now().toEpochMilli()
        projectDao.upsert(
            ProjectEntity(
                id = id,
                name = name,
                compositionId = compositionId,
                templateUrl = templateUrl,
                createdAt = now,
                updatedAt = now,
            ),
        )
        return id
    }

    suspend fun updateProjectProps(projectId: String, propsJson: String) {
        val now = Instant.now().toEpochMilli()
        projectDao.updateProps(projectId, propsJson, now)
    }

    suspend fun deleteProject(projectId: String) {
        projectDao.deleteById(projectId)
    }

    suspend fun getTemplateSchema(compositionId: String): TemplateSchemaEntity? =
        templateSchemaDao.getByCompositionId(compositionId)

    suspend fun saveTemplateSchema(schema: TemplateSchemaEntity) {
        templateSchemaDao.upsert(schema)
    }
}
