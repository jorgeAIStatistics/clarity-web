import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entityReading, compoundReading, conclusionExcerpt, coverageBand, studyLimits, groupMeaning, mentionTexts, LAYERS } from './meaningModel.js';
import { measureFamily, describeEffect, summarizeSides } from '../evidence/measures.js';
import { prepareReport } from './visualModel.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../evidence/catalog.json', import.meta.url)));
const snapshot = JSON.parse(fs.readFileSync(new URL('../../public/visual-evidence.json', import.meta.url))).profiles;
const entity = id => catalog.entities.find(e => e.id === id);
const reportFor = e => prepareReport(snapshot[`entity:${e.id}`], { targetId: `entity:${e.id}` });
const ADVICE = /\b(?:you should|should take|we recommend|is recommended for you|take \d|dose you)\b/i;

// Minimal compound view in the shape produced by the profile API adapter.
const view = {
  name: 'creatine monohydrate', reviewedBy: 'auto',
  analysis: { coverage: { outcomes: 2, quantified_outcomes: 1, protocols: 2 }, outcomes: [
    { name: 'muscle strength', counts: { interventional: 42, observational: 1, preclinical: 3, synthesis: 5, protocol: 2 }, grade_status: 'refresh_required', missing_sample_size: 41, study_count: 54,
      effects: [{ eligible: true, pmid: '40366059', measure: 'Mean difference', estimate: 0.19, lower: -0.71, upper: 1.08, interval_level: 95, layer: 'interventional', design: 'RCT', sample_size: 11, title: 'Creatine in children with FSHD', url: 'https://pubmed.ncbi.nlm.nih.gov/40366059/', year: '2025', quote: 'mean difference in MFM-32 (0.19, 95% CI -0.71 to 1.08)', comparator: 'vs placebo', context_mentions: { population: [{ text: 'children' }], exposure: [{ text: '10 g daily' }], follow_up: [{ text: '12-week' }] } }],
      studies: [{ id: '40366059', design: 'RCT', layer: 'interventional', population: 'human', sample_size: 11, title: 'Creatine in children with FSHD', url: 'https://pubmed.ncbi.nlm.nih.gov/40366059/', year: '2025' }, { id: '1', design: 'Meta-analysis', layer: 'synthesis', population: 'human', title: 'Review', year: '2024' }] },
    { name: 'tendon healing', counts: { preclinical: 6 }, study_count: 6, effects: [], studies: [] },
  ] },
  outcomes: [
    { outcome: 'muscle strength', tier: 'Strong', nStudies: 54, directionStatus: 'assessed', headlineEffect: { direction: 'benefit', pmid: '1', quote: 'creatine increased strength' }, studies: [{ pmid: '40366059', design: 'RCT', population: 'human', abstract: 'Background text. Conclusions: Creatine was well tolerated but did not change motor function.' }, { pmid: '1', design: 'Meta-analysis', population: 'human' }] },
    { outcome: 'tendon healing', tier: 'Preliminary', nStudies: 6, directionStatus: 'not_required', headlineEffect: null, studies: [{ pmid: '9', design: 'Animal study', population: 'animal' }] },
  ],
};

test('biomarker reading leads with meaning and separates association from utility', () => {
  const e = entity('apob'), r = entityReading(e, reportFor(e));
  assert.ok(r.snapshot.length >= 3 && r.snapshot.length <= 6);
  assert.equal(r.snapshot.at(-1).kind, 'review');
  assert.match(r.snapshot.find(s => s.kind === 'association').text, /association does not show/);
  const cvd = r.outcomes.find(o => o.name === 'Cardiovascular events').lines.find(l => l.mode === 'Association');
  assert.match(cvd.text, /4% higher hazard of cardiovascular events \(the interval excludes no difference\)/);
  assert.ok(r.tensions.some(t => t.kind === 'utility' && t.layer === 'interventional'));
  assert.ok(r.tensions.some(t => t.kind === 'association_vs_prediction'));
  assert.deepEqual(r.layers.map(l => l.key), LAYERS.map(l => l.key));
  assert.ok(r.layers.find(l => l.key === 'guidelines').count >= 1);
});

test('every catalog profile builds a bounded reading without advice or invented effects', () => {
  for (const e of catalog.entities) {
    const r = entityReading(e, reportFor(e));
    assert.ok(r.snapshot.length >= 1 && r.snapshot.length <= 6, e.id);
    for (const s of [...r.snapshot, ...r.tensions, ...r.outcomes.flatMap(o => o.lines)]) assert.doesNotMatch(s.text, ADVICE, e.id);
    for (const line of r.outcomes.flatMap(o => o.lines)) for (const est of line.estimates) {
      assert.ok(est.quote, `${e.id} estimate without a source passage`);
      if (est.fam.scale === 'log' && est.point < 2) {
        const change = Math.round(Math.abs(1 - est.point) * 100);
        if (line.estimates.length === 1 && change) assert.match(line.text, new RegExp(`${change}%`), e.id);
      }
    }
    if (!e.studies.length) assert.match(r.snapshot[0].text, /No study records/);
    for (const l of r.layers.filter(l => !l.count)) assert.match(l.empty, /are linked yet/);
  }
});

