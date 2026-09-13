import type { ThemeSettings } from "./types";

export const BENGALI_FONTS = [
  { label: "Anek Bangla", value: "'Anek Bangla', sans-serif" },
  { label: "Noto Sans Bengali", value: "'Noto Sans Bengali', sans-serif" },
  { label: "Hind Siliguri", value: "'Hind Siliguri', sans-serif" },
  { label: "Baloo Da 2", value: "'Baloo Da 2', sans-serif" },
  { label: "Tiro Bangla", value: "'Tiro Bangla', serif" },
];

/** Faces that shape Arabic / Urdu correctly (used for Dakhil & Quranic text). */
export const ARABIC_FONTS = [
  { label: "Noto Naskh Arabic (traditional)", value: "'Noto Naskh Arabic'" },
  { label: "Amiri (Quranic naskh)", value: "'Amiri'" },
  { label: "Noto Sans Arabic (modern)", value: "'Noto Sans Arabic'" },
];

export const LATIN_FONTS = [
  { label: "Oswald (condensed)", value: "'Oswald', sans-serif" },
  { label: "Poppins (modern)", value: "'Poppins', sans-serif" },
  { label: "Inter (neutral)", value: "'Inter', sans-serif" },
  { label: "Anton (heavy)", value: "'Anton', sans-serif" },
  { label: "Bebas Neue (tall)", value: "'Bebas Neue', sans-serif" },
  { label: "Noto Sans (widest coverage)", value: "'Noto Sans', sans-serif" },
];

export interface Preset {
  name: string;
  swatch: string[];
  theme: Partial<ThemeSettings>;
}

export const PRESETS: Preset[] = [
  {
    name: "Classic Board",
    swatch: ["#e6a15c", "#050507", "#ffd633"],
    theme: {
      frameOuter: "#0a0a0c",
      frameInner: "#e6a15c",
      board: "#050507",
      titleColor: "#ffd633",
      titleBanner: "#1f5fd0",
      questionColor: "#ffd94a",
      optionTextColor: "#ffffff",
      accent: "#2f4fff",
      brandColor: "#ffffff",
      badgeColor: "#ffffff",
    },
  },
  {
    name: "Green Board",
    swatch: ["#c69558", "#0d2a1d", "#ffe27a"],
    theme: {
      frameOuter: "#08120d",
      frameInner: "#c69558",
      board: "#0d2a1d",
      titleColor: "#ffe27a",
      titleBanner: "#0f7a4d",
      questionColor: "#fff2c4",
      optionTextColor: "#ffffff",
      accent: "#27c07a",
      brandColor: "#ffffff",
      badgeColor: "#ffe27a",
    },
  },
  {
    name: "Midnight Neon",
    swatch: ["#6d5cff", "#0b0f1f", "#5ef2ff"],
    theme: {
      frameOuter: "#05060f",
      frameInner: "#6d5cff",
      board: "#0b0f1f",
      titleColor: "#5ef2ff",
      titleBanner: "#4423b8",
      questionColor: "#e9f4ff",
      optionTextColor: "#ffffff",
      accent: "#7c5cff",
      brandColor: "#c9d6ff",
      badgeColor: "#5ef2ff",
    },
  },
  {
    name: "Royal Maroon",
    swatch: ["#d9b45b", "#1a0508", "#ffd98a"],
    theme: {
      frameOuter: "#120306",
      frameInner: "#d9b45b",
      board: "#26060c",
      titleColor: "#ffd98a",
      titleBanner: "#8a1029",
      questionColor: "#ffe9b8",
      optionTextColor: "#ffffff",
      accent: "#e0446b",
      brandColor: "#ffffff",
      badgeColor: "#ffd98a",
    },
  },
  {
    name: "Clean Paper",
    swatch: ["#1e3a8a", "#f8fafc", "#0f172a"],
    theme: {
      frameOuter: "#e2e8f0",
      frameInner: "#1e3a8a",
      board: "#f8fafc",
      titleColor: "#ffffff",
      titleBanner: "#1e3a8a",
      questionColor: "#0f172a",
      optionTextColor: "#1e293b",
      accent: "#1d4ed8",
      brandColor: "#0f172a",
      badgeColor: "#1e3a8a",
    },
  },
];

export const MATH_SNIPPETS = [
  { label: "x²", insert: "$x^2$" },
  { label: "a⁄b", insert: "$\\frac{a}{b}$" },
  { label: "√x", insert: "$\\sqrt{x}$" },
  { label: "∑", insert: "$\\sum_{i=1}^{n}$" },
  { label: "∫", insert: "$\\int_{a}^{b}$" },
  { label: "log", insert: "$\\log_{2}{x}$" },
  { label: "π", insert: "$\\pi$" },
  { label: "θ", insert: "$\\theta$" },
  { label: "≤", insert: "$\\leq$" },
  { label: "∞", insert: "$\\infty$" },
];
