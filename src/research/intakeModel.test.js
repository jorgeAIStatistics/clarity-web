import test from 'node:test';
import assert from 'node:assert/strict';
import { studyLabels, meaningfulFields, unresolved, mergedDraft } from './intakeModel.js';
import { blankProject } from './model.js';
test('study language follows the scientific design', () => {
  assert.equal(studyLabels({
    design: 'prospective cohort',
    exposure: 'plasma IL-18'
  }).exposure, 'Biomarker / predictor');
  assert.equal(studyLabels({
    design: 'randomized controlled trial'
  }).exposure, 'Intervention');
  assert.equal(studyLabels({
    design: 'diagnostic accuracy study'
  }).comparator, 'Reference standard');
  assert.equal(studyLabels({
    species: 'animal'
  }).population, 'Model');
  assert.equal(studyLabels({
    species: 'cell'
  }).instrument, 'Assay');
});
test('zero meaningful fields cannot be presented as a successful draft', () => {
  assert.equal(meaningfulFields({}), 0);
  assert.equal(meaningfulFields({
    metric: 'odds ratio'
  }), 0);
  assert.deepEqual(unresolved({
    exposure: 'IL-18'
  }), ['outcome']);
});
test('new source draft clears stale fields and always requires confirmation', () => {
  const p = blankProject();
  p.definition.dose = 'old dose';
  p.confirmed = true;
  p.result = {};
  const r = mergedDraft(p, {
    definition: {
      exposure: 'IL-18',
      outcome: 'pain'
    },
    provenance: {}
  });
  assert.equal(r.definition.dose, '');
  assert.equal(r.confirmed, false);
  assert.equal(r.result, null);
  assert.deepEqual(unresolved(r.definition), []);
});
