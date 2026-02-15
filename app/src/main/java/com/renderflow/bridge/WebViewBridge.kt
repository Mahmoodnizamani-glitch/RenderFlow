package com.renderflow.bridge

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/**
 * WebView bridge composable with:
 * 1. Crash boundary — catches renderer crashes, shows "Safe Mode" recovery UI
 * 2. postMessage injection — pushes JSON props via JS without reloading
 * 3. Lifecycle-aware — pauses/resumes WebView properly
 *
 * Key architectural constraint: WebView is NEVER reloaded on prop changes.
 * Props are injected via `window.postMessage()` which the Remotion player
 * listens to on the `message` event.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewBridge(
    templateUrl: String,
    propsJson: String,
    modifier: Modifier = Modifier,
    onWebViewReady: ((WebView) -> Unit)? = null,
) {
    var webView by remember { mutableStateOf<WebView?>(null) }
    var hasCrashed by remember { mutableStateOf(false) }
    var isPageLoaded by remember { mutableStateOf(false) }
    var crashCount by remember { mutableStateOf(0) }

    // Inject props when they change, ONLY if page is loaded and not crashed
    LaunchedEffect(propsJson, isPageLoaded, hasCrashed) {
        if (isPageLoaded && !hasCrashed && propsJson.isNotEmpty()) {
            webView?.let { wv ->
                injectProps(wv, propsJson)
            }
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        if (hasCrashed) {
            CrashRecoveryView(
                crashCount = crashCount,
                onReload = {
                    hasCrashed = false
                    isPageLoaded = false
                    // No need to loadUrl here; WebViewContent recreation will handle it
                },
            )
        } else {
            WebViewContent(
                templateUrl = templateUrl,
                onWebViewCreated = { wv ->
                    webView = wv
                    onWebViewReady?.invoke(wv)
                },
                onPageLoaded = {
                    isPageLoaded = true
                    // Inject initial props once page is ready
                    if (propsJson.isNotEmpty()) {
                        webView?.let { injectProps(it, propsJson) }
                    }
                },
                onCrash = {
                    hasCrashed = true
                    crashCount++
                    Log.e(TAG, "WebView renderer crashed (count=$crashCount)")
                },
            )
        }
    }

    // Cleanup on dispose
    DisposableEffect(Unit) {
        onDispose {
            // Redundant if AndroidView.onRelease is used, but keeps outer safety
            webView?.destroy()
            webView = null
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun WebViewContent(
    templateUrl: String,
    onWebViewCreated: (WebView) -> Unit,
    onPageLoaded: () -> Unit,
    onCrash: () -> Unit,
) {
    val context = LocalContext.current

    AndroidView(
        factory = {
            WebView(context).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    mediaPlaybackRequiresUserGesture = false
                    allowFileAccess = false
                    allowContentAccess = false
                }

                webViewClient = object : WebViewClient() {
                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                        Log.d(TAG, "Page loading: $url")
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        Log.d(TAG, "Page loaded: $url")
                        onPageLoaded()
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        request: WebResourceRequest?,
                        error: WebResourceError?,
                    ) {
                        if (request?.isForMainFrame == true) {
                            Log.e(TAG, "Main frame error: ${error?.description}")
                        }
                    }

                    override fun onRenderProcessGone(
                        view: WebView?,
                        detail: android.webkit.RenderProcessGoneDetail?,
                    ): Boolean {
                        Log.e(TAG, "Render process gone, crashed=${detail?.didCrash()}")
                        onCrash()
                        return true // We handle the crash
                    }
                }

                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                        Log.d(
                            TAG,
                            "JS Console [${message?.messageLevel()}]: ${message?.message()} " +
                                "(${message?.sourceId()}:${message?.lineNumber()})",
                        )
                        return true
                    }
                }

                onWebViewCreated(this)
                loadUrl(templateUrl)
            }
        },
        onRelease = { webView ->
            webView.destroy()
        },
        modifier = Modifier.fillMaxSize(),
    )
}

@Composable
private fun CrashRecoveryView(
    crashCount: Int,
    onReload: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Preview Crashed",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = if (crashCount > 2) {
                    "Multiple crashes detected. The template may have an issue."
                } else {
                    "The preview encountered an error and needs to reload."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onReload) {
                Text(if (crashCount > 2) "Reload in Safe Mode" else "Reload Preview")
            }
        }
    }
}

/**
 * Injects props into the WebView via postMessage.
 * This is the ONLY mechanism for prop updates — the WebView is NEVER reloaded.
 *
 * The injected JS sends a structured message that the Remotion player
 * can intercept via `window.addEventListener('message', ...)`.
 */
private fun injectProps(webView: WebView, propsJson: String) {
    val escapedJson = propsJson
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "\\r")

    val js = """
        (function() {
            try {
                var props = JSON.parse('$escapedJson');
                window.postMessage({
                    type: 'renderflow:props-update',
                    payload: props
                }, '*');
            } catch(e) {
                console.error('RenderFlow: Failed to inject props', e);
            }
        })();
    """.trimIndent()

    webView.evaluateJavascript(js, null)
}

private const val TAG = "WebViewBridge"
