import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildReport, validEstimate, precision, magnitude, filterRows, scale, sortRows } from './reportModel.js';
const data = JSON.parse(fs.readFileSync(new URL('../../public/profile-report-context.json', import.meta.url)));
const report = buildReport({
  outcomes: [],
  analysis: {
    outcomes: []
  }
}, null, data.profiles['vitamin-d3']);
test('Vitamin D separates baseline deficiency, fracture endpoints and calcium contrast', () => {
  const names = report.map(o => o.name);
  for (const name of ['Total fractures', 'Hip fractures', 'Deficiency / serum 25(OH)D', 'Any fracture / vitamin D + calcium']) assert.ok(names.includes(name));
  const fracture = report.find(o => o.name === 'Total fractures').rows[0];
  assert.match(fracture.baseline, /Not selected/);
  assert.equal(fracture.effect.estimate, .98);
  const deficient = report.find(o => o.name.includes('25(OH)D')).rows[0];
  assert.match(deficient.baseline, /95.5%/);
  assert.equal(deficient.effect.unit, 'ng/mL');
});
test('CKD finding is RR, not OR, with a wide crossing interval and no inherited Strong grade', () => {
  const o = report.find(o => o.name.includes('kidney'));
  const e = o.rows[0].effect;
  assert.equal(magnitude(e), 'RR 0.68');
  assert.match(precision(e), /benefit and equivalence are not established/);
  assert.equal(o.grade, null);
  assert.equal(o.rows[0].sample_size, null);
});
test('every plotted gold finding and offset matches its retained source', () => {
  for (const s of data.profiles['vitamin-d3'].studies) for (const f of s.findings) {
    assert.equal(s.abstract.slice(f.source_span.start, f.source_span.end), f.quote);
    for (const v of [f.effect.estimate, f.effect.lower, f.effect.upper]) assert.ok(f.quote.includes(String(v)));
  }
});
test('legacy candidates stay auditable but never become endpoint-validated estimates', () => {
  const r = buildReport({
    analysis: {
      outcomes: [{
        name: 'Fractures',
        legacy_grade: 'Strong',
        effects: [{
          metric: 'or',
          estimate: .68
        }],
        studies: [{
          id: '1',
          population: 'human'
        }]
      }]
    }
  });
  assert.equal(r[0].grade, 'Strong');
  assert.equal(r[0].candidates.length, 1);
  assert.equal(r[0].rows[0].effect, undefined);
});
test('filters coordinate rows and reset without turning missing values into zero', () => {
  const rows = [{
    population: 'Adults',
    baseline: 'Not extracted'
  }, {
    population: 'Children',
    baseline: 'Deficient'
  }];
  assert.equal(filterRows(rows, {
    population: 'Children',
    baseline: 'Deficient'
  }).length, 1);
  assert.equal(filterRows(rows, {}).length, 2);
  assert.equal(filterRows(rows, {
    population: 'Adults',
    baseline: 'Deficient'
  }).length, 0);
});
test('plot rejects impossible intervals and preserves reference positions on log scales', () => {
  assert.equal(validEstimate({
    metric: 'rr',
    estimate: 1,
    lower: 0,
    upper: 2
  }), false);
  assert.equal(validEstimate({
    metric: 'rr',
    estimate: 1,
    lower: 2,
    upper: 3
  }), false);
  assert.equal(validEstimate({
    metric: 'rr',
    estimate: NaN,
    lower: 1,
    upper: 3
  }), false);
  const s = scale({
    metric: 'rr',
    estimate: .68,
    lower: .37,
    upper: 1.23
  });
  assert.ok(s.x(.37) < s.x(.68) && s.x(.68) < s.x(1) && s.x(1) < s.x(1.23));
});
test('date ordering does not mutate source records', () => {
  const rows = [{
    year: 2020
  }, {
    year: 2023
  }];
  assert.equal(sortRows(rows, 'date')[0].year, 2023);
  assert.equal(rows[0].year, 2020);
});
test('a modified quote cannot enter the numerical report', () => {
  const bad = structuredClone(data.profiles['vitamin-d3']);
  bad.studies[0].findings[0].quote = 'A replacement passage';
  const r = buildReport({}, null, bad);
  assert.equal(r[0].rows[0].effect, null);
});
test('point-only findings retain their population without fabricating an interval',()=>{const sources=JSON.parse(fs.readFileSync(new URL('../../public/intervention-enrichment.json',import.meta.url)));const r=buildReport({},sources.profiles.creatine);const e=r[0].rows[0].effect;assert.match(magnitude(e),/Partial η² 0.029/);assert.equal(validEstimate(e),false);assert.match(precision(e),/without a confidence interval/);assert.match(r[0].rows[0].population,/123/);});
test('an interval touching the null is not described as crossing both sides',()=>{assert.match(precision({metric:'rr',estimate:.8,lower:.6,upper:1}),/boundary/);});
