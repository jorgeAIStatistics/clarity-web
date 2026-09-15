import test from 'node:test';
import assert from 'node:assert/strict';
import { cellFindings, cellAccuracy } from './questionMap.js';

const quote = 'At a cut-off of 100 ng/mL, CgA had a sensitivity of 71% and a specificity of 85%.';
const typed = (id, measure, estimate, entity_ids, extra = {}) => ({ finding_id: id, kind: 'classification', measure, quote, outcome: 'neuroendocrine neoplasms', threshold: 100, threshold_unit: 'ng/mL', entity_ids, effect: { estimate, units: '%' }, ...extra });
const example = { id: 'pmid:1', retrieved: { findings: [
  typed('obs:1', 'sensitivity', 71, ['biomarker:chromogranin-a']),
  typed('obs:2', 'specificity', 85, ['biomarker:chromogranin-a']),
  typed('obs:3', 'sensitivity', 60, ['biomarker:nse']),
  { finding_id: 'obs:4', kind: 'discrimination', measure: 'auc', quote, outcome: 'neuroendocrine neoplasms', entity_ids: ['biomarker:chromogranin-a'], effect: { estimate: 0.82, lower: 0.76, upper: 0.88 } },
  { outcome: 'legacy PICO finding', effect: { measure: 'HR', estimate: 0.7 } },
] } };

test('a cell lists only findings whose marker names its entity, plus untyped legacy findings', () => {
  assert.deepEqual(cellFindings(example, 'biomarker:chromogranin-a').map(f => f.finding_id || f.outcome), ['obs:1', 'obs:2', 'obs:4', 'legacy PICO finding']);
});

test('cell accuracy pairs sensitivity and specificity and strips grounded AUC values', () => {
  const { table, strip } = cellAccuracy([example], 'biomarker:chromogranin-a');
  assert.deepEqual(table.rows.map(r => [r.pmid, r.cutoff, r.values]), [['1', '100 ng/mL', { sensitivity: '71%', specificity: '85%' }]]);
  assert.deepEqual(strip.points.map(p => [p.id, p.estimate]), [['obs:4', 0.82]]);
  assert.deepEqual(cellAccuracy([example], 'biomarker:nse').strip.points, []);
});
