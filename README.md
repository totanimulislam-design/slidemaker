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
`Esc` or a click away closes it.

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

## Inspector navigation

The right-hand inspector lists **one destination per restylable thing on a
slide**, in board order — a compact icon + label tile for each:

| Header | Question | Options | Slide & insert |
| --- | --- | --- | --- |
| Title text | Question bullet | Option bullet | Footnote |
| Title background | Q bullet text | Opt bullet text | Slide background |
| Badge 1 · Badge 2 · Badge 3 · Logo | Question text | Option text | Slide frame |
|  |  | **Answer key** | Uploads · Insert shapes · **Layers** |

Two-way selection sync ties the navigation to the canvas:

- **Navigation → slide.** Picking a tile selects the content it edits, so the
  element is outlined with resize/rotate handles (or the surface — background,
  frame — gets its own context toolbar). The insert tiles release the element
  outline but keep a selected picture/shape editable.
- **Slide → navigation.** Clicking an element on the board (or a row in the
  Layers list) opens the tile that styles it; double-clicking still drops you
  into its text field. The **Layers** tile is the one exception: it lists the
  whole board rather than owning one thing, so it stays open while the selection
  follows your clicks — on the board and in the list alike — and offers an
  *Edit … →* jump to the tile that styles whatever is selected.
- **Navigation → toolbar.** Every tile also opens the related tools in the
  context toolbar above the board. Tiles that own an element or a surface
  already did; the destinations that don't — **Answer key**, **Uploads**,
  **Insert shapes** and **Layers** — bring their own tools instead of leaving the
  strip empty (answer marking/reveal/style/paste-key, quick image insert, quick
  shape insert, and the layer count plus the arrange buttons). `Esc`, changing slides, or picking another tile changes what the
  toolbar shows.

Badges 1 and 2 are the two brand lines ("LEARN WITH" / "FAYSAL SIR") and Badge 3
is the right-hand tag ("DAKHIL-26"). They share one movable box but each line
can be hidden, resized and recoloured independently (`brandTop*` /
`brandBottom*` in `ThemeSettings`).

The split panels keep one concern each: a bullet's *body* (design, size, accent)
is separate from the *text inside it* (wording, ink, face, weight, case, size),
for both the question bullet and the option markers. Pictures moved out of the
shapes panel into their own "Uploads" destination.

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
its design, size, accent colour and show/hide; **Q bullet text** the number's
ink, typeface, weight and size; **Title text** typeface, size, colour, case and
glyph effects; **Title background** the banner silhouette, colour, gradient,
opacity, halo, padding and on/off; each **badge line** its own typeface, colour
(with *auto* back to the shared brand colour), size and visibility; the
**options trio** keeps marker shape / row style / numbering / fonts as before.

Two rules keep the stack honest:

- **A line's controls write through its own part.** Aligning from the Question
  text line moves the stem's box, never the marker's — and a badge line only
  ever touches its own brand line.
- **Un-merge and the extra lines leave.** With *Bullet is a separate movable
  element* on, the number bullet is its own element, so the question block
  shrinks to *Question bullet · Q bullet text* and the stem falls back to the
  ordinary single toolbar.

The deeper pickers (bullet designs, banner shapes, marker shapes, row styles,
plain numbering, fonts) open from their line in the same movable pop-up card
every other toolbar toggle uses. A multi-selection or a drawn shape always gets
the plain toolbar, never a merged stack.

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

## Toolbar pop-ups are movable

The card a toolbar toggle opens (Font, Spacing, Frame, Answer …) is dragged by
its header, so it never has to sit on top of the part of the slide you are
working on:

- it starts centred under the pill (the historical look) and only switches to
  free positioning once a real drag begins — a press that stays inside the 4px
  threshold is still a plain click on the header;
- the ⠿ grip in the header advertises the drag, and the whole card stays
  reachable: the clamp keeps its header and a slice of the body on screen,
  including after a window resize;
- the ⌖ button (or a double-click on the header) re-centres it under the
  toolbar, and the ✕ button still just closes it.

Like every other gesture in the editor, the drag runs through
`src/lib/dragSession.ts`, so a missed pointer-up can never leave the card
following the cursor.

## The colour picker keeps up with the pointer

Every gradient in the editor — slide background, title banner, shape fill — is
set with the same picker (`ColorWheel` in `src/components/GradientWheel.tsx`),
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
picker, the hue ramp, the angle dial and the stop bar) and
`tests/latency.test.tsx` the cost (zero layout reads and zero React renders per
sweep, sub-pixel tracking under the cursor, the face repainted once per frame,
backpressure under a slow deck).
