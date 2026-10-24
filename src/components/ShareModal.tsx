import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, TextInput } from "./ui";
import {
  LINK_SAFE_CHARS,
  buildShare,
  fontsUsedBy,
  formatBytes,
  shareFileBlob,
  shareFileName,
  type ShareBuild,
} from "../lib/shareBundle";
import type { Deck } from "../lib/types";
import { cn } from "../utils/cn";

interface Props {
  open: boolean;
  deck: Deck;
  /** project name used for the link's preview and the file name */
  name: string;
  currentSlide: number;
  onClose: () => void;
}

/** Triggers a download from a Blob without leaving any URL behind. */
function downloadBlob(blob: Blob, filename: string) {
  let url = "";
  try {
    url = URL.createObjectURL(blob);
  } catch {
    return false;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, 4000);
  return true;
}

/**
 * “Share project”.
 *
 * Builds one portable snapshot of the deck — slides, designs, bitmaps and
 * (opt-in) the custom fonts the deck uses — and offers it two ways: a link that
 * carries the whole project in its hash, and a `.mcqdeck` file for the decks
 * whose pictures make a link impractical. Nothing is uploaded: the project
 * travels with the message the sender sends.
 */
export default function ShareModal({ open, deck, name, currentSlide, onClose }: Props) {
  const [build, setBuild] = useState<ShareBuild | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"link" | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  /**
   * Custom fonts are user-uploaded faces whose licences may not allow passing
   * the file on, so they are opt-in — off unless the sender says it is fine.
   */
  const [includeFonts, setIncludeFonts] = useState(false);
  const fontCount = useMemo(() => fontsUsedBy(deck).length, [deck]);
  const linkRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBuild(null);
    setError(null);
    setBusy(true);
    setCopied(null);
    setDownloaded(false);
    void buildShare(deck, { name, currentSlide, includeFonts })
      .then((result) => {
        if (!cancelled) setBuild(result);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "This project could not be prepared.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, deck, name, currentSlide, includeFonts]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  if (!open) return null;

  const link = build?.link ?? "";
  const tooLong = !!build?.tooLong;
  const longButUsable = !!build && !tooLong && build.chars > LINK_SAFE_CHARS;
  const safe = !!build && !tooLong && build.chars <= LINK_SAFE_CHARS;
  /** a build with no page address (opened from a file: URL) cannot make links */
  const noUrl = !!build && !link;
  /** a link built on localhost only opens on this machine */
  const localHost =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(window.location.hostname);
  const title = name.trim() || deck.header.title.trim() || "Shared project";
  const slideCount = build?.bundle.deck.slides.length ?? deck.slides.length;
  const imageCount = build?.images ?? 0;

  const copyLink = async () => {
    if (!link) return;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // old browsers / non-secure origins: copy out of the visible field
      const field = linkRef.current;
      if (field) {
        field.focus();
        field.select();
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
      }
    }
    if (ok) {
      setCopied("link");
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 2200);
    }
  };

  const saveFile = () => {
    if (!build) return;
    setDownloaded(downloadBlob(shareFileBlob(build.bundle), shareFileName(title)));
  };

  const message = `I made a slide deck in MCQ Slide Studio — open this to edit your own copy: ${link}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        data-share-modal
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <h2 id="share-title" className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <span aria-hidden="true" className="text-amber-300">🔗</span> Share project
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Send the deck to someone — they open it here and edit their own copy.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Share project"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <section className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.09] to-indigo-500/[0.06] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {slideCount} slide{slideCount === 1 ? "" : "s"}
                  <span className="mx-1.5 text-slate-700">·</span>
                  {imageCount} embedded picture{imageCount === 1 ? "" : "s"}
                  {build && (
                    <>
                      <span className="mx-1.5 text-slate-700">·</span>
                      {formatBytes(build.bytes)} project
                    </>
                  )}
                </p>
              </div>
              {build && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium",
                    tooLong || noUrl
                      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                      : safe
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-200",
                  )}
                >
                  {noUrl ? "File only" : tooLong ? "Too large for a link" : safe ? "Link ready" : "Long link"}
                </span>
              )}
            </div>

            <label htmlFor="share-link" className="mt-4 mb-2 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Share link
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                id="share-link"
                ref={linkRef}
                data-share-link
                readOnly
                value={busy || tooLong || noUrl ? "" : link}
                placeholder={
                  busy
                    ? "Preparing the project…"
                    : noUrl
                      ? "No web address here — use the project file below"
                      : tooLong
                        ? "Use the project file below"
                        : "The link appears here"
                }
                onFocus={(event) => event.target.select()}
                aria-label="Share link"
                className="min-w-0 flex-1 font-mono text-[11px]"
              />
              <Btn
                variant="primary"
                className="shrink-0"
                disabled={!link || busy || tooLong || noUrl}
                onClick={() => void copyLink()}
                title={tooLong ? "This project is too large to send as a link — use the project file" : "Copy the whole project as a link"}
              >
                {copied === "link" ? "Copied ✓" : "Copy link"}
              </Btn>
            </div>

            {busy ? (
              <p className="mt-2.5 text-[11px] text-slate-500">Packing slides, pictures and fonts…</p>
            ) : noUrl ? (
              <p className="mt-2.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                This editor was opened from a local file, so it has no web address to build a link from. Send the
                <strong> project file</strong> below instead.
              </p>
            ) : error ? (
              <p role="alert" className="mt-2.5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            ) : tooLong ? (
              <p className="mt-2.5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                This project is {formatBytes(build?.bytes ?? 0)} — too big for a link a chat app will keep intact.
                Send the <strong>project file</strong> below instead; it carries exactly the same slides.
              </p>
            ) : longButUsable ? (
              <p className="mt-2.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                This is a long link ({Math.round((build?.chars ?? 0) / 1024)} KB). Browsers open it, but some chat apps
                cut long links — the project file is the safer way to send this one.
              </p>
            ) : (
              <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
                The whole project travels inside the link — nothing is uploaded anywhere. Anyone who has the link can
                open an editable copy.
              </p>
            )}

            {!!link && !tooLong && localHost && (
              <p className="mt-2.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                This editor is running on this computer, so the link would only open here. Send the project file, or put
                the editor online first.
              </p>
            )}

            {build && safe && !noUrl && !!link && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 hover:bg-white/10"
                >
                  Send on WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 hover:bg-white/10"
                >
                  Send by e-mail
                </a>
                {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.share({ title, text: message, url: link }).catch(() => undefined);
                    }}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 hover:bg-white/10"
                  >
                    Share…
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4" data-share-file>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-100">Project file</h3>
                <p className="mt-1 max-w-md text-[11px] leading-relaxed text-slate-400">
                  A single <code className="rounded bg-white/10 px-1">.mcqdeck</code> file that holds the same
                  project. The other person opens it with <strong>Open</strong> and edits straight away — good for
                  picture-heavy decks and for sending through e-mail attachments.
                </p>
              </div>
              <Btn variant="success" disabled={!build} onClick={saveFile} className="shrink-0">
                {downloaded ? "Downloaded ✓" : "⬇ Download .mcqdeck"}
              </Btn>
            </div>
            {build && (
              <p className="mt-2.5 text-[11px] text-slate-500">
                {shareFileName(title)}
                <span className="mx-1.5 text-slate-700">·</span>
                {formatBytes(build.bytes)}
                {build.bundle.fonts.length > 0 && (
                  <>
                    <span className="mx-1.5 text-slate-700">·</span>
                    {build.bundle.fonts.length} custom font{build.bundle.fonts.length === 1 ? "" : "s"} included
                  </>
                )}
              </p>
            )}
            {!!build?.fontsDropped && (
              <p className="mt-1 text-[11px] text-amber-300/90">
                {build.fontsDropped} custom font{build.fontsDropped === 1 ? " is" : "s are"} left out of the link to
                keep it short. Send the project file to carry the font{build.fontsDropped === 1 ? "" : "s"} itself.
              </p>
            )}
            {fontCount > 0 && (
              <label className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <input
                  type="checkbox"
                  data-share-fonts
                  checked={includeFonts}
                  onChange={(event) => setIncludeFonts(event.target.checked)}
                  className="mt-0.5 accent-amber-400"
                />
                <span className="text-[11px] leading-relaxed text-slate-400">
                  Include the {fontCount} custom font{fontCount === 1 ? "" : "s"} this deck uses, so the typeface
                  looks the same on the other side. Only do this if the font's licence allows sharing the file.
                  {!includeFonts && " Without it, the recipient needs that font installed to see the exact typeface."}
                </span>
              </label>
            )}
            {!!build?.missingImages.length && (
              <p className="mt-1 text-[11px] text-amber-300/90">
                {build.missingImages.length} picture{build.missingImages.length === 1 ? "" : "s"} could not be found in
                this browser and will show as empty on the other device.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">How it works</h3>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-500">
              <li>
                <span className="text-slate-300">They get their own copy.</span> Opening the project adds it to their
                editor; their edits stay in their browser and never change yours.
              </li>
              <li>
                <span className="text-slate-300">Send it back the same way.</span> When they have edited it, they press
                Share and send you a new link or file.
              </li>
              <li>
                <span className="text-slate-300">Everything travels with it:</span> slides, designs, drawn shapes and
                pictures — plus the custom fonts, if you choose to include them.
              </li>
            </ul>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <span className="text-[11px] text-slate-600">Nothing is uploaded — the project is inside the link or file.</span>
          <Btn onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  );
}
