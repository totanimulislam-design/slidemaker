/**
 * Colour suite — every colour control in the editor, on every destination.
 *
 * Two failures used to hide behind the same click, and both are pinned here.
 *
 * 1. THE PICKER CLOSED ON THE FIRST MOVE.
 *    A toolbar well was keyed on its own value (`key={`${name}:${value}`}`).
 *    The first `input` from the OS dialog committed a colour, the new key
 *    remounted the `<input type="color">`, and because the dialog belongs to
 *    that DOM node the browser dismissed it — you could stab at a colour once
 *    but never drag through the palette. The same trap sits in any label that
 *    changes with the value ("Marker fill (auto until set)" drops its suffix
 *    once a colour is picked), so identity is now explicitly separate from the
 *    visible name.
 *
 * 2. THE COLOUR DID NOT REACH THE SLIDE.
 *    An element's ink was reachable from two different fields — the deck field
 *    the renderer reads (`questionColor`, `optionTextColor` …) and the per-box
 *    typeface override (`boxFonts[id].color`). Whichever the renderer consulted
 *    last silently won, so picking "Question colour" in the Question text panel
 *    after the toolbar had written a box override changed nothing at all.
 *    `lib/boxFonts` now owns one answer for both surfaces (`elementInk` /
 *    `setElementInk`) and every panel and strip writes through it.
 *
 * The sweep below drives EVERY `input[type="color"]` the editor renders on each
 * destination, one per freshly booted deck, and demands both guarantees of it:
 * the node survives its own commit, and the colour is painted on the slide.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import { DEFAULT_LOGO } from "../src/lib/types";

type Win = Window & typeof globalThis;
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/** every destination that paints something colourable */
const NAVS = [
  "theme", "titleText", "titleBg", "badge1", "badge2", "badge3",
  "questionBullet", "bulletText", "questionText",
  "optionBullet", "optionBulletText", "optionText",
  "answerKey", "footnote", "background", "frame",
];

const SEED = JSON.stringify({
  header: {
    title: "MCQ", brandTop: "LEARN WITH", brandBottom: "FAYSAL SIR",
    badge: "DAKHIL-26", logo: DEFAULT_LOGO, showLogo: true, showBanner: true,
  },
  theme: { showNumber: true, showNote: true },
  slides: [{
    id: "sl1", number: "১", question: "বহুপদীর মাত্রা কত?", note: "বোর্ড: ঢাকা ২০২৪",
    options: [{ key: "ক", text: "5" }, { key: "খ", text: "6" }],
    answer: "ক", scale: 1, showAnswer: false,
  }],
});

