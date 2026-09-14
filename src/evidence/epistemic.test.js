import test from 'node:test';
import assert from 'node:assert/strict';
import { EPISTEMIC_STATUS, reviewEpistemic, outcomeCertaintyEpistemic } from './epistemic.js';

test('automated extraction and reference summaries are never presented as appraised', () => {
  for (const s of ['automated_appraisal', 'reference_summary', 'partially_reviewed', undefined, 'something_new']) {
    assert.equal(reviewEpistemic(s).status, 'unappraised', String(s));
  }
  assert.equal(reviewEpistemic('reviewed').status, 'reviewed');
});

test('cached tiers are labelled legacy, never as certainty', () => {
  assert.deepEqual(outcomeCertaintyEpistemic({ legacyGrade: 'Strong' }), { status: 'legacy', label: 'Legacy automated tier · Strong' });
  assert.equal(outcomeCertaintyEpistemic({ gradeStatus: 'refresh_required', legacyGrade: 'Strong' }).label, 'Legacy automated tier · refresh needed');
  assert.equal(outcomeCertaintyEpistemic({}).status, 'unappraised');
  assert.equal(outcomeCertaintyEpistemic().status, 'unappraised');
});

test('every status the profiles use has a label', () => {
  for (const s of ['reviewed', 'unappraised', 'legacy', 'not_searched', 'not_extracted', 'not_assessed']) assert.ok(EPISTEMIC_STATUS[s], s);
});
