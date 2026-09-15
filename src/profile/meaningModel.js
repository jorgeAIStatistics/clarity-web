// Meaning-first reading of a profile: plain sentences built only from stored, source-checked fields.
// Every sentence is deterministic and labeled automated. When the stored fields cannot support a
// sentence, the reading says the data are insufficient instead of inventing an effect.
import { studyLayer } from '../platform/profileModel.js';
import { measureFamily, describeEffect, intervalSide, summarizeSides, validInterval, num } from '../evidence/measures.js';

export const READING_VERSION = 'meaning-reading-v1';
export const LAYERS = [
  { key: 'mechanism', label: 'Mechanism / biology', short: 'Mechanism', asks: 'Is there a plausible biological pathway?' },
  { key: 'preclinical', label: 'Preclinical / animal', short: 'Animal', asks: 'What happens in animal or laboratory models?' },
  { key: 'observational', label: 'Human observational', short: 'Observational', asks: 'Is it associated with outcomes in people?' },
  { key: 'interventional', label: 'Human interventional', short: 'Trials', asks: 'Does changing it change outcomes in people?' },
  { key: 'guidelines', label: 'Guidelines / regulation', short: 'Guidance', asks: 'What do guideline and regulatory bodies say?' },
];
export const BANDS = { none: 'No records', thin: 'Thin', some: 'Some', dense: 'Dense' };
// Record-count bands describe how much the library holds, never how strong the evidence is.
export function coverageBand(n) { return !n ? 'none' : n <= 2 ? 'thin' : n < 10 ? 'some' : 'dense'; }
export const KIND_LABELS = {
  favourable: 'Points to benefit · automated', association: 'Association only', prediction: 'Added prediction',
  treatment: 'Trial results', accuracy: 'Test accuracy', uncertain: 'Uncertain', conflicting: 'Conflicting',
  preclinical: 'Animal / lab only', not_assessed: 'Not yet assessed', review: 'Review & monitoring',
};

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
export function list(items) {
  const x = [...new Set(items.filter(Boolean))];
  return x.length <= 1 ? (x[0] || '') : x.length === 2 ? `${x[0]} and ${x[1]}` : `${x.slice(0, -1).join(', ')} and ${x.at(-1)}`;
}
// Lower-case only an ordinary capitalized first word, never acronyms such as HbA1c or RCT.
const lower = s => String(s || '').replace(/^[A-Z][a-z]+(?=[\s,;:.)-]|$)/, w => w.toLowerCase());
const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());
export const plainPopulation = p => String(p || '').replace(/^human;\s*/i, '').trim();
const short = (s, n = 90) => { const t = String(s || '').trim(); return t.length > n ? `${t.slice(0, n).replace(/[\s,;]+\S*$/, '')}…` : t; };
const article = w => /^(?:[aeiou]|RCT\b|HbA1c|FIT\b|MRI\b|LDL|HDL)/i.test(String(w || '')) ? 'an' : 'a';
const plainDesign = d => /^rct$/i.test(String(d || '').trim()) ? 'randomized controlled trial' : lower(d || 'study');
const describeStudy = e => { const d = plainDesign(e.design); return `${article(d)} ${d}${Number.isFinite(e.n) ? ` of ${e.n.toLocaleString('en-US')} participants` : ''}${e.population ? ` in ${e.population}` : ''}`; };
// Survival hazard ratios describe the event (death, recurrence or progression), not survival itself.
function eventOf(outcome) {
  const o = String(outcome || '');
  if (/progression[- ]free survival/i.test(o)) return `progression or death (${lower(o)})`;
  if (/(?:disease|recurrence|event)[- ]free survival/i.test(o)) return `recurrence or death (${lower(o)})`;
  if (/overall survival/i.test(o)) return `death (${lower(o)})`;
  return lower(o);
}
const escapeRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idOf = s => String(s?.pmid || s?.id || '').replace(/^pmid:/i, '');
const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null;

export function reviewState(statuses) {
  const values = statuses.filter(Boolean);
  const reviewed = values.filter(s => s === 'reviewed').length;
  if (values.length && reviewed === values.length) return { key: 'reviewed', label: 'Reviewed' };
  if (reviewed || values.includes('partially_reviewed')) return { key: 'partial', label: 'Partially reviewed' };
  return { key: 'automated', label: 'Automated' };
}

