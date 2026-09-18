import test from 'node:test';
import assert from 'node:assert/strict';
import { valueText, flatten, groupFindings, aucStrip, classificationRows, relationLabel, deadLetterText, graphMatches, objectKind, findingsCsv, findingsJson, graphPrefixes, routeTypes, EXPORT_COLUMNS, identity, biology, measurement, meaning, utility, ladder, scopeNote, questions, shouldRetry, RETRY_DELAYS, fetchWithRetry, externalLinks, idCaption, kindBadge, freshness, diagnose } from './graphProfile.js';

const row=(finding,extra={})=>({finding,quote:'At a cut-off of 100 ng/mL, CgA had a sensitivity of 71%.',pmid:'1',title:'SYNTHETIC',year:2024,layer:'observational',study_id:'pmid:1',...extra});
const sens={id:'obs:1',kind:'classification',measure:'sensitivity',estimate:71,unit:'%',cutoff:100,cutoff_unit:'ng/mL',target:'neuroendocrine neoplasms',assay:'Serum CgA'};
const spec={...sens,id:'obs:2',measure:'specificity',estimate:85};
const auc={id:'obs:3',kind:'discrimination',measure:'auc',estimate:0.82,lower:0.76,upper:0.88,level:95,target:'neuroendocrine neoplasms'};
const hr={id:'obs:4',kind:'prognosis',measure:'hazard_ratio',estimate:0.62,lower:0.48,upper:0.8,level:95,target:'progression-free survival'};

test('small values keep their digits instead of rounding to zero',()=>{
  assert.equal(valueText({measure:'delta_c_index',estimate:0.0004}),'Δ C-index 0.0004');
  assert.equal(valueText({measure:'auc',estimate:0.82}),'AUC 0.82');
  assert.equal(valueText({measure:'median',estimate:61425,unit:'pg/mL'}),'Median 61,425 pg/mL');
  // A descriptive clause in the unit field is not a unit and is dropped, not printed beside the number.
  assert.equal(valueText({measure:'hazard_ratio',estimate:0.85,unit:'median 2.8-year follow-up; lipid markers were eligibility criteria'}),'HR 0.85');
  assert.equal(valueText({measure:'hazard_ratio',estimate:0.85,unit:'per 1 SD'}),'HR 0.85 per 1 SD');
});

test('values are formatted as extracted, with interval and cut-off',()=>{
  assert.equal(valueText(sens),'Sensitivity 71% at a cut-off of 100 ng/mL');
  assert.equal(valueText(hr),'HR 0.62 (95% CI 0.48 to 0.8)');
  assert.equal(valueText({measure:'p_value',p_value:0.03,p_operator:'lt'}),'P < 0.03');
  assert.equal(valueText({measure:'other'}),'Reported measure');
});

test('rows are deduplicated by finding and grouped by kind, never merged across kinds',()=>{
  const rows=[row(sens),row(sens,{layer:'guidelines'}),row(auc),row(hr),row({id:'obs:5',measure:'odds_ratio',estimate:2})];
  assert.equal(flatten(rows).length,4);
  assert.deepEqual(groupFindings(rows).map(g=>[g.kind,g.rows.length]),[['classification',1],['discrimination',1],['prognosis',1],['other',1]]);
});

test('AUC strip uses only grounded values on the 0–1 scale',()=>{
  const strip=aucStrip([row(auc),row({...auc,id:'obs:6',estimate:82,unit:'%',lower:null,upper:null}),row({...auc,id:'obs:7'},{quote:null})]);
  assert.deepEqual(strip.points.map(p=>p.id),['obs:3']);
  assert.deepEqual(strip.domain,[0.5,1]);
  assert.deepEqual(aucStrip([row({...auc,lower:0.41})]).domain,[0,1]);
});

