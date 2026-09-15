// Effect-measure families. A family fixes the axis scale, the no-difference value and whether
// an estimate has a direction at all. Different families never share an axis and are never converted.
const family = (key, label, pattern, scale, nullValue, noun) => ({ key, label, pattern, scale, nullValue, directional: nullValue != null, noun });
export const FAMILIES = [
  family('c_index_change', 'Δ C-index', /(?:Δ|delta|change in|increment\w*)\s*(?:in\s+)?(?:the\s+)?(?:c[- ]?index|c[- ]?statistic|auc)|(?:c[- ]?index|c[- ]?statistic|auc)\s*(?:change|difference|increase|gain|improvement)/i, 'linear', 0, 'C-index'),
  family('hr', 'HR', /hazard ratio|^a?hrs?$/i, 'log', 1, 'hazard'),
  family('irr', 'IRR', /rate ratio|^irr$/i, 'log', 1, 'rate'),
  family('or', 'OR', /odds ratio|^a?or$/i, 'log', 1, 'odds'),
  family('rr', 'RR', /risk ratio|relative risk|^a?rr$/i, 'log', 1, 'risk'),
  family('smd', 'SMD', /standardi[sz]ed mean difference|^smd$|hedges'? ?g|cohen'?s? ?d/i, 'linear', 0, 'standardized difference'),
  family('md', 'Mean difference', /mean difference|^w?md$|difference in means/i, 'linear', 0, 'difference'),
  family('rd', 'Risk difference', /risk difference|^rd$/i, 'linear', 0, 'absolute risk'),
  family('beta', 'β', /^(?:β|beta|regression coefficient|coefficient)$/i, 'linear', 0, 'coefficient'),
  family('c_index', 'C-index', /^(?:c[- ]?index|c[- ]?statistic|auc|auroc|area under the (?:roc )?curve)$/i, 'linear', null),
  family('sensitivity', 'Sensitivity', /sensitivity/i, 'linear', null),
  family('specificity', 'Specificity', /specificity/i, 'linear', null),
  family('partial_eta2', 'Partial η²', /partial\s*(?:η|eta)/i, 'linear', null),
];

export function measureFamily(text) {
  const value = String(text || '').trim();
  return value ? FAMILIES.find(f => f.pattern.test(value)) || null : null;
}

// Look for a measure named inside a column header such as "HR (95% CI)" or "Hazard ratio".
export function headerFamily(header) {
  const text = String(header || '');
  return measureFamily(text) || text.split(/[\s()[\],;:/_-]+/).map(measureFamily).find(Boolean) || null;
}

// Reported values are shown as reported; only derived percentages are rounded.
export const num = v => Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '';

export function validInterval(fam, point, lower, upper) {
  if (!fam || !Number.isFinite(point)) return false;
  if (fam.scale === 'log' && point <= 0) return false;
  if (lower == null && upper == null) return true;
  return Number.isFinite(lower) && Number.isFinite(upper) && lower <= point && point <= upper && (fam.scale !== 'log' || lower > 0);
}

export function intervalSide(fam, lower, upper) {
  if (!fam?.directional || !Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  return upper < fam.nullValue ? 'below' : lower > fam.nullValue ? 'above' : 'includes';
}

// Units in source extractions are often descriptions ("per 1 mmol/L reduction"); only short units are appended.
export function shortUnit(unit) {
  const text = String(unit || '').trim();
  return text && text.length <= 12 && /^[a-zµ%/·.\d² ]+$/i.test(text) ? text : '';
}

const proportion = v => (v <= 1 ? v * 100 : v);
const pct = v => `${Math.round(v)}%`;

// Plain words for one estimate. `magnitude` states size and direction; `interval` states precision.
export function describeEffect({ fam, point, lower, upper, level, unit }) {
  if (!fam || !Number.isFinite(point)) return { side: null, magnitude: 'no usable numerical estimate', interval: '', number: '' };
  const hasInterval = Number.isFinite(lower) && Number.isFinite(upper);
  const number = `${fam.label} ${num(point)}${hasInterval ? ` (${level ? `${num(level)}% ` : ''}CI ${num(lower)} to ${num(upper)})` : ''}`;
  if (!fam.directional) {
    const magnitude = fam.key === 'partial_eta2' ? `a partial η² of ${num(point)}, a variance-explained measure with no direction`
      : fam.key === 'c_index' ? `a C-index of ${num(point)} (0.5 is chance, 1 is perfect)`
      : `${fam.label.toLowerCase()} of ${pct(proportion(point))}${hasInterval ? ` (${pct(proportion(lower))}–${pct(proportion(upper))})` : ''}`;
    return { side: null, magnitude, interval: hasInterval ? '' : 'no interval reported', number, pointOnly: !hasInterval };
  }
  const side = hasInterval ? intervalSide(fam, lower, upper) : null;
  let magnitude;
  if (fam.scale === 'log') {
    const change = Math.round(Math.abs(1 - point) * 100);
    magnitude = point >= 2 ? `${num(point)} times the ${fam.noun}` : change === 0 ? `no difference in ${fam.noun} at the point estimate` : `${change}% ${point < 1 ? 'lower' : 'higher'} ${fam.noun}`;
  } else if (fam.key === 'c_index_change') {
    magnitude = point === 0 ? 'no change in the C-index' : `a C-index ${point < 0 ? 'fall' : 'gain'} of ${num(Math.abs(point))} on a 0.5–1 scale`;
  } else if (fam.key === 'smd') {
    const size = Math.abs(point) < 0.2 ? 'very small' : Math.abs(point) < 0.5 ? 'small' : Math.abs(point) < 0.8 ? 'moderate' : 'large';
    magnitude = `a ${size} standardized difference by conventional benchmarks (${point < 0 ? 'lower' : 'higher'})`;
  } else {
    const u = shortUnit(unit);
    magnitude = point === 0 ? 'no difference at the point estimate' : `${point < 0 ? 'lower' : 'higher'} by ${num(Math.abs(point))}${u ? ` ${u}` : ''}`;
  }
  const interval = !hasInterval ? 'no interval reported, so precision is unknown'
    : side === 'includes' ? 'the interval also includes no difference'
    : 'the interval excludes no difference';
  return { side, magnitude, interval, number, pointOnly: !hasInterval };
}

// Summary across estimates that share one family. Returns a phrase and a consistency label.
export function summarizeSides(estimates) {
  const sides = { below: 0, above: 0, includes: 0, point: 0 };
  for (const e of estimates) {
    const side = intervalSide(e.fam, e.lower, e.upper);
    if (side) sides[side]++; else sides.point++;
  }
  const consistency = sides.below && sides.above ? 'conflicting'
    : sides.includes && !sides.below && !sides.above ? 'includes_null'
    : (sides.below || sides.above) && !sides.includes && !sides.point ? 'consistent'
    : sides.below || sides.above ? 'mixed' : 'point_only';
  return { sides, consistency };
}
