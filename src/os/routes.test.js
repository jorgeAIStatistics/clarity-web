import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseOsPath, osPathFromId, isQuestionQuery, inferKindFromLegacySlug, graphId, libraryKind, pathForEntry} from './routes.js';
import {classifyCommand, disambiguate, matchScore, searchEntities} from './search.js';
import {canonicalId, identityFromEntry, visualExtractId, sameIdentity, DERIVED_IDENTITIES} from './identity.js';
import {questionsForKind, rungsForKind, usesBiomarkerContract} from './questions.js';

const library = JSON.parse(readFileSync(new URL('../../public/library.json', import.meta.url), 'utf8'));
const entries = library.entries;

test('typed entity paths', () => {
  assert.deepEqual(parseOsPath('/gene/brca1').kind, 'gene');
  assert.equal(parseOsPath('/gene/brca1').id, 'gene:brca1');
  assert.equal(parseOsPath('/protein/il18').id, 'protein:il18');
  assert.equal(parseOsPath('/biomarker/apob').id, 'biomarker:apob');
  assert.equal(parseOsPath('/intervention/creatine').id, 'compound:creatine');
  assert.equal(parseOsPath('/context/egfr-osimertinib').id, 'precision_context:egfr-osimertinib');
});

test('legacy biomarker URLs become typed routes', () => {
  const gene = parseOsPath('/biomarkers/brca1-gene');
  assert.equal(gene.kind, 'gene');
  assert.equal(gene.id, 'gene:brca1');
  const marker = parseOsPath('/biomarkers/apob');
  assert.equal(marker.kind, 'biomarker');
  assert.equal(parseOsPath('/compound/semaglutide').kind, 'intervention');
});

test('top-level IA', () => {
  assert.equal(parseOsPath('/').screen, 'workbench');
  assert.equal(parseOsPath('/workspace').screen, 'workspace');
  assert.equal(parseOsPath('/catalog').screen, 'catalog');
  assert.equal(parseOsPath('/explore').screen, 'catalog');
  assert.equal(parseOsPath('/research').type, 'intervention');
  assert.equal(parseOsPath('/graph').screen, 'graph');
  assert.equal(parseOsPath('/explore/matcher').screen, 'investigate');
  assert.equal(parseOsPath('/learn').screen, 'methods');
  assert.equal(parseOsPath('/compare').screen, 'compare');
});

test('osPathFromId', () => {
  assert.equal(osPathFromId('graph:gene:brca1'), '/gene/brca1');
  assert.equal(osPathFromId('compound:creatine'), '/intervention/creatine');
  assert.equal(osPathFromId('biomarker:apob'), '/biomarker/apob');
});

test('questions vs entities', () => {
  assert.equal(isQuestionQuery('BRCA1'), false);
  assert.equal(isQuestionQuery('Does creatine improve cognition?'), true);
  assert.equal(isQuestionQuery('what pathways connect obesity and inflammation'), true);
  assert.equal(classifyCommand('EGFR').mode, 'entity');
  assert.equal(classifyCommand('Which biomarkers predict cardiovascular disease?').mode, 'question');
  assert.equal(classifyCommand('/graph BRCA1').cmd, 'graph');
});

test('EGFR-style disambiguation groups kinds', () => {
  const hits = [
    {name: 'EGFR gene', kind: 'gene', id: 'gene:egfr', aliases: ['EGFR']},
    {name: 'EGFR activating mutation', kind: 'variant', id: 'variant:egfr-activating-mutation', aliases: ['EGFR mutation']},
    {name: 'EGFR-mutated NSCLC × osimertinib', kind: 'precision_context', id: 'precision_context:egfr-osimertinib', aliases: []},
    {name: 'Creatinine / eGFR', kind: 'biomarker', id: 'biomarker:creatinine-egfr', aliases: ['eGFR']},
  ];
  const d = disambiguate(hits, 'EGFR');
  assert.equal(d.ambiguous, true);
  assert.ok(d.kinds.includes('gene'));
  assert.ok(d.kinds.includes('variant'));
  assert.ok(matchScore({name: 'EGFR gene', id: 'graph:gene:egfr', aliases: ['EGFR']}, 'EGFR') > matchScore({name: 'Creatinine / eGFR', id: 'entity:creatinine-egfr', aliases: ['eGFR']}, 'EGFR'));
});

test('libraryKind reads graph prefixes not the flattened entity_type', () => {
  assert.equal(libraryKind({id: 'graph:gene:brca1', entity_type: 'biomarker', category: 'Gene'}), 'gene');
  assert.equal(libraryKind({id: 'compound:creatine', entity_type: 'intervention'}), 'intervention');
  assert.equal(libraryKind({id: 'entity:apob', entity_type: 'biomarker', path: '/biomarkers/apob'}), 'biomarker');
});

test('catalog entity: ids resolve through their stored path', () => {
  assert.equal(pathForEntry({id: 'entity:apob', path: '/biomarkers/apob'}), '/biomarker/apob');
  assert.equal(pathForEntry({id: 'entity:egfr-osimertinib', path: '/precision-medicine/egfr-osimertinib'}), '/context/egfr-osimertinib');
  assert.equal(pathForEntry({id: 'graph:gene:brca1', path: '/biomarkers/brca1'}), '/gene/brca1');
});