test('classification table pairs measures from the same study, target and cut-off',()=>{
  const table=classificationRows([row(sens),row(spec),row({...sens,id:'obs:8',cutoff:200,estimate:40})]);
  assert.equal(table.rows.length,2);
  assert.deepEqual(table.rows[0].values,{sensitivity:'71%',specificity:'85%'});
  assert.deepEqual(table.columns.map(([m])=>m),['sensitivity','specificity']);
});

test('relations and dead-letters read in plain language',()=>{
  assert.equal(relationLabel({edge:'VARIANT_OF',outgoing:false}),'Has variant');
  assert.equal(relationLabel({edge:'ENCODED_BY',outgoing:true}),'Encoded by');
  assert.equal(relationLabel({edge:'RELATED_TO',reason:'same_pathway'}),'Same pathway');
  assert.equal(deadLetterText({reasons:{rejected_missing_fields:5}}),'a measure was named, but its value or required fields were not in the passage (5×)');
  assert.equal(deadLetterText({reasons:{}}),'no typed finding passed validation');
});

test('the index search matches graph entities by name, alias or category and ranks findings first', () => {
  const rows = [
    { id: 'graph:biomarker:ca-125', name: 'CA-125', category: 'Molecular marker', aliases: ['CA125'], coverage: { quantified_outcomes: 0 } },
    { id: 'graph:variant:egfr-activating-mutation', name: 'EGFR activating mutation', category: 'Variant', aliases: ['EGFR mutation'], coverage: { quantified_outcomes: 2 } },
    { id: 'graph:biomarker:chromogranin-a', name: 'Chromogranin A', category: 'Molecular marker', aliases: ['CgA'], coverage: { quantified_outcomes: 2 } },
  ];
  assert.deepEqual(graphMatches(rows).map(r => r.name), ['Chromogranin A', 'EGFR activating mutation', 'CA-125']);
  assert.deepEqual(graphMatches(rows, 'cga').map(r => r.name), ['Chromogranin A']);
  assert.deepEqual(graphMatches(rows, 'EGFR mutation').map(r => r.name), ['EGFR activating mutation']);
  assert.deepEqual(graphMatches(rows, 'variant').map(r => r.name), ['EGFR activating mutation']);
  assert.deepEqual(graphMatches(null, 'x'), []);
});

test('the page states what the object is and keeps gene, variant and protein apart', () => {
  assert.equal(objectKind({ kind: 'Variant' }).label, 'Variant');
  assert.match(objectKind({ kind: 'Variant' }).text, /does not carry to the gene as a whole/);
  assert.match(objectKind({ type: 'gene' }).text, /not findings about one of its variants/);
  assert.equal(objectKind({}).label, 'Entity');
});

test('findings export as one row per finding with quotes escaped', () => {
  const entity = { id: 'biomarker:chromogranin-a', name: 'Chromogranin A' };
  const csv = findingsCsv(entity, [row(sens), row(spec), row(sens)]);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], EXPORT_COLUMNS.join(','));
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^biomarker:chromogranin-a,Chromogranin A,obs:1,classification,sensitivity,71,/);
  // The passage holds a comma, so it must survive as one quoted CSV field.
  assert.match(lines[1], /,"At a cut-off of 100 ng\/mL, CgA had a sensitivity of 71%\."$/);
  assert.equal(findingsCsv({ id: 'x', name: 'He said "hi", loudly' }, []).trim().split('\n').length, 1);
  const parsed = JSON.parse(findingsJson(entity, [row(sens)], [{ layer: 'observational', n_findings: 1 }]));
  assert.equal(parsed.version, 'clarity-graph-findings-v1');
  assert.deepEqual([parsed.entity.id, parsed.findings.length, parsed.layers[0].layer], ['biomarker:chromogranin-a', 1, 'observational']);
});

