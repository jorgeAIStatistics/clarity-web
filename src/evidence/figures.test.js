import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EXAMPLE_FIGURES, validateFigure, rocArea} from './figures.js';
test('all nine teaching figure types have explicit provenance and valid coordinates',()=>{
  assert.equal(EXAMPLE_FIGURES.length,9);
  EXAMPLE_FIGURES.forEach(f=>assert.equal(validateFigure(f),f));
});
test('published evidence cannot silently use synthetic source-free data',()=>{
  assert.throws(()=>validateFigure({...EXAMPLE_FIGURES[0],illustrative:false}));
  assert.throws(()=>validateFigure({...EXAMPLE_FIGURES[0],rows:[{x:1,y:NaN}]}));
});
test('AUC distinguishes complete curves from incomplete coordinates',()=>{
  assert.equal(rocArea([{x:0,y:0},{x:1,y:1}]),.5);
  assert.equal(rocArea([{x:0,y:0},{x:0,y:1},{x:1,y:1}]),1);
  assert.equal(rocArea([{x:.1,y:.2},{x:.8,y:.9}]),null);
  assert.throws(()=>rocArea([{x:0,y:0},{x:.5,y:.8},{x:.4,y:1}]));
});
