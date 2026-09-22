# slidemaker

MCQ Slide Studio — paste Bengali/English MCQ questions and generate editable, exportable quiz slides.

```bash
npm install
npm run dev        # editor on http://localhost:5173
npm run build      # single-file dist/index.html
npm run test:drag  # pointer / drag + inspector navigation suites (jsdom)
```

## Slide stack

The left rail is a drag surface. Press a slide card, move the mouse, and the
card is carried to **anywhere** in the stack — the cards in between open a
landing gap live, a small preview follows the cursor, and a real mouse release
commits the drop (one undo step). Hovering the top half of a card drops before
it, the bottom half after, and hovering past the last card goes to the very
end. A plain click still just opens the slide; the ↑ / ↓ / ⧉ / ✕ hover buttons
keep working as one-slot steps, duplicate and delete. The reorder runs through
the same guarded pointer session as the board and the layer list, so a press
that never travels can't move a slide and a pointercancel, blur or hidden tab
abandons the drop instead of committing it.

There is also a **slide selector in the top-right corner** of the editor
(`🎞 3 / 12`): it opens the whole deck as a list of live previews — number,
question and answer state — and jumps the editor to the picked slide.
`Esc` or a click away closes it. The list is sized to the room under it
(`useRoomBelow` in `src/lib/useRoomBelow.ts`), so a long deck opens all the way
down the window and only then starts scrolling, instead of stopping at a fixed
cap with empty screen left below it.

The card the editor is showing wears a **moving gradient border**: the frame is
painted by a colour ramp clipped to the border box under the card's own surface,
and the ramp keeps sliding around it (`slideCardBorderFlow` in `src/index.css`),
with a soft pulsing halo on top. `prefers-reduced-motion` freezes it on a static
gradient, and the border drops back to a dashed amber outline while a card is
being carried.

### Selecting several slides

Every card has a **selection box** in its top-left corner. Ticking boxes builds a
multi-selection:

- **tick a box** — adds that slide, and never opens it (a press on a box can't
  start a reorder drag either);
- **Ctrl / ⌘ + click a card** — toggles that card in and out of the selection;
- **Shift + click a card** — selects the whole range from the last card clicked;
- **the box next to `Slides`** — ticks the entire deck, and unticks it from a
  full selection (it shows indeterminate while the selection is partial);
- **a plain click** — opens the slide and leaves it as the only ticked one;
- **`Esc`** — clears the selection.

While anything is ticked, a **bulk bar** appears under the rail header with the
count and two actions: ⧉ duplicate and ✕ delete. Both run over the whole ticked
set as **one undo step** — a duplicate drops each copy directly after its
original, and a delete keeps the editor on the open slide when it survived.

The ticked set is the same list the inspector's **Target Scope → Selected**
reads, so ticking cards in the rail is enough to restyle those slides together;
a multi-tick moves that scope onto “Selected” for you. Ticks whose slide is
gone (deleted, undone, replaced by another deck) drop out on their own.

## Importing a ready-made deck (PDF / PPTX)

**📄 Import PDF / PPTX** in the toolbar — or dropping a file on the board, the
Uploads panel, the Shapes panel or pasting it — saves the file to **Uploads** and
opens its page preview:

- pick the **whole document** or **specific pages** (click thumbnails, or type
  `1-3, 7`);
- add them as **new slides with the page as background**, **new slides with the
  page as a picture** (movable / croppable), or as **pictures on the current
  slide**;
- the document stays in **Uploads** as **one entry — the file itself**, never as
  a picture per page.

### A PDF is kept as a PDF

The Uploads library holds the `.pdf` / `.pptx` **whole**: one tile showing a
cover picture of page 1, the file name and the page count. The file's own bytes
live in IndexedDB (`src/lib/docStore.ts`) rather than in localStorage, which
would blow its quota on the first real PDF — the library keeps only the
metadata and the small cover next to the pictures. Where IndexedDB is not
available the bytes are held for the session and the tile says so.

**Clicking that tile opens the document's page preview again**, with every page
as a thumbnail: tick the pages you want (Shift-click for a range, or type
`1-3, 7`), choose where they go, and add them. So a document brought in once can
be mined for pages at any time, and pages that were added earlier never pile up
in the library as separate pictures — a page placed on a slide is tagged
`importedPage` and is left out of the library's own image index for the same
reason. Uploading the same file again refreshes the existing entry (matched by a
content fingerprint) instead of adding a second one; deleting the tile drops the
stored file with it.

### Imported pages are plain slides of your own

A page that becomes a slide is **merged into the project as its own slide** — it
does not get poured into your template. Those slides carry `plainPage`, so none
of the project's built-in design is painted on them: **no frame, no logo, no
brand lines, no title banner, no badge**, and the deck's gradient / vector
background design does not show through the page either. What you see is the
user's own material, on a slide that is otherwise completely ordinary: draw
shapes and text boxes on it, reposition or crop it, give it a footnote, reorder
it in the stack. The Layers panel lists the design rows as *absent* there, so
nothing pretends to be on the slide that is not.

**Slide background → “Deck design on this slide”** switches the project's design
back on for that one slide (and off again). **↩ Revert to Default** in the Target
Scope bar does the same thing along with the slide's other overrides. Applying a
design to *all* slides leaves plain pages alone on purpose — your material is
never re-covered by the template without asking.

The pages that are dropped **onto the slide you are editing** keep that slide's
design, because there they are content, not a slide of their own.

PDF pages are rasterised with pdf.js. PowerPoint `.pptx` files are parsed in
the browser (`pptxtojson`), each slide is laid out in an off-screen DOM at its
native size — background, shapes, pictures, text, tables — and rasterised with
the same renderer the exporter uses (`src/lib/pptx.ts`). Slides therefore come
in as **visual snapshots**: the text on them is not editable. Charts, video and
audio have no renderer and are drawn as a labelled placeholder.

## Slide designs — the Design destination

The **Design** tile no longer holds a handful of colour presets, the deck's base
colour wells or shared font pickers. It opens a **gallery of complete slide
designs** instead: `src/lib/slideDesigns.ts` ships **128 designs** in **16
families** (Classic board, Chalk & slate, Neon night, Exam paper, Royal luxe,
Medical mint, Mesh gradient, Sunset energy, Campus blue, Gilt arabesque,
Notebook, Minimal mono, Cyber grid, Pastel junior, Deep forest, Retro print),
each family a different way real MCQ slides are built, and each design a whole
look rather than a colour swap.

Every design combines all **thirteen aspects** of a slide
(`DESIGN_ASPECTS`, also listed under the gallery):

| | |
| --- | --- |
| Badge 1 · Badge 2 · Badge 3 | size, colour, faces, plate |
| Title text | ink, size, face, gradient, glow, shadow |
| Title background | plate shape, fill, radius, border, padding, shimmer, halo |
| Question bullet | number style, shape, fill, ring, weight, radius, opacity, effect, preset |
| Question text | ink, size, face |
| Option text | ink, size, line height, face |
| Option bullet marker | shape, treatment, letter ink, fill, ring, case, size |
| Option bullet background | plate colour, scope, shape, size, opacity |
| Option row | row style, accent, gap |
| Board background | one of the 130 board presets (gradient, art, vignette, opacity) |
| Frame | style, colour, gradient, width, radius, shadow, outer/inner edges |

