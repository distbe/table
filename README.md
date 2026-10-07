# Table

**Convert tables between plain text, Markdown and HTML — live, in one page.**
Deployed at [table.dist.be](https://table.dist.be).

A table printed by a CLI has to be retyped as Markdown to go into a doc, and reworked again
to go into Slack or Notion. This tool puts all three representations side by side and
**updates the other panes as soon as you edit any one of them**. Paste into whichever pane
you have, copy from whichever pane you need.

There is no server: nothing you type leaves the page, and the build drops straight onto
static hosting such as GitHub Pages.

```
┌──────────┬──────────┐
│   Text   │ WYSIWYG  │
├──────────┼──────────┤
│ Markdown │   HTML   │
└──────────┴──────────┘
```

## How it works

The four panes are not independent views with their own parsers — they are four
representations of one model ([`TableData`](src/lib/types.ts): `rows` plus per-column
alignment). An edit is parsed into the model, and the other three panes are redrawn from it.
The pane being edited keeps its raw input, so nothing is reformatted while you type.

**The first row is always the header.** Every format reads more naturally with one (Markdown
requires it), and never guessing makes conversion results predictable.

## Features

### Text (top left)

- Four border styles: `┌─┬┐` · `╭─┬╮` · `╔═╦╗` · `+--+`
- **Full-width character widths** — Hangul, Han, Kana and emoji count as two cells, so columns
  line up. Without this, any table with CJK text is crooked in a monospace font.
- **Max cell width** wraps on word boundaries, falling back to character breaks for long words
- Parsing does not care which border characters are used: Unicode boxes, double lines, `+-|`,
  even a mix of them
- **Cells wrapped over several lines are rejoined**, so a pretty-printed table survives a paste
- Toggle rules between rows; the wand button reformats with the current settings

### Markdown (bottom left)

- GFM table syntax
- Reads and writes the `:---` / `:---:` / `---:` alignment markers
- `|` inside a cell is escaped as `\|`, newlines become `<br>`
- Columns are padded so the output stays readable in an editor

### WYSIWYG (top right)

- contentEditable table editing
- **Drag handles ride the table's own border lines** — an overlay measured from the rendered
  cells, not extra cells in the markup. Bring the pointer near a line and a band lights up along
  the row or column with a grip to grab, the way Confluence does it. Click to select the whole row
  or column; **drag to reorder** — the line you are carrying stays highlighted, a glowing drop line
  shows where it lands, and the cursor reads as a grab everywhere, including over cell text; a **`+` on the boundary**
  inserts right there, middle of the table included, and hovering it lights up the line the new row
  or column will take. <kbd>Alt</kbd>+arrows move the current row or column
- **<kbd>Delete</kbd> empties the selected cells** instead of one character, as in a spreadsheet;
  the selection popover carries the same action next to the alignment buttons
- **Drag across cells to select a block**, or extend the selection with <kbd>Shift</kbd>+click and
  <kbd>Shift</kbd>+arrows. Copying a block writes just that block — TSV as plain text and a real
  `<table>` as rich text — so you can lift a few rows straight into a sheet or a document
- **One popover follows the selection** and carries everything that acts on it: alignment, empty
  the selected cells, and — when a whole row or column is selected from its handle — delete it.
  There is no context menu to hunt for. Operations apply to the whole selection: three selected
  rows delete three rows, and dragging a handle inside the selection moves the whole block
- <kbd>Tab</kbd> next cell, <kbd>Shift+Tab</kbd> previous, <kbd>Enter</kbd>/<kbd>↑</kbd><kbd>↓</kbd>
  up and down. <kbd>Tab</kbd> in the last cell appends a row. <kbd>Esc</kbd> collapses the selection
- Paste a table copied from Excel, Google Sheets or a web page and it lands as the whole table
  (HTML `<table>`, TSV and CSV are recognised)
- `Copy` writes `text/html`, so it pastes into a document, mail client or Notion **as a table**

### HTML (bottom right)

- HTML source split into `<thead>` / `<tbody>`; column alignment is emitted as `text-align`
- Syntax highlighting. A highlight layer sits behind the textarea whose own text is transparent,
  so editing, undo and paste stay native — no editor library
- Editable like every other pane: change the source and the other three follow
- `Copy` copies the source itself (use the WYSIWYG `Copy` to paste a rendered table)

The four panes are the whole interface — no toolbar above them. Work in progress is saved to
localStorage, and the dist.be mark in the bottom right floats over the page without catching
clicks.

## Development

```bash
npm install
npm run dev      # dev server
npm test         # conversion tests (vitest)
npm run build    # dist/
```

## Deployment

GitHub Pages, as a static build, on the custom domain **table.dist.be**.

- `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
  Set Settings → Pages → Source to **GitHub Actions** once.
- `public/CNAME` holds the domain, so the deployed artifact claims it. DNS needs a `CNAME`
  record for `table` pointing at `<owner>.github.io`.
- `base: './'` in `vite.config.ts` keeps the build working under any sub path too.
- `VERSION` is injected from `package.json` and shown next to the logo, so bumping the version
  there is all it takes.

## Layout

```
src/lib/types.ts      shared model (TableData) and normalize
src/lib/width.ts      full-width measurement, padding, wrapping
src/lib/ascii.ts      text table parser / serializer
src/lib/markdown.ts   markdown table parser / serializer
src/lib/html.ts       HTML serializer, HTML/TSV paste parsing
src/lib/ops.ts        table operations on a cell range: insert, delete, move, align, slice
src/lib/highlight.ts  HTML syntax highlighting tokenizer
src/components/tableMetrics.ts  cell geometry for the handles and drop indicator
src/components/       Pane · CodeArea · CopyButton · TableEditor · SelectionPopover · icons
public/               favicons, og image, manifest, CNAME
src/App.tsx           keeps the four panes in sync
```

Everything under `src/lib` is DOM independent; `src/lib/convert.test.ts` covers round trips,
character widths, wrapping and escaping.

## Credits

Icons are Tabler Icons (MIT), inlined into `src/components/icons.tsx` rather than pulled in
as a package. The dist.be logo is shared with the other tools in this org.

## License

MIT
