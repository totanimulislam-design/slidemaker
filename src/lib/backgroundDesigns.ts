import type { CSSProperties } from "react";
import type { Gradient } from "./types";

/* ==========================================================================
 * Decorative background designs — pure inline SVG (data URLs), so the editor
 * preview, thumbnails, presenter and PNG/PDF exports all render identically.
 *
 * Two kinds of artwork:
 *   tile — a small seamless pattern, repeated across the board. Resizing
 *          changes the tile size (pattern density).
 *   art  — a full-bleed 1280×720 scene, stretched to the board. Resizing
 *          scales it around the centre, so the position is preserved and the
 *          look stays correct at any slide size or aspect ratio.
 * ========================================================================== */

const enc = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const tileUrl = (w: number, h: number, inner: string) =>
  enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`);

const artUrl = (inner: string) =>
  enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" preserveAspectRatio="none">${inner}</svg>`);

/* ------------------------------------------------------- soft blob helpers */

interface BlobSpec {
  id: string;
  color: string;
  opacity: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Soft radial blobs without SVG filters (export-safe): transparent edges. */
const blobs = (list: BlobSpec[]) => {
  const defs = list
    .map(
      (b) =>
        `<radialGradient id="${b.id}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${b.color}" stop-opacity="${b.opacity}"/>` +
        `<stop offset="55%" stop-color="${b.color}" stop-opacity="${+(b.opacity * 0.55).toFixed(3)}"/>` +
        `<stop offset="100%" stop-color="${b.color}" stop-opacity="0"/></radialGradient>`,
    )
    .join("");
  const els = list
    .map((b) => `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry}" fill="url(#${b.id})"/>`)
    .join("");
  return `<defs>${defs}</defs>${els}`;
};

/** Deterministic pseudo-random (stable between preview and export). */
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/* ============================================================== tile assets */

const TILES: Record<string, { url: string; px: number }> = (() => {
  const dots = (color: string, op: number, spacing = 26, r = 2.1) =>
    tileUrl(
      spacing,
      spacing,
      `<circle cx="${spacing / 2}" cy="${spacing / 2}" r="${r}" fill="${color}" fill-opacity="${op}"/>`,
    );
  const grid = (color: string, op: number, size = 44) =>
    tileUrl(
      size,
      size,
      `<path d="M${size},0.75 H0 V${size}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.5"/>`,
    );
  // seamless 45° stripes: one diagonal per tile continues across neighbours
  const diag = (color: string, op: number, size = 26, w = 5) =>
    tileUrl(
      size,
      size,
      `<path d="M0,${size} L${size},0" stroke="${color}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="square"/>`,
    );
  const diamonds = (color: string, op: number, size = 46) =>
    tileUrl(
      size,
      size,
      `<path d="M0,${size} L${size},0 M0,0 L${size},${size}" stroke="${color}" stroke-opacity="${op}" stroke-width="1.6"/>`,
    );
  const triangles = (color: string, op: number) =>
    tileUrl(
      60,
      52,
      `<g fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="2">` +
        `<path d="M30,8 L50,42 L10,42 Z"/><circle cx="30" cy="31" r="2.4" fill="${color}" stroke="none"/></g>`,
    );
  const islamicStar = (stroke: string, op: number, size = 116) => {
    const c = size / 2;
    const s = 54;
    const x = c - s / 2;
    return tileUrl(
      size,
      size,
      `<g fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="2">` +
        `<rect x="${x}" y="${x}" width="${s}" height="${s}"/>` +
        `<rect x="${x}" y="${x}" width="${s}" height="${s}" transform="rotate(45 ${c} ${c})"/>` +
        `<circle cx="${c}" cy="${c}" r="9"/>` +
        `<circle cx="0" cy="0" r="5"/><circle cx="${size}" cy="0" r="5"/>` +
        `<circle cx="0" cy="${size}" r="5"/><circle cx="${size}" cy="${size}" r="5"/></g>`,
    );
  };
  const arabesque = (stroke: string, op: number, size = 96) => {
    const r = 62;
    return tileUrl(
      size,
      size,
      `<g fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="1.8">` +
        `<circle cx="0" cy="0" r="${r}"/><circle cx="${size}" cy="0" r="${r}"/>` +
        `<circle cx="0" cy="${size}" r="${r}"/><circle cx="${size}" cy="${size}" r="${r}"/>` +
        `<circle cx="${size / 2}" cy="${size / 2}" r="9"/></g>`,
    );
  };
  const girih = (stroke: string, op: number, size = 96) => {
    const c = size / 2;
    return tileUrl(
      size,
      size,
      `<g fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="2">` +
        `<path d="M${c},8 L${c + 9},${c - 9} L${size - 8},${c} L${c + 9},${c + 9} L${c},${size - 8} L${c - 9},${c + 9} L8,${c} L${c - 9},${c - 9} Z"/>` +
        `<circle cx="${c}" cy="${c}" r="5"/></g>`,
    );
  };
  const linen = (color: string, op: number) =>
    tileUrl(
      9,
      9,
      `<path d="M9,0.5 H0 M0.5,0 V9" stroke="${color}" stroke-opacity="${op}" stroke-width="1"/>`,
    );

  return {
    "dots-slate-light": { url: dots("#64748b", 0.5), px: 26 },
    "dots-slate-dark": { url: dots("#7d8aa0", 0.5), px: 26 },
    "grid-indigo": { url: grid("#6366f1", 0.32), px: 44 },
    "diag-slate": { url: diag("#94a3b8", 0.4, 26, 4), px: 26 },
    "diamonds-sky": { url: diamonds("#7dd3fc", 0.32), px: 46 },
    "triangles-indigo": { url: triangles("#818cf8", 0.4), px: 60 },
    "islamic-sand": { url: islamicStar("#b45309", 0.32), px: 116 },
    "islamic-gold": { url: islamicStar("#d4a94e", 0.38), px: 116 },
    "arabesque-teal": { url: arabesque("#0d9488", 0.34), px: 96 },
    "girih-mint": { url: girih("#6ee7b7", 0.36), px: 96 },
    "linen-night": { url: linen("#8fa3c7", 0.16), px: 9 },
  };
})();

/* =========================================================== full-bleed art */

const WAVE1 = "M0,520 C240,470 480,580 720,530 C960,480 1120,560 1280,510 L1280,720 L0,720 Z";
const WAVE2 = "M0,575 C260,530 520,625 780,578 C1000,538 1140,605 1280,572 L1280,720 L0,720 Z";
const WAVE3 = "M0,628 C300,590 560,660 840,625 C1040,600 1180,640 1280,618 L1280,720 L0,720 Z";

const waves = (layers: [string, number, string][]) =>
  layers.map(([fill, op, d]) => `<path d="${d}" fill="${fill}" fill-opacity="${op}"/>`).join("");

const rays = (cx: number, cy: number, n: number, len: number, color: string, op: number) => {
  let s = "";
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2;
    const a2 = ((i + 0.45) / n) * Math.PI * 2;
    s +=
      `<polygon points="${cx},${cy} ${Math.round(cx + len * Math.cos(a1))},${Math.round(cy + len * Math.sin(a1))} ` +
      `${Math.round(cx + len * Math.cos(a2))},${Math.round(cy + len * Math.sin(a2))}" fill="${color}" fill-opacity="${i % 2 ? op : op * 0.35}"/>`;
  }
  return s;
};