**The card is the truth.** Each card paints a live 16:9 thumbnail
(`src/components/DesignThumb.tsx` — the design's own `ThemeSettings` patch fed to
a cached `previewTheme`, so 128 thumbnails cost one build), with its name and the
one-line hint of what it is for. Search matches name, hint and family; the family
chips narrow to that family; `All` brings the gallery back.

**Applying is one deck write** (`designPatch` → `patchTheme`, one undo step). It
carries every field of the thirteen aspects so no stale channel is left behind,
and it deliberately **keeps what belongs to the slide**: your background photo,
the frame image and its inset/placement, the element boxes, the layout, the text.
Faces are loaded first (`loadDesignFonts`), so a design never renders with a
fallback font.

**The gallery knows what is in use.** `designFingerprint` reads only the fields
the aspects own, so the painted design's card says **IN USE**, the panel's banner
names it (`data-active-design`) and the toolbar hint chip over the board repeats
it with **◀ / ▶** to walk the gallery (a ring: next after the last is the first).
Hand-tune any one of those channels and the deck is no longer a catalogue design:
the card stops claiming it and everything reads **Custom look**.

**Readability is guarded, not hoped for.** Every ink a design brings is checked
against the surface it is really painted on — the board's own gradient stop, a
filled plate's first stop, a marker's fill, a badge's plate — and an ink below
contrast is replaced by one that reads (`contrastOf` / `inkOn` in
`lib/slideDesigns.ts`). `tests/slidedesigns.test.tsx` pins all of it: the
catalogue's uniqueness (ids, names, fingerprints, palettes), aspect coverage,
that every referenced bullet / marker / row / frame / plate / art / face really
exists, the contrast floor, the ring walk, and the DOM behaviour of the gallery.

## Inspector navigation

The right-hand inspector lists **one destination per restylable thing on a
slide**, in board order — a compact icon + label tile for each — and every
panel holds **only the features its tile names**:

| Deck | Header | Question | Options | Slide & insert |
| --- | --- | --- | --- | --- |
| **Design** (slide designs — 128 complete looks) | Title text | Question bullet (bullet point presets · shapes · effects · channels · position) | Option bullet (marker shape/colour/plate) | Footnote |
|  | Title background | Q bullet text | Opt bullet text | Slide background (board colour too) |
|  | Badge 1 · Badge 2 · Badge 3 · Logo | Question text | Option text (choices + rows/layout/gap) | Slide frame |
|  |  |  | **Answer key** | **Layout** (element positions) |
|  |  |  |  | Uploads · Insert shapes · **Layers** |

The ownership rule that keeps it predictable: the **deck-wide look** (the slide
designs — badges, title and its plate, bullet, stem, options, markers, rows,
board and frame, all in one card) lives under **Design**; **where elements sit**
lives under **Layout**; the
*surface base colour* lives under **Slide background**; *answer actions*
(reveal all, answer copies) live under **Answer key**. No tile borrows another
tile's feature — so the name you click is always what you get.

Two-way selection sync ties the navigation to the canvas:

- **Navigation → slide.** Picking a tile selects the content it edits, so the
  element is outlined with resize/rotate handles (or the surface — background,
  frame — gets its own context toolbar). The deck/board tiles (Design, Layout)
  and the insert tiles release the element outline but keep a selected
  picture/shape editable.
- **Slide → navigation.** Clicking an element on the board (or a row in the
  Layers list) opens the tile that styles it; double-clicking still drops you
  into its text field. The **Layers** tile is the one exception: it lists the
  whole board rather than owning one thing, so it stays open while the selection
  follows your clicks — on the board and in the list alike — and offers an
  *Edit … →* jump to the tile that styles whatever is selected.
- **Navigation → toolbar.** Every tile also opens the related tools in the
  context toolbar above the board. Tiles that own an element or a surface
  already did; the destinations that don't — **Design**, **Layout**,
  **Answer key**, **Uploads**, **Insert shapes** and **Layers** — bring their
  own tools instead of leaving the strip empty (the design stepper — the name of
  the look in use plus ◀ / ▶; an
  element picker plus the snapping switches; answer
  marking/reveal/style/paste-key; quick image insert; quick shape insert; and
  the layer count plus the arrange buttons). `Esc`, changing slides, or picking
  another tile changes what the toolbar shows.

Badges 1 and 2 are the two brand lines ("LEARN WITH" / "FAYSAL SIR") and Badge 3
is the right-hand tag ("DAKHIL-26"). They share one movable box but each line
can be hidden, resized and recoloured independently (`brandTop*` /
`brandBottom*` in `ThemeSettings`).

The split panels keep one concern each: a bullet's *shape* (silhouette, fill,
outline, corners, transparency, position) is separate from the *text inside it*
(wording, ink, face, weight, case, size), for both the question bullet and the
option markers; the option *markers* are separate from the option *rows*
(container style, column layout and gap live with the choices under Option
text). Pictures moved out of the shapes panel into their own "Uploads"
destination, and the fixed elements' positions moved out into their own
"Layout" destination.

### Merged contents show every related toolbar

Some destinations style parts that are painted as **one merged thing** on the
board. Selecting any of them — or clicking the merged block on the slide, or
picking its row in the **Layers** list — stacks a preview of every related
part's tools in the context toolbar, one line each, in board-reading order:

| Merged block | Lines, top to bottom |
| --- | --- |
| **Question** (bullet riding along) | Question text · Question bullet · Q bullet text |
| **Title** | Title text · Title background |
| **Badges** | Badge 1 · Badge 2 |
| **Options** | Option text · Option bullet · Bullet text |

The line you are editing is highlighted (`ctx-pill-active`) — the one that owns
the open destination, or, from the Layers list, the part the selected layer
leads with (the **Title** row opens on *Title text*, the **Number bullet** row
on *Question bullet*, and so on, matching the panel's *Edit … →* jump); the
others are one click away from being styled without leaving the board.
Every line carries the compact slice of its inspector panel — **Question text**
gets font, size, ink, bold/italic/underline and alignment; **Question bullet**
one button per channel — **Fill** · **Border** · border style · radius · weight ·
transparency · position · **Bullet design** · show/hide (the full set, see
*Question bullet* below); **Q bullet text** the number's **Numbering** system —
what the number reads: English · Bangla · Arabic digits and letters, Roman
numerals (right where the option markers keep their own label numbering), ink,
typeface, weight and size;
**Title text** typeface, size, colour, case and
glyph effects; **Title background** the banner silhouette, colour, gradient,
opacity, halo, padding and on/off; each **badge line** its own typeface, colour
(with *auto* back to the shared brand colour), size and visibility; the
**options trio** keeps marker shape / row style / numbering / fonts as before.

The plate itself is a **chip behind the heading**, not a header bar: its width
is fixed at `630 px` across, horizontally, of the 1280 × 720 stage
(`BANNER_WIDTH` in `src/lib/types.ts`) and stays there whatever the heading says
or which font it wears, always centred on the title, while its height still hugs
the line — `8 %` of the line's box above and below (`BANNER_PAD_Y` in
`src/lib/types.ts`), with a `14 px` corner radius, a glow oval sized to the flat
box and a ribbon whose notched ends are cut `16 px` deep (`RIBBON_NOTCH`,
shallower still on a plate sized by hand).

