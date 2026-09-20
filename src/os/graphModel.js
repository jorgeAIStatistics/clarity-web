// Graph environment model. 1-hop only.
//
// The engine returns related[] on a single entity payload. A researcher may WALK
// by focusing a neighbor and loading that object's own 1-hop. That is not a
// multi-hop query. Nothing here invents edges, intermediates, ranks, or citations.
//
// Topology is not evidence strength. Node color is entity kind. Node size marks
// the query center, not importance.

import {flatten, relationLabel, valueText, layerLabel} from '../evidence/graphProfile.js';
import {canonicalId, parseTypedId, stripEnvelope} from './identity.js';
import {KIND_LABEL, osPathFromId} from './routes.js';

export const STRUCTURAL_EDGES = new Set(['ENCODED_BY', 'VARIANT_OF', 'MEASURED_BY', 'IN_PATHWAY']);

export const EDGE_MEANING = {
  ENCODED_BY: 'Structural identity: the protein or marker is encoded by this gene. Not a finding.',
  VARIANT_OF: 'Structural identity: this sequence change belongs to the named gene. Not a finding.',
  MEASURED_BY: 'Structural identity: an assay or test measures this object.',
  IN_PATHWAY: 'Structural membership. Pathway membership is not evidence about any single member.',
  RELATED_TO: 'Evidence-linked relationship as stored on this payload. Related is not causal.',
};

export const REASON_LIMITS = {
  same_outcome: 'Studied for the same outcome. Shared outcome is not interchangeability.',
  same_population: 'Studied in the same population. Shared setting is not a mechanism.',
  predicts: 'Stored as predicts. Prediction is not utility.',
  measures: 'Stored as measures. A measurement relation is not a clinical claim.',
  modifies_treatment: 'Stored as a treatment modifier. Subgroup benefit is not by itself a marker-by-treatment interaction.',
  same_gene: 'Same gene. That is identity, not a mechanism finding.',
  same_pathway: 'Same pathway. Membership is not evidence about any member.',
};

const GENERIC_TOKENS = new Set(['cancer', 'gene', 'mutation', 'patients', 'protein', 'disease', 'tumor', 'advanced', 'marker', 'the', 'and']);

const KIND_FROM_LABEL = {
  Gene: 'gene', Protein: 'protein', Biomarker: 'biomarker', Variant: 'variant',
  Test: 'test', Assay: 'test', PrecisionContext: 'precision_context',
  Condition: 'condition', Pathway: 'pathway', Compound: 'intervention',
  Metabolite: 'metabolite', Intervention: 'intervention',
};

export function osKind(node = {}) {
  const raw = String(node.kind || node.type || '');
  if (KIND_FROM_LABEL[raw]) return KIND_FROM_LABEL[raw];
  const lower = raw.toLowerCase().replace(/\s+/g, '_');
  if (lower === 'compound') return 'intervention';
  if (lower === 'assay') return 'test';
  if (KIND_LABEL[lower]) return lower;
  const prefix = parseTypedId(node.id).prefix;
  if (prefix === 'compound') return 'intervention';
  if (prefix === 'assay') return 'test';
  if (KIND_LABEL[prefix]) return prefix;
  return lower || 'entity';
}

export function graphHref(id) {
  const canon = canonicalId(id) || stripEnvelope(id);
  return `/graph?focus=${encodeURIComponent(canon)}`;
}

export function graphNode(raw = {}, origin = '') {
  const id = canonicalId(raw.id) || stripEnvelope(raw.id);
  const kind = osKind(raw);
  return {
    id,
    name: raw.name || id,
    kind,
    kindLabel: KIND_LABEL[kind] || kind,
    aliases: raw.aliases || [],
    origin: raw.origin || origin || '',
    path: osPathFromId(id),
  };
}

export function classifyEdge(rel = {}) {
  const edge = rel.edge || '';
  if (STRUCTURAL_EDGES.has(edge)) {
    return {
      class: 'structural',
      title: 'Structural identity relationship',
      meaning: EDGE_MEANING[edge] || 'Structural relationship. No citation is invented.',
    };
  }
  if (edge === 'RELATED_TO') {
    return {
      class: 'evidence_link',
      title: 'Evidence-linked relationship',
      meaning: REASON_LIMITS[rel.reason] || EDGE_MEANING.RELATED_TO,
    };
  }
  return {
    class: 'stated',
    title: 'Stated relationship',
    meaning: 'Returned on this entity payload. Topology is not evidence strength.',
  };
}

function mentionHay(finding) {
  return [finding.marker, finding.target, finding.comparator, finding.population, finding.setting, finding.quote]
    .map(v => String(v || '')).join(' ');
}

function mentionsName(hay, name) {
  const n = String(name || '').trim();
  if (n.length < 3) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i').test(hay);
}

