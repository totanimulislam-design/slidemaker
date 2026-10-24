import { useMemo } from "react";
import Slide from "./Slide";
import { Thumb } from "./SlideViews";
import { Btn } from "./ui";
import { effectiveBackground } from "../lib/background";
import { effectiveHeader, effectiveTheme } from "../lib/overrides";
import { formatBytes, previewDeck, type ShareBundle } from "../lib/shareBundle";

/** A link, a hash or a file that the editor is waiting to open. */
export interface IncomingShare {
  bundle: ShareBundle | null;
  /** user-facing reason when the link could not be read */
  error: string | null;
}

interface Props {
  incoming: IncomingShare | null;
  busy: boolean;
  onOpen: (bundle: ShareBundle) => void;
  onDismiss: () => void;
}

const formatDate = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(timestamp).toLocaleString();
  }
};

/** One readable size for the whole bundle, pictures included. */
const bundleSize = (bundle: ShareBundle) => {
  try {
    return formatBytes(new Blob([JSON.stringify(bundle)]).size);
  } catch {
    return "";
  }
};

/**
 * The door for an incoming project.
 *
 * A share link lands here before it touches the editor: the recipient sees what
 * they were sent (name, slides, pictures, a preview of the first slide) and
 * decides. Opening it is an ordinary deck load — their own draft is replaced
 * only when they say so, and the result is an independent editable copy.
 */
export default function SharedProjectModal({ incoming, busy, onOpen, onDismiss }: Props) {
  const bundle = incoming?.bundle ?? null;
  const deck = useMemo(() => (bundle ? previewDeck(bundle) : null), [bundle]);

  if (!incoming) return null;

  const slides = bundle?.deck.slides.length ?? 0;
  const pictures = bundle ? Object.keys(bundle.assets ?? {}).length : 0;
  const first = deck?.slides[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-title"
        data-shared-project
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <h2 id="shared-title" className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <span aria-hidden="true" className="text-amber-300">🔗</span> Shared project
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {bundle ? "Someone sent you a deck to edit." : "This link could not be opened."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close shared project"
            onClick={onDismiss}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {incoming.error || !bundle ? (
            <>
              <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {incoming.error ?? "This share link is missing its project data."}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Ask the sender to send the link again (copy all of it), or to send the <code className="rounded bg-white/10 px-1">.mcqdeck</code> project
                file instead. Nothing in your editor has been changed.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {first ? (
                  <div className="pointer-events-none shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/40">
                    <Thumb width={208}>
                      <Slide
                        slide={first}
                        header={effectiveHeader(deck!, first)}
                        theme={effectiveTheme(deck!, first)}
                        globalShapes={deck!.globalShapes}
                        background={effectiveBackground(deck!, first)}
                      />
                    </Thumb>
                  </div>
                ) : (
                  <div className="flex h-[117px] w-[208px] shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 bg-slate-900 text-2xl text-slate-600">
                    ▧
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 data-shared-name className="truncate text-base font-semibold text-slate-100" title={bundle.name}>
                    {bundle.name}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {slides} slide{slides === 1 ? "" : "s"}
                    <span className="mx-1.5 text-slate-700">·</span>
                    {pictures} picture{pictures === 1 ? "" : "s"}
                    {!!bundle.fonts?.length && (
                      <>
                        <span className="mx-1.5 text-slate-700">·</span>
                        {bundle.fonts.length} font{bundle.fonts.length === 1 ? "" : "s"}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Shared {formatDate(bundle.createdAt)}
                    <span className="mx-1.5 text-slate-700">·</span>
                    {bundleSize(bundle)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-[11px] leading-relaxed text-slate-400">
                <p className="font-medium text-amber-200">You get your own editable copy.</p>
                <p className="mt-1">
                  It opens in this editor with every slide, design, shape, picture and font. Your edits stay in this
                  browser and never change the sender's project — when you are done, press <strong>Share</strong> to
                  send your version back.
                </p>
                <p className="mt-1.5 text-slate-500">
                  Opening replaces the deck that is in the editor now. Save yours first (My project or Save) if you want
                  to keep it.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <span className="text-[11px] text-slate-600">
            {bundle ? "Nothing is shared until you open it." : "Your editor has not been changed."}
          </span>
          <div className="flex gap-2">
            <Btn disabled={busy} onClick={onDismiss}>
              {bundle ? "Not now" : "Close"}
            </Btn>
            {bundle && (
              <Btn variant="primary" disabled={busy} onClick={() => onOpen(bundle)}>
                {busy ? "Opening…" : "Open for editing"}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
