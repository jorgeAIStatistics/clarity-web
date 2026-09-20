# Canonical frontend identity

Clarity’s OS treats **one typed graph object as one identity**. Catalog `entity:`
and graph `graph:` prefixes are *source envelopes*, not kinds.

## Canonical form

```
{prefix}:{slug}
```

Examples: `biomarker:apob`, `gene:brca1`, `compound:creatine`,
`precision_context:egfr-osimertinib`, `protein:il18`.

| Incoming | Canonical | Notes |
|---|---|---|
| `graph:biomarker:apob` | `biomarker:apob` | Strip `graph:` |
| `entity:apob` + path `/biomarkers/apob` | `biomarker:apob` | Resolve via catalog path / kind |
| `graph:gene:brca1` | `gene:brca1` | |
| `compound:creatine` | `compound:creatine` | OS *kind* is `intervention`; graph prefix stays `compound` |
| `protein:il18` (derived) | `protein:il18` | Not a catalog/graph node; origin `derived` |

`entity:apob` without a catalog row **cannot** be canonicalized. The adapter
refuses to guess the kind.

## What stores canonical ids

Pins, recents, collections, Command hits, Catalog rows, Graph `?focus=`,
Ask-rail hops. Compare *as an object* uses canonical id.

## What is not identity

`visual-evidence.json` still keys some extracts `entity:apob`. That is a
**legacy extract key** for the intervention/biomarker visual report. The OS
maps it with `visualExtractId()` at the Compare / VisualProfile boundary only.
Do not persist `entity:` in OS state.

## Origins — never presented as equivalent

| Origin | Meaning |
|---|---|
| `live` | Engine answered `/api/evidence/graph/entity/<id>` |
| `snapshot` | Bundled `graph-profiles.json` for that id |
| `catalog` | Library row only; no typed findings reconstructed |
| `derived` | Identity projection of another node (protein from biomarker). Findings are **not** copied. |

A derived protein page that looks complete is a scientific error. Empty
protein-level modules are correct.

## Adapter

`src/os/identity.js` is the only place later Graph, Collections, Compare, Pins
and Investigation should go to resolve an id. Do not add `entity:` special
cases in those features.
