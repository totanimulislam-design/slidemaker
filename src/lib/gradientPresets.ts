import type { GradientStop, GradientType } from "./types";

/**
 * Ready-made gradients for the background gradient editor (and anywhere else
 * a gradient library is useful). Each preset carries its own type, angle and
 * radial centre so one click reproduces the look exactly.
 */
export interface GradientPresetDef {
  name: string;
  category: string;
  type: GradientType;
  angle: number;
  cx?: number;
  cy?: number;
  stops: GradientStop[];
}

export const GRADIENT_CATEGORIES = [
  "Pastel",
  "Blue",
  "Purple",
  "Pink",
  "Teal",
  "Green",
  "Warm",
  "Dark",
  "Sunset",
  "Mesh",
] as const;

const g = (
  name: string,
  category: (typeof GRADIENT_CATEGORIES)[number],
  type: GradientType,
  angle: number,
  stops: [string, number][],
  cx?: number,
  cy?: number,
): GradientPresetDef => ({
  name,
  category,
  type,
  angle,
  cx,
  cy,
  stops: stops.map(([color, at]) => ({ color, at })),
});

export const GRADIENT_PRESETS: GradientPresetDef[] = [
  /* ------------------------------- pastel ------------------------------ */
  g("Cotton Candy", "Pastel", "linear", 135, [["#ffe4ec", 0], ["#e9d5ff", 50], ["#cffafe", 100]]),
  g("Peach Sorbet", "Pastel", "linear", 150, [["#fff7ed", 0], ["#fed7aa", 52], ["#fbcfe8", 100]]),
  g("Mint Whisper", "Pastel", "linear", 140, [["#f0fdf4", 0], ["#bbf7d0", 55], ["#bae6fd", 100]]),

  /* ----------------------------- blue/indigo ---------------------------- */
  g("Royal Blue", "Blue", "linear", 135, [["#1e3a8a", 0], ["#2563eb", 55], ["#60a5fa", 100]]),
  g("Midnight Indigo", "Blue", "linear", 165, [["#0b1026", 0], ["#1e1b4b", 60], ["#3730a3", 100]]),
  g("Sky Drift", "Blue", "linear", 180, [["#e0f2fe", 0], ["#7dd3fc", 55], ["#2563eb", 100]]),

  /* ----------------------------- purple/violet --------------------------- */
  g("Violet Dream", "Purple", "linear", 135, [["#4c1d95", 0], ["#7c3aed", 50], ["#c4b5fd", 100]]),
  g("Grape Glow", "Purple", "radial", 0, [["#a855f7", 0], ["#6d28d9", 55], ["#2e1065", 100]], 50, 38),
  g("Orchid Haze", "Purple", "linear", 150, [["#fae8ff", 0], ["#e9a8f2", 50], ["#a855f7", 100]]),

  /* --------------------------------- pink -------------------------------- */
  g("Rose Bloom", "Pink", "linear", 140, [["#fff1f2", 0], ["#fda4af", 50], ["#e11d48", 100]]),
  g("Magenta Pop", "Pink", "linear", 120, [["#831843", 0], ["#db2777", 55], ["#f9a8d4", 100]]),

  /* ------------------------------- teal/cyan ------------------------------ */
  g("Lagoon", "Teal", "linear", 135, [["#134e4a", 0], ["#0d9488", 50], ["#5eead4", 100]]),
  g("Arctic Cyan", "Teal", "radial", 0, [["#cffafe", 0], ["#22d3ee", 55], ["#0e7490", 100]], 50, 35),
  g("Deep Teal", "Teal", "linear", 160, [["#083344", 0], ["#0e7490", 60], ["#22d3ee", 100]]),

  /* --------------------------------- green -------------------------------- */
  g("Emerald Field", "Green", "linear", 150, [["#052e16", 0], ["#059669", 55], ["#6ee7b7", 100]]),
  g("Lime Fresh", "Green", "linear", 130, [["#f7fee7", 0], ["#bef264", 50], ["#4ade80", 100]]),

  /* ------------------------------- orange/warm ---------------------------- */
  g("Amber Glow", "Warm", "linear", 140, [["#451a03", 0], ["#ea580c", 55], ["#fbbf24", 100]]),
  g("Coral Warmth", "Warm", "linear", 135, [["#fff7ed", 0], ["#fdba74", 50], ["#f43f5e", 100]]),

  /* ------------------------------ dark premium ---------------------------- */
  g("Onyx", "Dark", "linear", 165, [["#0b0d12", 0], ["#161b26", 55], ["#232b3d", 100]]),
  g("Espresso Gold", "Dark", "linear", 150, [["#1c1410", 0], ["#6b4a2a", 50], ["#d99a2b", 100]]),
  g("Noir Violet", "Dark", "radial", 0, [["#3b2a63", 0], ["#1e1b4b", 55], ["#050508", 100]], 50, 30),

  /* --------------------------------- sunset ------------------------------- */
  g("Sunset Boulevard", "Sunset", "linear", 180, [["#312e81", 0], ["#be185d", 50], ["#fb923c", 100]]),
  g("Golden Hour", "Sunset", "linear", 160, [["#7c2d12", 0], ["#ea580c", 45], ["#fde68a", 100]]),
  g("Dusk Rose", "Sunset", "linear", 170, [["#1e1b4b", 0], ["#a21caf", 50], ["#f0abfc", 100]]),

  /* ------------------------------ mesh-style ------------------------------ */
  g("Mesh Aurora", "Mesh", "mesh", 0, [["#1e1b4b", 0], ["#7c3aed", 35], ["#22d3ee", 65], ["#4ade80", 100]]),
  g("Mesh Sunset", "Mesh", "mesh", 0, [["#431407", 0], ["#f97316", 35], ["#ec4899", 65], ["#fbbf24", 100]]),
  g("Mesh Lagoon", "Mesh", "mesh", 0, [["#082f49", 0], ["#22d3ee", 35], ["#34d399", 65], ["#818cf8", 100]]),
];
