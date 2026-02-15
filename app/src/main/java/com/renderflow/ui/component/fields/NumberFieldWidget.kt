package com.renderflow.ui.component.fields

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import com.renderflow.domain.model.SchemaField

@Composable
fun NumberFieldWidget(
    field: SchemaField.Number,
    value: Double,
    onValueChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    var textValue by remember(value) {
        mutableStateOf(
            if (value == value.toLong().toDouble()) {
                value.toLong().toString()
            } else {
                value.toString()
            },
        )
    }
    var isError by remember { mutableStateOf(false) }

    OutlinedTextField(
        value = textValue,
        onValueChange = { newText ->
            textValue = newText
            val parsed = newText.toDoubleOrNull()
            if (parsed != null) {
                val clamped = clampToRange(parsed, field.min, field.max)
                isError = clamped != parsed
                onValueChange(clamped)
            } else {
                isError = newText.isNotEmpty()
            }
        },
        label = { Text(field.label) },
        isError = isError,
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Decimal,
            imeAction = ImeAction.Next,
        ),
        supportingText = {
            val rangeText = buildRangeText(field.min, field.max, field.step)
            if (rangeText.isNotEmpty()) {
                Text(
                    text = rangeText,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
            errorBorderColor = MaterialTheme.colorScheme.error,
        ),
        modifier = modifier.fillMaxWidth(),
    )
}

private fun clampToRange(value: Double, min: Double?, max: Double?): Double {
    var result = value
    if (min != null && result < min) result = min
    if (max != null && result > max) result = max
    return result
}

private fun buildRangeText(min: Double?, max: Double?, step: Double?): String {
    val parts = mutableListOf<String>()
    if (min != null) parts.add("Min: ${formatNumber(min)}")
    if (max != null) parts.add("Max: ${formatNumber(max)}")
    if (step != null) parts.add("Step: ${formatNumber(step)}")
    return parts.joinToString(" · ")
}

private fun formatNumber(value: Double): String {
    return if (value == value.toLong().toDouble()) {
        value.toLong().toString()
    } else {
        value.toString()
    }
}
