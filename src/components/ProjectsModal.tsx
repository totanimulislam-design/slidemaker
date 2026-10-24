import { useCallback, useEffect, useRef, useState } from "react";
import Slide from "./Slide";
import { Thumb } from "./SlideViews";
import { Btn, TextInput } from "./ui";
import { effectiveBackground } from "../lib/background";
import { effectiveHeader, effectiveTheme } from "../lib/overrides";
import {
  deleteProject,
  listProjects,
  projectFingerprint,
  projectStoreKind,
  renameProject,
  saveProject,
  type ProjectIdentity,
  type SavedProject,
} from "../lib/projectStore";
import type { Deck } from "../lib/types";
import { cn } from "../utils/cn";

interface Props {
  open: boolean;
  deck: Deck;
  currentSlide: number;
  activeProject: ProjectIdentity | null;
  /** edits made in this session since the last project save/open */
  dirty: boolean;
  onClose: () => void;
  onOpen: (project: SavedProject) => Promise<void>;
  onSaved: (project: SavedProject) => void;
  onActiveChange: (project: ProjectIdentity | null) => void;
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

function ProjectThumb({ project }: { project: SavedProject }) {
  const slide = project.deck.slides[0];
  if (!slide) {
    return (
      <div className="flex h-[104px] w-[184px] shrink-0 items-center justify-center rounded-md border border-dashed border-white/15 bg-slate-900 text-2xl text-slate-600">
        ▧
      </div>
    );
  }
  return (
    <div className="pointer-events-none w-[184px] shrink-0 overflow-hidden rounded-md shadow-lg shadow-black/30">
      <Thumb width={184}>
        <Slide
          slide={slide}
          header={effectiveHeader(project.deck, slide)}
          theme={effectiveTheme(project.deck, slide)}
          globalShapes={project.deck.globalShapes}
          background={effectiveBackground(project.deck, slide)}
        />
      </Thumb>
    </div>
  );
}

/** A named project library: snapshots stay fully editable when reopened. */
export default function ProjectsModal({
  open,
  deck,
  currentSlide,
  activeProject,
  dirty,
  onClose,
  onOpen,
  onSaved,
  onActiveChange,
}: Props) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionOnly, setSessionOnly] = useState(projectStoreKind() === "memory");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
      setLoaded(true);
    } catch {
      setError("The project library could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setNotice(null);
    setRenameId(null);
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (open) setName(activeProject?.name ?? (deck.header.title.trim() || "Untitled project"));
  }, [open, activeProject?.id, activeProject?.name, deck.header.title]);

  /* A stale active id can remain after browser data was cleared. */
  useEffect(() => {
    if (!open || !loaded || loading || error || !activeProject) return;
    const match = projects.find((project) => project.id === activeProject.id);
    if (!match) onActiveChange(null);
    else if (match.name !== activeProject.name) onActiveChange({ id: match.id, name: match.name });
  }, [open, loaded, loading, error, activeProject, projects, onActiveChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const saveCurrent = async (asNew: boolean) => {
    if (!name.trim()) {
      setError("Give the project a name before saving.");
      nameRef.current?.focus();
      return;
    }
    setBusy(asNew ? "Saving a new project…" : "Saving project…");
    setError(null);
    setNotice(null);
    try {
      const result = await saveProject({
        id: asNew ? undefined : activeProject?.id,
        name,
        deck,
        currentSlide,
      });
      setProjects((previous) => [result.project, ...previous.filter((project) => project.id !== result.project.id)]);
      setName(result.project.name);
      setSessionOnly((value) => value || !result.persistent);
      onSaved(result.project);
      setNotice(
        result.persistent
          ? `Saved “${result.project.name}”. You can close the editor and reopen it here later.`
          : `Saved “${result.project.name}” for this session only. Download a JSON backup for a permanent copy.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be saved.");
    } finally {
      setBusy(null);
    }
  };

  const hasUnsavedWork = () => {
    if (!activeProject || dirty) return true;
    const saved = projects.find((project) => project.id === activeProject.id);
    if (!saved) return true;
    try {
      return projectFingerprint(saved.deck) !== projectFingerprint(deck);
    } catch {
      return true;
    }
  };

  const openSavedProject = async (project: SavedProject) => {
    if (
      hasUnsavedWork() &&
      !window.confirm(
        `Open “${project.name}”? The current editor has changes that are not saved to its named project. Save them first if you want to keep them in that project.`,
      )
    ) {
      return;
    }
    setBusy(`Opening “${project.name}”…`);
    setError(null);
    try {
      await onOpen(project);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be opened.");
    } finally {
      setBusy(null);
    }
  };

  const commitRename = async (project: SavedProject) => {
    if (!renameName.trim()) {
      setError("A project name cannot be empty.");
      return;
    }
    setBusy("Renaming project…");
    setError(null);
    try {
      const renamed = await renameProject(project.id, renameName);
      setProjects((previous) => previous.map((item) => (item.id === renamed.id ? renamed : item)));
      if (activeProject?.id === renamed.id) onActiveChange({ id: renamed.id, name: renamed.name });
      setRenameId(null);
      setNotice(`Renamed project to “${renamed.name}”.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be renamed.");
    } finally {
      setBusy(null);
    }
  };

  const removeProject = async (project: SavedProject) => {
    if (!window.confirm(`Delete “${project.name}” from My project? This cannot be undone.`)) return;
    setBusy("Deleting project…");
    setError(null);
    try {
      await deleteProject(project.id);
      setProjects((previous) => previous.filter((item) => item.id !== project.id));
      if (activeProject?.id === project.id) onActiveChange(null);
      setNotice(`Deleted “${project.name}”. The deck currently open in the editor was not changed.`);
    } catch {
      setError("The project could not be deleted.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-title"
        data-projects-modal
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <h2 id="projects-title" className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <span aria-hidden="true" className="text-amber-300">▣</span> My project
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Save editable decks in this browser and reopen them later.</p>
          </div>
          <button
            type="button"
            aria-label="Close My project"
            onClick={() => !busy && onClose()}
            className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.09] to-indigo-500/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {activeProject ? `Current project · ${activeProject.name}` : "Save the current deck"}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {deck.slides.length} slide{deck.slides.length === 1 ? "" : "s"}
                  {activeProject && dirty ? " · unsaved changes" : ""}
                </p>
              </div>
              {activeProject && (
                <span className={cn(
                  "shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium",
                  dirty ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
                )}>
                  {dirty ? "Unsaved" : "Saved"}
                </span>
              )}
            </div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-slate-400" htmlFor="project-name">
              Project name
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                id="project-name"
                ref={nameRef}
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !busy && !loading) void saveCurrent(false);
                }}
                placeholder="e.g. Algebra — Chapter 3"
                aria-label="Project name"
                className="min-w-0 flex-1"
              />
              <div className="flex shrink-0 gap-2">
                <Btn
                  variant="primary"
                  disabled={!!busy || loading || !name.trim()}
                  title={activeProject ? "Update this saved project with the editor's current deck" : "Create a saved project"}
                  onClick={() => void saveCurrent(false)}
                >
                  {busy?.startsWith("Saving project") ? "Saving…" : activeProject ? "Save changes" : "Save project"}
                </Btn>
                {activeProject && (
                  <Btn
                    disabled={!!busy || loading || !name.trim()}
                    title="Save the editor as a separate project, leaving the original snapshot untouched"
                    onClick={() => void saveCurrent(true)}
                  >
                    Save as new
                  </Btn>
                )}
              </div>
            </div>
            <p className={cn("mt-2.5 text-[11px]", sessionOnly ? "text-amber-300" : "text-slate-500")}>
              {sessionOnly
                ? "Browser storage is unavailable here: projects last for this session only. Use Save (.json) for a permanent backup."
                : "Stored locally on this device. Use Save (.json) for a portable backup."}
            </p>
          </section>

          {error && <p role="alert" className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
          {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{notice}</p>}

          <div className="mt-5 mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Saved projects <span className="ml-1 text-slate-600">{projects.length}</span>
            </h3>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading || !!busy}
              className="text-[11px] text-slate-500 hover:text-slate-200 disabled:opacity-40"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {loading && !projects.length ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-slate-500">Loading your projects…</div>
          ) : !projects.length ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-xl text-amber-300">▣</div>
              <h4 className="text-sm font-medium text-slate-200">No saved projects yet</h4>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                Name the deck above and choose “Save project”. It will appear here, ready to reopen and continue editing.
              </p>
              <button type="button" onClick={() => nameRef.current?.focus()} className="mt-3 text-xs font-medium text-amber-300 hover:underline">
                Name your first project
              </button>
            </div>
          ) : (
            <div className="space-y-3" data-project-list>
              {projects.map((project) => {
                const active = activeProject?.id === project.id;
                const renaming = renameId === project.id;
                return (
                  <article
                    key={project.id}
                    data-project-id={project.id}
                    className={cn(
                      "flex flex-col gap-4 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center",
                      active ? "border-amber-400/40 bg-amber-400/[0.055]" : "border-white/10 bg-white/[0.025] hover:border-white/20",
                    )}
                  >
                    <button
                      type="button"
                      data-project-open={project.id}
                      aria-label={`Open project ${project.name}`}
                      title={`Open “${project.name}” for editing`}
                      disabled={!!busy}
                      onClick={() => void openSavedProject(project)}
                      className="self-start rounded-md text-left focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50 sm:self-center"
                    >
                      <ProjectThumb project={project} />
                    </button>
                    <div className="min-w-0 flex-1 self-stretch py-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {renaming ? (
                          <div className="flex w-full flex-col gap-2 sm:flex-row">
                            <TextInput
                              value={renameName}
                              maxLength={80}
                              autoFocus
                              aria-label={`New name for ${project.name}`}
                              onChange={(event) => setRenameName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void commitRename(project);
                                if (event.key === "Escape") {
                                  event.stopPropagation();
                                  setRenameId(null);
                                }
                              }}
                            />
                            <div className="flex shrink-0 gap-1.5">
                              <Btn size="sm" variant="primary" disabled={!!busy} onClick={() => void commitRename(project)}>Save name</Btn>
                              <Btn size="sm" disabled={!!busy} onClick={() => setRenameId(null)}>Cancel</Btn>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4 className="max-w-full truncate text-sm font-semibold text-slate-100" title={project.name}>{project.name}</h4>
                            {active && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">Open now</span>}
                          </>
                        )}
                      </div>
                      {!renaming && (
                        <>
                          <p className="mt-1.5 text-[11px] text-slate-400">
                            {project.deck.slides.length} slide{project.deck.slides.length === 1 ? "" : "s"}
                            <span className="mx-1.5 text-slate-700">·</span>
                            Saved {formatDate(project.updatedAt)}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-slate-600">
                            {project.deck.slides[0]?.question.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "Blank project"}
                          </p>
                        </>
                      )}
                    </div>
                    {!renaming && (
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:max-w-[150px] sm:justify-end">
                        <Btn size="sm" variant="soft" disabled={!!busy} onClick={() => void openSavedProject(project)}>Open</Btn>
                        <Btn
                          size="sm"
                          disabled={!!busy}
                          title="Rename project"
                          onClick={() => {
                            setRenameId(project.id);
                            setRenameName(project.name);
                            setNotice(null);
                            setError(null);
                          }}
                        >
                          Rename
                        </Btn>
                        <Btn size="sm" variant="danger" disabled={!!busy} title="Delete saved project" onClick={() => void removeProject(project)}>Delete</Btn>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <span className="text-[11px] text-slate-600" role="status">{busy ?? "Reopening restores slides, designs, text, shapes and image references."}</span>
          <Btn disabled={!!busy} onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  );
}
