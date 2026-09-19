/**
 * Per-part text style suite.
 *
 * Badge 1, Badge 2, Badge 3, the title, the question, the number inside the
 * question bullet, the option text, the letter inside the option markers, the
 * footnote and a custom text box each get the full text toolkit — font (the
 * whole Google catalogue), size (0 → ∞), colour, bold / italic /
 * strikethrough, case, alignment, letter & line spacing, opacity,
 * Canva-style effects and a position nudge — from the inspector destination
 * AND the toolbar line above the board.
 *
 * Every test here pins the one rule that makes those controls trustworthy:
 * a control changes the rendered text node of EXACTLY that part, never the
 * merged block it is painted inside (the other brand line, the bullet's
 * shape, the marker's silhouette, the banner…).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO } from "../src/lib/types";

type Win = Window & typeof globalThis & { PointerEvent: new (t: string, i?: unknown) => Event };
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

const click = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

/** React-controlled inputs only accept a write through the native setter */
const type = (el: HTMLInputElement | HTMLTextAreaElement | null, value: string) => {
  if (!el) return;
  const proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};

const nav = (id: string) => click(doc.querySelector(`aside nav button[data-nav="${id}"]`));
/** the inspector — the aside that owns the navigation rail (the slide list is an aside too) */
const aside = () => doc.querySelector<HTMLElement>("aside nav button[data-nav]")!.closest("aside") as HTMLElement;
/** an inspector control by its accessible name */
const panelInput = (label: string) => aside().querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
const panelButton = (label: string) => aside().querySelector<HTMLElement>(`button[aria-label="${label}"]`);
/** a toolbar control by its accessible name, optionally inside one merged line */
const barInput = (label: string, line?: string) =>
  doc.querySelector<HTMLInputElement>(`.context-toolbar ${line ? `[aria-label="${line}"] ` : ""}input[aria-label="${label}"]`);
const barButton = (label: string, line?: string) =>
  doc.querySelector<HTMLElement>(`.context-toolbar ${line ? `[aria-label="${line}"] ` : ""}button[aria-label="${label}"]`);
const pop = () => doc.querySelector<HTMLElement>(".context-toolbar .ctx-pop");
const closePop = () => click(doc.querySelector(".context-toolbar .ctx-pop-head [aria-label='Close toolbar panel']"));
/** the button of a SegButtons / toggle row by its visible text, inside the inspector */
const panelTextButton = (text: string) =>
  Array.from(aside().querySelectorAll<HTMLElement>("button")).find((b) => b.textContent?.trim() === text) ?? null;

const el = (sel: string) => doc.querySelector<HTMLElement>(`.slide-editable ${sel}`);
const brandLines = () => Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="brand"] > div'));
const stem = () => el('[data-el="question"] > span');
/** the bullet graphic sits inside the question box (a div beside the stem's span) */
const bulletBox = () => el('[data-el="question"] > div');
const bulletNumber = () => el('[data-el="question"] > div > span');
const noteBox = () => el('[data-el="note"]');
const badgeGlyphs = () => el('[data-el="badge"] > span > span');
/** the first option row's marker: row > outer span > marker box span > letter span */
const optionMarker = () => {
  const outer = el('[data-el="options"] > div > span');
  const box = (outer ? Array.from(outer.children).filter((c) => c.tagName === "SPAN").pop() : null) as HTMLElement | null;
  const letter = (box?.querySelector(":scope > span") ?? null) as HTMLElement | null;
  return { box, letter };
};

