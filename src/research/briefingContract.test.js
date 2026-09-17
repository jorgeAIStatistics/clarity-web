// The briefing is the product. These lock the two promises it makes: that the chips describing the
// question agree with the paragraphs answering it, and that a drug trial is never dressed as
// evidence that measuring something helps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO, detectIntents, coverageMatrix, publishedEstimates, briefing, entityBriefs } from './questionMap.js';

const apobResult = {
  entities: [{ id: 'entity:apob', name: 'ApoB', entity_type: 'biomarker', path: '/biomarkers/apob', matched_aliases: ['ApoB'] },
             { id: 'entity:ldl-c', name: 'LDL-C', entity_type: 'biomarker', path: '/biomarkers/ldl-c', matched_aliases: ['LDL-C'] }],
  studies: [
    { id: 'pmid:31216866', pmid: '31216866', layer: 'observational', design: 'Prospective cohort', title: 'Comparison of Conventional Lipoprotein Tests and Apolipoproteins', entity_ids: ['entity:apob'],
      findings: [{ outcome: 'Incremental CVD discrimination', effect: { measure: 'C-index change', estimate: 0.0004, lower: 0, upper: 0.0008, confidence_level: 95, origin: 'reported' }, quote: 'C-index change, 0.0004', entity_ids: ['entity:apob'] }] },
    { id: 'pmid:28304224', pmid: '28304224', layer: 'interventional', design: 'Randomized controlled trial', title: 'Evolocumab and Clinical Outcomes in Patients with Cardiovascular Disease.', entity_ids: ['entity:ldl-c'],
      findings: [{ outcome: 'Cardiovascular events', effect: { measure: 'hazard ratio', estimate: 0.85, lower: 0.79, upper: 0.92, confidence_level: 95, origin: 'reported' }, quote: 'hazard ratio, 0.85', entity_ids: ['entity:ldl-c'] }] },
  ],
};

test('the ApoB question asks about prediction and utility, whatever the parser returned', () => {
  const asked = key => detectIntents(DEMO.question).find(i => i.key === key).asked;
  assert.equal(asked('prediction'), true, 'the question says "predicting" and "beyond LDL-C"');
  assert.equal(asked('utility'), true, 'the question says "acting on ApoB improves outcomes (clinical utility)"');

  // The engine's parse is a second reading of the same text, not a replacement for it. A parse that
  // drops prediction used to win outright, leaving "Prediction · not asked" directly above a
  // briefing paragraph about C-index gains.
  const dropped = detectIntents(DEMO.question, [], null, ['association', 'utility']);
  assert.equal(dropped.find(i => i.key === 'prediction').asked, true, 'the question text still names it');

  // A researcher's own edit is their answer and stands alone, in both directions.
  const edited = detectIntents(DEMO.question, [], ['association']);
  assert.equal(edited.find(i => i.key === 'prediction').asked, false);
  assert.equal(edited.find(i => i.key === 'association').asked, true);
});

test('a drug trial is reported as a drug trial, never as evidence that measuring helps', () => {
  const matrix = coverageMatrix(apobResult, DEMO.question);
  const estimates = publishedEstimates(apobResult, {});
  const brief = briefing({ result: apobResult, matrix, intents: detectIntents(DEMO.question), estimates,
                           questionFields: { population: ['adults without cardiovascular disease'], outcomes: ['cardiovascular events'] } });
  const text = brief.sentences.map(s => s.text).join(' ');
  assert.match(text, /C-index by at most 0\.0004 on a 0\.5–1 scale/, 'prediction is answered with its own measure');
  assert.match(text, /Being associated with risk and improving a risk model are different results\./);
  assert.match(text, /No retrieved record tests ApoB-guided care/, 'the utility rung is reported empty');
  assert.match(text, /Evolocumab and Clinical Outcomes/, 'and the trial is named as the drug trial it is');
  const utilitySentence = brief.sentences.find(s => s.kind === 'utility_gap');
  assert.ok(utilitySentence, 'an empty utility rung must be stated, not left silent');
  assert.doesNotMatch(utilitySentence.text, /ApoB improves outcomes\b(?!.*trial)/);
});

// IL-18's indexed findings are all from adult-onset Still's disease. A question about radiotherapy
// pain must be told that plainly rather than shown Still's-disease numbers as if they answered it.
const il18Rows = ['clinical disease activity', 'active disease at 12 months', 'MAS development within 24 months'].map((target, i) => ({
  id: `obs:${i}`, entity_id: 'entity:il-18', kind: i ? 'discrimination' : 'association', measure: i ? 'auc' : 'correlation',
  estimate: i ? 0.9 : 0.62, target, population: 'biologic-naive patients with SD', layer: 'observational',
  pmid: '41399151', quote: 'in biologic-naive patients with SD', review_state: 'automated',
}));
const il18Result = {
  entities: [{ id: 'entity:il-18', name: 'IL-18', entity_type: 'biomarker', path: '/biomarkers/il-18', aliases: ['Interleukin-18'], matched_aliases: ['Interleukin-18'] }],
  studies: [], graph_findings: il18Rows,
  copilot: { question: { outcomes: ['radiotherapy-related pain'] } },
};

test('an IL-18 question about radiotherapy pain is told what the library actually holds', () => {
  const question = 'Interleukin-18 as a Potential Biomarker for Radiotherapy-Related Pain in Breast Cancer';
  const [brief] = entityBriefs({ result: il18Result, matrix: coverageMatrix(il18Result, question), estimates: [] });
  assert.equal(brief.name, 'IL-18');
  assert.match(brief.scope, /Still|IL-1|\bSD\b/, 'the scope sentence must name the population the findings came from');
  assert.match(brief.scope, /absence is not evidence against them/i);
  assert.ok(brief.missing.includes('Clinical utility'), 'the utility rung is not in this library');
  assert.ok(!brief.inLibrary.includes('Clinical utility'));
  assert.ok(brief.q4.some(k => k.kind === 'discrimination'), 'what is indexed is still reported');
});

test('a question whose entity has nothing indexed says so instead of going quiet', () => {
  const bare = { entities: [{ id: 'entity:msi', name: 'MSI', entity_type: 'biomarker', path: '/biomarkers/msi', matched_aliases: ['MSI'] }], studies: [], graph_findings: [] };
  const [brief] = entityBriefs({ result: bare, matrix: coverageMatrix(bare, 'Does MSI predict response?'), estimates: [] });
  assert.equal(brief.source, 'none');
  assert.match(brief.q4[0].text, /No finding for MSI is in this library/);
});
