package com.renderflow.domain.model

import kotlinx.serialization.Serializable

/**
 * Sealed hierarchy representing the different field types that a Remotion
 * template schema can declare. Each variant maps to a corresponding native
 * Compose widget in the dynamic form renderer.
 */
@Serializable
sealed class SchemaField {
    abstract val key: String
    abstract val label: String
    abstract val required: Boolean

    @Serializable
    data class Text(
        override val key: String,
        override val label: String,
        override val required: Boolean = false,
        val maxLength: Int? = null,
        val default: String? = null,
        val placeholder: String? = null,
        val multiline: Boolean = false,
    ) : SchemaField()

    @Serializable
    data class Number(
        override val key: String,
        override val label: String,
        override val required: Boolean = false,
        val min: Double? = null,
        val max: Double? = null,
        val step: Double? = null,
        val default: Double? = null,
    ) : SchemaField()

    @Serializable
    data class Color(
        override val key: String,
        override val label: String,
        override val required: Boolean = false,
        val default: String? = null,
    ) : SchemaField()

    @Serializable
    data class Image(
        override val key: String,
        override val label: String,
        override val required: Boolean = false,
        val maxSizeBytes: Long? = null,
    ) : SchemaField()

    @Serializable
    data class Select(
        override val key: String,
        override val label: String,
        override val required: Boolean = false,
        val options: List<String>,
        val default: String? = null,
    ) : SchemaField()

    @Serializable
    data class Toggle(
        override val key: String,
        override val label: String,
        override val required: Boolean = false,
        val default: Boolean = false,
    ) : SchemaField()
}
