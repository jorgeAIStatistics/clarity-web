import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEMO, BUSY_MESSAGE, mapFailure, findingLine, detectIntents, coverageMatrix, publishedEstimates, outcomeOptions, landscapePanels, mapTensions, nextStep, composeQuery, referenceOnly, sameOutcome, briefing, predictionRows, predictionReading, entityBriefs, estimateRows } from './questionMap.js';
import { forestCaption } from './figureModel.js';
import { readResultTable, parseEstimateCell, parseInterval } from './resultTable.js';

const snapshot = JSON.parse(fs.readFileSync(new URL('../../public/visual-evidence.json', import.meta.url))).profiles;
const demoTable = fs.readFileSync(new URL('../../public/examples/apob-question-demo.csv', import.meta.url), 'utf8');
const LAYER_KEYS = ['mechanism', 'preclinical', 'observational', 'interventional', 'guidelines'];
const cells = (counts, directions = {}) => Object.fromEntries(LAYER_KEYS.map(l => [l, { count: counts[l] || 0, reviewed: 0, directions: directions[l] || {}, examples: counts[l] ? [{ id: `pmid:${l}`, title: l }] : [] }]));
const result = {
  entities: [
    { id: 'entity:apob', name: 'ApoB', entity_type: 'biomarker', path: '/biomarkers/apob', matched_aliases: ['ApoB'] },
    { id: 'entity:ldl-c', name: 'LDL-C', entity_type: 'biomarker', path: '/biomarkers/ldl-c', matched_aliases: ['LDL-C'] },
    { id: 'entity:lpa', name: 'Lipoprotein(a)', entity_type: 'biomarker', path: '/biomarkers/lpa', matched_aliases: [] },
  ],
  layer_coverage: { basis: 'All linked records', entities: {
    'entity:apob': { cells: cells({ observational: 2, interventional: 1, guidelines: 1 }, { observational: { above: 1, includes: 1 }, interventional: { below: 1 } }), syntheses: 1 },
    'entity:ldl-c': { cells: cells({ observational: 2, interventional: 4 }), syntheses: 1 },
    'entity:lpa': { cells: cells({}), syntheses: 0 },
  } },
  studies: [{ id: 'pmid:38700053', pmid: '38700053', url: 'https://pubmed.ncbi.nlm.nih.gov/38700053/', layer: 'observational', design: 'Prospective cohort', entity_ids: ['entity:apob'], findings: [{ outcome: 'Cardiovascular events', effect: { measure: 'hazard ratio', estimate: 1.04, lower: 1.03, upper: 1.06, confidence_level: 95, origin: 'reported' }, quote: 'hazard ratio 1.04', entity_ids: ['entity:apob'] }] }],
  copilot: { question: { population: ['adults without cardiovascular disease'], outcomes: ['cardiovascular events'], focus: [{ id: 'incremental' }] }, groups: [{ id: 'utility', study_ids: [] }], tensions: [] },
};

test('the demo table is read without edits and keeps question types apart', () => {
  const upload = readResultTable(demoTable);
  assert.deepEqual(upload.needs, []);
  assert.equal(upload.placeable.length, 2);
  assert.deepEqual(upload.rows.map(r => [r.fam.key, r.mode, r.n]), [['hr', 'Association', 5120], ['c_index_change', 'Prediction', 5120]]);
});

test('the demo question asks association, utility and guidance but not mechanism', () => {
  const intents = Object.fromEntries(detectIntents(DEMO.question).map(i => [i.key, i.asked]));
  assert.deepEqual(intents, { association: false, prediction: true, utility: true, mechanism: false, guideline: true, enrichment: false });
  const il18 = Object.fromEntries(detectIntents('Interleukin-18 as a Potential Biomarker for Radiotherapy-Related Pain in Breast Cancer: Implications for Personalized Pain Management').map(i => [i.key, i.asked]));
  assert.deepEqual(il18, { association: true, prediction: false, utility: true, mechanism: false, guideline: false, enrichment: false });
  assert.ok(detectIntents('plasma NfL / ALS progression / trial enrichment').filter(i => i.asked).map(i => i.key).join() === 'prediction,enrichment');
  assert.deepEqual(detectIntents(DEMO.question, [], ['mechanism']).filter(i => i.asked).map(i => i.key), ['mechanism']);
});

