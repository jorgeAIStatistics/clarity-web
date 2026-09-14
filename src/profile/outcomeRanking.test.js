import test from 'node:test';
import assert from 'node:assert/strict';
import { rankOutcomes, sliceCodePoints } from './reportModel.js';

const rows = (layer, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ key: `${layer}-${i}`, layer, ...extra }));

test('a single exploratory endpoint never becomes the default over the main evidence body', () => {
  const ranked = rankOutcomes([
    { name: 'Backward digit span', rows: rows('interventional', 1, { effect: { metric: 'partial_eta_squared', estimate: 0.029 } }) },
    { name: 'Raven advanced progressive matrices', rows: rows('interventional', 1, { effect: { metric: 'partial_eta_squared', estimate: 0.008 } }) },
    { name: 'muscle strength', grade: 'Strong', rows: [...rows('interventional', 42), ...rows('synthesis', 5), ...rows('preclinical', 3)] },
    { name: 'endurance', grade: 'Moderate', rows: [...rows('interventional', 11), ...rows('synthesis', 4)] },
  ]);
  assert.deepEqual(ranked.map(o => o.name), ['muscle strength', 'endurance', 'Backward digit span', 'Raven advanced progressive matrices']);
});

test('human interventional records rank first, then observational, then total records', () => {
  const ranked = rankOutcomes([
    { name: 'many animal', rows: rows('preclinical', 30) },
    { name: 'observational', rows: rows('observational', 4) },
    { name: 'trials', rows: rows('interventional', 2) },
  ]);
  assert.deepEqual(ranked.map(o => o.name), ['trials', 'observational', 'many animal']);
});

test('ties keep the incoming order and the input is not mutated', () => {
  const input = [{ name: 'a', rows: rows('interventional', 2) }, { name: 'b', rows: rows('interventional', 2) }];
  assert.deepEqual(rankOutcomes(input).map(o => o.name), ['a', 'b']);
  assert.deepEqual(input.map(o => o.name), ['a', 'b']);
});

test('source spans slice by Unicode code point, matching engine offsets', () => {
  const prefix = '𝑝 < 0.05; ';            // mathematical italic p is one code point, two UTF-16 units
  const quote = 'HR 0.54 (0.43–0.67)';
  const text = prefix + quote;
  const start = [...prefix].length;
  assert.equal(sliceCodePoints(text, start, start + [...quote].length), quote);
  assert.notEqual(text.slice(start, start + quote.length), quote);
});
