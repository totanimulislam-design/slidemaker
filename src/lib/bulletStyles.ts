import type { Gradient, ShapeEffectKind, ThemeSettings } from "./types";
import type { NumberBorderStyle } from "./types";

/**
 * One-click looks for the question marker — the designs the Bullet design
 * card's **Bullet point presets** tab lists after the classic bullet points
 * and the numbering formats (`lib/numberStyles`).
 *
 * A look here is nothing but a set of the marker's own channels written
 * together: the silhouette it wears, its fill (solid or gradient), its line
 * (colour, style, weight), its corners, its transparency and the shape effect
 * on top. Picking one writes all of them at once, so a teacher can go from "a
 * plain blue circle" to "a gold seal with a bevel" in one click and then
 * fine-tune any single channel from the toolbar — or swap the silhouette alone
 * on the **Shape** tab, which changes `numberStyle` and leaves the paint be.
 *
 * The list opens with the shape-led families — **Geometric** (hexagon,
 * octagon, diamond, pentagon, triangle, kite, plinth, arrow, slant, plus,
 * speech bubble, bookmark) and **Organic** (cloud, drop, blob, sparkle, heart,
 * bubble, wavy sun) — each silhouette dressed in the paint it is usually seen
 * in. The rest are the looks exam papers, coaching slides, workbooks and the
 * big design tools keep reaching for — the classic rimmed disc, the
 * chalk-dashed circle, the crimson capsule, the die-cut sticker, the neon
 * tube, the gold rosette, the midnight-and-gold card, the material / 3-D
 * badge — and the **Infographic** row the stock libraries are full of: flat
 * directional pointers, line markers, gradient orbs, target rings and petal
 * badges. Every look is an original combination of the marker's own channels,
 * collected from those conventions rather than copied from any one product.
 */

export type BulletStyleGroup =
  | "Geometric"
  | "Organic"
  | "Exam classic"
  | "Soft & minimal"
  | "Bold sticker"
  | "Neon & glow"
  | "Medal & seal"
  | "Dark & gold"
  | "3-D & depth"
  | "Hand drawn"
  | "Infographic";

export const BULLET_STYLE_GROUPS: BulletStyleGroup[] = [
  "Geometric",
  "Organic",
  "Exam classic",
  "Soft & minimal",
  "Bold sticker",
  "Neon & glow",
  "Medal & seal",
  "Dark & gold",
  "3-D & depth",
  "Hand drawn",
  "Infographic",
];

/** the marker channels one style writes */
export interface BulletStylePatch {
  numberStyle?: string;
  bulletFill?: string;
  bulletFillGradient?: Gradient;
  bulletBorder?: string;
  bulletBorderGradient?: Gradient;
  bulletBorderStyle?: NumberBorderStyle;
  bulletBorderWeight?: number;
  bulletRadius?: number;
  bulletOpacity?: number;
  bulletEffect?: ShapeEffectKind;
  bulletEffectIntensity?: number;
  bulletEffectColor?: string;
}

export interface BulletStyle {
  id: string;
  label: string;
  group: BulletStyleGroup;
  hint: string;
  patch: BulletStylePatch;
}

const grad = (angle: number, ...colors: string[]): Gradient => ({
  enabled: true,
  type: "linear",
  angle,
  stops: colors.map((c, i) => ({ color: c, at: Math.round((i / Math.max(1, colors.length - 1)) * 100) })),
});

const radial = (cx: number, cy: number, ...colors: string[]): Gradient => ({
  enabled: true,
  type: "radial",
  angle: 0,
  cx,
  cy,
  stops: colors.map((c, i) => ({ color: c, at: Math.round((i / Math.max(1, colors.length - 1)) * 100) })),
});

/** a style that paints nothing of its own beyond the design */
const plain: BulletStylePatch = {
  bulletFill: "",
  bulletFillGradient: undefined,
  bulletBorder: "",
  bulletBorderGradient: undefined,
  bulletBorderStyle: "auto",
  bulletBorderWeight: undefined,
  bulletRadius: undefined,
  bulletOpacity: 100,
  bulletEffect: undefined,
  bulletEffectIntensity: undefined,
  bulletEffectColor: undefined,
};

