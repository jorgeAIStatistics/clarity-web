import React, { useState } from 'react';
import EpistemicStatus, { OutcomeCertainty } from '../evidence/EpistemicStatus.jsx';
export default function OutcomeOverview({
  model
}) {
  const names = [...new Set(model.outcomes.map(o => o.name))],
    [selected, setSelected] = useState(names[0] || '');
  const current = names.includes(selected) ? selected : names[0],
    outcomes = model.outcomes.filter(o => o.name === current),
    analysis = model.analysis?.outcomes?.find(o => o.name === current);
  if (!names.length) return null;
  return <section className="pb-section"><span className="hp-eyebrow">ANSWER / OUTCOME CONTEXT</span><label>Which outcome matters?<select value={current} onChange={e => setSelected(e.target.value)}>{names.map(n => <option key={n}>{n}</option>)}</select></label><div className="profile-signals"><span><strong>Certainty — {current}</strong><OutcomeCertainty gradeStatus={analysis?.grade_status} legacyGrade={analysis?.legacy_grade || (/appraisal|pending/i.test(outcomes[0]?.grade || '') ? null : outcomes[0]?.grade)} /></span><span><strong>Magnitude</strong>{outcomes.filter(o => o.effectQuote).map(o => o.effect).join(' · ') || <EpistemicStatus status="not_extracted">No extracted estimate</EpistemicStatus>}</span></div><a href={model.type === 'Intervention' ? '#outcome-analysis' : '#brief-outcomes'}>Inspect source-specific findings and passages ↓</a><p className="pb-note">Studied population: {[...new Set(outcomes.map(o => o.population).filter(Boolean))].join(' · ') || 'Inspect the individual reports.'}</p><p className="pb-note">Primary limitation: {model.limitations[0] || 'Applicability requires source review.'}</p>{/vitamin d/i.test(model.name) && <p className="pb-note">Keep baseline deficiency and the studied indication explicit. Findings in one setting do not establish benefit in another.</p>}</section>;
}