export async function runTextStyleTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: {
        title: "MCQ",
        brandTop: "LEARN WITH",
        brandBottom: "FAYSAL SIR",
        badge: "DAKHIL-26",
        logo: DEFAULT_LOGO,
        showLogo: true,
        showBanner: true,
      },
      theme: { brandTopSize: 31, brandBottomSize: 19, showNumber: true, showBullet: true },
      slides: [
        {
          id: "sl1",
          number: "১",
          question: "বহুপদীর মাত্রা কত?",
          note: "বোর্ড: ঢাকা ২০২৪",
          options: [
            { key: "ক", text: "5" },
            { key: "খ", text: "6" },
          ],
          answer: "ক",
          scale: 1,
          showAnswer: false,
        },
      ],
    }),
  );

  let root: Root | null = null;
  const errors: string[] = [];
  const onErr = (e: ErrorEvent) => errors.push(String(e.message));
  win.addEventListener("error", onErr as EventListener);
  act(() => {
    root = createRoot(doc.getElementById("root")!);
    root.render(createElement(App));
  });

  /* ------------------------------ Badge 1 ---------------------------------- */
  nav("badge1");
  out.push({
    name: "Badge 1 opens the full text toolkit for its own line",
    pass: !!aside().querySelector('[data-text-part="brandTop"]') && !!panelInput("Badge 1 size") && !!panelInput("Badge 1 opacity"),
    detail: Array.from(aside().querySelectorAll("input[aria-label]")).map((i) => i.getAttribute("aria-label")).join(", "),
  });

  type(panelInput("Badge 1 size"), "300");
  out.push({
    name: "font size is unbounded above (Badge 1 → 300px, Badge 2 untouched)",
    pass: brandLines()[0]?.style.fontSize === "300px" && brandLines()[1]?.style.fontSize === "19px",
    detail: brandLines().map((d) => d.style.fontSize).join(" / "),
  });
  type(panelInput("Badge 1 size"), "0");
  out.push({
    name: "…and goes down to 0",
    pass: brandLines()[0]?.style.fontSize === "0px",
    detail: brandLines()[0]?.style.fontSize,
  });
  type(panelInput("Badge 1 size"), "31");

  type(panelInput("Badge 1 opacity"), "40");
  out.push({
    name: "opacity 0–100 (100 = fully visible) fades Badge 1's line only",
    pass: brandLines()[0]?.style.opacity === "0.4" && !brandLines()[1]?.style.opacity,
    detail: brandLines().map((d) => d.style.opacity || "—").join(" / "),
  });

  type(panelInput("Badge 1 letter spacing"), "5");
  out.push({
    name: "letter spacing lands on Badge 1's line only",
    pass: brandLines()[0]?.style.letterSpacing === "5px" && brandLines()[1]?.style.letterSpacing === "0.4px",
    detail: brandLines().map((d) => d.style.letterSpacing).join(" / "),
  });

  type(panelInput("Badge 1 position X"), "12");
  type(panelInput("Badge 1 position Y"), "-3");
  out.push({
    name: "position nudges Badge 1's glyphs, not the brand block",
    pass:
      brandLines()[0]?.style.transform === "translate(12px, -3px)" &&
      !brandLines()[1]?.style.transform &&
      !el('[data-el="brand"]')?.style.transform?.includes("translate(12px"),
    detail: `${brandLines()[0]?.style.transform} | block: ${el('[data-el="brand"]')?.style.transform || "—"}`,
  });

  click(panelButton("Text effect: Shadow"));
  out.push({
    name: "a Canva-style effect (Shadow) paints Badge 1's line only",
    pass: !!brandLines()[0]?.style.textShadow && !brandLines()[1]?.style.textShadow,
    detail: brandLines().map((d) => d.style.textShadow || "—").join(" / "),
  });
  click(panelButton("Text effect: Hollow"));
  out.push({
    name: "switching to Hollow strokes the glyphs and clears the shadow",
    pass:
      (brandLines()[0]?.style.textShadow || "none") === "none" &&
      !!brandLines()[0]?.style.getPropertyValue("-webkit-text-stroke") &&
      brandLines()[0]?.style.getPropertyValue("-webkit-text-fill-color") === "transparent",
    detail: brandLines()[0]?.style.cssText,
  });
  click(panelButton("Text effect: Background"));
  out.push({
    name: "the Background effect paints a plate on an inline wrapper hugging the glyphs",
    pass: !!brandLines()[0]?.querySelector<HTMLElement>("span")?.style.background && !brandLines()[1]?.querySelector("span"),
    detail: brandLines()[0]?.querySelector<HTMLElement>("span")?.style.cssText,
  });
  click(panelButton("Text effect: None"));

  click(panelTextButton("UPPERCASE") ?? null);
  click(panelTextButton("lowercase") ?? null);
  out.push({
    name: "case (lowercase) applies to Badge 1's line only",
    pass: brandLines()[0]?.style.textTransform === "lowercase" && brandLines()[1]?.style.textTransform === "uppercase",
    detail: brandLines().map((d) => d.style.textTransform).join(" / "),
  });

  /* --------------------- the whole Google catalogue ------------------------ */
  const fontTrigger = Array.from(aside().querySelectorAll<HTMLElement>('[data-text-part="brandTop"] span')).find((s) =>
    s.textContent?.trim().startsWith("Font ("),
  )?.nextElementSibling as HTMLElement | undefined;
  out.push({
    name: "the font picker advertises the whole catalogue (1,900+ Google Fonts)",
    pass: /Font \(1,9\d\d Google Fonts\)/.test(fontTrigger?.previousElementSibling?.textContent ?? ""),
    detail: fontTrigger?.previousElementSibling?.textContent ?? "no picker",
  });
  click(fontTrigger);
  type(aside().querySelector<HTMLInputElement>('input[placeholder^="Search"]'), "Alkatra");
  const row = Array.from(aside().querySelectorAll<HTMLElement>("button")).find((b) => b.textContent?.includes("Alkatra"));
  out.push({
    name: "a catalogue-only family (Alkatra) is offered under “All Google Fonts”",
    pass: !!row && !!Array.from(aside().querySelectorAll("div")).find((d) => d.textContent?.trim().startsWith("All Google Fonts")),
    detail: row ? "row found" : "no row",
  });
  click(row);
  const links = Array.from(doc.head.querySelectorAll<HTMLLinkElement>("link[data-ff]")).map((l) => l.href);
  out.push({
    name: "picking it puts the family on Badge 1's line and loads it with its real weights",
    pass:
      (brandLines()[0]?.style.fontFamily ?? "").includes("Alkatra") &&
      !(brandLines()[1]?.style.fontFamily ?? "").includes("Alkatra") &&
      links.some((h) => h.includes("family=Alkatra:wght@400;500;600;700")),
    detail: `${brandLines()[0]?.style.fontFamily} | ${links.filter((h) => h.includes("Alkatra")).join(" ")}`,
  });

  /* ------------------------------ Badge 2 (toolbar) ------------------------ */
  nav("badge2");
  click(barButton("Strikethrough", "Badge 2 tools"));
  out.push({
    name: "the Badge 2 toolbar line strikes through Badge 2 only",
    pass: brandLines()[1]?.style.textDecoration === "line-through" && brandLines()[0]?.style.textDecoration !== "line-through",
    detail: brandLines().map((d) => d.style.textDecoration || "—").join(" / "),
  });
  click(barButton("Italic", "Badge 2 tools"));
  out.push({
    name: "…and italicises Badge 2 only",
    pass: brandLines()[1]?.style.fontStyle === "italic" && brandLines()[0]?.style.fontStyle !== "italic",
    detail: brandLines().map((d) => d.style.fontStyle || "—").join(" / "),
  });
  click(barButton("Badge 2 spacing"));
  type(barInput("Opacity %"), "75");
  out.push({
    name: "the toolbar's spacing pop-up sets Badge 2's opacity (100 = fully visible)",
    pass: pop()?.getAttribute("data-pop-panel") === "Badge 2 spacing" && brandLines()[1]?.style.opacity === "0.75",
    detail: `${pop()?.getAttribute("data-pop-panel")} · ${brandLines()[1]?.style.opacity}`,
  });
  closePop();
  click(barButton("Badge 2 position"));
  type(barInput("Badge 2 offset Y"), "7");
  out.push({
    name: "the toolbar's position pop-up nudges Badge 2's glyphs only",
    pass: brandLines()[1]?.style.transform === "translate(0px, 7px)" && brandLines()[0]?.style.transform === "translate(12px, -3px)",
    detail: brandLines().map((d) => d.style.transform || "—").join(" / "),
  });
  closePop();

  /* ------------------------------ Title ------------------------------------ */
  nav("titleText");
  type(panelInput("Title text position X"), "9");
  const titleInner = el('[data-el="title"] div[style*="translate(9px"]');
  out.push({
    name: "the title's nudge moves the heading glyphs, not the banner plate",
    pass: !!titleInner && titleInner.textContent?.trim() === "MCQ" && !el('[data-el="title"]')?.style.transform?.includes("translate(9px"),
    detail: titleInner ? "inner heading moved" : "no moved node",
  });
  type(panelInput("Title text size"), "500");
  out.push({
    name: "title size is unbounded (500px)",
    pass: !!el('[data-el="title"] div[style*="font-size: 500px"]'),
    detail: el('[data-el="title"]')?.innerHTML.match(/font-size: [^;]+/)?.[0],
  });
  type(panelInput("Title text size"), "54");

  /* ------------------------------ Badge 3 ---------------------------------- */
  nav("badge3");
  type(panelInput("Badge 3 opacity"), "50");
  out.push({
    name: "Badge 3's opacity fades its glyphs (not the badge box or plate)",
    pass: badgeGlyphs()?.style.opacity === "0.5" && !el('[data-el="badge"]')?.style.opacity,
    detail: `${badgeGlyphs()?.style.opacity} | box ${el('[data-el="badge"]')?.style.opacity || "—"}`,
  });

  /* ------------------------------ Question --------------------------------- */
  nav("questionText");
  type(panelInput("Question text line spacing"), "2.5");
  out.push({
    name: "question line spacing lands on the stem's own node (bullet untouched)",
    pass: stem()?.style.lineHeight === "2.5" && bulletBox()?.style.lineHeight !== "2.5",
    detail: `${stem()?.style.lineHeight} | bullet ${bulletBox()?.style.lineHeight}`,
  });
  click(barButton("Question text effects"));
  click(doc.querySelector('.context-toolbar .ctx-pop button[aria-label="Text effect: Neon"]'));
  out.push({
    name: "the toolbar's effects pop-up puts Neon on the stem only",
    pass:
      pop()?.getAttribute("data-pop-panel") === "Question text effects" &&
      !!stem()?.style.textShadow &&
      !bulletNumber()?.style.textShadow,
    detail: `${pop()?.getAttribute("data-pop-panel")} · stem ${stem()?.style.textShadow ? "neon" : "—"} · number ${bulletNumber()?.style.textShadow || "—"}`,
  });
  closePop();

  /* ------------------------ number inside the bullet ----------------------- */
  nav("bulletText");
  type(panelInput("Question bullet text opacity"), "70");
  out.push({
    name: "the bullet number's opacity fades the digits, not the bullet shape",
    pass: bulletNumber()?.style.opacity === "0.7" && !bulletBox()?.style.opacity && !stem()?.style.opacity,
    detail: `digits ${bulletNumber()?.style.opacity} | shape ${bulletBox()?.style.opacity || "—"} | stem ${stem()?.style.opacity || "—"}`,
  });
  type(panelInput("Question bullet text position X"), "4");
  out.push({
    name: "the bullet number's nudge moves the digits only",
    pass: bulletNumber()?.style.transform === "translate(4px, 0px)" && !bulletBox()?.style.transform,
    detail: `${bulletNumber()?.style.transform} | shape ${bulletBox()?.style.transform || "—"}`,
  });

  /* --------------------- letter inside the option markers ------------------ */
  nav("optionBulletText");
  const before = optionMarker();
  const boxSizeBefore = `${before.box?.style.width}×${before.box?.style.height}`;
  const letterSizeBefore = before.letter?.style.fontSize;
  type(panelInput("Option bullet text size"), "200");
  const after = optionMarker();
  out.push({
    name: "the marker letter's size % scales the letter, never the marker box",
    pass:
      !!after.letter &&
      parseFloat(after.letter.style.fontSize) > parseFloat(letterSizeBefore ?? "0") &&
      `${after.box?.style.width}×${after.box?.style.height}` === boxSizeBefore,
    detail: `letter ${letterSizeBefore} → ${after.letter?.style.fontSize} · box ${boxSizeBefore} → ${after.box?.style.width}×${after.box?.style.height}`,
  });
  type(panelInput("Option bullet text size"), "100");
  type(panelInput("Option bullet text letter spacing"), "3");
  out.push({
    name: "the marker letter's tracking lands on the letter node only",
    pass: optionMarker().letter?.style.letterSpacing === "3px" && !optionMarker().box?.style.letterSpacing,
    detail: `${optionMarker().letter?.style.letterSpacing} | box ${optionMarker().box?.style.letterSpacing || "—"}`,
  });
  click(barButton("Bullet text effects"));
  click(doc.querySelector('.context-toolbar .ctx-pop button[aria-label="Text effect: Lift"]'));
  out.push({
    name: "the letter line's effects pop-up lifts the letter only",
    pass: !!optionMarker().letter?.style.textShadow && !optionMarker().box?.style.textShadow,
    detail: `${optionMarker().letter?.style.textShadow || "—"} | box ${optionMarker().box?.style.textShadow || "—"}`,
  });
  closePop();

  /* ------------------------------ Option text ------------------------------ */
  nav("optionText");
  type(panelInput("Option text position Y"), "6");
  const optNodes = Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="options"] span[style*="translate(0px, 6px)"]'));
  out.push({
    name: "option text's nudge moves each option's text node, not its row or marker",
    pass: optNodes.length === 2 && optNodes.every((n) => !n.querySelector("svg")) && !optionMarker().letter?.style.transform?.includes("6px"),
    detail: `${optNodes.length} moved text nodes`,
  });
  type(panelInput("Option text size"), "150");
  out.push({
    name: "option text size is unbounded (150px)",
    pass: doc.querySelectorAll('.slide-editable [data-el="options"] span[style*="font-size: 150px"]').length === 2,
    detail: String(doc.querySelectorAll('.slide-editable [data-el="options"] span[style*="font-size: 150px"]').length),
  });
  type(panelInput("Option text size"), "30");

  /* Option text alignment relative to its text box without moving option bullet */
  click(barButton("Align center", "Option text tools"));
  const centeredNodes = Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="options"] > div > span:not([style*="display: inline-flex"])'));
  const rowElements = Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="options"] > div'));
  out.push({
    name: "option text aligns to center relative to its text box (flex: 1)",
    pass: centeredNodes.length === 2 && centeredNodes.every((n) => n.style.textAlign === "center" && (n.style.flex === "1 1 0%" || n.style.flex === "1")),
    detail: centeredNodes.map((n) => `${n.style.textAlign} flex=${n.style.flex}`).join(" / "),
  });
  out.push({
    name: "option text center alignment leaves option bullet stationary (no row-level justify)",
    pass: rowElements.length === 2 && rowElements.every((r) => r.style.justifyContent !== "center"),
    detail: rowElements.map((r) => r.style.justifyContent || "flex-start").join(" / "),
  });

  click(barButton("Align right", "Option text tools"));
  const rightNodes = Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="options"] > div > span:not([style*="display: inline-flex"])'));
  out.push({
    name: "option text aligns to right relative to its text box without moving bullet",
    pass: rightNodes.length === 2 && rightNodes.every((n) => n.style.textAlign === "right") && rowElements.every((r) => r.style.justifyContent !== "flex-end"),
    detail: rightNodes.map((n) => `${n.style.textAlign} rowJustify=${rowElements[0]?.style.justifyContent || "flex-start"}`).join(" / "),
  });

  click(barButton("Align left", "Option text tools"));
  const leftNodes = Array.from(doc.querySelectorAll<HTMLElement>('.slide-editable [data-el="options"] > div > span:not([style*="display: inline-flex"])'));
  out.push({
    name: "option text aligns to left relative to its text box",
    pass: leftNodes.length === 2 && leftNodes.every((n) => n.style.textAlign === "left"),
    detail: leftNodes.map((n) => n.style.textAlign).join(" / "),
  });

  /* ------------------------------ Footnote --------------------------------- */
  nav("footnote");
  click(panelTextButton("Strikethrough") ?? aside().querySelector('button[role="switch"][aria-label="Strikethrough"]'));
  const noteStruck = noteBox()?.style.textDecoration === "line-through" || !!noteBox()?.querySelector('[style*="line-through"]');
  out.push({
    name: "the footnote's strikethrough reaches its box",
    pass: noteStruck,
    detail: noteBox()?.style.textDecoration || "—",
  });
  type(panelInput("Footnote letter spacing"), "2");
  out.push({
    name: "footnote letter spacing reaches its box",
    pass: noteBox()?.style.letterSpacing === "2px",
    detail: noteBox()?.style.letterSpacing,
  });

  /* ------------------------------ Custom text box -------------------------- */
  nav("shapes");
  click(doc.querySelector('.context-toolbar [aria-label="Text box"]') ?? doc.querySelector('.context-toolbar [aria-label="Text"]'));
  const shapeText = () => doc.querySelector<HTMLElement>(".slide-editable [data-shape] span[style]");
  const hadShape = !!doc.querySelector(".slide-editable [data-shape]");
  const textTab = Array.from(aside().querySelectorAll<HTMLElement>("button")).find((b) => b.textContent?.trim() === "Text");
  click(textTab);
  const effectBtn = panelButton("Text effect: Splice") ?? doc.querySelector<HTMLElement>('.context-toolbar button[aria-label="Text effect: Splice"]');
  click(effectBtn);
  out.push({
    name: "a custom text box gets the same effects (Splice paints its text node)",
    pass: hadShape && !!shapeText() && !!shapeText()?.style.getPropertyValue("-webkit-text-stroke"),
    detail: hadShape ? shapeText()?.style.cssText ?? "no text node" : "no shape inserted",
  });

  out.push({ name: "no uncaught errors while styling", pass: errors.length === 0, detail: errors.join(" | ") });

  win.removeEventListener("error", onErr as EventListener);
  act(() => root?.unmount());
  doc.getElementById("root")!.innerHTML = "";
  localStorage.removeItem("mcq-slide-studio-v2");
  return out;
}
