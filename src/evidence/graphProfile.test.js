import test from 'node:test';
import assert from 'node:assert/strict';
import {valueText,flatten,groupFindings,aucStrip,classificationRows,relationLabel,deadLetterText} from './graphProfile.js';

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
