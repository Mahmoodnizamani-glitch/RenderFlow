package com.renderflow.ui.screen.editor

import com.renderflow.domain.model.SchemaField

/**
 * UI state for the editor screen.
 */
data class EditorUiState(
    val projectId: String = "",
    val projectName: String = "",
    val compositionId: String = "",
    val templateUrl: String = "",
    val fields: List<SchemaField> = emptyList(),
    val values: Map<String, Any?> = emptyMap(),
    val propsJson: String = "{}",
    val isLoading: Boolean = true,
    val error: String? = null,
)