// Author conclusion from a retained abstract. Offsets are Unicode code points, matching engine spans.
const CONCLUSION_HEAD = /(?:^|[.\s])(?:CONCLUSIONS?(?: AND RELEVANCE)?|Conclusions?|INTERPRETATION|Interpretation)\s*[:.]\s*/g;
const CONCLUSION_SENTENCE = /\b(?:in conclusion|in summary|taken together|these (?:results|findings|data) (?:suggest|indicate|show|support|demonstrate)|our (?:results|findings) (?:suggest|indicate|show|support))\b/i;
const SENTENCE = /[^]*?[.!?](?=\s+[A-Z(]|\s*$)|[^]+$/y;
export function conclusionExcerpt(abstract) {
  if (typeof abstract !== 'string' || abstract.length < 40) return null;
  let start = -1, m, closing = false;
  CONCLUSION_HEAD.lastIndex = 0;
  while ((m = CONCLUSION_HEAD.exec(abstract))) start = m.index + m[0].length;
  if (start < 0) {
    const sentences = [...abstract.matchAll(/[^]*?[.!?](?=\s+[A-Z(]|\s*$)/g)];
    // Unstructured abstracts usually close on the authors' conclusion; label that sentence as what it is.
    const hit = sentences.filter(s => CONCLUSION_SENTENCE.test(s[0])).at(-1) || (/[.!?]\s*$/.test(abstract) ? sentences.at(-1) : null);
    if (!hit) return null;
    closing = !CONCLUSION_SENTENCE.test(hit[0]);
    start = hit.index + hit[0].search(/\S/);
  }
  let end = start;
  for (let i = 0; i < (closing ? 1 : 2) && end < abstract.length && end - start < 160; i++) {
    SENTENCE.lastIndex = end;
    const s = SENTENCE.exec(abstract);
    if (!s || !s[0]) break;
    end += s[0].length;
  }
  end = Math.min(end, start + 420);
  const raw = abstract.slice(start, end), text = raw.trim();
  if (text.length < 20) return null;
  const from = start + raw.search(/\S/), cp = i => Array.from(abstract.slice(0, i)).length;
  const result = { text, start: cp(from), end: cp(from) + Array.from(text).length, basis: closing ? 'Closing sentence of the abstract' : 'Author conclusion in the abstract' };
  return Array.from(abstract).slice(result.start, result.end).join('') === text ? result : null;
}

export function inferMode(fam, layer, text = '') {
  if (fam?.key === 'sensitivity' || fam?.key === 'specificity') return 'Diagnostic performance';
  if (fam?.key === 'c_index' || fam?.key === 'c_index_change') return 'Prediction';
  if (layer === 'interventional' || /random|placebo|trial\b/i.test(text)) return 'Treatment outcomes';
  return 'Association';
}

const usable = e => e && e.fam && validInterval(e.fam, e.point, e.lower, e.upper) && e.quote;
export function estimateFromRecord(r) {
  return { id: r.id, pmid: idOf(r), url: r.url, title: r.title, year: r.year, outcome: r.outcome, mode: r.mode, fam: measureFamily(r.metric), point: r.point, lower: r.lower, upper: r.upper, level: r.intervalLevel, unit: r.unit, n: r.n, population: plainPopulation(r.context?.population), exposure: r.context?.exposure, comparator: r.context?.comparator, layer: r.layer, design: r.design, quote: r.quote, cohort: r.cohort, review: 'automated_appraisal', source: 'Source-validated record' };
}
export function estimateFromFinding(s, f) {
  if (f.effect?.origin && f.effect.origin !== 'reported') return null;
  const fam = measureFamily(f.effect?.measure), layer = s.layer || studyLayer(s);
  return { id: `${idOf(s)}:${f.outcome}:${f.effect?.estimate}`, pmid: idOf(s), url: s.url, title: s.title, year: s.year, outcome: f.outcome, mode: inferMode(fam, layer, `${s.design || ''} ${s.title || ''}`), fam, point: f.effect?.estimate, lower: f.effect?.lower, upper: f.effect?.upper, level: f.effect?.confidence_level, unit: f.effect?.units, n: s.n, population: plainPopulation(s.population), exposure: s.exposure, comparator: s.comparator, layer, design: s.design, quote: f.quote, cohort: s.cohort_id, review: s.review_status, source: 'Quote-backed extraction' };
}
// The engine's time-span pattern also matches ages ("aged ≥50 years"); those are not durations.
const AGE_CONTEXT = /\b(?:aged?|older|younger)\b|years?[- ]old|years? of age|[≥≤<>]\s*\d/i;
export function mentionTexts(mentions = {}, key, source = '') {
  const chars = Array.from(source || '');
  return [...new Set((mentions[key] || []).filter(m => {
    if (key !== 'follow_up' || !chars.length || !/years?/i.test(m.text) || !Number.isInteger(m.start)) return true;
    return !AGE_CONTEXT.test(chars.slice(Math.max(0, m.start - 14), Math.min(chars.length, m.end + 8)).join(''));
  }).map(m => m.text))];
}
function estimateFromAnalysis(e, outcome, source) {
  const texts = k => mentionTexts(e.context_mentions || {}, k, source);
  return { id: `${e.pmid}:${outcome}:${e.estimate}`, pmid: String(e.pmid), url: e.url, title: e.title, year: e.year, outcome, mode: e.layer === 'observational' ? 'Association' : 'Treatment outcomes', fam: measureFamily(e.measure), point: e.estimate, lower: e.lower, upper: e.upper, level: e.interval_level, unit: e.unit, n: e.sample_size, population: texts('population').join('; '), exposure: texts('exposure').join('; '), duration: texts('follow_up').join('; '), comparator: e.comparator, layer: e.layer, design: e.design, quote: e.quote, review: 'automated_appraisal', source: 'Verified extraction', bucket: true };
}
export function mergeEstimates(...sources) {
  const out = new Map();
  for (const e of sources.flat()) {
    if (!usable(e)) continue;
    const key = `${e.pmid}|${normalize(e.outcome)}|${e.point}|${e.lower}|${e.upper}`;
    if (!out.has(key)) out.set(key, e);
  }
  return [...out.values()];
}
export function groupEstimates(estimates) {
  const outcomes = new Map();
  for (const e of estimates) {
    const o = outcomes.get(e.outcome) || { name: e.outcome, groups: new Map() };
    const key = `${e.mode}|${e.fam.key}`;
    if (!o.groups.has(key)) o.groups.set(key, { mode: e.mode, fam: e.fam, estimates: [] });
    o.groups.get(key).estimates.push(e);
    outcomes.set(e.outcome, o);
  }
  return [...outcomes.values()].map(o => ({ name: o.name, groups: [...o.groups.values()] }));
}

const trialWord = design => /crossover/i.test(design || '') ? 'randomized crossover trial' : /screening/i.test(design || '') ? 'randomized screening trial' : /random/i.test(design || '') ? 'randomized trial' : 'trial';
const pctOf = v => Math.round(v <= 1 ? v * 100 : v);
// Analysis-bucket estimates keep the engine's outcome grouping, so their words point to the quoted endpoint.
function effectPhrase(e, outcome) {
  const d = describeEffect(e), label = e.fam.label.toLowerCase(), o = e.bucket ? 'the endpoint quoted in the source' : lower(outcome);
  if (!e.fam.directional) {
    const lead = !e.bucket && o.startsWith(label) ? `${o} of ${d.magnitude.replace(new RegExp(`^${escapeRe(label)} of `), '')}` : `${d.magnitude} for ${o}`;
    return `${lead}${d.interval ? ` (${d.interval})` : ''}`;
  }
  const unit = String(e.unit || '').trim(), per = e.fam.scale === 'log' && /^per\s/i.test(unit) ? ` ${unit}` : '';
  return `${d.magnitude} ${e.fam.scale === 'log' ? `of ${e.bucket ? o : eventOf(outcome)}` : `in ${o}`}${per} (${d.interval})`;
}
function groupPhrase(group, outcome) {
  const { fam, estimates } = group, { sides, consistency } = summarizeSides(estimates), o = lower(outcome);
  if (fam.key === 'c_index_change') {
    const values = estimates.map(e => e.point), clear = sides.below + sides.above;
    return `C-index changes of ${num(Math.min(...values))} to ${num(Math.max(...values))} on a 0.5–1 scale for ${o} (${clear} of ${estimates.length} intervals ${clear === 1 ? 'excludes' : 'exclude'} no difference)`;
  }
  if (!fam.directional) {
    const values = estimates.map(e => e.point), pctScale = fam.key === 'sensitivity' || fam.key === 'specificity';
    const lo = Math.min(...values), hi = Math.max(...values), show = v => pctScale ? `${pctOf(v)}%` : num(v);
    return `${fam.label.toLowerCase()} values from ${show(lo)} to ${show(hi)} for ${o}`;
  }
  if (consistency === 'consistent') {
    const dir = sides.below ? 'lower' : 'higher';
    if (fam.scale === 'log') {
      const changes = estimates.map(e => Math.round(Math.abs(1 - e.point) * 100)), lo = Math.min(...changes), hi = Math.max(...changes);
      return `${lo === hi ? `${lo}%` : `${lo}–${hi}%`} ${dir} ${fam.noun} of ${eventOf(outcome)} in every estimate, each interval excluding no difference`;
    }
    return `${dir} values for ${o} in every estimate, each interval excluding no difference`;
  }
  if (consistency === 'conflicting') return `estimates for ${o} on both sides of no difference (${sides.below} lower, ${sides.above} higher${sides.includes ? `, ${sides.includes} compatible with no difference` : ''})`;
  if (consistency === 'includes_null') return `intervals for ${o} that all include no difference`;
  if (consistency === 'mixed') return `mixed results for ${o} (${sides.below + sides.above} excluding no difference, ${sides.includes + sides.point} not)`;
  return `point estimates for ${o} without intervals, so precision is unknown`;
}
function groupKind(group) {
  const { consistency } = summarizeSides(group.estimates);
  if (consistency === 'conflicting') return 'conflicting';
  if (!group.fam.directional && group.mode !== 'Diagnostic performance') return 'uncertain';
  if (group.fam.directional && ['includes_null', 'point_only'].includes(consistency)) return 'uncertain';
  return { Association: 'association', Prediction: 'prediction', 'Treatment outcomes': 'treatment', 'Diagnostic performance': 'accuracy' }[group.mode] || 'uncertain';
}

// One plain sentence for a set of estimates that share an outcome, question type and measure family.
export function groupMeaning(group, { name, type, outcome }) {
  const k = group.estimates.length, one = k === 1 ? group.estimates[0] : null, o = lower(outcome);
  const pop = one?.population && !/^(people|human)$/i.test(one.population) ? ` in ${short(lower(one.population), 80)}` : '';
  const what = one ? effectPhrase(one, outcome) : groupPhrase(group, outcome);
  const kind = groupKind(group);
  let text;
  if (group.mode === 'Association') {
    text = `${one ? `One observational analysis${pop} reports` : `${k} observational analyses report`} ${what}${one?.exposure ? `, for ${short(lower(one.exposure), 70)}` : ''}; an association alone does not show that changing ${name} changes ${o}.`;
  } else if (group.mode === 'Prediction') {
    text = one ? `One analysis${pop} reports ${what}, when ${short(lower(one.exposure || `${name} was added to a risk model`), 80)}.` : `${k} analyses report ${what} when a marker was added to existing risk models; the models differ, so read each one.`;
  } else if (group.mode === 'Diagnostic performance') {
    const measure = o.startsWith(group.fam.label.toLowerCase()) ? o : `${group.fam.label.toLowerCase()} for ${o}`;
    text = one ? `${cap(one.design ? `${article(plainDesign(one.design))} ${plainDesign(one.design)}` : 'one study')}${pop} reports ${measure} of ${describeEffect(one).magnitude.replace(/^\w+ of /, '')}; accuracy alone does not show that testing improves outcomes.` : `${k} studies report ${what}; accuracy alone does not show that testing improves outcomes.`;
  } else {
    const contrast = one?.exposure ? `, with ${short(lower(one.exposure), 70)}${one.comparator ? ` versus ${short(lower(one.comparator), 40)}` : ''}` : '';
    const synthesis = group.estimates.some(e => e.layer === 'synthesis');
    const subject = one ? `One ${one.layer === 'synthesis' ? plainDesign(one.design) : trialWord(one.design)}${pop}` : `${k} ${synthesis ? 'studies' : 'trials'}`;
    const caveat = ['biomarker', 'diagnostic'].includes(type) ? (one ? `; this ${one.layer === 'synthesis' ? 'analysis' : 'trial'} tests a treatment, not whether measuring ${name} improves care` : `; these ${synthesis ? 'studies' : 'trials'} test treatments, not whether measuring ${name} improves care`) : !group.fam.directional ? `; this measure cannot show whether ${o} improved` : '';
    text = `${subject} ${one ? 'reports' : 'report'} ${what}${contrast}${caveat}.`;
  }
  return { kind, text: text.replace(/\s+/g, ' ') };
}

export function studyLimits({ layer, n, estimates = [], outcome = '', limitations = [] }) {
  const out = [], add = t => { if (t && !out.includes(t)) out.push(t); };
  add({ preclinical: 'Animal or laboratory model — cannot show an effect in people', mechanism: 'Cell or mechanism study — shows plausibility, not an effect in people', observational: 'Observational — shows association; confounding is possible', synthesis: 'Pools earlier studies — may overlap with trials listed separately', protocol: 'Planned study — no results yet', guidelines: 'Expert guidance — not a new comparison', unclassified: 'Design not classified from the record' }[layer]);
  if (Number.isFinite(n) && n < 50) add(`Small sample (n=${n})`);
  if (!Number.isFinite(n) && ['interventional', 'observational'].includes(layer)) add('Sample size not extracted');
  if (estimates.some(e => intervalSide(e.fam, e.lower, e.upper) === 'includes')) add('Interval includes no difference');
  if (estimates.some(e => e.fam?.directional && !Number.isFinite(e.lower))) add('No confidence interval reported');
  if (estimates.some(e => e.fam && !e.fam.directional && e.mode !== 'Diagnostic performance')) add('Effect measure has no direction');
  const endpoints = [outcome, ...estimates.map(e => e.outcome)].join(' ');
  if (/concentration|serum|plasma|intra-?erythrocytic|biochemical|expression/i.test(endpoints) && !/event|mortality|death|survival|fracture|stroke|infarction|incidence|cancer/i.test(endpoints)) add('Measured a laboratory or intermediate marker, not a clinical outcome');
  for (const l of limitations) add(l);
  if (!out.some(l => /risk[- ]of[- ]bias/i.test(l))) add('Risk of bias not assessed');
  return out;
}

function studyRow(s, estimates, { outcome = '', headline = null, name = '' } = {}) {
  const id = idOf(s), layer = s.layer || studyLayer(s), n = Number.isFinite(s.n) ? s.n : Number.isFinite(s.sample_size) ? s.sample_size : null;
  const population = plainPopulation(s.population), who = { human: 'People', animal: 'Animals', 'in vitro': 'Cells' }[population.toLowerCase()] || population || 'Population not extracted';
  const own = estimates.filter(e => e.pmid === id);
  const happened = own.slice(0, 2).map(e => ({ text: `${cap(effectPhrase(e, e.outcome))}.`, number: describeEffect(e).number, quote: e.quote }));
  if (!happened.length && headline?.pmid === id && headline.quote) happened.push({ text: `The automated conclusion check used this study and read it as ${headline.words}.`, number: '', quote: headline.quote, automated: true });
  const conclusion = happened.length ? null : conclusionExcerpt(s.abstract);
  return {
    id: id || s.url, pmid: /^\d+$/.test(id) ? id : null, url: s.url, title: s.title, year: s.year, layer, design: s.design || 'Design not recorded',
    tested: { who, n, exposure: s.exposure || own[0]?.exposure || null, comparator: s.comparator || own[0]?.comparator || null, duration: own[0]?.duration || null },
    happened, conclusion, limits: studyLimits({ layer, n, estimates: own, outcome, limitations: s.limitations || [] }),
    excerpt: own[0]?.quote || s.scope_passage?.text || null, review: s.review_status || 'automated_appraisal', cohort: s.cohort_id || null, name,
  };
}
const LAYER_ORDER = ['interventional', 'observational', 'synthesis', 'guidelines', 'preclinical', 'mechanism', 'unclassified', 'protocol'];
const yearOf = s => Number(String(s.year || '').slice(0, 4)) || 0;
export function sortStudyRows(rows) {
  return [...rows].sort((a, b) => (b.happened.length > 0) - (a.happened.length > 0) || LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer) || yearOf(b) - yearOf(a));
}

const EMPTY_LAYER = {
  mechanism: 'No cell or mechanism studies are linked yet.',
  preclinical: 'No animal or laboratory studies are linked yet.',
  observational: 'No human observational studies are linked yet.',
  interventional: 'No human trials are linked yet.',
  guidelines: 'No guideline or regulatory records are linked yet.',
};
export function sideLabel(sides) {
  const parts = [sides.below && `${sides.below} below`, sides.above && `${sides.above} above`, sides.includes && `${sides.includes} include`].filter(Boolean);
  return parts.length ? `Intervals vs no difference: ${parts.join(' · ')}` : null;
}
export function layerStrip({ studies, estimates, notes = {} }) {
  return LAYERS.map(l => {
    const records = studies.filter(s => s.layer === l.key), count = records.length;
    const intervals = estimates.filter(e => e.layer === l.key && e.fam?.directional && Number.isFinite(e.lower));
    const { sides } = summarizeSides(intervals);
    return { ...l, count, band: coverageBand(count), direction: intervals.length ? { ...sides, label: sideLabel(sides) } : null, review: count ? reviewState(records.map(s => s.review_status || 'automated_appraisal')) : null, note: notes[l.key] || null, empty: count ? null : EMPTY_LAYER[l.key] };
  });
}

function reviewSentence(review, monitoring) {
  const base = review.key === 'reviewed' ? 'The records behind this reading are expert-reviewed.' : review.key === 'partial' ? 'Some records behind this reading are reviewed; the rest are automated.' : 'This reading is generated automatically from stored study records; no expert has reviewed it.';
  const when = date(monitoring?.last_checked), pending = monitoring?.updates_pending_review || 0;
  const status = monitoring?.monitoring_status;
  const watch = status === 'checked' && when ? ` Literature last checked ${when}${pending ? `; ${plural(pending, 'new candidate record')} await review and are not reflected here` : ''}.`
    : status === 'partial_failure' ? ` The last literature check${when ? ` (${when})` : ''} could not reach every source.`
    : ['not_scheduled', 'queued', 'not_started'].includes(status) ? ' Literature monitoring has not run for this profile yet.' : '';
  return { kind: 'review', text: base + watch };
}
export function profileQuestion({ name, type, outcomes = [], conditions = [] }) {
  const named = [...new Set(outcomes.map(lower))], extra = named.length - 3, topics = list([...named.slice(0, 3), extra > 0 && `${extra} other ${extra === 1 ? 'outcome' : 'outcomes'}`]);
  const targets = list([...new Set(outcomes.map(o => lower(String(o).replace(/^(?:sensitivity|specificity|accuracy|detection)\s+(?:for|of)\s+/i, ''))))]);
  const condition = list(conditions.map(c => c.toLowerCase()));
  if (type === 'biomarker') return `What is known about how ${name} relates to ${topics || 'health outcomes'}, in whom, and how certain is it?`;
  if (type === 'diagnostic') return `How well does ${name} identify ${targets || condition || 'disease'}, in whom, and how certain is it?`;
  if (type === 'screening') return `Does ${/screening/i.test(name) ? name : `screening with ${name}`} change ${topics || 'outcomes'}, in whom, and how certain is it?`;
  if (type === 'precision_oncology') return `What is known about ${name} for ${topics || 'treatment outcomes'}, in which patients, and how certain is it?`;
  return `What is known about ${name}${topics ? ` for ${topics}` : ''}, in whom, and how certain is it?`;
}

const MODE_ORDER = { biomarker: ['Association', 'Prediction', 'Treatment outcomes', 'Diagnostic performance'], diagnostic: ['Diagnostic performance', 'Prediction', 'Association', 'Treatment outcomes'], screening: ['Treatment outcomes', 'Diagnostic performance', 'Association', 'Prediction'] };
function outcomeCards(groups, { name, type }) {
  const order = MODE_ORDER[type] || ['Treatment outcomes', 'Association', 'Prediction', 'Diagnostic performance'];
  return groups.map(o => ({
    name: o.name,
    lines: o.groups.sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode)).map(g => ({ ...g, ...groupMeaning(g, { name, type, outcome: o.name }) })),
  })).sort((a, b) => order.indexOf(a.lines[0].mode) - order.indexOf(b.lines[0].mode) || b.lines.reduce((n, l) => n + l.estimates.length, 0) - a.lines.reduce((n, l) => n + l.estimates.length, 0));
}
const UTILITY = /(?:marker|test|biomarker|apob|ldl-?c?)[- ]guided|guided (?:therapy|management|care|treatment)|screening strateg|invitation to .{0,40}screen/i;