The `630 px` is the shape's *own* width, not one look among many: nothing that
dresses the plate resizes it. A fresh deck, any of the fifty-one banner design
presets (`bannerPresetPatch` in `src/lib/banner.ts`), any of the 128 slide
designs (`src/lib/slideDesigns.ts`) and the size card's own button all write the
same `630 px` box — a preset dresses the chip, it never hands the width back to
the heading's own room. **Banner size** and **Banner position** still paint any
px box on the board, so a teacher who wants another width can have it with two
sliders (and the size card's button hands the shape back to `630 px` across,
with the height hugging the line again). The plate's *height* padding is the one
room slider left, since the width no longer depends on the heading's box.

Two rules keep the stack honest:

- **A line's controls write through its own part.** Aligning from the Question
  text line moves the stem's box, never the marker's — and a badge line only
  ever touches its own brand line.
- **Un-merge and the extra lines leave.** With *Bullet is a separate movable
  element* on, the number bullet is its own element, so the question block
  shrinks to *Question bullet · Q bullet text* and the stem falls back to the
  ordinary single toolbar.

The deeper pickers (the bullet's design studio and its one-channel cards —
style, radius, weight, transparency, position — plus its Fill and Border colour
cards, banner shapes, marker shapes, row styles, plain numbering, fonts) open
from their line in the same movable pop-up card every other toolbar toggle
uses. A multi-selection or a drawn shape always gets
the plain toolbar, never a merged stack.

**Default on every toolbar.** Each style toolbar — every merged line, the
plain text / shape / image bar, Design, Layout, Answer key, the frame and the
slide background — ends with a **Default** button that restores that bar's
factory look (typeface, size, colour, effects, marker / banner / frame /
background settings) without changing the wording on the slide. Geometry of a
drawn shape and the image it holds stay put; only the look is unwound. One
click is one undo step.

### Title background — the plate behind the heading

The **Title background** line (Navigation ▸ *Title background*, or the title's
own toolbar) is one button per channel, in the order a plate is dressed:
**Design presets** · **Shape** · Effects · Fill · Border · Border radius ·
Border style · Border weight · Transparency · Banner size · Banner position ·
the eye · **Default**. Everything the plate is made of lives in
`src/lib/banner.ts`; the same `bannerCss()` paints the board, the panel
previews, the thumbnails and the export.

| Section | What it does |
| --- | --- |
| **Design presets** — 51 looks in 10 groups | *Classic · Broadcast · Chalk & parchment · Teal current · Campus blue · Merit & highlighter · Seminar shelf*, then the three **shape-style** groups: **Stylish shapes** (hex badge, cut corner card, chevron tag, swallowtail flag, slant plate, sky tab, gold arch), **Multilayer shapes** (paper stack, neon stack, gold double frame, mint offset, amber accent card, long shadow blue) and **Multilayer gradient** (sheen royal, split sunset, gloss emerald, striped steel, stacked gradient, maroon sheen). Every tile is a live thumbnail of the plate it paints, and a click dresses the 630 px chip without resizing it |
| **Shape** — 92 silhouettes in thirteen groups | The **shape library** first: **Basic & Clean** (rounded rectangle, soft rounded rectangle, capsule, pill, oval plate, circle plate, half-rounded rectangle, curved rectangle, soft square, ellipse banner), **Banner Style** (classic, title, ribbon, pointed, double-ended, notched, cut-corner, folded, scroll, badge, tail, flag), **Cut & Corner** (single-cut, double-cut, diagonal-cut, chamfered, octagonal, trapezoid), **Modern** (slanted, diagonal, angled, asymmetric, skewed rectangle, layered, offset, split, floating title plate, geometric title plate, stepped), **Curved & Wave** (wave banner, curved banner, wavy strip, arch, dome, concave, convex, swoosh, curved ribbon, wave plate), **Organic / Decorative** (organic / abstract / wavy / rounded / asymmetric / freeform blob, cloud, liquid, amoeba, brush stroke, paint stroke, highlight blob, organic / abstract title plate), **Decorative / Highlight** (marker stroke, highlight strip, swoosh highlight, splash, burst plate, sunburst plate) and **Premium / Special** (double ribbon, triple layer, 3D title plate, glass title plate, outline banner, ticket banner, seal badge, emblem plate) — then the original paint families: **Plates** (glow, box), **Stylish shapes** (hexagon, chevron, swallowtail, tab), **Multilayer shapes** (double frame, accent block, long shadow), **Multilayer gradient** (sheen, gloss, stripes, stacked) and **Marks** (underline, none). A silhouette that already had a home files under its library group instead (pill, rounded, ribbon, notch, slant, stack, offset line, split, arch), and one the library already carried under another name keeps its tile and lends the new name to its hint: the hexagonal banner is the **Hexagon**, the parallelogram banner the **Slanted Banner**, the skewed banner the **Skewed Rectangle**, the angled-corner banner the **Angled Banner**, the soft organic plate the **Organic Title Plate**, the shadow banner the **Long shadow**, the border frame plate the **Double frame** and the underline shape the **Underline** mark. The outline's own layer wears the same clip-path *and* the same mask, so a border follows the hexagon's tips, the chevron's arrow, the burst's rays and the wave banner's waves |
| Effects · Fill · Border · radius · style · weight · Transparency · size · position | the glow's softness, the outer halo and the presenter-only shimmer; the body's paint (solid or the shared gradient builder — the multilayer-gradient silhouettes stack a second paint over whatever it is); the outline on a layer of its own; the corners (a cut silhouette keeps its straight edges, a masked silhouette keeps its curves — the mask decides, tab and arch round the top only); the two transparencies; and the plate's free px box and nudge on the board — while the height is automatic, the round and freehand silhouettes (circle, oval, blobs, cloud, strokes…) stretch it by their own factor, so a circle plate reads round without a hand-sized box |

Four rules keep the new silhouettes honest:

- **A multilayer plate paints real layers.** `bannerCss()` returns them in
  `layers`, and the board paints each on its own `div` *behind* the body and
  *under* the heading (`data-banner-layer`), so the plate's own paint and its
  outline still win. They fade with the shape's transparency, never with the
  line's, and they are gone the moment a single-body silhouette is picked.
