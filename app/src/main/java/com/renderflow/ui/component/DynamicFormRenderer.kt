package com.renderflow.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.renderflow.domain.model.SchemaField
import com.renderflow.ui.component.fields.ColorPickerWidget
import com.renderflow.ui.component.fields.ImagePickerWidget
import com.renderflow.ui.component.fields.NumberFieldWidget
import com.renderflow.ui.component.fields.SelectFieldWidget
import com.renderflow.ui.component.fields.TextFieldWidget
import com.renderflow.ui.component.fields.ToggleFieldWidget

/**
 * Renders a dynamic form from a list of [SchemaField] descriptors.
 * Each field type is dispatched to its corresponding native widget composable.
 *
 * @param fields The schema fields to render.
 * @param values Current prop values keyed by field key.
 * @param onValueChange Callback when a field value changes.
 * @param modifier Modifier for the LazyColumn container.
 */
@Composable
fun DynamicFormRenderer(
    fields: List<SchemaField>,
    values: Map<String, Any?>,
    onValueChange: (key: String, value: Any?) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        itemsIndexed(
            items = fields,
            key = { _, field -> field.key },
        ) { index, field ->
            AnimatedVisibility(
                visible = true,
                enter = fadeIn() + slideInVertically(
                    initialOffsetY = { it / 2 },
                ),
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    when (field) {
                        is SchemaField.Text -> TextFieldWidget(
                            field = field,
                            value = values[field.key] as? String ?: field.default.orEmpty(),
                            onValueChange = { onValueChange(field.key, it) },
                        )

                        is SchemaField.Number -> NumberFieldWidget(
                            field = field,
                            value = values[field.key] as? Double ?: field.default ?: 0.0,
                            onValueChange = { onValueChange(field.key, it) },
                        )

                        is SchemaField.Color -> ColorPickerWidget(
                            field = field,
                            value = values[field.key] as? String ?: field.default ?: "#000000",
                            onValueChange = { onValueChange(field.key, it) },
                        )

                        is SchemaField.Image -> ImagePickerWidget(
                            field = field,
                            value = values[field.key] as? String,
                            onValueChange = { onValueChange(field.key, it) },
                        )

                        is SchemaField.Select -> SelectFieldWidget(
                            field = field,
                            value = values[field.key] as? String ?: field.default ?: field.options.firstOrNull().orEmpty(),
                            onValueChange = { onValueChange(field.key, it) },
                        )

                        is SchemaField.Toggle -> ToggleFieldWidget(
                            field = field,
                            value = values[field.key] as? Boolean ?: field.default,
                            onValueChange = { onValueChange(field.key, it) },
                        )
                    }

                    if (field.required) {
                        Text(
                            text = "Required",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(start = 4.dp, top = 4.dp),
                        )
                    }
                }
            }
        }
    }
}
