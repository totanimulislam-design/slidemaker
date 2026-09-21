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

/**
 * Points every `lib/pdf` import in a suite at tests/pdf-stub.ts, so the import
 * suite can drive the real page picker inside the real App without a pdf.js
 * renderer (jsdom has no canvas). The stub re-exports the real module and only
 * replaces the document opener.
 */
const pdfStubPlugin = {
  name: "pdf-stub",
  setup(build) {
    const stub = resolve(here, "pdf-stub.ts");
    build.onResolve({ filter: /(^|\/)(lib\/)?pdf$/ }, (args) => {
      // the stub itself needs the REAL module — it re-exports everything else
      if (args.importer === stub) return null;
      return { path: stub };
    });
  },
};

const suites = [
  ["drag interaction (Slide + ShapeLayer, deck shapes included)", "drag.test.tsx", "runDragTests"],
  ["gesture leak (legacy pattern vs drag session)", "leak.test.tsx", "runLeakTests"],
  ["pointer state machine (lib/dragSession)", "session.test.ts", "runSessionTests"],
  ["editor chrome resizers (SplitPane divider)", "chrome.test.tsx", "runChromeTests"],
  ["app boot smoke test (full editor)", "smoke.test.tsx", "runSmokeTests"],
  ["inspector navigation (21 destinations, selection sync + merged toolbar stacks)", "nav.test.tsx", "runNavTests"],
  ["per-part text style (font · size · colour · case · spacing · opacity · effects · position — each on its own text node)", "textstyle.test.tsx", "runTextStyleTests"],
  ["background shape (a plate behind every text part: presets · silhouettes · colour · border · transparency · effects · position)", "textbg.test.tsx", "runTextBgTests"],
  ["visibility & steppers (100 = fully visible · 0 = invisible · ± walks the range · sizes without a ceiling)", "visibility.test.tsx", "runVisibilityTests"],
  ["layers panel (drag to reorder the unified stack + selection sync)", "layers.test.tsx", "runLayersTests"],
  ["slide stack (drag to reorder + multi-select boxes + bulk ops + the open slide's border)", "slides.test.tsx", "runSlideStackTests"],
  ["imported pages (a PDF / PowerPoint merged in as plain slides, the file kept whole in Uploads)", "import.test.tsx", "runImportTests", [pdfStubPlugin]],
  ["colour picker (Canva system: indicators ride the cursor, one deck write per frame)", "wheel.test.tsx", "runWheelTests"],
  ["colour picker latency (what a drag is allowed to cost per pointer event)", "latency.test.tsx", "runLatencyTests"],
  ["solid native colour wells (one deck write per frame, the swatch painted in the event)", "colorframe.test.tsx", "runColorFrameTests"],
  ["every colour control (the picker stays open, and the colour reaches the slide)", "colors.test.tsx", "runColorTests"],
  ["question bullet (bullet point presets · shapes · effects, shape fill · border colour/style/radius/weight · transparency · position)", "questionbullet.test.tsx", "runQuestionBulletTests"],
];

installDom();
mkdirSync(outDir, { recursive: true });

/**
 * `node tests/run.mjs latency` runs only the suites whose file name matches, so
 * one suite can be iterated on without bundling the whole editor eight times.
 */
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const picked = suites.filter(([label, entry]) => !only.length || only.some((f) => entry.includes(f) || label.toLowerCase().includes(f.toLowerCase())));

let failed = 0;
let total = 0;
for (const [label, entry, exportName, plugins] of picked) {
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
    ...(plugins ? { plugins } : {}),
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