test('named profiles follow the order the question mentions them', () => {
  assert.deepEqual(coverageMatrix(result, 'Does LDL-C or ApoB predict events?').rows.map(r => r.id), ['entity:ldl-c', 'entity:apob', 'entity:lpa']);
  const m = coverageMatrix(result, DEMO.question);
  assert.deepEqual(m.rows.map(r => r.id), ['entity:apob', 'entity:ldl-c', 'entity:lpa']);
  const next = nextStep({ matrix: m, intents: detectIntents(DEMO.question), question: { outcomes: ['Cardiovascular events'] } });
  assert.equal(next.title, 'Test whether ApoB-guided management changes cardiovascular events');
  assert.match(next.design, /ApoB-guided versus LDL-C-guided/);
});

test('coverage uses library counts and keeps empty cells as explicit gaps', () => {
  const m = coverageMatrix(result);
  assert.equal(m.basis, 'library');
  const apob = m.rows.find(r => r.id === 'entity:apob');
  assert.equal(apob.cells.find(c => c.layer === 'observational').direction, 'mixed');
  assert.equal(apob.cells.find(c => c.layer === 'interventional').direction, 'below');
  assert.ok(m.rows.find(r => r.id === 'entity:lpa').cells.every(c => c.band === 'none' && c.review === null));
  delete result.layer_coverage.basis;
  assert.equal(coverageMatrix({ ...result, layer_coverage: undefined }).basis, 'retrieved');
});

test('user results sit on the published landscape only on a matching scale', () => {
  const estimates = publishedEstimates(result, snapshot);
  assert.equal(estimates.filter(e => e.pmid === '38700053' && e.point === 1.04).length, 1);
  const rows = readResultTable(demoTable).rows;
  const options = outcomeOptions(estimates, rows, ['cardiovascular events']);
  assert.equal(options[0].user, 1);
  const cvd = landscapePanels(estimates, 'Cardiovascular events', rows);
  const association = cvd.find(p => p.mode === 'Association' && p.fam.key === 'hr');
  assert.equal(association.user.length, 1);
  assert.match(association.comparison[0].text, /Overlap is not a formal test/);
  assert.ok(cvd.filter(p => p.mode === 'Treatment outcomes').every(p => p.user.length === 0));
  const discrimination = landscapePanels(estimates, 'Incremental CVD discrimination', rows);
  assert.equal(discrimination.find(p => p.fam.key === 'c_index_change').user.length, 1);
});

test('tensions tie to cells and the next step targets the utility gap', () => {
  const matrix = coverageMatrix(result), intents = detectIntents(DEMO.question), estimates = publishedEstimates(result, snapshot);
  const tensions = mapTensions({ matrix, intents, estimates, result });
  const gap = tensions.find(t => t.kind === 'utility_gap');
  assert.equal(gap.cell.layer, 'interventional');
  assert.ok(tensions.some(t => t.kind === 'association_vs_prediction'));
  assert.ok(tensions.length <= 5);
  const next = nextStep({ matrix, intents, estimates, question: result.copilot.question, utilityRecords: 0 });
  assert.match(next.title, /ApoB-guided management/);
  assert.match(next.stratum, /ApoB and LDL-C results disagree/);
  assert.match(next.note, /not a protocol and not clinical advice/);
});

