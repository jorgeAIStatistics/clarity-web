// One vocabulary for what is known, uncertain or missing, shared by every profile type.
export const EPISTEMIC_STATUS = {
  established: 'Established',
  uncertain: 'Uncertain',
  conflicting: 'Conflicting',
  reviewed: 'Human-reviewed',
  unappraised: 'Unappraised',
  not_reported: 'Not reported',
  not_extracted: 'Not yet extracted',
  not_assessed: 'Not assessed',
  not_searched: 'Not searched',
  searched_none_found: 'Searched · none found',
  legacy: 'Legacy automated tier',
};

const REVIEW = {
  reviewed: { status: 'reviewed', label: 'Human-reviewed by dimension' },
  partially_reviewed: { status: 'unappraised', label: 'Partially reviewed · appraisal incomplete' },
  automated_appraisal: { status: 'unappraised', label: 'Automated extraction · not human-appraised' },
  reference_summary: { status: 'unappraised', label: 'Reference summary · not appraised' },
};

// Catalog review_status → status chip. Anything other than a completed review is unappraised.
export function reviewEpistemic(reviewStatus) {
  return REVIEW[reviewStatus] || { status: 'unappraised', label: 'Not appraised' };
}

// Outcome certainty. A cached tier is shown as a legacy rating, never as a certainty assessment.
export function outcomeCertaintyEpistemic({ gradeStatus, legacyGrade } = {}) {
  if (gradeStatus === 'refresh_required') return { status: 'legacy', label: 'Legacy automated tier · refresh needed' };
  if (legacyGrade) return { status: 'legacy', label: `Legacy automated tier · ${legacyGrade}` };
  return { status: 'unappraised', label: 'Unappraised · no certainty assessment' };
}
