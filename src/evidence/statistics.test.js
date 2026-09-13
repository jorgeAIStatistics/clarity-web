import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticMetrics, screeningMetrics} from './statistics.js';

test('a low-prevalence test has mostly false positive results',()=>{
  const m=diagnosticMetrics(.9,.95,.01);
  assert.equal(m.tp,9);assert.ok(Math.abs(m.fp-49.5)<1e-10);
  assert.ok(Math.abs(m.ppv-9/58.5)<1e-10);
});
test('degenerate probabilities remain undefined rather than misleading zeros',()=>{
  assert.equal(diagnosticMetrics(1,1,0).ppv,null);
  assert.equal(diagnosticMetrics(1,1,1).npv,null);
  assert.equal(diagnosticMetrics(1,1,.5).ppv,1);
  assert.equal(diagnosticMetrics(1,1,.5).dor,null);
  for(const x of [NaN,Infinity,-1,2,null,true,'0.9'])assert.throws(()=>diagnosticMetrics(x,.9,.01));
});
test('expected counts conserve population across extreme and typical values',()=>{
  for(const se of [0,.5,.9,1])for(const sp of [0,.7,1])for(const p of [0,.01,.5,1]){
    const m=diagnosticMetrics(se,sp,p);assert.ok(Math.abs(m.tp+m.tn+m.fp+m.fn-1000)<1e-9);
  }
});
test('screening distinguishes benefit, no difference, and harm',()=>{
  assert.equal(screeningMetrics(.01,.008).nns,500);
  assert.equal(screeningMetrics(.03,.01).nns,50);
  assert.equal(screeningMetrics(Number.MIN_VALUE,0).nns,null);
  assert.equal(screeningMetrics(.01,.01).nns,null);
  assert.equal(screeningMetrics(.008,.01).nnh,500);
});
