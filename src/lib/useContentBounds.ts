import { useLayoutEffect, useState } from "react";
import type { ContentRect } from "./layoutMeasure";

/** Measure after React has painted, and again when fonts, images or the board change. */
export function useContentBounds(key: string | null, measure: () => ContentRect | null): ContentRect | null {
  const [value, setValue] = useState<{ key: string; rect: ContentRect | null } | null>(null);
  useLayoutEffect(() => {
    if (!key) return;
    const update = () => {
      const rect = measure();
      setValue(old => {
        if (old?.key === key && (old.rect === rect || (old.rect && rect &&
          Math.abs(old.rect.x - rect.x) < 0.01 && Math.abs(old.rect.y - rect.y) < 0.01 &&
          Math.abs(old.rect.w - rect.w) < 0.01 && Math.abs(old.rect.h - rect.h) < 0.01))) return old;
        return { key, rect };
      });
    };
    update();
  });
  useLayoutEffect(() => {
    if (!key) return;
    const board = document.querySelector<HTMLElement>('.slide-editable [data-board]');
    if (!board) return;
    const update = () => {
      const rect = measure();
      setValue(old => {
        if (old?.key === key && (old.rect === rect || (old.rect && rect &&
          Math.abs(old.rect.x - rect.x) < 0.01 && Math.abs(old.rect.y - rect.y) < 0.01 &&
          Math.abs(old.rect.w - rect.w) < 0.01 && Math.abs(old.rect.h - rect.h) < 0.01))) return old;
        return { key, rect };
      });
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(board);
    const target = key.startsWith('shape:')
      ? Array.from(board.querySelectorAll<HTMLElement>('[data-shape]')).find(el => el.dataset.shape === key.slice(6))
      : board.querySelector<HTMLElement>(`[data-el="${key}"]`);
    if (target) ro?.observe(target);
    window.addEventListener('resize', update);
    document.fonts?.addEventListener?.('loadingdone', update);
    return () => { ro?.disconnect(); window.removeEventListener('resize', update); document.fonts?.removeEventListener?.('loadingdone', update); };
  }, [key]);
  return value?.key === key ? value.rect : null;
}
