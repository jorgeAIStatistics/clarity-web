import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {
  osKind, graphNode, classifyEdge, evidenceForEdge, normalizeNeighborhood,
  applyFilters, layoutNeighborhood, pathHop, tableRows, neighborTokens, pathTableRows,
} from './graphModel.js';
import {canonicalId, identityFromEntry} from './identity.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../public/graph-profiles.json');
const profiles = JSON.parse(readFileSync(root, 'utf8')).entities;

test('canonical ids collapse graph envelopes on neighbors', () => {
  const n = graphNode({id: 'graph:gene:egfr', name: 'EGFR gene', kind: 'Gene'});
  assert.equal(n.id, 'gene:egfr');
  assert.equal(n.kind, 'gene');
  assert.equal(canonicalId('graph:variant:egfr-activating-mutation'), 'variant:egfr-activating-mutation');
});

test('ENCODED_BY is structural and never receives attached findings', () => {
  const rel = {edge: 'ENCODED_BY', id: 'gene:il18', name: 'IL18 gene', kind: 'Gene', outgoing: true};
  assert.equal(classifyEdge(rel).class, 'structural');
  const ev = evidenceForEdge(rel, profiles['biomarker:il-18'].findings);
  assert.equal(ev.status, 'structural');
  assert.equal(ev.attached.length, 0);
});

test('VARIANT_OF is structural', () => {
  const rel = profiles['variant:egfr-activating-mutation'].related[0];
  assert.equal(rel.edge, 'VARIANT_OF');
  assert.equal(classifyEdge(rel).class, 'structural');
});

test('RELATED_TO selpercatinib attaches findings that name the compound', () => {
  const payload = profiles['precision_context:ret-selpercatinib'];
  const rel = payload.related.find(r => r.id === 'compound:selpercatinib');
  const ev = evidenceForEdge(rel, payload.findings);
  assert.equal(classifyEdge(rel).class, 'evidence_link');
  assert.equal(ev.status, 'named_on_focus');
  assert.ok(ev.attached.length >= 1);
});

test('RELATED_TO does not invent citations when the neighbor is unnamed in findings', () => {
  const rel = {edge: 'RELATED_TO', reason: 'same_gene', id: 'gene:brca2', name: 'BRCA2', kind: 'Gene'};
  const ev = evidenceForEdge(rel, profiles['biomarker:apob'].findings);
  assert.equal(ev.status, 'none');
  assert.equal(ev.attached.length, 0);
});

test('normalizeNeighborhood uses canonical ids and keeps RET 1-hop honest', () => {
  const nb = normalizeNeighborhood(profiles['precision_context:ret-selpercatinib'], 'snapshot');
  assert.equal(nb.focus.id, 'precision_context:ret-selpercatinib');
  assert.equal(nb.edges.length, 3);
  const ids = nb.edges.map(e => e.target.id).sort();
  assert.deepEqual(ids, ['compound:selpercatinib', 'condition:thyroid-cancer', 'variant:ret-fusion']);
  assert.ok(nb.edges.every(e => e.class === 'evidence_link'));
});

test('filters hide relationships rather than deleting them', () => {
  const nb = normalizeNeighborhood(profiles['precision_context:ret-selpercatinib'], 'snapshot');
  const f = applyFilters(nb, {kind: 'variant'});
  assert.equal(f.total, 3);
  assert.equal(f.shown.length, 1);
  assert.equal(f.hidden, 2);
  assert.equal(f.shown[0].target.kind, 'variant');
});

test('layout is deterministic and focus is the query center', () => {
  const nb = normalizeNeighborhood(profiles['precision_context:ret-selpercatinib'], 'snapshot');
  const a = layoutNeighborhood(nb, {});
  const b = layoutNeighborhood(nb, {});
  assert.equal(a.center.role, 'focus');
  assert.equal(a.nodes.length, 3);
  assert.deepEqual(a.nodes.map(n => [n.id, n.x, n.y]), b.nodes.map(n => [n.id, n.x, n.y]));
  const xs = new Set(a.nodes.map(n => n.x.toFixed(4)));
  assert.equal(xs.size, a.nodes.length);
});

test('pathHop only records a hop from the current focus along a payload edge', () => {
  const nb = normalizeNeighborhood(profiles['precision_context:ret-selpercatinib'], 'snapshot');
  assert.equal(nb.edges.some(e => e.target.id === 'gene:brca1'), false);
  const hop = pathHop(nb.focus, nb.edges[0]);
  assert.equal(hop.from.id, nb.focus.id);
  assert.equal(hop.to.id, nb.edges[0].target.id);
  assert.equal(pathHop(nb.focus, null), null);
});

test('table twin is the same neighborhood', () => {
  const nb = normalizeNeighborhood(profiles['precision_context:ret-selpercatinib'], 'snapshot');
  const layout = layoutNeighborhood(nb, {});
  const rows = tableRows(layout);
  assert.equal(rows.length, layout.edges.length);
  assert.ok(rows.every(r => r.sourceId === nb.focus.id));
});

test('entity: catalog rows are not a second graph node', () => {
  const ident = identityFromEntry({id: 'entity:apob', entity_type: 'biomarker', path: '/biomarkers/apob', name: 'ApoB'});
  assert.equal(ident.id, 'biomarker:apob');
  const n = graphNode({id: ident.id, name: 'ApoB', kind: 'Biomarker'});
  assert.equal(n.id, 'biomarker:apob');
});

test('osKind maps Compound and PrecisionContext', () => {
  assert.equal(osKind({kind: 'Compound', id: 'compound:selpercatinib'}), 'intervention');
  assert.equal(osKind({kind: 'PrecisionContext'}), 'precision_context');
  assert.equal(osKind({id: 'gene:brca1'}), 'gene');
});

test('neighborTokens keep RET as a distinctive token', () => {
  const t = neighborTokens({id: 'variant:ret-fusion', name: 'RET fusion'});
  assert.ok(t.some(x => /ret/i.test(x)));
});

test('path table is hops only, not inferred intermediates', () => {
  const nb = normalizeNeighborhood(profiles['precision_context:ret-selpercatinib'], 'snapshot');
  const hop = pathHop(nb.focus, nb.edges.find(e => e.target.id === 'compound:selpercatinib'));
  const rows = pathTableRows([hop]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].targetId, 'compound:selpercatinib');
  assert.equal(pathTableRows([]).length, 0);
});