test('inferKindFromLegacySlug', () => {
  assert.equal(inferKindFromLegacySlug('biomarker', 'il18-gene'), 'gene');
  assert.equal(inferKindFromLegacySlug('biomarker', 'apob'), 'biomarker');
  assert.equal(graphId('gene', 'brca1'), 'gene:brca1');
});

test('canonical identity collapses entity: and graph: envelopes', () => {
  const apob = identityFromEntry({id: 'entity:apob', entity_type: 'biomarker', path: '/biomarkers/apob', name: 'ApoB'});
  assert.equal(apob.id, 'biomarker:apob');
  assert.equal(apob.kind, 'biomarker');
  assert.equal(apob.path, '/biomarker/apob');
  assert.equal(canonicalId('graph:biomarker:apob'), 'biomarker:apob');
  assert.equal(canonicalId('graph:gene:brca1'), 'gene:brca1');
  assert.equal(visualExtractId(apob), 'entity:apob');
  assert.equal(visualExtractId({kind: 'intervention', id: 'compound:creatine', slug: 'creatine'}), 'compound:creatine');
  assert.ok(sameIdentity({id: 'biomarker:apob', path: '/biomarker/apob'}, {id: 'biomarker:apob', path: '/biomarker/apob'}));
});

test('gene Q-contract is not the biomarker contract', () => {
  const gene = questionsForKind('gene');
  const marker = questionsForKind('biomarker');
  const protein = questionsForKind('protein');
  const variant = questionsForKind('variant');
  const intervention = questionsForKind('intervention');
  assert.ok(gene && marker && protein && variant && intervention);
  assert.notEqual(gene.join('|'), marker.join('|'));
  assert.ok(!gene.some(q => /measuring it actually help/i.test(q)));
  assert.ok(marker.some(q => /measuring it actually help/i.test(q)));
  assert.ok(protein.some(q => /circulating measurement/i.test(q)));
  assert.equal(usesBiomarkerContract('gene'), false);
  assert.equal(usesBiomarkerContract('protein'), false);
  assert.equal(usesBiomarkerContract('biomarker'), true);
  const geneRungs = rungsForKind('gene', {locus: {chrom: '17'}}, [], [], {});
  assert.equal(geneRungs.length, 5);
  assert.ok(geneRungs.some(r => r.constraint));
  const proteinRungs = rungsForKind('protein', {}, [], [], {origin: 'derived', derived_from: 'biomarker:il-18'});
  assert.equal(proteinRungs.find(r => r.key === 'findings').indexed, false);
});

test('Command ranks EGFR gene above creatinine/eGFR, and eGFR above EGFR gene', () => {
  const gene = {name: 'EGFR gene', id: 'graph:gene:egfr', aliases: ['EGFR gene']};
  const creat = {name: 'Creatinine / eGFR', id: 'entity:creatinine-egfr', aliases: ['Creatinine', 'eGFR'], path: '/biomarkers/creatinine-egfr', entity_type: 'biomarker'};
  assert.ok(matchScore(gene, 'EGFR') > matchScore(creat, 'EGFR'));
  assert.ok(matchScore(creat, 'eGFR') > matchScore(gene, 'eGFR'));
  const creatine = {name: 'creatine', id: 'compound:creatine', aliases: []};
  const creatinine = {name: 'Creatinine / eGFR', id: 'biomarker:creatinine-egfr', aliases: ['Creatinine', 'eGFR']};
  assert.ok(matchScore(creatine, 'creatine') > matchScore(creatinine, 'creatine'));
});

test('Command on the real catalog does not collapse kinds for EGFR, IL18, ApoB, BRCA1, creatine', () => {
  const egfr = searchEntities(entries, 'EGFR', 20);
  const egfrKinds = [...new Set(egfr.map(h => h.kind))];
  assert.ok(egfrKinds.includes('gene'), `EGFR kinds ${egfrKinds}`);
  assert.ok(egfr[0].kind === 'gene' || egfr[0].kind === 'variant', `top EGFR hit was ${egfr[0].kind} ${egfr[0].id}`);
  assert.ok(!String(egfr[0].id).includes('creatinine'));
  assert.equal(egfr.find(h => h.id === 'gene:egfr')?.id, 'gene:egfr');

  const egfrFiltration = searchEntities(entries, 'eGFR', 20);
  assert.equal(egfrFiltration[0].id, 'biomarker:creatinine-egfr');

  const apob = searchEntities(entries, 'ApoB', 10);
  assert.equal(apob[0].id, 'biomarker:apob');
  assert.ok(!apob[0].id.startsWith('entity:'));

  const brca = searchEntities(entries, 'BRCA1', 10);
  assert.equal(brca[0].kind, 'gene');
  assert.equal(brca[0].id, 'gene:brca1');

  const creatine = searchEntities(entries, 'creatine', 10);
  assert.equal(creatine[0].kind, 'intervention');
  assert.ok(creatine[0].id.startsWith('compound:creatine'));
  assert.ok(!creatine.slice(0, 3).some(h => h.id.includes('creatinine')));

  const il18 = searchEntities(entries, 'IL18', 20);
  const ilKinds = [...new Set(il18.map(h => h.kind))];
  assert.ok(ilKinds.includes('gene'), `IL18 kinds ${ilKinds}`);
  assert.ok(ilKinds.includes('biomarker') || ilKinds.includes('protein'));
  assert.ok(il18.some(h => h.id === 'protein:il18' && h.derived));
  assert.equal(DERIVED_IDENTITIES[0].id, 'protein:il18');
});