test('queries carry table outcomes and references are detected', () => {
  const q = composeQuery('ApoB and cardiovascular events', { rows: [{ outcome: 'Cardiovascular events' }] });
  assert.match(q, /outcome: Cardiovascular events/);
  assert.match(composeQuery('ApoB question', { edits: { population: 'older adults', outcome: 'stroke', intents: ['guideline'] } }), /context: older adults\noutcome: stroke\nFocus: guidelines\./);
  assert.ok(referenceOnly('PMID 38700053') && referenceOnly('10.1093/eurheartj/ehae258') && !referenceOnly('ApoB and LDL-C'));
  assert.ok(sameOutcome('Major adverse cardiovascular events', 'Major cardiovascular events'));
});

test('messy tables: combined cells, header measures, refusals and precise problems', () => {
  assert.deepEqual(parseEstimateCell('1.21 (1.08–1.36)'), { point: 1.21, level: null, lower: 1.08, upper: 1.36 });
  assert.deepEqual(parseEstimateCell('0.19 [95% CI −0.71 to 1.08]'), { point: 0.19, level: 95, lower: -0.71, upper: 1.08 });
  assert.deepEqual(parseInterval('(-1.2, 0.2)'), { lower: -1.2, upper: 0.2 });
  const combined = readResultTable('Endpoint,HR (95% CI),Group\nStroke,"1.21 (1.08-1.36)",Adults\n');
  assert.equal(combined.placeable.length, 1);
  assert.equal(combined.rows[0].fam.key, 'hr');
  assert.equal(combined.rows[0].level, 95);
  assert.match(readResultTable('patient_id,Outcome,HR\n1,Stroke,1.2\n').error, /identifiers/);
  const bad = readResultTable('Outcome,Measure,Estimate,Lower,Upper\nStroke,HR,1.5,1.6,1.9\nFalls,Widgets,2,1,3\n');
  assert.deepEqual(bad.rows.map(r => r.issues[0]), ['Interval does not contain the estimate', 'Effect measure “Widgets” not recognized']);
  assert.match(readResultTable('Marker,Value\nApoB,1.2\n').needs.join(' '), /outcome/);
  assert.match(readResultTable(`Outcome,HR\n${'Stroke,1.1\n'.repeat(201)}`).error, /row-level data/);
});

test('retrieved papers with no resolved entity become one temporary row, not an empty map', () => {
  const m = coverageMatrix({ entities: [], studies: [{ id: 'pmid:1', layer: 'observational', title: 'IL-18 and pain', findings: [] }, { id: 'pmid:2', layer: 'interventional', title: 'Trial', findings: [] }] });
  assert.equal(m.rows.length, 1);
  assert.ok(m.rows[0].temporary);
  assert.deepEqual(m.rows[0].cells.map(c => c.count), [0, 0, 1, 1, 0]);
  assert.equal(coverageMatrix({ entities: [], studies: [] }).rows.length, 0);
});

test('overload and network failures become a retryable busy message; request errors keep their explanation', () => {
  for (const status of [429, 502, 504]) assert.deepEqual(mapFailure({ status }), { retry: true, message: BUSY_MESSAGE });
  assert.deepEqual(mapFailure({ status: 503, data: { code: 'busy', error: 'The evidence map is busy.' } }), { retry: true, message: BUSY_MESSAGE });
  assert.deepEqual(mapFailure({ error: new TypeError('Failed to fetch') }), { retry: true, message: BUSY_MESSAGE });
  assert.match(mapFailure({ error: Object.assign(new Error('x'), { name: 'AbortError' }) }).message, /too long/);
  assert.deepEqual(mapFailure({ status: 400, data: { error: 'Enter between 20 and 12,000 characters.' } }), { retry: false, message: 'Enter between 20 and 12,000 characters.' });
});

