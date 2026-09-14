import test from 'node:test';
import assert from 'node:assert/strict';
import LAYER_RULES from './layers.generated.js';
import { studyLayer } from './profileModel.js';

test('web classifier reproduces every shared engine layer case', () => {
  for (const c of LAYER_RULES.cases) assert.equal(studyLayer(c.study), c.layer, JSON.stringify(c.study));
});

test('shared rule table is versioned', () => {
  assert.match(LAYER_RULES.version, /^layers-v\d+/);
  assert.equal(LAYER_RULES.default, 'unclassified');
});
