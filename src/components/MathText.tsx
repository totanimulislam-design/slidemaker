import { useMemo, type ReactNode } from "react";
import katex from "katex";

const TOKEN = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]*?\$|\\\([\s\S]+?\\\))/g;

function renderMath(src: string, display: boolean) {
  try {
    return katex.renderToString(src, {
      displayMode: display,
      throwOnError: false,
      output: "html",
      strict: false,
      trust: true,
      macros: { "\\bn": "\\text" },
    });
  } catch {
    return `<span class="katex-error">${src}</span>`;
  }
}

interface Props {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Styles for an INLINE wrapper around each line's glyphs — the "background"
   * text effect paints its plate there, so it hugs every line (and every
   * wrapped fragment of it) instead of filling the whole box.
   */
  inlineStyle?: React.CSSProperties;
  /**
   * The part's background shape (components/TextBgShape `textBgWrap`): with
   * scope "line" every line's glyphs are handed to `render` for a plate of
   * their own; with scope "block" the whole text is, for one plate behind
   * everything. Nothing is wrapped when it is absent.
   */
  wrap?: { scope: "line" | "block"; render: (children: ReactNode) => ReactNode };
}

/** Renders mixed Bangla/English text with inline $LaTeX$ / $$display$$ segments. */
export default function MathText({ text, className, style, inlineStyle, wrap }: Props) {
  const lines = useMemo(() => {
    return (text ?? "").split("\n").map((line) => {
      const parts = line.split(TOKEN).filter((p) => p !== undefined && p !== "");
      return parts.map((part) => {
        if (/^\$\$[\s\S]*\$\$$/.test(part)) return { type: "math" as const, html: renderMath(part.slice(2, -2), true) };
        if (/^\\\[[\s\S]*\\\]$/.test(part)) return { type: "math" as const, html: renderMath(part.slice(2, -2), true) };
        if (/^\$[\s\S]*\$$/.test(part)) return { type: "math" as const, html: renderMath(part.slice(1, -1), false) };
        if (/^\\\([\s\S]*\\\)$/.test(part)) return { type: "math" as const, html: renderMath(part.slice(2, -2), false) };
        return { type: "text" as const, value: part };
      });
    });
  }, [text]);

  const body = lines.map((parts, li) => (
    // `plaintext` applies the Unicode bidi algorithm per line, so a Bangla,
    // English or Arabic line each flows in its own natural direction.
    <span key={li} style={{ display: "block", unicodeBidi: "plaintext" }}>
      {(() => {
        const nodes = parts.map((p, i) =>
          p.type === "math" ? (
            // equations are always left-to-right, even inside RTL sentences
            <span
              key={i}
              className="math-seg"
              dir="ltr"
              style={{ unicodeBidi: "isolate", direction: "ltr" }}
              dangerouslySetInnerHTML={{ __html: p.html }}
            />
          ) : (
            <span key={i}>{p.value}</span>
          ),
        );
        const glyphs = inlineStyle && parts.length ? <span style={inlineStyle}>{nodes}</span> : nodes;
        // a plate per line hugs that line's glyphs; an empty line gets none
        return wrap?.scope === "line" && parts.length ? wrap.render(glyphs) : glyphs;
      })()}
    </span>
  ));

  return (
    <span className={className} style={style}>
      {wrap?.scope === "block" ? wrap.render(body) : body}
    </span>
  );
}