- **Every offset is a percentage of the plate**, so a stack reads as a stack at
  630 px on the board and at thumbnail scale in the gallery alike — no px
  constant to outgrow a plate sized by hand.
- **The smooth silhouettes wear a mask, not a clip.** A wave, a dome, a blob or
  a stroke is one SVG — drawn in a 100 × 40 box with
  `preserveAspectRatio="none"` — carried as a data-URL `mask-image` on the body
  and on the outline's own layer alike, so the curve holds at 630 px on the
  board, in the preview and at thumbnail scale, and the export carries it with
  the plate without a request going out for it.
- **Nothing but the halo blurs.** The outer halo is the plate's only filtered
  layer, which keeps the layers readable (and testable) apart from it. The two
  feathered highlights (the highlight blob and the swoosh highlight) carry
  their blur *inside* the mask's own SVG, so they stay a mask, not a filter.
- **A cut never outgrows the plate.** A bevel that reaches down a side is
  written `min(…px, …%)`, so a plate sized short by hand bevels into a clean
  octagon instead of folding over itself; and a hollow plate (the outline
  banner) paints no body at all — its fill is an inset ring that follows the
  plate's own corners.

### Every text part has the full text toolkit

Badge 1, Badge 2, Badge 3, the title, the question, the number inside the
question bullet, the option text, the letter inside the option markers, the
footnote and any custom text box each get the same complete set of text
controls — in their inspector destination **and** on their toolbar line:

| Control | Where it lands |
| --- | --- |
| **Font** — the curated library plus **all 1,908 Google Fonts** (searchable, paged, hover to preview; a family is loaded with the weights it really ships). The control always **names the face the board really paints**, drawn in that face: a part with no font of its own reads the deck face it inherits (e.g. *Kalpurush · deck default*) rather than a bare "Default", the open list highlights it, and *Back to deck default* clears an override. On the toolbar the font button itself reads the current face (*Kalpurush ▾*, *Oswald ▾*) instead of the part's name ("Question text font"); which part it edits stays in its tooltip and in the title of the pop-up it opens | `boxFonts[part].family` |
| **Font size, 0 → ∞** — the number field has no upper clamp (the slider covers the practical range) | the part's deck size (`titleSize`, `badgeSize`, `brandTopSize`…) or its `%` scale |
| **Font colour** (with *auto* back to the shared / design colour) | the part's own ink field (`brandTopColor`, `optionBulletInk`…) |
| **Bold · Italic · Underline · Strikethrough**, **weight** | `weight`, `italic`, `underline`, `strikethrough` |
| **UPPERCASE / lowercase / Normal** | `textTransform` |
| **Alignment** (left / centre / right / justify) | `align` (a part that *is* its board element also aligns its box) |
| **Letter spacing · Line spacing** — the toolbar's `−` / `+` walk the whole range in both directions, a `.05` line-spacing step included | `letterSpacing`, `lineHeight` |
| **Opacity 0 – 100** — **100 = fully visible**, **0 = invisible**, and every step in between; an untouched part reads 100 | `opacity` |
| **Text effects** — Canva-style *Shadow · Lift · Hollow · Splice · Outline · Echo · Glitch · Neon · Background*, each with its own offset / direction / blur / thickness / intensity / colour settings (`lib/textEffects.ts`) | `effect` |
| **Position** — an X / Y nudge of the glyphs inside their box (the element's own box position stays under *Layout* / the Position pop-up) | `offsetX`, `offsetY` |
| **Background shape** — the plate painted behind the part (see below) | `bgShape` |

**One meaning for a visibility number.** Every control that fades something —
a text part's opacity, a drawn shape's *Item opacity* and its text's opacity, the
background picture, the design overlay, the badge plate, the banner, the
footnote, and the shadow / background effects — reads and writes the same
number: **100 = fully visible, 0 = invisible**, and every one of them reaches
both ends. The stored field is still a 0–1 alpha, so what the board paints, the
thumbnails and the PNG / PDF export never move; only the number on the control
says what it means.

**The `−` / `+` steppers walk the range.** Each click moves the value by the
control's own step (a `.05` line-spacing step lands on `1.45`, not `1.5`), both
buttons always move, and a **font size is unbounded** — `0` at the bottom, with
no ceiling above it, on the toolbar line and in the panel's own number field
alike. Style controls that used to stop short of the end (banner `10 %`,
footnote `5 %`, plates and pictures `5 %`) now reach `0` as well.

The rule that makes those controls trustworthy: **each one styles the text node
of exactly that part, never the merged block it is painted inside.** Badge 1 and
Badge 2 are two typefaces (`boxFonts.brandTop` / `.brandBottom`) layered over
the shared brand face; the number inside the question bullet is its own node in
the painted shape, so fading, stroking or nudging it never touches the bullet's
silhouette; the option-marker letter is its own node in the marker; the badge
glyphs sit on their own node inside the plate; the title's nudge leaves the
banner where it is. Every surface reads back the typeface the board really
paints with (`textPartTypeface`) and writes through one path
(`patchTextPart`), so a panel and its toolbar line can never shadow each other
— the marker letter's family / weight / size / UPPERCASE keep living in the flat
`optionBullet*` fields the markers always read, and a colour always goes to the
element's ink field.

Custom text boxes (Insert shapes ▸ Text) carry the same toolkit through their
*Shape design ▸ Text* tab and the plain text toolbar (`textEffect`,
`textOffsetX/Y` on `ShapeItem`).

### Background shape — a plate behind any text part

Every text toolbar — Title text, Badge 1 / 2, Question text, Q bullet text,
Option text, Bullet text (the marker letter), the footnote's and a custom text
box's plain text bar — carries a **Background shape** button (the boxed *A*)
**right before its Default**. Its icon fills in while the part has a plate on,
and its tooltip names the preset or silhouette in use. Clicking it opens the
usual movable pop-up card, laid out top to bottom in the order a designer
reaches for things:

| Section | What it does |
| --- | --- |
| **Live preview** | the current plate under sample glyphs, drawn by the same renderer as the board |
| **Shape presets** — 48 ready-made looks in five groups | **Bangladesh edu** (ACS Future School's electric-violet pill and white *SSC'27* capsule, the slanted white course plate, Udvash's steel-blue card and maroon ribbon, 10 Minute School's crimson chevron / sky tab / green slab, a bottle-green & flag-red plate, the navy-and-gold board-exam card, chalkboard, coaching orange slant, an option pill and an *Answer green* capsule), **Canva classics** (highlighter, sticky note, glass card, neon frame, gold plate, sunset pill, ocean card, dark & gold, dashed outline, speech bubble, blueprint, spotlight card), **Bold & broadcast** (pop art, material flat, red ribbon, arrow banner, TV lower third, hex tech, diamond, breadcrumb, fade bar, flag tag), **Soft & minimal** (silver emboss, paper stack, soft blob, leaf card, whisper, glossy pill) and **Marks & stickers** (red underline, quote bar, sticker, ring tag, offset sketch, dotted note). A tile is a live thumbnail of the plate it paints; the group last browsed stays open |
| **Shape** — 30 silhouettes | box family (box, rounded, pill, ellipse, two leaves, four tabs, two speech bubbles), polygon family (slants, cuts, trapezoid, chevron, arrows, ribbon, flags, hexagon, octagon, diamond, cut corners) and marks (highlighter, underline, side bar). Pointed shapes bring the extra room their tips need |
| **Shape colour** | a colour well, *None* (border / marks / effects only), the edu-brand swatches, and an optional **gradient fill** (linear / radial / mesh, the shared gradient editor) |
| **Border colour · Border style · Border radius · Border weight** | *None / Solid / Dashed / Dotted / Double*, radius 0–60 (box and mark silhouettes; polygons keep straight corners), weight 0–12. Box shapes take a CSS border; a polygon's border is an SVG stroke that follows the silhouette, dashes included |
| **Transparency** | 0–100, **100 = fully visible** — fades the plate only, never the glyphs |
| **Effects** — 31 | shadow, pop, lift, float, long shadow, glow, halo, neon, inner shadow, inner glow, bevel, emboss, gloss, sheen, spotlight, stripes, dots, grid, checker, glass (backdrop blur), blur, fade →, fade edges, ring, offset outline, sticker, stack, top / bottom / left bar, corner fold — each with an **intensity** and, where it has one, its own **colour** (*Auto* follows the plate) |
| **Position** | room left/right and top/bottom around the glyphs, a horizontal / vertical shift, skew and rotation of the plate, **Plate per** *Whole text* / *Each line* (a multi-line question gets one plate per line, each hugging its own line) and **Width** *Hug text* / *Fill box* |

A plate is painted on its own layer under the glyphs (`components/TextBgShape`
wraps the part; `lib/textBgShape.ts` turns the settings into CSS, the same
numbers for the board, the thumbnails and the export). While the shape is
off the part's DOM does not change at all. Like every other text control it
styles exactly that part: Badge 1's plate never wraps Badge 2, the marker
letter's plate sits inside the marker, and a line's **Default** clears its plate
with the rest of its look. The settings live in `boxFonts[part].bgShape`
(`TextBgShape` in `lib/types.ts`) and in `textBgShape` on a custom text box.

### Question bullet — fill · border · style · radius · weight · transparency · position · design

The marker a question wears is a **numbering design** plus the teacher's own
channels, and both live on the toolbar line *Question bullet* as well as in the
inspector destination of the same name. The line reads, left to right, one
button per channel and each opening a card that holds **that channel only**:

**Fill** · **Border** · *border style* · *border radius* · *border weight* ·
*transparency* · **Bullet position** · **Bullet design** · **show / hide** ·
**Default**.

| Control | What it drives | Field |
| --- | --- | --- |
| **Fill** — named in words, with the colour-picker icon | the silhouette's body: **Auto** (the design's own) · **None** · a solid · **a gradient** | `bulletFill` · `bulletFillGradient` |
| **Border** — the same card | its outline: **Auto** · **None** · a solid · **a gradient** | `bulletBorder` · `bulletBorderGradient` |
| **Border style** — six line styles as pictures | *Auto · None · Solid · Dashed · Dotted · Double* | `bulletBorderStyle` |
| **Border radius** — a live corner and one slider | the corners of the box family; the ceiling **follows the marker** (half its size is a perfect circle, and the slider keeps going), so there is no fixed px cap. **auto** hands the corners back to the design | `bulletRadius` |
| **Border weight** — three rules and one slider | the outline's thickness, 0 = no line; **auto** back to the design's own | `bulletBorderWeight` |
| **Transparency** — one slider | the marker's **body** — **100 = fully visible**, and the number never fades | `bulletOpacity` |
| **Position** | a horizontal / vertical nudge of the whole marker (the number travels with its shape), and **Bullet is a separate movable element** for free placement — X / Y / width / height / rotation open right there | `bulletNudgeX` · `bulletNudgeY` · `bulletSeparate` |
| **Bullet design** | the marker's studio: *Bullet point presets* · *Shape* · *Shape effects* (below), plus its **size** and **base colour** | `numberStyle` · `bulletSize` · `accent` · `bulletStylePreset` · `bulletEffect` … |

