import test from 'node:test';
import assert from 'node:assert/strict';
import { effectDistribution, forestCaption, forestInterpretation } from './figureModel.js';
import { measureFamily } from '../evidence/measures.js';
const rows = [1,2,3,4,10].map((point,i) => ({ id:`s${i}`, pmid:String(i), point, quote:'source', outcome:'Pain', fam:{key:'md'}, unit:'points', population:'adults',exposure:'A',comparator:'B',timepoint:'6 weeks' }));
test('quartiles use observed aggregate effects and disclose outliers',()=>{const d=effectDistribution(rows)[0];assert.equal(d.median,3);assert.equal(d.lower,2);assert.equal(d.upper,4);assert.equal(d.outliers[0].point,10);});
test('sparse or incomparable records never produce a distribution',()=>{assert.equal(effectDistribution(rows.slice(1)).length,0);assert.equal(effectDistribution(rows.map(r=>({...r,unit:null}))).length,0);assert.equal(effectDistribution(rows.map((r,i)=>({...r,timepoint:`${i} weeks`}))).length,0);});
test('multiple records from one paper do not masquerade as independent effects',()=>{assert.equal(effectDistribution(rows.map(r=>({...r,pmid:'same'}))).length,0);});

test('forest captions state what the plotted intervals show and never invent a user comparison', () => {
  const fam = measureFamily('HR');
  const published = [{ fam, point: 0.8, lower: 0.7, upper: 0.9 }, { fam, point: 1.1, lower: 0.9, upper: 1.3 }, { fam, point: 0.9 }];
  const panel = { fam, mode: 'Association', published, user: [], comparison: [] };
  assert.equal(forestCaption(panel), '3 published HR estimates: 1 below, 1 spanning no difference (1 without an interval).');
  assert.match(forestInterpretation(panel), /association does not show that acting on the marker helps.*No uploaded result.*none has been expert-reviewed/);
  assert.match(forestCaption({ ...panel, published: [], user: [{ point: 1 }] }), /shown on its own/);
});
