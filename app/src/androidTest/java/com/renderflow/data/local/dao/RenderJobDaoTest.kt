package com.renderflow.data.local.dao

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.renderflow.data.local.RenderFlowDatabase
import com.renderflow.data.local.entity.ProjectEntity
import com.renderflow.data.local.entity.RenderJobEntity
import com.renderflow.data.local.entity.RenderStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RenderJobDaoTest {

    private lateinit var database: RenderFlowDatabase
    private lateinit var renderJobDao: RenderJobDao
    private lateinit var projectDao: ProjectDao

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, RenderFlowDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        renderJobDao = database.renderJobDao()
        projectDao = database.projectDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    private suspend fun insertParentProject(id: String = "project-1") {
        projectDao.upsert(
            ProjectEntity(
                id = id,
                name = "Test Project",
                compositionId = "comp-1",
                templateUrl = "https://example.com/template",
            ),
        )
    }

    @Test
    fun insertAndObserveRenderJob() = runTest {
        insertParentProject()
        val job = RenderJobEntity(
            id = "job-1",
            projectId = "project-1",
            status = RenderStatus.PENDING,
        )
        renderJobDao.upsert(job)

        val jobs = renderJobDao.observeByProject("project-1").first()
        assertEquals(1, jobs.size)
        assertEquals(RenderStatus.PENDING, jobs[0].status)
    }

    @Test
    fun updateStatus() = runTest {
        insertParentProject()
        renderJobDao.upsert(
            RenderJobEntity(id = "job-2", projectId = "project-1"),
        )

        renderJobDao.updateStatus("job-2", RenderStatus.RENDERING)

        val job = renderJobDao.getById("job-2")
        assertNotNull(job)
        assertEquals(RenderStatus.RENDERING, job!!.status)
    }

    @Test
    fun updateResult() = runTest {
        insertParentProject()
        renderJobDao.upsert(
            RenderJobEntity(id = "job-3", projectId = "project-1"),
        )

        renderJobDao.updateResult("job-3", RenderStatus.DONE, "https://cdn.example.com/video.mp4")

        val job = renderJobDao.getById("job-3")
        assertNotNull(job)
        assertEquals(RenderStatus.DONE, job!!.status)
        assertEquals("https://cdn.example.com/video.mp4", job.resultUrl)
    }

    @Test
    fun observeByProject_orderedByCreatedAtDesc() = runTest {
        insertParentProject()
        renderJobDao.upsert(
            RenderJobEntity(id = "older", projectId = "project-1", createdAt = 1000L),
        )
        renderJobDao.upsert(
            RenderJobEntity(id = "newer", projectId = "project-1", createdAt = 2000L),
        )

        val jobs = renderJobDao.observeByProject("project-1").first()
        assertEquals(2, jobs.size)
        assertEquals("newer", jobs[0].id)
        assertEquals("older", jobs[1].id)
    }

    @Test
    fun observeByProject_filtersCorrectly() = runTest {
        insertParentProject("project-1")
        insertParentProject("project-2")

        renderJobDao.upsert(RenderJobEntity(id = "job-a", projectId = "project-1"))
        renderJobDao.upsert(RenderJobEntity(id = "job-b", projectId = "project-2"))

        val jobs1 = renderJobDao.observeByProject("project-1").first()
        assertEquals(1, jobs1.size)
        assertEquals("job-a", jobs1[0].id)
    }
}
