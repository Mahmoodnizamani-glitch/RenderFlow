package com.renderflow.data.local.dao

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.renderflow.data.local.RenderFlowDatabase
import com.renderflow.data.local.entity.ActionType
import com.renderflow.data.local.entity.PendingActionEntity
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PendingActionDaoTest {

    private lateinit var database: RenderFlowDatabase
    private lateinit var pendingActionDao: PendingActionDao

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, RenderFlowDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        pendingActionDao = database.pendingActionDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun insertAndGetOldest() = runTest {
        val action = PendingActionEntity(
            actionType = ActionType.SUBMIT_RENDER,
            payloadJson = """{"jobId":"j1"}""",
            createdAt = 1000L,
        )
        pendingActionDao.insert(action)

        val oldest = pendingActionDao.getOldest()
        assertNotNull(oldest)
        assertEquals(ActionType.SUBMIT_RENDER, oldest!!.actionType)
    }

    @Test
    fun getOldest_returnsFifo() = runTest {
        pendingActionDao.insert(
            PendingActionEntity(
                actionType = ActionType.SUBMIT_RENDER,
                payloadJson = """{"jobId":"first"}""",
                createdAt = 1000L,
            ),
        )
        pendingActionDao.insert(
            PendingActionEntity(
                actionType = ActionType.UPLOAD_ASSET,
                payloadJson = """{"assetId":"second"}""",
                createdAt = 2000L,
            ),
        )

        val oldest = pendingActionDao.getOldest()
        assertNotNull(oldest)
        assertEquals("""{"jobId":"first"}""", oldest!!.payloadJson)
    }

    @Test
    fun deleteById_removesAction() = runTest {
        val id = pendingActionDao.insert(
            PendingActionEntity(
                actionType = ActionType.SUBMIT_RENDER,
                payloadJson = "{}",
            ),
        )

        pendingActionDao.deleteById(id)

        val result = pendingActionDao.getOldest()
        assertNull(result)
    }

    @Test
    fun count_returnsCorrectCount() = runTest {
        assertEquals(0, pendingActionDao.count())

        pendingActionDao.insert(
            PendingActionEntity(actionType = ActionType.SUBMIT_RENDER, payloadJson = "{}"),
        )
        pendingActionDao.insert(
            PendingActionEntity(actionType = ActionType.UPLOAD_ASSET, payloadJson = "{}"),
        )

        assertEquals(2, pendingActionDao.count())
    }

    @Test
    fun incrementRetry_updatesRetryCount() = runTest {
        val id = pendingActionDao.insert(
            PendingActionEntity(
                actionType = ActionType.SUBMIT_RENDER,
                payloadJson = "{}",
                retryCount = 0,
            ),
        )

        pendingActionDao.incrementRetry(id)
        pendingActionDao.incrementRetry(id)

        val action = pendingActionDao.getOldest()
        assertNotNull(action)
        assertEquals(2, action!!.retryCount)
    }

    @Test
    fun getByType_filtersCorrectly() = runTest {
        pendingActionDao.insert(
            PendingActionEntity(actionType = ActionType.SUBMIT_RENDER, payloadJson = "{}"),
        )
        pendingActionDao.insert(
            PendingActionEntity(actionType = ActionType.UPLOAD_ASSET, payloadJson = "{}"),
        )
        pendingActionDao.insert(
            PendingActionEntity(actionType = ActionType.SUBMIT_RENDER, payloadJson = "{}"),
        )

        val renderActions = pendingActionDao.getByType(ActionType.SUBMIT_RENDER)
        assertEquals(2, renderActions.size)

        val uploadActions = pendingActionDao.getByType(ActionType.UPLOAD_ASSET)
        assertEquals(1, uploadActions.size)
    }

    @Test
    fun getOldest_emptyTable() = runTest {
        val result = pendingActionDao.getOldest()
        assertNull(result)
    }
}
