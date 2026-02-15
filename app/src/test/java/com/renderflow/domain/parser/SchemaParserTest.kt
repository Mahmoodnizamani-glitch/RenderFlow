package com.renderflow.domain.parser

import com.renderflow.domain.model.SchemaField
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SchemaParserTest {

    private lateinit var parser: SchemaParser

    @Before
    fun setup() {
        parser = SchemaParser()
    }

    @Test
    fun `parse valid schema with all field types`() {
        val json = """
        {
            "compositionId": "test-comp",
            "version": 2,
            "props": [
                { "key": "title", "label": "Title", "type": "text", "required": true, "default": "Hello", "maxLength": 50 },
                { "key": "count", "label": "Count", "type": "number", "min": 0, "max": 100, "default": 42 },
                { "key": "color", "label": "Color", "type": "color", "default": "#FF0000" },
                { "key": "logo", "label": "Logo", "type": "image" },
                { "key": "style", "label": "Style", "type": "select", "options": ["a", "b", "c"], "default": "a" },
                { "key": "visible", "label": "Visible", "type": "toggle", "default": true }
            ]
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isSuccess)

        val schema = result.getOrThrow()
        assertEquals("test-comp", schema.compositionId)
        assertEquals(2, schema.version)
        assertEquals(6, schema.fields.size)

        val text = schema.fields[0] as SchemaField.Text
        assertEquals("title", text.key)
        assertEquals("Title", text.label)
        assertTrue(text.required)
        assertEquals("Hello", text.default)
        assertEquals(50, text.maxLength)

        val number = schema.fields[1] as SchemaField.Number
        assertEquals(0.0, number.min!!, 0.001)
        assertEquals(100.0, number.max!!, 0.001)
        assertEquals(42.0, number.default!!, 0.001)

        val color = schema.fields[2] as SchemaField.Color
        assertEquals("#FF0000", color.default)

        assertTrue(schema.fields[3] is SchemaField.Image)

        val select = schema.fields[4] as SchemaField.Select
        assertEquals(3, select.options.size)
        assertEquals("a", select.default)

        val toggle = schema.fields[5] as SchemaField.Toggle
        assertTrue(toggle.default)
    }

    @Test
    fun `parse skips unknown field types gracefully`() {
        val json = """
        {
            "compositionId": "test",
            "version": 1,
            "props": [
                { "key": "title", "label": "Title", "type": "text" },
                { "key": "unknown", "label": "Unknown", "type": "custom_widget" },
                { "key": "color", "label": "Color", "type": "color" }
            ]
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isSuccess)

        val schema = result.getOrThrow()
        assertEquals(2, schema.fields.size)
        assertEquals("title", schema.fields[0].key)
        assertEquals("color", schema.fields[1].key)
    }

    @Test
    fun `parse handles empty props array`() {
        val json = """
        {
            "compositionId": "empty",
            "version": 1,
            "props": []
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrThrow().fields.size)
    }

    @Test
    fun `parse fails on missing compositionId`() {
        val json = """
        {
            "version": 1,
            "props": []
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isFailure)
    }

    @Test
    fun `parse fails on missing props array`() {
        val json = """
        {
            "compositionId": "test"
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isFailure)
    }

    @Test
    fun `parse fails on malformed JSON`() {
        val result = parser.parse("not valid json {{{")
        assertTrue(result.isFailure)
    }

    @Test
    fun `parse handles type aliases`() {
        val json = """
        {
            "compositionId": "aliases",
            "version": 1,
            "props": [
                { "key": "name", "label": "Name", "type": "string" },
                { "key": "age", "label": "Age", "type": "integer" },
                { "key": "score", "label": "Score", "type": "float" },
                { "key": "file", "label": "File", "type": "file" },
                { "key": "choice", "label": "Choice", "type": "enum", "options": ["x", "y"] },
                { "key": "flag", "label": "Flag", "type": "boolean" },
                { "key": "sw", "label": "Switch", "type": "switch" }
            ]
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isSuccess)

        val fields = result.getOrThrow().fields
        assertEquals(7, fields.size)
        assertTrue(fields[0] is SchemaField.Text)
        assertTrue(fields[1] is SchemaField.Number)
        assertTrue(fields[2] is SchemaField.Number)
        assertTrue(fields[3] is SchemaField.Image)
        assertTrue(fields[4] is SchemaField.Select)
        assertTrue(fields[5] is SchemaField.Toggle)
        assertTrue(fields[6] is SchemaField.Toggle)
    }

    @Test
    fun `parse defaults version to 1 when missing`() {
        val json = """
        {
            "compositionId": "no-version",
            "props": []
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().version)
    }

    @Test
    fun `parse uses key as label when label is missing`() {
        val json = """
        {
            "compositionId": "no-label",
            "version": 1,
            "props": [
                { "key": "myField", "type": "text" }
            ]
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isSuccess)
        assertEquals("myField", result.getOrThrow().fields[0].label)
    }

    @Test
    fun `parse skips malformed individual fields without failing`() {
        val json = """
        {
            "compositionId": "partial",
            "version": 1,
            "props": [
                { "key": "good", "label": "Good", "type": "text" },
                { "label": "NoKey", "type": "text" },
                { "key": "alsoGood", "label": "Also Good", "type": "color" }
            ]
        }
        """.trimIndent()

        val result = parser.parse(json)
        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrThrow().fields.size)
    }
}