**Fill** and **Border** are the only buttons on the line that spell their name
out, because a shape's paint has four states to show — *auto*, *none*, a solid
and a gradient — and a bare colour dot cannot carry them. Each opens the same
card the text colour opens (Solid · Gradient tabs, the document colours, the
Canva swatch grids, the wheel and the custom gradient builder: linear · radial ·
mesh with up to eight stops), with **Auto** and **None** above it.

#### Bullet design — the marker's studio

One card, three tabs, every tile a live preview painted by the same renderer as
the board:

- **Bullet point presets** — the ready-made looks, 258 of them in seventeen
  groups, with the marker's **size** (20 – 160 px) and **base colour** every
  design derives from. The list opens with the families a bullet row is
  expected to hold: **Bullet points** (Dot · Hollow dot · Small square · Hollow
  square · Small diamond · Small triangle · Dash · Arrowhead · Chevron · Check
  mark · Small star · Arrow right · Arrow left · Arrow up · Arrow down · Arrow
  both ways · Arrow up and down · Arrow northeast · Arrow southeast · Bent arrow
  · Outline arrow) — the classic list bullets, drawn small in the middle of a
  full-size box so they sit on the question's first line where a disc would,
  and standing in for the number the way a bullet does — **Numbering** (1. ·
  1) · (1) · 1: · 01 · Q1 · #1 · 1 |), which keep the number and add its
  punctuation with no shape at all (the leading zero of *01* comes in the
  number's own script, so ৭ becomes ০৭), and **Number + arrow** — the
  direction family the stock libraries sell for step / process / option
  lists, grown into 32 original presets: the number on its own plate with an
  arrow tail (Disc + arrow · Hollow disc arrow · Two-tone arrow · Disc + wedge
  · Disc + line arrow · Gloss disc arrow · Striped disc arrow · Capsule +
  arrow · Card + arrow · Hollow card arrow · Cut card + arrow · Hex + arrow ·
  Hollow hex arrow · Diamond + arrow · Shield + arrow · Squircle + arrow),
  the number inside the arrow body itself (Flat arrow → · Chevron → · Step
  chip · Ribbon arrow · Flag arrow · Twin arrow ↔ · Arrow up ↑ · Arrow down ↓
  · Line arrow → · Diagonal ↗ · Arrow back ← · Notched arrow · Double line →),
  and the text arrows (1 → · 1 ⇒ · 1 ▸). The plate + tail compounds are each
  cut as ONE silhouette — plate arc and tail outline merged — so fill,
  outline, corners and shape effects follow the whole marker as one shape.
  Then the 135 **one-click designs** that write the whole marker at once
  (silhouette · fill · line · corners · transparency · effect), in fourteen
  families. The shape-led ones come first:
  *Geometric* (Hex tile · Octagon stop · Diamond stud · Pentagon badge ·
  Triangle flag · Violet kite · Plinth · Arrow step · Slant stripe · Plus block
  · Speech bubble · Bookmark) and *Organic* (Soft cloud · Aqua drop · Coral blob
  · Mint sparkle · Rose heart · Sky bubble · Wavy sun), followed by *Arrow
  directions* — numbered forward, back, up, down, two-way, vertical, notched,
  play, chevron, outline, bent, diagonal, stacked, ribbon and midnight arrows.
  The remaining families are *Exam classic*, *Soft & minimal*, *Bold sticker*,
  *Neon & glow*, *Medal & seal*, *Dark & gold*, *3-D & depth*, *Hand drawn*,
  *Infographic* and *Number + arrow* — the numbered disc / hexagon / capsule
  with its own tail, and the flat, chevron, step, ribbon, flag and two-way
  numbered arrows, each in the colour system that family ships with (crimson
  with a white rim, teal and emerald, gold, navy, rose, midnight and gold…),
  and the closing *Triangle flags* (Crimson flag ▶ · Tangerine peak ▲ · Amber
  gloss ▶ · Lime drop ▼ · Teal right angle · Sky outline ▶ · Indigo neon ◀ ·
  Violet sticker ▲ · Rose pennant · Emerald gem · Mini crimson ▶ · Mini lime ▲
  · Mini sky ▼ · Mini indigo ◀ · Pole flag · Fuchsia point) — the colourful
  numbered triangle family, sixteen looks over sixteen different triangle
  silhouettes: the play triangle and its rounded twin, the peak and the drop,
  the right angle, the open outline triangle, the swallow-tailed pennant, the
  gem, the four small no-number triangles, the flag on its pole and the
  six-sided point, each in one hue of that rainbow and in the treatment it is
  usually seen in — flat with a hard shadow, gradient with a pale rim, glossy,
  bevelled, outlined, neon, sticker or material. A design stays claimed only while every channel still matches
  it — fine-tune one, or swap the silhouette under *Shape*, and the card
  reports **custom** instead (`lib/bulletStyles.ts`).
- **Shape** — the silhouette alone: 143 shapes in nine families, and picking
  one changes nothing but the silhouette, so the fill, line, corners,
  transparency and effect the marker already has travel onto it (a *Gold seal*
  becomes a gold hexagon with the same bevel). **Round & soft** (Circle · Ring ·
  Coin · Squircle · Arch · Blob · Gradient · Glow · Flat disc · Double ring ·
  Dotted ring · Bullseye · Wavy rim · Teardrop · Leaf · Cloud · Oval · Egg ·
  Dome · Lens · Soft triangle · Soft diamond · Soft hexagon), **Cards & chips**
  (Square · Rounded · Pill · Cut corner · Ticket · Bookmark · Tab · Notched ·
  Tag · Coupon · Stamp · Tape · Plaque · Frame · Chamfer · Folder · Tag ◀ ·
  Label · Slot), **Polygons** (Diamond · Hexagon · Hexagon ▲ · Kite · Shield ·
  Slant · Step · Ribbon · Banner · Triangle · Triangle ▼ · Trapezoid · Pentagon
  · Octagon · Plus · Hourglass · Right triangle · Heptagon · Nonagon · Decagon ·
  Dodecagon · Rhombus · Slant ◣ · Trapezoid ▼ · Step ◀ · House · Gem · Hexagon
  ▬), **Arrows** (Arrow ▶ · Arrow ◀ · Arrow ▲ · Arrow ▼ · Block arrow ▶ · Block
  arrow ◀ · Arrow ◀▶ · Arrow ▲▼ · Notched arrow · Triangle ▶ · Triangle ◀ ·
  Diagonal ↗ · Diagonal ↘ · Bent arrow · Thin arrow →),
  **Seals & stars** (Star · Sparkle · Burst · Scallop · Gear · Rosette · Cap
  seal · Star 6 · Star 8 · Sunburst · Medal · Star 4 · Star 7 · Star 10 · Star
  16 · Explosion · Flower · Soft star), **Callouts** (Speech · Bubble · Callout
  ▼ · Callout ▲ · Callout ▶ · Callout ◀ · Rounded callout), **Flowchart**
  (Document · Delay · Display · Manual input · Off-page · Cylinder · Subroutine
  · Loop limit), **Stickers & icons** (Bulb · Book · Grad cap · Trophy · Bolt ·
  Flame · Rocket · Crown · Heart · Pin · Bell · Padlock · Flask · Trefoil ·
  Clover) and **Marks** (Bracket · Underline · Bar · Slashed · Brackets · Parens
  · Three dots · Corner tick · None). They are the shape families a slide or
  diagram tool's shape library is browsed by — basic shapes, block arrows,
  stars and banners, callouts, flowchart symbols — plus the marker shapes a
  quiz, a workbook or an exam paper wears the world over, drawn from generic
  shape families rather than copied from any one product. Wide shapes get a
  box wider than it is tall; a directional shape (a block arrow, a callout, a
  flask) pads the number into its body; the *Marks* that are a rule rather
  than a shape, and *None*, drop the number.
- **Shape effects** — 36 effects plus *None*, the set an object can wear in a
  slide or design tool, in six groups (`lib/bulletEffects.ts`, painted by the
  shared engine in `lib/shapeEffects.ts`): **Shadow** (Shadow · Lift · Float ·
  Pop · Long shadow · Perspective · Inner shadow), **Glow & light** (Glow · Halo
  · Neon · Inner glow · Spotlight · Gloss · Sheen), **3-D & depth** (Bevel ·
  Emboss · 3-D rotation · Material · Reflection), **Texture & fill** (Stripes ·
  Dots · Grid · Checker · Glass), **Edge & fade** (Soft edges · Blur · Fade → ·
  Fade edges) and **Sticker & outline** (Sticker · Ring · Offset outline · Stack
  · Top bar · Bottom bar · Left bar · Corner fold). Each carries an **intensity**
  dial and, where it has a colour of its own, a colour well with an **Auto**
  fallback that follows the marker's face.

Four conventions keep the controls predictable:

- **Every colour channel is tri-state**, exactly like the option marker's:
  **Auto** (empty) paints the design's own value, **None** paints nothing there,
  and a picked colour — or gradient — replaces it.
- **The outline follows the silhouette.** Box-family designs take a real CSS
  border, so *Double* and *Dotted* render as the card shows; a cut silhouette
  (clip-path) cannot hold a CSS border, so its outline is stroked as an SVG
  polygon over the same points — *Double* becomes two polygons — and the radius
  card reports that polygons keep their straight corners. A **gradient** border
  rides the background-clip trick on a box and becomes an SVG paint server on a
  cut silhouette, so the dashes follow the points either way.
- **Transparency and effects paint the body only.** The fill, the outline, the
  corners, the effect's own passes (shadow, glow, texture, a stack behind, a
  reflection below) sit on a layer of their own inside an isolated marker box
  (`components/NumberBullet`), so the digits keep their own ink, face, opacity
  and effects (*Q bullet text*).
