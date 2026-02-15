package com.renderflow.data.remote

import com.renderflow.data.remote.model.ProjectDto
import com.renderflow.data.remote.model.RenderJobDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface RenderFlowApi {

    @GET("projects")
    suspend fun getProjects(): List<ProjectDto>

    @GET("render-jobs")
    suspend fun getRenderJobs(@Query("projectId") projectId: String): List<RenderJobDto>

    @POST("render-jobs")
    suspend fun createRenderJob(@Body job: CreateRenderJobRequest): RenderJobDto
}

@com.squareup.moshi.JsonClass(generateAdapter = true)
data class CreateRenderJobRequest(
    @com.squareup.moshi.Json(name = "projectId") val projectId: String,
    @com.squareup.moshi.Json(name = "propsJson") val propsJson: String
)
