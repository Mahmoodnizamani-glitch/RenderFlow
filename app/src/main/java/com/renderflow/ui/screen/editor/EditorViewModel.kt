package com.renderflow.ui.screen.editor

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.renderflow.data.local.entity.TemplateSchemaEntity
import com.renderflow.data.repository.ProjectRepository
import com.renderflow.domain.parser.SchemaParser
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import javax.inject.Inject

@OptIn(FlowPreview::class)
@HiltViewModel
class EditorViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val projectRepository: ProjectRepository,
    private val schemaParser: SchemaParser,
) : ViewModel() {

    private val projectId: String = savedStateHandle["projectId"]
        ?: throw IllegalArgumentException("projectId is required")

    private val _uiState = MutableStateFlow(EditorUiState(projectId = projectId))
    val uiState: StateFlow<EditorUiState> = _uiState.asStateFlow()

    /**
     * Debounced JSON props flow for WebView injection.
     * Emits serialized JSON at most every 150ms to prevent flooding the WebView.
     */
    val propsJsonFlow: StateFlow<String> = _uiState
        .map { it.propsJson }
        .debounce(DEBOUNCE_MS)
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = "{}",
        )

    init {
        loadProject()
    }

    fun onFieldValueChanged(key: String, value: Any?) {
        _uiState.update { state ->
            val newValues = state.values.toMutableMap().apply { this[key] = value }
            val newPropsJson = serializeProps(newValues)
            state.copy(values = newValues, propsJson = newPropsJson)
        }

        // Persist to Room (source of truth)
        viewModelScope.launch {
            try {
                projectRepository.updateProjectProps(projectId, _uiState.value.propsJson)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to persist props: ${e.message}")
            }
        }
    }

    private fun loadProject() {
        viewModelScope.launch {
            try {
                val project = projectRepository.getProject(projectId)
                if (project == null) {
                    _uiState.update { it.copy(isLoading = false, error = "Project not found") }
                    return@launch
                }

                // Try to load cached schema, or insert mock schema
                var schemaEntity = projectRepository.getTemplateSchema(project.compositionId)
                if (schemaEntity == null) {
                    schemaEntity = createMockSchema(project.compositionId)
                    projectRepository.saveTemplateSchema(schemaEntity)
                }

                val parseResult = schemaParser.parse(schemaEntity.schemaJson)
                parseResult.fold(
                    onSuccess = { schema ->
                        val existingValues = deserializeProps(project.propsJson)
                        val mergedValues = buildDefaultValues(schema.fields, existingValues)

                        _uiState.update {
                            it.copy(
                                projectName = project.name,
                                compositionId = project.compositionId,
                                templateUrl = project.templateUrl,
                                fields = schema.fields,
                                values = mergedValues,
                                propsJson = serializeProps(mergedValues),
                                isLoading = false,
                            )
                        }
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(isLoading = false, error = "Schema parse error: ${error.message}")
                        }
                    },
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load project: ${e.message}")
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    companion object {
        private const val TAG = "EditorViewModel"
        private const val DEBOUNCE_MS = 150L

        private val json = Json {
            ignoreUnknownKeys = true
            isLenient = true
        }

        fun serializeProps(values: Map<String, Any?>): String {
            val jsonMap = values.mapValues { (_, v) -> toJsonElement(v) }
            return json.encodeToString(jsonMap)
        }

        fun deserializeProps(propsJson: String): Map<String, Any?> {
            return try {
                val map = json.decodeFromString<Map<String, JsonElement>>(propsJson)
                map.mapValues { (_, element) -> fromJsonElement(element) }
            } catch (_: Exception) {
                emptyMap()
            }
        }

        private fun toJsonElement(value: Any?): JsonElement {
            return when (value) {
                null -> JsonNull
                is String -> JsonPrimitive(value)
                is Number -> JsonPrimitive(value)
                is Boolean -> JsonPrimitive(value)
                else -> JsonPrimitive(value.toString())
            }
        }

        private fun fromJsonElement(element: JsonElement): Any? {
            return when (element) {
                is JsonNull -> null
                is JsonPrimitive -> when {
                    element.isString -> element.content
                    element.content.toBooleanStrictOrNull() != null -> element.content.toBoolean()
                    element.content.toDoubleOrNull() != null -> element.content.toDouble()
                    else -> element.content
                }
                else -> element.toString()
            }
        }

        fun buildDefaultValues(
            fields: List<com.renderflow.domain.model.SchemaField>,
            existingValues: Map<String, Any?>,
        ): Map<String, Any?> {
            val defaults = mutableMapOf<String, Any?>()
            for (field in fields) {
                val existing = existingValues[field.key]
                if (existing != null) {
                    defaults[field.key] = existing
                    continue
                }
                defaults[field.key] = when (field) {
                    is com.renderflow.domain.model.SchemaField.Text -> field.default ?: ""
                    is com.renderflow.domain.model.SchemaField.Number -> field.default ?: 0.0
                    is com.renderflow.domain.model.SchemaField.Color -> field.default ?: "#000000"
                    is com.renderflow.domain.model.SchemaField.Image -> null
                    is com.renderflow.domain.model.SchemaField.Select -> field.default ?: field.options.firstOrNull() ?: ""
                    is com.renderflow.domain.model.SchemaField.Toggle -> field.default
                }
            }
            return defaults
        }

        fun createMockSchema(compositionId: String): TemplateSchemaEntity {
            val schemaJson = """
            {
                "compositionId": "$compositionId",
                "version": 1,
                "props": [
                    {
                        "key": "title",
                        "label": "Video Title",
                        "type": "text",
                        "required": true,
                        "default": "Welcome to RenderFlow",
                        "placeholder": "Enter your title...",
                        "maxLength": 100
                    },
                    {
                        "key": "subtitle",
                        "label": "Subtitle",
                        "type": "text",
                        "default": "Create stunning videos",
                        "placeholder": "Enter subtitle...",
                        "multiline": true
                    },
                    {
                        "key": "primaryColor",
                        "label": "Primary Color",
                        "type": "color",
                        "default": "#6C63FF"
                    },
                    {
                        "key": "backgroundColor",
                        "label": "Background Color",
                        "type": "color",
                        "default": "#0F0F23"
                    },
                    {
                        "key": "fontSize",
                        "label": "Font Size",
                        "type": "number",
                        "min": 12,
                        "max": 96,
                        "step": 2,
                        "default": 48
                    },
                    {
                        "key": "duration",
                        "label": "Duration (seconds)",
                        "type": "number",
                        "min": 1,
                        "max": 120,
                        "default": 10
                    },
                    {
                        "key": "logo",
                        "label": "Logo Image",
                        "type": "image"
                    },
                    {
                        "key": "style",
                        "label": "Animation Style",
                        "type": "select",
                        "options": ["fade", "slide", "zoom", "bounce"],
                        "default": "fade"
                    },
                    {
                        "key": "showWatermark",
                        "label": "Show Watermark",
                        "type": "toggle",
                        "default": false
                    },
                    {
                        "key": "autoPlay",
                        "label": "Auto Play",
                        "type": "toggle",
                        "default": true
                    }
                ]
            }
            """.trimIndent()

            return TemplateSchemaEntity(
                compositionId = compositionId,
                schemaJson = schemaJson,
                schemaVersion = 1,
                fetchedAt = Instant.now().toEpochMilli(),
            )
        }
    }
}