- **One card, one channel.** The toolbar's Border style / radius / weight /
  transparency cards hold nothing but their own control; the complete set —
  design card, every channel and the position card — is stacked in the
  inspector's *Question bullet* destination.

Because the canvas, the thumbnails, the inspector preview and the PNG / PDF
export all read the same `renderNumberStyle` (`lib/numberStyles.ts`), a look set
here is what every view paints. The **Default** button on the line unwinds all
of it — design, size, both paints and their gradients, style, radius, weight,
transparency, shape effect, preset and nudge, re-attaching the marker — in one
click, one undo step.

**What the number reads — the Numbering system (`questionNumbering`).** The
**Numbering** control on the *Q bullet text* line is not a style gallery — the
marker's looks live in the Design card above. It picks the numeral system every
question's number is drawn in: **Number** (1 2 3), **Bangla Number** (১ ২ ৩),
**Bangla Letter** (ক খ গ), **English Capital Letter** (A B C), **English Small
Letter** (a b c), **Roman Capital** (I II III), **Roman Small** (i ii iii),
**Arabic Number** (١ ٢ ٣) and **Arabic Letter** (أ ب ج), plus **Default**,
which keeps each slide's own number exactly as stored (a Bangla "১" stays "১",
a custom wording stays itself). A slide's stored digits are read in any script
— "৭" and "7" both count as seven — and the chosen system re-letters them on
the board, in the thumbnails and in the PNG / PDF export, while the marker's
design, paint and effects stay untouched. The conversions are the option
markers' own (`lib/plainNumbering.ts` · `questionNumberLabel`), so questions
and options can letter in the same script with one behaviour.

