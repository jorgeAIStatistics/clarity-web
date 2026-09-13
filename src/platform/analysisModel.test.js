import test from 'node:test';
import assert from 'node:assert/strict';
import {plotScale} from './analysisModel.js';
test('ratio plot uses log spacing and a null at one',()=>{const s=plotScale([{metric:'rr',lower:.25,upper:4}]);assert.equal(s.nullValue,1);assert.ok(Math.abs((s.x(2)-s.x(1))-(s.x(1)-s.x(.5)))<1e-9);});
test('absolute difference axis retains the null at zero',()=>{const s=plotScale([{metric:'mean_diff',lower:2,upper:4}]);assert.equal(s.nullValue,0);assert.ok(s.x(0)<s.x(2));});
test('invalid intervals cannot produce a chart',()=>{assert.equal(plotScale([]),null);assert.equal(plotScale([{metric:'rr',lower:0,upper:2}]),null);assert.equal(plotScale([{metric:'mean_diff',lower:NaN,upper:2}]),null);});