test('each index route resolves only its own kinds', () => {
  assert.deepEqual(graphPrefixes('biomarker'), ['biomarker', 'variant', 'gene', 'protein', 'metabolite']);
  assert.deepEqual(graphPrefixes('diagnostic'), ['test', 'assay']);
  assert.deepEqual(graphPrefixes('precision_oncology'), ['precision_context']);
  assert.deepEqual(graphPrefixes('unknown'), graphPrefixes('biomarker'));
  assert.deepEqual(routeTypes('tests'), ['diagnostic', 'screening']);
  assert.deepEqual(routeTypes('precision-medicine'), ['precision_oncology']);
  assert.deepEqual(routeTypes('explore'), []);
});

// Fixtures mirror what the graph actually holds for these two pages.
const IL18 = {
  entity: { id: 'biomarker:il-18', name: 'IL-18', kind: 'Biomarker', aliases: ['IL-18', 'Interleukin-18'],
    identity: { entity_class: 'Cytokine (IL-1 family protein)', specimen: 'Serum or plasma', assay_hint: 'Immunoassay (ELISA)',
      pathway_note: 'Interleukin-18 is an IL-1 family cytokine released after inflammasome activation; it drives interferon-γ production.' } },
  rows: [
    { finding: { id: 'a1', kind: 'association', measure: 'odds_ratio', estimate: 25.6, target: 'clinical disease activity', population: 'biologic-naive patients with SD', assay: 'Plasma IL-18 levels' }, layer: 'observational', quote: 'odds ratio 25.6', pmid: '41399151' },
    { finding: { id: 'a2', kind: 'association', measure: 'median', estimate: 61425, unit: 'pg/mL', target: 'active disease', population: 'biologic-naive patients with SD', assay: 'Plasma IL-18 levels' }, layer: 'observational', quote: 'Median baseline IL-18 levels were 61,425 pg/mL', pmid: '41399151' },
    { finding: { id: 'd1', kind: 'discrimination', measure: 'auc', estimate: 0.92, target: 'chronic-persistent course', population: 'biologic-naive patients with SD', assay: 'Plasma IL-18 levels' }, layer: 'observational', quote: 'AUC 0.92', pmid: '41399151' },
    { finding: { id: 'd2', kind: 'discrimination', measure: 'auc', estimate: 0.73, target: 'MAS development within 24 months', population: 'biologic-naive patients with SD', assay: 'Plasma IL-18 levels' }, layer: 'observational', quote: 'AUC 0.73', pmid: '41399151' },
  ],
};
const CA125 = {
  entity: { id: 'biomarker:ca-125', name: 'CA-125', kind: 'Biomarker', aliases: ['CA-125', 'CA125'],
    identity: { entity_class: 'Glycoprotein antigen (MUC16 protein)', specimen: 'Serum', pathway_note: 'CA-125 is the MUC16 mucin shed by coelomic epithelium; it rises with peritoneal irritation of any cause.' } },
  rows: [
    { finding: { id: 'c1', kind: 'classification', measure: 'sensitivity', estimate: 79, unit: '%', cutoff: 35, cutoff_unit: 'U/mL', target: 'ovarian malignancy', population: 'women with an adnexal mass' }, layer: 'observational', quote: 'sensitivity of 79%', pmid: '40590284' },
  ],
};

test('Q1 names the class from curated identity, not the generic kind sentence', () => {
  const q1 = identity(IL18.entity, [{ edge: 'ENCODED_BY', id: 'gene:il18', name: 'IL18 gene', kind: 'Gene', outgoing: true }]);
  assert.equal(q1.label, 'Cytokine (IL-1 family protein)');
  assert.equal(q1.text, 'IL-18 is a cytokine (IL-1 family protein).');
  // A curated sentence wins over the assembled one, so a pair reads like a clinician's sentence.
  assert.equal(identity({ name: 'RET × selpercatinib', identity: { entity_class: 'Marker-and-treatment pair', identity_sentence: 'Treating RET-driven cancers with selpercatinib.' } }).text, 'Treating RET-driven cancers with selpercatinib.');
  assert.equal(q1.specimen, 'Serum or plasma');
  assert.deepEqual(q1.molecular.map(m => m.id), ['gene:il18']);
  assert.doesNotMatch(q1.text, /a quantity measured in a sample/i);
  assert.equal(identity({ kind: 'Biomarker', name: 'X' }).curated, false);
});

