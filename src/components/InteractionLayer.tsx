import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Box, SlideField, ThemeSettings } from "../lib/types";
import { DEFAULT_LAYOUT } from "../lib/types";
import type { LayerRef } from "../lib/layers";
import { detachedPartBox } from "../lib/layers";
import { BG_PART_IDS, PART_BG_BOARD, PART_BG_DESIGN, PART_FRAME } from "../lib/parts";
import { BAND_UI } from "../lib/zorder";
import { measureElement, measurePart, r1 } from "../lib/geometry";
import {
  anyGrouped,
  expandSelection,
  isWholeGroup,
  membersOf,
  objKey,
  sceneMap,
  type ObjKey,
  type SceneObject,
} from "../lib/scene";
import { hitChain, nextInChain } from "../lib/hitTest";
import {
  HANDLES,
  boundsOf,
  boxesOverlap,
  makeGridSnap,
  moveRect,
  resizeRect,
  rotateAngle,
  rotateSet,
  scaleSet,
  smartSnap,
  translateSet,
  type BoxRect,
  type FreeRect,
  type Handle,
  type MemberGeo,
} from "../lib/gestures";

/**
 * INTERACTION LAYER — the ONE object interaction system of the editor.
 *
 * A single component owns every pointer behaviour on the slide:
 *
 *   click an object        → select it (a group member selects its whole group)
 *   drag an object         → move it (groups / multi-selections move together)
 *   drag a resize handle   → resize the object or the whole selection
 *   drag the rotate knob   → rotate (Shift snaps to 15°)
 *   double-click text      → edit the text inline, right on the object
 *   double-click an object → open its edit options (logo, frame, background…)
 *   Shift/Ctrl+click       → add / remove from the selection
 *   Alt+click              → dig to the layer underneath (overlap navigation)
 *   drag on empty slide    → rubber-band marquee selection
 *   click on empty slide   → select the background layer hit, else deselect
 *
 * Objects are described by the scene (lib/scene.ts); the object actually under
 * the cursor is found with real paint-order hit-testing (lib/hitTest.ts), so no
 * transparent container, group wrapper or background layer can block an
 * editable object. All gestures write geometry through ONE callback (`onGeo`),
 * so a whole group gesture stays a single undo step. Nothing is ever
 * flattened: members keep their position, size, rotation, text and styling.
 */

/** What the inline text editor is editing right now. */
export interface EditTarget {
  ref: LayerRef;
  /** slide field being edited, or null when editing a drawn shape's own text */
  field: SlideField | null;
}

interface Props {
  /** the 1280×720 board (content surface) */
  boardRef: RefObject<HTMLDivElement | null>;
  /** the whole slide including the frame ring */
  rootRef: RefObject<HTMLDivElement | null>;
  /** every object painted on this slide (lib/scene.ts) */
  scene: SceneObject[];
  theme: ThemeSettings;
  /** current selection as object keys */
  selection: ObjKey[];
  /** commit a new selection (`exact` skips group expansion) */
  onSelect: (keys: ObjKey[], opts?: { exact?: boolean }) => void;
  /** ONE batched geometry write for any mix of objects — a single undo step */
  onGeo: (updates: { ref: LayerRef; patch: Partial<Box> }[]) => void;
  onGroup: (refs: LayerRef[]) => void;
  onUngroup: (refs: LayerRef[]) => void;
  /** double-click on a non-text object: open its edit options (inspector) */
  onOpenOptions: (ref: LayerRef, field: SlideField | null) => void;
  /** frame grip drag: new frame thickness in slide px */
  onFrameWidth: (width: number) => void;
  /** a drag/resize/rotate finished — closes the undo coalescing window */
  onGestureEnd: () => void;
  /** current text of an edit target (inline editor) */
  getText: (t: EditTarget) => string;
  /** commit inline-edited text */
  commitText: (t: EditTarget, value: string) => void;
  /** fonts / sizes the inline editor matches */
  editorFont: { stack: string; qSize: number; optSize: number };
}

/* ------------------------------------------------------------- gestures */

type Gesture =
  | {
      mode: "move";
      /** click-without-drag on a multi-selection member: narrow to these keys on release */
      narrowTo?: ObjKey[] | null;
      objs: SceneObject[];
      frozen: Map<ObjKey, FreeRect>;
      others: BoxRect[];
      px0: number;
      py0: number;
      started: boolean;
    }
  | {
      mode: "resize";
      obj: SceneObject;
      handle: Handle;
      frozen: FreeRect;
      sx: number;
      sy: number;
    }
  | {
      mode: "rotate";
      obj: SceneObject;
      frozen: FreeRect;
      cx: number;
      cy: number;
      startAngle: number;
    }
  | {
      mode: "setResize";
      objs: SceneObject[];
      frozen: Map<ObjKey, FreeRect>;
      handle: Handle;
      bounds: BoxRect;
      sx: number;
      sy: number;
    }
  | {
      mode: "setRotate";
      objs: SceneObject[];
      frozen: Map<ObjKey, FreeRect>;
      cx: number;
      cy: number;
      startAngle: number;
      board: { width: number; height: number };
    }
  | { mode: "frame"; dir: { x: number; y: number }; startWidth: number; px0: number; py0: number }
  | {
      mode: "press";
      x0: number;
      y0: number;
      px0: number;
      py0: number;
      moved: boolean;
      /** background layer hit by the press (a plain click selects it) */
      bgKey: ObjKey | null;
    };

