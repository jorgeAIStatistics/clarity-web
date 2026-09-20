# Clarity instrument language

This folder is the visual contract for Clarity as a biomedical research intelligence platform. It is not a component library and it does not own scientific meaning.

## What this phase established

- Tokens live in `tokens.css`. New color, type, or radius values belong there first.
- Shared chrome lives in `shell.css`. Homepage `GuideTopBar` and explorer `.ev-header` should look like one instrument.
- Evidence cards, notes, tables, hover and loading belong in `evidence-surfaces.css`.
- Graph entity identity, Q-ladder and command rail belong in `graph-command.css`.
- Matcher / workspace bench treatments belong in `matcher-instrument.css`.
- Homepage composition belongs in `platform-home.css`.

## Rules future phases must keep

1. Do not invent grades, pooled estimates, or clinical advice in the interface.
2. Color marks domain or evidence layer. It never means “significant”.
3. Numbers stay tabular and source-bound. Quotes stay quotes.
4. Gaps are first-class. Empty utility is a statement, not a missing widget.
5. Motion is hierarchical, not decorative. Honor `prefers-reduced-motion`.
6. Do not restyle by copying dashboard kits. Prefer ledgers, rails, and pipelines.
7. Backend contracts stay untouched: `graphProfile.js`, briefing strings, workspace export, API clients, Neo4j paths.
8. Prefer adding classes over rewriting render logic. If a scientific sentence must change, it is not a design task.

## Type

- Display / entity titles: Source Serif 4
- UI and running text: Inter
- Counts, IDs, Q-labels, PMIDs: JetBrains Mono

## Surfaces still outside this PR

Compound `/compound/:slug` report chrome, comparison columns, learn/methodology longform, and the visual-profile studio keep their existing CSS. Later phases should migrate them onto these tokens rather than inventing a second palette.

## Mounts landed on this branch

- Graph entity pages render `<GraphCommand />` immediately after the Hero (including the loading state).
- Homepage / Learn `GuideTopBar` is a `.cl-shell` header with the shared command search.
- Explorer `.ev-header` uses the same brand, search, and signal nav. `?q=` seeds the library filter; `/` focuses `#cl-command-search`.

