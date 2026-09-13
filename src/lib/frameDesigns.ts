import type { FrameSettings, FrameStyleId } from "./types";
import { shade, withAlpha } from "./color";

export type { FrameStyleId };

export interface FrameStyleDef {
  id: FrameStyleId;
  label: string;
  category: "wood" | "metal" | "neon" | "gradient" | "pattern" | "clean" | "luxury" | "fun";
  swatch: string;
  description: string;
}

export const ALL_FRAME_STYLES: FrameStyleDef[] = [
  /* ---------------- Wood & Timber ---------------- */
  {
    id: "wood",
    label: "Teak Wood",
    category: "wood",
    swatch: "linear-gradient(135deg, #f2c98a 0%, #e6a15c 45%, #a86a24 100%)",
    description: "Classic warm teak wood grain with 3D beveled luster",
  },
  {
    id: "mahogany",
    label: "Mahogany",
    category: "wood",
    swatch: "linear-gradient(135deg, #a3382c 0%, #61150f 50%, #2b0805 100%)",
    description: "Deep luxurious red-brown polished mahogany wood",
  },
  {
    id: "walnut",
    label: "Dark Walnut",
    category: "wood",
    swatch: "linear-gradient(135deg, #7c5335 0%, #4a2f1c 50%, #211309 100%)",
    description: "Rich dark walnut timber with warm golden highlights",
  },
  {
    id: "ebony",
    label: "Polished Ebony",
    category: "wood",
    swatch: "linear-gradient(135deg, #3d3d45 0%, #1c1c21 50%, #0d0d10 100%)",
    description: "Deep obsidian ebony wood with satin sheen",
  },

  /* ---------------- Metallic & Royal ---------------- */
  {
    id: "gold",
    label: "Royal Gold",
    category: "metal",
    swatch: "linear-gradient(135deg, #ffe082 0%, #e6b800 35%, #996e00 70%, #ffea9f 100%)",
    description: "Gleaming 24K gold bullion finish with rich reflections",
  },
  {
    id: "silver",
    label: "Brushed Platinum",
    category: "metal",
    swatch: "linear-gradient(135deg, #ffffff 0%, #d1d5db 40%, #6b7280 80%, #9ca3af 100%)",
    description: "Polished platinum chrome with cool metallic sheen",
  },
  {
    id: "bronze",
    label: "Antique Bronze",
    category: "metal",
    swatch: "linear-gradient(135deg, #d9a066 0%, #8c531b 50%, #4a2806 100%)",
    description: "Warm burnished bronze medal with antique patina",
  },
  {
    id: "copper",
    label: "Rose Gold",
    category: "metal",
    swatch: "linear-gradient(135deg, #fbcfe8 0%, #fb7185 45%, #9f1239 100%)",
    description: "Luminous rose gold and copper metallic luster",
  },
  {
    id: "baroque",
    label: "Baroque Filigree",
    category: "metal",
    swatch: "repeating-linear-gradient(45deg, #d4af37 0 6px, #855800 6px 12px)",
    description: "Ornate dual-tiered royal gold architectural molding",
  },

  /* ---------------- Neon & Cyber ---------------- */
  {
    id: "neon",
    label: "Cyber Cyan",
    category: "neon",
    swatch: "linear-gradient(90deg, #22d3ee, #0284c7)",
    description: "Radiant electric cyan laser glow with outer aura",
  },
  {
    id: "neonMagenta",
    label: "Synthwave Magenta",
    category: "neon",
    swatch: "linear-gradient(90deg, #f43f5e, #c026d3)",
    description: "Vibrant neon magenta-purple retro synthwave tube",
  },
  {
    id: "neonGreen",
    label: "Matrix Laser",
    category: "neon",
    swatch: "linear-gradient(90deg, #4ade80, #15803d)",
    description: "High-voltage neon emerald laser beam",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk Hazard",
    category: "neon",
    swatch: "repeating-linear-gradient(45deg, #facc15 0 10px, #0f172a 10px 20px)",
    description: "High-contrast cyber tech frame with luminous accents",
  },

  /* ---------------- Gradients & Glass ---------------- */
  {
    id: "gradient",
    label: "Custom Gradient",
    category: "gradient",
    swatch: "linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)",
    description: "Custom multi-color gradient with customizable angle",
  },
  {
    id: "glass",
    label: "Frosted Acrylic",
    category: "gradient",
    swatch: "linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))",
    description: "Translucent frosted glass border with subtle highlight edge",
  },
  {
    id: "carbon",
    label: "Carbon Fiber",
    category: "pattern",
    swatch: "radial-gradient(circle, #334155 35%, #0f172a 100%)",
    description: "High-tech composite carbon weave matte texture",
  },

  /* ---------------- Lines, Patterns & 3D ---------------- */
  {
    id: "double",
    label: "Prestige Double",
    category: "pattern",
    swatch: "repeating-linear-gradient(90deg, #d97706 0 4px, #fef3c7 4px 6px)",
    description: "Classical dual-tier university certificate border",
  },
  {
    id: "triple",
    label: "Gallery Triple",
    category: "pattern",
    swatch: "repeating-linear-gradient(90deg, #64748b 0 3px, #cbd5e1 3px 5px)",
    description: "Triple-layer art gallery shadowbox border",
  },
  {
    id: "dashed",
    label: "Blueprint Dash",
    category: "pattern",
    swatch: "repeating-linear-gradient(90deg, #38bdf8 0 8px, transparent 8px 14px)",
    description: "Technical schematic architectural dashed line",
  },
  {
    id: "dotted",
    label: "Stitch Dotted",
    category: "pattern",
    swatch: "radial-gradient(circle, #fbbf24 2px, transparent 3px)",
    description: "Refined artisan dotted perimeter frame",
  },
  {
    id: "chalk",
    label: "Classroom Chalk",
    category: "pattern",
    swatch: "repeating-linear-gradient(45deg, #f1f5f9 0 3px, #94a3b8 3px 6px)",
    description: "Traditional classroom chalkboard textured white trim",
  },
  {
    id: "groove",
    label: "3D Deep Groove",
    category: "pattern",
    swatch: "linear-gradient(180deg, #1e293b 0%, #475569 50%, #0f172a 100%)",
    description: "Inverted 3D carved channel with light & shadow bevels",
  },
  {
    id: "ridge",
    label: "3D Raised Ridge",
    category: "pattern",
    swatch: "linear-gradient(180deg, #64748b 0%, #0f172a 50%, #475569 100%)",
    description: "Extruded raised 3D crown molding frame",
  },

  /* ---------------- Extra timber ---------------- */
  {
    id: "oak",
    label: "Honey Oak",
    category: "wood",
    swatch: "linear-gradient(135deg, #e8c48a 0%, #c48a3a 50%, #7a4a12 100%)",
    description: "Light honey oak with visible grain stripes",
  },
  {
    id: "bamboo",
    label: "Bamboo",
    category: "wood",
    swatch: "repeating-linear-gradient(90deg, #d4e157 0 8px, #9e9d24 8px 10px, #c0ca33 10px 18px)",
    description: "Natural bamboo slats with node rings",
  },

  /* ---------------- Stone & gems ---------------- */
  {
    id: "marble",
    label: "Carrara Marble",
    category: "luxury",
    swatch: "linear-gradient(120deg, #f8fafc 0%, #e2e8f0 40%, #cbd5e1 55%, #f1f5f9 100%)",
    description: "White Carrara marble with grey veining",
  },
  {
    id: "obsidian",
    label: "Volcanic Glass",
    category: "luxury",
    swatch: "linear-gradient(135deg, #1e1b4b 0%, #0f0a1a 50%, #312e81 100%)",
    description: "Glossy volcanic glass with indigo highlights",
  },
  {
    id: "pearl",
    label: "Mother of Pearl",
    category: "luxury",
    swatch: "linear-gradient(135deg, #fff 0%, #fce7f3 35%, #e0f2fe 70%, #fff 100%)",
    description: "Iridescent nacre with pink-blue sheen",
  },
  {
    id: "ruby",
    label: "Ruby Gem",
    category: "luxury",
    swatch: "linear-gradient(135deg, #fecaca 0%, #dc2626 40%, #7f1d1d 80%, #f87171 100%)",
    description: "Faceted ruby with inner fire",
  },
  {
    id: "emerald",
    label: "Emerald Cut",
    category: "luxury",
    swatch: "linear-gradient(135deg, #a7f3d0 0%, #059669 45%, #064e3b 85%, #34d399 100%)",
    description: "Deep emerald crystal with facet highlights",
  },
  {
    id: "sapphire",
    label: "Royal Sapphire",
    category: "luxury",
    swatch: "linear-gradient(135deg, #bfdbfe 0%, #1d4ed8 40%, #1e3a8a 80%, #60a5fa 100%)",
    description: "Royal blue sapphire with star flash",
  },

  /* ---------------- Fabric ---------------- */
  {
    id: "leather",
    label: "Cognac Leather",
    category: "pattern",
    swatch: "linear-gradient(135deg, #b45309 0%, #78350f 50%, #451a03 100%)",
    description: "Stitched cognac leather wrap",
  },
  {
    id: "velvet",
    label: "Theatre Velvet",
    category: "luxury",
    swatch: "linear-gradient(180deg, #7f1d1d 0%, #450a0a 50%, #991b1b 100%)",
    description: "Deep theatre-curtain velvet",
  },

  /* ---------------- Photo / film ---------------- */
  {
    id: "cinema",
    label: "Film Strip",
    category: "fun",
    swatch: "repeating-linear-gradient(90deg, #111 0 10px, #fbbf24 10px 14px, #111 14px 24px)",
    description: "Classic cinema film perforations",
  },
  {
    id: "polaroid",
    label: "Polaroid",
    category: "fun",
    swatch: "linear-gradient(180deg, #ffffff 0%, #f8fafc 70%, #e2e8f0 100%)",
    description: "Instant-photo white border",
  },
  {
    id: "comic",
    label: "Comic Ink",
    category: "fun",
    swatch: "repeating-linear-gradient(90deg, #111 0 4px, #facc15 4px 8px, #111 8px 12px)",
    description: "Bold comic-book ink outline",
  },
  {
    id: "pixel",
    label: "8-Bit Pixel",
    category: "fun",
    swatch: "repeating-linear-gradient(90deg, #22c55e 0 6px, #14532d 6px 12px)",
    description: "Chunky 8-bit pixel border",
  },
  {
    id: "mosaic",
    label: "Tile Mosaic",
    category: "pattern",
    swatch: "repeating-linear-gradient(45deg, #f59e0b 0 8px, #0ea5e9 8px 16px, #ec4899 16px 24px)",
    description: "Colourful ceramic mosaic tiles",
  },

  /* ---------------- Nature / energy ---------------- */
  {
    id: "rainbow",
    label: "Prism Rainbow",
    category: "gradient",
    swatch: "linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6)",
    description: "Full-spectrum rainbow prism",
  },
  {
    id: "ice",
    label: "Frozen Ice",
    category: "gradient",
    swatch: "linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 40%, #0284c7 100%)",
    description: "Crystalline ice with frost glow",
  },
  {
    id: "lava",
    label: "Molten Lava",
    category: "gradient",
    swatch: "linear-gradient(180deg, #fbbf24 0%, #ea580c 40%, #7f1d1d 100%)",
    description: "Molten lava with ember glow",
  },

  /* ---------------- Paper / vintage ---------------- */
  {
    id: "paper",
    label: "Kraft Paper",
    category: "pattern",
    swatch: "linear-gradient(135deg, #fde68a 0%, #d6b56a 50%, #a16207 100%)",
    description: "Handmade kraft paper deckle edge",
  },
  {
    id: "vintage",
    label: "Vintage Ornate",
    category: "luxury",
    swatch: "repeating-linear-gradient(45deg, #92400e 0 5px, #fbbf24 5px 8px, #78350f 8px 13px)",
    description: "Antique photo-album gilt corners",
  },
  {
    id: "artDeco",
    label: "Art Deco",
    category: "luxury",
    swatch: "linear-gradient(90deg, #111 0%, #d4af37 20%, #111 40%, #d4af37 60%, #111 80%, #d4af37 100%)",
    description: "1920s stepped gold-and-black deco",
  },
  {
    id: "celtic",
    label: "Celtic Knot",
    category: "pattern",
    swatch: "repeating-linear-gradient(45deg, #166534 0 6px, #fbbf24 6px 10px, #14532d 10px 16px)",
    description: "Interlaced Celtic knotwork in gold on green",
  },
  {
    id: "orichalcum",
    label: "Orichalcum",
    category: "metal",
    swatch: "linear-gradient(135deg, #fdba74 0%, #c2410c 40%, #7c2d12 80%, #fb923c 100%)",
    description: "Mythic red-gold alloy",
  },
  {
    id: "hologram",
    label: "Hologram",
    category: "neon",
    swatch: "linear-gradient(120deg, #22d3ee, #a78bfa, #f472b6, #34d399, #22d3ee)",
    description: "Shifting holographic foil",
  },

  /* ---------------- Clean & Minimal ---------------- */
  {
    id: "solid",
    label: "Modern Solid",
    category: "clean",
    swatch: "#e6a15c",
    description: "Clean flat contemporary solid color frame",
  },
  {
    id: "thin",
    label: "Hairline Minimal",
    category: "clean",
    swatch: "#94a3b8",
    description: "Ultra-thin 4px sleek hairline perimeter",
  },
  {
    id: "none",
    label: "Borderless (None)",
    category: "clean",
    swatch: "repeating-linear-gradient(45deg, #334155 0 6px, #1e293b 6px 12px)",
    description: "Completely borderless edge-to-edge presentation",
  },
];

