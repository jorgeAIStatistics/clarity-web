import test from 'node:test';
import assert from 'node:assert/strict';
import {searchLibrary} from './librarySearch.js';

const e=(name,extra={})=>({id:name,name,path:'/x/'+name,aliases:[],coverage:{quantified_outcomes:0},...extra});
const ROWS=[
  e('Alkaline phosphatase'),
  e('ALK gene',{aliases:['anaplastic lymphoma kinase'],coverage:{quantified_outcomes:2}}),
  e('ALK',{aliases:[],coverage:{quantified_outcomes:0}}),
  e('HER2',{aliases:['ERBB2'],coverage:{quantified_outcomes:7}}),
  e('HER2-low breast cancer × trastuzumab deruxtecan',{coverage:{quantified_outcomes:0}}),
];

test('an exact name beats a word inside a longer one', () => {
  const [first]=searchLibrary(ROWS,'alk');
  assert.equal(first.name,'ALK');
});

test('an alias finds the entity it belongs to', () => {
  assert.equal(searchLibrary(ROWS,'ERBB2')[0].name,'HER2');
  assert.equal(searchLibrary(ROWS,'anaplastic lymphoma')[0].name,'ALK gene');
});

test('within one tier, a profile with findings comes before one with none', () => {
  const names=searchLibrary(ROWS,'her2').map(r=>r.name);
  assert.equal(names[0],'HER2');
});

test('an empty or unmatched query returns nothing rather than everything', () => {
  assert.deepEqual(searchLibrary(ROWS,''),[]);
  assert.deepEqual(searchLibrary(ROWS,'   '),[]);
  assert.deepEqual(searchLibrary(ROWS,'zzzz'),[]);
  assert.deepEqual(searchLibrary(null,'alk'),[]);
});

test('a query with regex characters is matched literally, not as a pattern', () => {
  assert.doesNotThrow(()=>searchLibrary(ROWS,'her2 ('));
  assert.deepEqual(searchLibrary(ROWS,'.*'),[]);
});

test('the result list is capped so the menu cannot run off the screen', () => {
  const many=Array.from({length:50},(_,i)=>e(`marker ${i}`));
  assert.equal(searchLibrary(many,'marker').length,8);
  assert.equal(searchLibrary(many,'marker',3).length,3);
});
