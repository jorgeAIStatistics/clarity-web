import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalPath,CORE_ROUTES} from './routes.js';
test('canonical core routes preserve their path',()=>CORE_ROUTES.forEach(p=>assert.equal(canonicalPath(p),p)));
test('public aliases and trailing slashes resolve predictably',()=>{
 assert.equal(canonicalPath('/biomarker/apob/'),'/biomarkers/apob');
 assert.equal(canonicalPath('/interventions'),'/research');
 assert.equal(canonicalPath('/intervention/creatine'),'/compound/creatine');
 assert.equal(canonicalPath('/learn/basics'),'/learn');
 assert.equal(canonicalPath('/%E0%A4%A'),'/not-found');
});
