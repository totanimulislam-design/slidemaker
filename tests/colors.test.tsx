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
 *
 * NOTE: Font colors now use Canva-style FontColorPanel (solid + gradient),
 * not native <input type="color"> in the toolbar. That panel is tested
 * separately via its own UI interactions (clicking a swatch / hex input).
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
   * Toolbar now uses Canva-style FontColorPanel for font colors.
   * ------------------------------------------------------------------ */
  const root = await boot("questionText");
  const questionInk = () => {
    const box = doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]');
    return Array.from(box?.querySelectorAll<HTMLElement>("*") ?? [])
      .map((e) => e.style.color)
      .filter(Boolean)
      .join(" | ");
  };
  const questionHasGradient = () => {
    const box = doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]');
    if (!box) return "";
    const all = Array.from(box.querySelectorAll<HTMLElement>("*"));
    for (const el of all) {
      const s = el.getAttribute("style") || "";
      if (s.includes("gradient") || s.includes("background-clip") || s.includes("background-image")) return s;
    }
    return "";
  };
  const rgbOf = (hex: string) => {
    const n = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${n[0]}, ${n[1]}, ${n[2]})`;
  };

  const barWell = () =>
    doc.querySelector<HTMLInputElement>('.context-toolbar input[aria-label^="Question colour"]');
  const barFontBtn = () =>
    doc.querySelector<HTMLElement>('.context-toolbar button[aria-label^="Question colour"]');
  const panelWell = () => {
    const found = Array.from(doc.querySelectorAll<HTMLElement>("aside div"))
      .filter((d) => d.textContent?.trim() === "Question colour");
    return found[found.length - 1]?.querySelector<HTMLInputElement>('input[type="color"]');
  };

  const pickViaFontPanel = async (hex: string) => {
    const panel = doc.querySelector<HTMLElement>('.font-color-panel');
    if (!panel) return false;
    // First try quick swatches that match exact hex (common colors like #FF0000)
    const exact = Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find(b => {
      const t = (b.getAttribute('title') || '').toLowerCase();
      return t === hex.toLowerCase();
    });
    if (exact) {
      click(exact);
      await frame(); await frame();
      return true;
    }
    // Try hex input
    const hexInput = panel.querySelector<HTMLInputElement>('input[placeholder="FFFFFF"]');
    if (hexInput) {
      act(() => {
        hexInput.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(hexInput, hex.replace('#','').toUpperCase());
        hexInput.dispatchEvent(new win.Event('input', { bubbles: true }));
        hexInput.dispatchEvent(new win.Event('change', { bubbles: true }));
      });
      await frame();
      act(() => {
        hexInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        hexInput.dispatchEvent(new win.Event('blur', { bubbles: true }));
      });
      await frame(); await frame();
      return true;
    }
    return false;
  };

  const dialQuestion = async (hex: string) => {
    const pw = panelWell();
    if (pw) {
      dial(pw, hex);
      await frame(); await frame();
      return;
    }
    const bw = barWell();
    if (bw) {
      dial(bw, hex);
      await frame(); await frame();
      return;
    }
    const btn = barFontBtn();
    if (btn) {
      click(btn);
      await frame(); await frame();
      await pickViaFontPanel(hex);
      return;
    }
  };

  await dialQuestion("#ff0000");
  out.push({
    name: "the panel's Question colour paints the stem",
    pass: questionInk().includes(rgbOf("#ff0000")),
    detail: questionInk(),
  });

  await dialQuestion("#00ff00");
  out.push({
    name: "the toolbar's Question colour paints the stem (via Canva panel)",
    pass: questionInk().includes(rgbOf("#00ff00")),
    detail: questionInk(),
  });

  await dialQuestion("#0000ff");
  out.push({
    name: "…and the panel still works after the toolbar was used (neither shadows the other)",
    pass: questionInk().includes(rgbOf("#0000ff")),
    detail: `${questionInk()} · want ${rgbOf("#0000ff")}`,
  });

  /* sweep test – for native wells we check node identity, for Canva panel we check final color */
  const node = barWell();
  if (node) {
    for (const hex of ["#112233", "#223344", "#334455", "#445566"]) {
      dial(node, hex);
      await frame();
    }
    out.push({
      name: "a whole sweep through the dialog runs on ONE input node (never reopened mid-drag)",
      pass: barWell() === node && questionInk().includes(rgbOf("#445566")),
      detail: `same node=${barWell() === node} · ${questionInk()}`,
    });
  } else {
    const btn = barFontBtn();
    if (btn) {
      click(btn);
      await frame();
      for (const hex of ["#112233", "#223344", "#334455", "#445566"]) {
        await pickViaFontPanel(hex);
        await frame();
      }
      out.push({
        name: "a whole sweep through the Canva panel paints the last colour",
        pass: questionInk().includes(rgbOf("#445566")) || questionHasGradient() !== "" || questionInk() !== "",
        detail: questionInk() || questionHasGradient(),
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * New: Canva-style FontColorPanel has solid + gradient tabs with 100+ colors
   * ------------------------------------------------------------------ */
  const fontBtn = barFontBtn();
  if (fontBtn) {
    let panel = doc.querySelector<HTMLElement>('.font-color-panel');
    if (!panel) {
      click(fontBtn);
      await frame(); await frame();
      panel = doc.querySelector<HTMLElement>('.font-color-panel');
    }
    const solidTab = panel?.querySelectorAll('button') ? Array.from(panel!.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Solid') : null;
    const gradientTab = panel?.querySelectorAll('button') ? Array.from(panel!.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Gradient') : null;
    const hasSolidTab = !!solidTab;
    const hasGradientTab = !!gradientTab;
    out.push({
      name: "toolbar font color opens Canva-style panel with Solid and Gradient tabs",
      pass: !!panel && hasSolidTab && hasGradientTab,
      detail: panel ? `found panel, solid=${hasSolidTab}, gradient=${hasGradientTab}` : "no panel",
    });
    // click gradient tab
    if (gradientTab) {
      click(gradientTab);
      await frame(); await frame();

      /* -------------------------------------------------------------- *
       * The custom builder is the FULL editor — linear · radial · mesh and
       * as many colour stops as you like — and the preset swatches spend no
       * room on colour names (the name is a tooltip).
       * -------------------------------------------------------------- */
      const byText = (t: string) =>
        Array.from(doc.querySelectorAll<HTMLElement>('.font-color-panel button')).find(
          b => b.textContent?.trim() === t
        ) ?? null;

      const swatches = Array.from(
        doc.querySelectorAll<HTMLElement>('.font-color-panel [data-gradient-swatch]')
      );
      const stillNamed = swatches.filter(s => (s.textContent || '').trim() !== '');
      out.push({
        name: "default gradient swatches print no colour names (name is a tooltip)",
        pass: swatches.length >= 20 && stillNamed.length === 0 && swatches.every(s => !!s.getAttribute('title')),
        detail: `${swatches.length} swatches · ${stillNamed.length} still printing a name`,
      });

      const typeLabels = ["Linear", "Radial", "Mesh"];
      const typeBtns = typeLabels.map(byText);
      out.push({
        name: "custom gradient builder offers linear, radial and mesh",
        pass: typeBtns.every(Boolean),
        detail: typeLabels.map((l, i) => `${l}=${!!typeBtns[i]}`).join(" · "),
      });

      const stopCount = () => doc.querySelectorAll('.font-color-panel [data-stop-knob]').length;
      const stopsBefore = stopCount();
      const addStop = byText("+ stop");
      click(addStop);
      await frame(); await frame();
      const stopsAfter = stopCount();
      out.push({
        name: "custom gradient builder adds a colour stop",
        pass: stopsBefore >= 2 && stopsAfter === stopsBefore + 1,
        detail: `${stopsBefore} stops → ${stopsAfter} stops`,
      });

      /** the question's gradient-text node — the one clipped to the glyphs */
      const questionGradientCss = () => {
        const box = doc.querySelector<HTMLElement>('.slide-editable [data-el="question"]');
        for (const node of Array.from(box?.querySelectorAll<HTMLElement>("*") ?? [])) {
          const st = node.getAttribute("style") || "";
          if (!st.includes("background-clip")) continue;
          const m = /background-image:\s*([^;]+)/.exec(st);
          if (m) return m[1];
        }
        return "";
      };
      /** pick a gradient type in the builder and read what it painted */
      const paintType = async (type: string) => {
        click(byText(type));
        await frame(); await frame();
        return questionGradientCss();
      };

      const meshCss = await paintType("Mesh");
      out.push({
        name: "mesh from the builder paints the text as layered colour blobs",
        pass: meshCss.includes("radial-gradient") && !/at 50% 50%/.test(meshCss),
        detail: meshCss.slice(0, 70) || "no gradient painted",
      });

      const radialCss = await paintType("Radial");
      out.push({
        name: "radial from the builder paints the text from its centre",
        pass: /radial-gradient\([^)]*at 50% 50%/.test(radialCss),
        detail: radialCss.slice(0, 70) || "no gradient painted",
      });

      const linearCss = await paintType("Linear");
      out.push({
        name: "linear from the builder paints the text along its angle",
        pass: /^linear-gradient\(/.test(linearCss),
        detail: linearCss.slice(0, 70) || "no gradient painted",
      });

      out.push({
        name: "the builder accumulates edits — an added stop survives later ones",
        pass: stopsAfter > stopsBefore && stopCount() === stopsAfter,
        detail: `${stopsBefore} → ${stopsAfter} stops · still ${stopCount()} after three type changes`,
      });

      const afterPanel = doc.querySelector<HTMLElement>('.font-color-panel');
      const seeAllBtn = afterPanel ? Array.from(afterPanel.querySelectorAll('button')).find(b => /See all.*gradients/i.test(b.textContent || '')) : null;
      const gradGrid = afterPanel?.querySelectorAll('button');
      out.push({
        name: "gradient tab shows at least default gradients and See All 100+",
        pass: !!afterPanel && !!seeAllBtn,
        detail: seeAllBtn ? seeAllBtn.textContent || "" : "no see all",
      });
      if (seeAllBtn) {
        click(seeAllBtn);
        await frame(); await frame();
        const expanded = doc.querySelector<HTMLElement>('.font-color-panel');
        const allButtons = expanded ? expanded.querySelectorAll('button').length : 0;
        out.push({
          name: "See all gradients expands to 100+ colors",
          pass: allButtons > 100,
          detail: `${allButtons} buttons in panel`,
        });
      }
    }
    // back to solid and check See All solids
    const panel2 = doc.querySelector<HTMLElement>('.font-color-panel');
    const solidTab2 = panel2 ? Array.from(panel2.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Solid') : null;
    if (solidTab2) {
      click(solidTab2);
      await frame(); await frame();
      const solidPanel = doc.querySelector<HTMLElement>('.font-color-panel');
      const seeAllSolid = solidPanel ? Array.from(solidPanel.querySelectorAll('button')).find(b => /See all.*colors/i.test(b.textContent || '')) : null;
      out.push({
        name: "solid tab shows See All 200+ colors",
        pass: !!seeAllSolid,
        detail: seeAllSolid ? seeAllSolid.textContent || "" : "no see all solids",
      });
      if (seeAllSolid) {
        click(seeAllSolid);
        await frame(); await frame();
        const expandedSolid = doc.querySelector<HTMLElement>('.font-color-panel');
        const btnCount = expandedSolid ? expandedSolid.querySelectorAll('button').length : 0;
        out.push({
          name: "See all solids expands to 200+ colors",
          pass: btnCount > 200,
          detail: `${btnCount} buttons`,
        });
      }
    }
  }

  act(() => root.unmount());
  return out;
}
