package com.renderflow.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.renderflow.data.local.entity.TemplateSchemaEntity

@Dao
interface TemplateSchemaDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(schema: TemplateSchemaEntity)

    @Query("SELECT * FROM template_schemas WHERE composition_id = :compositionId")
    suspend fun getByCompositionId(compositionId: String): TemplateSchemaEntity?

    @Query("SELECT schema_version FROM template_schemas WHERE composition_id = :compositionId")
    suspend fun getVersion(compositionId: String): Int?
}