const ARTS: Record<string, string> = (() => {
  // chalk dust: deterministic speckle + a soft top glow
  const dust = (() => {
    const rnd = seeded(20240915);
    let s = "";
    for (let i = 0; i < 90; i++) {
      const x = Math.round(rnd() * 1280);
      const y = Math.round(rnd() * 720);
      const r = (0.7 + rnd() * 1.6).toFixed(1);
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8f0e4" fill-opacity="${(0.05 + rnd() * 0.1).toFixed(2)}"/>`;
    }
    return s;
  })();

  const notebookLines = (() => {
    let s = "";
    for (let y = 72; y < 720; y += 52) {
      s += `<line x1="0" y1="${y}" x2="1280" y2="${y}" stroke="#93c5fd" stroke-opacity="0.6" stroke-width="2"/>`;
    }
    s += `<line x1="150" y1="0" x2="150" y2="720" stroke="#f87171" stroke-opacity="0.65" stroke-width="2.5"/>`;
    return s;
  })();

  const graphLines = (() => {
    let s = "";
    for (let x = 0; x <= 1280; x += 40) {
      const major = x % 200 === 0;
      s += `<line x1="${x}" y1="0" x2="${x}" y2="720" stroke="#3b82f6" stroke-opacity="${major ? 0.4 : 0.2}" stroke-width="${major ? 2 : 1}"/>`;
    }
    for (let y = 0; y <= 720; y += 40) {
      const major = y % 200 === 0;
      s += `<line x1="0" y1="${y}" x2="1280" y2="${y}" stroke="#3b82f6" stroke-opacity="${major ? 0.4 : 0.2}" stroke-width="${major ? 2 : 1}"/>`;
    }
    return s;
  })();

  return {
    "glow-top": artUrl(
      blobs([{ id: "gt", color: "#ffffff", opacity: 0.55, cx: 640, cy: -80, rx: 620, ry: 300 }]),
    ),
    "aurora-blobs": artUrl(
      blobs([
        { id: "a1", color: "#7c3aed", opacity: 0.85, cx: 180, cy: 120, rx: 380, ry: 300 },
        { id: "a2", color: "#06b6d4", opacity: 0.7, cx: 1130, cy: 600, rx: 420, ry: 320 },
        { id: "a3", color: "#34d399", opacity: 0.5, cx: 1080, cy: 90, rx: 300, ry: 220 },
        { id: "a4", color: "#f472b6", opacity: 0.45, cx: 240, cy: 640, rx: 320, ry: 220 },
      ]),
    ),
    "ribbons-light": artUrl(
      `<defs><linearGradient id="rb" x1="0" y1="1" x2="1" y2="0">` +
        `<stop offset="0%" stop-color="#6366f1" stop-opacity="0"/><stop offset="35%" stop-color="#6366f1" stop-opacity="0.5"/>` +
        `<stop offset="70%" stop-color="#a855f7" stop-opacity="0.45"/><stop offset="100%" stop-color="#a855f7" stop-opacity="0"/></linearGradient></defs>` +
        `<polygon points="-80,720 620,-80 760,-80 60,720" fill="url(#rb)"/>` +
        `<polygon points="260,720 960,-80 1020,-80 320,720" fill="url(#rb)" opacity="0.7"/>` +
        `<polygon points="700,720 1220,120 1280,120 830,720" fill="url(#rb)" opacity="0.55"/>`,
    ),
    "ember-blobs": artUrl(
      blobs([
        { id: "e1", color: "#f97316", opacity: 0.8, cx: 1120, cy: 150, rx: 400, ry: 300 },
        { id: "e2", color: "#ec4899", opacity: 0.65, cx: 170, cy: 600, rx: 380, ry: 280 },
        { id: "e3", color: "#fbbf24", opacity: 0.5, cx: 640, cy: 700, rx: 420, ry: 200 },
      ]),
    ),
    streaks: artUrl(
      `<g stroke-linecap="round">` +
        `<line x1="880" y1="-20" x2="360" y2="740" stroke="#22d3ee" stroke-opacity="0.25" stroke-width="26"/>` +
        `<line x1="880" y1="-20" x2="360" y2="740" stroke="#67e8f9" stroke-opacity="0.9" stroke-width="4"/>` +
        `<line x1="1020" y1="-20" x2="500" y2="740" stroke="#e879f9" stroke-opacity="0.22" stroke-width="20"/>` +
        `<line x1="1020" y1="-20" x2="500" y2="740" stroke="#f0abfc" stroke-opacity="0.85" stroke-width="3"/>` +
        `<line x1="1140" y1="-20" x2="620" y2="740" stroke="#818cf8" stroke-opacity="0.3" stroke-width="10"/>` +
        `</g>`,
    ),
    "diag-bands": artUrl(
      `<polygon points="-120,720 480,-80 660,-80 60,720" fill="#ffffff" fill-opacity="0.07"/>` +
        `<polygon points="240,720 840,-80 920,-80 320,720" fill="#ffffff" fill-opacity="0.06"/>` +
        `<polygon points="640,800 1240,0 1280,0 720,800" fill="#ffffff" fill-opacity="0.08"/>`,
    ),
    "chalk-dust": artUrl(
      dust + blobs([{ id: "cg", color: "#e8f0e4", opacity: 0.1, cx: 640, cy: -60, rx: 700, ry: 260 }]),
    ),
    notebook: artUrl(notebookLines),
    graph: artUrl(graphLines),
    "scholar-frame": artUrl(
      `<rect x="26" y="26" width="1228" height="668" fill="none" stroke="#b45309" stroke-opacity="0.75" stroke-width="3"/>` +
        `<rect x="40" y="40" width="1200" height="640" fill="none" stroke="#b45309" stroke-opacity="0.5" stroke-width="1.5"/>` +
        `<g fill="#b45309" fill-opacity="0.85">` +
        `<rect x="19" y="19" width="14" height="14" transform="rotate(45 26 26)"/>` +
        `<rect x="1247" y="19" width="14" height="14" transform="rotate(45 1254 26)"/>` +
        `<rect x="19" y="687" width="14" height="14" transform="rotate(45 26 694)"/>` +
        `<rect x="1247" y="687" width="14" height="14" transform="rotate(45 1254 694)"/></g>`,
    ),
    "elegant-gold": artUrl(
      `<rect x="140" y="646" width="1000" height="3" fill="#d4a94e" fill-opacity="0.9"/>` +
        `<polygon points="640,634 655,649 640,664 625,649" fill="#d4a94e"/>` +
        `<g fill="none" stroke="#d4a94e" stroke-opacity="0.85" stroke-width="3">` +
        `<path d="M70,130 V70 H130"/><path d="M1210,130 V70 H1150"/>` +
        `<path d="M70,590 V650 H130"/><path d="M1210,590 V650 H1150"/></g>`,
    ),
    sheen: artUrl(
      `<polygon points="180,-80 560,-80 -120,800 -320,800" fill="#ffffff" fill-opacity="0.06"/>` +
        `<polygon points="620,-80 700,-80 20,800 -60,800" fill="#ffffff" fill-opacity="0.09"/>`,
    ),
    spotlight: artUrl(
      blobs([
        { id: "s1", color: "#ffffff", opacity: 0.14, cx: 640, cy: -60, rx: 560, ry: 320 },
        { id: "s2", color: "#6ee7b7", opacity: 0.16, cx: 640, cy: 780, rx: 700, ry: 240 },
      ]),
    ),
    "waves-ocean": artUrl(
      waves([
        ["#7dd3fc", 0.55, WAVE1],
        ["#38bdf8", 0.65, WAVE2],
        ["#e0f2fe", 0.85, WAVE3],
      ]),
    ),
    "waves-sunset": artUrl(
      waves([
        ["#f472b6", 0.55, WAVE1],
        ["#fb923c", 0.7, WAVE2],
        ["#fed7aa", 0.9, WAVE3],
      ]),
    ),
    "curve-accent": artUrl(
      `<ellipse cx="1150" cy="-110" rx="470" ry="300" fill="#38bdf8" fill-opacity="0.5"/>` +
        `<ellipse cx="1120" cy="-90" rx="330" ry="210" fill="#7dd3fc" fill-opacity="0.55"/>` +
        `<ellipse cx="120" cy="810" rx="380" ry="220" fill="#818cf8" fill-opacity="0.35"/>` +
        waves([["#bae6fd", 0.7, WAVE3]]),
    ),
    "waves-indigo": artUrl(
      waves([
        ["#818cf8", 0.5, WAVE1],
        ["#6366f1", 0.65, WAVE2],
        ["#c7d2fe", 0.8, WAVE3],
      ]),
    ),
    "mesh-aurora": artUrl(
      `<rect width="1280" height="720" fill="#1e1b4b"/>` +
        blobs([
          { id: "ma1", color: "#7c3aed", opacity: 0.95, cx: 300, cy: 180, rx: 460, ry: 360 },
          { id: "ma2", color: "#22d3ee", opacity: 0.85, cx: 1020, cy: 200, rx: 420, ry: 340 },
          { id: "ma3", color: "#4ade80", opacity: 0.7, cx: 900, cy: 600, rx: 480, ry: 320 },
          { id: "ma4", color: "#f472b6", opacity: 0.75, cx: 260, cy: 590, rx: 400, ry: 300 },
        ]),
    ),
    "mesh-sunset": artUrl(
      `<rect width="1280" height="720" fill="#431407"/>` +
        blobs([
          { id: "ms1", color: "#f97316", opacity: 0.95, cx: 280, cy: 160, rx: 480, ry: 360 },
          { id: "ms2", color: "#8b5cf6", opacity: 0.8, cx: 1040, cy: 180, rx: 440, ry: 340 },
          { id: "ms3", color: "#ec4899", opacity: 0.85, cx: 920, cy: 590, rx: 500, ry: 330 },
          { id: "ms4", color: "#fbbf24", opacity: 0.8, cx: 240, cy: 600, rx: 420, ry: 300 },
        ]),
    ),
    "mesh-ocean": artUrl(
      `<rect width="1280" height="720" fill="#082f49"/>` +
        blobs([
          { id: "mo1", color: "#22d3ee", opacity: 0.9, cx: 300, cy: 180, rx: 460, ry: 350 },
          { id: "mo2", color: "#818cf8", opacity: 0.8, cx: 1030, cy: 190, rx: 430, ry: 340 },
          { id: "mo3", color: "#34d399", opacity: 0.75, cx: 900, cy: 600, rx: 490, ry: 330 },
          { id: "mo4", color: "#38bdf8", opacity: 0.85, cx: 250, cy: 590, rx: 410, ry: 300 },
        ]),
    ),
    "blobs-light": artUrl(
      blobs([
        { id: "bl1", color: "#fdba74", opacity: 0.75, cx: 120, cy: 80, rx: 340, ry: 260 },
        { id: "bl2", color: "#f9a8d4", opacity: 0.7, cx: 1170, cy: 640, rx: 360, ry: 270 },
        { id: "bl3", color: "#c4b5fd", opacity: 0.65, cx: 1120, cy: 90, rx: 300, ry: 220 },
        { id: "bl4", color: "#a5f3d0", opacity: 0.6, cx: 180, cy: 660, rx: 300, ry: 210 },
      ]),
    ),
    "blobs-dark": artUrl(
      blobs([
        { id: "bd1", color: "#d946ef", opacity: 0.8, cx: 140, cy: 110, rx: 360, ry: 280 },
        { id: "bd2", color: "#22d3ee", opacity: 0.75, cx: 1150, cy: 620, rx: 380, ry: 280 },
        { id: "bd3", color: "#fbbf24", opacity: 0.55, cx: 1100, cy: 100, rx: 280, ry: 200 },
      ]),
    ),
    "blob-duo": artUrl(
      blobs([
        { id: "bdu1", color: "#818cf8", opacity: 0.6, cx: 90, cy: 90, rx: 420, ry: 330 },
        { id: "bdu2", color: "#fda4af", opacity: 0.6, cx: 1190, cy: 630, rx: 420, ry: 330 },
      ]),
    ),
    "peaks-dusk": artUrl(
      `<polygon points="0,560 180,440 360,540 540,420 720,540 900,430 1080,540 1280,450 1280,720 0,720" fill="#4c1d95" fill-opacity="0.75"/>` +
        `<polygon points="0,610 220,500 400,590 620,490 820,600 1020,510 1280,600 1280,720 0,720" fill="#312e81" fill-opacity="0.85"/>` +
        `<polygon points="0,660 260,580 480,650 700,580 940,660 1150,600 1280,650 1280,720 0,720" fill="#1e1b4b"/>`,
    ),
    "corner-stack": artUrl(
      `<polygon points="0,0 470,0 0,330" fill="#6366f1" fill-opacity="0.5"/>` +
        `<polygon points="0,0 350,0 0,240" fill="#818cf8" fill-opacity="0.6"/>` +
        `<polygon points="0,0 230,0 0,155" fill="#a5b4fc" fill-opacity="0.7"/>` +
        `<polygon points="1280,720 810,720 1280,390" fill="#6366f1" fill-opacity="0.5"/>` +
        `<polygon points="1280,720 930,720 1280,480" fill="#818cf8" fill-opacity="0.6"/>` +
        `<polygon points="1280,720 1050,720 1280,565" fill="#a5b4fc" fill-opacity="0.7"/>`,
    ),
    "peaks-night": artUrl(
      `<polygon points="0,540 200,430 380,530 580,410 760,530 950,420 1130,530 1280,440 1280,720 0,720" fill="#1f2b45" fill-opacity="0.9"/>` +
        `<polygon points="0,610 240,500 440,590 660,490 860,600 1060,505 1280,595 1280,720 0,720" fill="#141d31"/>` +
        blobs([{ id: "pn", color: "#7dd3fc", opacity: 0.25, cx: 1020, cy: 150, rx: 220, ry: 180 }]),
    ),
    burst: artUrl(rays(1090, 360, 14, 1700, "#a78bfa", 0.22)),
    "ribbons-teal": artUrl(
      `<defs><linearGradient id="rt" x1="0" y1="1" x2="1" y2="0">` +
        `<stop offset="0%" stop-color="#22d3ee" stop-opacity="0"/><stop offset="40%" stop-color="#22d3ee" stop-opacity="0.5"/>` +
        `<stop offset="75%" stop-color="#34d399" stop-opacity="0.4"/><stop offset="100%" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs>` +
        `<polygon points="-80,720 620,-80 740,-80 40,720" fill="url(#rt)"/>` +
        `<polygon points="420,720 1000,-80 1080,-80 500,720" fill="url(#rt)" opacity="0.7"/>`,
    ),
  };
})();