test('drill-down lines name the observation type and keep accuracy and cut-off findings', () => {
  assert.equal(findingLine({ observation_type: 'classification', outcome: 'neuroendocrine neoplasms', effect: { measure: 'sensitivity', estimate: 71 }, threshold: 100, threshold_unit: 'ng/mL' }), 'Classification · neuroendocrine neoplasms: Sensitivity 71 at a cut-off of 100 ng/mL');
  assert.equal(findingLine({ observation_type: 'prognosis', outcome: 'overall survival', effect: { measure: 'hazard ratio', estimate: 2.1, lower: 1.3, upper: 3.4, confidence_level: 95 } }), 'Prognosis · overall survival: HR 2.1 (95% CI 1.3 to 3.4)');
  assert.equal(findingLine({ observation_type: 'guideline', outcome: 'Guidelines recommend CgA for monitoring', effect: { measure: 'recommendation' }, statement: 'Guidelines recommend CgA for monitoring' }), 'Guideline · Guidelines recommend CgA for monitoring: Guidelines recommend CgA for monitoring');
});

const predictionStudy = { id: 'pmid:31216866', pmid: '31216866', url: 'https://pubmed.ncbi.nlm.nih.gov/31216866/', layer: 'observational', design: 'Prospective cohort', title: 'Comparison of Conventional Lipoprotein Tests and Apolipoproteins', entity_ids: ['entity:apob'],
  findings: [{ outcome: 'Incremental CVD discrimination', effect: { measure: 'C-index change', estimate: 0.0004, lower: 0, upper: 0.0008, confidence_level: 95, units: 'addition of ApoB', origin: 'reported' }, quote: 'C-index change, 0.0004; 95% CI, 0.0000, 0.0008', entity_ids: ['entity:apob'] }] };
const trialStudy = { id: 'pmid:28304224', pmid: '28304224', url: 'https://pubmed.ncbi.nlm.nih.gov/28304224/', layer: 'interventional', design: 'Randomized controlled trial', title: 'Evolocumab and Clinical Outcomes in Patients with Cardiovascular Disease.', entity_ids: ['entity:ldl-c'],
  findings: [{ outcome: 'Cardiovascular events', effect: { measure: 'hazard ratio', estimate: 0.85, lower: 0.79, upper: 0.92, confidence_level: 95, origin: 'reported' }, quote: 'hazard ratio, 0.85', entity_ids: ['entity:ldl-c'] }] };
const briefFixture = { ...result, studies: [...result.studies, predictionStudy, trialStudy] };

test('the briefing answers the asked intents, separates treatment trials from utility, and states what is empty', () => {
  const matrix = coverageMatrix(briefFixture, DEMO.question), intents = detectIntents(DEMO.question);
  const estimates = publishedEstimates(briefFixture, {});
  const brief = briefing({ result: briefFixture, matrix, intents, estimates, questionFields: { population: ['adults without cardiovascular disease'], outcomes: ['cardiovascular events'] } });
  assert.ok(brief.sentences.length >= 5 && brief.sentences.length <= 10, `sentences: ${brief.sentences.length}`);
  const kinds = brief.sentences.map(s => s.kind);
  for (const kind of ['question', 'association', 'prediction', 'utility_gap', 'guideline', 'gap', 'review']) assert.ok(kinds.includes(kind), `missing ${kind}`);
  const text = brief.sentences.map(s => s.text).join(' ');
  assert.match(text, /C-index by at most 0\.0004 on a 0\.5–1 scale/);
  assert.match(text, /No retrieved record tests ApoB-guided care/);
  assert.match(text, /Evolocumab and Clinical Outcomes/);
  assert.match(text, /Empty in this index: guidance for LDL-C/);
  // No placeholder template, and the outcome is never repeated a third time.
  assert.doesNotMatch(text, /the concepts you named|population to specify|outcome to specify/);
  assert.ok((text.match(/cardiovascular events/gi) || []).length <= 2);
  assert.equal(briefing({ matrix: { rows: [] } }), null);
});

