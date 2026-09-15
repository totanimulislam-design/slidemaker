export interface FrameImage {
  id: string;
  name: string;
  src: string;
  kind: "photo" | "vector";
  /** How much of the slide to punch out as the inner opening, percent. */
  inset: number;
}

/**
 * Vector frame overlays, served from /frames/. Each design is a full 1280×720
 * SVG with a transparent opening so the slide board always shows through.
 * The collection spans minimal, certificate, classic ornamental, modern
 * geometric, Islamic and bold-band styles.
 */
export const FRAME_IMAGES: FrameImage[] = [
  // ---- minimal / clean ----------------------------------------------------
  { id: "hairline", name: "Hairline", src: "/frames/frame-hairline.svg", kind: "vector", inset: 3 },
  { id: "thin-gold", name: "Thin Gold Rule", src: "/frames/frame-thin-gold.svg", kind: "vector", inset: 5 },
  { id: "scholar", name: "Scholar", src: "/frames/frame-scholar.svg", kind: "vector", inset: 6 },
  { id: "blueprint", name: "Blueprint Dash", src: "/frames/frame-blueprint.svg", kind: "vector", inset: 6 },
  { id: "dotted", name: "Dotted Outline", src: "/frames/frame-dotted.svg", kind: "vector", inset: 6 },
  // ---- certificate / academic ---------------------------------------------
  { id: "double-rule", name: "Double Rule", src: "/frames/frame-double-rule.svg", kind: "vector", inset: 7 },
  { id: "triple-rule", name: "Triple Rule", src: "/frames/frame-triple-rule.svg", kind: "vector", inset: 9 },
  { id: "certificate", name: "Certificate", src: "/frames/frame-certificate.svg", kind: "vector", inset: 7 },
  { id: "award-gold", name: "Award Gold", src: "/frames/frame-certificate-gold.svg", kind: "vector", inset: 8 },
  { id: "academic", name: "Academic Navy", src: "/frames/frame-academic.svg", kind: "vector", inset: 9 },
  // ---- classic / ornamental ------------------------------------------------
  { id: "emerald", name: "Emerald Elegant", src: "/frames/frame-emerald.svg", kind: "vector", inset: 9 },
  { id: "fleur", name: "Fleur Quatrefoil", src: "/frames/frame-fleur.svg", kind: "vector", inset: 7 },
  { id: "arabesque", name: "Arabesque", src: "/frames/frame-arabesque.svg", kind: "vector", inset: 9 },
  { id: "victorian", name: "Victorian Mahogany", src: "/frames/frame-victorian.svg", kind: "vector", inset: 10 },
  { id: "baroque-gold", name: "Baroque Gold", src: "/frames/frame-baroque-gold.svg", kind: "vector", inset: 11 },
  { id: "greek-key", name: "Greek Key", src: "/frames/frame-greek-key.svg", kind: "vector", inset: 10 },
  // ---- modern / geometric ---------------------------------------------------
  { id: "art-deco", name: "Art Deco", src: "/frames/frame-art-deco.svg", kind: "vector", inset: 9 },
  { id: "corner-blocks", name: "Corner Blocks", src: "/frames/frame-geo-corners.svg", kind: "vector", inset: 8 },
  { id: "corner-triangles", name: "Corner Triangles", src: "/frames/frame-geo-triangles.svg", kind: "vector", inset: 9 },
  { id: "diagonal-cut", name: "Diagonal Cut", src: "/frames/frame-diagonal.svg", kind: "vector", inset: 9 },
  // ---- islamic / elegant patterns --------------------------------------------
  { id: "islamic-star", name: "Islamic Star Band", src: "/frames/frame-islamic-star.svg", kind: "vector", inset: 9 },
  { id: "girih", name: "Girih Interlace", src: "/frames/frame-girih.svg", kind: "vector", inset: 10 },
  { id: "mihrab", name: "Mihrab Arches", src: "/frames/frame-mihrab.svg", kind: "vector", inset: 10 },
  // ---- bold bands / rounded ---------------------------------------------------
  { id: "charcoal-mat", name: "Charcoal Mat", src: "/frames/frame-thick-band.svg", kind: "vector", inset: 10 },
  { id: "two-tone", name: "Two-Tone Band", src: "/frames/frame-two-tone.svg", kind: "vector", inset: 10 },
  { id: "rounded-card", name: "Rounded Card", src: "/frames/frame-rounded.svg", kind: "vector", inset: 8 },
  { id: "rounded-double", name: "Rounded Double", src: "/frames/frame-rounded-double.svg", kind: "vector", inset: 10 },
];

export const frameImageById = (id?: string) => FRAME_IMAGES.find((f) => f.id === id);

/**
 * Maps frame image sources saved by older versions of the app (photo frames
 * and the previous SVG set) onto the closest design in the current collection,
 * so previously saved decks keep showing a frame instead of a broken image.
 */
const LEGACY_FRAME_SRC: Record<string, string> = {
  // retired photo frames
  "/frames/gold-baroque.jpg": "/frames/frame-baroque-gold.svg",
  "/frames/floral-gold.jpg": "/frames/frame-victorian.svg",
  "/frames/vintage-gilt.jpg": "/frames/frame-certificate-gold.svg",
  "/frames/carved-oak.jpg": "/frames/frame-victorian.svg",
  "/frames/dark-walnut.jpg": "/frames/frame-thick-band.svg",
  "/frames/rustic-barn.jpg": "/frames/frame-victorian.svg",
  "/frames/silver-ornate.jpg": "/frames/frame-baroque-gold.svg",
  "/frames/white-gallery.jpg": "/frames/frame-scholar.svg",
  "/frames/black-lacquer.jpg": "/frames/frame-thick-band.svg",
  "/frames/art-nouveau.jpg": "/frames/frame-arabesque.svg",
  // retired vector frames
  "/frames/svg-gold.svg": "/frames/frame-baroque-gold.svg",
  "/frames/svg-silver.svg": "/frames/frame-scholar.svg",
  "/frames/svg-rose.svg": "/frames/frame-fleur.svg",
  "/frames/svg-emerald.svg": "/frames/frame-emerald.svg",
  "/frames/svg-obsidian.svg": "/frames/frame-thick-band.svg",
  "/frames/svg-neon.svg": "/frames/frame-geo-triangles.svg",
  "/frames/svg-double-line.svg": "/frames/frame-double-rule.svg",
  "/frames/svg-art-deco.svg": "/frames/frame-art-deco.svg",
  "/frames/svg-cinema.svg": "/frames/frame-thick-band.svg",
  "/frames/svg-rainbow.svg": "/frames/frame-two-tone.svg",
  "/frames/svg-celtic.svg": "/frames/frame-greek-key.svg",
  "/frames/svg-thin-gold.svg": "/frames/frame-thin-gold.svg",
  "/frames/svg-dashed.svg": "/frames/frame-blueprint.svg",
  "/frames/svg-polaroid.svg": "/frames/frame-rounded.svg",
  "/frames/svg-ice.svg": "/frames/frame-scholar.svg",
  "/frames/svg-lava.svg": "/frames/frame-diagonal.svg",
};

/**
 * Normalises a stored frame image src. Current assets and user uploads
 * (data:/http) pass through; retired built-in paths are remapped to their
 * successor in the new collection, and unknown built-in paths are dropped so
 * a stale reference can never render a broken frame.
 */
export function resolveFrameImageSrc(src?: string): string | undefined {
  if (!src) return undefined;
  if (FRAME_IMAGES.some((f) => f.src === src)) return src;
  if (src.startsWith("/frames/")) return LEGACY_FRAME_SRC[src];
  return src;
}
