import { intervalSide, num } from '../evidence/measures.js';
// Descriptive effect distributions require matching context, not just matching measure labels.
export function comparableKey(row) {
  const fields = [row.outcome, row.fam?.key, row.unit, row.population, row.exposure, row.comparator, row.timepoint];
  return fields.every(x => typeof x === 'string' && x.trim()) ? fields.map(x => x.trim().toLowerCase()).join('|') : null;
}
export function effectDistribution(rows, user = []) {
  const groups = new Map();
  for (const r of rows) {
    const key = comparableKey(r);
    if (!key || !Number.isFinite(r.point) || !r.pmid || !r.quote) continue;
    if (!groups.has(key)) groups.set(key, new Map());
    // Multiple endpoints/arms in one paper must not multiply the distribution's weight.
    const group = groups.get(key);
    if (group.has(r.pmid)) group.set(r.pmid, null); else group.set(r.pmid, r);
  }
  return [...groups].flatMap(([key, entries]) => {
    const values = [...entries.values()].filter(Boolean).sort((a, b) => a.point - b.point);
    if (values.length < 5) return [];
    const q = p => { const index = (values.length - 1) * p, lo = Math.floor(index); return values[lo].point + (values[Math.ceil(index)].point - values[lo].point) * (index - lo); };
    const median = q(.5), lower = q(.25), upper = q(.75), spread = upper - lower;
    return [{ key, values, median, lower, upper, outliers: values.filter(r => r.point < lower - 1.5 * spread || r.point > upper + 1.5 * spread), user: user.filter(r => comparableKey(r) === key) }];
  });
}

// Meaning-first caption for a forest strip, computed only from the plotted records.
export function forestCaption(panel) {
  const published = panel.published, label = panel.fam.label;
  if (!published.length) return `Your ${label} is shown on its own: no published estimate uses this measure for this outcome and question type.`;
  const lead = published.length === 1 ? `One published ${label} estimate` : `${published.length} published ${label} estimates`;
  let detail;
  if (!panel.fam.directional) {
    const values = published.map(e => e.point);
    detail = published.length === 1 ? ` of ${num(values[0])}` : ` range from ${num(Math.min(...values))} to ${num(Math.max(...values))}`;
  } else {
    const withInterval = published.filter(e => Number.isFinite(e.lower));
    const sides = { below: 0, above: 0, includes: 0 };
    for (const e of withInterval) { const side = intervalSide(e.fam, e.lower, e.upper); if (side) sides[side]++; }
    const parts = [sides.below && `${sides.below} below`, sides.above && `${sides.above} above`, sides.includes && `${sides.includes} spanning`].filter(Boolean);
    detail = !withInterval.length ? ' are shown without intervals, so precision is unknown' : `: ${parts.join(', ')} no difference${withInterval.length < published.length ? ` (${published.length - withInterval.length} without an interval)` : ''}`;
  }
  const user = panel.comparison?.[0] ? ` Your estimate sits ${panel.comparison[0].position}.` : '';
  // A treatment forest is the easiest figure to misread as marker-guided care; say so in the caption itself.
  const utility = panel.mode === 'Treatment outcomes' && panel.marker ? ` These are treatment effects, not evidence that ${panel.marker}-guided care improves outcomes.` : '';
  return `${lead}${detail}.${user}${utility}`;
}

const MODE_LIMITS = {
  Association: 'These are observational results: confounding and different exposure contrasts can explain differences, and an association does not show that acting on the marker helps.',
  Prediction: 'These compare risk models; a change in discrimination does not show that decisions or outcomes improve.',
  'Treatment outcomes': 'Each trial compares a specific treatment and comparator; it does not show that measuring a marker improves care.',
  'Diagnostic performance': 'Accuracy depends on the threshold and reference standard, and accuracy is not clinical benefit.',
};
// Two to four plain sentences: what the figure shows, what it cannot show, the uploaded row, review state.
export function forestInterpretation(panel) {
  const reviewed = panel.published.filter(e => e.review === 'reviewed').length;
  return [
    `Each row is one reported estimate with its interval on a ${panel.fam.scale === 'log' ? 'logarithmic' : 'linear'} axis${panel.fam.nullValue != null ? '; the dashed line marks no difference' : ''}.`,
    MODE_LIMITS[panel.mode] || 'Estimates come from different studies and are not directly comparable without checking their populations and contrasts.',
    panel.user.length ? 'The diamond is your uploaded aggregate result; the computed comparison below is descriptive, not a statistical test.' : 'No uploaded result is overlaid on this measure.',
    reviewed ? `${reviewed} of ${panel.published.length} estimates come from reviewed records; the rest are automated extractions.` : 'All estimates are automated source extractions; none has been expert-reviewed.',
  ].join(' ');
}
