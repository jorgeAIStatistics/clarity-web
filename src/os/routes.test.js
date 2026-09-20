import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOsPath, osPathFromId, isQuestionQuery, inferKindFromLegacySlug, graphId, libraryKind, pathForEntry} from './routes.js';
import {classifyCommand, disambiguate, matchScore} from './search.js';

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
