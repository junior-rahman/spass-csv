package com.jrrahman.passtocsv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.os.Build
import android.provider.OpenableColumns
import android.os.Bundle
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCsv: String? = null
    private var pendingReply: JavaScriptReplyProxy? = null

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(ASSET_HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    // Google Play In-App Updates: Play shows the UI and installs; we never download APKs ourselves.
    private lateinit var appUpdateManager: AppUpdateManager
    private var updatePromptShown = false
    private val installListener = InstallStateUpdatedListener { state ->
        if (state.installStatus() == InstallStatus.DOWNLOADED) promptCompleteUpdate()
    }
    private val updateFlow = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { /* cancel/fail: retry next launch */ }

    private val pickFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data
        val ok = result.resultCode == Activity.RESULT_OK && uri != null && isSpassUri(uri)
        fileCallback?.onReceiveValue(if (ok) arrayOf(uri!!) else null)
        fileCallback = null
    }

    private val createCsv = registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        val csv = pendingCsv
        pendingCsv = null
        val ok = uri != null && csv != null && runCatching {
            contentResolver.openOutputStream(uri, "wt")!!.use { it.write(csv.toByteArray(Charsets.UTF_8)) }
        }.isSuccess
        pendingReply?.postMessage(JSONObject().put("type", "saved").put("ok", ok).toString())
        pendingReply = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        WebView.setWebContentsDebuggingEnabled(false)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION") allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION") allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
        }
        // Follow Android day/night; the page's prefers-color-scheme drives light vs dark tokens.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != ASSET_HOST
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                // SAF can only filter by MIME, never by extension. .spass is served as
                // application/octet-stream, so requesting ONLY that type hides images/PDFs/docs/media;
                // other unknown binaries may still show and are rejected by isSpassUri after picking.
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/octet-stream"
                    putExtra(Intent.EXTRA_MIME_TYPES, SPASS_MIME_TYPES)
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        putExtra(DocumentsContract.EXTRA_INITIAL_URI, DOWNLOADS_URI)
                    }
                }
                pickFile.launch(intent)
                return true
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "passBridge", setOf(ASSET_ORIGIN)) { _, message, sourceOrigin, isMainFrame, reply ->
                if (!isMainFrame || sourceOrigin.toString() != ASSET_ORIGIN) return@addWebMessageListener
                val json = runCatching { JSONObject(message.data ?: "") }.getOrNull() ?: return@addWebMessageListener
                if (json.optString("type") != "save") return@addWebMessageListener
                val name = json.optString("fileName").takeIf { SAFE_NAME.matches(it) } ?: "samsung-pass.csv"
                pendingCsv = json.optString("csv")
                pendingReply = reply
                createCsv.launch(name)
            }
        }

        webView.loadUrl("$ASSET_ORIGIN/assets/index.html")

        appUpdateManager = AppUpdateManagerFactory.create(this)
        appUpdateManager.registerListener(installListener)
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                when {
                    info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> startUpdate(info, AppUpdateType.FLEXIBLE)
                    info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> startUpdate(info, AppUpdateType.IMMEDIATE)
                }
            }
        }
    }

    private fun startUpdate(info: AppUpdateInfo, type: Int) {
        runCatching {
            appUpdateManager.startUpdateFlowForResult(info, updateFlow, AppUpdateOptions.newBuilder(type).build())
        }
    }

    private fun promptCompleteUpdate() {
        if (updatePromptShown || isFinishing) return
        updatePromptShown = true
        AlertDialog.Builder(this)
            .setTitle("Update ready")
            .setMessage("A new version of Spcc has been downloaded by Google Play. Restart to install it.")
            .setPositiveButton("Restart") { _, _ -> appUpdateManager.completeUpdate() }
            .setNegativeButton("Later") { _, _ -> updatePromptShown = false }
            .show()
    }

    private fun resumeUpdateIfNeeded() {
        if (!::appUpdateManager.isInitialized) return
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.installStatus() == InstallStatus.DOWNLOADED) promptCompleteUpdate()
            else if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS &&
                info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) startUpdate(info, AppUpdateType.IMMEDIATE)
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause() // fires visibilitychange → page wipes vault unless a picker is open
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        resumeUpdateIfNeeded()
    }

    override fun onDestroy() {
        pendingCsv = null
        if (::appUpdateManager.isInitialized) appUpdateManager.unregisterListener(installListener)
        webView.destroy()
        super.onDestroy()
    }

    private fun isSpassUri(uri: Uri): Boolean {
        val name = runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull()
        if (name?.endsWith(".spass", ignoreCase = true) == true) return true
        val segment = uri.lastPathSegment?.substringAfterLast('/') ?: return false
        return segment.endsWith(".spass", ignoreCase = true)
    }

    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val ASSET_ORIGIN = "https://appassets.androidplatform.net"
        private val SPASS_MIME_TYPES = arrayOf("application/octet-stream")
        private val DOWNLOADS_URI: Uri = DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Download")
        private val SAFE_NAME = Regex("^samsung-pass-[a-z0-9-]+\\.csv$")
    }
}
