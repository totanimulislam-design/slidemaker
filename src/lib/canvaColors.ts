/**
 * Canva-style color palettes.
 *
 * - Solid: default set (~40) + full library (~200+) organized by hue families.
 * - Gradient: default set (24) + full library (120+) covering Canva's most used gradients.
 *
 * The lists are curated to match Canva's own picker: document colors are injected
 * by the panel itself, while these are the built-in swatches.
 */

export interface SolidSwatch {
  hex: string;
  name?: string;
}

/* ------------------------------------------------------------------ */
/*  Default solid colors – what Canva shows before "See all"          */
/* ------------------------------------------------------------------ */

export const CANVA_SOLID_DEFAULTS: string[] = [
  // monochrome row
  "#000000",
  "#FFFFFF",
  "#F5F5F5",
  "#E0E0E0",
  "#9E9E9E",
  "#616161",
  "#212121",

  // Canva's signature vibrant row (approx. their top bar)
  "#FF0000",
  "#FF6B00",
  "#FFC300",
  "#FFE600",
  "#00C875",
  "#00C4CC",
  "#0086FF",
  "#7D2AE7",

  // extended defaults – 2nd row in Canva
  "#FF2E93",
  "#FF6B6B",
  "#FF8E53",
  "#FE6B8B",
  "#FF8A65",
  "#FFB74D",
  "#FFD54F",
  "#FFF176",
  "#AED581",
  "#81C784",
  "#4DB6AC",
  "#4FC3F7",
  "#64B5F6",
  "#7986CB",
  "#9575CD",
  "#BA68C8",
  "#F06292",
  "#E57373",

  // deep + pastel
  "#B71C1C",
  "#880E4F",
  "#4A148C",
  "#1A237E",
  "#0D47A1",
  "#004D40",
  "#1B5E20",
  "#3E2723",
];

/* ------------------------------------------------------------------ */
/*  Full solid library – 200+ colors (organized by hue families)      */
/* ------------------------------------------------------------------ */