test('Q2 separates indexed mechanism findings from curated background and from silence', () => {
  assert.equal(biology(IL18.entity, IL18.rows).state, 'background');
  assert.match(biology(IL18.entity, IL18.rows).text, /inflammasome/);
  const withMechanism = biology(IL18.entity, [...IL18.rows, { finding: { id: 'm1', kind: 'association' }, layer: 'mechanism', quote: 'in vitro' }]);
  assert.equal(withMechanism.state, 'indexed');
  const bare = biology({ name: 'CA-125' }, []);
  assert.deepEqual([bare.state, /Biology not indexed/.test(bare.text)], ['empty', true]);
});

test('Q3 reports the assay, and names a missing assay as the analytical-validity gap', () => {
  const q3 = measurement(IL18.entity, IL18.rows);
  assert.deepEqual(q3.assays, ['Plasma IL-18 levels']);
  assert.equal(q3.gap, false);
  const noAssay = measurement(CA125.entity, CA125.rows);
  assert.equal(noAssay.gap, true);
  assert.match(noAssay.text, /analytical-validity gap/);
});

test('Q4 computes one subhead per kind present, and IL-18 does not read like CA-125', () => {
  const il18 = meaning(IL18.entity, IL18.rows);
  assert.deepEqual(il18.map(s => s.kind), ['discrimination', 'association']);
  const text = il18.flatMap(s => s.sentences).join(' ');
  assert.match(text, /odds ratio 25.6/);
  assert.match(text, /median 61,425 pg\/mL for active disease/);
  assert.match(text, /AUC 0.73 to 0.92/);
  assert.match(text, /overlap/i);
  assert.ok(il18.every(s => s.sentences.length <= 3));
  const ca125 = meaning(CA125.entity, CA125.rows).flatMap(s => s.sentences).join(' ');
  assert.match(ca125, /cut-off \(35 U\/mL\)/);
  assert.notEqual(text, ca125);
  assert.doesNotMatch(text, /CA-125/);
});

test('a percent-scale AUC and a bare cut-off are read on their own terms', () => {
  const psa = { entity: { name: 'PSA', kind: 'Biomarker' }, rows: [
    { finding: { id: 'p1', kind: 'discrimination', measure: 'auc', estimate: 81.65, target: 'bone metastasis' }, quote: 'AUC 81.65%', pmid: '40792342' },
    { finding: { id: 'p2', kind: 'classification', measure: 'cutoff', estimate: 18.95, unit: 'ng/mL', target: 'bone metastasis' }, quote: 'cut-off 18.95 ng/mL', pmid: '40792342' },
  ] };
  const groups = meaning(psa.entity, psa.rows);
  const discrimination = groups.find(g => g.kind === 'discrimination'), classification = groups.find(g => g.kind === 'classification');
  assert.match(discrimination.sentences[0], /AUC 81.65% on a scale where 50% is chance/);
  assert.match(classification.sentences[0], /A cut-off of 18.95 ng\/mL was used to classify bone metastasis, with no sensitivity or specificity indexed/);
  assert.equal(classification.sentences.length, 2, 'no sensitivity caveat when none is indexed');
  // A proportion-scale AUC keeps the 0.5 wording.
  const proportion = meaning({ name: 'CgA' }, [{ finding: { id: 'a1', kind: 'discrimination', measure: 'auc', estimate: 0.82, target: 'x' }, quote: 'q' }]);
  assert.match(proportion.find(g => g.kind === 'discrimination').sentences[0], /AUC 0.82 on a scale where 0.5 is chance/);
});

