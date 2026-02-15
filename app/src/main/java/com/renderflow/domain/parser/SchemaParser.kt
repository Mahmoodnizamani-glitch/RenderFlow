package com.renderflow.domain.parser

import android.util.Log
import com.renderflow.domain.model.SchemaField
import com.renderflow.domain.model.TemplateSchema
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull
import javax.inject.Inject

/**
 * Parses a JSON schema string describing a Remotion template's configurable props
 * into a [TemplateSchema] domain model.
 *
 * Expected JSON format:
 * ```json
 * {
 *   "compositionId": "my-template",
 *   "version": 1,
 *   "props": [
 *     { "key": "title", "label": "Title", "type": "text", "required": true, "default": "Hello" },
 *     { "key": "color", "label": "Brand Color", "type": "color", "default": "#FF0000" },
 *     { "key": "logo", "label": "Logo", "type": "image" },
 *     { "key": "fontSize", "label": "Font Size", "type": "number", "min": 10, "max": 100 },
 *     { "key": "style", "label": "Style", "type": "select", "options": ["modern", "classic"] },
 *     { "key": "showLogo", "label": "Show Logo", "type": "toggle", "default": true }
 *   ]
 * }
 * ```
 *
 * Unknown field types are logged and skipped, ensuring forward compatibility
 * with new schema versions.
 */
class SchemaParser @Inject constructor() {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    fun parse(schemaJson: String): Result<TemplateSchema> {
        return try {
            val root = json.parseToJsonElement(schemaJson).jsonObject
            val compositionId = root.getStringOrThrow("compositionId")
            val version = root["version"]?.jsonPrimitive?.intOrNull ?: 1
            val propsArray = root["props"]?.jsonArray
                ?: throw IllegalArgumentException("Missing 'props' array in schema")

            val fields = parseFields(propsArray)
            Result.success(
                TemplateSchema(
                    compositionId = compositionId,
                    version = version,
                    fields = fields,
                ),
            )
        } catch (e: IllegalArgumentException) {
            Log.e(TAG, "Schema validation error: ${e.message}")
            Result.failure(e)
        } catch (e: kotlinx.serialization.SerializationException) {
            Log.e(TAG, "Schema JSON parse error: ${e.message}")
            Result.failure(IllegalArgumentException("Invalid JSON schema: ${e.message}", e))
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected schema parse error: ${e.message}")
            Result.failure(IllegalArgumentException("Failed to parse schema: ${e.message}", e))
        }
    }

    private fun parseFields(propsArray: JsonArray): List<SchemaField> {
        return propsArray.mapNotNull { element ->
            try {
                val obj = element.jsonObject
                parseField(obj)
            } catch (e: Exception) {
                Log.w(TAG, "Skipping malformed field: ${e.message}")
                null
            }
        }
    }

    private fun parseField(obj: JsonObject): SchemaField? {
        val key = obj.getStringOrThrow("key")
        val label = obj.getStringOrNull("label") ?: key
        val type = obj.getStringOrThrow("type").lowercase()
        val required = obj["required"]?.jsonPrimitive?.booleanOrNull ?: false

        return when (type) {
            "text", "string" -> SchemaField.Text(
                key = key,
                label = label,
                required = required,
                maxLength = obj["maxLength"]?.jsonPrimitive?.intOrNull,
                default = obj.getStringOrNull("default"),
                placeholder = obj.getStringOrNull("placeholder"),
                multiline = obj["multiline"]?.jsonPrimitive?.booleanOrNull ?: false,
            )

            "number", "integer", "float" -> SchemaField.Number(
                key = key,
                label = label,
                required = required,
                min = obj["min"]?.jsonPrimitive?.doubleOrNull,
                max = obj["max"]?.jsonPrimitive?.doubleOrNull,
                step = obj["step"]?.jsonPrimitive?.doubleOrNull,
                default = obj["default"]?.jsonPrimitive?.doubleOrNull,
            )

            "color" -> SchemaField.Color(
                key = key,
                label = label,
                required = required,
                default = obj.getStringOrNull("default"),
            )

            "image", "file" -> SchemaField.Image(
                key = key,
                label = label,
                required = required,
                maxSizeBytes = obj["maxSizeBytes"]?.jsonPrimitive?.longOrNull,
            )

            "select", "enum", "dropdown" -> {
                val options = obj["options"]?.jsonArray
                    ?.map { it.jsonPrimitive.content }
                    ?: emptyList()
                SchemaField.Select(
                    key = key,
                    label = label,
                    required = required,
                    options = options,
                    default = obj.getStringOrNull("default"),
                )
            }

            "toggle", "boolean", "switch" -> SchemaField.Toggle(
                key = key,
                label = label,
                required = required,
                default = obj["default"]?.jsonPrimitive?.booleanOrNull ?: false,
            )

            else -> {
                Log.w(TAG, "Unknown field type '$type' for key '$key', skipping")
                null
            }
        }
    }

    companion object {
        private const val TAG = "SchemaParser"
    }
}

private fun JsonObject.getStringOrThrow(key: String): String {
    return this[key]?.jsonPrimitive?.content
        ?: throw IllegalArgumentException("Missing required field '$key'")
}

private fun JsonObject.getStringOrNull(key: String): String? {
    return this[key]?.jsonPrimitive?.content
}