export const CANVA_SOLID_ALL: string[] = [
  // === Blacks / Whites / Grays (18) ===
  "#000000", "#0A0A0A", "#1A1A1A", "#2B2B2B", "#3D3D3D", "#4F4F4F",
  "#616161", "#757575", "#9E9E9E", "#BDBDBD", "#CCCCCC", "#D9D9D9",
  "#E0E0E0", "#EEEEEE", "#F5F5F5", "#FAFAFA", "#FFFFFF", "#F8F9FA",

  // === Reds (14) ===
  "#FFEBEE", "#FFCDD2", "#EF9A9A", "#E57373", "#EF5350", "#F44336",
  "#E53935", "#D32F2F", "#C62828", "#B71C1C", "#FF5252", "#FF1744",
  "#D50000", "#FF8A80",

  // === Pinks (12) ===
  "#FCE4EC", "#F8BBD0", "#F48FB1", "#F06292", "#EC407A", "#E91E63",
  "#D81B60", "#C2185B", "#AD1457", "#880E4F", "#FF4081", "#FF80AB",

  // === Purples / Violets (16) ===
  "#F3E5F5", "#E1BEE7", "#CE93D8", "#BA68C8", "#AB47BC", "#9C27B0",
  "#8E24AA", "#7B1FA2", "#6A1B9A", "#4A148C", "#E040FB", "#D500F9",
  "#AA00FF", "#6200EA", "#7C4DFF", "#B388FF",

  // === Deep Purple / Indigo (12) ===
  "#EDE7F6", "#D1C4E9", "#B39DDB", "#9575CD", "#7E57C2", "#673AB7",
  "#5E35B1", "#512DA8", "#4527A0", "#311B92", "#3F51B5", "#536DFE",

  // === Blues (16) ===
  "#E3F2FD", "#BBDEFB", "#90CAF9", "#64B5F6", "#42A5F5", "#2196F3",
  "#1E88E5", "#1976D2", "#1565C0", "#0D47A1", "#82B1FF", "#448AFF",
  "#2979FF", "#2962FF", "#00B0FF", "#0091EA",

  // === Light Blue / Cyan (12) ===
  "#E1F5FE", "#B3E5FC", "#81D4FA", "#4FC3F7", "#29B6F6", "#03A9F4",
  "#039BE5", "#0288D1", "#0277BD", "#01579B", "#80D8FF", "#40C4FF",

  // === Teal / Cyan (14) ===
  "#E0F7FA", "#B2EBF2", "#80DEEA", "#4DD0E1", "#26C6DA", "#00BCD4",
  "#00ACC1", "#0097A7", "#00838F", "#006064", "#84FFFF", "#18FFFF",
  "#00E5FF", "#00B8D4",

  // === Greens / Teal Greens (14) ===
  "#E0F2F1", "#B2DFDB", "#80CBC4", "#4DB6AC", "#26A69A", "#009688",
  "#00897B", "#00796B", "#00695C", "#004D40", "#A7FFEB", "#64FFDA",
  "#1DE9B6", "#00BFA5",

  // === Greens (16) ===
  "#E8F5E9", "#C8E6C9", "#A5D6A7", "#81C784", "#66BB6A", "#4CAF50",
  "#43A047", "#388E3C", "#2E7D32", "#1B5E20", "#B9F6CA", "#69F0AE",
  "#00E676", "#00C853", "#76FF03", "#64DD17",

  // === Lime / Light Green (10) ===
  "#F1F8E9", "#DCEDC8", "#C5E1A5", "#AED581", "#9CCC65", "#8BC34A",
  "#7CB342", "#689F38", "#558B2F", "#33691E",

  // === Yellows (12) ===
  "#FFFDE7", "#FFF9C4", "#FFF59D", "#FFF176", "#FFEE58", "#FFEB3B",
  "#FDD835", "#FBC02D", "#F9A825", "#F57F17", "#FFFF00", "#FFEA00",

  // === Amber / Orange (16) ===
  "#FFF8E1", "#FFECB3", "#FFE082", "#FFD54F", "#FFCA28", "#FFC107",
  "#FFB300", "#FFA000", "#FF8F00", "#FF6F00", "#FFD740", "#FFC400",
  "#FFAB00", "#FF6D00", "#FF9100", "#FFAB40",

  // === Deep Orange / Orange (12) ===
  "#FBE9E7", "#FFCCBC", "#FFAB91", "#FF8A65", "#FF7043", "#FF5722",
  "#F4511E", "#E64A19", "#D84315", "#BF360C", "#FF6E40", "#FF3D00",

  // === Browns (10) ===
  "#EFEBE9", "#D7CCC8", "#BCAAA4", "#A1887F", "#8D6E63", "#795548",
  "#6D4C41", "#5D4037", "#4E342E", "#3E2723",

  // === Blue Gray / Slate (8) ===
  "#ECEFF1", "#CFD8DC", "#B0BEC5", "#90A4AE", "#78909C", "#607D8B",
  "#546E7A", "#455A64",
];

/* ------------------------------------------------------------------ */
/*  Gradient definitions – Canva style                                 */
/* ------------------------------------------------------------------ */

export interface GradientSwatch {
  name: string;
  angle: number;
  stops: { color: string; at: number }[];
  type?: "linear" | "radial";
  css?: string; // optional precomputed
}

function g(name: string, angle: number, colors: string[], type: "linear" | "radial" = "linear"): GradientSwatch {
  return {
    name,
    angle,
    type,
    stops: colors.map((c, i) => ({ color: c, at: Math.round((i / (colors.length - 1)) * 100) })),
  };
}

