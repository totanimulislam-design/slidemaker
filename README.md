# slidemaker

MCQ Slide Studio — paste Bengali/English MCQ questions and generate editable, exportable quiz slides.

```bash
npm install
npm run dev        # editor on http://localhost:5173
npm run build      # single-file dist/index.html
npm run test:drag  # pointer / drag + inspector navigation suites (jsdom)
```

## Inspector navigation

The right-hand inspector lists **one destination per restylable thing on a
slide**, in board order — a compact icon + label tile for each:

| Header | Question | Options | Slide & insert |
| --- | --- | --- | --- |
| Title text | Question bullet | Option bullet | Footnote |
| Title background | Q bullet text | Opt bullet text | Slide background |
| Badge 1 · Badge 2 · Badge 3 · Logo | Question text | Option text | Slide frame |
|  |  | **Answer key** | Insert images · Insert shapes |

Two-way selection sync ties the navigation to the canvas:

- **Navigation → slide.** Picking a tile selects the content it edits, so the
  element is outlined with resize/rotate handles (or the surface — background,
  frame — gets its own context toolbar). The insert tiles release the element
  outline but keep a selected picture/shape editable.
- **Slide → navigation.** Clicking an element on the board (or a row in the
  Layers list) opens the tile that styles it; double-clicking still drops you
  into its text field.
- **Navigation → toolbar.** Every tile also opens the related tools in the
  context toolbar above the board. Tiles that own an element or a surface
  already did; the destinations that don't — **Answer key**, **Insert images**
  and **Insert shapes** — now bring their own tools instead of leaving the strip
  empty (answer marking/reveal/style/paste-key, quick image insert, quick shape
  insert). `Esc`, changing slides, or picking another tile changes what the
  toolbar shows.

Badges 1 and 2 are the two brand lines ("LEARN WITH" / "FAYSAL SIR") and Badge 3
is the right-hand tag ("DAKHIL-26"). They share one movable box but each line
can be hidden, resized and recoloured independently (`brandTop*` /
`brandBottom*` in `ThemeSettings`).

The split panels keep one concern each: a bullet's *body* (design, size, accent)
is separate from the *text inside it* (wording, ink, face, weight, case, size),
for both the question bullet and the option markers. Pictures moved out of the
shapes panel into their own "Insert images" destination.

### Merged contents show every related toolbar

Some destinations style parts that are painted as **one merged thing** on the
board. The options row is the prime example: the option text, the option
bullet, and the text inside the bullet are merged into a single options block.
Selecting any of them — or clicking an option on the slide — stacks a preview
of every related part's tools in the context toolbar, one line each, in
board-reading order:

1. **Option text** — font, size, ink, line height, alignment, position
2. **Option bullet** — marker shape, row style, marker/fill/ring colours,
   backplate, layout, row gap
3. **Text inside option bullet** — numbering, marker font, ink, case, weight,
   letter size

The line that owns the open destination is highlighted; the deeper pickers
(marker shapes, row styles, plain numbering, fonts) open from their line in
the same movable pop-up card every other toolbar toggle uses.

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
old pattern (gesture armed on press + `onPointerMove` on the item) did leak.