export function entityReading(entity, report, { monitoring } = {}) {
  const name = entity.name, type = entity.entity_type;
  const studies = (entity.studies || []).map(s => ({ ...s, layer: studyLayer(s) }));
  const estimates = mergeEstimates((report?.records || []).map(estimateFromRecord), studies.flatMap(s => (s.findings || []).map(f => estimateFromFinding(s, f))));
  const outcomes = outcomeCards(groupEstimates(estimates), { name, type });
  const lines = outcomes.flatMap(o => o.lines.map(l => ({ ...l, outcome: o.name })));
  const unassessed = (entity.outcomes || []).map(o => o.name).filter(n => !outcomes.some(o => normalize(o.name) === normalize(n)));
  const review = reviewState([entity.review_status === 'reviewed' ? 'reviewed' : entity.review_status === 'partially_reviewed' ? 'partially_reviewed' : 'automated_appraisal']);
  const utility = studies.filter(s => UTILITY.test(`${s.title || ''} ${s.abstract || ''}`));
  const byMode = mode => lines.filter(l => l.mode === mode);
  const snapshot = [];
  if (!studies.length) snapshot.push({ kind: 'not_assessed', text: `No study records are linked to ${name} yet, so no findings are summarized here.` });
  const assoc = byMode('Association');
  if (assoc.length) snapshot.push({ kind: 'association', text: `Human observational studies link ${name} with ${list(assoc.map(l => lower(l.outcome)))} (${plural(assoc.reduce((n, l) => n + l.estimates.length, 0), 'analysis', 'analyses')}); association does not show that changing ${name} changes these outcomes.` });
  const prediction = byMode('Prediction').filter(l => l.fam.key === 'c_index_change');
  if (prediction.length) {
    const values = prediction.flatMap(l => l.estimates.map(e => Math.abs(e.point)));
    snapshot.push({ kind: 'prediction', text: `Where ${name} was added to existing risk models, the C-index changed by at most ${num(Math.max(...values))} on a 0.5–1 scale (${plural(values.length, 'analysis', 'analyses')}).` });
  }
  const treatment = byMode('Treatment outcomes');
  if (treatment.length) {
    const outcomesText = list(treatment.map(l => lower(l.outcome)));
    snapshot.push({ kind: 'treatment', text: ['biomarker', 'diagnostic'].includes(type)
      ? `Trials report effects of treatments on ${outcomesText} in people selected by or targeting ${name}; ${utility.length ? `${plural(utility.length, 'record')} directly ${utility.length === 1 ? 'tests' : 'test'} ${name}-guided care` : `no linked trial tests whether ${name}-guided care improves outcomes`}.`
      : `${type === 'screening' ? 'Randomized screening trials' : 'Randomized trials'} report effects on ${outcomesText}; the size and precision of each are shown below.` });
  }
  const accuracy = byMode('Diagnostic performance');
  if (accuracy.length) snapshot.push({ kind: 'accuracy', text: `Reported accuracy: ${list(accuracy.map(l => `${lower(l.outcome)} ${l.estimates.length === 1 ? `${pctOf(l.estimates[0].point)}%` : `${pctOf(Math.min(...l.estimates.map(e => e.point)))}–${pctOf(Math.max(...l.estimates.map(e => e.point)))}%`}`))}. Accuracy is a separate question from whether testing improves outcomes.` });
  if (unassessed.length && studies.length) snapshot.push({ kind: 'not_assessed', text: `No extracted human data yet for ${list(unassessed.map(lower))}.` });
  const dims = Object.entries(entity.assessments || {}), pending = dims.filter(([, v]) => /not yet assessed/i.test(v?.rating || ''));
  if (dims.length && pending.length === dims.length) snapshot.push({ kind: 'not_assessed', text: `None of the ${dims.length} appraisal dimensions (${list(dims.map(([k]) => k.toLowerCase()))}) has been assessed by a reviewer yet.` });
  else if (pending.length) snapshot.push({ kind: 'not_assessed', text: `Not yet assessed: ${list(pending.map(([k]) => k.toLowerCase()))}.` });

  const has = layer => studies.some(s => s.layer === layer);
  const tensions = [];
  if (['biomarker', 'diagnostic'].includes(type) && (assoc.length || prediction.length) && !utility.length) tensions.push({ kind: 'utility', layer: 'interventional', text: `Association${prediction.length ? ' and prediction' : ''} evidence exists, but no linked trial tests whether acting on ${name} changes outcomes.` });
  if (type === 'biomarker' && treatment.length) tensions.push({ kind: 'treatment_not_marker', layer: 'interventional', text: `The trial results test treatments. Lowering ${name} with a drug, or enrolling people by their ${name} level, does not show that measuring ${name} adds value.` });
  const clearAssoc = assoc.flatMap(l => l.estimates).find(e => ['below', 'above'].includes(intervalSide(e.fam, e.lower, e.upper)));
  if (clearAssoc && prediction.length) tensions.push({ kind: 'association_vs_prediction', layer: 'observational', text: `A clear association (${describeEffect(clearAssoc).magnitude}) sits beside C-index changes of at most ${num(Math.max(...prediction.flatMap(l => l.estimates.map(e => Math.abs(e.point)))))}; association and added predictive value answer different questions.` });
  for (const l of lines.filter(l => l.kind === 'conflicting')) tensions.push({ kind: 'conflicting', layer: l.estimates[0].layer, text: `${cap(l.outcome)}: estimates fall on both sides of no difference; exposure contrasts may point in opposite directions, so compare exposures, populations and comparators before reading this as disagreement.` });
  const cohorts = Object.entries(studies.reduce((m, s) => (s.cohort_id ? { ...m, [s.cohort_id]: (m[s.cohort_id] || 0) + 1 } : m), {})).filter(([, n]) => n > 1);
  for (const [cohort, n] of cohorts) tensions.push({ kind: 'shared_cohort', layer: studies.find(s => s.cohort_id === cohort).layer, text: `${n} records come from ${cohort.replaceAll('-', ' ')}; they share participants and are not independent replications.` });
  const syntheses = studies.filter(s => s.layer === 'synthesis').length;
  if (syntheses && (has('interventional') || has('observational'))) tensions.push({ kind: 'overlap', layer: 'interventional', text: `${plural(syntheses, 'published synthesis', 'published syntheses')} may include studies that are also listed individually.` });
  if (!has('guidelines')) tensions.push({ kind: 'guidelines_silent', layer: 'guidelines', text: 'No guideline or regulatory records are linked, so what guidance says is not shown here.' });
  else if (!has('interventional')) tensions.push({ kind: 'guidance_without_trials', layer: 'guidelines', text: 'Guidance is linked, but no human trials are; check which evidence the guidance relies on.' });
  if (entity.changing_marker) tensions.push({ kind: 'curated', layer: 'interventional', text: entity.changing_marker });

  const rows = sortStudyRows(studies.map(s => studyRow(s, estimates, { name })));
  return {
    version: READING_VERSION, kind: 'entity', name, type, review,
    question: profileQuestion({ name, type, outcomes: (entity.outcomes || []).map(o => o.name), conditions: entity.conditions || [] }),
    snapshot: [...snapshot.slice(0, 5), reviewSentence(review, monitoring)],
    layers: layerStrip({ studies, estimates }), syntheses, outcomes, unassessed,
    tensions: tensions.slice(0, 6), studies: rows, estimates: estimates.length,
  };
}

