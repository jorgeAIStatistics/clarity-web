import test from 'node:test';
import assert from 'node:assert/strict';
import {studyLayer,uniqueStudies,compoundBrief,entityBrief,safeSource} from './profileModel.js';
test('animal randomization never becomes a human trial',()=>{assert.equal(studyLayer({design:'RCT',population:'animal'}),'preclinical');assert.equal(studyLayer({design:'RCT'}),'unclassified');assert.equal(studyLayer({design:'RCT',population:'human'}),'interventional');});
test('reviews remain separate from primary trials',()=>assert.equal(studyLayer({design:'Meta-analysis',population:'human'}),'synthesis'));
test('shared sources are counted once across outcomes',()=>assert.equal(uniqueStudies([{studies:[{pmid:'123',id:'a'}]},{studies:[{pmid:'123',id:'b'}]}]).length,1));
test('estimated intervals do not become headline estimates',()=>{const model=compoundBrief({outcomes:[{outcome:'Sleep',headlineEffect:{estimated:true,value:2},studies:[]}]});assert.equal(model.outcomes[0].effect,'No verified headline estimate');assert.equal(safeSource('javascript:alert(1)'),undefined);});
test('survival endpoints never inherit a different endpoint estimate',()=>{
 const model=entityBrief({id:'example',name:'Example',entity_type:'precision_oncology',outcomes:[{name:'Overall survival'},{name:'Progression-free survival'}],studies:[{outcome:'Overall survival',effect:{measure:'hazard ratio',estimate:.8,lower:.6,upper:1,confidence_level:95}}]});
 assert.match(model.outcomes[0].effect,/0.8/);assert.equal(model.outcomes[1].studies.length,0);assert.equal(model.outcomes[1].effect,'No extracted estimate for this outcome');
});
test('all source-specific findings survive without invented intervals',()=>{
 const model=entityBrief({id:'x',name:'x',entity_type:'biomarker',outcomes:[{name:'Events'}],studies:[{id:'a',url:'https://example.org/a',findings:[{outcome:'Events',effect:{measure:'risk ratio',estimate:2,lower:null,upper:null,units:'ratio'},quote:'risk ratio 2'}]},{id:'b',url:'https://example.org/b',findings:[{outcome:'Events',effect:{measure:'risk ratio',estimate:1.2,lower:1,upper:1.4,confidence_level:95},quote:'1.2 (1–1.4)'}]}]});
 assert.equal(model.outcomes.length,2);assert.ok(!model.outcomes[0].effect.includes('CI'));assert.notEqual(model.outcomes[0].key,model.outcomes[1].key);assert.equal(model.outcomes[1].effectSource,'https://example.org/b');
});
