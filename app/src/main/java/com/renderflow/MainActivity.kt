package com.renderflow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.renderflow.ui.navigation.RenderFlowNavHost
import com.renderflow.ui.theme.RenderFlowTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            RenderFlowTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    RenderFlowNavHost()
                }
            }
        }
    }
}
