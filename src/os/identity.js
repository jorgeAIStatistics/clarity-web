// Canonical frontend identity.
//
// One typed node is one object. Catalog `entity:` and graph `graph:` prefixes
// are source envelopes, not ontology. Pins, recents, Command, Catalog, Graph
// focus and Compare (as the *object*) all use `canonical.id`.
//
//   graph:biomarker:apob  →  biomarker:apob
//   entity:apob + path /biomarkers/apob  →  biomarker:apob
//   graph:gene:brca1      →  gene:brca1
//   compound:creatine     →  compound:creatine  (OS kind: intervention)
//
// Visual-evidence snapshots still key some extracts as `entity:apob`. That is a
// *legacy extract key*, mapped at the compare/report boundary by visualExtractId.
// It is not a second identity for ApoB.
//
// Origins (honest, never equivalent):
//   live      — GET /api/evidence/graph/entity/<canonical.id> answered
//   snapshot  — bundled graph-profiles.json for that canonical id
//   catalog   — library row only; no typed findings reconstructed
//   derived   — identity view synthesized from another node (e.g. protein from
//               a biomarker with UniProt). Findings are never copied across.

import {graphId, libraryKind, osPathFromId, parseOsPath, pathForEntry, KIND_PREFIX} from './routes.js';

const GRAPH_PREFIXES = new Set([
  'gene', 'protein', 'biomarker', 'metabolite', 'variant', 'test', 'assay',
  'precision_context', 'condition', 'pathway', 'compound',
]);

export const SOURCE_META = {
  live: {
    short: 'Live graph',
    long: 'This page is the live evidence-graph payload for this object.',
  },
  snapshot: {
    short: 'Bundled snapshot',
    long: 'The live graph did not answer in time. This is the last bundled graph payload, not a reconstructed page.',
  },
  catalog: {
    short: 'Catalog row',
    long: 'No graph payload was available. This page is the catalog row only — typed findings are not invented from coverage counts.',
  },
  derived: {
    short: 'Derived identity',
    long: 'This object is not a graph node in the current library. The view is an identity projection of a related node. Findings are not copied onto it.',
  },
};

// Scientifically grounded derived identities only. Do not add a protein view
// just because a biomarker shares a name.
export const DERIVED_IDENTITIES = [
  {
    id: 'protein:il18',
    kind: 'protein',
    slug: 'il18',
    name: 'IL-18 protein',
    aliases: ['IL18', 'IL-18 protein', 'Interleukin-18', 'IL-18'],
    path: '/protein/il18',
    derived_from: 'biomarker:il-18',
    origin: 'derived',
    summary: 'Derived identity view of the IL-18 gene product (UniProt Q14116). Not a graph protein node. Findings stay on the biomarker.',
  },
];

export function stripEnvelope(raw = '') {
  return String(raw || '').replace(/^graph:/, '');
}

export function parseTypedId(raw = '') {
  const inner = stripEnvelope(raw);
  const i = inner.indexOf(':');
  if (i < 1) return {prefix: '', slug: inner, inner};
  return {prefix: inner.slice(0, i), slug: inner.slice(i + 1), inner};
}

export function canonicalId(raw, entry) {
  const {prefix, slug, inner} = parseTypedId(raw);
  if (!inner) return '';
  if (prefix === 'entity') {
    if (!entry) return '';
    return identityFromEntry(entry).id;
  }
  if (GRAPH_PREFIXES.has(prefix)) return `${prefix === 'assay' ? 'test' : prefix}:${slug}`;
  if (entry) return identityFromEntry(entry).id;
  return inner;
}

export function identityFromKindSlug(kind, slug) {
  const id = graphId(kind, slug);
  return {
    id,
    kind,
    slug,
    path: osPathFromId(id),
    envelope: 'typed',
  };
}

export function identityFromEntry(entry = {}) {
  const kind = libraryKind(entry);
  const path = pathForEntry(entry);
  const parsed = parseOsPath(path);
  const slug = parsed.slug || parseTypedId(entry.id).slug;
  const id = parsed.id || graphId(kind, slug);
  const raw = String(entry.id || '');
  let envelope = 'typed';
  if (raw.startsWith('graph:')) envelope = 'graph';
  else if (raw.startsWith('entity:')) envelope = 'entity';
  else if (raw.startsWith('compound:')) envelope = 'compound';
  return {
    id,
    kind,
    slug,
    path,
    name: entry.name,
    envelope,
    rawId: raw,
  };
}

export function sameIdentity(a, b) {
  const idA = typeof a === 'string' ? canonicalId(a) : a?.id;
  const idB = typeof b === 'string' ? canonicalId(b) : b?.id;
  if (idA && idB && idA === idB) return true;
  const pathA = typeof a === 'object' ? a?.path : null;
  const pathB = typeof b === 'object' ? b?.path : null;
  return Boolean(pathA && pathB && pathA === pathB);
}

// Visual-evidence.json and Comparison still key some snapshots as entity:<slug>.
// Map at the extract boundary only — never store this as the object’s identity.
export function visualExtractId(identity) {
  const kind = identity?.kind;
  const slug = identity?.slug;
  const id = identity?.id || '';
  if (kind === 'intervention' || id.startsWith('compound:')) {
    return id.startsWith('compound:') ? id : `compound:${slug}`;
  }
  if (kind === 'biomarker' || kind === 'test' || kind === 'precision_context') {
    return `entity:${slug}`;
  }
  return id;
}

export function derivedForQuery(query) {
  const q = String(query || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!q) return [];
  return DERIVED_IDENTITIES.filter(d => {
    const hay = [d.id, d.name, d.path, ...(d.aliases || [])].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return hay.includes(q);
  });
}

export function isGraphPrefix(prefix) {
  return GRAPH_PREFIXES.has(prefix) || Boolean(KIND_PREFIX[prefix]);
}
