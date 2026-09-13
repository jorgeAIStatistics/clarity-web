import test from 'node:test';
import assert from 'node:assert/strict';
import { blankProject, dimension, matchedRows, quantitativeGate, overlay, suggestDefinition, toCSV, validEffect } from './model.js';
function fixture() {
  const p = blankProject();
  p.confirmed = true;
  p.comparisonConfirmed = true;
  const d = {
    population: 'adults',
    exposure: 'ApoB',
    comparator: 'lower ApoB',
    outcome: 'CVD',
    design: 'cohort',
    timepoint: '10 years',
    species: 'human',
    metric: 'hazard ratio',
    units: 'per SD'
  };
  p.definition = {
    ...p.definition,
    ...d
  };
  const study = {
    id: 'pmid:1',
    pmid: '1',
    layer: 'observational',
    design: d.design,
    population: d.population,
    exposure: d.exposure,
    comparator: d.comparator,
    timepoint: d.timepoint,
    findings: [{
      outcome: 'CVD',
      quote: 'HR 1.34 (95% CI 1.08–1.66)',
      effect: {
        measure: 'hazard ratio',
        estimate: 1.34,
        lower: 1.08,
        upper: 1.66,
        confidence_level: 95,
        units: 'per SD',
        origin: 'reported'
      }
    }]
  };
  p.result = {
    studies: [study]
  };
  p.decisions = {
    'pmid:1:0': {
      status: 'include',
      reason: 'Abstract and report reviewed'
    }
  };
  return p;
}
test('missing dimensions never earn credit', () => {
  assert.equal(dimension('', '').state, 'unknown');
  assert.equal(dimension('adult', '').state, 'unknown');
  assert.equal(dimension('adult', 'adult').state, 'exact');
});
test('draft does not invent dose or timepoint', () => {
  const d = suggestDefinition('We study ApoB in adults.');
  assert.equal(d.population, 'adults');
  assert.equal(d.dose, '');
  assert.equal(d.timepoint, '');
});
test('confirmed comparable reported estimate enables nonpooled plot', () => {
  const p = fixture();
  assert.equal(quantitativeGate(p, matchedRows(p)).eligible, true);
  assert.match(quantitativeGate(p, matchedRows(p)).pooling, /Not appropriate to pool/);
});
test('unknown timepoint blocks quantitative comparison', () => {
  const p = fixture();
  delete p.result.studies[0].timepoint;
  assert.equal(quantitativeGate(p, matchedRows(p)).eligible, false);
});
test('model inferred numbers are excluded even with a quote', () => {
  const p = fixture();
  p.result.studies[0].findings[0].effect.origin = 'model-inferred';
  assert.equal(quantitativeGate(p, matchedRows(p)).eligible, false);
});
test('duplicate participant cohorts block analysis', () => {
  const p = fixture();
  const s = p.result.studies[0];
  s.cohort_id = 'same';
  p.result.studies.push({
    ...s,
    id: 'pmid:2'
  });
  p.decisions['pmid:2:0'] = {
    status: 'include',
    reason: 'Reviewed'
  };
  assert.equal(quantitativeGate(p, matchedRows(p)).eligible, false);
});
test('human and animal evidence cannot be combined', () => {
  const p = fixture();
  p.result.studies[0].layer = 'preclinical';
  assert.equal(quantitativeGate(p, matchedRows(p)).eligible, false);
});
test('unknown CI and nonpositive ratio intervals are invalid', () => {
  assert.equal(validEffect({
    measure: 'hazard ratio',
    estimate: 1,
    lower: 0,
    upper: 2,
    confidence_level: 95
  }), false);
  assert.equal(validEffect({
    measure: 'hazard ratio',
    estimate: 1
  }), false);
});
test('user result is separate and CI overlap not a difference test', () => {
  const p = fixture();
  p.userResult = {
    metric: 'hazard ratio',
    estimate: '1.2',
    lower: '1.01',
    upper: '1.5',
    confidence_level: '95'
  };
  const u = overlay(p, quantitativeGate(p, matchedRows(p)));
  assert.equal(u.eligible, true);
  assert.equal(u.comparisons[0].intervalOverlap, true);
  assert.match(u.note, /not a formal test/);
  assert.equal(p.result.studies.length, 1);
});
test('original source fields remain distinct from user mappings', () => {
  const p = fixture();
  p.overrides = {
    'pmid:1:0': {
      population: 'children'
    }
  };
  const r = matchedRows(p)[0];
  assert.equal(r.original.population, 'adults');
  assert.equal(r.mapped.population, 'children');
  assert.equal(quantitativeGate(p, [r]).eligible, false);
});
test('CSV preserves zero and neutralizes formula injection', () => {
  const p = fixture();
  p.decisions['pmid:1:0'].reason = '=CMD()';
  const text = toCSV(matchedRows(p));
  assert.ok(text.includes("'=CMD()"));
});
test('explicit study sentence yields a draft without invented comparison', () => {
  const d = suggestDefinition('My study tests creatine on strength in older adults.');
  assert.equal(d.exposure, 'creatine');
  assert.equal(d.outcome, 'strength');
  assert.equal(d.population, 'older adults');
  assert.equal(d.comparator, '');
});
test('scientific signs and punctuation are not normalized away', () => {
  assert.notEqual(dimension('-5 mg', '5 mg').state, 'exact');
  assert.notEqual(dimension('0.5 mg', '05 mg').state, 'exact');
});

test('negative numeric estimates remain numeric in CSV',()=>{const p=fixture();p.result.studies[0].findings[0].effect.estimate=-0.2;const csv=toCSV(matchedRows(p));assert.ok(csv.includes('\"-0.2\"'));assert.ok(!csv.includes("'-0.2"));});
