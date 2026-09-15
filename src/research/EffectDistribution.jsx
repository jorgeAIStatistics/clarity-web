import React, { useState } from 'react';
import { effectDistribution } from './figureModel.js';
import { safeSource } from '../platform/profileModel.js';
import { num } from '../evidence/measures.js';
export default function EffectDistribution({ panel }) {
  const [selected, setSelected] = useState(null);
  const distributions = effectDistribution(panel.published, panel.user);
  return distributions.map(d => {
    const log = panel.fam.scale === 'log', transform = x => log ? Math.log(x) : x;
    const all = [...d.values, ...d.user];
    if (log && all.some(r => r.point <= 0)) return null;
    const min = Math.min(...all.map(r => transform(r.point))), max = Math.max(...all.map(r => transform(r.point)));
    const x = value => 40 + 540 * (transform(value) - min) / (max - min || 1);
    const active = d.values.find(r => r.id === selected);
    return <figure key={d.key} className="qm-forest">
      <figcaption><strong>The middle half of these {d.values.length} reported effects lies between {num(d.lower)} and {num(d.upper)}.</strong><span>Descriptive median and IQR · {log ? 'log' : 'linear'} axis · {panel.fam.label}</span></figcaption>
      <svg viewBox="0 0 620 150" role="group" aria-label="Distribution of reported study effect estimates">
        <line x1="40" x2="580" y1="75" y2="75" stroke="#628494" />
        <rect x={x(d.lower)} y="45" width={Math.max(1, x(d.upper) - x(d.lower))} height="60" fill="#236765" stroke="#77d6c4" />
        <line x1={x(d.median)} x2={x(d.median)} y1="40" y2="110" stroke="#ffffff" strokeWidth="3" />
        {d.values.map((r, i) => <a key={r.id} href={safeSource(r.url) || undefined} target="_blank" rel="noreferrer" onFocus={() => setSelected(r.id)} onMouseEnter={() => setSelected(r.id)} aria-label={`PMID ${r.pmid}, estimate ${num(r.point)}${d.outliers.includes(r) ? ', descriptive outlier' : ''}. Open source.`}><circle cx={x(r.point)} cy={120 + (i % 2) * 10} r="5" fill={d.outliers.includes(r) ? '#edb879' : '#9ddfd6'} /><title>{r.quote}</title></a>)}
        {d.user.map(r => <path key={r.id} d={`M ${x(r.point)} 8 l 7 7 l -7 7 l -7 -7 Z`} fill="#ceaeff"><title>Your aggregate result: {num(r.point)}</title></path>)}
        <text x="40" y="28" fill="#bed1dc">{num(all.reduce((a,r) => Math.min(a,r.point),Infinity))}</text><text x="580" y="28" textAnchor="end" fill="#bed1dc">{num(all.reduce((a,r) => Math.max(a,r.point),-Infinity))}</text>
      </svg>
      {active && <blockquote>{active.quote}</blockquote>}
      <p className="qm-note">Limits: no pooled effect, precision weighting, patient-level distribution or new meta-analysis. Outliers use the descriptive 1.5 × IQR rule.</p>
      <p className="qm-note">The box summarizes reported study effects with matching recorded outcome, measure, unit, population, exposure, comparator and timepoint. Matching recorded labels does not rule out confounding or shared participants, and association does not establish clinical utility. {d.user.length ? d.user.map(r => `Your result is ${r.point >= d.lower && r.point <= d.upper ? 'inside' : 'outside'} the reported interquartile range.`).join(' ') : 'No sufficiently matched uploaded row is overlaid.'} Source extraction is automated; the quartiles are calculated descriptively.</p>
    </figure>;
  });
}
