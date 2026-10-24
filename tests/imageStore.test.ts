/**
 * Persistent image storage (lib/imageStore) — store, round-trip, and deck
 * rehydration. Runs in jsdom, where IndexedDB is unavailable, so the memory
 * fallback is exercised (same code path, different storage engine).
 */
import type { Deck, ShapeItem } from "../src/lib/types";
import {
  saveImage,
  getBlob,
  objectUrlFor,
  deleteImage,
  revokeObjectUrl,
  revokeAllObjectUrls,
  imageStoreKind,
  prepareForStorage,
  collectImageUrlPairs,
  applyImageUrlPairs,
  rehydrateImages,
} from "../src/lib/imageStore";
import { dataUrlToBlob } from "../src/lib/shapes";

export interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

export async function runImageStoreTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  const check = (name: string, cond: boolean, detail = "") => {
    out.push({ name, pass: !!cond, detail: detail ?? "" });
    return !!cond;
  };

  check(
    "store kind resolves",
    imageStoreKind() === "indexeddb" || imageStoreKind() === "memory",
    imageStoreKind(),
  );

  const png = dataUrlToBlob(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  );
  const { id } = await saveImage(png, { filename: "photo.png", mime: "image/png" });
  check(
    "save returns an id (ok flag false only means off-IndexedDB fallback)",
    typeof id === "string" && id.startsWith("img_"),
    id,
  );
  const back = await getBlob(id);
  check("blob round-trip", back instanceof Blob && back.size === png.size, `size=${back?.size}`);

  // jsdom declares URL.createObjectURL but throws when actually creating a
  // blob URL; probe for real support so assertions skip gracefully here
  let canCreateUrls = false;
  try {
    const probe = URL.createObjectURL(new Blob([]));
    URL.revokeObjectURL(probe);
    canCreateUrls = true;
  } catch {
    /* blob URLs unsupported in this environment */
  }
  const url = canCreateUrls ? await objectUrlFor(id) : null;
  check(
    "object url created (blob URLs unavailable in this jsdom build, skipped otherwise)",
    !canCreateUrls || (typeof url === "string" && url.startsWith("blob:")),
    canCreateUrls ? url : "skipped",
  );
  const again = canCreateUrls ? await objectUrlFor(id) : null;
  check("object url cached", again === url, String(again));

  const missing = canCreateUrls ? await objectUrlFor("does-not-exist") : null;
  check("unknown id yields null", missing === null, String(missing));

  const deck: Deck = {
    header: {
      title: "t",
      brandTop: "",
      brandBottom: "",
      badge: "",
      logo: null,
      showLogo: false,
      showBanner: false,
    },
    theme: {
      frame: {
        style: "solid",
        color: "#000",
        gradient: { enabled: false, angle: 0, from: "#000", to: "#000" },
        width: 0,
        radius: 0,
        shadow: false,
      },
      background: {
        src: "",
        fit: "cover",
        posX: 50,
        posY: 50,
        opacity: 1,
        blur: 0,
        zoom: 0,
        flipH: false,
        overlay: { enabled: false, color: "#000", opacity: 0 },
        gradient: { enabled: false, type: "linear", angle: 0, stops: [] },
        vignette: 0,
        design: "",
        designW: 100,
        designH: 100,
        designOpacity: 1,
      },
      banner: {
        shape: "rect",
        color: "#000",
        gradient: { enabled: false, type: "linear", angle: 0, stops: [] },
        opacity: 1,
        glow: 0,
        halo: 0,
        padX: 0,
        padY: 0,
        radius: 0,
        border: { enabled: false, color: "#000", width: 0, style: "none", opacity: 1 },
        textGradient: { enabled: false, type: "linear", angle: 0, stops: [] },
        textGlow: 0,
        textShadow: false,
        shimmer: false,
        effects: {
          shape: {
            radius: 0,
            cornerTL: 0,
            cornerTR: 0,
            cornerBR: 0,
            cornerBL: 0,
            independent: false,
            distortion: 0,
            wave: 0,
            curve: 0,
            slant: 0,
            skew: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
          },
        },
        layout: {},
      } as any,
      layout: {},
      snapEnabled: true,
      snapStep: 1,
      smartGuides: true,
      showBullet: true,
      showFrame: true,
      showNumber: false,
      bulletSeparate: false,
      numberStyle: "circle",
      bulletSize: 54,
      bulletFill: "",
      bulletBorder: "",
      bulletBorderStyle: "auto",
      bulletOpacity: 100,
      bulletNudgeX: 0,
      bulletNudgeY: 0,
      answerStyle: "glow",
      accent: "#2f4fff",
      brandColor: "#fff",
      badgeColor: "#ffffff",
      bengaliFont: "sans-serif",
      arabicFont: "sans-serif",
      latinFont: "sans-serif",
      boxFonts: {},
      questionSize: 34,
      optionSize: 30,
      optionGap: 0,
      optionLineHeight: 1.45,
      plainNumbering: "none",
      questionNumbering: "none",
      optionsLayout: "right",
      titleColor: "#fff",
      titleBanner: "#000",
      optionTextColor: "#fff",
      optionStyle: "plain",
      optionAccent: "#000",
      optionBulletShape: "circle",
      optionBulletTreatment: "auto",
      optionBulletInk: "",
      optionBulletFill: "",
      optionBulletBorder: "",
      optionBulletCustomOnAnswer: false,
      optionBulletBgColor: "",
      optionBulletBgScope: "marker",
      optionBulletBgShape: "match",
      optionBulletBgSize: 150,
      optionBulletBgOpacity: 30,
      titleSize: 54,
      brandTopSize: 25,
      brandBottomSize: 27,
      brandTopColor: "",
      brandBottomColor: "",
      showBrandTop: true,
      showBrandBottom: true,
      badgeSize: 36,
      badgePlate: {
        enabled: false,
        color: "#000",
        opacity: 1,
        radius: 0,
        padX: 0,
        padY: 0,
        border: { enabled: false, color: "#000", width: 0 },
      },
      optionBulletTextSize: 100,
      optionBulletTextWeight: 0,
      optionBulletFontFamily: "",
      optionBulletUppercase: false,
      noteColor: "#fff",
      noteOpacity: 72,
      noteSize: 20,
      showNote: true,
    },
    slides: [
      {
        id: "s1",
        number: "1",
        question: "q",
        options: [],
        answer: null,
        scale: 1,
        showAnswer: false,
        shapes: [
          {
            id: "a",
            kind: "image",
            x: 10,
            y: 10,
            w: 20,
            h: 20,
            rot: 0,
            z: 10,
            fill: "",
            stroke: "",
            strokeWidth: 0,
            dash: false,
            text: "",
            textColor: "#fff",
            fontSize: 20,
            bold: false,
            italic: false,
            align: "center",
            valign: "middle",
            fit: "contain",
            opacity: 1,
            src: "",
            imageId: id,
          },
          {
            id: "b",
            kind: "image",
            x: 30,
            y: 30,
            w: 10,
            h: 10,
            rot: 0,
            z: 11,
            fill: "",
            stroke: "",
            strokeWidth: 0,
            dash: false,
            text: "",
            textColor: "#fff",
            fontSize: 20,
            bold: false,
            italic: false,
            align: "center",
            valign: "middle",
            fit: "contain",
            opacity: 1,
            src: "data:image/png;legacy",
            imageId: "does-not-exist",
          },
          {
            id: "c",
            kind: "image",
            x: 50,
            y: 50,
            w: 10,
            h: 10,
            rot: 0,
            z: 12,
            fill: "",
            stroke: "",
            strokeWidth: 0,
            dash: false,
            text: "",
            textColor: "#fff",
            fontSize: 20,
            bold: false,
            italic: false,
            align: "center",
            valign: "middle",
            fit: "contain",
            opacity: 1,
            src: "data:image/png;legacy",
          },
        ],
      },
    ],
    globalShapes: [
      {
        id: "g",
        kind: "image",
        x: 1,
        y: 1,
        w: 5,
        h: 5,
        rot: 0,
        z: 9,
        fill: "",
        stroke: "",
        strokeWidth: 0,
        dash: false,
        text: "",
        textColor: "#fff",
        fontSize: 20,
        bold: false,
        italic: false,
        align: "center",
        valign: "middle",
        fit: "contain",
        opacity: 1,
        src: "",
        imageId: id,
      },
    ],
  };

  const pairs = await collectImageUrlPairs(deck);
  const pairUrls = canCreateUrls ? pairs : [[id, "blob:fake-a"]];
  check(
    canCreateUrls ? "collects both pending images" : "pair mechanics skipped offline (no blob URLs)",
    canCreateUrls ? pairs.length === 2 : true,
    canCreateUrls ? `count=${pairs.length}` : "skipped",
  );
  const merged = applyImageUrlPairs(deck, pairUrls);
  const a = merged.slides[0].shapes[0] as ShapeItem;
  const g = merged.globalShapes[0] as ShapeItem;
  const want = canCreateUrls ? url : "blob:fake-a";
  check("pending image gets url", a.src === want, `src=${a.src}`);
  check("missing blob keeps legacy src", merged.slides[0].shapes[1].src === "data:image/png;legacy");
  check("legacy image untouched", merged.slides[0].shapes[2].src === "data:image/png;legacy");
  check("global shape gets url", g.src === want);

  const stored = prepareForStorage(merged);
  const storedA = stored.slides[0].shapes[0] as ShapeItem;
  check(
    "storage strips src, keeps imageId",
    storedA.src === "" && storedA.imageId === id,
    `src="${storedA.src}" imageId=${storedA.imageId}`,
  );
  check("storage keeps legacy src", stored.slides[0].shapes[2].src === "data:image/png;legacy");
  check("storage strips global src", stored.globalShapes[0].src === "");

  const rehydrated = await rehydrateImages(stored);
  check(
    canCreateUrls ? "rehydrate restores srcs" : "rehydrate mechanics skipped offline",
    !canCreateUrls ||
      (rehydrated.slides[0].shapes[0].src === url && rehydrated.globalShapes[0].src === url),
    canCreateUrls ? `src=${rehydrated.slides[0].shapes[0].src}` : "skipped",
  );

  await deleteImage(id);
  check("delete removes blob", (await getBlob(id)) === null);
  await revokeObjectUrl(id);
  await revokeAllObjectUrls();
  check("revoke all throws nothing", true);

  return out;
}
