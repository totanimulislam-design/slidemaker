/**
 * Test runner: bundles the interaction suites with esbuild, boots a jsdom
 * environment with a tiny percentage layout, and executes them.
 *
 *   npm run test:drag
 */
import { build } from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom } from "./dom-env.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, ".build");
const suites = [
  ["drag interaction (Slide + ShapeLayer, deck shapes included)", "drag.test.tsx", "runDragTests"],
  ["gesture leak (legacy pattern vs drag session)", "leak.test.tsx", "runLeakTests"],
  ["pointer state machine (lib/dragSession)", "session.test.ts", "runSessionTests"],
  ["editor chrome resizers (SplitPane divider)", "chrome.test.tsx", "runChromeTests"],
  ["app boot smoke test (full editor)", "smoke.test.tsx", "runSmokeTests"],
  ["inspector navigation (19 destinations, selection sync + merged toolbar stacks)", "nav.test.tsx", "runNavTests"],
  ["layers panel (drag to reorder the unified stack + selection sync)", "layers.test.tsx", "runLayersTests"],
  ["slide stack (drag to reorder + multi-select boxes + bulk ops + the open slide's border)", "slides.test.tsx", "runSlideStackTests"],
];

installDom();
mkdirSync(outDir, { recursive: true });

let failed = 0;
let total = 0;
for (const [label, entry, exportName] of suites) {
  const outfile = resolve(outDir, entry.replace(/\.tsx?$/, ".mjs"));
  await build({
    entryPoints: [resolve(here, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    target: ["node20"],
    external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
    loader: { ".ts": "ts", ".tsx": "tsx" },
    logLevel: "warning",
  });
  const mod = await import(pathToFileURL(outfile).href + "?t=" + Date.now());
  const results = await mod[exportName]();
  console.log(`\n— ${label}`);
  for (const r of results) {
    total++;
    if (!r.pass) failed++;
    console.log(`${r.pass ? "  ok  " : " FAIL "} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
}
console.log(`\n${total - failed} passed, ${failed} failed (of ${total})`);
rmSync(outDir, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
