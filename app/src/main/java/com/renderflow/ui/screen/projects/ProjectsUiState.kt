package com.renderflow.ui.screen.projects

import com.renderflow.data.local.entity.ProjectEntity

data class ProjectsUiState(
    val projects: List<ProjectEntity> = emptyList(),
    val isLoading: Boolean = true,
    val showCreateDialog: Boolean = false,
)