const HEADLINE_DIRECTION = { benefit: 'favourable', none: 'null', harm: 'unfavourable' };
const DIRECTION_WORDS = { favourable: 'favourable', null: 'showing no clear difference', unfavourable: 'unfavourable', unclear: 'unclear' };
function compoundOutcome(claim, analysis, detail, verified, { name, model }) {
  const counts = analysis?.counts || (claim.studies || []).reduce((m, s) => ({ ...m, [studyLayer(s)]: (m[studyLayer(s)] || 0) + 1 }), {});
  const trials = counts.interventional || 0, obs = counts.observational || 0, lab = (counts.preclinical || 0) + (counts.mechanism || 0), syn = counts.synthesis || 0;
  const direction = claim.directionStatus === 'assessed' ? HEADLINE_DIRECTION[claim.headlineEffect?.direction] || 'unclear' : 'unassessed';
  const directional = verified.filter(e => e.fam.directional), { sides, consistency } = summarizeSides(directional);
  const o = lower(claim.outcome);
  let kind, text;
  if (!trials && !obs && !syn && lab) { kind = 'preclinical'; text = `Only animal or laboratory studies (${lab}) address ${o}; with no linked human studies, an effect in people is untested.`; }
  else if (!trials && !obs && !syn) { kind = 'not_assessed'; text = `No linked studies address ${o} yet.`; }
  else if (!trials && obs && !syn) { kind = 'association'; text = `Only observational human studies (${obs}) address ${o}; they can show an association, not that ${name} causes a change.`; }
  else {
    const body = trials ? `Human trials (${trials}${syn ? `, plus ${plural(syn, 'published review')}` : ''}) are the main evidence for ${o}` : `Published reviews (${syn}) are the main evidence for ${o}`;
    const reading = { favourable: `the automated conclusion check reads them as favouring ${name}`, null: 'the automated conclusion check reads them as showing no clear difference', unfavourable: `the automated conclusion check reads them as not favouring ${name}`, unclear: 'their overall direction could not be verified automatically', unassessed: 'their overall direction has not been checked' }[direction];
    const first = directional[0];
    const size = !directional.length ? [', but', 'no effect size with a verified interval is extracted']
      : consistency === 'includes_null' ? [', but', directional.length === 1 ? `the only verified estimate (${describeStudy(first)}) is compatible with no difference` : `all ${directional.length} verified estimates are compatible with no difference`]
      : consistency === 'conflicting' ? [', but', 'verified estimates fall on both sides of no difference']
      : consistency === 'consistent' ? [', and', `${plural(directional.length, 'verified estimate')} ${directional.length === 1 ? 'excludes' : 'exclude'} no difference`]
      : [sides.below + sides.above ? ', and' : ', but', `${sides.below + sides.above} of ${directional.length} verified estimates exclude no difference`];
    text = `${body}; ${reading}${size[0]} ${size[1]}.`;
    kind = consistency === 'conflicting' ? 'conflicting' : direction === 'favourable' && trials && ['Strong', 'Moderate'].includes(claim.tier) ? 'favourable' : 'uncertain';
  }
  const mentions = key => [...new Set(verified.flatMap(e => String(e[key] || '').split('; ')).filter(Boolean))];
  const headline = claim.headlineEffect?.quote && claim.directionStatus === 'assessed' ? { pmid: String(claim.headlineEffect.pmid || ''), quote: claim.headlineEffect.quote, words: DIRECTION_WORDS[direction] || 'unclear', comparator: claim.headlineEffect.comparator } : null;
  return {
    name: claim.outcome, kind, text, grade: claim.tier, gradeStatus: analysis?.grade_status || null, direction,
    numbers: { studies: claim.nStudies ?? analysis?.study_count ?? null, trials, observational: obs, lab, syntheses: syn, protocols: counts.protocol || 0, missingSampleSize: analysis?.missing_sample_size ?? null, verified: verified.length },
    context: { population: mentions('population'), dose: mentions('exposure'), duration: mentions('duration'), comparator: headline?.comparator || verified.find(e => e.comparator)?.comparator || null },
    estimates: verified, headline, limitations: analysis?.limitations || [],
    drafted: detail?.what_studies_show ? { text: detail.what_studies_show, grade: detail.why_this_grade || null, model } : null,
    studies: sortStudyRows((analysis?.studies || claim.studies || []).map(s => {
      const full = (claim.studies || []).find(x => idOf(x) === idOf(s)) || {};
      return studyRow({ ...full, ...s, abstract: full.abstract, population: s.population || full.population }, verified, { outcome: claim.outcome, headline, name });
    })),
  };
}

