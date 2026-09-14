import React from 'react';
import './epistemic.css';

// One vocabulary for what is known, uncertain or missing. Each status pairs a mark
// with a label, so meaning never depends on color alone.
export const EPISTEMIC_STATUS = {
  established: 'Established',
  uncertain: 'Uncertain',
  conflicting: 'Conflicting',
  unappraised: 'Unappraised',
  not_reported: 'Not reported',
  not_extracted: 'Not yet extracted',
  not_assessed: 'Not assessed',
  not_searched: 'Not searched',
  searched_none_found: 'Searched · none found',
  legacy: 'Legacy automated tier',
};

export default function EpistemicStatus({ status, children, title }) {
  const known = status in EPISTEMIC_STATUS ? status : 'unappraised';
  return <span className={`es-chip es-${known}`} title={title}>{children ?? EPISTEMIC_STATUS[known]}</span>;
}