const style = (
  id: string,
  label: string,
  group: BulletStyleGroup,
  hint: string,
  patch: BulletStylePatch,
): BulletStyle => ({ id, label, group, hint, patch: { ...plain, ...patch } });

export const BULLET_STYLES: BulletStyle[] = [
  /* ---------------------------------------------------------- geometric -- */
  style("hexTile", "Hex tile", "Geometric", "A teal hexagon tile with a pale rim", {
    numberStyle: "hexagon",
    bulletFillGradient: grad(150, "#2dd4bf", "#0f766e"),
    bulletBorder: "#ccfbf1",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "lift",
    bulletEffectIntensity: 45,
  }),
  style("octagonStop", "Octagon stop", "Geometric", "The stop-sign octagon in red with a white rim", {
    numberStyle: "octagon",
    bulletFill: "#dc2626",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2.5,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("diamondStud", "Diamond stud", "Geometric", "A bevelled diamond, sky to indigo", {
    numberStyle: "diamond",
    bulletFillGradient: grad(135, "#7dd3fc", "#4338ca"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "bevel",
    bulletEffectIntensity: 55,
  }),
  style("pentagonBadge", "Pentagon badge", "Geometric", "An amber pentagon badge", {
    numberStyle: "pentagon",
    bulletFillGradient: grad(160, "#fbbf24", "#b45309"),
    bulletBorder: "#fff7ed",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("triangleFlag", "Triangle flag", "Geometric", "An orange triangle with a hard shadow", {
    numberStyle: "triangle",
    bulletFill: "#f97316",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "pop",
    bulletEffectColor: "#7c2d12",
    bulletEffectIntensity: 30,
  }),
  style("violetKite", "Violet kite", "Geometric", "A tall kite in violet that glows", {
    numberStyle: "kite",
    bulletFillGradient: grad(160, "#c084fc", "#6b21a8"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "glow",
    bulletEffectColor: "#d8b4fe",
    bulletEffectIntensity: 45,
  }),
  style("slatePlinth", "Plinth", "Geometric", "A slate trapezoid with a gold rim", {
    numberStyle: "trapezoid",
    bulletFill: "#334155",
    bulletBorder: "#fbbf24",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "innerShadow",
    bulletEffectIntensity: 40,
  }),
  style("arrowStep", "Arrow step", "Geometric", "A green arrow pointing at the question", {
    numberStyle: "arrowRight",
    bulletFillGradient: grad(90, "#4ade80", "#15803d"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "lift",
    bulletEffectIntensity: 45,
  }),
  style("slantStripe", "Slant stripe", "Geometric", "A blue parallelogram with a long shadow", {
    numberStyle: "slant",
    bulletFillGradient: grad(120, "#60a5fa", "#1d4ed8"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "longShadow",
    bulletEffectColor: "#1e3a8a",
    bulletEffectIntensity: 50,
  }),
  style("plusBlock", "Plus block", "Geometric", "A rose plus block with a white rim", {
    numberStyle: "cross",
    bulletFill: "#f43f5e",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("speechBubble", "Speech bubble", "Geometric", "A sky-blue speech bubble with a hard shadow", {
    numberStyle: "speech",
    bulletFill: "#0ea5e9",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "pop",
    bulletEffectColor: "#0c4a6e",
    bulletEffectIntensity: 30,
  }),
  style("bookmarkRed", "Bookmark", "Geometric", "A red bookmark tab", {
    numberStyle: "bookmark",
    bulletFillGradient: grad(180, "#f87171", "#b91c1c"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),

  /* ------------------------------------------------------------ organic -- */
  style("softCloud", "Soft cloud", "Organic", "A blue cloud floating on a soft shadow", {
    numberStyle: "cloud",
    bulletFillGradient: grad(180, "#93c5fd", "#3b82f6"),
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "float",
    bulletEffectIntensity: 35,
  }),
  style("aquaDrop", "Aqua drop", "Organic", "A glossy cyan drop", {
    numberStyle: "drop",
    bulletFillGradient: grad(170, "#22d3ee", "#0e7490"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "gloss",
    bulletEffectIntensity: 50,
  }),
  style("coralBlob", "Coral blob", "Organic", "A hand-pulled blob in coral", {
    numberStyle: "blob",
    bulletFillGradient: grad(140, "#fb7185", "#be123c"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "lift",
    bulletEffectIntensity: 45,
  }),
  style("mintSparkle", "Mint sparkle", "Organic", "A four-point glint in mint", {
    numberStyle: "sparkle",
    bulletFillGradient: grad(150, "#6ee7b7", "#047857"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "glow",
    bulletEffectColor: "#a7f3d0",
    bulletEffectIntensity: 40,
  }),
  style("roseHeart", "Rose heart", "Organic", "A rose heart with a pale rim", {
    numberStyle: "heart",
    bulletFillGradient: grad(160, "#f472b6", "#be185d"),
    bulletBorder: "#fff1f2",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("skyBubble", "Sky bubble", "Organic", "A round speech bubble in deep sky", {
    numberStyle: "bubbleRound",
    bulletFill: "#0284c7",
    bulletBorder: "#e0f2fe",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "pop",
    bulletEffectColor: "#0c4a6e",
    bulletEffectIntensity: 30,
  }),
  style("wavySun", "Wavy sun", "Organic", "A rippled sun in amber that glows", {
    numberStyle: "wavy",
    bulletFillGradient: grad(150, "#fcd34d", "#d97706"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "glow",
    bulletEffectColor: "#fde68a",
    bulletEffectIntensity: 40,
  }),

  /* ------------------------------------------------------- exam classic -- */
  style("classicDisc", "Classic disc", "Exam classic", "The rimmed disc every question paper wears", {
    numberStyle: "circle",
    bulletFillGradient: radial(34, 28, "#5b7cfa", "#1f3fd0"),
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 3,
    bulletEffect: "shadow",
    bulletEffectIntensity: 35,
  }),
  style("navyGold", "Navy & gold", "Exam classic", "A board-exam card with a gold rim", {
    numberStyle: "rounded",
    bulletFill: "#0f2a5f",
    bulletBorder: "#ffd633",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2.5,
    bulletRadius: 10,
    bulletEffect: "innerShadow",
    bulletEffectIntensity: 40,
  }),
  style("crimsonPill", "Crimson capsule", "Exam classic", "A red capsule with a hard shadow", {
    numberStyle: "pill",
    bulletFillGradient: grad(135, "#ff4d4d", "#c81e1e"),
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "pop",
    bulletEffectColor: "#7f0c10",
    bulletEffectIntensity: 30,
  }),
  style("steelCard", "Steel card", "Exam classic", "Steel blue with a white rim", {
    numberStyle: "rounded",
    bulletFill: "#3a6186",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletRadius: 10,
    bulletEffect: "shadow",
    bulletEffectIntensity: 45,
  }),
  style("emeraldTicket", "Emerald ticket", "Exam classic", "A notched ticket in lab green", {
    numberStyle: "ticket",
    bulletFillGradient: grad(160, "#22c55e", "#0b6b33"),
    bulletBorder: "#eafff1",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "lift",
    bulletEffectIntensity: 50,
  }),
  style("violetTab", "Violet tab", "Exam classic", "An electric-violet capsule that glows", {
    numberStyle: "pill",
    bulletFillGradient: grad(135, "#a936f5", "#6d1fd6"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "glow",
    bulletEffectColor: "#c084fc",
    bulletEffectIntensity: 45,
  }),
  style("skyShield", "Sky shield", "Exam classic", "A dodger-blue crest with a navy base", {
    numberStyle: "shield",
    bulletFillGradient: grad(180, "#39b0f9", "#1e3a8a"),
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("chevronRed", "Crimson chevron", "Exam classic", "A step in a sequence, hard shadow", {
    numberStyle: "step",
    bulletFill: "#eb2026",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "pop",
    bulletEffectColor: "#7f0c10",
    bulletEffectIntensity: 28,
  }),

  /* ------------------------------------------------------ soft & minimal -- */
  style("softTint", "Soft tint", "Soft & minimal", "A pale wash of the accent, no rim", {
    numberStyle: "circle",
    bulletFill: "#ffffff",
    bulletOpacity: 22,
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: undefined,
  }),
  style("whisperLine", "Whisper line", "Soft & minimal", "No fill at all — a hairline rim", {
    numberStyle: "circle",
    bulletFill: "transparent",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
  }),
  style("pastelSquircle", "Pastel squircle", "Soft & minimal", "An app-icon square in a soft tint", {
    numberStyle: "squircle",
    bulletFillGradient: grad(150, "#e0e7ff", "#a5b4fc"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "lift",
    bulletEffectIntensity: 40,
  }),
  style("glassCapsule", "Glass capsule", "Soft & minimal", "Frosted glass over the slide", {
    numberStyle: "pill",
    bulletFill: "#ffffff",
    bulletOpacity: 34,
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "glass",
    bulletEffectIntensity: 60,
  }),
  style("mistCard", "Mist card", "Soft & minimal", "A quiet grey card with a soft shadow", {
    numberStyle: "rounded",
    bulletFill: "#e2e8f0",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletRadius: 12,
    bulletEffect: "float",
    bulletEffectIntensity: 30,
  }),
  style("paperStack", "Paper stack", "Soft & minimal", "Two paper copies stacked behind", {
    numberStyle: "rounded",
    bulletFill: "#f8fafc",
    bulletBorder: "#cbd5e1",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1,
    bulletRadius: 8,
    bulletEffect: "stack",
    bulletEffectColor: "#94a3b8",
    bulletEffectIntensity: 45,
  }),
  style("leafMint", "Mint leaf", "Soft & minimal", "A mint leaf, quietly lifted", {
    numberStyle: "leaf",
    bulletFillGradient: grad(140, "#6ee7b7", "#059669"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "lift",
    bulletEffectIntensity: 45,
  }),

  /* -------------------------------------------------------- bold sticker -- */
  style("dieCutSticker", "Die-cut sticker", "Bold sticker", "A thick pale outline all round", {
    numberStyle: "circle",
    bulletFillGradient: grad(140, "#f472b6", "#db2777"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "sticker",
    bulletEffectColor: "#ffffff",
    bulletEffectIntensity: 55,
  }),
  style("popArt", "Pop art", "Bold sticker", "White face, black frame, hard shadow", {
    numberStyle: "square",
    bulletFill: "#ffffff",
    bulletBorder: "#0f172a",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 3,
    bulletEffect: "pop",
    bulletEffectColor: "#0f172a",
    bulletEffectIntensity: 45,
  }),
  style("comicBurst", "Comic burst", "Bold sticker", "A starburst with a hard offset shadow", {
    numberStyle: "sunburst",
    bulletFillGradient: grad(150, "#fde047", "#f59e0b"),
    bulletBorder: "#7c2d12",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "pop",
    bulletEffectColor: "#7c2d12",
    bulletEffectIntensity: 35,
  }),
  style("kraftTag", "Kraft tag", "Bold sticker", "A paper tag with a soft shadow", {
    numberStyle: "tag",
    bulletFill: "#d6b48d",
    bulletBorder: "#8a6a45",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("tapeStrip", "Tape strip", "Bold sticker", "A strip of tape across the corner", {
    numberStyle: "washi",
    bulletFill: "#93c5fd",
    bulletOpacity: 82,
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "lift",
    bulletEffectIntensity: 35,
  }),
  style("longShadow", "Flat long shadow", "Bold sticker", "A material-style stepped shadow", {
    numberStyle: "rounded",
    bulletFill: "#3b82f6",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletRadius: 10,
    bulletEffect: "longShadow",
    bulletEffectColor: "#1e3a8a",
    bulletEffectIntensity: 60,
  }),
  style("stripeTicket", "Striped stub", "Bold sticker", "Fine stripes over an admission stub", {
    numberStyle: "coupon",
    bulletFill: "#f97316",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "stripes",
    bulletEffectColor: "#ffffff",
    bulletEffectIntensity: 30,
  }),
  style("boltSticker", "Bolt sticker", "Bold sticker", "A lightning flash with a neon edge", {
    numberStyle: "bolt",
    bulletFillGradient: grad(180, "#fef08a", "#f59e0b"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "sticker",
    bulletEffectColor: "#1f2937",
    bulletEffectIntensity: 45,
  }),

  /* ------------------------------------------------------------ neon & glow -- */
  style("neonTube", "Neon tube", "Neon & glow", "No fill — a glowing tube rim", {
    numberStyle: "ring",
    bulletFill: "transparent",
    bulletBorder: "#22d3ee",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 3,
    bulletEffect: "neon",
    bulletEffectColor: "#22d3ee",
    bulletEffectIntensity: 60,
  }),
  style("glowDisc", "Glow disc", "Neon & glow", "A flat disc lit from behind", {
    numberStyle: "disc",
    bulletFill: "#6366f1",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "glow",
    bulletEffectColor: "#818cf8",
    bulletEffectIntensity: 60,
  }),
  style("haloCoin", "Halo coin", "Neon & glow", "A wide soft halo around a coin", {
    numberStyle: "coin",
    bulletFillGradient: radial(34, 26, "#fde68a", "#d97706"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "halo",
    bulletEffectColor: "#fbbf24",
    bulletEffectIntensity: 55,
  }),
  style("cyberHex", "Cyber hex", "Neon & glow", "A teal hexagon with a cyan glow", {
    numberStyle: "hexagon",
    bulletFill: "#0e7490",
    bulletBorder: "#67e8f9",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "glow",
    bulletEffectColor: "#22d3ee",
    bulletEffectIntensity: 50,
  }),
  style("uvPill", "UV capsule", "Neon & glow", "A violet gradient with an inner glow", {
    numberStyle: "pill",
    bulletFillGradient: grad(120, "#7c3aed", "#db2777"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "innerGlow",
    bulletEffectColor: "#f0abfc",
    bulletEffectIntensity: 50,
  }),
  style("spotlightSlate", "Spotlight slate", "Neon & glow", "A slate disc lit from the middle", {
    numberStyle: "circle",
    bulletFill: "#0f172a",
    bulletBorder: "#334155",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "spotlight",
    bulletEffectIntensity: 60,
  }),

  /* ----------------------------------------------------------- medal & seal -- */
  style("goldSeal", "Gold seal", "Medal & seal", "A bevelled gold rosette", {
    numberStyle: "scallop",
    bulletFillGradient: grad(180, "#fff1b8", "#facc15", "#b8860b"),
    bulletBorder: "#7a5300",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "bevel",
    bulletEffectIntensity: 55,
  }),
  style("awardRosette", "Award rosette", "Medal & seal", "A first-place rosette, lifted", {
    numberStyle: "rosette",
    bulletFillGradient: radial(38, 30, "#fca5a5", "#dc2626"),
    bulletBorder: "#fff7ed",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "shadow",
    bulletEffectIntensity: 45,
  }),
  style("medalRibbon", "Medal ribbon", "Medal & seal", "A seal with two ribbon tails", {
    numberStyle: "medal",
    bulletFillGradient: grad(160, "#fde68a", "#f59e0b", "#b45309"),
    bulletBorder: "#78350f",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "gloss",
    bulletEffectIntensity: 50,
  }),
  style("certBurst", "Certificate burst", "Medal & seal", "A certification burst with an inner glow", {
    numberStyle: "burst",
    bulletFillGradient: radial(50, 40, "#f8fafc", "#94a3b8"),
    bulletBorder: "#475569",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "innerGlow",
    bulletEffectColor: "#ffffff",
    bulletEffectIntensity: 45,
  }),
  style("embossedCoin", "Embossed coin", "Medal & seal", "A struck coin, embossed", {
    numberStyle: "coin",
    bulletFillGradient: radial(34, 26, "#f1f5f9", "#94a3b8"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "emboss",
    bulletEffectIntensity: 55,
  }),
  style("starGold", "Gold star", "Medal & seal", "An achievement star in gold", {
    numberStyle: "star",
    bulletFillGradient: grad(150, "#fef08a", "#eab308"),
    bulletBorder: "#a16207",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "glow",
    bulletEffectColor: "#fde047",
    bulletEffectIntensity: 40,
  }),
  style("capSealWax", "Wax cap seal", "Medal & seal", "A serrated cap seal in wax red", {
    numberStyle: "capSeal",
    bulletFillGradient: radial(40, 32, "#b91c1c", "#7f1d1d"),
    bulletBorder: "#fecaca",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1,
    bulletEffect: "bevel",
    bulletEffectIntensity: 45,
  }),

  /* ------------------------------------------------------------ dark & gold -- */
  style("midnightGold", "Midnight gold", "Dark & gold", "Midnight card, double gold rim", {
    numberStyle: "rounded",
    bulletFill: "#0b1220",
    bulletBorder: "#d4af37",
    bulletBorderStyle: "double",
    bulletBorderWeight: 4,
    bulletRadius: 10,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("blackGloss", "Black gloss", "Dark & gold", "A glossy black pill", {
    numberStyle: "pill",
    bulletFillGradient: grad(180, "#3f3f46", "#09090b"),
    bulletBorder: "#fbbf24",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "gloss",
    bulletEffectIntensity: 60,
  }),
  style("bronzeGear", "Bronze gear", "Dark & gold", "A bronze cog with a warm sheen", {
    numberStyle: "gear",
    bulletFillGradient: grad(140, "#d9a066", "#8a5a2b"),
    bulletBorder: "#f5deb3",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1,
    bulletEffect: "sheen",
    bulletEffectIntensity: 50,
  }),
  style("metalMaterial", "Brushed metal", "Dark & gold", "A layered metal face", {
    numberStyle: "squircle",
    bulletFillGradient: grad(180, "#f8fafc", "#94a3b8", "#475569"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "material",
    bulletEffectIntensity: 55,
  }),
  style("obsidianRing", "Obsidian ring", "Dark & gold", "A dark ring with a gold rim", {
    numberStyle: "doubleRing",
    bulletFill: "#111827",
    bulletBorder: "#fbbf24",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "innerShadow",
    bulletEffectIntensity: 45,
  }),

  /* ------------------------------------------------------------- 3-D & depth -- */
  style("tilt3d", "3-D tilt", "3-D & depth", "Tilted in perspective with an extruded lip", {
    numberStyle: "rounded",
    bulletFillGradient: grad(160, "#60a5fa", "#1d4ed8"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletRadius: 12,
    bulletEffect: "threeD",
    bulletEffectIntensity: 55,
  }),
  style("reflected", "Reflection", "3-D & depth", "A mirrored copy fading below", {
    numberStyle: "squircle",
    bulletFillGradient: grad(150, "#f472b6", "#7c3aed"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "reflection",
    bulletEffectIntensity: 50,
  }),
  style("bevelCube", "Bevel cube", "3-D & depth", "A raised cube with lit and shaded edges", {
    numberStyle: "square",
    bulletFill: "#38bdf8",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "bevel",
    bulletEffectIntensity: 60,
  }),
  style("perspectiveCard", "Perspective card", "3-D & depth", "A card with a shadow thrown forward", {
    numberStyle: "rounded",
    bulletFill: "#f43f5e",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletRadius: 10,
    bulletEffect: "perspective",
    bulletEffectIntensity: 55,
  }),
  style("softEdgesDisc", "Soft edges", "3-D & depth", "The silhouette's edge feathered away", {
    numberStyle: "disc",
    bulletFillGradient: radial(50, 50, "#a78bfa", "#6d28d9"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "softEdges",
    bulletEffectIntensity: 45,
  }),

  /* ------------------------------------------------------------- hand drawn -- */
  style("chalkCircle", "Chalk circle", "Hand drawn", "Blackboard green with a chalk-dashed rim", {
    numberStyle: "circle",
    bulletFill: "#1f3b2d",
    bulletBorder: "#e2e8f0",
    bulletBorderStyle: "dashed",
    bulletBorderWeight: 2.5,
    bulletEffect: undefined,
  }),
  style("dottedRing", "Dotted ring", "Hand drawn", "A hand-drawn dotted circle", {
    numberStyle: "dottedRing",
    bulletFill: "",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: undefined,
  }),
  style("sketchOffset", "Sketch offset", "Hand drawn", "A white face with an offset pencil line", {
    numberStyle: "circle",
    bulletFill: "#ffffff",
    bulletBorder: "#0f172a",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "offsetOutline",
    bulletEffectColor: "#0f172a",
    bulletEffectIntensity: 45,
  }),
  style("notebookDots", "Notebook dots", "Hand drawn", "The number over three small dots", {
    numberStyle: "dots3",
    bulletFill: "",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: undefined,
  }),
  style("bracketRule", "Bracket rule", "Hand drawn", "Two rules holding the number", {
    numberStyle: "brackets",
    bulletFill: "",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: undefined,
  }),
  style("wavySticker", "Wavy sticker", "Hand drawn", "A sticker whose edge ripples", {
    numberStyle: "wavy",
    bulletFillGradient: grad(140, "#fbcfe8", "#f472b6"),
    bulletBorder: "#9d174d",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "sticker",
    bulletEffectColor: "#fff1f2",
    bulletEffectIntensity: 40,
  }),
  style("cornerFoldNote", "Folded note", "Hand drawn", "A sticky note with a folded corner", {
    numberStyle: "square",
    bulletFill: "#fde68a",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "cornerFold",
    bulletEffectIntensity: 55,
  }),
  style("stampInk", "Ink stamp", "Hand drawn", "A perforated stamp in ink blue", {
    numberStyle: "stamp",
    bulletFill: "#1e3a8a",
    bulletBorder: "#bfdbfe",
    bulletBorderStyle: "dotted",
    bulletBorderWeight: 2,
    bulletEffect: "lift",
    bulletEffectIntensity: 40,
  }),

  /* ------------------------------------------------------------ infographic -- */
  style("gradientOrb", "Gradient orb", "Infographic", "A violet-to-pink orb with a white rim", {
    numberStyle: "circle",
    bulletFillGradient: grad(135, "#8b5cf6", "#ec4899"),
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "gloss",
    bulletEffectIntensity: 55,
  }),
  style("lineCircle", "Line circle", "Infographic", "No fill — a clean white line ring", {
    numberStyle: "ring",
    bulletFill: "transparent",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2.5,
    bulletEffect: "float",
    bulletEffectIntensity: 35,
  }),
  style("blockPointer", "Block pointer", "Infographic", "A flat block arrow in sky blue", {
    numberStyle: "blockRight",
    bulletFillGradient: grad(90, "#38bdf8", "#1d4ed8"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "lift",
    bulletEffectIntensity: 45,
  }),
  style("diamondList", "Diamond list", "Infographic", "A flat teal diamond with a white rim", {
    numberStyle: "diamond",
    bulletFill: "#14b8a6",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("markerDown", "Marker down", "Infographic", "An amber triangle pointing down, hard shadow", {
    numberStyle: "triangleDown",
    bulletFillGradient: grad(180, "#fbbf24", "#d97706"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "pop",
    bulletEffectColor: "#92400e",
    bulletEffectIntensity: 30,
  }),
  style("candyStripe", "Candy stripe", "Infographic", "White stripes over a pink capsule", {
    numberStyle: "pill",
    bulletFill: "#ec4899",
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "stripes",
    bulletEffectColor: "#ffffff",
    bulletEffectIntensity: 30,
  }),
  style("glossyOrb", "Glossy orb", "Infographic", "A lit indigo sphere with a gloss", {
    numberStyle: "disc",
    bulletFillGradient: radial(34, 28, "#c7d2fe", "#4f46e5"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "gloss",
    bulletEffectIntensity: 60,
  }),
  style("magentaRing", "Magenta ring", "Infographic", "No fill — a glowing magenta tube rim", {
    numberStyle: "ring",
    bulletFill: "transparent",
    bulletBorder: "#f0abfc",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 3,
    bulletEffect: "neon",
    bulletEffectColor: "#e879f9",
    bulletEffectIntensity: 60,
  }),
  style("targetRings", "Target rings", "Infographic", "A bullseye in the deck's own accent", {
    numberStyle: "target",
    bulletEffect: "lift",
    bulletEffectIntensity: 45,
  }),
  style("starSticker", "Star sticker", "Infographic", "A yellow star with a pale sticker outline", {
    numberStyle: "star",
    bulletFill: "#facc15",
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "sticker",
    bulletEffectColor: "#ffffff",
    bulletEffectIntensity: 55,
  }),
  style("ribbonTab", "Ribbon tab", "Infographic", "A rose award ribbon with a white rim", {
    numberStyle: "ribbon",
    bulletFillGradient: grad(160, "#fb7185", "#be123c"),
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 1.5,
    bulletEffect: "shadow",
    bulletEffectIntensity: 40,
  }),
  style("petalBadge", "Petal badge", "Infographic", "A six-petal flower that glows pink", {
    numberStyle: "flower",
    bulletFillGradient: grad(150, "#f9a8d4", "#db2777"),
    bulletBorder: "",
    bulletBorderStyle: "none",
    bulletEffect: "glow",
    bulletEffectColor: "#f9a8d4",
    bulletEffectIntensity: 40,
  }),
  style("halfDome", "Half dome", "Infographic", "A half-circle marker in sunset orange", {
    numberStyle: "dome",
    bulletFillGradient: grad(180, "#fdba74", "#ea580c"),
    bulletBorder: "#ffffff",
    bulletBorderStyle: "solid",
    bulletBorderWeight: 2,
    bulletEffect: "innerShadow",
    bulletEffectIntensity: 40,
  }),
];

export const BULLET_STYLE_BY_ID = new Map(BULLET_STYLES.map((s) => [s.id, s]));

/** the style a deck is wearing, or "" once a channel has been hand-tuned */
export function bulletStyleOf(theme: ThemeSettings): string {
  const id = theme.bulletStylePreset;
  if (!id) return "";
  const preset = BULLET_STYLE_BY_ID.get(id);
  if (!preset) return "";
  /* the tile stops claiming the look as soon as one of its channels is edited */
  const keys: (keyof BulletStylePatch)[] = [
    "numberStyle",
    "bulletFill",
    "bulletBorder",
    "bulletBorderStyle",
    "bulletBorderWeight",
    "bulletRadius",
    "bulletOpacity",
    "bulletEffect",
  ];
  for (const k of keys) {
    const want = preset.patch[k];
    const have = theme[k as keyof ThemeSettings];
    if ((want ?? undefined) !== (have ?? undefined)) return "";
  }
  return id;
}

/** what one style writes, with the preset id attached (hand-tuning clears it) */
export function bulletStylePatch(preset: BulletStyle): Partial<ThemeSettings> {
  return { ...preset.patch, bulletStylePreset: preset.id } as Partial<ThemeSettings>;
}