export function neighborTokens(rel = {}) {
  const slug = parseTypedId(rel.id).slug.replace(/-/g, ' ');
  const names = [rel.name, slug].filter(Boolean);
  const tokens = [];
  for (const n of names) {
    for (const t of String(n).split(/[\s_/×x]+/)) {
      if (t.length >= 3 && !GENERIC_TOKENS.has(t.toLowerCase())) tokens.push(t);
    }
  }
  return [...new Set(names.concat(tokens))];
}

export function evidenceForEdge(rel, findings) {
  const cls = classifyEdge(rel);
  if (cls.class === 'structural') {
    return {status: 'structural', attached: [], note: 'STRUCTURAL RELATIONSHIP. No source-bound finding is attached, and none is invented.'};
  }
  const rows = flatten(findings);
  const tokens = neighborTokens(rel);
  const attached = rows.filter(f => {
    const hay = mentionHay(f);
    return tokens.some(t => mentionsName(hay, t));
  });
  if (!attached.length) {
    return {status: 'none', attached: [], note: 'NO SOURCE-BOUND FINDING ATTACHED TO THIS EDGE. The relationship is stored on this payload; that is not a citation.'};
  }
  return {
    status: 'named_on_focus',
    attached,
    note: 'Findings on this focus payload that name the neighbor. They are not a pooled effect, and they do not grade the edge.',
  };
}

export function normalizeNeighborhood(data = {}, origin = '') {
  const entity = data.entity || {};
  const focus = graphNode(entity, origin || data.origin || '');
  const findings = data.findings || [];
  const related = (data.related || []).filter(r => r && (r.id || r.name));
  const edges = related.map((rel, i) => {
    const neighbor = graphNode(rel, rel.origin || origin || data.origin || '');
    const key = `${focus.id}|${rel.edge || 'RELATED_TO'}|${rel.reason || ''}|${neighbor.id}|${i}`;
    const cls = classifyEdge(rel);
    const evidence = evidenceForEdge(rel, findings);
    return {
      key,
      edge: rel.edge || 'RELATED_TO',
      reason: rel.reason || null,
      outgoing: rel.outgoing !== false,
      label: relationLabel(rel),
      class: cls.class,
      classTitle: cls.title,
      meaning: cls.meaning,
      origin: neighbor.origin,
      source: focus,
      target: neighbor,
      evidence,
    };
  }).filter(e => e.target.id && e.target.id !== focus.id);
  return {
    focus,
    edges,
    findings,
    studies: data.studies ?? null,
    layers: data.layers || [],
    origin: origin || data.origin || '',
    derived_from: data.derived_from || null,
    catalog_only: Boolean(data.catalog_only),
  };
}

export function applyFilters(neighborhood, filters = {}) {
  const kind = filters.kind || 'all';
  const edge = filters.edge || 'all';
  const origin = filters.origin || 'all';
  const layer = filters.layer || 'all';
  const klass = filters.class || 'all';
  const total = neighborhood.edges.length;
  const shown = neighborhood.edges.filter(e => {
    if (kind !== 'all' && e.target.kind !== kind) return false;
    if (edge !== 'all' && e.edge !== edge) return false;
    if (origin !== 'all' && e.origin !== origin) return false;
    if (klass !== 'all' && e.class !== klass) return false;
    if (layer !== 'all') {
      const layers = e.evidence.attached.map(f => f.layer).filter(Boolean);
      if (!layers.includes(layer)) return false;
    }
    return true;
  });
  return {total, shown, hidden: total - shown.length};
}

const KIND_ORDER = [
  'gene', 'protein', 'variant', 'biomarker', 'metabolite', 'pathway',
  'test', 'precision_context', 'intervention', 'condition',
];

function kindAngle(kind, kindsPresent) {
  const present = KIND_ORDER.filter(k => kindsPresent.includes(k));
  const list = present.length ? present : KIND_ORDER;
  const i = Math.max(0, list.indexOf(kind));
  return -Math.PI / 2 + (i / Math.max(list.length, 1)) * Math.PI * 2;
}

export function layoutNeighborhood(neighborhood, filters = {}) {
  const {shown, total, hidden} = applyFilters(neighborhood, filters);
  const kindsPresent = [...new Set(shown.map(e => e.target.kind))];
  const byKind = new Map();
  for (const e of shown) {
    const k = e.target.kind;
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(e);
  }
  const center = {x: 0.5, y: 0.5, ...neighborhood.focus, role: 'focus'};
  const nodes = [];
  const placed = [];
  const even = shown.length > 0 && shown.length <= 8;
  if (even) {
    shown.forEach((e, i) => {
      const a = -Math.PI / 2 + (i / shown.length) * Math.PI * 2;
      const rad = e.class === 'structural' ? 0.32 : 0.40;
      const x = 0.5 + Math.cos(a) * rad;
      const y = 0.5 + Math.sin(a) * rad * 0.84;
      const node = {...e.target, x, y, a, rad, role: 'neighbor', edgeKey: e.key, structural: e.class === 'structural'};
      nodes.push(node);
      placed.push({...e, node, x1: 0.5, y1: 0.5, x2: x, y2: y});
    });
  } else {
    for (const [kind, list] of byKind) {
      const base = kindAngle(kind, kindsPresent);
      const n = list.length;
      list.forEach((e, i) => {
        const spread = n === 1 ? 0 : ((i - (n - 1) / 2) * Math.min(0.42, 0.9 / n));
        const a = base + spread;
        const structural = e.class === 'structural';
        const rad = structural ? 0.30 : 0.40;
        const x = 0.5 + Math.cos(a) * rad;
        const y = 0.5 + Math.sin(a) * rad * 0.86;
        const node = {...e.target, x, y, a, rad, role: 'neighbor', edgeKey: e.key, structural};
        nodes.push(node);
        placed.push({...e, node, x1: 0.5, y1: 0.5, x2: x, y2: y});
      });
    }
  }
  return {center, nodes, edges: placed, total, shown: shown.length, hidden};
}