/* ============================================================ design lookup */

export interface DesignInfo {
  id: string;
  url: string;
  tile: boolean;
  /** natural tile size in px (tiles only) */
  tilePx: number;
}

const DESIGN_MAP: Record<string, DesignInfo> = {
  ...Object.fromEntries(
    Object.entries(TILES).map(([id, t]) => [id, { id, url: t.url, tile: true, tilePx: t.px }]),
  ),
  ...Object.fromEntries(Object.entries(ARTS).map(([id, url]) => [id, { id, url, tile: false, tilePx: 0 }])),
};

export const designInfo = (id: string | undefined): DesignInfo | null =>
  id ? (DESIGN_MAP[id] ?? null) : null;

export const designName = (id: string | undefined): string => {
  if (!id) return "";
  const p = BG_PRESETS.find((x) => x.design === id);
  return p ? p.name : id;
};

/**
 * CSS for the decorative design layer. Width/height are percentages of the
 * board (100 = natural size), applied around the centre so resizing never
 * moves the design and stays correct at any slide size or aspect ratio.
 */
export function designLayer(
  design: string | undefined,
  w: number | undefined,
  h: number | undefined,
  opacity: number | undefined,
): CSSProperties | null {
  const info = designInfo(design);
  if (!info) return null;
  const sw = Math.max(10, Math.min(400, w ?? 100));
  const sh = Math.max(10, Math.min(400, h ?? 100));
  if (info.tile) {
    const px = Math.max(4, Math.round(info.tilePx * (sw / 100)));
    const py = Math.max(4, Math.round(info.tilePx * (sh / 100)));
    return {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      backgroundImage: `url("${info.url}")`,
      backgroundRepeat: "repeat",
      backgroundPosition: "center center",
      backgroundSize: `${px}px ${py}px`,
      opacity: opacity ?? 1,
    };
  }
  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `url("${info.url}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center center",
    backgroundSize: `${sw}% ${sh}%`,
    opacity: opacity ?? 1,
  };
}

/** Compact swatch style for preset thumbnails. */
export function designThumb(design: string | undefined): CSSProperties {
  const info = designInfo(design);
  if (!info) return {};
  return info.tile
    ? {
        backgroundImage: `url("${info.url}")`,
        backgroundRepeat: "repeat",
        backgroundPosition: "center center",
        backgroundSize: `${Math.max(8, Math.round(info.tilePx * 0.55))}px auto`,
      }
    : {
        backgroundImage: `url("${info.url}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        backgroundSize: "cover",
      };
}

