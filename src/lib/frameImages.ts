export interface FrameImage {
  id: string;
  name: string;
  src: string;
  kind: "photo" | "vector";
  /** How much of the slide to punch out as the inner opening, percent. */
  inset: number;
}

/** Photo and vector frame overlays. Paths are served from /frames/. */
export const FRAME_IMAGES: FrameImage[] = [
  { id: "gold-baroque", name: "Gold Baroque", src: "/frames/gold-baroque.jpg", kind: "photo", inset: 11 },
  { id: "floral-gold", name: "Floral Gold", src: "/frames/floral-gold.jpg", kind: "photo", inset: 12 },
  { id: "vintage-gilt", name: "Vintage Gilt", src: "/frames/vintage-gilt.jpg", kind: "photo", inset: 11 },
  { id: "carved-oak", name: "Carved Oak", src: "/frames/carved-oak.jpg", kind: "photo", inset: 10 },
  { id: "dark-walnut", name: "Dark Walnut", src: "/frames/dark-walnut.jpg", kind: "photo", inset: 10 },
  { id: "rustic-barn", name: "Rustic Barn", src: "/frames/rustic-barn.jpg", kind: "photo", inset: 10 },
  { id: "silver-ornate", name: "Silver Ornate", src: "/frames/silver-ornate.jpg", kind: "photo", inset: 11 },
  { id: "white-gallery", name: "White Gallery", src: "/frames/white-gallery.jpg", kind: "photo", inset: 9 },
  { id: "black-lacquer", name: "Black Lacquer", src: "/frames/black-lacquer.jpg", kind: "photo", inset: 9 },
  { id: "art-nouveau", name: "Art Nouveau", src: "/frames/art-nouveau.jpg", kind: "photo", inset: 11 },
  { id: "svg-gold", name: "Gold Bevel", src: "/frames/svg-gold.svg", kind: "vector", inset: 8 },
  { id: "svg-silver", name: "Silver Bevel", src: "/frames/svg-silver.svg", kind: "vector", inset: 8 },
  { id: "svg-rose", name: "Rose Gold", src: "/frames/svg-rose.svg", kind: "vector", inset: 8 },
  { id: "svg-emerald", name: "Emerald Bevel", src: "/frames/svg-emerald.svg", kind: "vector", inset: 8 },
  { id: "svg-obsidian", name: "Obsidian", src: "/frames/svg-obsidian.svg", kind: "vector", inset: 8 },
  { id: "svg-neon", name: "Neon Tube", src: "/frames/svg-neon.svg", kind: "vector", inset: 7 },
  { id: "svg-double", name: "Certificate Lines", src: "/frames/svg-double-line.svg", kind: "vector", inset: 6 },
  { id: "svg-deco", name: "Art Deco Corners", src: "/frames/svg-art-deco.svg", kind: "vector", inset: 8 },
  { id: "svg-cinema", name: "Film Strip", src: "/frames/svg-cinema.svg", kind: "vector", inset: 8 },
  { id: "svg-rainbow", name: "Rainbow Band", src: "/frames/svg-rainbow.svg", kind: "vector", inset: 7 },
  { id: "svg-celtic", name: "Celtic Gold", src: "/frames/svg-celtic.svg", kind: "vector", inset: 8 },
  { id: "svg-thin-gold", name: "Thin Gold Line", src: "/frames/svg-thin-gold.svg", kind: "vector", inset: 3 },
  { id: "svg-dashed", name: "Blueprint Dash", src: "/frames/svg-dashed.svg", kind: "vector", inset: 4 },
  { id: "svg-polaroid", name: "Polaroid Mat", src: "/frames/svg-polaroid.svg", kind: "vector", inset: 7 },
  { id: "svg-ice", name: "Ice Crystal", src: "/frames/svg-ice.svg", kind: "vector", inset: 8 },
  { id: "svg-lava", name: "Lava Band", src: "/frames/svg-lava.svg", kind: "vector", inset: 8 },
];

export const frameImageById = (id?: string) => FRAME_IMAGES.find((f) => f.id === id);
