import test from 'node:test';
import assert from 'node:assert/strict';
import {measureFamily,plottable,scaleFor,markFor,markDescription,splitByFamily} from './findingScale.js';

const hr=(estimate,lower,upper)=>({id:`hr-${estimate}`,measure:'hazard_ratio',estimate,lower,upper});

test('a ratio and a difference never share an axis', () => {
  const {blocks}=splitByFamily([hr(0.7,0.5,0.9),{id:'md',measure:'mean_difference',estimate:2,lower:1,upper:3}]);
  assert.equal(blocks.length,2);
  assert.deepEqual(blocks.map(b=>b.family),['ratio','difference']);
  assert.equal(blocks[0].scale.nullValue,1);
  assert.equal(blocks[1].scale.nullValue,0);
});

test('a measure with no defined scale gets no mark, only its number', () => {
  const {blocks,unscaled}=splitByFamily([{id:'c',measure:'cutoff',estimate:12},{id:'p',measure:'p_value',estimate:0.03}]);
  assert.equal(blocks.length,0);
  assert.equal(unscaled.length,2);
  assert.equal(measureFamily('cutoff'),null);
});

test('crossing the null is read off the interval, never off the point', () => {
  const scale=scaleFor([hr(0.85,0.59,1.25),hr(0.7,0.51,0.95)],'ratio');
  assert.equal(markFor(hr(0.85,0.59,1.25),scale).crossesNull,true);
  assert.equal(markFor(hr(0.7,0.51,0.95),scale).crossesNull,false);
});

test('a point with no reported interval claims no precision', () => {
  const scale=scaleFor([hr(0.7,0.51,0.95),hr(1.4)],'ratio');
  const mark=markFor(hr(1.4),scale);
  assert.equal(mark.hasInterval,false);
  assert.equal(mark.x1,null);
  assert.equal(mark.x2,null);
  // No interval means the row cannot assert anything about the null either.
  assert.equal(mark.crossesNull,false);
  assert.match(markDescription(hr(1.4),scale,'HR'),/interval not reported/);
});

test('the axis holds every value the group shows, and the null', () => {
  const rows=[hr(0.7,0.51,0.95),hr(3.4,1.9,6.1)];
  const scale=scaleFor(rows,'ratio');
  assert.ok(scale.min<=0.51,'lower interval end is inside the axis');
  assert.ok(scale.max>=6.1,'upper interval end is inside the axis');
  for(const row of rows){
    const mark=markFor(row,scale);
    for(const v of [mark.x,mark.x1,mark.x2]) assert.ok(v>=0&&v<=1,'every drawn point lies on the axis');
  }
  assert.ok(scale.nullAt>0&&scale.nullAt<1,'the null line is visible');
});

test('ratios are placed on a log axis so a halving and a doubling are equidistant from no effect', () => {
  const scale=scaleFor([hr(0.5,0.4,0.6),hr(2,1.6,2.5)],'ratio');
  const half=markFor(hr(0.5,0.4,0.6),scale).x, doubled=markFor(hr(2,1.6,2.5),scale).x;
  const gapLow=scale.nullAt-half, gapHigh=doubled-scale.nullAt;
  assert.ok(Math.abs(gapLow-gapHigh)<1e-9,'equal ratio, equal distance');
});

test('a non-positive ratio is kept as a number rather than clamped onto a log axis', () => {
  assert.equal(plottable({measure:'hazard_ratio',estimate:0}),false);
  assert.equal(plottable({measure:'risk_difference',estimate:0}),true);
  const {unscaled}=splitByFamily([{id:'z',measure:'hazard_ratio',estimate:0}]);
  assert.equal(unscaled.length,1);
});

test('a proportion gets no null line because it has no null', () => {
  const scale=scaleFor([{id:'s',measure:'sensitivity',estimate:0.88,lower:0.8,upper:0.93}],'proportion');
  assert.equal(scale.nullValue,null);
  assert.equal(scale.nullAt,null);
  assert.ok(scale.min>=0&&scale.max<=1,'a proportion axis stays inside 0 to 1');
});

test('discrimination is measured against chance, not against zero', () => {
  const scale=scaleFor([{id:'a',measure:'auc',estimate:0.81}],'discrimination');
  assert.equal(scale.nullValue,0.5);
  assert.match(markDescription({measure:'auc',estimate:0.81},scale,'AUC'),/^AUC 0.81/);
});

test('an estimate from one family is never drawn on another family\'s axis', () => {
  const ratio=scaleFor([hr(0.7,0.5,0.9)],'ratio');
  assert.equal(markFor({measure:'mean_difference',estimate:0.7,lower:0.5,upper:0.9},ratio),null);
});

test('a missing or unparseable estimate produces no mark at all', () => {
  const scale=scaleFor([hr(0.7,0.5,0.9)],'ratio');
  for(const bad of [null,undefined,'',' ','n/a',NaN]) assert.equal(markFor({measure:'hazard_ratio',estimate:bad},scale),null);
  assert.equal(scaleFor([],'ratio'),null);
  assert.equal(scaleFor([{measure:'hazard_ratio',estimate:'x'}],'ratio'),null);
});

test('an interval wider than the axis is marked as running past it', () => {
  const scale=scaleFor([hr(1.1,1.0,1.2)],'ratio');
  const mark=markFor(hr(1.1,0.9,40),scale);
  assert.equal(mark.clippedHigh,true);
  assert.match(markDescription(hr(1.1,0.9,40),scale,'HR'),/extends past the axis/);
});

import {kindWords} from './graphProfile.js';

test('a stored kind is shown as words, however the writer cased it', () => {
  assert.equal(kindWords('PrecisionContext'),'precision context');
  assert.equal(kindWords('precision_context'),'precision context');
  assert.equal(kindWords('Biomarker'),'biomarker');
  assert.equal(kindWords(''),'entity');
  assert.equal(kindWords(null),'entity');
});