/* ================================================================== presets */

export const BG_CATEGORIES = [
  "Minimal",
  "Pastel",
  "Abstract",
  "Geometric",
  "Academic",
  "Elegant",
  "Islamic",
  "Waves",
  "Mesh",
  "Organic",
  "Layered",
  "Colorful",
  "Texture",
] as const;

export type BgCategory = (typeof BG_CATEGORIES)[number];

export interface BgDesignPreset {
  id: string;
  name: string;
  category: BgCategory;
  gradient: Gradient;
  /** design art id, "" = gradient only */
  design: string;
  /** light backgrounds pair best with dark text (hint only, nothing automatic) */
  light?: boolean;
}

const lin = (angle: number, stops: [string, number][]): Gradient => ({
  enabled: true,
  type: "linear",
  angle,
  stops: stops.map(([color, at]) => ({ color, at })),
  cx: 50,
  cy: 50,
});

const rad = (stops: [string, number][], cx = 50, cy = 50): Gradient => ({
  enabled: true,
  type: "radial",
  angle: 0,
  stops: stops.map(([color, at]) => ({ color, at })),
  cx,
  cy,
});

const P = (
  id: string,
  name: string,
  category: BgCategory,
  gradient: Gradient,
  design = "",
  light = false,
): BgDesignPreset => ({ id, name, category, gradient, design, light });

