package com.renderflow.data.remote.model

import com.renderflow.data.local.entity.RenderJobEntity
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class RenderJobDto(
    @Json(name = "id") val id: String,
    @Json(name = "projectId") val projectId: String,
    @Json(name = "status") val status: String,
    @Json(name = "resultUrl") val resultUrl: String?,
    @Json(name = "createdAt") val createdAt: Long?
)

fun RenderJobDto.toEntity(): RenderJobEntity {
    return RenderJobEntity(
        id = id,
        projectId = projectId,
        status = status,
        resultUrl = resultUrl,
        createdAt = createdAt ?: System.currentTimeMillis()
    )
}
