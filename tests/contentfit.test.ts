import { contentMismatch, fitBoxPatch, shouldFit } from "../src/lib/layoutMeasure";
import { frameResizeToBox } from "../src/lib/freeTransform";

type Case = { name: string; pass: boolean; detail?: string };

export function runContentFitTests(): Case[] {
  const cases: Case[] = [];
  const check = (name: string, pass: boolean, detail = "") => cases.push({ name, pass, detail });
  const box = { x: 10, y: 20, w: 40, h: 20 };
  const content = { x: 14, y: 24, w: 18, h: 8 };

  check("tight content within tolerance does not show a fit action", !shouldFit(box, { x: 10.2, y: 20.2, w: 40.4, h: 20.3 }));
  check("content mismatch triggers fit when an edge or size differs beyond tolerance", contentMismatch(box, content) && shouldFit(box, content));
  const patch = fitBoxPatch(content);
  check("fit patch promotes to free mode and hugs content", patch.mode === "free" && patch.x === 14 && patch.y === 24 && patch.w === 18 && patch.h === 8);
  const padded = fitBoxPatch(content, { x: 1, y: 2 });
  check("fit patch restores text padding on all sides", padded.x === 13 && padded.y === 22 && padded.w === 20 && padded.h === 12);

  const east = frameResizeToBox(box, content, { x: 14, y: 24, w: 23, h: 8 });
  check("east resize changes box width by the frame delta and preserves its inset", east.x === 10 && east.w === 45 && east.y === 20 && east.h === 20);
  const west = frameResizeToBox(box, content, { x: 17, y: 24, w: 15, h: 8 });
  check("west resize moves the box left edge by the frame delta", west.x === 13 && west.w === 37);
  const clamped = frameResizeToBox({ x: 10, y: 20, w: 5, h: 5 }, { x: 12, y: 22, w: 2, h: 2 }, { x: 13, y: 23, w: 0.5, h: 0.5 }, { minW: 2, minH: 2 });
  check("content-frame resize respects layout-box minimum sizes", clamped.w >= 2 && clamped.h >= 2);
  return cases;
}