const click = (el: Element | null | undefined) => {
  act(() => {
    (el as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const frame = () =>
  act(async () => {
    await new Promise<void>((r) => win.requestAnimationFrame(() => r()));
  });

/** every inline colour the painted slide carries, styles and SVG paint alike */
const slidePaint = (): string => {
  const board = doc.querySelector<HTMLElement>(".slide-editable");
  if (!board) return "";
  const bits: string[] = [];
  const own = board.getAttribute("style");
  if (own) bits.push(own);
  for (const el of Array.from(board.querySelectorAll<HTMLElement>("*"))) {
    const s = el.getAttribute("style");
    if (s) bits.push(s);
    for (const a of ["fill", "stroke", "stop-color", "color"]) {
      const v = el.getAttribute(a);
      if (v) bits.push(`${a}:${v}`);
    }
  }
  return bits.join(" ; ");
};

/** jsdom reports colours as rgb()/rgba(); accept either spelling */
const painted = (hex: string): boolean => {
  const p = slidePaint();
  const n = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return (
    p.toLowerCase().includes(hex.toLowerCase()) ||
    p.includes(`rgb(${n[0]}, ${n[1]}, ${n[2]})`) ||
    p.includes(`rgba(${n[0]}, ${n[1]}, ${n[2]}`)
  );
};

/** a readable name for a well: the strip exposes aria-label, panels a caption */
const nameOf = (el: HTMLInputElement): string => {
  const aria = el.getAttribute("aria-label");
  if (aria) return `toolbar · ${aria}`;
  const wrap = el.closest("div");
  const label = wrap?.textContent?.trim().slice(0, 40);
  return `panel · ${label || el.getAttribute("title") || "?"}`;
};

/** drive one move of the OS dialog's cursor */
const dial = (el: HTMLInputElement, hex: string) => {
  act(() => {
    el.value = hex;
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};

export async function runColorTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  const host = doc.getElementById("root")!;

  let tick = 0;
  /** a fresh, unmistakable colour for every case */
  const nextHex = () => {
    tick += 1;
    const r = 20 + ((tick * 7) % 200);
    const g = 20 + ((tick * 53) % 200);
    const b = 20 + ((tick * 97) % 200);
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };

  /** boot a clean editor on a known deck and open one destination */
  const boot = async (nav: string): Promise<Root> => {
    localStorage.setItem("mcq-slide-studio-v2", SEED);
    let root!: Root;
    act(() => {
      root = createRoot(host);
      root.render(createElement(App));
    });
    click(doc.querySelector(`aside nav button[data-nav="${nav}"]`));
    await frame();
    return root;
  };

  const wells = () => Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="color"]'));

  let closed = 0;
  let inert = 0;
  let checked = 0;

  for (const nav of NAVS) {
    /* how many wells this destination offers, and what they are called */
    const probe = await boot(nav);
    const names = wells().map(nameOf);
    act(() => probe.unmount());

    for (let i = 0; i < names.length; i += 1) {
      /* one well per boot: a case can never inherit the previous one's colour */
      const root = await boot(nav);
      const before = wells()[i];
      if (!before) {
        act(() => root.unmount());
        continue;
      }
      const hex = nextHex();
      dial(before, hex);
      await frame();
      await frame();

      /* the SAME node must still be there — a remount closes the OS dialog */
      const after = wells()[i];
      const stayed = before === after;
      const applied = painted(hex);
      if (!stayed) closed += 1;
      if (!applied) inert += 1;
      checked += 1;

      out.push({
        name: `${nav} · ${names[i]}`,
        pass: stayed && applied,
        detail: `${stayed ? "picker stays open" : "PICKER CLOSED (input remounted)"} · ${applied ? `painted ${hex}` : `NOT PAINTED ${hex}`}`,
      });
      act(() => root.unmount());
    }
  }

  out.push({
    name: "every colour well in the editor keeps its picker open and reaches the slide",
    pass: closed === 0 && inert === 0,
    detail: `${checked} wells · ${closed} closed on first move · ${inert} painted nothing`,
  });

  /* ------------------------------------------------------------------ *
   * One ink per element: the panel and the strip must not shadow each other.
   * ------------------------------------------------------------------ */
  const root = await boot("questionText");
  const questionInk = () => {
    const box = doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]');
    return Array.from(box?.querySelectorAll<HTMLElement>("*") ?? [])
      .map((e) => e.style.color)
      .filter(Boolean)
      .join(" | ");
  };
  const rgbOf = (hex: string) => {
    const n = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${n[0]}, ${n[1]}, ${n[2]})`;
  };
  const barWell = () =>
    doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label^="Question colour"]')!;
  const panelWell = () => {
    const found = Array.from(doc.querySelectorAll<HTMLElement>("aside div"))
      .filter((d) => d.textContent?.trim() === "Question colour");
    return found[found.length - 1]?.querySelector<HTMLInputElement>('input[type="color"]')!;
  };

  dial(panelWell(), "#ff0000");
  await frame(); await frame();
  out.push({
    name: "the panel's Question colour paints the stem",
    pass: questionInk().includes(rgbOf("#ff0000")),
    detail: questionInk(),
  });

  dial(barWell(), "#00ff00");
  await frame(); await frame();
  out.push({
    name: "the toolbar's Question colour paints the stem",
    pass: questionInk().includes(rgbOf("#00ff00")),
    detail: questionInk(),
  });

  dial(panelWell(), "#0000ff");
  await frame(); await frame();
  out.push({
    name: "…and the panel still works after the toolbar was used (neither shadows the other)",
    pass: questionInk().includes(rgbOf("#0000ff")),
    detail: `${questionInk()} · want ${rgbOf("#0000ff")}`,
  });

  /* a sweep through the dialog keeps the one node it opened from */
  const node = barWell();
  for (const hex of ["#112233", "#223344", "#334455", "#445566"]) {
    dial(node, hex);
    await frame();
  }
  out.push({
    name: "a whole sweep through the dialog runs on ONE input node (never reopened mid-drag)",
    pass: barWell() === node && questionInk().includes(rgbOf("#445566")),
    detail: `same node=${barWell() === node} · ${questionInk()}`,
  });

  act(() => root.unmount());
  return out;
}
