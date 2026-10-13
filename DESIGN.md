# Clarity — visual contract

One current document. It supersedes the visual guidance scattered through `README.md`,
`src/profile/README.md` and the per-component CSS comments. Scientific, identity and privacy rules
are **not** set here — they live in the engine's contracts and in `/methodology`, and this document
does not change them.

## The concept

A biomedical research instrument. Editorial at the entry point, dense and precise inside, with the
source always one click away and never a page away.

The object the whole product is built around is **a typed finding**: an estimate, the interval
reported with it, the population it was measured in, the layer of evidence it sits on, its
provenance, and the passage it was read from. Every screen is judged on how well it lets someone
see that object, compare it with its siblings, and check it against the source.

Three things this is not: a grading service, a dashboard, or a search engine with a chat box.

## Tokens

`src/design/tokens.css` is the single source. A literal hex in a component is a bug.

**Surfaces** step; they do not glow. `--canvas` → `--surface-1` → `--surface-2` → `--surface-3`,
with three hairlines (`--hairline`, `--hairline-strong`, `--hairline-loud`). No gradient is used as
decoration anywhere.

**Ink**: `--ink` / `--ink-muted` / `--ink-subtle` / `--ink-faint`. All four clear 4.5:1 on every
surface in the ladder — that was checked, not assumed, and it is why `--ink-subtle` and
`--ink-faint` are lighter than they look like they should be.

**Accent** (`--accent`, one teal) is for **interaction and brand only**: links, focus, the selected
state, the primary button, the brand mark. It never encodes a scientific quantity. The product used
to carry four near-identical teals across four stylesheets; there is one now.

**Scientific status** has its own hues and never borrows the accent:
`--indexed` (something is held here), `--caution` (unreported, unclear, cited, wide),
`--refused` (withheld, dead-lettered). Each always appears with a word as well as a colour.

**Layer colours** (mechanism violet, preclinical amber, observational blue, interventional teal,
guidelines grey) are a separate, pre-existing encoding and are left alone.

## Type

Three faces, three jobs — the distinction is structural, not decorative:

| Face | Carries |
|---|---|
| IBM Plex Sans | Clarity's own voice: interface, headings, explanation |
| IBM Plex Serif | **what a source said** — quoted passages, nothing else |
| IBM Plex Mono | identifiers and figures: accessions, PMIDs, estimates, intervals |

So a reader can tell, before reading a word, whether they are looking at Clarity's sentence or the
paper's. `--text-display` … `--text-micro` is the scale; stay on it. Digits that line up in columns
get `font-variant-numeric: tabular-nums` (`.c-num`, `.c-mono`).

`.c-num` is for a figure that must not break. A composed value sentence
(`HR 0.72 (95% CI 0.62 to 0.83)`) uses `.c-mono`, which wraps.

## Density

Three densities, by task, not by taste:

- **Orientation** (home, library header, learn): spacious, long measure, ~68ch.
- **Work** (findings ledger, library rows, comparison, workspace tables): comfortably dense,
  aligned columns, 13–14px text. Whitespace is not created by hiding a column.
- **Reading** (source passages, methodology, learn prose): serif, 1.7 line-height, ≤72ch.

Small text is never used to manufacture sophistication. The smallest readable size in the product
is `--text-micro` (12px) and it is only used for labels, never for findings.

## Navigation and shell

One `Shell` (`src/design/Shell.jsx`): brand, command search, sections, language. No page brings its
own header, domain bar or bottom dock. Interior pages get breadcrumbs, not a second nav.

Search is in the header on every page, reachable with `/` or `⌘K`, and those shortcuts stand down
while the caret is in a field. Results are ranked so an exact name beats an alias beats a substring,
and a profile with findings outranks an empty one in the same tier.

Direct links, `?q=`/`?type=` filters, anchors, Back/Forward and modified clicks all keep working;
filters are written to the URL so a filtered library can be shared.

## Surfaces

**Border, fill, radius and shadow each say "separate object"** and are spent by role. A card is used
where a record is a destination (entity cards, the home example). A row is used where records are
compared (the library, the ledger). Nothing is wrapped in a container merely to look finished, and
no page opens on a gradient hero card.

A **gap is drawn, not hidden**: `.c-gap` and the hatched rung cells say *deliberately empty*. "Not
indexed" is a shape on the page, never an absence.

## The findings ledger

The signature surface (`src/evidence/FindingLedger.jsx`, `findingScale.js`).

Findings are grouped by **measure family** — ratio, difference, discrimination, proportion,
correlation — and each family gets its own axis. **Nothing is ever plotted on an axis it does not
belong to**; a hazard ratio and a mean difference do not share a scale, and a measure with no
defined scale (a cut-off, a median, a bare p-value) gets its number and no mark at all.

- Ratios sit on a log axis, so a halving and a doubling are the same distance from no effect.
- The null line is drawn only where a null exists. A proportion has none.
- A **hollow** marker means the interval crosses the null — shape, not colour — and the row says in
  words that this is not proof of no effect.
- A finding with **no reported interval gets a point and nothing else**. No dashed stub, no implied
  width. The row reads "interval not reported".
- An interval that runs past the axis is marked as running past it.
- Every mark carries a sentence for screen readers: measure, estimate, interval, and whether it
  crosses the null.

Nothing is pooled, converted, ranked or recomputed, here or anywhere.

## Source inspection

The product's signature interaction. A source opens the inspector beside the reading — the reader's
scroll position does not move, focus enters the panel, Escape closes it. The panel shows
bibliographic identity, the stored passage with the finding's own figures marked, what Clarity read
from it, and the provenance. Cited findings say plainly that they count toward nothing.

Below 1180px the inspector leaves the grid; below that it is a **full-width bottom sheet**, never
two thin columns. It costs no column when nothing is being inspected.

Three things are kept visibly apart: **what the source reports**, **what Clarity read from it**, and
**what has not been assessed**.

## Motion

120–180ms for small feedback (hover, press, focus, chip, row); 180–280ms for panels, tabs and the
inspector. Transforms and opacity only. No scroll hijacking, no ambient drift, no shimmer, and
**no scientific value is ever animated** — a number that counts up implies a change that did not
happen. `prefers-reduced-motion: reduce` drops every duration to ~0, verified in the browser.

## Anti-patterns

Each of these was in the product and was removed:

- Two stacked headers, a third inside the catalog, and a floating bottom dock.
- A gradient hero card on every page carrying a stock eyebrow, pushing the task below the fold.
- A library page whose first result sat 1,400px down.
- Internal vocabulary as UI: `Q1`–`Q5` badges, `EVIDENCE PLATFORM · BETA`, stage letters.
- Tracked-out ALL-CAPS accent eyebrows above every section.
- A universal card template applied to records that wanted a table.
- Findings as a stack of cards — seven of them, unalignable, uncomparable.
- Four teals, six border greys and ~600 colour literals across four parallel styling systems.
- `!important` tails appended to minified stylesheets instead of changing the rule.
- A publication count presented as if it were evidence strength.

## Checks before shipping a surface

1. `node --test src/**/*.test.js` and `npm run build`.
2. The automated sweep in the scratchpad: heading order, control labels, AA contrast on every
   surface, landmark presence.
3. 390 / 768 / 1366 / 1440, plus 455px and 341px (300% and 400% zoom): no page-level sideways
   scroll. A wide table scrolls in its own region.
4. Keyboard: `/` and `⌘K`, arrow keys in search, Escape out of the inspector, visible focus.
5. The engine off: every surface must still say what it is showing and where it came from.