test('Q5 never infers utility, and the ladder marks each rung', () => {
  const q5 = utility(IL18.entity, IL18.rows);
  assert.equal(q5.state, 'empty');
  assert.match(q5.text, /No indexed evidence that measuring IL-18 changes decisions or outcomes/);
  const shown = ladder(IL18.entity, IL18.rows);
  assert.deepEqual([shown[0].status, shown[1].status], ['In this library', 'Not in this library yet']);
  assert.deepEqual([shown[1].target, shown[5].target], ['gp-q2', 'gp-q5']);
  const rungs = Object.fromEntries(shown.map(r => [r.key, r.indexed]));
  assert.deepEqual(rungs, { discovery: true, biology: false, analytical: true, clinical: true, incremental: false, utility: false });
  assert.deepEqual(ladder({}, []).map(r => r.indexed), [false, false, false, false, false, false]);
  // A guideline statement belongs in Q5, but it does not light the utility rung.
  const guidanceOnly = ladder(IL18.entity, [{ finding: { id: 'g1', kind: 'guideline', statement: 'Guidance mentions it.' }, quote: 'Guidance mentions it.' }]);
  assert.equal(guidanceOnly.find(r => r.key === 'utility').indexed, false);
  assert.equal(utility(IL18.entity, [{ finding: { id: 'g1', kind: 'guideline' }, quote: 'x' }]).state, 'indexed');
});

test('scope note names the population the evidence came from, and the questions follow the route', () => {
  assert.match(scopeNote(IL18.entity, IL18.rows), /Indexed evidence is currently from biologic-naive patients with SD/);
  assert.equal(scopeNote(IL18.entity, []), null);
  assert.equal(questions('precision_oncology')[3], 'Is it prognostic, or predictive of treatment benefit?');
  assert.equal(questions('diagnostic')[4], 'Does using the test change outcomes or harms?');
  assert.equal(questions('anything')[0], 'What is it?');
});

test('a restarting engine is retried; an answer is not', () => {
  for (const transient of ['network', 502, 503, 504, 429, 500]) assert.equal(shouldRetry(transient), true, String(transient));
  // 404 means no such entity and 400 means a bad request: retrying either just repeats the answer.
  for (const answer of [404, 400, 401, 403, 422]) assert.equal(shouldRetry(answer), false, String(answer));
  assert.equal(RETRY_DELAYS.length, 2, 'three attempts in total');
  assert.ok(RETRY_DELAYS.every(ms => ms >= 1000) && RETRY_DELAYS.at(-1) <= 10000);
  assert.ok(RETRY_DELAYS[1] > RETRY_DELAYS[0], 'the wait grows');
});

test('the retry loop recovers from a restarting engine and gives up on an answer', async () => {
  const slept = [], sleep = ms => { slept.push(ms); return Promise.resolve(); };
  const failing = outcome => Object.assign(new Error('request_failed'), { outcome });

  let calls = 0;
  const recovers = await fetchWithRetry(() => { calls += 1; if (calls < 3) throw failing(503); return Promise.resolve({ ok: true }); }, { sleep });
  assert.deepEqual([recovers, calls, slept], [{ ok: true }, 3, RETRY_DELAYS]);

  // Three attempts and no more, so a page never hammers an engine that stays down.
  let attempts = 0;
  await assert.rejects(fetchWithRetry(() => { attempts += 1; throw failing(502); }, { sleep, delays: [10, 20] }));
  assert.equal(attempts, 3);

  // A 404 is the answer "no such entity": it is returned to the caller at once, unretried.
  let asked = 0;
  await assert.rejects(fetchWithRetry(() => { asked += 1; throw failing(404); }, { sleep }), /request_failed/);
  assert.equal(asked, 1);

  const seen = [];
  await fetchWithRetry(() => (seen.length < 1 ? Promise.reject(failing(503)) : Promise.resolve('done')), { sleep, onRetry: n => seen.push(n) });
  assert.deepEqual(seen, [1]);
});

