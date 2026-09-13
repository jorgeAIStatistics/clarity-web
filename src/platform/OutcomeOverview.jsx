import React, { useState } from 'react';
export default function OutcomeOverview({
  model
}) {
  const names = [...new Set(model.outcomes.map(o => o.name))],
    [selected, setSelected] = useState(names[0] || '');
  const current = names.includes(selected) ? selected : names[0],
    outcomes = model.outcomes.filter(o => o.name === current),
    analysis = model.analysis?.outcomes?.find(o => o.name === current);
  if (!names.length) return null;
  return <section className="pb-section"><span className="hp-eyebrow">ANSWER / OUTCOME CONTEXT</span><label>Which outcome matters?<select value={current} onChange={e => setSelected(e.target.value)}>{names.map(n => <option key={n}>{n}</option>)}</select></label><div className="profile-signals"><span><strong>Certainty — {current}</strong>{analysis?.grade_status === 'refresh_required' ? 'Appraisal refresh needed' : analysis?.legacy_grade || (/appraisal|pending/i.test(outcomes[0]?.grade || '') ? 'Certainty not appraised' : outcomes[0]?.grade) || 'Outcome appraisal incomplete'}</span><span><strong>Magnitude</strong>{outcomes.filter(o => o.effectQuote).map(o => o.effect).join(' · ') || 'Effect magnitude not reliably extractable'}</span></div><a href={model.type === 'Intervention' ? '#outcome-analysis' : '#brief-outcomes'}>Inspect source-specific findings and passages ↓</a><p className="pb-note">Studied population: {[...new Set(outcomes.map(o => o.population).filter(Boolean))].join(' · ') || 'Inspect the individual reports.'}</p><p className="pb-note">Primary limitation: {model.limitations[0] || 'Applicability requires source review.'}</p>{/vitamin d/i.test(model.name) && <p className="pb-note">Keep baseline deficiency and the studied indication explicit. Findings in one setting do not establish benefit in another.</p>}</section>;
}
