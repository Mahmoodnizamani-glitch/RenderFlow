package com.renderflow.domain.model

/**
 * Parsed template schema representing a Remotion composition's
 * configurable properties as native field descriptors.
 */
data class TemplateSchema(
    val compositionId: String,
    val version: Int,
    val fields: List<SchemaField>,
)