export const BG_PRESETS: BgDesignPreset[] = [
  /* -------------------------------- minimal ------------------------------- */
  P("minimal-mist", "Minimal Mist", "Minimal", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "", true),
  P("clean-slate", "Clean Slate", "Minimal", lin(180, [["#1e293b", 0], ["#0b1120", 100]])),
  P("ivory-calm", "Ivory Calm", "Minimal", lin(180, [["#fffdf7", 0], ["#f3ead9", 100]]), "", true),
  P("fog-glow", "Soft Fog", "Minimal", rad([["#f4f7fb", 0], ["#cbd5e1", 100]], 50, 30), "glow-top", true),

  /* -------------------------------- pastel -------------------------------- */
  P("pastel-dream", "Pastel Dream", "Pastel", lin(135, [["#fce7f3", 0], ["#ddd6fe", 50], ["#cffafe", 100]]), "", true),
  P("peach-cream", "Peach Cream", "Pastel", lin(160, [["#fff7ed", 0], ["#fed7aa", 52], ["#f9a8d4", 100]]), "", true),
  P("mint-sky", "Mint Sky", "Pastel", lin(150, [["#ecfdf5", 0], ["#d1fae5", 45], ["#bae6fd", 100]]), "", true),
  P("lavender-haze", "Lavender Haze", "Pastel", lin(140, [["#f5f3ff", 0], ["#ddd6fe", 50], ["#fbcfe8", 100]]), "", true),

  /* ------------------------------- abstract ------------------------------- */
  P("aurora-night", "Aurora Night", "Abstract", lin(160, [["#0b1026", 0], ["#191238", 100]]), "aurora-blobs"),
  P("ribbon-flow", "Ribbon Flow", "Abstract", lin(120, [["#f8fafc", 0], ["#e0e7ff", 100]]), "ribbons-light", true),
  P("ember-fluid", "Ember Fluid", "Abstract", lin(140, [["#1c0a12", 0], ["#2b1030", 100]]), "ember-blobs"),
  P("neon-streaks", "Neon Streaks", "Abstract", lin(180, [["#05070f", 0], ["#0a1628", 100]]), "streaks"),

  /* ------------------------------- geometric ------------------------------ */
  P("geo-tri-dark", "Geo Triangles", "Geometric", lin(170, [["#0f172a", 0], ["#1e1b4b", 100]]), "triangles-indigo"),
  P("geo-grid-light", "Blueprint Grid", "Geometric", lin(180, [["#ffffff", 0], ["#eef2ff", 100]]), "grid-indigo", true),
  P("diamond-lattice", "Diamond Lattice", "Geometric", lin(150, [["#082f49", 0], ["#0c4a6e", 100]]), "diamonds-sky"),
  P("stripe-accent", "Stripe Accent", "Geometric", lin(135, [["#111827", 0], ["#312e81", 100]]), "diag-bands"),

  /* ------------------------------- academic ------------------------------- */
  P("chalkboard", "Chalkboard", "Academic", lin(180, [["#1d3b2f", 0], ["#0e241c", 100]]), "chalk-dust"),
  P("notebook", "Notebook", "Academic", lin(180, [["#ffffff", 0], ["#f1f6fd", 100]]), "notebook", true),
  P("graph-paper", "Graph Paper", "Academic", lin(180, [["#f8fbff", 0], ["#e7effa", 100]]), "graph", true),
  P("scholar-cream", "Scholar Frame", "Academic", lin(180, [["#fffaf0", 0], ["#f3e6cb", 100]]), "scholar-frame", true),

  /* -------------------------------- elegant ------------------------------- */
  P("navy-gold", "Navy & Gold", "Elegant", lin(165, [["#101c3f", 0], ["#0a1230", 100]]), "elegant-gold"),
  P("charcoal-luxe", "Charcoal Luxe", "Elegant", lin(160, [["#1a1c22", 0], ["#0b0c0f", 100]]), "sheen"),
  P("slate-executive", "Slate Executive", "Elegant", lin(150, [["#334155", 0], ["#0f172a", 100]]), "sheen"),
  P("midnight-emerald", "Midnight Emerald", "Elegant", lin(160, [["#052e2b", 0], ["#021a19", 100]]), "spotlight"),

  /* -------------------------------- islamic ------------------------------- */
  P("islamic-pearl", "Pearl Star", "Islamic", lin(180, [["#faf7f0", 0], ["#eae1cf", 100]]), "islamic-sand", true),
  P("islamic-midnight", "Midnight Star", "Islamic", lin(165, [["#0d1330", 0], ["#161d42", 100]]), "islamic-gold"),
  P("arabesque-mint", "Mint Arabesque", "Islamic", lin(160, [["#f0fdfa", 0], ["#c9f5ec", 100]]), "arabesque-teal", true),
  P("girih-emerald", "Emerald Girih", "Islamic", lin(160, [["#052e2b", 0], ["#065f46", 100]]), "girih-mint"),

  /* --------------------------------- waves -------------------------------- */
  P("ocean-wave", "Ocean Wave", "Waves", lin(180, [["#0c4a6e", 0], ["#075985", 100]]), "waves-ocean"),
  P("sunset-wave", "Sunset Tide", "Waves", lin(180, [["#1e1b4b", 0], ["#7c2d5e", 55], ["#b45309", 100]]), "waves-sunset"),
  P("mist-curve", "Mist Curve", "Waves", lin(180, [["#ffffff", 0], ["#dcf0fd", 100]]), "curve-accent", true),
  P("indigo-tide", "Indigo Tide", "Waves", lin(175, [["#1e1b4b", 0], ["#3730a3", 100]]), "waves-indigo"),

  /* ---------------------------------- mesh --------------------------------- */
  P("mesh-aurora-bg", "Mesh Aurora", "Mesh", lin(140, [["#1e1b4b", 0], ["#312e81", 100]]), "mesh-aurora"),
  P("mesh-sunset-bg", "Mesh Sunset", "Mesh", lin(140, [["#431407", 0], ["#7c2d12", 100]]), "mesh-sunset"),
  P("mesh-ocean-bg", "Mesh Ocean", "Mesh", lin(140, [["#082f49", 0], ["#0c4a6e", 100]]), "mesh-ocean"),

  /* --------------------------------- organic ------------------------------- */
  P("blobs-pastel", "Pastel Blobs", "Organic", lin(150, [["#fff7ed", 0], ["#fae8ff", 100]]), "blobs-light", true),
  P("blobs-midnight", "Midnight Blobs", "Organic", lin(160, [["#0b1026", 0], ["#170f36", 100]]), "blobs-dark"),
  P("blob-duo", "Blob Duo", "Organic", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "blob-duo", true),

  /* --------------------------------- layered ------------------------------- */
  P("layered-peaks", "Dusk Peaks", "Layered", lin(180, [["#312e81", 0], ["#0ea5e9", 100]]), "peaks-dusk"),
  P("corner-stack", "Corner Stack", "Layered", lin(150, [["#f8fafc", 0], ["#e0e7ff", 100]]), "corner-stack", true),
  P("strata-night", "Night Strata", "Layered", lin(165, [["#0f172a", 0], ["#020617", 100]]), "peaks-night"),

  /* -------------------------------- colorful ------------------------------- */
  P("vibrant-pop", "Vibrant Pop", "Colorful", lin(120, [["#7c3aed", 0], ["#db2777", 55], ["#f97316", 100]]), "diag-bands"),
  P("indigo-burst", "Indigo Burst", "Colorful", lin(180, [["#1e1b4b", 0], ["#4c1d95", 100]]), "burst"),
  P("teal-energy", "Teal Energy", "Colorful", lin(130, [["#134e4a", 0], ["#0e7490", 55], ["#1d4ed8", 100]]), "ribbons-teal"),

  /* --------------------------------- texture ------------------------------- */
  P("dots-light", "Dot Grid Light", "Texture", lin(180, [["#ffffff", 0], ["#eef2f7", 100]]), "dots-slate-light", true),
  P("dots-dark", "Dot Grid Dark", "Texture", lin(180, [["#101828", 0], ["#05070d", 100]]), "dots-slate-dark"),
  P("pinstripe", "Pinstripe", "Texture", lin(175, [["#f8fafc", 0], ["#e6ecf4", 100]]), "diag-slate", true),
  P("linen-night", "Linen Night", "Texture", lin(170, [["#111c33", 0], ["#0a0f1f", 100]]), "linen-night"),
];
