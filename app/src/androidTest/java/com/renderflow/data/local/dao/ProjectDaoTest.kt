package com.renderflow.data.local.dao

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.renderflow.data.local.RenderFlowDatabase
import com.renderflow.data.local.entity.ProjectEntity
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ProjectDaoTest {

    private lateinit var database: RenderFlowDatabase
    private lateinit var projectDao: ProjectDao

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, RenderFlowDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        projectDao = database.projectDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun insertAndObserveProject() = runTest {
        val project = ProjectEntity(
            id = "test-1",
            name = "Test Project",
            compositionId = "comp-1",
            templateUrl = "https://example.com/template",
        )
        projectDao.upsert(project)

        val projects = projectDao.observeAll().first()
        assertEquals(1, projects.size)
        assertEquals("Test Project", projects[0].name)
    }

    @Test
    fun getProjectById() = runTest {
        val project = ProjectEntity(
            id = "test-2",
            name = "Another Project",
            compositionId = "comp-2",
            templateUrl = "https://example.com/template2",
        )
        projectDao.upsert(project)

        val found = projectDao.getById("test-2")
        assertNotNull(found)
        assertEquals("Another Project", found!!.name)
    }

    @Test
    fun getProjectById_returnsNullForMissingId() = runTest {
        val found = projectDao.getById("nonexistent")
        assertNull(found)
    }

    @Test
    fun updateProps_incrementsVersion() = runTest {
        val project = ProjectEntity(
            id = "test-3",
            name = "Version Test",
            compositionId = "comp-3",
            templateUrl = "https://example.com/template3",
            version = 1,
        )
        projectDao.upsert(project)

        val newProps = """{"title":"Updated"}"""
        projectDao.updateProps("test-3", newProps, System.currentTimeMillis())

        val updated = projectDao.getById("test-3")
        assertNotNull(updated)
        assertEquals(2, updated!!.version)
        assertEquals(newProps, updated.propsJson)
    }

    @Test
    fun deleteProject() = runTest {
        val project = ProjectEntity(
            id = "test-4",
            name = "Delete Me",
            compositionId = "comp-4",
            templateUrl = "https://example.com/template4",
        )
        projectDao.upsert(project)
        projectDao.deleteById("test-4")

        val found = projectDao.getById("test-4")
        assertNull(found)
    }

    @Test
    fun observeAll_orderedByUpdatedAtDesc() = runTest {
        val older = ProjectEntity(
            id = "old",
            name = "Older",
            compositionId = "comp-old",
            templateUrl = "https://example.com/old",
            updatedAt = 1000L,
        )
        val newer = ProjectEntity(
            id = "new",
            name = "Newer",
            compositionId = "comp-new",
            templateUrl = "https://example.com/new",
            updatedAt = 2000L,
        )
        projectDao.upsert(older)
        projectDao.upsert(newer)

        val projects = projectDao.observeAll().first()
        assertEquals(2, projects.size)
        assertEquals("Newer", projects[0].name)
        assertEquals("Older", projects[1].name)
    }

    @Test
    fun upsert_replacesExistingProject() = runTest {
        val original = ProjectEntity(
            id = "test-5",
            name = "Original",
            compositionId = "comp-5",
            templateUrl = "https://example.com/template5",
        )
        projectDao.upsert(original)

        val updated = original.copy(name = "Updated Name")
        projectDao.upsert(updated)

        val projects = projectDao.observeAll().first()
        assertEquals(1, projects.size)
        assertEquals("Updated Name", projects[0].name)
    }

    @Test
    fun observeById_emitsUpdates() = runTest {
        val project = ProjectEntity(
            id = "test-6",
            name = "Observable",
            compositionId = "comp-6",
            templateUrl = "https://example.com/template6",
        )
        projectDao.upsert(project)

        val observed = projectDao.observeById("test-6").first()
        assertNotNull(observed)
        assertEquals("Observable", observed!!.name)
    }

    @Test
    fun observeAll_emptyDatabase() = runTest {
        val projects = projectDao.observeAll().first()
        assertTrue(projects.isEmpty())
    }
}