test('prediction estimates get their own panel, not a forest row, and carry their limits', () => {
  const rows = predictionRows(publishedEstimates(briefFixture, {}));
  assert.deepEqual(rows.map(r => [r.key, r.point, r.side, r.added]), [['c_index_change', 0.0004, 'includes', 'addition of ApoB']]);
  const reading = predictionReading(rows);
  assert.match(reading.sentences[0], /0\.5 is chance/);
  assert.match(reading.sentences[2], /does not show calibration/);
  assert.match(reading.limits, /never pooled/);
  assert.equal(predictionReading([]), null);
  assert.equal(predictionRows([{ fam: { key: 'hr' }, point: 1.2, quote: 'x' }]).length, 0);
});

test('a treatment forest says in its caption that it is not marker-guided care', () => {
  const estimates = publishedEstimates(briefFixture, {});
  const [panel] = landscapePanels(estimates, 'Cardiovascular events', [], { marker: 'ApoB' }).filter(p => p.mode === 'Treatment outcomes');
  assert.match(forestCaption(panel), /not evidence that ApoB-guided care improves outcomes/);
  const association = landscapePanels(estimates, 'Cardiovascular events', [], { marker: 'ApoB' }).find(p => p.mode === 'Association');
  assert.doesNotMatch(forestCaption(association), /ApoB-guided/);
});

test('each mentioned entity gets the profile contract: Q4 by kind, Q5, and a library ladder', () => {
  const matrix = coverageMatrix(briefFixture, DEMO.question);
  const estimates = publishedEstimates(briefFixture, {});
  const [apob] = entityBriefs({ result: briefFixture, matrix, estimates });
  assert.equal(apob.name, 'ApoB');
  assert.equal(apob.source, 'retrieved');
  const kinds = apob.q4.map(l => l.kind);
  assert.ok(kinds.includes('discrimination') && kinds.includes('association'));
  assert.match(apob.q4.find(l => l.kind === 'discrimination').text, /moved the C-index by at most 0\.0004/);
  assert.match(apob.q5, /No indexed evidence that measuring ApoB changes decisions or outcomes/);
  assert.ok(apob.inLibrary.includes('Clinical validation') && apob.inLibrary.includes('Incremental value'));
  assert.ok(apob.missing.includes('Clinical utility'));
});

test('typed graph findings win over retrieved estimates, and scope is stated only when the indication differs', () => {
  const matrix = coverageMatrix(briefFixture, DEMO.question);
  const graph = { ...briefFixture, graph_findings: [
    { id: 'g1', entity_id: 'entity:apob', kind: 'association', measure: 'hazard_ratio', estimate: 1.2, target: 'cardiovascular events', population: 'adults without cardiovascular disease', layer: 'observational', quote: 'HR 1.2', pmid: '1' },
  ] };
  const [brief] = entityBriefs({ result: graph, matrix, estimates: publishedEstimates(briefFixture, {}) });
  assert.deepEqual([brief.source, brief.findings], ['graph', 1]);
  assert.equal(brief.scope, null, 'the finding is about the outcome that was asked');
  const offTopic = { ...graph, graph_findings: [{ ...graph.graph_findings[0], id: 'g2', target: 'chronic-persistent course', population: 'biologic-naive patients with Still disease' }] };
  const [scoped] = entityBriefs({ result: offTopic, matrix, estimates: [] });
  assert.match(scoped.scope, /Indexed evidence is currently from biologic-naive patients with Still disease/);
});

test('estimate rows carry the contract vocabulary, not the figure vocabulary', () => {
  const rows = estimateRows(publishedEstimates(briefFixture, {}), 'entity:apob');
  const measures = rows.map(r => [r.finding.kind, r.finding.measure]);
  assert.ok(measures.some(([kind, measure]) => kind === 'discrimination' && measure === 'delta_c_index'));
  assert.ok(measures.some(([kind, measure]) => kind === 'association' && measure === 'hazard_ratio'));
  assert.deepEqual(estimateRows([], 'entity:apob'), []);
});
