package com.jrrahman.passtocsv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.FrameLayout
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import android.app.AlertDialog
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
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

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCsv: String? = null
    private var pendingReply: JavaScriptReplyProxy? = null
    /** The WebView renderer died (crash or killed for memory); the activity is being recreated. */
    private var webViewGone = false

    private val backCallback = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            if (webViewGone) { systemBack(); return }
            webView.evaluateJavascript("(window.spccBack && window.spccBack()) ? 1 : 0") { handled ->
                if (handled != "1") systemBack()
            }
        }
    }

    /** Let Android handle Back (finish / move to background) without re-entering the page. */
    private fun systemBack() {
        backCallback.isEnabled = false
        onBackPressedDispatcher.onBackPressed()
        backCallback.isEnabled = true
    }

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
        // Hand every pick to the page: it checks the name and contents and shows a clear error
        // for anything that isn't a Samsung Pass export (never a silent drop).
        val ok = result.resultCode == Activity.RESULT_OK && uri != null
        fileCallback?.onReceiveValue(if (ok) arrayOf(uri!!) else null)
        fileCallback = null
    }

    private val createCsv = registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        val csv = pendingCsv
        pendingCsv = null
        val ok = uri != null && csv != null && writeCsv(uri, csv)
        // The picker already created the document; never leave an empty/partial CSV behind on failure.
        if (!ok && uri != null) runCatching { DocumentsContract.deleteDocument(contentResolver, uri) }
        pendingReply?.let { replySaved(it, ok) }
        pendingReply = null
    }

    /** A JavaScriptReplyProxy only exists when WEB_MESSAGE_LISTENER is supported; the check keeps lint honest. */
    private fun replySaved(reply: JavaScriptReplyProxy, ok: Boolean) {
        if (webViewGone || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        reply.postMessage(JSONObject().put("type", "saved").put("ok", ok).toString())
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION") // allowFile/UniversalAccessFromFileURLs: still set false explicitly for old WebViews
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Edge-to-edge without deprecated window APIs (Play advisory, 2.0.26). androidx.activity's enableEdgeToEdge()
        // ships EdgeToEdgeApi26–35, which call Window.setStatusBarColor / setNavigationBarColor and set
        // layoutInDisplayCutoutMode; androidx.core's insets controller adds View.setSystemUiVisibility. Instead:
        // API 35+ is edge-to-edge by the platform (targetSdk 36); API 30–34 opts in with Window.setDecorFitsSystemWindows;
        // API 29 keeps the system-fitted layout (only deprecated SYSTEM_UI_FLAG_* can opt in there) with charcoal bars
        // from the theme's colorPrimaryDark. The WebView is padded by bar / cutout / keyboard insets when edge-to-edge.
        val edgeToEdge = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
        if (edgeToEdge) window.setDecorFitsSystemWindows(false)
        // Transparent bars stay transparent: no translucent scrim behind 3-button navigation on the charcoal canvas.
        window.isStatusBarContrastEnforced = false
        window.isNavigationBarContrastEnforced = false
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        WebView.setWebContentsDebuggingEnabled(false)
        webView = NoLearningWebView(this)
        val container = FrameLayout(this).apply {
            setBackgroundColor(CANVAS)
            addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        }
        webView.setBackgroundColor(CANVAS)
        setContentView(container)
        // Autofill (Google / Samsung Pass) must not offer to save or fill while the user edits
        // logins. Trade-off accepted: the export password also cannot be autofilled.
        val noAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        webView.importantForAutofill = noAutofill
        container.importantForAutofill = noAutofill
        window.decorView.importantForAutofill = noAutofill
        if (edgeToEdge) ViewCompat.setOnApplyWindowInsetsListener(container) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        // Back closes the open sheet (or leaves the password step); from the vault the page asks
        // "Leave and clear?" and posts {type:"leave"} when confirmed.
        onBackPressedDispatcher.addCallback(this, backCallback)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
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

            // Without this, a renderer crash or an out-of-memory kill (common while the app sits behind the
            // system file pickers) crashes the whole app. The unlocked vault died with the renderer, so start clean.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                if (webViewGone) return true
                webViewGone = true
                pendingCsv = null
                pendingReply = null
                fileCallback = null
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                if (!isFinishing && !isDestroyed) recreate()
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                // Restored 2.0.2 (abbfbc9) .spass MIME filter: octet-stream + application/x-spass +
                // application/spass. The page validates whatever is picked and explains rejections.
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/octet-stream"
                    putExtra(Intent.EXTRA_MIME_TYPES, SPASS_MIME_TYPES)
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
                    putExtra(DocumentsContract.EXTRA_INITIAL_URI, DOWNLOADS_URI)
                }
                if (runCatching { pickFile.launch(intent) }.isFailure) {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = null
                }
                return true
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "passBridge", setOf(ASSET_ORIGIN)) { _, message, sourceOrigin, isMainFrame, reply ->
                if (!isMainFrame || sourceOrigin.toString() != ASSET_ORIGIN) return@addWebMessageListener
                val json = runCatching { JSONObject(message.data ?: "") }.getOrNull() ?: return@addWebMessageListener
                if (json.optString("type") == "leave") {
                    systemBack()
                    return@addWebMessageListener
                }
                if (json.optString("type") != "save") return@addWebMessageListener
                val name = json.optString("fileName").takeIf { SAFE_NAME.matches(it) } ?: "samsung-pass.csv"
                // A second save while one is open: fail the older one so its promise settles now.
                pendingReply?.let { replySaved(it, false) }
                pendingCsv = json.optString("csv")
                pendingReply = reply
                if (runCatching { createCsv.launch(name) }.isFailure) {
                    pendingCsv = null
                    pendingReply = null
                    replySaved(reply, false)
                }
            }
        }

        webView.loadUrl("$ASSET_ORIGIN/assets/index.html")

        appUpdateManager = AppUpdateManagerFactory.create(this)
        appUpdateManager.registerListener(installListener)
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                when {
                    info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> startUpdate(info, AppUpdateType.FLEXIBLE)
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
        if (!webViewGone) webView.onPause() // fires visibilitychange → page wipes vault unless a picker is open
    }

    override fun onResume() {
        super.onResume()
        if (!webViewGone) webView.onResume()
        resumeUpdateIfNeeded()
    }

    override fun onDestroy() {
        pendingCsv = null
        if (::appUpdateManager.isInitialized) appUpdateManager.unregisterListener(installListener)
        if (!webViewGone) webView.destroy()
        super.onDestroy()
    }

    /** Some providers (e.g. cloud drives) reject "wt"; fall back to "w". */
    private fun writeCsv(uri: Uri, csv: String): Boolean {
        val bytes = csv.toByteArray(Charsets.UTF_8)
        for (mode in arrayOf("wt", "w")) {
            val ok = runCatching {
                contentResolver.openOutputStream(uri, mode)!!.use { it.write(bytes); it.flush() }
            }.isSuccess
            if (ok) return true
        }
        return false
    }

    companion object {
        private const val CANVAS = 0xFF181716.toInt()
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val ASSET_ORIGIN = "https://appassets.androidplatform.net"
        private val SPASS_MIME_TYPES = arrayOf("application/octet-stream", "application/x-spass", "application/spass")
        private val DOWNLOADS_URI: Uri = DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Download")
        // Every name the page offers: samsung-pass-<format|cards|notes|addresses>.csv, and passwords.csv (Other).
        private val SAFE_NAME = Regex("^(samsung-pass-[a-z0-9-]+|passwords)\\.csv$")
    }
}

/**
 * Every field in this app can hold a decrypted secret (export password, usernames, revealed passwords, notes).
 * Ask the keyboard not to learn from them: no personalised dictionary entries, no synced suggestions.
 */
@SuppressLint("ViewConstructor") // created in code only, never inflated from XML
class NoLearningWebView(context: Context) : WebView(context) {
    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
        val connection = super.onCreateInputConnection(outAttrs)
        outAttrs.imeOptions = outAttrs.imeOptions or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
        return connection
    }
}
