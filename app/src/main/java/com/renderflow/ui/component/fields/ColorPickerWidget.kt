package com.renderflow.ui.component.fields

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.renderflow.domain.model.SchemaField

private val PRESET_COLORS = listOf(
    "#FF0000", "#FF5722", "#FF9800", "#FFC107",
    "#FFEB3B", "#8BC34A", "#4CAF50", "#009688",
    "#00BCD4", "#03A9F4", "#2196F3", "#3F51B5",
    "#673AB7", "#9C27B0", "#E91E63", "#795548",
    "#607D8B", "#000000", "#FFFFFF", "#9E9E9E",
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ColorPickerWidget(
    field: SchemaField.Color,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var hexInput by remember(value) { mutableStateOf(value) }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = field.label,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(parseColor(value))
                    .border(
                        1.dp,
                        MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
                        RoundedCornerShape(8.dp),
                    ),
            )

            Spacer(modifier = Modifier.width(12.dp))

            OutlinedTextField(
                value = hexInput,
                onValueChange = { newHex ->
                    hexInput = newHex
                    if (isValidHexColor(newHex)) {
                        onValueChange(newHex)
                    }
                },
                label = { Text("Hex Color") },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                ),
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PRESET_COLORS.forEach { colorHex ->
                val isSelected = colorHex.equals(value, ignoreCase = true)
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(parseColor(colorHex))
                        .then(
                            if (isSelected) {
                                Modifier.border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                            } else {
                                Modifier.border(1.dp, MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f), CircleShape)
                            },
                        )
                        .clickable {
                            hexInput = colorHex
                            onValueChange(colorHex)
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Selected",
                            tint = if (isLightColor(colorHex)) Color.Black else Color.White,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
        }
    }
}

private fun parseColor(hex: String): Color {
    return try {
        val sanitized = hex.removePrefix("#")
        when (sanitized.length) {
            6 -> Color(android.graphics.Color.parseColor("#$sanitized"))
            8 -> Color(android.graphics.Color.parseColor("#$sanitized"))
            else -> Color.Gray
        }
    } catch (_: Exception) {
        Color.Gray
    }
}

private fun isValidHexColor(hex: String): Boolean {
    val sanitized = hex.removePrefix("#")
    return sanitized.length in listOf(6, 8) && sanitized.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }
}

private fun isLightColor(hex: String): Boolean {
    return try {
        val color = android.graphics.Color.parseColor(hex)
        val r = android.graphics.Color.red(color)
        val g = android.graphics.Color.green(color)
        val b = android.graphics.Color.blue(color)
        val luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        luminance > 0.5
    } catch (_: Exception) {
        false
    }
}