export function compoundReading(view, report, { monitoring } = {}) {
  const name = view.name, claims = view.outcomes || [], analyses = view.analysis?.outcomes || [];
  const model = view.explanation?._generated ? view.explanation._model || 'a language model' : null;
  const sources = new Map();
  for (const claim of claims) for (const s of claim.studies || []) { const id = idOf(s); if (id && !sources.has(id)) sources.set(id, `${s.title || ''}\n${s.abstract || ''}`); }
  const verifiedByOutcome = new Map(analyses.map(a => [a.name, mergeEstimates((a.effects || []).filter(e => e.eligible !== false).map(e => estimateFromAnalysis(e, a.name, sources.get(String(e.pmid)))))]));
  const outcomes = claims.map(claim => compoundOutcome(claim, analyses.find(a => a.name === claim.outcome), (view.explanation?.outcome_detail || []).find(d => (d.outcome_key || d.outcome) === claim.outcome), verifiedByOutcome.get(claim.outcome) || [], { name, model }));
  const unique = new Map();
  for (const claim of claims) for (const s of claim.studies || []) { const id = idOf(s); if (id && !unique.has(id)) unique.set(id, { ...s, layer: studyLayer(s) }); }
  const studies = [...unique.values()];
  const recordEstimates = mergeEstimates((report?.records || []).map(estimateFromRecord));
  const endpoints = outcomeCards(groupEstimates(recordEstimates), { name, type: 'intervention' });
  const verified = [...verifiedByOutcome.values()].flat();
  const review = reviewState([view.reviewedBy && view.reviewedBy !== 'auto' ? 'reviewed' : 'automated_appraisal']);
  const by = kind => outcomes.filter(o => o.kind === kind).map(o => lower(o.name));
  const snapshot = [];
  if (by('favourable').length) snapshot.push({ kind: 'favourable', text: `The clearest human evidence concerns ${list(by('favourable'))}: mainly trials whose conclusions an automated check reads as favouring ${name}.` });
  const unsure = [...by('uncertain'), ...by('conflicting')];
  if (unsure.length) snapshot.push({ kind: 'uncertain', text: `For ${list(unsure)}, human studies exist but the direction or size of any effect is not established here.` });
  if (by('association').length) snapshot.push({ kind: 'association', text: `${cap(list(by('association')))} ${by('association').length === 1 ? 'has' : 'have'} only observational human evidence, which shows association rather than effect.` });
  if (by('preclinical').length) snapshot.push({ kind: 'preclinical', text: `${cap(list(by('preclinical')))} ${by('preclinical').length === 1 ? 'rests' : 'rest'} on animal or laboratory studies only; effects in people are untested.` });
  if (!outcomes.length) snapshot.push({ kind: 'not_assessed', text: `No graded outcomes are stored for ${name} yet.` });
  const coverage = view.analysis?.coverage;
  if (coverage?.outcomes) snapshot.push({ kind: 'not_assessed', text: coverage.quantified_outcomes ? `${coverage.quantified_outcomes} of ${coverage.outcomes} outcomes have a numerical estimate that passed source checks; the others are described from study conclusions, and no reviewer has rated certainty.` : `None of the ${coverage.outcomes} outcomes has a numerical estimate that passed source checks, so effect sizes are not stated here.` });

  const favourableCount = outcomes.filter(o => o.direction === 'favourable').length, checked = outcomes.filter(o => o.direction !== 'unassessed').length;
  const tensions = [];
  for (const o of outcomes.filter(o => o.kind === 'favourable')) {
    const d = o.estimates.filter(e => e.fam.directional);
    if (d.length && summarizeSides(d).consistency === 'includes_null') tensions.push({ kind: 'grade_vs_estimate', layer: 'interventional', text: `${cap(o.name)} carries the automated grade ${o.grade}, but ${d.length === 1 ? `its only verified estimate (${describeStudy(d[0])}) is` : 'all its verified estimates are'} compatible with no difference; the grade reflects study volume and conclusions, not a measured effect size.` });
  }
  if (by('preclinical').length) tensions.push({ kind: 'untested_in_people', layer: 'interventional', text: `${cap(list(by('preclinical')))}: animal or laboratory findings have not been tested in human trials.` });
  const protocols = view.analysis?.coverage?.protocols ?? studies.filter(s => s.layer === 'protocol').length;
  if (protocols) tensions.push({ kind: 'protocols', layer: 'interventional', text: `${plural(protocols, 'linked record')} ${protocols === 1 ? 'is a protocol' : 'are protocols'} — planned work without results — so grades that counted them need a refresh.` });
  const syntheses = studies.filter(s => s.layer === 'synthesis').length;
  if (syntheses > 1) tensions.push({ kind: 'overlap', layer: 'interventional', text: `${plural(syntheses, 'published review')} may re-count the same trials; their number is not independent replication.` });
  for (const line of endpoints.flatMap(e => e.lines.map(l => ({ ...l, outcome: e.name })))) {
    if (studyLimits({ outcome: line.outcome }).some(l => l.startsWith('Measured a laboratory'))) tensions.push({ kind: 'surrogate', layer: 'interventional', text: `${cap(line.outcome)} is a laboratory measure, not a clinical outcome; a change in it does not show a health effect.` });
  }
  if (!studies.some(s => s.layer === 'guidelines')) tensions.push({ kind: 'guidelines_silent', layer: 'guidelines', text: 'No guideline or regulatory records are linked, so what guidance says is not shown here.' });

  return {
    version: READING_VERSION, kind: 'compound', name, type: 'intervention', review, model,
    question: profileQuestion({ name, type: 'intervention', outcomes: claims.map(c => c.outcome) }),
    snapshot: [...snapshot.slice(0, 5), reviewSentence(review, monitoring)],
    layers: layerStrip({ studies, estimates: verified, notes: checked ? { interventional: `Automated conclusion check: favourable for ${favourableCount} of ${checked} checked outcomes` } : {} }),
    syntheses, outcomes, endpoints, tensions: tensions.slice(0, 6), studies: [], unassessed: [], estimates: verified.length + recordEstimates.length,
  };
}
