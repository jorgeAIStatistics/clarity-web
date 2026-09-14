import React from 'react';
import { EPISTEMIC_STATUS, reviewEpistemic, outcomeCertaintyEpistemic } from './epistemic.js';
import './epistemic.css';

export { EPISTEMIC_STATUS };

// Each status pairs a mark with a label, so meaning never depends on color alone.
export default function EpistemicStatus({ status, children, title }) {
  const known = status in EPISTEMIC_STATUS ? status : 'unappraised';
  return <span className={`es-chip es-${known}`} title={title}>{children ?? EPISTEMIC_STATUS[known]}</span>;
}

export function ReviewStatus({ reviewStatus }) {
  return <span className="es-chip es-neutral">{reviewStatus==='reference_summary'?'Reference context':'Source records'}</span>;
}

export function OutcomeCertainty({ gradeStatus, legacyGrade }) {
  const { status, label } = outcomeCertaintyEpistemic({ gradeStatus, legacyGrade });
  return <EpistemicStatus status={status}>{label}</EpistemicStatus>;
}
