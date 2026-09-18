import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceRows, facets, filterRows, toTsv, toCsv, toJson, methodsSnippet, COLUMNS } from './workspaceModel.js';

const result = {
  entities: [{ id: 'biomarker:il-18', name: 'IL-18' }, { id: 'biomarker:ca-125', name: 'CA-125' }],
  graph_findings: [
    { id: 'obs:1', entity_id: 'biomarker:il-18', kind: 'discrimination', measure: 'auc', estimate: 0.92, target: 'chronic-persistent course', population: 'biologic-naive patients with SD', assay: 'Plasma IL-18', layer: 'observational', pmid: '41399151', year: 2026, quote: 'AUC 0.92', review_state: 'automated' },
    { id: 'obs:2', entity_id: 'biomarker:ca-125', kind: 'classification', measure: 'sensitivity', estimate: 79, unit: '%', cutoff: 35, cutoff_unit: 'U/mL', target: 'ovarian malignancy', population: 'women with a mass', layer: 'observational', pmid: '40590284', quote: 'sensitivity 79%', review_state: 'automated' },
  ],
};
const estimates = [{ id: 'pmid:1:cv', entityIds: ['biomarker:il-18'], mode: 'Association', fam: { label: 'HR' }, point: 1.2, lower: 1.1, upper: 1.4, outcome: 'cardiovascular events', population: 'adults', layer: 'observational', pmid: '1', quote: 'HR 1.2' }];

test('rows keep the warranty they came with', () => {
  const rows = workspaceRows({ result, estimates });
  assert.deepEqual(rows.map(r => r.source), ['graph', 'graph', 'retrieved']);
  assert.equal(rows[0].entity, 'IL-18');
  assert.equal(rows[0].display, 'AUC 0.92');
  assert.equal(rows[1].display, 'Sensitivity 79% at a cut-off of 35 U/mL');
  assert.equal(rows[2].kind, 'association', 'a retrieved association is not promoted to a typed finding');
  assert.deepEqual(workspaceRows({}), []);
});

test('facets count what is actually there, and filters compose', () => {
  const rows = workspaceRows({ result, estimates });
  const counts = facets(rows);
  assert.deepEqual(counts.kind.map(f => [f.value, f.n]).sort(), [['association', 1], ['classification', 1], ['discrimination', 1]]);
  assert.equal(filterRows(rows, { kinds: ['discrimination'] }).length, 1);
  assert.equal(filterRows(rows, { sources: ['graph'] }).length, 2);
  assert.equal(filterRows(rows, { entities: ['CA-125'], kinds: ['classification'] }).length, 1);
  assert.equal(filterRows(rows, { text: 'ovarian' })[0].entity, 'CA-125');
  assert.equal(filterRows(rows, { text: 'nothing here' }).length, 0);
  assert.equal(filterRows(rows, {}).length, 3);
});

test('exports carry every column, escape their quotes, and name the source', () => {
  const rows = workspaceRows({ result, estimates });
  const tsv = toTsv(rows).split('\n');
  assert.equal(tsv[0], COLUMNS.join('\t'));
  assert.equal(tsv.length, 4);
  assert.ok(tsv[1].includes('In this library'));
  const csv = toCsv([{ ...rows[0], quote: 'He said "AUC 0.92", loudly' }]);
  assert.match(csv, /"He said ""AUC 0.92"", loudly"/);
  const parsed = JSON.parse(toJson(rows, { question: 'q' }));
  assert.equal(parsed.version, 'clarity-findings-export-v1');
  assert.deepEqual([parsed.question, parsed.rows.length], ['q', 3]);
});

test('the methods snippet states the boundary of the search, not just its result', () => {
  const rows = workspaceRows({ result, estimates });
  const briefs = [{ name: 'IL-18', missing: ['Clinical utility', 'Biology'] }, { name: 'breast cancer', context: true }];
  const snippet = methodsSnippet({ restatement: 'IL-18 × breast cancer × radiotherapy pain.', rows, briefs, filters: 'kind = discrimination' });
  assert.match(snippet, /Entities resolved from the question text: IL-18\./);
  assert.match(snippet, /2 typed findings \(classification 1, discrimination 1\)|2 typed findings \(1 classification, 1 discrimination\)/);
  assert.match(snippet, /1 quote-backed estimate/);
  assert.match(snippet, /Not in this library for at least one entity: clinical utility, biology\./);
  assert.match(snippet, /Absence here means Clarity holds no matching record, not that no such study exists\./);
  assert.match(snippet, /automated and not expert-reviewed/);
  assert.match(snippet, /filtered by kind = discrimination/);
  // A question with nothing indexed must say so rather than going quiet.
  assert.match(methodsSnippet({ question: 'x'.repeat(10), rows: [], briefs: [] }), /no typed finding is indexed/);
});

test('sample size travels with the estimate it belongs to', () => {
  // n was stored on every finding and appeared in neither the table nor the export, so an estimate
  // arrived without the one number needed to weigh it.
  const withN = { ...result, graph_findings: [{ ...result.graph_findings[0], n: 158 }, result.graph_findings[1]] };
  const rows = workspaceRows({ result: withN, estimates: [] });
  assert.equal(rows[0].n, 158);
  assert.equal(rows[1].n, null, 'an abstract that did not report n must not gain one');
  assert.ok(COLUMNS.includes('n'));
  const header = toTsv(rows).split('\n')[0].split('\t');
  assert.equal(header[COLUMNS.indexOf('n')], 'n');
  assert.equal(toTsv(rows).split('\n')[1].split('\t')[COLUMNS.indexOf('n')], '158');
  assert.equal(toTsv(rows).split('\n')[2].split('\t')[COLUMNS.indexOf('n')], '', 'an unreported n exports as empty, not as zero');
});
