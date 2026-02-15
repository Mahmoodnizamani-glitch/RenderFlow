package com.renderflow.ui.screen.projects

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.renderflow.data.repository.ProjectRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProjectsViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProjectsUiState())
    val uiState: StateFlow<ProjectsUiState> = _uiState.asStateFlow()

    init {
        observeProjects()
    }

    fun showCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = true) }
    }

    fun dismissCreateDialog() {
        _uiState.update { it.copy(showCreateDialog = false) }
    }

    fun createProject(name: String): String? {
        var projectId: String? = null
        viewModelScope.launch {
            try {
                projectId = projectRepository.createProject(
                    name = name.trim(),
                    compositionId = "default-composition",
                    templateUrl = "https://remotion.dev/templates/default",
                )
                _uiState.update { it.copy(showCreateDialog = false) }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create project: ${e.message}")
            }
        }
        return projectId
    }

    fun deleteProject(projectId: String) {
        viewModelScope.launch {
            try {
                projectRepository.deleteProject(projectId)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to delete project: ${e.message}")
            }
        }
    }

    private fun observeProjects() {
        viewModelScope.launch {
            projectRepository.observeAllProjects()
                .catch { e ->
                    Log.e(TAG, "Error observing projects: ${e.message}")
                }
                .collect { projects ->
                    _uiState.update {
                        it.copy(projects = projects, isLoading = false)
                    }
                }
        }
    }

    companion object {
        private const val TAG = "ProjectsViewModel"
    }
}
