// Static policy checks on the Android project. Runs without the Android SDK.
import { readFileSync, existsSync } from "node:fs";

const fail = [];
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const activity = readFileSync("android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt", "utf8");
const gradle = readFileSync("android/app/build.gradle.kts", "utf8");

for (const perm of ["android.permission.INTERNET", "android.permission.REQUEST_INSTALL_PACKAGES"]) {
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
if (!/allowFileAccess = false/.test(activity) || !/allowContentAccess = false/.test(activity)) fail.push("file/content access must be off");
if (!/isMinifyEnabled = true/.test(gradle)) fail.push("release must enable R8");
if (!/applicationId = "com.jrrahman.passtocsv"/.test(gradle)) fail.push("applicationId must stay com.jrrahman.passtocsv");
if (!existsSync("android/app/src/main/res/values-night/themes.xml")) fail.push("night theme missing");
if (existsSync("version.json")) fail.push("version.json updater manifest must be deleted");

if (fail.length) {
  console.error(`android policy check failed:\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
console.log("android policy: ok");
