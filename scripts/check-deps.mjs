/**
 * Pre-flight dependency check, run automatically before `vite dev` and
 * `vite build` (npm pre-hooks below).
 *
 * Vite's "Failed to resolve import ..." pre-transform error is opaque when
 * the real problem is a missing or half-installed node_modules (typical for
 * zipped project downloads). This script fails fast with clear instructions
 * instead, and verifies the exact pdfjs-dist files the app imports.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(new URL(import.meta.url).pathname));

const fail = (lines) => {
  console.error("\n[check-deps] " + lines.join("\n[check-deps] ") + "\n");
  process.exit(1);
};

let pdfDir;
try {
  pdfDir = dirname(require.resolve("pdfjs-dist/package.json"));
} catch {
  fail([
    "pdfjs-dist is not installed (node_modules is missing or incomplete).",
    "",
    "Fix:",
    "  1. npm install",
    "  2. if it still fails: delete node_modules and package-lock.json, then npm install again",
    "  3. restart the dev server",
  ]);
}

const pkg = JSON.parse(
  (await import("node:fs")).readFileSync(join(pdfDir, "package.json"), "utf8"),
);

// The exact files imported by src/lib/pdf.ts — must exist on disk.
const required = ["build/pdf.mjs", "build/pdf.worker.min.mjs"];
const missing = required.filter((f) => !existsSync(join(pdfDir, f)));
if (missing.length > 0) {
  fail([
    `pdfjs-dist@${pkg.version} is installed but incomplete:`,
    ...missing.map((f) => `  - missing ${f}`),
    "",
    "Fix: delete node_modules and package-lock.json, then run `npm install` again.",
  ]);
}

console.log(`[check-deps] pdfjs-dist@${pkg.version} ok`);

// Also sanity-check that the workspace itself is rooted correctly.
if (!existsSync(join(ROOT, "package.json"))) {
  fail(["Could not locate the project root package.json — are you running npm from the project folder?"]);
}