export interface FramePreset {
  name: string;
  category: string;
  swatch: string;
  frame: Partial<FrameSettings>;
}

export const RICH_FRAME_PRESETS: FramePreset[] = [
  {
    name: "Classic Teak Wood",
    category: "Wood",
    swatch: "linear-gradient(135deg, #f2c98a 0%, #e6a15c 45%, #a86a24 100%)",
    frame: {
      style: "wood",
      color: "#e6a15c",
      width: 26,
      radius: 14,
      shadow: true,
      gradient: { enabled: false, angle: 155, from: "#f2c98a", to: "#a86a24" },
    },
  },
  {
    name: "Mahogany Prestige",
    category: "Wood",
    swatch: "linear-gradient(135deg, #a3382c 0%, #61150f 50%, #2b0805 100%)",
    frame: {
      style: "mahogany",
      color: "#6b1a13",
      width: 28,
      radius: 12,
      shadow: true,
      gradient: { enabled: false, angle: 135, from: "#a3382c", to: "#2b0805" },
    },
  },
  {
    name: "Dark Walnut Studio",
    category: "Wood",
    swatch: "linear-gradient(135deg, #7c5335 0%, #4a2f1c 50%, #211309 100%)",
    frame: {
      style: "walnut",
      color: "#4a2f1c",
      width: 26,
      radius: 10,
      shadow: true,
      gradient: { enabled: false, angle: 135, from: "#7c5335", to: "#211309" },
    },
  },
  {
    name: "24K Royal Gold",
    category: "Metal",
    swatch: "linear-gradient(135deg, #ffe082 0%, #e6b800 35%, #996e00 70%, #ffea9f 100%)",
    frame: {
      style: "gold",
      color: "#d4af37",
      width: 24,
      radius: 16,
      shadow: true,
      gradient: { enabled: true, angle: 135, from: "#ffe082", to: "#8c6b00" },
    },
  },
  {
    name: "Brushed Platinum",
    category: "Metal",
    swatch: "linear-gradient(135deg, #ffffff 0%, #d1d5db 40%, #6b7280 80%, #9ca3af 100%)",
    frame: {
      style: "silver",
      color: "#9ca3af",
      width: 22,
      radius: 12,
      shadow: true,
      gradient: { enabled: true, angle: 135, from: "#f3f4f6", to: "#4b5563" },
    },
  },
  {
    name: "Cyberpunk Neon Cyan",
    category: "Neon",
    swatch: "linear-gradient(90deg, #22d3ee, #0284c7)",
    frame: {
      style: "neon",
      color: "#22d3ee",
      width: 14,
      radius: 18,
      shadow: true,
      gradient: { enabled: false, angle: 90, from: "#22d3ee", to: "#0284c7" },
    },
  },
  {
    name: "Synthwave Hot Magenta",
    category: "Neon",
    swatch: "linear-gradient(90deg, #f43f5e, #c026d3)",
    frame: {
      style: "neonMagenta",
      color: "#f43f5e",
      width: 14,
      radius: 18,
      shadow: true,
      gradient: { enabled: false, angle: 90, from: "#f43f5e", to: "#c026d3" },
    },
  },
  {
    name: "Matrix Laser Green",
    category: "Neon",
    swatch: "linear-gradient(90deg, #4ade80, #15803d)",
    frame: {
      style: "neonGreen",
      color: "#22c55e",
      width: 12,
      radius: 16,
      shadow: true,
      gradient: { enabled: false, angle: 90, from: "#4ade80", to: "#15803d" },
    },
  },
  {
    name: "Sunset Horizon",
    category: "Gradient",
    swatch: "linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)",
    frame: {
      style: "gradient",
      color: "#f97316",
      width: 20,
      radius: 16,
      shadow: true,
      gradient: { enabled: true, angle: 135, from: "#f97316", to: "#ec4899" },
    },
  },
  {
    name: "Cosmic Aurora",
    category: "Gradient",
    swatch: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #9333ea 100%)",
    frame: {
      style: "gradient",
      color: "#06b6d4",
      width: 20,
      radius: 16,
      shadow: true,
      gradient: { enabled: true, angle: 135, from: "#06b6d4", to: "#9333ea" },
    },
  },
  {
    name: "Art Gallery Double",
    category: "Pattern",
    swatch: "repeating-linear-gradient(90deg, #b45309 0 4px, #fde68a 4px 6px)",
    frame: {
      style: "double",
      color: "#d97706",
      width: 28,
      radius: 10,
      shadow: false,
      gradient: { enabled: false, angle: 90, from: "#d97706", to: "#fde68a" },
    },
  },
  {
    name: "Baroque Filigree Gold",
    category: "Metal",
    swatch: "repeating-linear-gradient(45deg, #d4af37 0 6px, #855800 6px 12px)",
    frame: {
      style: "baroque",
      color: "#d4af37",
      width: 30,
      radius: 12,
      shadow: true,
      gradient: { enabled: true, angle: 135, from: "#ffe58f", to: "#874d00" },
    },
  },
  {
    name: "Frosted Acrylic Glass",
    category: "Modern",
    swatch: "linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))",
    frame: {
      style: "glass",
      color: "#cbd5e1",
      width: 22,
      radius: 20,
      shadow: true,
      gradient: { enabled: false, angle: 135, from: "#ffffff", to: "#94a3b8" },
    },
  },
  {
    name: "Carbon Fiber Tech",
    category: "Modern",
    swatch: "radial-gradient(circle, #334155 35%, #0f172a 100%)",
    frame: {
      style: "carbon",
      color: "#1e293b",
      width: 24,
      radius: 12,
      shadow: true,
      gradient: { enabled: false, angle: 135, from: "#334155", to: "#0f172a" },
    },
  },
  {
    name: "Technical Blueprint",
    category: "Pattern",
    swatch: "repeating-linear-gradient(90deg, #38bdf8 0 8px, transparent 8px 14px)",
    frame: {
      style: "dashed",
      color: "#38bdf8",
      width: 16,
      radius: 8,
      shadow: false,
      gradient: { enabled: false, angle: 90, from: "#38bdf8", to: "#0284c7" },
    },
  },
  {
    name: "Classroom Chalk",
    category: "Pattern",
    swatch: "repeating-linear-gradient(45deg, #f1f5f9 0 3px, #94a3b8 3px 6px)",
    frame: {
      style: "chalk",
      color: "#f8fafc",
      width: 18,
      radius: 12,
      shadow: false,
      gradient: { enabled: false, angle: 45, from: "#f8fafc", to: "#94a3b8" },
    },
  },
  {
    name: "3D Deep Groove",
    category: "3D",
    swatch: "linear-gradient(180deg, #1e293b 0%, #475569 50%, #0f172a 100%)",
    frame: {
      style: "groove",
      color: "#334155",
      width: 26,
      radius: 10,
      shadow: true,
      gradient: { enabled: false, angle: 180, from: "#1e293b", to: "#0f172a" },
    },
  },
  {
    name: "3D Raised Ridge",
    category: "3D",
    swatch: "linear-gradient(180deg, #64748b 0%, #0f172a 50%, #475569 100%)",
    frame: {
      style: "ridge",
      color: "#475569",
      width: 26,
      radius: 10,
      shadow: true,
      gradient: { enabled: false, angle: 180, from: "#64748b", to: "#0f172a" },
    },
  },
  {
    name: "Slate Modern Solid",
    category: "Clean",
    swatch: "#1e293b",
    frame: {
      style: "solid",
      color: "#1e293b",
      width: 18,
      radius: 12,
      shadow: true,
      gradient: { enabled: false, angle: 135, from: "#334155", to: "#0f172a" },
    },
  },
  {
    name: "Minimal Hairline",
    category: "Clean",
    swatch: "#94a3b8",
    frame: {
      style: "thin",
      color: "#94a3b8",
      width: 6,
      radius: 8,
      shadow: false,
      gradient: { enabled: false, angle: 90, from: "#cbd5e1", to: "#64748b" },
    },
  },
  {
    name: "Honey Oak Grain",
    category: "Wood",
    swatch: "linear-gradient(135deg, #e8c48a 0%, #c48a3a 50%, #7a4a12 100%)",
    frame: { style: "oak", color: "#c48a3a", width: 26, radius: 12, shadow: true, gradient: { enabled: false, angle: 135, from: "#e8c48a", to: "#7a4a12" } },
  },
  {
    name: "Zen Bamboo",
    category: "Wood",
    swatch: "repeating-linear-gradient(90deg, #d4e157 0 8px, #9e9d24 8px 10px)",
    frame: { style: "bamboo", color: "#c0ca33", width: 22, radius: 6, shadow: false, gradient: { enabled: false, angle: 90, from: "#d4e157", to: "#827717" } },
  },
  {
    name: "Carrara Marble",
    category: "Luxury",
    swatch: "linear-gradient(120deg, #f8fafc, #e2e8f0, #cbd5e1)",
    frame: { style: "marble", color: "#e2e8f0", width: 24, radius: 14, shadow: true, gradient: { enabled: false, angle: 120, from: "#ffffff", to: "#94a3b8" } },
  },
  {
    name: "Volcanic Obsidian",
    category: "Luxury",
    swatch: "linear-gradient(135deg, #1e1b4b, #0f0a1a, #312e81)",
    frame: { style: "obsidian", color: "#1e1b4b", width: 26, radius: 16, shadow: true, gradient: { enabled: false, angle: 135, from: "#312e81", to: "#0f0a1a" } },
  },
  {
    name: "Mother of Pearl",
    category: "Luxury",
    swatch: "linear-gradient(135deg, #fff, #fce7f3, #e0f2fe)",
    frame: { style: "pearl", color: "#fce7f3", width: 22, radius: 20, shadow: true, gradient: { enabled: true, angle: 135, from: "#ffffff", to: "#e0f2fe" } },
  },
  {
    name: "Ruby Fire",
    category: "Luxury",
    swatch: "linear-gradient(135deg, #fecaca, #dc2626, #7f1d1d)",
    frame: { style: "ruby", color: "#dc2626", width: 24, radius: 14, shadow: true, gradient: { enabled: true, angle: 135, from: "#fecaca", to: "#7f1d1d" } },
  },
  {
    name: "Emerald Palace",
    category: "Luxury",
    swatch: "linear-gradient(135deg, #a7f3d0, #059669, #064e3b)",
    frame: { style: "emerald", color: "#059669", width: 24, radius: 14, shadow: true, gradient: { enabled: true, angle: 135, from: "#6ee7b7", to: "#064e3b" } },
  },
  {
    name: "Royal Sapphire",
    category: "Luxury",
    swatch: "linear-gradient(135deg, #bfdbfe, #1d4ed8, #1e3a8a)",
    frame: { style: "sapphire", color: "#1d4ed8", width: 24, radius: 14, shadow: true, gradient: { enabled: true, angle: 135, from: "#93c5fd", to: "#1e3a8a" } },
  },
  {
    name: "Cognac Leather",
    category: "Texture",
    swatch: "linear-gradient(135deg, #b45309, #78350f, #451a03)",
    frame: { style: "leather", color: "#92400e", width: 28, radius: 10, shadow: true, gradient: { enabled: false, angle: 135, from: "#b45309", to: "#451a03" } },
  },
  {
    name: "Theatre Velvet",
    category: "Luxury",
    swatch: "linear-gradient(180deg, #7f1d1d, #450a0a)",
    frame: { style: "velvet", color: "#7f1d1d", width: 30, radius: 8, shadow: true, gradient: { enabled: false, angle: 180, from: "#991b1b", to: "#450a0a" } },
  },
  {
    name: "Cinema Film Strip",
    category: "Fun",
    swatch: "repeating-linear-gradient(90deg, #111 0 10px, #fbbf24 10px 14px)",
    frame: { style: "cinema", color: "#111111", width: 32, radius: 4, shadow: false, gradient: { enabled: false, angle: 90, from: "#111", to: "#fbbf24" } },
  },
  {
    name: "Instant Polaroid",
    category: "Fun",
    swatch: "linear-gradient(180deg, #ffffff, #e2e8f0)",
    frame: { style: "polaroid", color: "#ffffff", width: 28, radius: 2, shadow: true, gradient: { enabled: false, angle: 180, from: "#ffffff", to: "#e2e8f0" } },
  },
  {
    name: "Comic Ink Pop",
    category: "Fun",
    swatch: "repeating-linear-gradient(90deg, #111 0 4px, #facc15 4px 8px)",
    frame: { style: "comic", color: "#111111", width: 16, radius: 0, shadow: false, gradient: { enabled: false, angle: 90, from: "#111", to: "#facc15" } },
  },
  {
    name: "8-Bit Pixel",
    category: "Fun",
    swatch: "repeating-linear-gradient(90deg, #22c55e 0 6px, #14532d 6px 12px)",
    frame: { style: "pixel", color: "#22c55e", width: 16, radius: 0, shadow: false, gradient: { enabled: false, angle: 90, from: "#22c55e", to: "#14532d" } },
  },
  {
    name: "Ceramic Mosaic",
    category: "Pattern",
    swatch: "repeating-linear-gradient(45deg, #f59e0b 0 8px, #0ea5e9 8px 16px, #ec4899 16px 24px)",
    frame: { style: "mosaic", color: "#f59e0b", width: 24, radius: 6, shadow: false, gradient: { enabled: false, angle: 45, from: "#f59e0b", to: "#ec4899" } },
  },
  {
    name: "Prism Rainbow",
    category: "Gradient",
    swatch: "linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6)",
    frame: { style: "rainbow", color: "#8b5cf6", width: 18, radius: 14, shadow: true, gradient: { enabled: true, angle: 90, from: "#ef4444", to: "#8b5cf6" } },
  },
  {
    name: "Frozen Ice Crystal",
    category: "Nature",
    swatch: "linear-gradient(135deg, #e0f2fe, #7dd3fc, #0284c7)",
    frame: { style: "ice", color: "#38bdf8", width: 22, radius: 18, shadow: true, gradient: { enabled: true, angle: 135, from: "#e0f2fe", to: "#0284c7" } },
  },
  {
    name: "Molten Lava",
    category: "Nature",
    swatch: "linear-gradient(180deg, #fbbf24, #ea580c, #7f1d1d)",
    frame: { style: "lava", color: "#ea580c", width: 24, radius: 12, shadow: true, gradient: { enabled: true, angle: 180, from: "#fbbf24", to: "#7f1d1d" } },
  },
  {
    name: "Kraft Paper",
    category: "Texture",
    swatch: "linear-gradient(135deg, #fde68a, #d6b56a, #a16207)",
    frame: { style: "paper", color: "#d6b56a", width: 20, radius: 8, shadow: false, gradient: { enabled: false, angle: 135, from: "#fde68a", to: "#a16207" } },
  },
  {
    name: "Vintage Album Gilt",
    category: "Luxury",
    swatch: "repeating-linear-gradient(45deg, #92400e 0 5px, #fbbf24 5px 8px)",
    frame: { style: "vintage", color: "#92400e", width: 28, radius: 10, shadow: true, gradient: { enabled: false, angle: 45, from: "#fbbf24", to: "#78350f" } },
  },
  {
    name: "1920s Art Deco",
    category: "Luxury",
    swatch: "linear-gradient(90deg, #111, #d4af37, #111, #d4af37)",
    frame: { style: "artDeco", color: "#d4af37", width: 26, radius: 0, shadow: true, gradient: { enabled: false, angle: 90, from: "#111111", to: "#d4af37" } },
  },
  {
    name: "Celtic Knotwork",
    category: "Pattern",
    swatch: "repeating-linear-gradient(45deg, #166534 0 6px, #fbbf24 6px 10px)",
    frame: { style: "celtic", color: "#166534", width: 26, radius: 8, shadow: false, gradient: { enabled: false, angle: 45, from: "#166534", to: "#fbbf24" } },
  },
  {
    name: "Mythic Orichalcum",
    category: "Metal",
    swatch: "linear-gradient(135deg, #fdba74, #c2410c, #7c2d12)",
    frame: { style: "orichalcum", color: "#c2410c", width: 24, radius: 14, shadow: true, gradient: { enabled: true, angle: 135, from: "#fdba74", to: "#7c2d12" } },
  },
  {
    name: "Holographic Foil",
    category: "Neon",
    swatch: "linear-gradient(120deg, #22d3ee, #a78bfa, #f472b6, #34d399)",
    frame: { style: "hologram", color: "#a78bfa", width: 18, radius: 16, shadow: true, gradient: { enabled: true, angle: 120, from: "#22d3ee", to: "#f472b6" } },
  },
];

