// Static policy checks on the Android project. Runs without the Android SDK.
import { readFileSync, existsSync } from "node:fs";

const fail = [];
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const activity = readFileSync("android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt", "utf8");
const gradle = readFileSync("android/app/build.gradle.kts", "utf8");

// INTERNET is allowed solely for Google Play In-App Updates.
for (const perm of ["android.permission.REQUEST_INSTALL_PACKAGES"]) {
  if (manifest.includes(perm)) fail.push(`manifest must not request ${perm}`);
}
if (!/android:allowBackup="false"/.test(manifest)) fail.push("allowBackup must be false");
if (!/android:dataExtractionRules=/.test(manifest)) fail.push("dataExtractionRules missing");
if (/usesCleartextTraffic="true"|networkSecurityConfig/.test(manifest)) fail.push("no cleartext / network security config allowed");
if (!activity.includes("FLAG_SECURE")) fail.push("FLAG_SECURE missing");
if (!activity.includes("WebViewAssetLoader")) fail.push("WebViewAssetLoader missing");
if (!activity.includes('"https://appassets.androidplatform.net"')) fail.push("bridge origin gate missing");
for (const banned of ["ServerSocket", "PackageInstaller", "version.json", "downloadAndInstall", "addJavascriptInterface", "unlockSpass", "http://127.0.0.1"]) {
  if (activity.includes(banned)) fail.push(`MainActivity must not contain ${banned}`);
}
if (!activity.includes("AppUpdateManager") || !activity.includes("com.google.android.play.core.appupdate")) fail.push("Play In-App Updates (AppUpdateManager) missing from MainActivity");
if (!gradle.includes("com.google.android.play:app-update")) fail.push("play app-update dependency missing");
if (!activity.includes("shouldInterceptRequest") || !activity.includes("request.url.host != ASSET_HOST")) fail.push("WebView must stay offline (asset loader + host gate)");
if (!/allowFileAccess = false/.test(activity) || !/allowContentAccess = false/.test(activity)) fail.push("file/content access must be off");
if (!/isMinifyEnabled = true/.test(gradle)) fail.push("release must enable R8");
if (!/applicationId = "com.jrrahman.passtocsv"/.test(gradle)) fail.push("applicationId must stay com.jrrahman.passtocsv");
if (!existsSync("android/app/src/main/res/values-night/themes.xml")) fail.push("night theme missing");
if (!activity.includes("setOnApplyWindowInsetsListener") || !activity.includes("enableEdgeToEdge")) fail.push("targetSdk 35+ is edge-to-edge: MainActivity must pad the WebView by system-bar/IME insets");
if (!activity.includes("OnBackPressedCallback") || !activity.includes("spccBack")) fail.push("Back must close open sheets via window.spccBack before exiting");
if (/isSpassUri\(/.test(activity)) fail.push("non-.spass picks must reach the page so it can show an error (no silent drop in Kotlin)");
if (!/"leave"/.test(activity)) fail.push("Back confirm: MainActivity must handle the page's {type:\"leave\"} message");
if (!/androidx\.fragment:fragment/.test(gradle)) fail.push("declare androidx.fragment explicitly (Play flags the transitive fragment 1.0.0)");
if (!/deleteDocument/.test(activity)) fail.push("failed SAF writes must delete the empty document");
const manifestCfg = manifest.match(/android:configChanges="([^"]+)"/)?.[1] ?? "";
for (const c of ["screenSize", "smallestScreenSize", "screenLayout", "orientation"]) if (!manifestCfg.split("|").includes(c)) fail.push(`configChanges must include ${c} (foldables / multi-window must not recreate the WebView and drop the vault)`);
if (!/android\.webkit\.WebView\.MetricsOptOut"\s+android:value="true"/.test(manifest)) fail.push("WebView metrics must be opted out (no telemetry)");
if (!/android\.webkit\.WebView\.EnableSafeBrowsing"\s+android:value="false"/.test(manifest)) fail.push("Safe Browsing lookups must be off (asset-only WebView)");
{
  // Every file name the page can save must pass MainActivity's SAFE_NAME gate (else Android renames it).
  const safe = activity.match(/SAFE_NAME = Regex\("(.+)"\)/)?.[1]?.replace(/\\\\/g, "\\");
  const formats = readFileSync("web/src/lib/formats.ts", "utf8");
  const app = readFileSync("web/src/ui/app.ts", "utf8");
  const names = [...formats.matchAll(/fileName: "([^"]+)"/g), ...app.matchAll(/fileName = "([^"]+)"/g)].map((m) => m[1]);
  if (!safe || names.length < 8) fail.push("could not read SAFE_NAME or the page's CSV file names");
  else for (const n of names) if (!new RegExp(safe).test(n)) fail.push(`SAFE_NAME rejects ${n}; Android would save it under another name`);
}
if (!/android:windowSoftInputMode="adjustResize"/.test(manifest)) fail.push("adjustResize required: Android 10 (API 29) only reports keyboard (IME) insets to edge-to-edge apps in adjustResize");
if (!/IME_FLAG_NO_PERSONALIZED_LEARNING/.test(activity) || !/webView = NoLearningWebView\(this\)/.test(activity)) fail.push("WebView must ask the keyboard not to learn (IME_FLAG_NO_PERSONALIZED_LEARNING)");
if (!/IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS/.test(activity) || !/webView\.importantForAutofill/.test(activity) || !/container\.importantForAutofill/.test(activity) || !/decorView\.importantForAutofill/.test(activity)) fail.push("WebView, root view, and window decor must set IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS");
if (!/override fun onRenderProcessGone/.test(activity)) fail.push("WebViewClient must handle onRenderProcessGone (renderer crash / OOM kill must not crash the app)");
if (existsSync("version.json")) fail.push("version.json updater manifest must be deleted");

if (fail.length) {
  console.error(`android policy check failed:\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
console.log("android policy: ok");
