import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface FontPreview {
  target: string;
  family: string;
}

interface Ctx {
  preview: FontPreview | null;
  setPreview: (target: string, family: string) => void;
  clearPreview: () => void;
}

const FontPreviewCtx = createContext<Ctx>({
  preview: null,
  setPreview: () => {},
  clearPreview: () => {},
});

export function FontPreviewProvider({ children }: { children: ReactNode }) {
  const [preview, setPreviewState] = useState<FontPreview | null>(null);

  const setPreview = useCallback((target: string, family: string) => {
    if (!target || !family) return;
    setPreviewState({ target, family });
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewState(null);
  }, []);

  return (
    <FontPreviewCtx.Provider value={{ preview, setPreview, clearPreview }}>
      {children}
    </FontPreviewCtx.Provider>
  );
}

export function useFontPreview() {
  return useContext(FontPreviewCtx);
}

/**
 * Helper to decide if a preview target matches a box id.
 * target forms:
 *  box:title, box:question, box:options, etc
 *  deck:bengali, deck:latin, deck:arabic
 *  optionBullet
 *  shape:<id>
 */
export function isBoxPreview(preview: FontPreview | null, boxId: string): string | null {
  if (!preview) return null;
  if (preview.target === `box:${boxId}`) return preview.family;
  // deck fonts affect boxes that use them as fallback
  if (preview.target === "deck:bengali" && (boxId === "question" || boxId === "title" || boxId === "note" || boxId === "options")) {
    // for preview purpose, treat deck font as box preview when box has no override
    // caller will decide if box has override
    return preview.family;
  }
  if (preview.target === "deck:latin" && (boxId === "brand" || boxId === "badge" || boxId === "title")) {
    return preview.family;
  }
  if (preview.target === "deck:arabic") {
    return preview.family;
  }
  return null;
}