export interface FrameCssResult {
  outerPadding: number;
  outerRadius: number;
  innerRadius: number;
  ringBackground: string;
  ringBoxShadow: string;
  ringBorder?: string;
  boardBoxShadow: string;
}

/**
 * Computes the complete CSS styles for any frame style and color configuration.
 */
export function computeFrameCss(frame: FrameSettings, frameOn: boolean): FrameCssResult {
  if (!frameOn || frame.style === "none") {
    return {
      outerPadding: 0,
      outerRadius: 0,
      innerRadius: 0,
      ringBackground: "transparent",
      ringBoxShadow: "none",
      boardBoxShadow: "none",
    };
  }

  const baseColor = frame.color || "#e6a15c";
  const thickness =
    frame.style === "thin"
      ? 6
      : frame.style === "neon" || frame.style === "neonMagenta" || frame.style === "neonGreen" || frame.style === "hologram"
        ? Math.min(16, frame.width)
        : frame.style === "polaroid" || frame.style === "cinema"
          ? Math.max(24, frame.width)
          : frame.width;
  const padding = Math.round(thickness / 2);
  const outerRadius = frame.radius;
  const innerRadius = Math.max(2, frame.radius - Math.round(padding * 0.7));

  let ringBackground = "";
  let ringBoxShadow = "none";
  let ringBorder: string | undefined = undefined;
  let boardBoxShadow = "none";

  switch (frame.style) {
    case "solid":
      ringBackground = baseColor;
      ringBoxShadow = frame.shadow ? `inset 0 0 12px rgba(0,0,0,0.4)` : "none";
      break;

    case "gradient":
      if (frame.gradient?.enabled) {
        ringBackground = `linear-gradient(${frame.gradient.angle}deg, ${frame.gradient.from}, ${frame.gradient.to})`;
      } else {
        ringBackground = `linear-gradient(135deg, ${shade(baseColor, 0.35)} 0%, ${baseColor} 50%, ${shade(baseColor, -0.35)} 100%)`;
      }
      ringBoxShadow = frame.shadow ? "inset 0 0 14px rgba(0,0,0,0.5)" : "none";
      break;

    case "wood":
      ringBackground = `linear-gradient(155deg, ${shade(baseColor, 0.42)} 0%, ${baseColor} 38%, ${shade(baseColor, -0.45)} 100%)`;
      ringBoxShadow = frame.shadow
        ? `inset 0 0 16px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)`
        : "none";
      break;

    case "mahogany":
      ringBackground = `linear-gradient(135deg, #99281e 0%, #54110b 40%, #290603 80%, #731e16 100%)`;
      ringBoxShadow = `inset 0 0 18px rgba(0,0,0,0.8), 0 6px 16px rgba(0,0,0,0.6)`;
      break;

    case "walnut":
      ringBackground = `linear-gradient(135deg, #784d2f 0%, #422816 45%, #1f1107 85%, #59371e 100%)`;
      ringBoxShadow = `inset 0 0 18px rgba(0,0,0,0.75), 0 5px 14px rgba(0,0,0,0.55)`;
      break;

    case "ebony":
      ringBackground = `linear-gradient(135deg, #383842 0%, #1a1a20 40%, #0d0d12 85%, #2a2a33 100%)`;
      ringBoxShadow = `inset 0 0 20px rgba(0,0,0,0.9), 0 6px 18px rgba(0,0,0,0.7)`;
      break;

    case "gold":
      ringBackground = `linear-gradient(135deg, #fff3b0 0%, #e6b800 25%, #996e00 50%, #ffd700 75%, #b38600 100%)`;
      ringBoxShadow = `inset 0 0 14px rgba(102,74,0,0.6), 0 0 16px ${withAlpha("#e6b800", 0.45)}`;
      break;

    case "silver":
      ringBackground = `linear-gradient(135deg, #ffffff 0%, #e5e7eb 25%, #9ca3af 50%, #f3f4f6 75%, #6b7280 100%)`;
      ringBoxShadow = `inset 0 0 14px rgba(0,0,0,0.35), 0 0 14px rgba(255,255,255,0.25)`;
      break;

    case "bronze":
      ringBackground = `linear-gradient(135deg, #e6ab73 0%, #9c5c23 35%, #59310a 70%, #b87532 100%)`;
      ringBoxShadow = `inset 0 0 16px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.5)`;
      break;

    case "copper":
      ringBackground = `linear-gradient(135deg, #fce7f3 0%, #fb7185 30%, #be123c 65%, #fda4af 100%)`;
      ringBoxShadow = `inset 0 0 16px rgba(159,18,57,0.5), 0 0 14px ${withAlpha("#fb7185", 0.4)}`;
      break;

    case "baroque":
      ringBackground = `repeating-linear-gradient(45deg, #e6b800 0 6px, #8c6000 6px 12px), linear-gradient(135deg, #ffe082 0%, #996e00 100%)`;
      ringBoxShadow = `inset 0 0 0 3px #ffe082, inset 0 0 0 6px #664a00, inset 0 0 18px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.6)`;
      break;

    case "neon":
      ringBackground = baseColor;
      ringBoxShadow = `0 0 24px ${withAlpha(baseColor, 0.9)}, 0 0 12px ${baseColor}, inset 0 0 14px ${withAlpha(baseColor, 0.75)}`;
      break;

    case "neonMagenta":
      ringBackground = `linear-gradient(135deg, #f43f5e, #c026d3)`;
      ringBoxShadow = `0 0 24px ${withAlpha("#f43f5e", 0.85)}, 0 0 12px ${withAlpha("#c026d3", 0.85)}, inset 0 0 14px ${withAlpha("#f43f5e", 0.7)}`;
      break;

    case "neonGreen":
      ringBackground = `linear-gradient(135deg, #4ade80, #16a34a)`;
      ringBoxShadow = `0 0 24px ${withAlpha("#22c55e", 0.85)}, 0 0 12px ${withAlpha("#4ade80", 0.85)}, inset 0 0 14px ${withAlpha("#22c55e", 0.7)}`;
      break;

    case "cyberpunk":
      ringBackground = `repeating-linear-gradient(45deg, #facc15 0 12px, #0f172a 12px 24px)`;
      ringBoxShadow = `0 0 18px rgba(250,204,21,0.5), inset 0 0 10px rgba(0,0,0,0.8)`;
      break;

    case "glass":
      ringBackground = `linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 100%)`;
      ringBoxShadow = `inset 0 0 0 1px rgba(255,255,255,0.4), 0 8px 32px rgba(0,0,0,0.45)`;
      break;

    case "carbon":
      ringBackground = `repeating-radial-gradient(circle, #334155 0 2px, #0f172a 2px 4px)`;
      ringBoxShadow = `inset 0 0 18px rgba(0,0,0,0.8), 0 6px 16px rgba(0,0,0,0.6)`;
      break;

    case "double":
      ringBackground = baseColor;
      ringBoxShadow = `inset 0 0 0 3px ${shade(baseColor, 0.45)}, inset 0 0 0 6px ${shade(baseColor, -0.45)}`;
      break;

    case "triple":
      ringBackground = baseColor;
      ringBoxShadow = `inset 0 0 0 2px #ffffff, inset 0 0 0 5px ${shade(baseColor, -0.3)}, inset 0 0 0 8px #ffffff`;
      break;

    case "dashed":
      ringBackground = withAlpha(baseColor, 0.12);
      ringBorder = `3px dashed ${baseColor}`;
      ringBoxShadow = `0 0 12px ${withAlpha(baseColor, 0.35)}`;
      break;

    case "dotted":
      ringBackground = withAlpha(baseColor, 0.1);
      ringBorder = `4px dotted ${baseColor}`;
      ringBoxShadow = `0 0 10px ${withAlpha(baseColor, 0.3)}`;
      break;

    case "chalk":
      ringBackground = `repeating-linear-gradient(45deg, rgba(248,250,252,0.8) 0 3px, rgba(148,163,184,0.4) 3px 6px)`;
      ringBorder = `2px dashed rgba(255,255,255,0.8)`;
      ringBoxShadow = `0 0 8px rgba(255,255,255,0.4)`;
      break;

    case "groove":
      ringBackground = `linear-gradient(180deg, ${shade(baseColor, -0.4)} 0%, ${shade(baseColor, 0.3)} 50%, ${shade(baseColor, -0.5)} 100%)`;
      ringBoxShadow = `inset 0 4px 8px rgba(0,0,0,0.7), inset 0 -4px 8px rgba(255,255,255,0.15)`;
      break;

    case "ridge":
      ringBackground = `linear-gradient(180deg, ${shade(baseColor, 0.4)} 0%, ${shade(baseColor, -0.4)} 50%, ${shade(baseColor, 0.3)} 100%)`;
      ringBoxShadow = `0 4px 10px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.3)`;
      break;

    case "oak":
      ringBackground = `repeating-linear-gradient(90deg, ${shade(baseColor, 0.25)} 0 3px, ${baseColor} 3px 7px, ${shade(baseColor, -0.2)} 7px 10px)`;
      ringBoxShadow = frame.shadow ? `inset 0 0 14px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.4)` : "none";
      break;

    case "bamboo":
      ringBackground = `repeating-linear-gradient(90deg, #d4e157 0 10px, #9e9d24 10px 12px, #c0ca33 12px 22px)`;
      ringBoxShadow = `inset 0 0 8px rgba(0,0,0,0.25)`;
      break;

    case "marble":
      ringBackground = `linear-gradient(120deg, #f8fafc 0%, #e2e8f0 35%, #94a3b8 48%, #f1f5f9 70%, #cbd5e1 100%)`;
      ringBoxShadow = `inset 0 0 12px rgba(148,163,184,0.5), 0 4px 12px rgba(0,0,0,0.25)`;
      break;

    case "obsidian":
      ringBackground = `linear-gradient(135deg, #312e81 0%, #0f0a1a 45%, #1e1b4b 100%)`;
      ringBoxShadow = `inset 0 0 20px rgba(0,0,0,0.85), 0 0 16px rgba(49,46,129,0.45)`;
      break;

    case "pearl":
      ringBackground = `linear-gradient(135deg, #ffffff 0%, #fce7f3 30%, #e0f2fe 65%, #ffffff 100%)`;
      ringBoxShadow = `inset 0 0 10px rgba(255,255,255,0.8), 0 0 14px rgba(252,231,243,0.5)`;
      break;

    case "ruby":
      ringBackground = `linear-gradient(135deg, #fecaca 0%, #dc2626 35%, #7f1d1d 70%, #f87171 100%)`;
      ringBoxShadow = `inset 0 0 16px rgba(127,29,29,0.7), 0 0 18px ${withAlpha("#dc2626", 0.45)}`;
      break;

    case "emerald":
      ringBackground = `linear-gradient(135deg, #a7f3d0 0%, #059669 40%, #064e3b 75%, #34d399 100%)`;
      ringBoxShadow = `inset 0 0 16px rgba(6,78,59,0.7), 0 0 18px ${withAlpha("#059669", 0.4)}`;
      break;

    case "sapphire":
      ringBackground = `linear-gradient(135deg, #bfdbfe 0%, #1d4ed8 40%, #1e3a8a 75%, #60a5fa 100%)`;
      ringBoxShadow = `inset 0 0 16px rgba(30,58,138,0.7), 0 0 18px ${withAlpha("#1d4ed8", 0.4)}`;
      break;

    case "leather":
      ringBackground = `repeating-linear-gradient(90deg, ${shade(baseColor, 0.1)} 0 8px, ${shade(baseColor, -0.15)} 8px 16px)`;
      ringBoxShadow = `inset 0 0 0 2px ${shade(baseColor, -0.35)}, inset 0 0 14px rgba(0,0,0,0.45)`;
      break;

    case "velvet":
      ringBackground = `linear-gradient(180deg, ${shade(baseColor, 0.25)} 0%, ${shade(baseColor, -0.45)} 55%, ${shade(baseColor, 0.1)} 100%)`;
      ringBoxShadow = `inset 0 0 22px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.5)`;
      break;

    case "cinema":
      ringBackground = `repeating-linear-gradient(90deg, #111 0 10px, #fbbf24 10px 14px, #111 14px 24px)`;
      ringBoxShadow = `0 6px 16px rgba(0,0,0,0.7)`;
      break;

    case "polaroid":
      ringBackground = `#f8fafc`;
      ringBoxShadow = `0 10px 28px rgba(0,0,0,0.35), inset 0 0 0 1px #e2e8f0`;
      break;

    case "comic":
      ringBackground = `#111111`;
      ringBorder = `4px solid #facc15`;
      ringBoxShadow = `4px 4px 0 #facc15`;
      break;

    case "pixel":
      ringBackground = `repeating-linear-gradient(90deg, #22c55e 0 8px, #14532d 8px 16px)`;
      ringBoxShadow = `none`;
      break;

    case "mosaic":
      ringBackground = `repeating-conic-gradient(#f59e0b 0% 12%, #0ea5e9 12% 24%, #ec4899 24% 36%, #22c55e 36% 48%)`;
      ringBoxShadow = `inset 0 0 0 2px #111, 0 4px 10px rgba(0,0,0,0.4)`;
      break;

    case "rainbow":
      ringBackground = `linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899)`;
      ringBoxShadow = `0 0 16px rgba(139,92,246,0.45)`;
      break;

    case "ice":
      ringBackground = `linear-gradient(135deg, #f0f9ff 0%, #7dd3fc 40%, #0284c7 100%)`;
      ringBoxShadow = `inset 0 0 12px rgba(255,255,255,0.7), 0 0 18px ${withAlpha("#38bdf8", 0.5)}`;
      break;

    case "lava":
      ringBackground = `linear-gradient(180deg, #fde047 0%, #ea580c 45%, #7f1d1d 100%)`;
      ringBoxShadow = `0 0 22px ${withAlpha("#ea580c", 0.65)}, inset 0 0 12px rgba(127,29,29,0.6)`;
      break;

    case "paper":
      ringBackground = `linear-gradient(135deg, #fde68a 0%, #d6b56a 55%, #a16207 100%)`;
      ringBoxShadow = `inset 0 0 8px rgba(161,98,7,0.25)`;
      break;

    case "vintage":
      ringBackground = `repeating-linear-gradient(45deg, #92400e 0 5px, #fbbf24 5px 8px, #78350f 8px 13px)`;
      ringBoxShadow = `inset 0 0 0 3px #fbbf24, inset 0 0 14px rgba(0,0,0,0.45)`;
      break;

    case "artDeco":
      ringBackground = `repeating-linear-gradient(90deg, #111 0 10px, #d4af37 10px 14px, #111 14px 24px)`;
      ringBoxShadow = `inset 0 0 0 2px #d4af37, 0 6px 16px rgba(0,0,0,0.55)`;
      break;

    case "celtic":
      ringBackground = `repeating-linear-gradient(45deg, #166534 0 6px, #fbbf24 6px 10px, #14532d 10px 16px)`;
      ringBoxShadow = `inset 0 0 0 2px #fbbf24, 0 4px 12px rgba(0,0,0,0.4)`;
      break;

    case "orichalcum":
      ringBackground = `linear-gradient(135deg, #fdba74 0%, #c2410c 40%, #7c2d12 75%, #fb923c 100%)`;
      ringBoxShadow = `inset 0 0 16px rgba(124,45,18,0.65), 0 0 16px ${withAlpha("#c2410c", 0.4)}`;
      break;

    case "hologram":
      ringBackground = `linear-gradient(120deg, #22d3ee, #a78bfa, #f472b6, #34d399, #22d3ee)`;
      ringBoxShadow = `0 0 20px ${withAlpha("#a78bfa", 0.55)}, inset 0 0 10px rgba(255,255,255,0.35)`;
      break;

    case "thin":
      ringBackground = baseColor;
      ringBoxShadow = "0 2px 6px rgba(0,0,0,0.35)";
      break;

    default:
      ringBackground = "transparent";
      ringBoxShadow = "none";
      break;
  }

  return {
    outerPadding: padding,
    outerRadius,
    innerRadius,
    ringBackground,
    ringBoxShadow,
    ringBorder,
    boardBoxShadow,
  };
}
