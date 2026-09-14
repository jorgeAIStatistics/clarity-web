import { studyLayer } from '../platform/profileModel.js';
export const UNKNOWN = 'Not extracted';
export const NOT_ASSESSED = 'Not assessed';
// Engine span offsets are Unicode code points (Python str indices), not UTF-16 units.
export function sliceCodePoints(text, start, end) {
  return typeof text === 'string' && Number.isInteger(start) && Number.isInteger(end) ? Array.from(text).slice(start, end).join('') : undefined;
}
// Default outcome order. No human certainty assessments exist yet and most sample sizes are
// unextracted, so outcomes rank by linked human interventional records, then human observational
// records, then all linked records, then whether a validated estimate exists. Ties keep source order.
// A single exploratory endpoint therefore never opens ahead of the main evidence body.
const layerCount = (o, layer) => o.rows.filter(r => r.layer === layer).length;
export function rankOutcomes(outcomes) {
  const key = o => [layerCount(o, 'interventional'), layerCount(o, 'observational'), o.rows.length, o.rows.some(r => r.effect) ? 1 : 0];
  return outcomes.map((o, i) => ({ o, i, k: key(o) })).sort((a, b) => {
    for (let j = 0; j < a.k.length; j++) if (a.k[j] !== b.k[j]) return b.k[j] - a.k[j];
    return a.i - b.i;
  }).map(x => x.o);
}
export const labels = {
  hr: 'HR',
  rr: 'RR',
  or: 'OR',
  rate_ratio: 'Rate ratio',
  mean_diff: 'Mean difference',
  smd: 'SMD',
  risk_diff: 'Risk difference', partial_eta_squared: 'Partial η²'
};
const metricOf = m => ({
  'hazard ratio': 'hr',
  'risk ratio': 'rr',
  'relative risk': 'rr',
  'odds ratio': 'or',
  'mean difference': 'mean_diff',
  'standardized mean difference': 'smd',
  'rate ratio': 'rate_ratio', 'partial eta squared': 'partial_eta_squared'
})[m?.toLowerCase()] || m;
export const ratio = m => ['hr', 'rr', 'or', 'rate_ratio'].includes(m);
export function validPoint(e) {return Boolean(e && labels[e.metric] && typeof e.estimate === 'number' && Number.isFinite(e.estimate) && (!ratio(e.metric) || e.estimate > 0));}
export function intervalText(e) {return validEstimate(e) ? `${e.interval_level ? e.interval_level+'% ' : ''}CI ${e.lower}–${e.upper}` : 'Interval not reported';}
export function validEstimate(e) {
  return e && Boolean(labels[e.metric]) && [e.estimate, e.lower, e.upper].every(x => typeof x === 'number' && Number.isFinite(x)) && e.lower <= e.estimate && e.estimate <= e.upper && (!ratio(e.metric) || e.lower > 0);
}
export function magnitude(e) {
  return validPoint(e) ? `${labels[e.metric] || e.measure || 'Estimate'} ${e.estimate}${!ratio(e.metric) && e.metric!=='partial_eta_squared' && e.unit ? ' ' + e.unit : ''}` : 'Magnitude awaiting validation';
}
export function precision(e) {
  if (!validEstimate(e)) return validPoint(e) ? 'The source reports a point estimate without a confidence interval. Precision cannot be inferred from its p-value.' : 'No validated interval is available; study volume cannot determine magnitude.';
  const n = ratio(e.metric) ? 1 : 0;
  if(e.lower===n || e.upper===n)return `The interval reaches ${n} (no difference). This boundary result does not establish equivalence.`;
  return e.lower < n && e.upper > n ? `The interval includes ${n} (no difference). Effects on either side remain compatible with these data; benefit and equivalence are not established.` : `The interval lies ${e.lower > n ? 'above' : 'below'} ${n}. Clinical importance depends on the endpoint, population and comparison.`;
}
export const direction = e => e?.metric==='partial_eta_squared' ? 'Non-directional effect size' : !validEstimate(e) ? 'Unresolved' : e.lower <= (ratio(e.metric) ? 1 : 0) && e.upper >= (ratio(e.metric) ? 1 : 0) ? 'Direction uncertain' : e.estimate > (ratio(e.metric) ? 1 : 0) ? 'Higher measured outcome' : 'Lower measured outcome';
export function buildReport(model, overlay, context) {
  const map = new Map(),
    get = name => {
      if (!map.has(name)) map.set(name, {
        name,
        grade: null,
        rows: [],
        candidates: [],
        withheld: [],
        reasons: []
      });
      return map.get(name);
    };
  // Exact, source-constrained endpoint records precede broad cached topic buckets.
  for (const s of [...(context?.studies || []), ...(overlay?.studies || [])]) for (const f of s.findings || []) {
    const o = get(f.outcome),
      metric = metricOf(f.effect?.measure),
      e = {
        ...f.effect,
        metric,
        unit: f.effect?.units,
        interval_level: f.effect?.confidence_level,
        quote: f.quote
      };
    const id = String(s.pmid || s.id).replace('pmid:', '');
    const row = {
      ...s,
      id,
      key: `${id}-${f.outcome}-${f.effect?.estimate}`,
      endpoint: f.outcome,
      conclusion: f.conclusion,
      neededEvidence: s.needed_evidence,
      layer: studyLayer(s),
      sample_size: s.n,
      population: s.population || UNKNOWN,
      baseline: s.baseline || UNKNOWN,
      dose: s.exposure || UNKNOWN,
      duration: s.duration || UNKNOWN,
      instrument: s.instrument || UNKNOWN,
      timepoint: s.timepoint || s.duration || UNKNOWN,
      rob: NOT_ASSESSED,
      effect: validPoint(e) && ((e.lower == null && e.upper == null) || validEstimate(e)) && f.effect.origin === 'reported' && f.quote && sliceCodePoints(s.abstract, f.source_span?.start, f.source_span?.end) === f.quote ? e : null,
      quote: f.quote,
      span: f.source_span,
      review: s.review_status || 'automated_appraisal',
      limitation: s.main_limitation || s.limitations?.[0],
      contextQuote: s.scope_passage?.text
    };
    if (!o.rows.some(r => r.key === row.key)) o.rows.push(row);
  }
  for (const a of model.analysis?.outcomes || []) {
    const o = get(a.name);
    o.grade = a.legacy_grade;
    o.reasons = model.outcomes?.find(x => x.name === a.name)?.limitations || [];
    o.withheld.push(...(a.withheld || []));
    o.candidates.push(...(a.effects || []));
    for (const s of a.studies || []) if (!o.rows.some(r => r.id === s.id)) o.rows.push({
      ...s,
      key: `${s.id}-${a.name}`,
      endpoint: a.name,
      population: s.population || UNKNOWN,
      baseline: UNKNOWN,
      dose: UNKNOWN,
      duration: UNKNOWN,
      instrument: UNKNOWN,
      timepoint: UNKNOWN,
      rob: NOT_ASSESSED,
      review: 'automated_appraisal'
    });
  }
  return [...map.values()];
}
export function filterRows(rows, filters) {
  return rows.filter(r => Object.entries(filters).every(([k, v]) => !v || (r[k] || UNKNOWN) === v));
}
export function scale(e) {
  const nullValue = ratio(e.metric) ? 1 : 0,
    transform = ratio(e.metric) ? Math.log : x => x;
  let lo = Math.min(transform(e.lower), transform(nullValue)),
    hi = Math.max(transform(e.upper), transform(nullValue));
  const pad = (hi - lo || 1) * .18;
  lo -= pad;
  hi += pad;
  return {
    x: v => 30 + (transform(v) - lo) / (hi - lo) * 540,
    nullValue
  };
}
export function sortRows(rows, order) {
  return [...rows].sort((a, b) => order === 'date' ? Number(b.year || 0) - Number(a.year || 0) : order === 'population' ? a.population.localeCompare(b.population) : order === 'directness' ? Number(Boolean(b.contextQuote)) - Number(Boolean(a.contextQuote)) : order === 'effect' ? a.effect?.metric === b.effect?.metric && a.effect?.unit === b.effect?.unit ? (a.effect?.estimate || 0) - (b.effect?.estimate || 0) : String(a.effect?.metric || 'z').localeCompare(b.effect?.metric || 'z') : 0);
}