test('compound reading keeps grade, direction and verified size apart', () => {
  const r = compoundReading(view, null, { monitoring: { monitoring_status: 'checked', last_checked: '2026-09-14T05:13:22Z', updates_pending_review: 585 } });
  const strength = r.outcomes.find(o => o.name === 'muscle strength');
  assert.equal(strength.kind, 'favourable');
  assert.match(strength.text, /Human trials \(42, plus 5 published reviews\)/);
  assert.match(strength.text, /only verified estimate \(a randomized controlled trial of 11 participants in children\) is compatible with no difference/);
  assert.equal(r.outcomes.find(o => o.name === 'tendon healing').kind, 'preclinical');
  assert.ok(r.tensions.some(t => t.kind === 'grade_vs_estimate'));
  assert.ok(r.tensions.some(t => t.kind === 'protocols'));
  assert.match(r.snapshot.at(-1).text, /no expert has reviewed it\. Literature last checked Sep 14, 2026; 585 new candidate records await review/);
  const row = strength.studies.find(s => s.pmid === '40366059');
  assert.ok(row.limits.includes('Small sample (n=11)') && row.limits.includes('Interval includes no difference'));
  assert.equal(strength.drafted, null);
});

test('author conclusions are exact code-point spans', () => {
  const abstract = 'Background: µ-opioid 😀 data. Methods: n=12. Conclusions: Creatine did not change motor function. Funding: none.';
  const c = conclusionExcerpt(abstract);
  assert.match(c.text, /^Creatine did not change motor function\./);
  assert.equal(Array.from(abstract).slice(c.start, c.end).join(''), c.text);
  assert.equal(c.basis, 'Author conclusion in the abstract');
  const closing = conclusionExcerpt('We enrolled 40 adults. Strength rose more with creatine than placebo.');
  assert.equal(closing.text, 'Strength rose more with creatine than placebo.');
  assert.equal(closing.basis, 'Closing sentence of the abstract');
  assert.equal(conclusionExcerpt('Methods only, and the retained text stops mid-sentence without'), null);
});

test('effect words respect measure families', () => {
  const hr = measureFamily('hazard ratio');
  assert.equal(describeEffect({ fam: hr, point: 0.85, lower: 0.78, upper: 0.93 }).magnitude, '15% lower hazard');
  assert.equal(describeEffect({ fam: hr, point: 1.02, lower: 0.9, upper: 1.1 }).side, 'includes');
  assert.match(describeEffect({ fam: measureFamily('Δ C-index'), point: 0.0004, lower: 0, upper: 0.0008 }).magnitude, /C-index gain of 0.0004/);
  assert.equal(describeEffect({ fam: measureFamily('Partial η²'), point: 0.029 }).side, null);
  assert.equal(measureFamily('Standardized mean difference').key, 'smd');
  assert.equal(summarizeSides([{ fam: hr, lower: 0.5, upper: 0.9 }, { fam: hr, lower: 1.1, upper: 1.4 }]).consistency, 'conflicting');
  assert.deepEqual([0, 1, 2, 3, 9, 10].map(coverageBand), ['none', 'thin', 'thin', 'some', 'some', 'dense']);
});

test('ages are not reported as durations', () => {
  const source = 'Creatine in older adults\nAdults aged ≥50 years trained for 12 weeks; follow-up lasted 2 years.';
  const at = text => ({ text, start: Array.from(source).join('').indexOf(text), end: source.indexOf(text) + text.length });
  assert.deepEqual(mentionTexts({ follow_up: [at('50 years'), at('12 weeks'), at('2 years')] }, 'follow_up', source), ['12 weeks', '2 years']);
});

test('study limits flag small samples and surrogate endpoints', () => {
  const limits = studyLimits({ layer: 'interventional', n: 20, outcome: 'intra-erythrocytic creatine concentration' });
  assert.ok(limits.includes('Small sample (n=20)'));
  assert.ok(limits.includes('Measured a laboratory or intermediate marker, not a clinical outcome'));
  assert.equal(limits.at(-1), 'Risk of bias not assessed');
});

test('non-directional trial measures cannot read as improvement', () => {
  const fam = measureFamily('Partial η²');
  const line = groupMeaning({ mode: 'Treatment outcomes', fam, estimates: [{ fam, point: 0.029, design: 'Randomized crossover controlled trial', population: '123 participants', exposure: 'Creatine 5 g/day', comparator: 'Placebo', quote: 'q' }] }, { name: 'creatine', type: 'intervention', outcome: 'Backward digit span' });
  assert.equal(line.kind, 'uncertain');
  assert.match(line.text, /cannot show whether backward digit span improved/);
});
