# Clarity instrument language (Phase 0)

This branch establishes the visual system later surfaces should inherit.

## Tokens
Import `src/design/tokens.css` first. Do not introduce a second accent or a second ink.

| Token | Use |
| --- | --- |
| `--ink` / `--ink-2` / `--panel` | Page, elevated field, module |
| `--hairline` | Structure. Prefer rules over radius. |
| `--accent` `#34e0be` | Action and indexed state only |
| `--gap` | Honest absence, never “warning that data exists” |
| `--font-display` | Titles |
| `--font-mono` | IDs, PMIDs, estimates, layer codes, eyebrows |

Layer colors stay the accessibility-checked set in tokens. They encode **layer**, never significance.

## Shape
Radius 4px on controls. Modules meet on a 1px grid (no 12–18px cards, no hover lift, no mint gradients).

## Registers
Mark copy as fact, evidence, interpretation, or gap. Quoted findings stay folded and uncounted. Automated reading is labeled; do not badge silence as primary.

## Shell
`.ev-header` and `.cl-shell` are the same bar: mark, domains, research, learn. Search is an instrument, not a marketing field.

## Do not
Reskin with glass, DNA illustration, or dashboard widgets. Do not invent scores. Do not pool studies in a new chart family. Do not touch `graphProfile.js` briefing contracts or engine routes from a visual PR.
