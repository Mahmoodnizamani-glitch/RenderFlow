package com.renderflow.ui.component.fields

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import com.renderflow.domain.model.SchemaField

@Composable
fun TextFieldWidget(
    field: SchemaField.Text,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { newValue ->
            val constrained = if (field.maxLength != null) {
                newValue.take(field.maxLength)
            } else {
                newValue
            }
            onValueChange(constrained)
        },
        label = { Text(field.label) },
        placeholder = field.placeholder?.let { { Text(it) } },
        singleLine = !field.multiline,
        minLines = if (field.multiline) 3 else 1,
        maxLines = if (field.multiline) 8 else 1,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
        supportingText = field.maxLength?.let { max ->
            {
                Text(
                    text = "${value.length}/$max",
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
        ),
        modifier = modifier.fillMaxWidth(),
    )
}
