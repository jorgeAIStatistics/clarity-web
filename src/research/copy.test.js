import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// User-facing copy regression guard: misspellings that have reached researchers before.
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(path.join(dir, d.name)) : /\.(jsx?|css)$/.test(d.name) && !d.name.endsWith('.test.js') ? [path.join(dir, d.name)] : []);
test('interface copy has no misspelling of retrieval', () => {
  for (const file of files(fileURLToPath(new URL('..', import.meta.url)))) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /retrievel|retreival|retrival/i, file);
});
test('question map copy never uses the placeholder restatement template', () => {
  const source = fs.readFileSync(new URL('./QuestionMap.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /population to specify|outcome to specify|the concepts you named/);
});
