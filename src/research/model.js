import { researchInputError } from '../platform/tabular.js';
export const VERSION = 'research-workspace-v1';
export const FIELDS = {
  population: 'Population / model',
  exposure: 'Intervention / exposure',
  comparator: 'Comparator / reference standard',
  outcome: 'Primary outcome construct',
  instrument: 'Outcome instrument / assay',
  design: 'Study design',
  dose: 'Dose / concentration',
  duration: 'Exposure duration',
  timepoint: 'Outcome timepoint',
  metric: 'Effect metric',
  species: 'Species / human / cell',
  units: 'Effect units / contrast',
  inclusion: 'Inclusion / exclusion',
  n: 'Sample size',
  demographics: 'Demographics',
  confounders: 'Covariates / confounding structure',
  method: 'Analysis method',
  setting: 'Setting',
  secondary: 'Secondary endpoints',
  strain: 'Strain / cell line',
  route: 'Route',
  culture: 'Culture conditions',
  censoring: 'Censoring',
  repeated: 'Repeated measures'
};
export const DIMENSIONS = ['population', 'exposure', 'comparator', 'outcome', 'instrument', 'design', 'dose', 'duration', 'timepoint', 'species', 'metric'];
const norm = x => String(x || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const words = x => new Set(norm(x).split(' ').filter(w => w.length > 2 && !['the', 'and', 'with', 'for', 'human', 'study'].includes(w)));
export function blankProject() {
  return {
    schema: 1,
    id: crypto.randomUUID(),
    title: 'Untitled research project',
    stage: 'planning',
    text: '',
    hypothesis: '',
    definition: Object.fromEntries(Object.keys(FIELDS).map(k => [k, ''])),
    confirmed: false,
    result: null,
    decisions: {},
    overrides: {},
    userResult: {
      metric: 'hazard ratio',
      estimate: '',
      lower: '',
      upper: '',
      confidence_level: '95'
    },
    comparisonConfirmed: false,
    notes: '',
    audit: [],
    savedAt: null
  };
}
export function suggestDefinition(text) {
  const d = Object.fromEntries(Object.keys(FIELDS).map(k => [k, '']));
  for (const k of Object.keys(d)) {
    const m = text.match(new RegExp('(?:^|\\n)' + k + ':\\s*([^\\n]+)', 'i'));
    if (m) d[k] = m[1].trim();
  }
  const statement = text.match(/(?:my|our) study (?:tests|examines|investigates) (.+?) (?:on|for) (.+?) in (.+?)(?:[.;\n]|$)/i);
  if (statement) {
    d.exposure ||= statement[1];
    d.outcome ||= statement[2];
    d.population ||= statement[3];
  }
  d.population ||= text.match(/\b(?:adults|children|healthy volunteers|postmenopausal women)\b/i)?.[0] || '';
  d.design ||= text.match(/\b(?:randomized controlled trial|prospective cohort|case-control study|cross-sectional study|diagnostic accuracy study|in vitro study)\b/i)?.[0] || '';
  return d;
}
export function validateProject(p) {
  return researchInputError([p.text, p.hypothesis, ...Object.values(p.definition)].join('\n')) || (!p.definition.exposure || !p.definition.outcome ? 'Specify an exposure and primary outcome before confirming.' : '');
}
export function dimension(a, b) {
  if (!a || !b) return {
    state: 'unknown',
    label: !a ? 'Not specified in my study' : 'Not reported / extracted'
  };
  if (norm(a) === norm(b)) return {
    state: 'exact',
    label: 'Same recorded wording'
  };
  const x = words(a),
    y = words(b);
  const shared = [...x].filter(w => y.has(w));
  return shared.length ? {
    state: 'partial',
    label: 'Partial wording overlap — review required'
  } : {
    state: 'different',
    label: 'Different recorded wording'
  };
}
export function studyDefinition(s, f) {
  return {
    population: f?.population || s.population || '',
    exposure: f?.exposure || s.exposure || '',
    comparator: f?.comparator || s.comparator || '',
    outcome: f?.outcome || '',
    metric: f?.effect?.measure || '',
    units: f?.effect?.units || '',
    design: s.design || '',
    n: s.n ?? '',
    species: ['observational', 'interventional'].includes(s.layer) ? 'human' : s.layer === 'preclinical' ? 'animal' : s.layer === 'mechanism' ? 'cell' : '',
    ...Object.fromEntries(['dose', 'duration', 'timepoint', 'instrument'].map(k => [k, s[k] || '']))
  };
}
export function matchedRows(p) {
  return (p.result?.studies || []).flatMap(s => (s.findings?.length ? s.findings : [null]).map((f, i) => {
    const id = s.id + ':' + i,
      original = studyDefinition(s, f),
      mapped = {
        ...original,
        ...p.overrides[id]
      },
      dimensions = Object.fromEntries(DIMENSIONS.map(k => [k, dimension(p.definition[k], mapped[k])])),
      exact = Object.values(dimensions).filter(x => x.state === 'exact').length,
      known = Object.values(dimensions).filter(x => x.state !== 'unknown').length;
    const direct = ['population', 'exposure', 'comparator', 'outcome', 'design', 'timepoint'].every(k => dimensions[k].state === 'exact');
    return {
      id,
      study: s,
      finding: f,
      numeric_provenance: f?.effect ? {
        original_value: f.effect,
        harmonized_value: null,
        transformation: 'none',
        origin: f.effect.origin === 'reported' ? 'ABSTRACT EXTRACTED' : 'NOT ELIGIBLE',
        source_id: s.id,
        source_span: f.source_span || null,
        quote: f.quote
      } : null,
      original,
      mapped,
      dimensions,
      exact,
      known,
      lane: s.layer === 'preclinical' ? 'Animal / translational' : s.layer === 'mechanism' ? 'Cell / mechanistic' : ['guidelines', 'synthesis', 'protocol'].includes(s.layer) ? 'Methods / synthesis / reference' : ['observational', 'interventional'].includes(s.layer) ? direct ? 'Direct human candidate' : 'Adjacent human' : 'Unclassified',
      decision: p.decisions[id]?.status || 'undecided',
      reason: p.decisions[id]?.reason || ''
    };
  })).sort((a, b) => b.exact - a.exact || b.known - a.known);
}
export const RATIOS = ['hazard ratio', 'risk ratio', 'odds ratio', 'rate ratio', 'adjusted relative risk'];
export const LINEAR = ['mean difference', 'risk difference', 'regression coefficient'];
export function validEffect(e) {
  return !!e && [e.estimate, e.lower, e.upper, e.confidence_level].every(v => typeof v === 'number' && Number.isFinite(v)) && e.lower <= e.estimate && e.estimate <= e.upper && e.lower < e.upper && e.confidence_level > 0 && e.confidence_level < 100 && (!RATIOS.includes(e.measure) || e.lower > 0);
}
export function quantitativeGate(p, rows) {
  const selected = rows.filter(r => r.decision === 'include'),
    reasons = [];
  if (!p.confirmed) reasons.push('Confirm the Study Definition.');
  if (p.matchedDefinition && p.matchedDefinition !== JSON.stringify(p.definition)) reasons.push('Study Definition changed after retrieval. Match the confirmed study again.');
  if (!p.comparisonConfirmed) reasons.push('Confirm applicability and extraction review for the included records.');
  if (selected.some(r => !r.reason.trim())) reasons.push('Document an inclusion rationale and source location for each included record.');
  if (!selected.length) reasons.push('Include at least one reported estimate.');
  const keys = ['population', 'exposure', 'comparator', 'outcome', 'design', 'timepoint', 'species', 'metric', 'units'];
  for (const r of selected) {
    if (!r.finding?.quote || r.finding.effect?.origin !== 'reported' || !validEffect(r.finding.effect)) reasons.push(`${r.study.id}: a reported estimate and valid interval are required.`);
    if (!['observational', 'interventional', 'preclinical', 'mechanism'].includes(r.study.layer)) reasons.push(`${r.study.id}: syntheses, guidance and unclassified records stay outside primary-study plotting.`);
    for (const k of keys) if (!r.mapped[k] || !p.definition[k] || norm(r.mapped[k]) !== norm(p.definition[k])) reasons.push(`${r.study.id}: confirm matching ${FIELDS[k] || k}.`);
    if (r.finding && !RATIOS.includes(r.finding.effect.measure) && !LINEAR.includes(r.finding.effect.measure)) reasons.push(`${r.study.id}: this metric is not enabled for interval comparison.`);
  }
  if (new Set(selected.map(r => r.study.layer)).size > 1) reasons.push('Evidence layers must remain separate.');
  const ids = selected.map(r => r.study.cohort_id || r.study.id);
  if (new Set(ids).size < ids.length) reasons.push('Potentially overlapping participants or multiple estimates from one study: select one independent estimate per cohort.');
  return {
    eligible: !reasons.length,
    reasons: [...new Set(reasons)],
    selected,
    pooling: 'Not appropriate to pool: independent risk-of-bias appraisal and a prespecified synthesis plan are not available. This release provides non-pooled comparison only.'
  };
}
export function overlay(p, gate) {
  const u = p.userResult,
    e = {
      measure: u.metric,
      estimate: Number(u.estimate),
      lower: Number(u.lower),
      upper: Number(u.upper),
      confidence_level: Number(u.confidence_level)
    };
  if (!gate.eligible || [u.estimate, u.lower, u.upper].some(x => x === '') || !validEffect(e) || norm(e.measure) !== norm(p.definition.metric)) return {
    eligible: false,
    note: 'Supply a valid estimate/interval in the confirmed effect metric after the literature comparison passes its gates.'
  };
  const nullValue = RATIOS.includes(e.measure) ? 1 : 0;
  return {
    eligible: true,
    effect: e,
    comparisons: gate.selected.map(r => ({
      id: r.id,
      sameDirection: Math.sign(e.estimate - nullValue) === Math.sign(r.finding.effect.estimate - nullValue),
      intervalOverlap: e.lower <= r.finding.effect.upper && r.finding.effect.lower <= e.upper
    })),
    note: 'Descriptive comparison only. Confidence-interval overlap is not a formal test of difference, equivalence or replication.'
  };
}
export function interpretation(p, rows) {
  const included = rows.filter(r => r.decision === 'include'),
    unknown = DIMENSIONS.map(k => ({
      key: k,
      count: included.filter(r => r.dimensions[k].state === 'unknown').length
    })).filter(x => x.count).sort((a, b) => b.count - a.count);
  return {
    dominant: unknown.length ? `${unknown[0].count} included records lack a comparable ${FIELDS[unknown[0].key].toLowerCase()}. Resolve that variable from the original reports before treating differences in estimates as disagreement.` : included.length ? 'Inspect adjustment sets, measurement definitions and participant overlap before attributing differences to biology.' : 'Make inclusion decisions to identify the dominant comparability limitations.',
    contribution: 'Contribution is a review question, not an automatic novelty claim. Document whether your study extends a population, validates a method or replicates a specified endpoint; absence from this selected retrieval cannot establish novelty.',
    differences: DIMENSIONS.map(k => ({
      key: k,
      values: [...new Set(included.map(r => r.mapped[k]).filter(Boolean))]
    })).filter(x => x.values.length > 1)
  };
}
export function toCSV(rows) {
  const cols = ['study', 'layer', 'population', 'exposure', 'comparator', 'outcome', 'metric', 'estimate', 'lower', 'upper', 'confidence_level', 'decision', 'reason', 'source', 'numeric_provenance', 'user_mapped_fields'];
  return [cols, ...rows.map(r => [r.study.id, r.study.layer, r.mapped.population, r.mapped.exposure, r.mapped.comparator, r.mapped.outcome, r.finding?.effect?.measure, r.finding?.effect?.estimate, r.finding?.effect?.lower, r.finding?.effect?.upper, r.finding?.effect?.confidence_level, r.decision, r.reason, r.study.url, r.numeric_provenance?.origin||'NOT REPORTED', Object.keys(r.mapped).filter(k=>r.mapped[k]!==r.original[k]).join('; ')])].map(row => row.map(x => '"' + (typeof x==='number'?String(x):String(x ?? '').replace(/^[=+@-]/, "'$&")).replaceAll('"', '""') + '"').join(',')).join('\r\n');
}
