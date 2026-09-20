import React from 'react';
import QuestionMap from '../research/QuestionMap.jsx';
import '../design/matcher-instrument.css';
const Workspace = React.lazy(() => import('../research/Workspace.jsx'));

// The question map is the landing view; the row-level study workspace stays one link away.
export default function EvidenceMatcher() {
  if (new URLSearchParams(window.location.search).get('mode') !== 'workspace') return <QuestionMap />;
  return <React.Suspense fallback={<p role="status">Loading the study workspace…</p>}><p className="qm-back"><a href="/explore/matcher">← Back to the question map</a></p><Workspace /></React.Suspense>;
}
