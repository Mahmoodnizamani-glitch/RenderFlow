package com.renderflow.data.remote.model

import com.renderflow.data.local.entity.ProjectEntity
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ProjectDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "compositionId") val compositionId: String,
    @Json(name = "templateUrl") val templateUrl: String,
    @Json(name = "propsJson") val propsJson: String?,
    @Json(name = "version") val version: Int?,
    @Json(name = "createdAt") val createdAt: Long?,
    @Json(name = "updatedAt") val updatedAt: Long?
)

fun ProjectDto.toEntity(): ProjectEntity {
    return ProjectEntity(
        id = id,
        name = name,
        compositionId = compositionId,
        templateUrl = templateUrl,
        propsJson = propsJson ?: "{}",
        version = version ?: 1,
        createdAt = createdAt ?: System.currentTimeMillis(),
        updatedAt = updatedAt ?: System.currentTimeMillis()
    )
}