export function tableRows(layout) {
  return layout.edges.map(e => ({
    key: e.key,
    source: e.source.name,
    sourceId: e.source.id,
    sourceKind: e.source.kind,
    relationship: e.label,
    edge: e.edge,
    reason: e.reason || '',
    target: e.target.name,
    targetId: e.target.id,
    targetKind: e.target.kind,
    origin: e.origin || '',
    evidence: e.evidence.status,
    evidenceLabel: e.evidence.status === 'named_on_focus'
      ? `${e.evidence.attached.length} named finding${e.evidence.attached.length === 1 ? '' : 's'}`
      : e.evidence.status === 'structural' ? 'Structural' : 'None attached',
    class: e.class,
  }));
}

export function pathHop(fromNode, edge) {
  if (!fromNode || !edge) return null;
  if (edge.source.id !== fromNode.id && edge.target.id !== fromNode.id) return null;
  return {
    from: {id: edge.source.id, name: edge.source.name, kind: edge.source.kind},
    to: {id: edge.target.id, name: edge.target.name, kind: edge.target.kind},
    edge: edge.edge,
    reason: edge.reason,
    label: edge.label,
    class: edge.class,
    origin: edge.origin,
  };
}

export function pathSummary(hops = []) {
  if (!hops.length) return '';
  const names = [hops[0].from.name, ...hops.map(h => h.to.name)];
  return names.join(' → ');
}

export function pathTableRows(hops = []) {
  return hops.map((h, i) => ({
    key: `path-${i}-${h.from.id}-${h.to.id}-${h.edge}`,
    source: h.from.name,
    sourceId: h.from.id,
    sourceKind: h.from.kind,
    relationship: h.label,
    edge: h.edge,
    reason: h.reason || '',
    target: h.to.name,
    targetId: h.to.id,
    targetKind: h.to.kind,
    origin: h.origin || '',
    class: h.class,
    evidenceLabel: h.class === 'structural' ? 'Structural' : 'Recorded hop — not a multi-hop query',
  }));
}

export function exportPathJson(path) {
  return JSON.stringify({
    version: 'clarity-graph-path-v1',
    note: 'A pinned walk of successive 1-hop payloads. Not a multi-hop graph query. Hops are only stored edges.',
    name: path.name || pathSummary(path.hops),
    hops: path.hops,
    at: path.at || new Date().toISOString(),
  }, null, 2);
}

export function exportTableCsv(rows) {
  const cols = ['source', 'source_kind', 'source_id', 'relationship', 'reason', 'target', 'target_kind', 'target_id', 'origin', 'evidence'];
  const cell = v => {
    const t = v == null ? '' : String(v);
    return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  const lines = [cols.join(',')];
  for (const r of rows) {
    lines.push([r.source, r.sourceKind, r.sourceId, r.relationship, r.reason, r.target, r.targetKind, r.targetId, r.origin, r.evidenceLabel].map(cell).join(','));
  }
  return lines.join('\n') + '\n';
}

export function findingPreview(f) {
  return {
    id: f.id,
    text: valueText(f),
    kind: f.kind,
    layer: f.layer ? layerLabel(f.layer) : null,
    pmid: f.pmid || null,
    year: f.year || null,
    title: f.title || null,
    quote: f.quote || null,
    population: f.population || null,
    review: f.review_state || 'automated',
  };
}

export function filterOptions(neighborhood) {
  const kinds = [...new Set(neighborhood.edges.map(e => e.target.kind))];
  const edges = [...new Set(neighborhood.edges.map(e => e.edge))];
  const origins = [...new Set(neighborhood.edges.map(e => e.origin).filter(Boolean))];
  const classes = [...new Set(neighborhood.edges.map(e => e.class))];
  const layers = [...new Set(neighborhood.edges.flatMap(e => e.evidence.attached.map(f => f.layer).filter(Boolean)))];
  return {kinds, edges, origins, classes, layers};
}

export const QUERY_LABEL = {
  live: 'Live graph',
  querying: 'Querying live graph',
  snapshot: 'Using published snapshot',
  catalog: 'Catalog row — no graph edges invented',
  derived: 'Derived identity — edges are projections, not a protein node',
  missing: 'Not in this library',
};
