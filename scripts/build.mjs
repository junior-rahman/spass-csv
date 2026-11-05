// One source → all artifacts. `node scripts/build.mjs` writes; `--check` fails on drift.
import { build, transform } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const check = process.argv.includes("--check");
const BASE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

const bundle = await build({
  entryPoints: ["web/src/main.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  legalComments: "none",
  write: false
});
const js = `"use strict";\n${bundle.outputFiles[0].text}`;
const styles = (await transform(readFileSync("web/src/ui/styles.css", "utf8"), { loader: "css", minify: true })).code;
const template = readFileSync("web/index.template.html", "utf8");

const page = (csp, script) =>
  template.replace("%CSP%", csp).replace("%STYLES%", styles.trimEnd()).replace("%SCRIPT%", script);

const linked = page(`${BASE_CSP}; script-src 'self'`, '<script src="app.js"></script>');
const hash = createHash("sha256").update(js).digest("base64");
const inlined = page(`${BASE_CSP}; script-src 'sha256-${hash}'`, `<script>${js}</script>`);

const outputs = {
  "index.html": linked,
  "app.js": js,
  "samsung-pass-to-csv.html": inlined,
  "android/app/src/main/assets/index.html": linked,
  "android/app/src/main/assets/app.js": js
};

let drift = [];
for (const [path, contents] of Object.entries(outputs)) {
  if (check) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== contents) drift.push(path);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
}
if (check && drift.length) {
  console.error(`Generated files are out of date. Run npm run build.\n  ${drift.join("\n  ")}`);
  process.exit(1);
}
console.log(check ? "build: no drift" : `build: wrote ${Object.keys(outputs).length} files`);
