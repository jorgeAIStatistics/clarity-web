import test from 'node:test';
import assert from 'node:assert/strict';
import {valueText,flatten,groupFindings,aucStrip,classificationRows,relationLabel,deadLetterText,graphMatches,objectKind,findingsCsv,findingsJson,graphPrefixes,routeTypes,EXPORT_COLUMNS,identity,biology,measurement,meaning,utility,ladder,scopeNote,questions} from './graphProfile.js';

const row=(finding,extra={})=>({finding,quote:'At a cut-off of 100 ng/mL, CgA had a sensitivity of 71%.',pmid:'1',title:'SYNTHETIC',year:2024,layer:'observational',study_id:'pmid:1',...extra});
const sens={id:'obs:1',kind:'classification',measure:'sensitivity',estimate:71,unit:'%',cutoff:100,cutoff_unit:'ng/mL',target:'neuroendocrine neoplasms',assay:'Serum CgA'};
const spec={...sens,id:'obs:2',measure:'specificity',estimate:85};
const auc={id:'obs:3',kind:'discrimination',measure:'auc',estimate:0.82,lower:0.76,upper:0.88,level:95,target:'neuroendocrine neoplasms'};
const hr={id:'obs:4',kind:'prognosis',measure:'hazard_ratio',estimate:0.62,lower:0.48,upper:0.8,level:95,target:'progression-free survival'};

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
    identity: { entity_class: 'Cytokine (IL-1 family protein)', specimen: 'Serum or plasma', measured_by_methods: 'Immunoassay (ELISA)',
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

test('Q5 never infers utility, and the ladder marks each rung', () => {
  const q5 = utility(IL18.entity, IL18.rows);
  assert.equal(q5.state, 'empty');
  assert.match(q5.text, /No indexed evidence that measuring IL-18 changes decisions or outcomes/);
  const rungs = Object.fromEntries(ladder(IL18.entity, IL18.rows).map(r => [r.key, r.indexed]));
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