test('identifiers link to the registry that issued them, and the caption says what they identify', () => {
  const links = externalLinks({ external_ids: { hgnc: 'HGNC:5986', ensembl: 'ENSG00000150782', uniprot: 'Q14116' } });
  assert.deepEqual(links.map(l => [l.label, l.about]), [['HGNC', 'gene'], ['Ensembl', 'gene'], ['UniProt', 'protein']]);
  assert.equal(links[0].url, 'https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC%3A5986');
  assert.equal(links[2].url, 'https://www.uniprot.org/uniprotkb/Q14116');
  assert.deepEqual(externalLinks({}), []);
  assert.equal(externalLinks({ external_ids: { mondo: 'MONDO:0007254' } })[0].url, 'https://www.ebi.ac.uk/ols4/ontologies/mondo/classes?short_form=MONDO_0007254');
  // A variant's identifiers belong to the gene it alters; the page must not imply otherwise.
  assert.match(idCaption({ kind: 'Variant' }), /gene and protein this variant alters/);
  // A gene page shows a UniProt accession, which identifies the protein, not the gene: the caption
  // has to say so, or the same three ids would read as one object across three different pages.
  assert.match(idCaption({ kind: 'Gene' }), /the protein it encodes/);
  assert.match(idCaption({ kind: 'Gene' }), /separate objects/);
  assert.match(idCaption({ kind: 'Biomarker' }), /gene that encodes it and the protein that is measured/);
});

test('a library card says which kinds it holds and whether utility is among them', () => {
  const card = kindBadge({ coverage: { quantified_outcomes: 5 }, finding_kinds: { classification: 3, discrimination: 2 }, utility_indexed: false });
  assert.equal(card.text, '3 classification · 2 discrimination');
  assert.deepEqual([card.kinds, card.utility], [['classification', 'discrimination'], false]);
  const many = kindBadge({ coverage: { quantified_outcomes: 9 }, finding_kinds: { classification: 4, prognosis: 3, association: 1, guideline: 1 }, utility_indexed: true });
  assert.equal(many.text, '4 classification · 3 prognosis · +2 more');
  assert.equal(many.utility, true);
  assert.equal(kindBadge({ coverage: { quantified_outcomes: 0 } }).text, 'Not in this library yet');
  assert.deepEqual(kindBadge({}).kinds, []);
});

test('a page served from the published snapshot says when it was published', () => {
  const live = freshness({ served_from: 'graph', findings: [] });
  assert.equal(live, null, 'a live read needs no caveat');
  const stale = freshness({ served_from: 'snapshot', published_at: '2026-09-17T15:38:54Z' });
  assert.match(stale, /Published 2026-09-17/);
  assert.match(stale, /did not answer,/);
  assert.match(stale, /a finding added since then is not shown/);
  // An older engine that does not send the field is treated as live, not as stale.
  assert.equal(freshness({ findings: [] }), null);
  assert.match(freshness({ served_from: 'snapshot' }), /last published copy/);
  // A cold connection that was still opening is a different fact from one that could not open.
  assert.match(freshness({ served_from: 'snapshot', published_at: '2026-09-18T02:00:42Z', fallback_reason: 'slow' }),
               /did not answer in time/);
  assert.doesNotMatch(freshness({ served_from: 'snapshot', published_at: '2026-09-18T02:00:42Z', fallback_reason: 'failed' }),
                      /in time/);
});