## Layers

The **Layers** destination (the ⧉ tile after *Insert shapes*) is one Canva-style
list for everything painted on the slide — logo, brand lines, title, badge,
question, options, footnote **and** every drawn shape, text box and image —
because they all share a single stacking order (`lib/layers.ts`):

- **Top first, with a preview.** Row 0 is the front-most layer. Every row draws
  a real mini preview of its own content: shapes render their kind, fill,
  gradient, stroke and corner radius, images render the image itself, text
  renders a `T` chip, and the built-in elements render the block they paint.
- **Drag to any slot.** Press a row and drag: the rows it passes slide out of
  the way to open the landing gap, a chip follows the cursor, and releasing
  drops the layer **anywhere** in the stack — not one step at a time. The list
  auto-scrolls while you hold a row near either edge, and the whole reorder is a
  single undo step. Ctrl/⌘-click picks several rows and they travel together as
  one contiguous block.
- **Per-row controls.** Hovering a row reveals the full Canva set: ▲ **Bring
  Forward**, ▼ **Send Backward**, 👁 **Hide/Show**, 🔒 **Lock/Unlock**, ⧉
  **Duplicate** and 🗑 **Delete**. The toolbar above the list repeats them for
  the current selection and adds ⏫ **Bring to Front** / ⏬ **Send to Back**,
  plus a collapsible *Align & distribute* section.
- **Hide vs. not on this slide.** 👁 hides a layer you own: it stops painting but
  keeps its slot, stays selectable and stays draggable, and one click brings it
  back. Built-ins this slide simply does not paint (no logo, empty footnote,
  merged bullet) are parked above the stack, frozen and marked *(not on slide)*
  — there is nothing to reorder, hide or delete. Deleting a built-in hides it
  instead, since a slide always owns its elements.
- **Locked layers.** A locked layer cannot be dragged, resized or rotated on the
  board — it draws a dashed amber outline and no handles — but it still selects,
  so you can always unlock it from the row or the toolbar.
- **Click to select, both ways.** A row selects that shape / text / element on
  the slide with its outline, handles and its own tools; clicking the board
  scrolls the matching row into view and highlights it. Order changes repaint
  the canvas immediately. The destination stays on **Layers** while you do it —
  the toolbar above the slide follows the selection instead, previewing every
  merged part of the row you picked (*Title* → *Title text* + *Title
  background*) and keeping the Bring / Send steps in an **Arrange** line beside
  them.
- **Keyboard.** The list is a `listbox` with roving focus: ↑/↓ walk the rows,
  `Home`/`End` jump to the ends, `Enter`/`Space` select, **Alt+↑ / Alt+↓** step a
  layer forward / backward, `F2` renames, `Delete` removes. Double-clicking a
  row's name renames it too. On the board, `Tab` / `Shift+Tab` still walk the
  painted layers — a hidden layer is skipped.
- **Badges.** `ALL` marks a deck-wide item that paints on every slide, ⧉ marks a
  group member (clicking it selects that member alone).

The same list is embedded in the *Insert shapes* destination under **Layer
order**, so reordering is never more than one click away while styling a shape,
and the panel scrolls inside its own pane so it stays usable on a short window.

## Answer key

The **Answer key** destination (the ✓ tile between *Option text* and *Footnote*)
is the one place for the correct answers. Opening it outlines the options block
on the board and puts the answer tools in the toolbar above it:

- **On the board.** 👁 reveal/hide this slide, a *Correct answer* picker, an
  **Answer** menu (answer style, deck-wide reveal/hide, answer copies, clear all,
  paste a key).
- **In the panel.** Mark the correct choice per slide (click the option row
  again to clear it), reveal toggle, *Paste answers…* — the same dialog as the
  top bar, which matches a key in any format to your questions by number —
  reveal all / hide all, *answer copy after every slide* (question slide + its
  revealed twin, for quiz videos), clear every answer, the glow / tick / fill
  answer style, and the deck's key at a glance with **jump to slide**, *copy key*
  and *save .txt*. The exported text round-trips: it can be pasted straight back
  into *Paste answers*.

## Toolbar pop-ups: docked right, movable, always closable

The card a toolbar toggle opens (Font, Spacing, Frame, Answer …) docks to the
**right edge of the window, hanging from just under the top bar**, and stretches
downward only as far as its content needs — all the way to the bottom of the
window when the content is that long, never past it. The card is still dragged
by its header when you want it elsewhere:

- it starts docked (the right-side look) and only switches to free positioning
  once a real drag begins — a press that stays inside the 4px threshold is
  still a plain click on the header;
- the ⠿ grip in the header advertises the drag, and the whole card stays
  reachable: the clamp keeps its header and a slice of the body on screen,
  including after a window resize;
- the ⌖ button (or a double-click on the header) re-docks it under the top
  bar on the right, and the ✕ button still just closes it;
- **the panel's name and the ✕ never scroll away** — they live in a head that
  sits above the scrolling body, so a long panel (fonts, numbering, answer
  key …) scrolls underneath its pinned title and close mark;
- **the card opens to the bottom of the window before anything scrolls** — a
  gallery or list inside a pop-up does not cap itself at a few hundred pixels
  while the card still has room to spare. The font list, the marker gallery,
  the shape-style and shape-effect grids, the frame presets and the gradient
  library all grow with the card, so the pop-up reaches down the window first
  and its body only scrolls once the content really is taller than the space
  under the top bar. The same control living in the inspector keeps its own
  cap, because a rail is not a pop-up.

