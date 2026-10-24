/** Named projects: store round-trips plus the real editor save/change/reopen flow. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../src/App";
import {
  deleteProject,
  getProject,
  listProjects,
  renameProject,
  saveProject,
} from "../src/lib/projectStore";
import { DEFAULT_HEADER, DEFAULT_THEME, type Deck } from "../src/lib/types";

type Win = Window & typeof globalThis;
const win = window as unknown as Win;
const doc = document as Document & { defaultView: Win };

export interface CaseResult {
  name: string;
  pass: boolean;
  detail?: string;
}

const click = (element: Element | null | undefined) => {
  act(() => {
    (element as HTMLElement | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const type = (element: HTMLInputElement | null, value: string) => {
  if (!element) return;
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
};

const settle = () => act(async () => {
  await Promise.resolve();
  await new Promise<void>((resolve) => win.setTimeout(resolve, 0));
});

const button = (label: string, scope: ParentNode = doc) =>
  Array.from(scope.querySelectorAll<HTMLElement>("button")).find((item) => item.textContent?.trim() === label) ?? null;

const myProjectButton = () =>
  Array.from(doc.querySelectorAll<HTMLElement>("header button")).find((item) => item.textContent?.includes("My project")) ?? null;

const deckWith = (question: string): Deck => ({
  header: { ...DEFAULT_HEADER, title: "Project store test" },
  theme: DEFAULT_THEME,
  slides: [
    {
      id: `slide-${question}`,
      number: "1",
      question,
      options: [{ key: "ক", text: "Answer" }],
      answer: "ক",
      scale: 1,
      showAnswer: false,
    },
  ],
  globalShapes: [],
});

export async function runProjectTests(): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  const check = (name: string, pass: boolean, detail = "") => {
    out.push({ name, pass: !!pass, detail });
  };

  /* ------------------------------ store API ----------------------------- */
  const initial = deckWith("Original");
  const created = await saveProject({ name: "  Algebra   chapter 1  ", deck: initial, currentSlide: 8 });
  const id = created.project.id;
  initial.slides[0].question = "Mutated after saving";
  const fetched = await getProject(id);
  check("save creates a named project and trims its display name", created.project.name === "Algebra chapter 1" && !!id, created.project.name);
  check("a saved project is a detached editable deck snapshot", fetched?.deck.slides[0].question === "Original", fetched?.deck.slides[0].question);
  check("the saved editor position is clamped to a real slide", fetched?.currentSlide === 0, String(fetched?.currentSlide));

  const updated = await saveProject({ id, name: "Algebra chapter 1", deck: deckWith("Updated"), currentSlide: 0 });
  check("saving the same id updates the snapshot instead of duplicating it", updated.project.id === id && (await listProjects()).filter((p) => p.id === id).length === 1);
  check("the updated snapshot retains the new slide content", (await getProject(id))?.deck.slides[0].question === "Updated");
  check("an update preserves the original creation time", updated.project.createdAt === created.project.createdAt);

  const renamed = await renameProject(id, "  Renamed project  ");
  check("rename updates metadata without replacing the deck", renamed.name === "Renamed project" && renamed.deck.slides[0].question === "Updated");

  const copy = await saveProject({ name: "A separate copy", deck: deckWith("Copy"), currentSlide: 0 });
  check("saving without an id creates a separate project", copy.project.id !== id && (await listProjects()).length === 2);
  await deleteProject(copy.project.id);
  check("delete removes only the selected saved project", (await getProject(copy.project.id)) === null && (await getProject(id)) !== null);

  /* --------------------------- real editor flow -------------------------- */
  localStorage.removeItem("mcq-slide-studio-active-project");
  localStorage.setItem(
    "mcq-slide-studio-v2",
    JSON.stringify({
      header: { title: "Editor project", brandTop: "B", brandBottom: "", badge: "Q", logo: null, showLogo: false, showBanner: false },
      slides: [
        {
          id: "project-slide-1",
          number: "1",
          question: "Saved question",
          options: [{ key: "ক", text: "One" }],
          answer: "ক",
          scale: 1,
          showAnswer: false,
        },
      ],
      globalShapes: [],
    }),
  );

  const errors: string[] = [];
  const onErr = (event: ErrorEvent) => errors.push(String(event.message));
  win.addEventListener("error", onErr as EventListener);
  const previousConfirm = win.confirm;
  win.confirm = () => true;
  let root: Root | null = null;
  let editorProjectId = "";

  try {
    act(() => {
      root = createRoot(doc.getElementById("root")!);
      root.render(createElement(App));
    });
    await settle();
    check("the header exposes a My project option", !!myProjectButton());

    click(myProjectButton());
    await settle();
    const modal = () => doc.querySelector<HTMLElement>("[data-projects-modal]");
    check("My project opens the saved-project library", !!modal());

    type(doc.querySelector<HTMLInputElement>("#project-name"), "Regression deck");
    click(button("Save project", modal() ?? doc));
    await settle();
    await settle();
    const savedRows = (await listProjects()).filter((project) => project.name === "Regression deck");
    editorProjectId = savedRows[0]?.id ?? "";
    check("Save project stores the deck shown in the editor", savedRows.length === 1 && savedRows[0].deck.slides.length === 1);
    check("the new project appears in the library with an Open action", !!modal()?.querySelector(`[data-project-open="${editorProjectId}"]`));
    check("the active project now offers Save changes and Save as new", !!button("Save changes", modal() ?? doc) && !!button("Save as new", modal() ?? doc));

    click(doc.querySelector('[aria-label="Close My project"]'));
    await settle();
    click(button("Blank slide"));
    await settle();
    check("editing after the save changes the live deck", doc.querySelectorAll("[data-slide-card]").length === 2, `slides=${doc.querySelectorAll("[data-slide-card]").length}`);

    click(myProjectButton());
    await settle();
    click(modal()?.querySelector(`[data-project-open="${editorProjectId}"]`));
    await settle();
    await settle();
    check("Open restores the earlier editable snapshot", !modal() && doc.querySelectorAll("[data-slide-card]").length === 1, `slides=${doc.querySelectorAll("[data-slide-card]").length}`);
    check("the restored question is the saved content", !!doc.querySelector('.slide-editable [data-el="question"]')?.textContent?.includes("Saved question"));
    check("opening a project starts a clean undo history", (doc.querySelector('header button[title="Nothing to undo"]') as HTMLButtonElement | null)?.disabled === true);
    check("no uncaught errors during save and reopen", errors.length === 0, errors.join(" | "));
  } catch (reason) {
    check("the complete project editor flow runs", false, String((reason as Error)?.stack ?? reason));
  } finally {
    act(() => root?.unmount());
    win.removeEventListener("error", onErr as EventListener);
    win.confirm = previousConfirm;
    localStorage.removeItem("mcq-slide-studio-active-project");
    if (editorProjectId) await deleteProject(editorProjectId);
    await deleteProject(id);
  }

  return out;
}