test('the catalog leads with what can answer something, and search reaches the rest', () => {
  const rows = [
    { name: 'Zonulin', aliases: [], category: 'Molecular marker', coverage: { quantified_outcomes: 0 } },
    { name: 'CA-125', aliases: ['MUC16'], category: 'Molecular marker', coverage: { quantified_outcomes: 7 } },
    { name: 'IL-18', aliases: ['Interleukin-18'], category: 'Molecular marker', coverage: { quantified_outcomes: 6 } },
  ];
  assert.deepEqual(graphMatches(rows, '').map(r => r.name), ['CA-125', 'IL-18', 'Zonulin'], 'typed findings first');
  assert.deepEqual(graphMatches(rows, 'muc16').map(r => r.name), ['CA-125'], 'an alias finds the page');
  assert.deepEqual(graphMatches(rows, 'zonulin').map(r => r.name), ['Zonulin'], 'a page with nothing indexed is still findable');
});

test('a failed profile says which layer is down, instead of guessing at a wait', async () => {
  const asked = [];
  const answer = up => async url => { asked.push(url); return { ok: up(url) }; };
  const dead = await diagnose(answer(() => false), 'https://api.example');
  assert.deepEqual([dead.engine, dead.graph], [false, false]);
  assert.match(dead.text, /engine is not answering yet/);
  assert.deepEqual(asked, ['https://api.example/api/health'], 'a dead engine is not asked a second question');

  asked.length = 0;
  const graphDown = await diagnose(answer(url => url.endsWith('/api/health')), 'https://api.example');
  assert.deepEqual([graphDown.engine, graphDown.graph], [true, false]);
  assert.match(graphDown.text, /evidence graph behind it is not answering/);
  assert.deepEqual(asked, ['https://api.example/api/health', 'https://api.example/api/evidence/graph/stats']);

  const both = await diagnose(answer(() => true), '');
  assert.deepEqual([both.engine, both.graph], [true, true]);
  assert.match(both.text, /failed for some other reason/);
  // A probe that throws is a failure, not an exception the page has to survive.
  const thrown = await diagnose(async () => { throw new TypeError('Failed to fetch'); }, '');
  assert.equal(thrown.engine, false);
});

test('a population that names no one in particular is not reported as a scope', () => {
  const row = (population, id) => ({ finding: { id, kind: 'association', measure: 'hazard_ratio', estimate: 1.2, population }, quote: 'q' });
  // "Indexed evidence is currently from patients" claims a narrowing that the findings do not make.
  const vague = scopeNote({ name: 'ApoB' }, [row('patients', 'a'), row('adults', 'b')]);
  assert.match(vague, /do not state which population/);
  assert.doesNotMatch(vague, /currently from/);
  const real = scopeNote({ name: 'IL-18' }, [row('biologic-naive patients with SD', 'c')]);
  assert.match(real, /currently from biologic-naive patients with SD/);
  assert.match(real, /absence is not evidence against them/);
  // A real population among vague ones is still the scope worth reporting.
  const mixed = scopeNote({ name: 'IL-18' }, [row('adults', 'd'), row('women with an adnexal mass', 'e')]);
  assert.match(mixed, /currently from women with an adnexal mass/);
  assert.equal(scopeNote({ name: 'X' }, []), null);
});

test('a rejected paper is described by what it did measure', () => {
  // "findings about other markers" told the reader nothing, and on a test page the other marker is
  // often the analyte the test measures — which only reads correctly if both names are shown.
  const other = deadLetterText({ code: 'findings_about_other_markers', reasons: { findings_about_other_markers: 2 },
                                 excluded: ['BRCA2 loss', 'microsatellite instability-high status'] });
  assert.match(other, /it reported numbers about BRCA2 loss and microsatellite instability-high status/);
  assert.match(other, /no passage named this page's subject/);
  // Without the marker names there is nothing better to say than the code.
  assert.match(deadLetterText({ code: 'findings_about_other_markers', reasons: { findings_about_other_markers: 1 }, excluded: [] }),
               /findings about other markers/);
  assert.match(deadLetterText({ reasons: { rejected_numeric_token: 3 } }), /number could not be read exactly from the source \(3×\)/);
  assert.equal(deadLetterText({ reasons: {} }), 'no typed finding passed validation');
});
