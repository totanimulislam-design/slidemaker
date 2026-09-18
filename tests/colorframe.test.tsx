/**
 * Native colour-well suite — the same "does it feel instant" guarantee the
 * in-app wheel gets, applied to the browser's own `<input type="color">`.
 *
 * The OS dialog fires an `input` for every move of the cursor through its
 * saturation field. Before the frame channel this committed on every event, so
 * each move re-rendered the whole deck (board + every rail thumbnail) and the
 * dialog's indicator trailed the cursor on anything heavier than a toy deck.
 * These cases pin the discipline the fix hands those events:
 *
 *   1. a burst of `input` moves commits at most once per frame, with the newest
 *      colour — the cursor is the compositor's business, our side stays idle;
 *   2. the swatch under the well is painted inside the SAME event (no render
 *      between the dialog and the glyph the user is looking at);
 *   3. a `change` (the dialog's OK) commits immediately and supersedes whatever
 *      is still pending;
 *   4. unmounting the well settles the newest pending colour exactly once, so
 *      no dialled colour can be lost and none can fire into nothing.
 */
import { act, createElement, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ColorInput } from "../src/components/ui";

type Win = Window & typeof globalThis;
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

export async function runColorFrameTests(): Promise<CaseResult[]> {
  const host = doc.getElementById("root")!;
  const out: CaseResult[] = [];

  /** colours the editor was told, in order */
  let commits: string[] = [];
  let push: (hex: string) => void = () => {};

  function Harness(): ReactNode {
    const [value, setValue] = useState("#000000");
    push = (hex: string) => setValue(hex);
    return createElement(ColorInput, {
      label: "Frame colour",
      value,
      onChange: (hex: string) => commits.push(hex),
    });
  }

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(Harness));
  });

  const input = () => host.querySelector<HTMLInputElement>('input[type="color"]')!;
  const swatch = () => host.querySelector<HTMLElement>("span")!;

  /** one animation frame */
  const frame = () =>
    act(async () => {
      await new Promise<void>((res) => win.requestAnimationFrame(() => res()));
    });

  /** drive a native `input` (a move in the dialog) with a fresh value */
  const fireInput = (hex: string) => {
    act(() => {
      const el = input();
      el.value = hex;
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
  };

  /* jsdom normalises background readback to rgb(); accept either spelling */
  const isPainted = (painted: string, hex: string) => {
    const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(painted.trim());
    if (m) {
      const want = [1, 3, 5].map((i) => Number.parseInt(hex[i] + hex[i + 1], 16));
      return Number(m[1]) === want[0] && Number(m[2]) === want[1] && Number(m[3]) === want[2];
    }
    return painted.trim().toLowerCase() === hex;
  };

  /* ---------- 1. a burst of moves is one commit per frame, newest wins ----- */

  commits = [];
  for (const hex of ["#111111", "#222222", "#333333", "#444444", "#555555"]) {
    fireInput(hex);
  }
  const midBurst = commits.length;
  await frame();
  const afterFrame = commits.length;
  out.push({
    name: "a burst of dialog moves tells the editor once, at the newest colour",
    pass: midBurst === 0 && afterFrame === 1 && commits[0] === "#555555",
    detail: `during=${midBurst} after=${afterFrame} asked=${commits[0] ?? "-"} want=#555555`,
  });

  /* ---------- 2. the swatch is painted in the same event -------------------- */

  commits = [];
  fireInput("#123456");
  const painted = swatch().style.background;
  out.push({
    name: "the swatch follows the dialog in the same event (no render in between)",
    pass: isPainted(painted, "#123456") && commits.length === 0,
    detail: `swatch=${painted} commits=${commits.length}`,
  });
  await frame();

  /* ---------- 3. every move settles by the frame after the last one -------- */

  commits = [];
  for (const hex of ["#0a0a0a", "#0b0b0b", "#c0ffee"]) {
    fireInput(hex);
    await frame();
  }
  out.push({
    name: "the last colour dialled is committed, nothing left pending behind it",
    pass: commits.length === 3 && commits.at(-1) === "#c0ffee",
    detail: `asked=${commits.join(", ")} want=#0a0a0a, #0b0b0b, #c0ffee`,
  });

  /* ---------- 4. multiple moves across a single frame coalesce down --------- */

  commits = [];
  fireInput("#101010");
  await frame();
  fireInput("#202020");
  fireInput("#303030");
  await frame();
  out.push({
    name: "distinct frames commit distinct values, one per frame",
    pass: commits.length === 2 && commits[0] === "#101010" && commits[1] === "#303030",
    detail: `asked=${commits.join(", ")}`,
  });

  /* ---------- 5. unmount settles the newest pending colour exactly once ----- */

  commits = [];
  fireInput("#d00d1e");
  act(() => {
    root?.unmount();
    root = null;
  });
  await frame();
  out.push({
    name: "unmounting the well settles the newest dialled colour exactly once",
    pass: commits.length === 1 && commits[0] === "#d00d1e",
    detail: `asked=${commits.join(", ")} want=#d00d1e (once)`,
  });

  return out;
}