/** 24 defaults shown first */
export const CANVA_GRADIENT_DEFAULTS: GradientSwatch[] = [
  g("Sunset", 90, ["#FF512F", "#DD2476"]),
  g("Ocean Blue", 135, ["#2193B0", "#6DD5ED"]),
  g("Mimosa", 90, ["#FFDEE9", "#B5FFFC"]),
  g("Lush", 135, ["#56AB2F", "#A8E063"]),
  g("Purple Dream", 90, ["#7F00FF", "#E100FF"]),
  g("Fire", 90, ["#F12711", "#F5AF19"]),
  g("Aqua", 135, ["#00F260", "#0575E6"]),
  g("Kye Meh", 90, ["#8360C3", "#2EBF91"]),
  g("Blush", 90, ["#FF6A88", "#FF99AC"]),
  g("Peach", 90, ["#FF9A8B", "#FF6A88", "#FF99AC"]),
  g("Moonlit", 135, ["#0F0C29", "#302B63", "#24243E"]),
  g("Gold", 180, ["#FFD700", "#FFA500", "#FF8C00"]),
  g("Neon", 90, ["#00F5A0", "#00D9F5"]),
  g("Rose", 90, ["#FFAFBD", "#FFC3A0"]),
  g("Emerald", 135, ["#348F50", "#56B4D3"]),
  g("Sublime", 90, ["#FC5C7D", "#6A82FB"]),
  g("Cool Sky", 135, ["#2980B9", "#6DD5FA", "#FFFFFF"]),
  g("Midnight", 135, ["#232526", "#414345"]),
  g("Mango", 90, ["#FFE259", "#FFA751"]),
  g("Berry", 90, ["#8E2DE2", "#4A00E0"]),
  g("Citrus", 90, ["#FDC830", "#F37335"]),
  g("Lavender", 135, ["#E0C3FC", "#8EC5FC"]),
  g("Coral Reef", 90, ["#FF6B6B", "#FFE66D"]),
  g("Northern Lights", 135, ["#00C9FF", "#92FE9D"]),
];

