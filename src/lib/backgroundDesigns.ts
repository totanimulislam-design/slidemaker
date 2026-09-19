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

  // --- new edu-inspired tiles ---
  const crossTile = (color: string, op: number, size = 28) =>
    tileUrl(size, size, `<path d="M4,4 L${size-4},${size-4} M${size-4},4 L4,${size-4}" stroke="${color}" stroke-opacity="${op}" stroke-width="1.6" stroke-linecap="round"/>`);
  const plusTile = (color: string, op: number, size = 28) =>
    tileUrl(size, size, `<path d="M${size/2},4 V${size-4} M4,${size/2} H${size-4}" stroke="${color}" stroke-opacity="${op}" stroke-width="1.5" stroke-linecap="round"/>`);
  const starTile = (color: string, op: number, size = 32) =>
    tileUrl(size, size, `<path d="M${size/2},3 L${size*0.58},${size*0.39} L${size-2},${size/2} L${size*0.58},${size*0.61} L${size/2},${size-2} L${size*0.42},${size*0.61} L2,${size/2} L${size*0.42},${size*0.39} Z" fill="${color}" fill-opacity="${op}"/>`);
  const circleTile = (color: string, op: number, size = 36) =>
    tileUrl(size, size, `<circle cx="${size/2}" cy="${size/2}" r="9" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.6"/>`);
  const checkTile = (color: string, op: number, size = 36) =>
    tileUrl(size, size, `<path d="M8,18 L15,25 L28,10" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
  const scribbleTile = (color: string, op: number, sizeW = 60, sizeH = 20) =>
    tileUrl(sizeW, sizeH, `<path d="M0,${sizeH/2} Q${sizeW*0.25},${sizeH*0.1} ${sizeW*0.5},${sizeH/2} T${sizeW},${sizeH/2}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.8" stroke-linecap="round"/>`);
  const zigzagTile = (color: string, op: number, sizeW = 40, sizeH = 16) =>
    tileUrl(sizeW, sizeH, `<path d="M0,8 L8,2 L16,14 L24,2 L32,14 L40,8" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`);
  const highlightTile = (color: string, op: number, w = 120, h = 28) =>
    tileUrl(w, h, `<rect x="0" y="${h*0.28}" width="${w}" height="${h*0.44}" rx="5" fill="${color}" fill-opacity="${op}"/>`);
  const confettiTile = () =>
    tileUrl(80, 80, `<g opacity="0.55"><circle cx="10" cy="15" r="3" fill="#facc15"/><circle cx="40" cy="10" r="2.5" fill="#f472b6"/><circle cx="70" cy="20" r="3" fill="#60a5fa"/><circle cx="20" cy="50" r="2.5" fill="#4ade80"/><circle cx="60" cy="55" r="3" fill="#a78bfa"/><circle cx="30" cy="75" r="2.5" fill="#fb923c"/></g>`);

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
    // --- new ---
    "dots-yellow": { url: dots("#facc15", 0.5, 26, 2.2), px: 26 },
    "dots-pink": { url: dots("#f472b6", 0.45, 26, 2.2), px: 26 },
    "dots-green": { url: dots("#4ade80", 0.45, 26, 2.2), px: 26 },
    "dots-blue": { url: dots("#60a5fa", 0.45, 26, 2.2), px: 26 },
    "dots-violet": { url: dots("#a78bfa", 0.45, 26, 2.2), px: 26 },
    "dots-orange": { url: dots("#fb923c", 0.45, 26, 2.2), px: 26 },
    "grid-slate-light": { url: grid("#94a3b8", 0.18, 32), px: 32 },
    "grid-blue": { url: grid("#3b82f6", 0.22, 36), px: 36 },
    "grid-slate-dark": { url: grid("#475569", 0.22, 32), px: 32 },
    "diag-yellow": { url: diag("#facc15", 0.35, 24, 4), px: 24 },
    "diag-pink": { url: diag("#f472b6", 0.35, 24, 4), px: 24 },
    "diag-blue": { url: diag("#60a5fa", 0.35, 24, 4), px: 24 },
    "diag-green": { url: diag("#4ade80", 0.35, 24, 4), px: 24 },
    "diag-violet": { url: diag("#a78bfa", 0.35, 24, 4), px: 24 },
    "cross-slate": { url: crossTile("#94a3b8", 0.32), px: 28 },
    "plus-slate": { url: plusTile("#94a3b8", 0.28), px: 28 },
    "star-slate": { url: starTile("#94a3b8", 0.26), px: 32 },
    "star-yellow": { url: starTile("#facc15", 0.35), px: 32 },
    "star-pink": { url: starTile("#f472b6", 0.32), px: 32 },
    "circle-slate": { url: circleTile("#94a3b8", 0.3), px: 36 },
    "circle-blue": { url: circleTile("#60a5fa", 0.3), px: 36 },
    "check-slate": { url: checkTile("#94a3b8", 0.32), px: 36 },
    "scribble-slate": { url: scribbleTile("#94a3b8", 0.35), px: 60 },
    "zigzag-slate": { url: zigzagTile("#94a3b8", 0.32), px: 40 },
    "highlight-yellow-tile": { url: highlightTile("#fde047", 0.32), px: 120 },
    "highlight-pink-tile": { url: highlightTile("#f9a8d4", 0.32), px: 120 },
    "highlight-blue-tile": { url: highlightTile("#7dd3fc", 0.32), px: 120 },
    "highlight-green-tile": { url: highlightTile("#86efac", 0.32), px: 120 },
    "confetti-tile": { url: confettiTile(), px: 80 },
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

  // --- new edu-inspired helpers ---
  const highlightSwipe = (color: string, op: number, y: number, h: number, rot: number) =>
    `<g transform="rotate(${rot} 640 ${y})"><rect x="-40" y="${y}" width="1360" height="${h}" rx="${h/2}" fill="${color}" fill-opacity="${op}"/></g>`;

  const tapeStrip = (x: number, y: number, w: number, h: number, rot: number, color: string, op: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" fill="${color}" fill-opacity="${op}" transform="rotate(${rot} ${x + w/2} ${y + h/2})"/>`;

  const doodleCircles = (() => {
    const rnd = seeded(111);
    let s = "";
    for (let i = 0; i < 18; i++) {
      const cx = Math.round(80 + rnd() * 1120);
      const cy = Math.round(60 + rnd() * 600);
      const r = Math.round(12 + rnd() * 28);
      const col = ["#facc15", "#f472b6", "#60a5fa", "#4ade80", "#a78bfa"][Math.floor(rnd()*5)];
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-opacity="${0.25 + rnd()*0.25}" stroke-width="${1.5 + rnd()*1.5}" stroke-dasharray="${rnd()>0.5 ? '6 6' : '0'}"/>`;
    }
    return s;
  })();

  const doodleStars = (() => {
    const rnd = seeded(222);
    let s = "";
    for (let i = 0; i < 24; i++) {
      const cx = Math.round(60 + rnd() * 1160);
      const cy = Math.round(40 + rnd() * 640);
      const r = 6 + rnd()*10;
      const col = ["#facc15", "#f472b6", "#60a5fa", "#fb923c", "#a78bfa"][Math.floor(rnd()*5)];
      const rot = Math.round(rnd()*360);
      s += `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path d="M0,${-r} L${r*0.3},${-r*0.3} L${r},0 L${r*0.3},${r*0.3} L0,${r} L${-r*0.3},${r*0.3} L${-r},0 L${-r*0.3},${-r*0.3} Z" fill="${col}" fill-opacity="${0.22 + rnd()*0.25}"/></g>`;
    }
    return s;
  })();

  const doodleChecks = (() => {
    const rnd = seeded(333);
    let s = "";
    for (let i = 0; i < 14; i++) {
      const cx = Math.round(100 + rnd() * 1080);
      const cy = Math.round(80 + rnd() * 560);
      const scale = 0.7 + rnd()*0.8;
      const col = rnd()>0.5 ? "#22c55e" : "#3b82f6";
      s += `<g transform="translate(${cx} ${cy}) scale(${scale})"><path d="M-12,0 L-2,10 L14,-10" fill="none" stroke="${col}" stroke-opacity="${0.28 + rnd()*0.2}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
    return s;
  })();

  const doodleArrows = (() => {
    const rnd = seeded(444);
    let s = "";
    for (let i = 0; i < 12; i++) {
      const x1 = Math.round(rnd()*1280);
      const y1 = Math.round(rnd()*720);
      const x2 = x1 + Math.round((rnd()-0.5)*300);
      const y2 = y1 + Math.round((rnd()-0.5)*200);
      const col = ["#f97316", "#8b5cf6", "#06b6d4", "#ef4444"][Math.floor(rnd()*4)];
      s += `<g stroke="${col}" stroke-opacity="${0.22 + rnd()*0.2}" stroke-width="2" fill="none" stroke-linecap="round"><path d="M${x1},${y1} Q${(x1+x2)/2 + (rnd()-0.5)*80},${(y1+y2)/2 + (rnd()-0.5)*60} ${x2},${y2}"/><polygon points="${x2},${y2} ${x2-10},${y2-4} ${x2-8},${y2+6}" fill="${col}" fill-opacity="${0.3}"/></g>`;
    }
    return s;
  })();

  const confettiScatter = (() => {
    const rnd = seeded(555);
    let s = "";
    for (let i = 0; i < 40; i++) {
      const x = Math.round(rnd()*1280);
      const y = Math.round(rnd()*720);
      const r = (2 + rnd()*4).toFixed(1);
      const col = ["#facc15", "#f472b6", "#60a5fa", "#4ade80", "#fb923c", "#a78bfa", "#22d3ee"][Math.floor(rnd()*7)];
      const shape = rnd()>0.6 ? `<rect x="${x}" y="${y}" width="${r}" height="${r}" rx="1" fill="${col}" fill-opacity="${0.35 + rnd()*0.25}" transform="rotate(${Math.round(rnd()*360)} ${x} ${y})"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" fill-opacity="${0.35 + rnd()*0.25}"/>`;
      s += shape;
    }
    return s;
  })();

  const brushStrokes = (color: string) => {
    const rnd = seeded(color.length * 123);
    let s = "";
    for (let i = 0; i < 4; i++) {
      const y = 80 + i*150 + rnd()*40;
      const h = 18 + rnd()*28;
      const rot = (rnd()-0.5)*6;
      s += highlightSwipe(color, 0.18 + rnd()*0.12, y, h, rot);
    }
    return s;
  };

  const cornerMarks = `<g fill="none" stroke="#facc15" stroke-opacity="0.55" stroke-width="3"><path d="M40,120 V40 H120"/><path d="M1160,40 H1240 V120"/><path d="M40,600 V680 H120"/><path d="M1160,680 H1240 V600"/></g>`;

  const formulaFaint = `<g font-family="serif" font-size="42" fill="#94a3b8" fill-opacity="0.08"><text x="80" y="120">∫ ∑ π √ ∞</text><text x="900" y="200">E=mc²</text><text x="200" y="650">α β γ θ</text><text x="1000" y="620">x² + y²</text></g>`;

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
    // --- new edu-inspired arts ---
    "highlight-yellow": artUrl(highlightSwipe("#fde047", 0.28, 300, 28, -2) + highlightSwipe("#facc15", 0.18, 360, 22, -1.5)),
    "highlight-pink": artUrl(highlightSwipe("#f9a8d4", 0.28, 300, 28, -2) + highlightSwipe("#f472b6", 0.18, 360, 22, -1.5)),
    "highlight-blue": artUrl(highlightSwipe("#7dd3fc", 0.28, 300, 28, -2) + highlightSwipe("#38bdf8", 0.18, 360, 22, -1.5)),
    "highlight-green": artUrl(highlightSwipe("#86efac", 0.28, 300, 28, -2) + highlightSwipe("#4ade80", 0.18, 360, 22, -1.5)),
    "highlight-violet": artUrl(highlightSwipe("#c4b5fd", 0.28, 300, 28, -2) + highlightSwipe("#a78bfa", 0.18, 360, 22, -1.5)),
    "tape-top": artUrl(
      tapeStrip(80, 18, 180, 18, -6, "#fde68a", 0.75) +
      tapeStrip(340, 22, 160, 16, 5, "#93c5fd", 0.65) +
      tapeStrip(560, 16, 200, 18, -4, "#f9a8d4", 0.65) +
      tapeStrip(840, 20, 170, 16, 4, "#86efac", 0.65)
    ),
    "tape-scatter": artUrl(
      tapeStrip(120, 80, 140, 14, -8, "#fde68a", 0.55) +
      tapeStrip(900, 120, 160, 14, 7, "#93c5fd", 0.5) +
      tapeStrip(200, 580, 150, 14, -5, "#f9a8d4", 0.5) +
      tapeStrip(1000, 560, 140, 14, 6, "#86efac", 0.5) +
      tapeStrip(500, 40, 180, 12, -3, "#c4b5fd", 0.45)
    ),
    "doodle-circles": artUrl(doodleCircles),
    "doodle-stars": artUrl(doodleStars),
    "doodle-checks": artUrl(doodleChecks),
    "doodle-arrows": artUrl(doodleArrows),
    "confetti-scatter": artUrl(confettiScatter),
    "brush-yellow": artUrl(brushStrokes("#facc15")),
    "brush-pink": artUrl(brushStrokes("#f472b6")),
    "brush-blue": artUrl(brushStrokes("#60a5fa")),
    "brush-green": artUrl(brushStrokes("#4ade80")),
    "brush-violet": artUrl(brushStrokes("#a78bfa")),
    "exam-corners": artUrl(cornerMarks),
    "formula-faint": artUrl(formulaFaint + blobs([{ id: "ff", color: "#ffffff", opacity: 0.08, cx: 640, cy: 360, rx: 600, ry: 300 }])),
    "paper-tape": artUrl(
      `<rect x="0" y="0" width="1280" height="22" fill="#fde68a" fill-opacity="0.55"/>` +
      `<rect x="0" y="698" width="1280" height="22" fill="#93c5fd" fill-opacity="0.4"/>` +
      tapeStrip(100, 18, 120, 10, -4, "#f9a8d4", 0.5) +
      tapeStrip(1100, 18, 100, 10, 5, "#86efac", 0.5)
    ),
    "sticker-scatter": artUrl(
      `<g opacity="0.9">` +
      `<rect x="80" y="60" width="110" height="36" rx="18" fill="#fde047" fill-opacity="0.9"/>` +
      `<rect x="1020" y="80" width="90" height="32" rx="16" fill="#f9a8d4" fill-opacity="0.85"/>` +
      `<rect x="200" y="620" width="100" height="32" rx="16" fill="#7dd3fc" fill-opacity="0.85"/>` +
      `<rect x="950" y="600" width="120" height="36" rx="18" fill="#86efac" fill-opacity="0.9"/>` +
      `</g>`
    ),
    "underline-scribbles": artUrl(
      `<g fill="none" stroke-linecap="round">` +
      `<path d="M100,600 Q300,580 500,600 T900,600" stroke="#facc15" stroke-opacity="0.45" stroke-width="8"/>` +
      `<path d="M150,640 Q400,620 650,640 T1100,640" stroke="#f472b6" stroke-opacity="0.35" stroke-width="6"/>` +
      `</g>`
    ),
    "chalk-arrows": artUrl(
      `<g stroke="#e2e8f0" stroke-opacity="0.35" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M100,200 L300,180 L280,160 M300,180 L285,200"/>` +
      `<path d="M900,500 L1100,520 L1080,500 M1100,520 L1075,540"/>` +
      `<path d="M200,600 Q400,550 600,600"/>` +
      `</g>` + dust
    ),
    "grid-dots": artUrl(
      graphLines +
      `<g fill="#facc15" fill-opacity="0.25"><circle cx="200" cy="200" r="6"/><circle cx="600" cy="300" r="5"/><circle cx="1000" cy="400" r="6"/><circle cx="400" cy="600" r="5"/></g>`
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
  "Marks",
  "Stickers",
  "Doodle",
  "Exam",
  "Highlight",
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

  /* ------------------------------- marks — new massive expansion --------------- */
  P("marks-yellow", "Marker Yellow", "Marks", lin(180, [["#fefce8", 0], ["#fef9c3", 100]]), "highlight-yellow-tile", true),
  P("marks-pink", "Marker Pink", "Marks", lin(180, [["#fdf2f8", 0], ["#fce7f3", 100]]), "highlight-pink-tile", true),
  P("marks-blue", "Marker Blue", "Marks", lin(180, [["#f0f9ff", 0], ["#e0f2fe", 100]]), "highlight-blue-tile", true),
  P("marks-green", "Marker Green", "Marks", lin(180, [["#f0fdf4", 0], ["#dcfce7", 100]]), "highlight-green-tile", true),
  P("marks-scribble", "Scribble Line", "Marks", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "scribble-slate", true),
  P("marks-zigzag", "Zigzag", "Marks", lin(180, [["#ffffff", 0], ["#f8fafc", 100]]), "zigzag-slate", true),
  P("marks-cross", "Cross Marks", "Marks", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "cross-slate", true),
  P("marks-plus", "Plus Grid", "Marks", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "plus-slate", true),
  P("marks-circle", "Circle Marks", "Marks", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "circle-slate", true),
  P("marks-check", "Check Marks", "Marks", lin(180, [["#f0fdf4", 0], ["#dcfce7", 100]]), "check-slate", true),
  P("marks-yellow-dots", "Yellow Dots", "Marks", lin(180, [["#fefce8", 0], ["#fef08a", 100]]), "dots-yellow", true),
  P("marks-pink-dots", "Pink Dots", "Marks", lin(180, [["#fdf2f8", 0], ["#fbcfe8", 100]]), "dots-pink", true),
  P("marks-blue-dots", "Blue Dots", "Marks", lin(180, [["#eff6ff", 0], ["#bfdbfe", 100]]), "dots-blue", true),
  P("marks-green-dots", "Green Dots", "Marks", lin(180, [["#f0fdf4", 0], ["#bbf7d0", 100]]), "dots-green", true),
  P("marks-violet-dots", "Violet Dots", "Marks", lin(180, [["#f5f3ff", 0], ["#ddd6fe", 100]]), "dots-violet", true),
  P("marks-highlight-yellow", "Highlight Sweep Yellow", "Marks", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "highlight-yellow"),
  P("marks-highlight-blue", "Highlight Sweep Blue", "Marks", lin(180, [["#0c4a6e", 0], ["#082f49", 100]]), "highlight-blue"),
  P("marks-highlight-pink", "Highlight Sweep Pink", "Marks", lin(180, [["#4a044e", 0], ["#701a75", 100]]), "highlight-pink"),
  P("marks-brush-yellow", "Brush Yellow", "Marks", lin(180, [["#422006", 0], ["#7c2d12", 100]]), "brush-yellow"),
  P("marks-brush-blue", "Brush Blue", "Marks", lin(180, [["#0c4a6e", 0], ["#082f49", 100]]), "brush-blue"),
  P("marks-brush-pink", "Brush Pink", "Marks", lin(180, [["#4a044e", 0], ["#701a75", 100]]), "brush-pink"),
  P("marks-brush-green", "Brush Green", "Marks", lin(180, [["#052e16", 0], ["#14532d", 100]]), "brush-green"),
  P("marks-brush-violet", "Brush Violet", "Marks", lin(180, [["#2e1065", 0], ["#4c1d95", 100]]), "brush-violet"),
  P("marks-underline", "Underline Scribbles", "Marks", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "underline-scribbles"),
  P("marks-corners", "Corner Marks", "Marks", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "exam-corners"),
  P("marks-formula", "Formula Faint", "Marks", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "formula-faint", true),

  /* ------------------------------- stickers — new ------------------------------- */
  P("stickers-tape-top", "Tape Top", "Stickers", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "tape-top", true),
  P("stickers-tape-scatter", "Tape Scatter", "Stickers", lin(180, [["#ffffff", 0], ["#f8fafc", 100]]), "tape-scatter", true),
  P("stickers-paper-tape", "Paper Tape", "Stickers", lin(180, [["#fefce8", 0], ["#fef9c3", 100]]), "paper-tape", true),
  P("stickers-scatter", "Sticker Scatter", "Stickers", lin(180, [["#f8fafc", 0], ["#e0e7ff", 100]]), "sticker-scatter", true),
  P("stickers-confetti", "Confetti", "Stickers", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "confetti-scatter", true),
  P("stickers-stars", "Star Doodles", "Stickers", lin(180, [["#0f172a", 0], ["#1e293b", 100]]), "doodle-stars"),
  P("stickers-circles", "Circle Doodles", "Stickers", lin(180, [["#0f172a", 0], ["#1e293b", 100]]), "doodle-circles"),
  P("stickers-checks", "Check Doodles", "Stickers", lin(180, [["#052e16", 0], ["#14532d", 100]]), "doodle-checks"),
  P("stickers-arrows", "Arrow Doodles", "Stickers", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "doodle-arrows"),
  P("stickers-yellow-tile", "Yellow Star Tile", "Stickers", lin(180, [["#fefce8", 0], ["#fef08a", 100]]), "star-yellow", true),
  P("stickers-pink-tile", "Pink Star Tile", "Stickers", lin(180, [["#fdf2f8", 0], ["#fbcfe8", 100]]), "star-pink", true),
  P("stickers-slate-star", "Slate Stars", "Stickers", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "star-slate", true),
  P("stickers-confetti-tile", "Confetti Tile", "Stickers", lin(180, [["#ffffff", 0], ["#f8fafc", 100]]), "confetti-tile", true),
  P("stickers-diag-yellow", "Diag Yellow", "Stickers", lin(180, [["#fefce8", 0], ["#fef08a", 100]]), "diag-yellow", true),
  P("stickers-diag-blue", "Diag Blue", "Stickers", lin(180, [["#eff6ff", 0], ["#bfdbfe", 100]]), "diag-blue", true),
  P("stickers-diag-pink", "Diag Pink", "Stickers", lin(180, [["#fdf2f8", 0], ["#fbcfe8", 100]]), "diag-pink", true),
  P("stickers-diag-green", "Diag Green", "Stickers", lin(180, [["#f0fdf4", 0], ["#bbf7d0", 100]]), "diag-green", true),

  /* ------------------------------- doodle — new ------------------------------- */
  P("doodle-circles-dark", "Doodle Circles", "Doodle", lin(180, [["#0f172a", 0], ["#020617", 100]]), "doodle-circles"),
  P("doodle-stars-dark", "Doodle Stars", "Doodle", lin(180, [["#1e1b4b", 0], ["#312e81", 100]]), "doodle-stars"),
  P("doodle-arrows-dark", "Doodle Arrows", "Doodle", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "doodle-arrows"),
  P("doodle-checks-dark", "Doodle Checks", "Doodle", lin(180, [["#052e16", 0], ["#14532d", 100]]), "doodle-checks"),
  P("doodle-confetti", "Confetti Pop", "Doodle", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "confetti-scatter"),
  P("doodle-chalk-arrows", "Chalk Arrows", "Doodle", lin(180, [["#1d3b2f", 0], ["#0e241c", 100]]), "chalk-arrows"),
  P("doodle-grid-dots", "Grid + Dots", "Doodle", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "grid-dots", true),
  P("doodle-cross-grid", "Cross Grid", "Doodle", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "cross-slate", true),
  P("doodle-plus-grid", "Plus Grid", "Doodle", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "plus-slate", true),
  P("doodle-circle-grid", "Circle Grid", "Doodle", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "circle-slate", true),
  P("doodle-highlight-yellow", "Highlight Yellow", "Doodle", lin(180, [["#fefce8", 0], ["#fef9c3", 100]]), "highlight-yellow-tile", true),
  P("doodle-scribble", "Scribble", "Doodle", lin(180, [["#ffffff", 0], ["#f8fafc", 100]]), "scribble-slate", true),

  /* ------------------------------- exam — new ------------------------------- */
  P("exam-red-slate", "Exam Red", "Exam", lin(180, [["#7f1d1d", 0], ["#450a0a", 100]]), "exam-corners"),
  P("exam-blue-slate", "Exam Blue", "Exam", lin(180, [["#1e3a8a", 0], ["#1e1b4b", 100]]), "exam-corners"),
  P("exam-green-slate", "Exam Green", "Exam", lin(180, [["#14532d", 0], ["#052e16", 100]]), "exam-corners"),
  P("exam-violet-slate", "Exam Violet", "Exam", lin(180, [["#4c1d95", 0], ["#2e1065", 100]]), "exam-corners"),
  P("exam-notebook", "Exam Notebook", "Exam", lin(180, [["#ffffff", 0], ["#f1f6fd", 100]]), "notebook", true),
  P("exam-graph", "Exam Graph", "Exam", lin(180, [["#f8fbff", 0], ["#e7effa", 100]]), "graph", true),
  P("exam-grid-dots", "Exam Grid Dots", "Exam", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "grid-dots", true),
  P("exam-formula", "Formula Sheet", "Exam", lin(180, [["#f8fafc", 0], ["#e2e8f0", 100]]), "formula-faint", true),
  P("exam-highlight-yellow", "Focus Yellow", "Exam", lin(180, [["#422006", 0], ["#7c2d12", 100]]), "highlight-yellow"),
  P("exam-highlight-blue", "Focus Blue", "Exam", lin(180, [["#0c4a6e", 0], ["#082f49", 100]]), "highlight-blue"),
  P("exam-highlight-pink", "Focus Pink", "Exam", lin(180, [["#4a044e", 0], ["#701a75", 100]]), "highlight-pink"),
  P("exam-tape", "Exam Tape", "Exam", lin(180, [["#ffffff", 0], ["#fefce8", 100]]), "tape-top", true),
  P("exam-stickers", "Exam Stickers", "Exam", lin(180, [["#f5f3ff", 0], ["#ddd6fe", 100]]), "sticker-scatter", true),
  P("exam-brush-yellow", "Brush Focus Yellow", "Exam", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "brush-yellow"),
  P("exam-brush-blue", "Brush Focus Blue", "Exam", lin(180, [["#0c4a6e", 0], ["#082f49", 100]]), "brush-blue"),

  /* ------------------------------- highlight — new ------------------------------- */
  P("hl-yellow-bg", "Highlighter Yellow", "Highlight", lin(180, [["#fefce8", 0], ["#fef9c3", 100]]), "highlight-yellow", true),
  P("hl-pink-bg", "Highlighter Pink", "Highlight", lin(180, [["#fdf2f8", 0], ["#fce7f3", 100]]), "highlight-pink", true),
  P("hl-blue-bg", "Highlighter Blue", "Highlight", lin(180, [["#f0f9ff", 0], ["#e0f2fe", 100]]), "highlight-blue", true),
  P("hl-green-bg", "Highlighter Green", "Highlight", lin(180, [["#f0fdf4", 0], ["#dcfce7", 100]]), "highlight-green", true),
  P("hl-violet-bg", "Highlighter Violet", "Highlight", lin(180, [["#f5f3ff", 0], ["#ede9fe", 100]]), "highlight-violet", true),
  P("hl-yellow-dark", "Yellow Sweep Dark", "Highlight", lin(180, [["#422006", 0], ["#7c2d12", 100]]), "highlight-yellow"),
  P("hl-blue-dark", "Blue Sweep Dark", "Highlight", lin(180, [["#0c4a6e", 0], ["#082f49", 100]]), "highlight-blue"),
  P("hl-pink-dark", "Pink Sweep Dark", "Highlight", lin(180, [["#4a044e", 0], ["#701a75", 100]]), "highlight-pink"),
  P("hl-brush-yellow", "Brush Yellow Dark", "Highlight", lin(180, [["#1c1917", 0], ["#292524", 100]]), "brush-yellow"),
  P("hl-brush-blue", "Brush Blue Dark", "Highlight", lin(180, [["#0c4a6e", 0], ["#082f49", 100]]), "brush-blue"),
  P("hl-underline", "Underline Marks", "Highlight", lin(180, [["#1e293b", 0], ["#0f172a", 100]]), "underline-scribbles"),
  P("hl-tape", "Tape Marks", "Highlight", lin(180, [["#ffffff", 0], ["#f8fafc", 100]]), "tape-scatter", true),
  P("hl-confetti", "Confetti Pop", "Highlight", lin(180, [["#ffffff", 0], ["#f1f5f9", 100]]), "confetti-scatter", true),
];
