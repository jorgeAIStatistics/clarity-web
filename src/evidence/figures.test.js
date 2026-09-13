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
test('forest plots require a measure and positive ratio intervals',()=>{
 const forest=EXAMPLE_FIGURES.find(f=>f.type==='forest');
 assert.throws(()=>validateFigure({...forest,measure:undefined}));
 assert.throws(()=>validateFigure({...forest,rows:[{estimate:.5,lower:0,upper:1}]}));
 assert.doesNotThrow(()=>validateFigure({...forest,measure:'mean_diff',rows:[{estimate:0,lower:-1,upper:1}]}));
});
test('risk and response charts reject values outside probability bounds',()=>{
 assert.throws(()=>validateFigure({...EXAMPLE_FIGURES[0],rows:[{x:1,y:1.1}]}));
 assert.throws(()=>validateFigure({...EXAMPLE_FIGURES.at(-1),rows:[{row:'A',column:'B',value:1.1}]}));
});
test('published catalog graphics reproduce source estimates',async()=>{
 const {readFileSync}=await import('node:fs');const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url),'utf8'));
 for(const e of catalog.entities)for(const f of e.figures||[]){validateFigure(f);for(const row of f.rows){assert.ok(e.studies.some(s=>s.url===f.source_url&&[...(s.findings||[]),...(s.effect?[s]:[])].some(x=>x.effect.estimate===row.estimate&&x.effect.lower===row.lower&&x.effect.upper===row.upper)));}}
});
