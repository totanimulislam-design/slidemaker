/**
 * Minimal browser environment for the interaction tests: jsdom + a tiny
 * percentage-based layout so that getBoundingClientRect() returns something
 * meaningful for the absolutely positioned slide layers.
 */
import { JSDOM } from "jsdom";

export const BOARD = { left: 100, top: 50, width: 1280, height: 720 };

const pct = (v) => {
  const m = /^(-?[\d.]+)%$/.exec(String(v ?? "").trim());
  return m ? Number(m[1]) / 100 : null;
};

function rectOf(el) {
  const isBoard = el.nodeType === 1 && el.hasAttribute?.("data-board");
  if (isBoard) return { left: BOARD.left, top: BOARD.top, width: BOARD.width, height: BOARD.height };
  const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el) ?? el.style;
  const l = pct(style?.left);
  const t = pct(style?.top);
  const w = pct(style?.width);
  const h = pct(style?.height);
  if (w === null) return { left: 0, top: 0, width: 0, height: 0 };
  const x = BOARD.left + (l ?? 0) * BOARD.width;
  const y = BOARD.top + (t ?? 0) * BOARD.height;
  return { left: x, top: y, width: w * BOARD.width, height: (h ?? 0.05) * BOARD.height };
}

function makeRect(r) {
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    right: r.left + r.width,
    bottom: r.top + r.height,
    x: r.left,
    y: r.top,
    toJSON() {
      return this;
    },
  };
}

export function installDom() {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const { window } = dom;

  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return makeRect(rectOf(this));
  };
  Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return Math.round(rectOf(this).width);
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return Math.round(rectOf(this).height);
    },
  });

  // jsdom has no PointerEvent — model it as a MouseEvent carrying pointer fields
  class PointerEvent extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      for (const key of ["pointerId", "pointerType", "isPrimary"]) {
        Object.defineProperty(this, key, { value: init[key] ?? (key === "pointerId" ? 1 : key === "pointerType" ? "mouse" : true) });
      }
    }
  }
  window.PointerEvent = PointerEvent;

  const g = globalThis;
  g.window = window;
  g.document = window.document;
  for (const key of [
    "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "CustomEvent", "KeyboardEvent",
    "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "Image", "localStorage",
    "DOMParser", "PointerEvent", "MutationObserver", "ResizeObserver", "matchMedia", "CSS",
  ]) {
    if (!(key in window)) continue;
    try {
      Object.defineProperty(g, key, { value: window[key], configurable: true, writable: true });
    } catch {
      /* read-only host global (e.g. node's navigator) — keep as is */
    }
  }
  if (!g.ResizeObserver) {
    const RO = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.ResizeObserver = RO;
    g.ResizeObserver = RO;
  }
  if (!g.matchMedia) {
    const mm = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.matchMedia = mm;
    g.matchMedia = mm;
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;
  return { window, document: window.document };
}
