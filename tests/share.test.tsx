/**
 * Portable projects (lib/shareBundle): a deck + its bitmaps + its fonts packed
 * into a link or a `.mcqdeck` file, and opened again as an independent,
 * editable copy — both at the module level and through the real editor.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_HEADER, DEFAULT_THEME, type Deck } from "../src/lib/types";
import type { ShapeItem } from "../src/lib/shapes";
import { dataUrlToBlob } from "../src/lib/shapes";
import { deleteImage, getBlob, saveImage } from "../src/lib/imageStore";
import { listCustomFonts } from "../src/lib/customFonts";
import {
  LINK_SAFE_CHARS,
  SHARE_FORMAT,
  SHARE_VERSION,
  ShareLinkError,
  buildShare,
  buildShareBundle,
  decodeShareBundle,
  encodeShareBundle,
  formatBytes,
  installShareBundle,
  isShareBundle,
  isShareFileName,
  parseShareFile,
  readShareToken,
  shareFileName,
  shareLink,
} from "../src/lib/shareBundle";

type Win = Window & typeof globalThis;
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => win.setTimeout(resolve, 0));
  });

const click = (element: Element | null | undefined) =>
  act(() => {
    (element as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });

const button = (label: string, scope: ParentNode = doc) =>
  Array.from(scope.querySelectorAll<HTMLElement>("button")).find((item) => item.textContent?.trim() === label) ?? null;

const headerButton = (part: string) =>
  Array.from(doc.querySelectorAll<HTMLElement>("header button")).find((item) => item.textContent?.includes(part)) ?? null;

const imageShape = (id: string, imageId: string): ShapeItem =>
  ({
    id,
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
    src: "blob:http://localhost/session-only",
    imageId,
  }) as ShapeItem;

const deckWith = (question: string, shapes: ShapeItem[] = []): Deck => ({
  header: { ...DEFAULT_HEADER, title: "Shared practice set" },
  theme: {
    ...DEFAULT_THEME,
    background: { ...DEFAULT_THEME.background, src: PNG },
  },
  slides: [
    {
      id: "shared-1",
      number: "1",
      question,
      options: [
        { key: "ক", text: "First" },
        { key: "খ", text: "Second" },
      ],
      answer: "খ",
      scale: 1,
      showAnswer: false,
      shapes,
    },
    {
      id: "shared-2",
      number: "2",
      question: "Second slide of the shared deck",
      options: [],
      answer: null,
      scale: 1,
      showAnswer: false,
    },
  ],
  globalShapes: [],
});

/** A plain (uncompressed) `j` token, as a browser without streams would make. */
const plainToken = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `j${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
};

export async function runShareTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  const check = (name: string, pass: boolean, detail = "") => {
    out.push({ name, pass: !!pass, detail: String(detail ?? "") });
  };

  let editorRoot: Root | null = null;
  const savedDraft = localStorage.getItem("mcq-slide-studio-v2");
  try {
    /* --------------------------- bundle building --------------------------- */
    const blob = dataUrlToBlob(PNG);
    const first = await saveImage(blob, { filename: "diagram.png", mime: "image/png" });
    const second = await saveImage(blob, { filename: "photo.png", mime: "image/png" });
    const original = deckWith("Which option is correct?", [imageShape("img-1", first.id), imageShape("img-2", second.id)]);

    const built = await buildShareBundle(original, { name: "  Chapter 3 — Algebra  ", currentSlide: 1 });
    check("a bundle is marked with the project format and version", built.bundle.format === SHARE_FORMAT && built.bundle.version === SHARE_VERSION, built.bundle.format);
    check("the project name is trimmed for the recipient", built.bundle.name === "Chapter 3 — Algebra", built.bundle.name);
    check("both slides travel with the bundle", built.bundle.deck.slides.length === 2);
    check("the slide the sender was on travels too", built.bundle.currentSlide === 1, String(built.bundle.currentSlide));
    check("every referenced bitmap is embedded", built.images === 2 && Object.keys(built.bundle.assets).length === 2, `${built.images}`);
    check("the embedded asset keeps its name and bytes", built.bundle.assets[first.id]?.name === "diagram.png" && built.bundle.assets[first.id]?.data.startsWith("data:image/png;base64,"));
    check(
      "the portable deck carries image ids but no session blob: URLs",
      built.bundle.deck.slides[0].shapes?.every((shape) => shape.imageId && !String(shape.src ?? "").startsWith("blob:")),
    );
    check("building never mutates the live deck", original.slides[0].shapes?.[0].src === "blob:http://localhost/session-only");
    check("the background picture stays in the deck itself", built.bundle.deck.theme.background.src === PNG);
    check("a missing bitmap is reported instead of silently dropped", (await buildShareBundle(deckWith("x", [imageShape("gone", "img_missing")]), { name: "x" })).missingImages.length === 1);

    const legacy = { ...imageShape("legacy", "img_legacy"), src: PNG };
    const legacyBundle = await buildShareBundle(deckWith("Legacy picture", [legacy]), { name: "Legacy" });
    check(
      "a picture kept as a data URL on the deck still travels (no store entry needed)",
      legacyBundle.missingImages.length === 0 && legacyBundle.bundle.deck.slides[0].shapes?.[0].src === PNG,
    );

    /* ------------------------------ link round trip ------------------------ */
    const token = await encodeShareBundle(built.bundle);
    check("the encoded project is URL-safe", /^[zj][A-Za-z0-9\-_]+$/.test(token), token.slice(0, 24));
    check("the encoded project is smaller than the raw JSON", token.length < JSON.stringify(built.bundle).length, `${token.length} < ${JSON.stringify(built.bundle).length}`);

    const link = shareLink(token, "https://example.com/editor/");
    check("a shared link puts the project in the hash", link === `https://example.com/editor/#share=${token}`, link.slice(0, 60));
    check("readShareToken finds a full link", readShareToken(link) === token);
    check("readShareToken finds a bare hash", readShareToken(`#share=${token}`) === token);
    check("readShareToken finds a bare token", readShareToken(token) === token);
    check("readShareToken ignores unrelated URLs", readShareToken("https://example.com/editor/#layers") === null);

    const decoded = await decodeShareBundle(link);
    check("decoding the link returns the same project", decoded.name === "Chapter 3 — Algebra" && decoded.deck.slides.length === 2);
    check("decoding keeps the pictures", Object.keys(decoded.assets).length === 2 && decoded.assets[second.id]?.name === "photo.png");
    check("decoding keeps the slide content", decoded.deck.slides[1].question === "Second slide of the shared deck");

    const plain = await decodeShareBundle(plainToken(built.bundle));
    check("a link made without compression support still opens", plain.deck.slides[0].question === "Which option is correct?");

    const friendly = async (value: string) => {
      try {
        await decodeShareBundle(value);
        return "";
      } catch (err) {
        return err instanceof ShareLinkError ? err.message : String((err as Error)?.message ?? err);
      }
    };
    check("a truncated link fails with a readable message", /incomplete|damaged/.test(await friendly(link.slice(0, -30))), await friendly(link.slice(0, -30)));
    check("a link with no project data is refused", (await friendly("https://example.com/editor/")).length > 0);
    check("an unrelated page is refused", (await friendly("https://example.com/")).length > 0);
    check(
      "a newer bundle version is refused by name",
      /newer version/.test(await friendly(plainToken({ ...built.bundle, version: SHARE_VERSION + 1 }))),
    );

    /* -------------------------------- files ------------------------------- */
    const fileName = shareFileName('Chapter 3 — Algebra: "final" / v2');
    check("the project file gets a safe, readable name", fileName.endsWith(".mcqdeck") && !/[\\/:*?"<>|]/.test(fileName), fileName);
    check("a .mcqdeck file is recognised on drop", isShareFileName(fileName) && isShareFileName("deck.mcqdeck.json") && !isShareFileName("photo.png"));
    check("a saved bundle parses back", parseShareFile(JSON.stringify(built.bundle)).deck.slides.length === 2);
    check("a plain deck is not mistaken for a bundle", !isShareBundle({ slides: [] }) && !isShareBundle(original));
    let badFile = "";
    try {
      parseShareFile("{not json");
    } catch (err) {
      badFile = (err as Error).message;
    }
    check("a broken project file is refused", /could not be read/.test(badFile), badFile);
    check("sizes are human readable", formatBytes(999) === "999 B" && formatBytes(2048) === "2 KB", `${formatBytes(999)} · ${formatBytes(2048)}`);

    /* ------------------------------- opening ------------------------------ */
    const installed = await installShareBundle(built.bundle);
    const incoming = installed.deck.slides[0].shapes?.[0];
    check("opening writes both bitmaps into this browser", installed.images === 2, String(installed.images));
    check("the recipient's copy points at fresh image ids", !!incoming?.imageId && incoming.imageId !== first.id, `${incoming?.imageId} vs ${first.id}`);
    check("the recipient's copy renders its picture immediately", !!incoming?.src && incoming.src.startsWith("data:image/png"), String(incoming?.src).slice(0, 25));

    const back = incoming?.imageId ? await getBlob(incoming.imageId) : null;
    const originalBytes = new Uint8Array(await blob.arrayBuffer());
    const backBytes = back ? new Uint8Array(await back.arrayBuffer()) : new Uint8Array();
    check(
      "the stored bitmap is byte-for-byte the shared one",
      backBytes.length === originalBytes.length && backBytes.every((b, i) => b === originalBytes[i]),
      `${backBytes.length} vs ${originalBytes.length}`,
    );

    const again = await installShareBundle(built.bundle);
    const secondCopy = again.deck.slides[0].shapes?.[0];
    check("opening the same project twice never reuses an image id", secondCopy?.imageId !== incoming?.imageId);
    check("the second copy is just as complete", (await getBlob(secondCopy!.imageId!))?.size === blob.size);

    /* -------------------------------- fonts ------------------------------- */
    const customFont = {
      family: "Share Test Font",
      script: "bengali" as const,
      kind: "sans" as const,
      data: btoa("pretend-font-bytes"),
      mime: "font/ttf",
      added: 1,
    };
    localStorage.setItem("custom-fonts-v1", JSON.stringify([customFont]));
    const fontDeck: Deck = { ...deckWith("Font deck"), theme: { ...DEFAULT_THEME, bengaliFont: "'Share Test Font', sans-serif" } };
    const withoutFont = await buildShare(fontDeck, { name: "Fonts", includeFonts: false });
    check("fonts are opt-in, so a sender can share without passing the font file on", withoutFont.bundle.fonts.length === 0);
    const withFont = await buildShareBundle(fontDeck, { name: "Fonts" });
    check("a custom font the deck uses is packed with it", withFont.bundle.fonts.length === 1 && withFont.bundle.fonts[0].family === "Share Test Font");
    localStorage.removeItem("custom-fonts-v1");
    const fontRecipient = await installShareBundle(withFont.bundle);
    check("the recipient gets the shared font installed", fontRecipient.fonts === 1 && listCustomFonts().some((f) => f.family === "Share Test Font"));

    /* ------------------------------ real editor --------------------------- */
    localStorage.removeItem("mcq-slide-studio-v2");
    const incomingBundle = await buildShareBundle(deckWith("Shared question from a link"), { name: "Shared from a link", currentSlide: 0 });
    const incomingToken = await encodeShareBundle(incomingBundle.bundle);
    win.history.replaceState(null, "", `/#share=${incomingToken}`);

    act(() => {
      editorRoot = createRoot(doc.getElementById("root")!);
      editorRoot.render(createElement(App));
    });
    await settle();
    await settle();

    const sharedDialog = () => doc.querySelector<HTMLElement>("[data-shared-project]");
    check("a share link opens a dialog instead of replacing the editor", !!sharedDialog());
    check("the dialog names the project that was sent", sharedDialog()?.querySelector("[data-shared-name]")?.textContent?.trim() === "Shared from a link");
    check("the dialog offers to open it for editing", !!button("Open for editing", sharedDialog() ?? doc));
    check("the dialog explains the copy is independent", !!sharedDialog()?.textContent?.includes("You get your own editable copy"));

    click(button("Open for editing", sharedDialog() ?? doc));
    for (let i = 0; i < 4; i++) await settle();

    check("opening the shared project puts its slide in the editor", !!doc.querySelector('.slide-editable [data-el="question"]')?.textContent?.includes("Shared question from a link"));
    check("the dialog closes once the project is open", !sharedDialog());
    check("the share data is cleared from the address bar", !win.location.hash.includes("share="), win.location.hash);
    check("a shared project starts with a clean undo history", (doc.querySelector('header button[title="Nothing to undo"]') as HTMLButtonElement | null)?.disabled === true);

    click(headerButton("My project"));
    await settle();
    const projectName = doc.querySelector<HTMLInputElement>("#project-name");
    check("saving the shared copy offers the sender's project name", projectName?.value === "Shared from a link", projectName?.value);
    click(doc.querySelector('[aria-label="Close My project"]'));
    await settle();

    check("the toolbar offers Share next to the project actions", !!headerButton("Share"));
    click(headerButton("🔗 Share"));
    await settle();
    await settle();
    await settle();
    const shareDialog = () => doc.querySelector<HTMLElement>("[data-share-modal]");
    check("Share opens the sharing dialog", !!shareDialog());
    const linkField = shareDialog()?.querySelector<HTMLInputElement>("[data-share-link]");
    check(
      "the dialog produces a link carrying the project",
      !!linkField?.value.includes(`#share=`),
      String(linkField?.value).slice(0, 45),
    );
    check("the link stays in the safe range for a text-only project", linkField?.value.length !== undefined && linkField.value.length < LINK_SAFE_CHARS, String(linkField?.value.length));
    check("the dialog offers a portable project file", !!shareDialog()?.querySelector("[data-share-file]") && !!button("⬇ Download .mcqdeck", shareDialog() ?? doc));
    click(doc.querySelector('[aria-label="Close Share project"]'));
    await settle();
    check("the sharing dialog closes", !shareDialog());

    act(() => editorRoot?.unmount());
    editorRoot = null;

    /* ---------------------------- damaged link ---------------------------- */
    win.history.replaceState(null, "", "/#share=zAAAA");
    const errors: string[] = [];
    const onErr = (event: ErrorEvent) => errors.push(String(event.message));
    win.addEventListener("error", onErr as EventListener);
    act(() => {
      editorRoot = createRoot(doc.getElementById("root")!);
      editorRoot.render(createElement(App));
    });
    await settle();
    await settle();
    check(
      "a damaged link explains itself without changing the deck",
      !!sharedDialog()?.querySelector('[role="alert"]') && !!sharedDialog()?.textContent?.includes("Nothing in your editor has been changed"),
      sharedDialog()?.querySelector('[role="alert"]')?.textContent ?? "no dialog",
    );
    check("a damaged link raises no uncaught error", errors.length === 0, errors.join(" | "));
    click(button("Close", sharedDialog() ?? doc));
    await settle();
    check("dismissing the damaged link clears it from the address bar", !win.location.hash.includes("share="), win.location.hash);

    act(() => editorRoot?.unmount());
    editorRoot = null;

    /* ------------------------------ cleanup ------------------------------- */
    for (const id of [first.id, second.id, incoming?.imageId, secondCopy?.imageId]) if (id) await deleteImage(id);
    win.history.replaceState(null, "", "/");
    localStorage.removeItem("custom-fonts-v1");
    localStorage.removeItem("mcq-slide-studio-v2");
  } catch (reason) {
    check("the complete sharing flow runs", false, String((reason as Error)?.stack ?? reason));
    try {
      act(() => editorRoot?.unmount());
    } catch {
      /* ignore */
    }
    win.history.replaceState(null, "", "/");
  } finally {
    if (savedDraft) localStorage.setItem("mcq-slide-studio-v2", savedDraft);
    localStorage.removeItem("custom-fonts-v1");
  }

  return out;
}
