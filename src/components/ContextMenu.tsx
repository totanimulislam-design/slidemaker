import { useEffect, type ReactNode } from "react";

/**
 * Canva-style right-click menu, shared by drawn items, built-in slide elements
 * and the empty board.
 *
 * Controlled: App owns the open state and the action list, so the single source
 * of truth for move / group / z-order / alignment behaviour stays in the deck
 * store — this component only paints and dispatches clicks.
 */

export interface MenuAction {
  id: string;
  label: ReactNode;
  shortcut?: string;
  /** disables the entry (still shown, greyed out) */
  disabled?: boolean;
  danger?: boolean;
  onPick?: () => void;
  /** a nested submenu; the children render into the fly-out on hover */
  sub?: MenuAction[];
}

export interface ContextMenuState {
  x: number;
  y: number;
}

/** approx pixel height of a menu row (labels are single-line) */
const ROW_PX = 32;

export default function ContextMenu({
  menu,
  actions,
  onClose,
}: {
  menu: ContextMenuState | null;
  actions: MenuAction[];
  onClose: () => void;
}) {
  const open = !!menu && actions.length > 0;

  /** any press elsewhere (or a resize / blur / scroll) dismisses the menu */
  useEffect(() => {
    if (!open) return;
    const dismiss = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("blur", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const estH = 14 + actions.length * ROW_PX;
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const flip = menu.y + estH > vh - 8;
  const left = Math.max(8, Math.min(menu.x, vw - 226));

  const pick = (a: MenuAction) => {
    onClose();
    a.onPick?.();
  };

  return (
    <div
      role="menu"
      data-context-menu
      className="fixed z-[120] min-w-[206px] rounded-xl border border-white/15 bg-[#0e1526]/[.98] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,.65),0_0_0_1px_rgba(255,255,255,.05)] backdrop-blur-md"
      style={{ left, top: flip ? menu.y - estH - 6 : menu.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {actions.map((a) =>
        a.sub ? (
          <div key={a.id} className="ctx-menu-parent">
            <button
              type="button"
              aria-haspopup="menu"
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[12.5px] text-slate-200 hover:bg-white/10"
            >
              <span>{a.label}</span>
              <span aria-hidden="true" className="text-[10px] text-slate-500">
                ▸
              </span>
            </button>
            <div role="menu" className="ctx-submenu">
              {a.sub.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  disabled={s.disabled}
                  onClick={() => pick(s)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-[12.5px] ${
                    s.disabled ? "cursor-not-allowed text-slate-600" : s.danger ? "text-rose-300 hover:bg-rose-500/15" : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span>{s.label}</span>
                  {s.shortcut && <span className="text-[10px] text-slate-500">{s.shortcut}</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            key={a.id}
            type="button"
            role="menuitem"
            disabled={a.disabled}
            onClick={() => pick(a)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-[12.5px] ${
              a.disabled ? "cursor-not-allowed text-slate-600" : a.danger ? "text-rose-300 hover:bg-rose-500/15" : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <span>{a.label}</span>
            {a.shortcut && <span className="text-[10px] text-slate-500">{a.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