/** 120+ total – includes defaults + many more */
export const CANVA_GRADIENT_ALL: GradientSwatch[] = [
  ...CANVA_GRADIENT_DEFAULTS,

  // --- Warm / Sunset family (20 more)
  g("Warm Flame", 90, ["#FF9A9E", "#FECFEF"]),
  g("Juicy Peach", 90, ["#FFECD2", "#FCB69F"]),
  g("Lady Lips", 90, ["#FF9A9E", "#FAD0C4"]),
  g("Sunny Morning", 90, ["#F6D365", "#FDA085"]),
  g("Winter Neva", 135, ["#A1C4FD", "#C2E9FB"]),
  g("Dusty Grass", 135, ["#D4FC79", "#96E6A1"]),
  g("Tempting Azure", 135, ["#84FAB0", "#8FD3F4"]),
  g("Heavy Rain", 135, ["#CFDEF3", "#E0EAFB"]),
  g("Plum Plate", 135, ["#667EEA", "#764BA2"]),
  g("Everlasting Sky", 135, ["#FDFCFB", "#E2D1C9"]),
  g("Itmeo Branding", 135, ["#00B4DB", "#0083B0"]),
  g("Zeus Miracle", 135, ["#CD9CF2", "#F6F3FF"]),
  g("Deep Blue", 135, ["#6A82FB", "#FC5C7D"]),
  g("Ripe Malinka", 135, ["#F093FB", "#F5576C"]),
  g("Perfect White", 180, ["#E3FDF5", "#FFE6FA"]),
  g("Near Moon", 135, ["#5EE7DF", "#B490CA"]),
  g("Wild Apple", 135, ["#D299C2", "#FEF9D7"]),
  g("Ladoga Bottom", 135, ["#EBE9E6", "#EACFC2"]),
  g("Sunny Morning 2", 90, ["#FFDEE9", "#B5FFFC"]),
  g("Lemon Gate", 90, ["#96FBC4", "#F9F586"]),

  // --- Cool / Blue family (15)
  g("Blue Lagoon", 135, ["#43C6AC", "#191654"]),
  g("Aqua Marine", 135, ["#1A2980", "#26D0CE"]),
  g("Mild", 135, ["#67B26F", "#4CA2CD"]),
  g("Seashore", 135, ["#209CFF", "#68E0CF"]),
  g("Witching Hour", 135, ["#C31432", "#240B36"]),
  g("Flare", 135, ["#F12711", "#F5AF19"]),
  g("Metapolis", 135, ["#659999", "#F4791F"]),
  g("Kyoto", 135, ["#C02425", "#F0CB35"]),
  g("Pali", 135, ["#6A9113", "#141517"]),
  g("Koko Caramel", 135, ["#D1913C", "#FFD194"]),
  g("Sunset Orange", 90, ["#FF5E62", "#FF9966"]),
  g("Quepal", 135, ["#11998E", "#38EF7D"]),
  g("Sublime Light", 135, ["#FC5C7D", "#6A82FB"]),
  g("Sublime Vivid", 135, ["#FC466B", "#3F5EFB"]),
  g("Bighead", 135, ["#C94B4B", "#4B134F"]),

  // --- Purple / Pink family (15)
  g("Taran Tado", 135, ["#23074D", "#CC5333"]),
  g("Relaxing Red", 135, ["#FFFBD5", "#B20A2C"]),
  g("Lawrencium", 135, ["#0F0C29", "#302B63", "#24243E"]),
  g("Ohhappiness", 135, ["#00B4DB", "#0083B0"]),
  g("Delicate", 135, ["#D3CCE3", "#E9E4F0"]),
  g("Love Couple", 135, ["#3A6186", "#89253E"]),
  g("Red Sunset", 90, ["#355C7D", "#6C5B7B", "#C06C84"]),
  g("Shroom Haze", 135, ["#5C258D", "#4389A2"]),
  g("Instagram", 45, ["#833AB4", "#FD1D1D", "#FCB045"]),
  g("Retro Pink", 90, ["#FF5858", "#F09819"]),
  g("Pink Moon", 90, ["#FF6A88", "#FF99AC"]),
  g("Magic Pink", 90, ["#FF9A9E", "#FECFEF", "#FECFEF"]),
  g("Purple Love", 90, ["#CC2B5E", "#753A88"]),
  g("Purple Bliss", 135, ["#360033", "#0B8793"]),
  g("Berry Smooth", 90, ["#8E2DE2", "#4A00E0"]),

  // --- Green / Teal (15)
  g("Emerald Water", 135, ["#348F50", "#56B4D3"]),
  g("Lemon Twist", 135, ["#3CA55C", "#B5AC49"]),
  g("Monte Carlo", 135, ["#CC95C0", "#DBD4B4", "#7AA1D2"]),
  g("Citrus Peel", 135, ["#FDC830", "#F37335"]),
  g("Sin City Red", 135, ["#ED213A", "#93291E"]),
  g("Green Beach", 135, ["#02AABD", "#00CDAC"]),
  g("Emerald City", 135, ["#93EDC7", "#1CD8D2"]),
  g("Forest", 135, ["#5A3F37", "#2C7744"]),
  g("Moss", 135, ["#134E5E", "#71B280"]),
  g("Sea Weed", 135, ["#4CB8AC", "#3CD3AD"]),
  g("Aubergine", 135, ["#AA076B", "#61045F"]),
  g("Aqua Splash", 135, ["#13547A", "#80D0C7"]),
  g("Ultra Voilet", 135, ["#654EA3", "#EAAFC8"]),
  g("Burning Orange", 90, ["#FF416C", "#FF4B2B"]),
  g("Blue Raspberry", 135, ["#00B4DB", "#0083B0"]),

  // --- Dark / Premium (15)
  g("Midnight City", 135, ["#232526", "#414345"]),
  g("Mojito", 135, ["#1D976C", "#93F9B9"]),
  g("Neon Life", 90, ["#B3FFAB", "#12FFF7"]),
  g("Teal Love", 135, ["#AAFFA9", "#11FFBD"]),
  g("Red Mist", 135, ["#000000", "#E74C3C"]),
  g("Steel Gray", 135, ["#1F1C2C", "#928DAB"]),
  g("Veil of Night", 135, ["#000000", "#434343"]),
  g("Black Rosé", 135, ["#F4C4F3", "#FC67FA"]),
  g("Eternal Constance", 135, ["#09203F", "#537895"]),
  g("Happy Memories", 135, ["#FF5858", "#F09819"]),
  g("Crystal River", 135, ["#00B4DB", "#0083B0"]),
  g("Hersheys", 135, ["#1E130C", "#9A8478"]),
  g("New York", 135, ["#FF00CC", "#333399"]),
  g("Ali", 135, ["#FF4E50", "#F9D423"]),
  g("Alihossein", 135, ["#F7FF00", "#DB36A4"]),

  // --- Pastel / Soft (15)
  g("Pastel Rainbow", 90, ["#FF9A9E", "#FECFEF", "#FECFEF", "#A1C4FD", "#C2E9FB"]),
  g("Soft Pastel", 135, ["#FFDEE9", "#B5FFFC"]),
  g("Cotton Candy", 90, ["#FFB6C1", "#FFC3A0", "#D5AAFF"]),
  g("Baby Pink", 90, ["#FFAFBD", "#FFC3A0"]),
  g("Peach Pastel", 90, ["#FFD194", "#D1913C"]),
  g("Mint Pastel", 90, ["#A8EDEA", "#FED6E3"]),
  g("Lavender Pastel", 90, ["#E0C3FC", "#8EC5FC"]),
  g("Lemon Pastel", 90, ["#FFF9C4", "#FFF176"]),
  g("Sky Pastel", 90, ["#B2EBF2", "#80DEEA"]),
  g("Rose Pastel", 90, ["#F8BBD0", "#E1BEE7"]),
  g("Lilac Pastel", 90, ["#D1C4E9", "#B39DDB"]),
  g("Peach Cream", 90, ["#FFECD2", "#FCB69F"]),
  g("Vanilla", 90, ["#FFF8E1", "#FFECB3"]),
  g("Strawberry", 90, ["#FF9A9E", "#FAD0C4"]),
  g("Bubblegum", 90, ["#FF6A88", "#FF99AC"]),

  // --- Extra vibrant (16 more to reach 120+)
  g("Hyper Blue", 135, ["#00C9FF", "#92FE9D"]),
  g("Hyper Pink", 90, ["#FF5F6D", "#FFC371"]),
  g("Hyper Green", 135, ["#11998E", "#38EF7D"]),
  g("Hyper Purple", 135, ["#8E2DE2", "#4A00E0"]),
  g("Hyper Orange", 90, ["#F7971E", "#FFD200"]),
  g("Hyper Teal", 135, ["#00B4DB", "#0083B0"]),
  g("Hyper Red", 90, ["#EB3349", "#F45C43"]),
  g("Hyper Yellow", 90, ["#F7971E", "#FFD200"]),
  g("Rainbow", 90, ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#9400D3"]),
  g("Sunset Vibrant", 90, ["#FF512F", "#F09819"]),
  g("Ocean Deep", 135, ["#2BC0E4", "#EAECC6"]),
  g("Purple Haze", 135, ["#7F00FF", "#E100FF"]),
  g("Golden Hour", 90, ["#FDB99B", "#CF8BF3", "#A770EF"]),
  g("Aurora", 135, ["#00C9FF", "#92FE9D"]),
  g("Cosmic", 135, ["#FF00CC", "#333399"]),
  g("Sunrise", 90, ["#FF512F", "#DD2476"]),
];

/** CSS string for a gradient swatch */
export function gradientCssFor(s: GradientSwatch): string {
  if (s.css) return s.css;
  const stops = s.stops.map((st) => `${st.color} ${st.at}%`).join(", ");
  if (s.type === "radial") {
    return `radial-gradient(circle at 50% 50%, ${stops})`;
  }
  return `linear-gradient(${s.angle}deg, ${stops})`;
}

/** Convert swatch to Gradient type used by the editor */
export function swatchToGradient(s: GradientSwatch) {
  return {
    enabled: true,
    type: (s.type ?? "linear") as "linear" | "radial" | "mesh",
    angle: s.angle,
    stops: s.stops.map((st) => ({ ...st })),
    cx: 50,
    cy: 50,
  };
}