The two other floating cards follow the same rule: the **slide selector** list
and the **History** card are measured against the room left below them
(`src/lib/useRoomBelow.ts`) instead of a fixed `max-h-*`.

Like every other gesture in the editor, the drag runs through
`src/lib/dragSession.ts`, so a missed pointer-up can never leave the card
following the cursor.

## The colour picker keeps up with the pointer

Every gradient in the editor — slide background, title banner, shape fill,
gradient text — is set with the same picker
(`ColorWheel` in `src/components/GradientWheel.tsx`),
laid out and behaved like Canva's: a full-width saturation / lightness area
with a ring indicator, a hue ramp under it, an eyedropper where the browser
has one, and live swatch / hex / H·S·L readouts. The gradient editor's angle
dial and its colour-stop bar run on the same system. The indicators belong to
the pointer, and nothing about the size of the editor behind them may change
that:

- **React is not in the path at all while a gesture is live.** The ring, the
  hue knob and the dial knob are placed with a compositor-friendly
  `transform: translate3d` written straight into the DOM in the very event
  that moved them, and so are the readouts (swatch, hex, H/S/L). The drag sets
  no state, so there is never a render — the picker's or the deck's — standing
  between the cursor and the indicator. State is taken up again the moment the
  pointer stops, and every render that happens in between reads the gesture's
  own values, so it can only agree with what was painted or be a no-op; it can
  never stamp a stale pixel over a live one.
- **The indicator rides the pointer, not the colour.** `s`/`l`/`h` are whole
  per cent, because that is what the deck stores — but a ring placed at
  `round(s) %` of the area stands ~1.3 px away from a 260 px cursor and
  refuses to move for several events at a time, and that stepping is exactly
  what a laggy picker looks like. The transform comes from the raw
  `clientX`/`clientY`; only the colour is rounded.
- **Geometry is measured once per press.** The picker caches its box on
  pointer-down, so no move ever forces layout.
- **The one expensive paint waits for its frame.** The area's two stacked
  gradients are re-rasterised whenever the hue moves, so that write is
  coalesced to once per frame instead of once per event; the 16 px indicators,
  which must be instant, are written every event. A write of a value the
  element already has is skipped entirely.
- **Chromium moves the ring faster than a frame.** While a gesture is live the
  picker also listens to `pointerrawupdate` — the un-coalesced pointer stream —
  so the indicator tracks the mouse at the mouse's own rate. Where that event
  does not exist, `pointermove` paints the same pixels.
- **The deck is told once per frame** (`useFrameSend` in
  `src/lib/frameSend.ts`). Moves are collected and the newest colour is handed
  to the editor on the next animation frame, so a sweep is a handful of
  undoable writes instead of one per `pointermove` — and the slide below still
  previews live. When a frame is already late, the channel hands the *next*
  one back to the pointer and writes on the frame after it (never two skips in
  a row): a heavy deck then costs the preview ~30 Hz instead of costing the
  cursor its frames.
- **The press and the release always settle.** A press commits its colour
  immediately (a click never waits for a frame; a stop-knob press only grabs —
  it never jumps), and the end of the gesture flushes whatever is still
  pending, so the colour the indicator shows is the colour that is committed.
- **Nothing paints without a gesture.** Every surface runs on
  `src/lib/dragSession.ts` like every other gesture in the editor: moves are
  window-wide, so a picker keeps tracking when the pointer leaves it; a
  secondary-button press is not a pick; and a release, cancel or blur ends it,
  so a later hover cannot paint.
- **An outside colour still moves the picker.** A preset, the hex field or an
  undo repositions the indicators, while an echo of the picker's own colour
  that arrives mid-drag is ignored instead of dragging them back.
- **Reachable without a pointer.** Both surfaces take focus; the arrow keys
  nudge the picked colour (Shift = 10 steps).
- **One marker, not two.** The area carries no crosshair or other cursor
  decoration — just the plain pointer — because the ring under it is the thing
  being aimed at. A second marker on the surface only shows up as lag whenever
  the page is busy.

### The solid (native) colour wells keep up too

Every *solid* one-colour control — the frame colour, the board, the option
markers, a title's ink … — is the browser's own `<input type="color">`
(`ColorInput` in `src/components/ui.tsx`, plus the toolbar's swatches and the
gradient editor's selected-stop chip). For such an input React folds the dialog's
native `input` (one per move of the cursor through its saturation field) **and**
its native `change` (the dialog closing) into a single `onChange`, so the handler
fires on every step. Committing on every step re-renders the whole deck — board
and every rail thumbnail — once per move, and that busy main thread is exactly
what makes the dialog's own indicator trail the cursor.

So the wells route `onChange` through `useColorFrame` (`src/lib/frameSend.ts`):

- **The visible swatch is painted in the event** — the glyph under the well
  follows the dialog the same instant, with no render in between; the dialog's
  indicator itself belongs to the compose, so this side has nothing to lag
  behind.
- **The deck is told once per frame, newest value first.** A sweep collapses to
  a handful of undoable writes instead of one per step; the colour the user
  settles on is committed on the frame after they let go, and unmounting a well
  settles whatever is still pending exactly once (so no dialled colour is ever
  dropped, and none can fire into nothing).

## Board gestures

Every item on the slide board — shapes that come from the Deck, deck-generated
elements, groups, resize/rotate handles and the rubber-band marquee — is driven
by one pointer state machine, `src/lib/dragSession.ts`. Its guarantees:

- **A move event alone never moves anything.** A gesture exists only after a
  left `pointerdown` on the target; hover / enter / leave / selecting never
  write geometry.
- **A click is a click.** Dragging starts only after the pointer travels past
  `DRAG_THRESHOLD_PX` (4px); press-and-release inside that band only selects.
- **Position is written only while `isDragging === true`** (state also carries
  `isPointerDown`, `dragStartX/Y`, `initialObjectX/Y`).
- **A release always ends the gesture** — `pointerup`, `pointercancel`,
  `pointerleave`, lost pointer capture, window blur and a hidden tab all reset
  the state, so a missed release can never leave an item following the cursor.

`npm run test:drag` covers the sequences above, plus regression cases proving the
old pattern (gesture armed on press + `onPointerMove` on the item) did leak, and
the picker suites pin the gesture down from both sides:
`tests/wheel.test.tsx` the contract (the indicators' tracking, the
one-write-per-frame budget and the press / release settlement across the
picker, the hue ramp, the angle dial and the stop bar),
`tests/latency.test.tsx` the cost (zero layout reads and zero React renders per
sweep, sub-pixel tracking under the cursor, the face repainted once per frame,
backpressure under a slow deck), and `tests/colorframe.test.tsx` the native
colour wells (one deck write per burst of dialog moves, the swatch painted in
the event, no dialled colour settled more than once or dropped on unmount).