const DESIGN_W = 1280;

export default function InteractionLayer(props: Props) {
  const { boardRef, rootRef, scene, theme, selection } = props;

  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [marqRect, setMarqRect] = useState<BoxRect | null>(null);
  /** mutable twin of marqRect for the pointerup handler (state may lag a frame) */
  const marqGeo = useRef<BoxRect | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);

  const byKey = sceneMap(scene);
  const selSet = new Set(selection);

  /* ---------------------------------------------------------- geometry */

  /**
   * Current rectangle of any object in "free" terms (own top-left edge, % of
   * the board). Objects still laid out by the slide are measured live from the
   * DOM, so the first drag starts exactly where the object is painted and
   * nothing jumps.
   */
  const objRect = (obj: SceneObject, t: ThemeSettings): FreeRect | null => {
    const ref = obj.ref;
    if (ref.kind === "shape") {
      const s = obj.shape;
      return s ? { x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot } : null;
    }
    if (ref.kind === "element") {
      const b = t.layout[ref.id] ?? DEFAULT_LAYOUT[ref.id];
      const rot = b.rot ?? 0;
      if ((b.mode ?? "align") === "free") {
        const m = b.h ? null : measureElement(ref.id);
        return { x: b.x, y: b.y, w: b.w, h: b.h ?? m?.h ?? 10, rot };
      }
      const m = measureElement(ref.id);
      if (m) return { x: m.left, y: m.top, w: m.w, h: m.h, rot };
      return { x: (b.x * (100 - b.w)) / 100, y: b.y, w: b.w, h: 10, rot };
    }
    const stored = t.partLayout?.[ref.id];
    const rot = stored?.rot ?? 0;
    const b = detachedPartBox(t, ref.id);
    if (b) {
      const m = b.h ? null : measurePart(ref.id);
      return { x: b.x, y: b.y, w: b.w, h: b.h ?? m?.h ?? 6, rot: b.rot ?? rot };
    }
    const m = measurePart(ref.id);
    if (m && m.w > 0.05) return { x: m.left, y: m.top, w: m.w, h: m.h, rot };
    // full-bleed chrome (frame, static background layers) covers the board
    return { x: 0, y: 0, w: 100, h: 100, rot: 0 };
  };

  /**
   * The extra fields that turn a laid-out object into a free object — {} when
   * it already is one. Merged into the FIRST geometry write of a gesture, so
   * selecting never writes to the deck and a drag stays ONE undo step. The
   * logo keeps an explicit height so its box never depends on the bitmap
   * loading; a detached part always gets one because it has left the flow
   * that used to size it.
   */
  const promotionOf = (obj: SceneObject, geo: MemberGeo, t: ThemeSettings): Partial<Box> => {
    if (obj.ref.kind === "element") {
      const id = obj.ref.id;
      const b = t.layout[id];
      const free = (b?.mode ?? "align") === "free";
      if (free && (id !== "logo" || !!b?.h)) return {};
      return {
        mode: "free",
        x: r1(geo.x),
        y: r1(geo.y),
        w: r1(geo.w),
        ...(id === "logo" ? { h: r1(geo.h) } : {}),
      };
    }
    if (obj.ref.kind === "part") {
      if (detachedPartBox(t, obj.ref.id)?.h) return {};
      return { mode: "free", x: r1(geo.x), y: r1(geo.y), w: r1(geo.w), h: r1(geo.h) };
    }
    return {};
  };

  /** every other object on the board, as a smart-guide snap target */
  const snapTargets = (exceptKeys: Set<ObjKey>, t: ThemeSettings): BoxRect[] => {
    const out: BoxRect[] = [];
    scene.forEach((o) => {
      if (o.hidden || exceptKeys.has(o.key)) return;
      if (o.ref.kind === "shape" && o.shape) {
        out.push({ x: o.shape.x, y: o.shape.y, w: o.shape.w, h: o.shape.h });
        return;
      }
      if (o.ref.kind === "part" && !detachedPartBox(t, o.ref.id)) return; // in-flow parts don't snap
      const r = objRect(o, t);
      if (r && !(r.w >= 100 && r.h >= 100)) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
    });
    return out;
  };

  const boardRect = () => boardRef.current?.getBoundingClientRect() ?? null;

  const pctPoint = (clientX: number, clientY: number) => {
    const b = boardRect();
    if (!b || !b.width || !b.height) return null;
    return { x: ((clientX - b.left) / b.width) * 100, y: ((clientY - b.top) / b.height) * 100 };
  };

  /* --------------------------------------------------- gesture plumbing */

  /** Promotions owed by the running gesture, folded into its first write. */
  const owedPromotions = useRef<Map<ObjKey, Partial<Box>>>(new Map());

  const collectPromotions = (objs: SceneObject[], frozen: Map<ObjKey, FreeRect>, t: ThemeSettings) => {
    const owed = new Map<ObjKey, Partial<Box>>();
    objs.forEach((o) => {
      if (o.ref.kind === "shape") return;
      const geo = frozen.get(o.key);
      if (!geo) return;
      const promo = promotionOf(o, geo, t);
      if (Object.keys(promo).length) owed.set(o.key, promo);
    });
    owedPromotions.current = owed;
  };

  const emit = (updates: { ref: LayerRef; patch: Partial<Box> }[]) => {
    const owed = owedPromotions.current;
    let out = updates;
    if (owed.size) {
      owedPromotions.current = new Map();
      out = updates.map((u) => {
        const promo = owed.get(objKey(u.ref));
        return promo ? { ref: u.ref, patch: { ...promo, ...u.patch } } : u;
      });
    }
    if (out.length) props.onGeo(out);
  };

  const cleanupRef = useRef<(() => void) | null>(null);

  const finishGesture = (didWork: boolean) => {
    cleanupRef.current?.();
    gesture.current = null;
    owedPromotions.current = new Map();
    marqGeo.current = null;
    setGuides({ x: null, y: null });
    setMarqRect(null);
    if (didWork) props.onGestureEnd();
  };

  /** one step of the running gesture (coordinate driven) */
  const applyGesture = (clientX: number, clientY: number, mods: { altKey: boolean; shiftKey: boolean }) => {
    const g = gesture.current;
    const b = boardRect();
    if (!g || !b) return;
    const gridSnap = theme.snapEnabled ? makeGridSnap(theme.snapStep || 1) : undefined;

    if (g.mode === "press") {
      if (!g.moved && Math.hypot(clientX - g.px0, clientY - g.py0) < 4) return;
      g.moved = true;
      const p = pctPoint(clientX, clientY);
      if (!p) return;
      const r = {
        x: Math.min(g.x0, p.x),
        y: Math.min(g.y0, p.y),
        w: Math.abs(p.x - g.x0),
        h: Math.abs(p.y - g.y0),
      };
      marqGeo.current = r;
      setMarqRect(r);
      return;
    }

    if (g.mode === "frame") {
      const rw = rootRef.current?.getBoundingClientRect().width || DESIGN_W;
      const scale = DESIGN_W / rw; // design px per client px
      const d = ((clientX - g.px0) * g.dir.x + (clientY - g.py0) * g.dir.y) * scale;
      props.onFrameWidth(Math.round(Math.max(2, Math.min(80, g.startWidth + d))));
      return;
    }

    if (g.mode === "move") {
      const dx = ((clientX - g.px0) / b.width) * 100;
      const dy = ((clientY - g.py0) / b.height) * 100;
      g.started = true;
      const primary = g.objs[0];
      const geo = g.frozen.get(primary.key)!;
      let offX = 0;
      let offY = 0;
      let gx: number | null = null;
      let gy: number | null = null;
      if (!mods.altKey) {
        if (g.objs.length === 1) {
          const res = moveRect(geo, geo.x + dx, geo.y + dy, {
            grid: gridSnap,
            others: theme.smartGuides === false ? undefined : g.others,
          });
          offX = res.x - (geo.x + dx);
          offY = res.y - (geo.y + dy);
          gx = res.gx;
          gy = res.gy;
        } else if (theme.smartGuides !== false) {
          const sx = smartSnap(geo.x + dx, geo.w, g.others, "x");
          const sy = smartSnap(geo.y + dy, geo.h, g.others, "y");
          if (sx.guide !== null || sy.guide !== null) {
            offX = sx.v - (geo.x + dx);
            offY = sy.v - (geo.y + dy);
            gx = sx.guide;
            gy = sy.guide;
          }
        }
      }
      setGuides({ x: gx, y: gy });
      const moved = translateSet(
        g.objs.map((o) => ({ id: o.key, geo: g.frozen.get(o.key)! })),
        dx + offX,
        dy + offY,
      );
      emit(moved.map((m) => ({ ref: byKey.get(m.id)!.ref, patch: m.patch })));
      return;
    }

    if (g.mode === "resize") {
      const dx = ((clientX - g.sx) / b.width) * 100;
      const dy = ((clientY - g.sy) / b.height) * 100;
      const isImageLike =
        (g.obj.ref.kind === "shape" && g.obj.shape?.kind === "image") ||
        (g.obj.ref.kind === "element" && g.obj.ref.id === "logo");
      const keepRatio = g.handle.length === 2 && (isImageLike ? !mods.shiftKey : !!mods.shiftKey);
      const isShape = g.obj.ref.kind === "shape";
      const r = resizeRect(g.frozen, g.handle, dx, dy, {
        keepRatio,
        grid: mods.altKey ? undefined : gridSnap,
        minW: isShape ? 1 : 2,
        minH: isShape ? 0.3 : 2,
      });
      emit([{ ref: g.obj.ref, patch: r }]);
      return;
    }

    if (g.mode === "rotate") {
      const deg = rotateAngle(g.cx, g.cy, g.startAngle, g.frozen.rot, clientX, clientY, mods.shiftKey);
      emit([{ ref: g.obj.ref, patch: { rot: deg } }]);
      return;
    }

    if (g.mode === "setResize") {
      const dx = ((clientX - g.sx) / b.width) * 100;
      const dy = ((clientY - g.sy) / b.height) * 100;
      const nb = resizeRect({ ...g.bounds, rot: 0 }, g.handle, dx, dy, {
        keepRatio: mods.shiftKey,
        free: true,
        minW: 2,
        minH: 0.6,
      });
      const scaled = scaleSet(
        g.objs.map((o) => ({ id: o.key, geo: g.frozen.get(o.key)! })),
        g.bounds,
        nb,
      );
      emit(scaled.map((m) => ({ ref: byKey.get(m.id)!.ref, patch: m.patch })));
      return;
    }

    if (g.mode === "setRotate") {
      const a = Math.atan2(clientY - g.cy, clientX - g.cx);
      let delta = ((a - g.startAngle) * 180) / Math.PI;
      if (mods.shiftKey) delta = Math.round(delta / 15) * 15;
      const rotated = rotateSet(
        g.objs.map((o) => ({ id: o.key, geo: g.frozen.get(o.key)! })),
        { x: g.cx - b.left, y: g.cy - b.top },
        delta,
        g.board,
      );
      emit(rotated.map((m) => ({ ref: byKey.get(m.id)!.ref, patch: m.patch })));
    }
  };

  /** pointerup: ends the running gesture (press gestures resolve their click) */
  const endGestureUp = () => {
    const g = gesture.current;
    if (!g) return;
    if (g.mode === "press") {
      if (!g.moved) {
        // a plain click: select the background layer that was hit, else clear
        if (g.bgKey) props.onSelect([g.bgKey]);
        else props.onSelect([], { exact: true });
        finishGesture(false);
        return;
      }
      // marquee: everything the band touches joins the selection
      const r = marqGeo.current;
      if (r && (r.w > 0.2 || r.h > 0.2)) {
        const hit: LayerRef[] = [];
        scene.forEach((o) => {
          if (o.hidden) return;
          if (o.ref.kind === "shape") {
            if (o.shape && boxesOverlap(r, o.shape)) hit.push(o.ref);
            return;
          }
          if (o.ref.kind === "part" && !o.movable) return; // chrome is not marquee-selectable
          const rect = objRect(o, theme);
          if (!rect || (rect.w >= 100 && rect.h >= 100)) return;
          if (boxesOverlap(r, rect)) hit.push(o.ref);
        });
        props.onSelect(expandSelection(scene, hit).map(objKey));
      }
      finishGesture(true);
      return;
    }
    if (g.mode === "move" && !g.started && g.narrowTo) {
      // a plain click (no drag) on one member of a multi-selection narrows
      // the selection to that object's group — like every real editor
      props.onSelect(g.narrowTo, { exact: true });
    }
    finishGesture(g.mode === "move" ? g.started : true);
  };

  /* ------------------------------------------------- starting gestures */

  /** window-level listeners keep a gesture running no matter what re-renders */
  const trackWindow = () => {
    cleanupRef.current?.();
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      I.current.applyGesture(ev.clientX, ev.clientY, { altKey: ev.altKey, shiftKey: ev.shiftKey });
    };
    const onUp = () => I.current.endGestureUp();
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      cleanupRef.current = null;
    };
  };

  // never leave window listeners behind
  useEffect(() => () => cleanupRef.current?.(), []);

  const startMove = (objs: SceneObject[], clientX: number, clientY: number, narrowTo?: ObjKey[] | null) => {
    const frozen = new Map<ObjKey, FreeRect>();
    objs.forEach((o) => {
      const r = objRect(o, theme);
      if (r) frozen.set(o.key, r);
    });
    const withRects = objs.filter((o) => frozen.has(o.key));
    if (!withRects.length) return;
    collectPromotions(withRects, frozen, theme);
    gesture.current = {
      mode: "move",
      objs: withRects,
      frozen,
      others: snapTargets(new Set(withRects.map((o) => o.key)), theme),
      px0: clientX,
      py0: clientY,
      started: false,
      narrowTo,
    };
    trackWindow();
  };

  const startResize = (obj: SceneObject, handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const r = objRect(obj, theme);
    if (!r) return;
    const frozen = new Map<ObjKey, FreeRect>([[obj.key, r]]);
    collectPromotions([obj], frozen, theme);
    gesture.current = { mode: "resize", obj, handle, frozen: r, sx: e.clientX, sy: e.clientY };
    trackWindow();
  };

  const startRotate = (obj: SceneObject) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const b = boardRect();
    const r = objRect(obj, theme);
    if (!b || !r) return;
    const frozen = new Map<ObjKey, FreeRect>([[obj.key, r]]);
    collectPromotions([obj], frozen, theme);
    const cx = b.left + ((r.x + r.w / 2) / 100) * b.width;
    const cy = b.top + ((r.y + r.h / 2) / 100) * b.height;
    gesture.current = {
      mode: "rotate",
      obj,
      frozen: r,
      cx,
      cy,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
    };
    trackWindow();
  };

  const selectedObjs = (): SceneObject[] =>
    selection.map((k) => byKey.get(k)).filter((o): o is SceneObject => !!o && !o.hidden);

  const movableSelected = (): SceneObject[] => selectedObjs().filter((o) => o.movable);

  const freezeSet = (objs: SceneObject[]) => {
    const frozen = new Map<ObjKey, FreeRect>();
    objs.forEach((o) => {
      const r = objRect(o, theme);
      if (r) frozen.set(o.key, r);
    });
    const list = objs.filter((o) => frozen.has(o.key));
    collectPromotions(list, frozen, theme);
    return { list, frozen };
  };

  const startSetResize = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const { list, frozen } = freezeSet(movableSelected());
    if (!list.length) return;
    gesture.current = {
      mode: "setResize",
      objs: list,
      frozen,
      handle,
      bounds: boundsOf([...frozen.values()]),
      sx: e.clientX,
      sy: e.clientY,
    };
    trackWindow();
  };

  const startSetRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const b = boardRect();
    if (!b) return;
    const { list, frozen } = freezeSet(movableSelected());
    if (!list.length) return;
    const bd = boundsOf([...frozen.values()]);
    const cx = b.left + ((bd.x + bd.w / 2) / 100) * b.width;
    const cy = b.top + ((bd.y + bd.h / 2) / 100) * b.height;
    gesture.current = {
      mode: "setRotate",
      objs: list,
      frozen,
      cx,
      cy,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
      board: { width: b.width, height: b.height },
    };
    trackWindow();
  };

  /** unit outward vector per frame grip: dragging away from the slide thickens the ring */
  const FRAME_OUT: Record<string, { x: number; y: number }> = {
    n: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    e: { x: 1, y: 0 },
    w: { x: -1, y: 0 },
    ne: { x: 1, y: -1 },
    nw: { x: -1, y: -1 },
    se: { x: 1, y: 1 },
    sw: { x: -1, y: 1 },
  };

  /**
   * Dragging a frame grip resizes the FRAME (its thickness), never the slide:
   * only `frame.width` is written, so the 1280×720 board and everything on it
   * stay untouched.
   */
  const startFrameResize = (h: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const dir = FRAME_OUT[h];
    if (!dir) return;
    gesture.current = { mode: "frame", dir, startWidth: theme.frame?.width ?? 26, px0: e.clientX, py0: e.clientY };
    trackWindow();
  };

  /* ------------------------------------------- native pointer pipeline */

  /** every object of the raw hit chain that is painted on this slide */
  const chainObjs = (clientX: number, clientY: number): SceneObject[] =>
    hitChain(clientX, clientY)
      .map((ref) => byKey.get(objKey(ref)))
      .filter((o): o is SceneObject => !!o && !o.hidden);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (!target || target.closest("[data-ui]")) return; // our own overlay UI
    // a leftover text selection (from a double-click) would turn this drag into
    // a native text-drag and the browser would cancel our pointer stream
    window.getSelection()?.removeAllRanges();
    if (editing) setEditing(null); // click away ends text editing

    const chain = chainObjs(e.clientX, e.clientY);

    // Alt+click digs to the layer beneath the current selection
    if (e.altKey) {
      const next = nextInChain(
        chain.map((o) => o.ref),
        selSet,
      );
      if (next) props.onSelect([objKey(next)], { exact: true });
      e.preventDefault();
      return;
    }

    const top = chain[0] ?? null;

    /**
     * A press on the slide background: the base board background is dragged
     * only while it is already selected (otherwise a drag is a marquee); the
     * static decorative layers are click-selectable but never block a marquee.
     */
    const isBgPart = !!top && top.ref.kind === "part" && BG_PART_IDS.includes(top.ref.id);
    const bgDragsAsObject =
      !!top &&
      ((top.ref.kind === "part" && top.ref.id === PART_BG_DESIGN) ||
        (top.ref.kind === "part" && top.ref.id === PART_BG_BOARD && selection.length === 1 && selSet.has(top.key)));
    if (!top || (isBgPart && !bgDragsAsObject)) {
      const p = pctPoint(e.clientX, e.clientY);
      if (!p) return;
      gesture.current = {
        mode: "press",
        x0: p.x,
        y0: p.y,
        px0: e.clientX,
        py0: e.clientY,
        moved: false,
        bgKey: top ? top.key : null,
      };
      trackWindow();
      return;
    }

    // an object press: select (group-expanded), then arm the move gesture
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const groupKeys = membersOf(scene, top.ref).map(objKey);
    if (additive) {
      const allOn = groupKeys.every((k) => selection.includes(k));
      const next = allOn ? selection.filter((k) => !groupKeys.includes(k)) : [...new Set([...selection, ...groupKeys])];
      props.onSelect(next, { exact: true });
      return;
    }
    const already = selection.includes(top.key);
    let dragKeys: ObjKey[];
    /** click-without-drag on a member of a multi-selection narrows to this group on release */
    let narrowTo: ObjKey[] | null = null;
    if (already && selection.length > 1) {
      dragKeys = selection; // keep the multi-selection and drag all of it
      narrowTo = groupKeys;
    } else {
      if (!already || selection.length !== 1) props.onSelect(groupKeys);
      dragKeys = groupKeys;
    }
    const objs = dragKeys.map((k) => byKey.get(k)).filter((o): o is SceneObject => !!o && !o.hidden && o.movable);
    if (!objs.length) return; // chrome (frame, static background): selection only
    startMove(objs, e.clientX, e.clientY, narrowTo);
  };

  const onDblClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || target.closest("[data-ui]")) return;
    const chain = chainObjs(e.clientX, e.clientY);
    const top = chain[0];
    if (!top) return;
    e.preventDefault();
    e.stopPropagation();

    // first double-click digs into a group, the next one edits the member
    const groupKeys = membersOf(scene, top.ref).map(objKey);
    const solo = selection.length === 1 && selection[0] === top.key;
    if (groupKeys.length > 1 && !solo) {
      props.onSelect([top.key], { exact: true });
      return;
    }

    // per-line override (the two brand lines carry data-field)
    const fieldEl = target.closest("[data-field]");
    const fieldOverride = fieldEl?.getAttribute("data-field") as SlideField | null;

    if (top.edit.type === "field") {
      setEditing({ ref: top.ref, field: fieldOverride ?? top.edit.field });
      return;
    }
    if (top.edit.type === "shape") {
      setEditing({ ref: top.ref, field: null });
      return;
    }
    props.onOpenOptions(top.ref, top.inspectorField);
  };

  /**
   * The native listeners are attached ONCE (on the slide root, capture phase,
   * so the frame ring joins the pipeline) and always call the freshest
   * implementation through this ref — no stale closures, no duplicate
   * listeners, no per-object handlers anywhere else in the app.
   */
  const I = useRef({ applyGesture, endGestureUp, onPointerDown, onDblClick });
  I.current = { applyGesture, endGestureUp, onPointerDown, onDblClick };

  useEffect(() => {
    setRootEl(rootRef.current);
  }, [rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const down = (e: PointerEvent) => I.current.onPointerDown(e);
    const dbl = (e: MouseEvent) => I.current.onDblClick(e);
    // slide content is never natively draggable (images / selected text):
    // a native drag would pointercancel the pointer stream mid-gesture.
    // File drops ONTO the slide are a different event stream and keep working.
    const dragStart = (e: DragEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest("[data-ui]")) e.preventDefault();
    };
    root.addEventListener("pointerdown", down, true);
    root.addEventListener("dblclick", dbl, true);
    root.addEventListener("dragstart", dragStart, true);
    return () => {
      root.removeEventListener("pointerdown", down, true);
      root.removeEventListener("dblclick", dbl, true);
      root.removeEventListener("dragstart", dragStart, true);
    };
  }, [rootRef]);

  /* ------------------------------------------------------ inline editor */

  const singleLine = !!editing?.field && editing.field !== "question" && editing.field !== "note";

  const editorFontSize = (): number => {
    if (!editing) return 24;
    if (!editing.field) {
      const o = byKey.get(objKey(editing.ref));
      return o?.shape?.fontSize ?? 24;
    }
    const f = editing.field;
    if (f === "question") return props.editorFont.qSize;
    if (f.startsWith("option:")) return props.editorFont.optSize;
    if (f === "title") return 54;
    if (f === "badge") return 36;
    if (f === "note") return 20;
    return 25;
  };

  /* ---------------------------------------------------------- overlays */

  const handleBase: CSSProperties = {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 3,
    background: "#5ef2ff",
    border: "2px solid #0a0a0c",
    boxShadow: "0 1px 4px rgba(0,0,0,.6)",
    zIndex: BAND_UI + 20,
    touchAction: "none",
    pointerEvents: "auto",
  };

  const chipStyle: CSSProperties = {
    padding: "3px 8px",
    borderRadius: 6,
    background: "rgba(10,10,12,.85)",
    border: "1px solid rgba(255,214,51,.55)",
    color: "#ffd633",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    pointerEvents: "auto",
  };

  const labelStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    bottom: -30,
    padding: "2px 6px",
    borderRadius: 4,
    background: "rgba(0,0,0,.75)",
    color: "#5ef2ff",
    fontFamily: "monospace",
    fontSize: 11,
    whiteSpace: "nowrap",
  };

  /** selection frame + handles for ONE selected object */
  const singleOverlay = (obj: SceneObject) => {
    if (obj.chrome === "frame") return null; // drawn on the slide root (portal)
    const r = objRect(obj, theme);
    if (!r) return null;
    const isChromeBg = obj.chrome === "bgStatic";
    return (
      <div
        key={`sel-${obj.key}`}
        data-ui=""
        data-overlay={obj.key}
        style={{
          position: "absolute",
          left: `${r.x}%`,
          top: `${r.y}%`,
          width: `${r.w}%`,
          height: `${r.h}%`,
          transform: r.rot ? `rotate(${r.rot}deg)` : undefined,
          transformOrigin: "center center",
          zIndex: BAND_UI + 15,
          pointerEvents: "none",
          outline: "1.5px solid rgba(94,242,255,.95)",
          outlineOffset: isChromeBg ? -3 : 3,
          boxSizing: "border-box",
        }}
      >
        {obj.groupId && !isChromeBg && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -30,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(94,242,255,.9)",
              color: "#0a0a0c",
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            ⧉ grouped — double-click edits this item alone
          </div>
        )}
        {obj.movable && !isChromeBg && (
          <>
            {(obj.thin ? HANDLES.filter((h) => h.h === "e" || h.h === "w") : HANDLES).map(({ h, cursor, style: hs }) => (
              <div
                key={h}
                data-handle={h}
                title="Drag to resize · Shift keeps ratio · Alt disables snapping"
                onPointerDown={startResize(obj, h)}
                style={{
                  ...handleBase,
                  ...hs,
                  cursor,
                  borderRadius: h.length === 1 ? 8 : 3,
                  ...(obj.thin ? { top: "50%", marginTop: -8 } : {}),
                }}
              />
            ))}
            <div
              data-rotate=""
              title="Rotate · Shift snaps to 15°"
              onPointerDown={startRotate(obj)}
              style={{
                ...handleBase,
                left: "50%",
                top: obj.thin ? -44 : -34,
                marginLeft: -8,
                borderRadius: "50%",
                cursor: "grab",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: obj.thin ? -28 : -18,
                width: 2,
                height: 16,
                marginLeft: -1,
                background: "rgba(94,242,255,.8)",
              }}
            />
          </>
        )}
        <div
          style={{
            ...labelStyle,
            transform: r.rot ? `rotate(${-r.rot}deg)` : undefined,
            transformOrigin: "left top",
            ...(isChromeBg ? { left: 6, top: 6, bottom: undefined } : {}),
          }}
        >
          {obj.label}
          {isChromeBg
            ? " · edited in its panel"
            : obj.movable
              ? ` · ${r1(r.x)}, ${r1(r.y)} · ${r1(r.w)}×${r1(r.h)}${r.rot ? ` · ${r.rot}°` : ""}`
              : ""}
        </div>
      </div>
    );
  };

  /** multi-selection / group frame: bounds + handles transform the whole set */
  const setOverlay = () => {
    const objs = selectedObjs();
    if (objs.length < 2) return null;
    const members = objs
      .map((o) => ({ o, r: objRect(o, theme) }))
      .filter((m): m is { o: SceneObject; r: FreeRect } => !!m.r && !(!m.o.movable && m.r.w >= 100 && m.r.h >= 100));
    if (!members.length) return null;
    const bounds = boundsOf(members.map((m) => m.r));
    const grouped = anyGrouped(scene, objs.map((m) => m.ref));
    const movableMembers = members.filter((m) => m.o.movable);
    const refs = objs.map((o) => o.ref);
    return (
      <>
        {members.map((m) => (
          <div
            key={`m-${m.o.key}`}
            data-member={m.o.key}
            style={{
              position: "absolute",
              left: `${m.r.x}%`,
              top: `${m.r.y}%`,
              width: `${m.r.w}%`,
              height: `${m.r.h}%`,
              transform: m.r.rot ? `rotate(${m.r.rot}deg)` : undefined,
              transformOrigin: "center center",
              zIndex: BAND_UI + 13,
              pointerEvents: "none",
              outline: "1.5px dashed rgba(255,214,51,.8)",
              boxSizing: "border-box",
            }}
          />
        ))}
        <div
          data-ui=""
          data-set-frame=""
          style={{
            position: "absolute",
            left: `${bounds.x}%`,
            top: `${bounds.y}%`,
            width: `${bounds.w}%`,
            height: `${bounds.h}%`,
            zIndex: BAND_UI + 15,
            pointerEvents: "none",
            outline: "1.5px solid rgba(255,214,51,.95)",
            outlineOffset: 3,
            boxSizing: "border-box",
          }}
        >
          <div style={{ position: "absolute", right: 0, top: -34, display: "flex", gap: 4 }}>
            {grouped && (
              <button
                data-chip="ungroup"
                title="Break this group — every member becomes independently selectable (Ctrl/⌘+Shift+G)"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => props.onUngroup(refs)}
                style={chipStyle}
              >
                ⧉ Ungroup
              </button>
            )}
            {!grouped && movableMembers.length > 1 && !isWholeGroup(scene, refs) && (
              <button
                data-chip="group"
                title="Combine the selected items into one group (Ctrl/⌘+G) — built-in parts and shapes can be grouped together"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => props.onGroup(refs)}
                style={chipStyle}
              >
                ⧉ Group {objs.length}
              </button>
            )}
          </div>
          {movableMembers.length > 0 && (
            <>
              {HANDLES.map(({ h, cursor, style: hs }) => (
                <div
                  key={h}
                  data-handle={h}
                  title="Drag to resize the whole selection"
                  onPointerDown={startSetResize(h)}
                  style={{ ...handleBase, ...hs, cursor, background: "#ffd633", borderRadius: h.length === 1 ? 8 : 3 }}
                />
              ))}
              <div
                data-rotate=""
                title="Rotate the whole selection · Shift snaps to 15°"
                onPointerDown={startSetRotate}
                style={{ ...handleBase, left: "50%", top: -34, marginLeft: -8, borderRadius: "50%", cursor: "grab" }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: -18,
                  width: 2,
                  height: 16,
                  marginLeft: -1,
                  background: "rgba(255,214,51,.8)",
                }}
              />
            </>
          )}
          <div style={{ ...labelStyle, color: "#ffd633" }}>
            {objs.length} items{grouped ? " · grouped" : " · selected"} · drag to move all
          </div>
        </div>
      </>
    );
  };

  /** frame selection: outline + thickness grips on the slide root */
  const frameOverlay = () => {
    if (!byKey.has(`part:${PART_FRAME}`)) return null;
    if (selection.length !== 1 || !selSet.has(`part:${PART_FRAME}`)) return null;
    return (
      <div
        data-ui=""
        data-overlay={`part:${PART_FRAME}`}
        style={{
          position: "absolute",
          inset: 2,
          zIndex: BAND_UI + 40,
          pointerEvents: "none",
          border: "1.5px solid rgba(94,242,255,.95)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 8,
            top: 6,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,.78)",
            color: "#5ef2ff",
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          Frame · drag a grip to resize thickness · double-click for frame options
        </div>
        {HANDLES.map(({ h, cursor, style: hs }) => (
          <div
            key={h}
            data-handle={h}
            title="Drag to make the frame thicker / thinner"
            onPointerDown={startFrameResize(h)}
            style={{ ...handleBase, ...hs, cursor }}
          />
        ))}
      </div>
    );
  };

  /* ------------------------------------------------------------ render */

  const editRect = editing ? (() => {
    const o = byKey.get(objKey(editing.ref));
    return o ? objRect(o, theme) : null;
  })() : null;

  /**
   * The overlay UI lives in a portal on the slide ROOT (not inside the board):
   * the board clips (overflow hidden), which would cut off rotate knobs,
   * labels and group chips of objects near the board edges. The wrapper is
   * measured onto the board so every % coordinate still resolves against it.
   */
  const boardEl = boardRef.current;
  if (!rootEl || !boardEl) return null;
  const br = boardEl.getBoundingClientRect();
  const rr = rootEl.getBoundingClientRect();

  return createPortal(
    <>
      <div
        data-ui=""
        style={{
          position: "absolute",
          left: br.left - rr.left,
          top: br.top - rr.top,
          width: br.width,
          height: br.height,
          zIndex: BAND_UI,
          pointerEvents: "none",
        }}
      >
        {/* alignment guides while dragging */}
        {guides.x !== null && (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${guides.x}%`,
              width: 1,
              background: "rgba(255,214,51,.85)",
              pointerEvents: "none",
            }}
          />
        )}
        {guides.y !== null && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${guides.y}%`,
              height: 1,
              background: "rgba(255,214,51,.85)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* rubber-band marquee */}
        {marqRect && marqRect.w > 0.2 && marqRect.h > 0.2 && (
          <div
            data-marquee=""
            style={{
              position: "absolute",
              left: `${marqRect.x}%`,
              top: `${marqRect.y}%`,
              width: `${marqRect.w}%`,
              height: `${marqRect.h}%`,
              border: "1.5px dashed rgba(94,242,255,.95)",
              background: "rgba(94,242,255,.10)",
              pointerEvents: "none",
              zIndex: BAND_UI + 30,
              boxSizing: "border-box",
            }}
          />
        )}

        {/* selection UI */}
        {selection.length === 1 && byKey.get(selection[0]) && singleOverlay(byKey.get(selection[0])!)}
        {setOverlay()}

        {/* inline text editor */}
        {editing && editRect && (
          <textarea
            data-ui=""
            data-inline-edit=""
            autoFocus
            value={editing ? props.getText(editing) : ""}
            rows={singleLine ? 1 : 3}
            onChange={(e) => editing && props.commitText(editing, e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape" || (e.key === "Enter" && singleLine && !e.shiftKey)) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            onBlur={() => {
              setEditing(null);
              props.onGestureEnd();
            }}
            style={{
              position: "absolute",
              left: `${Math.max(-20, editRect.x)}%`,
              top: `${Math.max(-20, editRect.y)}%`,
              width: `${Math.max(8, Math.min(140, editRect.w))}%`,
              minHeight: `${Math.max(4, editRect.h)}%`,
              transform: editRect.rot ? `rotate(${editRect.rot}deg)` : undefined,
              transformOrigin: "center center",
              zIndex: BAND_UI + 45,
              boxSizing: "border-box",
              resize: "none",
              overflow: "hidden",
              background: "rgba(5,5,9,.94)",
              color: "#fff8dc",
              border: "1.5px solid rgba(94,242,255,.9)",
              borderRadius: 6,
              outline: "none",
              padding: 6,
              fontFamily: props.editorFont.stack,
              fontSize: Math.max(12, editorFontSize()),
              lineHeight: 1.35,
              textAlign: "left",
              direction: "ltr",
              userSelect: "text",
              WebkitUserSelect: "text",
              cursor: "text",
              touchAction: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,.6)",
              pointerEvents: "auto",
            }}
          />
        )}
      </div>
      {frameOverlay()}
    </>,
    rootEl,
  );
}
