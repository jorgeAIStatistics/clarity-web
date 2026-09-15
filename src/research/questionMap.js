// Question Evidence Map: the research question as five-layer coverage, an outcome landscape the
// researcher's own aggregate results can sit on, rule-based tensions and one next research step.
// Deterministic and provisional. Nothing is pooled, converted or judged as support or contradiction.
import { LAYERS, coverageBand, inferMode, plainPopulation, list } from '../profile/meaningModel.js';
import { measureFamily, describeEffect, intervalSide, validInterval, num } from '../evidence/measures.js';
import { validRecord } from '../profile/visualModel.js';

export const MAP_VERSION = 'question-map-v1';
export const DEMO = {
  question: 'Does ApoB add information beyond LDL-C for predicting cardiovascular events in adults without cardiovascular disease, and is there evidence that acting on ApoB improves outcomes (clinical utility)? What do guidelines say?',
  table: '/examples/apob-question-demo.csv',
  tableName: 'apob-question-demo.csv · illustrative values, not a real study',
};

export const INTENTS = [
  { key: 'association', label: 'Association', layer: 'observational', question: 'Is it linked with the outcome?', answeredBy: 'human observational studies', pattern: /associat|correlat|\brisk\b|linked? (?:to|with)|biomarker/i },
  { key: 'prediction', label: 'Prediction', layer: 'observational', question: 'Does it forecast progression or add to existing risk models?', answeredBy: 'prognostic cohorts and model-comparison studies', pattern: /predict|progression|prognos|discrimin|incremental|c-?index|reclassif|beyond/i },
  { key: 'utility', label: 'Clinical utility', layer: 'interventional', question: 'Does acting on it improve outcomes?', answeredBy: 'trials that compare strategies or treatments', pattern: /clinical utility|improv\w* (?:patient )?outcomes|change\w* (?:outcomes|management|care|decisions)|[- ]guided|acting on|personali[sz]ed|management|efficacy|\bbenefit|randomi[sz]ed/i },
  { key: 'mechanism', label: 'Mechanism', layer: 'mechanism', question: 'Is there a biological explanation?', answeredBy: 'mechanism and animal studies', pattern: /mechanis|pathway|biolog|in vitro|\bcells?\b|animal|mouse|mice|\brats?\b|preclinical/i },
  { key: 'guideline', label: 'Guideline', layer: 'guidelines', question: 'What does guidance say?', answeredBy: 'guideline and regulatory records', pattern: /guideline|recommendation|consensus|regulat|guidance|\bfda\b|\bema\b|uspstf/i },
  { key: 'enrichment', label: 'Trial enrichment', layer: 'interventional', question: 'Can it select who enters a trial?', answeredBy: 'trials or trial analyses that select or stratify by the marker', pattern: /enrich|stratif\w* (?:trial|enrol)|trial selection/i },
];
const FOCUS = { association: ['association'], prediction: ['incremental'], utility: ['utility', 'treatment'], guideline: ['guidelines'], mechanism: [], enrichment: [] };
export function detectIntents(text, focus = [], chosen = null) {
  const ids = new Set(focus.map(f => f.id));
  return INTENTS.map(i => ({ ...i, asked: chosen ? chosen.includes(i.key) : i.pattern.test(text || '') || FOCUS[i.key].some(id => ids.has(id)) }));
}

export function directionLabel(d = {}) {
  const b = d.below || 0, a = d.above || 0, i = d.includes || 0;
  if (!b && !a && !i) return null;
  if (b && a) return 'conflicting';
  if (i && !b && !a) return 'includes';
  if (b && !a && !i) return 'below';
  if (a && !b && !i) return 'above';
  return 'mixed';
}

function makeCell(entity, layer, count, directions = {}, reviewed = 0, examples = [], retrieved = []) {
  const d = { below: directions.below || 0, above: directions.above || 0, includes: directions.includes || 0 };
  return {
    entityId: entity.id, entity: entity.name, type: entity.entity_type, path: entity.path, layer: layer.key, label: layer.label,
    count, band: coverageBand(count), directions: d, direction: directionLabel(d),
    review: !count ? null : reviewed === count ? 'reviewed' : reviewed ? 'partial' : 'automated',
    examples: examples.map(x => ({ ...x, retrieved: retrieved.find(s => s.id === x.id) || null })),
  };
}

// Rows: profiles the question touches. Columns: the five layers. Library-wide counts when the engine
// supplies them; otherwise counts of the retrieved records, labeled as such.
export const lowerFirst = s => String(s || '').replace(/^[A-Z][a-z]+(?=[\s,;:.)-]|$)/, w => w.toLowerCase());
// Named concepts lead, in the order the question mentions them; related profiles follow.
function mention(entity, text) {
  const t = String(text || '').toLowerCase();
  const hits = [entity.name, ...(entity.aliases || []), ...(entity.matched_aliases || [])].map(a => t.indexOf(String(a).toLowerCase())).filter(i => i >= 0);
  return hits.length ? Math.min(...hits) : Number.MAX_SAFE_INTEGER;
}
export function coverageMatrix(result, text = '') {
  const library = result?.layer_coverage?.entities, studies = result?.studies || [];
  const rows = (result?.entities || []).map(e => {
    const own = library?.[e.id];
    const cells = LAYERS.map(l => {
      if (own) {
        const c = own.cells?.[l.key] || {};
        return makeCell(e, l, c.count || 0, c.directions, c.reviewed || 0, c.examples || [], studies);
      }
      const linked = studies.filter(s => s.entity_ids?.includes(e.id) && s.layer === l.key);
      const directions = { below: 0, above: 0, includes: 0 };
      for (const s of linked) for (const f of s.findings || []) {
        const side = intervalSide(measureFamily(f.effect?.measure), f.effect?.lower, f.effect?.upper);
        if (side) directions[side]++;
      }
      return makeCell(e, l, linked.length, directions, linked.filter(s => s.review_status === 'reviewed').length, linked.map(s => ({ id: s.id, title: s.title, year: s.year, design: s.design, url: s.url, quantified: Boolean(s.findings?.length) })), studies);
    });
    return { id: e.id, name: e.name, type: e.entity_type, path: e.path, primary: Boolean(e.matched_aliases?.length), temporary: Boolean(e.ephemeral || String(e.id).startsWith('temporary:')), mention: mention(e, text), cells, syntheses: own ? own.syntheses || 0 : studies.filter(s => s.entity_ids?.includes(e.id) && s.layer === 'synthesis').length };
  }).sort((a, b) => b.primary - a.primary || a.mention - b.mention);
  // Papers were retrieved but no entity resolved: count those papers in one temporary row rather than showing an empty map.
  if (!rows.length && studies.length) {
    const paper = { id: 'temporary:retrieved-papers', name: 'Papers retrieved for this question', entity_type: 'retrieved', path: null };
    const cells = LAYERS.map(l => {
      const linked = studies.filter(s => s.layer === l.key), directions = { below: 0, above: 0, includes: 0 };
      for (const s of linked) for (const f of s.findings || []) { const side = intervalSide(measureFamily(f.effect?.measure), f.effect?.lower, f.effect?.upper); if (side) directions[side]++; }
      return makeCell(paper, l, linked.length, directions, linked.filter(s => s.review_status === 'reviewed').length, linked.map(s => ({ id: s.id, title: s.title, year: s.year, design: s.design, url: s.url, quantified: Boolean(s.findings?.length) })), studies);
    });
    rows.push({ id: paper.id, name: paper.name, type: 'retrieved', path: null, primary: true, temporary: true, mention: 0, cells, syntheses: studies.filter(s => s.layer === 'synthesis').length });
    return { rows, basis: 'retrieved', note: 'No named entity was resolved, so this temporary row counts the retrieved papers by layer. Name the biomarker, compound or test to map it directly.' };
  }
  return { rows, basis: library ? 'library' : 'retrieved', note: library ? result.layer_coverage.basis : 'Counts cover only the records retrieved for this question; the full library may hold more.' };
}

const words = s => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'any'].includes(w)));
export function sameOutcome(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  const shared = [...A].filter(w => B.has(w)).length;
  return shared / new Set([...A, ...B]).size >= 0.5;
}

// Published, quote-backed estimates for the matched profiles: validated snapshot records first,
// then findings retrieved for this question. Duplicates collapse on source, outcome and values.
export function publishedEstimates(result, snapshotProfiles = {}) {
  const ids = new Set((result?.entities || []).map(e => e.id)), out = new Map();
  const put = e => {
    if (!e.fam || !e.quote || !validInterval(e.fam, e.point, e.lower, e.upper)) return;
    const key = `${e.pmid}|${e.outcome.toLowerCase()}|${e.point}|${e.lower}|${e.upper}`, prev = out.get(key);
    if (prev) prev.entityIds = [...new Set([...prev.entityIds, ...e.entityIds])];
    else out.set(key, e);
  };
  for (const [pid, profile] of Object.entries(snapshotProfiles || {})) {
    if (result?.intent || !ids.has(pid)) continue;
    for (const r of profile.records || []) if (validRecord(r)) put({ id: r.id, pmid: String(r.pmid), url: r.url, title: r.title, year: r.year, outcome: r.outcome, mode: r.mode, fam: measureFamily(r.metric), point: r.point, lower: r.lower, upper: r.upper, level: r.intervalLevel, unit: r.unit, n: r.n, population: plainPopulation(r.context?.population), exposure: r.context?.exposure, comparator: r.context?.comparator, layer: r.layer, design: r.design, quote: r.quote, cohort: r.cohort, entityIds: [pid] });
  }
  for (const s of result?.studies || []) for (const f of s.findings || []) {
    if (result?.intent && !f.plot_eligible) continue;
    if (f.effect?.origin && f.effect.origin !== 'reported') continue;
    const fam = measureFamily(f.effect?.measure);
    put({ id: `${s.id}:${f.outcome}:${f.effect?.estimate}`, pmid: String(s.pmid || s.id).replace('pmid:', ''), url: s.url, title: s.title, year: s.year, outcome: f.outcome, mode: inferMode(fam, s.layer, `${s.design || ''} ${s.title || ''}`), fam, point: f.effect?.estimate, lower: f.effect?.lower, upper: f.effect?.upper, level: f.effect?.confidence_level, unit: f.effect?.units, n: s.n, population: plainPopulation(f.population || s.population), exposure: f.exposure || s.exposure, comparator: f.comparator || s.comparator, layer: s.layer, design: s.design, quote: f.quote, cohort: s.cohort_id, timepoint: f.timepoint || s.timepoint, entityIds: f.entity_ids || s.entity_ids || [] });
  }
  return [...out.values()];
}

export function outcomeOptions(estimates, userRows = [], questionOutcomes = []) {
  const counts = new Map();
  for (const e of estimates) counts.set(e.outcome, (counts.get(e.outcome) || 0) + 1);
  const placed = userRows.filter(r => r.placeable);
  const options = [...counts].map(([name, count]) => ({ name, count, user: placed.filter(r => sameOutcome(r.outcome, name)).length, asked: questionOutcomes.some(q => sameOutcome(q, name)) }));
  for (const r of placed) if (!options.some(o => sameOutcome(o.name, r.outcome))) options.push({ name: r.outcome, count: 0, user: placed.filter(x => sameOutcome(x.outcome, r.outcome)).length, asked: false });
  return options.sort((a, b) => (b.user > 0) - (a.user > 0) || b.asked - a.asked || b.count - a.count);
}

export function compareUser(panel) {
  if (!panel.user.length || !panel.published.length) return [];
  return panel.user.map(u => {
    const intervals = panel.published.filter(p => Number.isFinite(p.lower));
    const overlaps = Number.isFinite(u.lower) && intervals.length ? intervals.filter(p => u.lower <= p.upper && p.lower <= u.upper).length : null;
    const points = panel.published.map(p => p.point), lo = Math.min(...points), hi = Math.max(...points);
    const position = u.point < lo ? 'below every published point estimate' : u.point > hi ? 'above every published point estimate' : 'within the range of published point estimates';
    return { id: u.id, overlaps, of: intervals.length, position, text: `Your estimate sits ${position}${overlaps != null ? `; its interval overlaps ${overlaps} of ${intervals.length} published ${intervals.length === 1 ? 'interval' : 'intervals'}` : ''}. Overlap is not a formal test, and exposure contrasts and populations differ${u.exposure ? ` (yours: ${u.exposure})` : ''}.` };
  });
}

// One panel per measure family and question type. A user row joins a panel only when outcome,
// family and question type all match; otherwise it gets its own axis with the reason stated.
export function landscapePanels(estimates, outcome, userRows = []) {
  const panels = new Map(), key = (fam, mode) => `${fam.key}|${mode}`;
  for (const e of estimates.filter(e => e.outcome === outcome)) {
    const k = key(e.fam, e.mode);
    if (!panels.has(k)) panels.set(k, { key: k, fam: e.fam, mode: e.mode, published: [], user: [], note: null });
    panels.get(k).published.push(e);
  }
  const hadPublished = panels.size > 0;
  for (const r of userRows.filter(r => r.placeable && sameOutcome(r.outcome, outcome))) {
    const k = key(r.fam, r.mode);
    if (panels.has(k)) { panels.get(k).user.push(r); continue; }
    panels.set(k, { key: k, fam: r.fam, mode: r.mode, published: [], user: [r], note: hadPublished ? `No published ${r.fam.label} estimate for ${r.mode.toLowerCase()} on this outcome, so your row has its own axis.` : 'No published estimate for this outcome yet, so your row has its own axis.' });
  }
  return [...panels.values()].map(p => ({ ...p, comparison: compareUser(p) }));
}

export const utilityRecordCount = result => (result?.copilot?.groups || []).find(g => g.id === 'utility')?.study_ids?.length || 0;
const MARKERS = ['biomarker', 'diagnostic', 'screening'];

export function mapTensions({ matrix, intents, estimates = [], result, comparisons = [] }) {
  const out = [], add = (kind, text, cell = null) => { if (out.length < 5 && !out.some(t => t.kind === kind && t.cell?.entityId === cell?.entityId)) out.push({ kind, text, cell }); };
  const asked = key => intents.some(i => i.key === key && i.asked);
  const named = matrix.rows.filter(r => r.primary), rows = named.length ? named : matrix.rows.slice(0, 2);
  const cell = (row, layer) => row.cells.find(c => c.layer === layer);
  const utility = utilityRecordCount(result);
  for (const row of rows.filter(r => MARKERS.includes(r.type))) {
    const obs = cell(row, 'observational'), trial = cell(row, 'interventional');
    if (obs.count && !utility) add('utility_gap', `${row.name}: ${obs.count} observational ${obs.count === 1 ? 'record shows' : 'records show'} association, but no linked trial tests whether acting on ${row.name} changes outcomes${trial.count ? `; the ${trial.count} trial ${trial.count === 1 ? 'record tests a treatment' : 'records test treatments'}, not ${row.name}-guided care` : ''}.`, trial);
  }
  const prediction = estimates.filter(e => e.fam.key === 'c_index_change');
  const clear = estimates.find(e => e.mode === 'Association' && ['below', 'above'].includes(intervalSide(e.fam, e.lower, e.upper)));
  if (prediction.length && clear) {
    const row = rows.find(r => clear.entityIds.includes(r.id)) || rows[0];
    add('association_vs_prediction', `A clear association (${describeEffect(clear).magnitude} of ${clear.outcome.toLowerCase()}) sits beside C-index changes of at most ${num(Math.max(...prediction.map(e => Math.abs(e.point))))}: being associated with risk and improving a risk model are different questions.`, row && cell(row, 'observational'));
  }
  for (const c of comparisons.filter(c => c.overlaps === 0)) add('user_outside', `Your estimate overlaps none of the ${c.of} published intervals on its scale. Check exposure scaling (per SD versus per unit), adjustment and population before reading this as a real difference.`);
  for (const row of rows) for (const c of row.cells.filter(c => c.direction === 'conflicting')) add('conflicting', `${row.name} · ${c.label}: reported intervals fall on both sides of no difference. Exposure contrasts may point in opposite directions, so check each record first.`, c);
  if (asked('guideline')) for (const row of rows) { const g = cell(row, 'guidelines'); if (!g.count) add('guideline_gap', `No guideline or regulatory records are linked to ${row.name}, so the guidance part of your question is unanswered here.`, g); }
  if (asked('mechanism')) for (const row of rows) { const m = cell(row, 'mechanism'); if (!m.count && !cell(row, 'preclinical').count) add('mechanism_gap', `No mechanism or animal records are linked to ${row.name}.`, m); }
  for (const row of rows.filter(r => r.type === 'intervention')) { const trial = cell(row, 'interventional'); if (!trial.count && cell(row, 'preclinical').count + cell(row, 'mechanism').count) add('untested', `${row.name}: animal or laboratory records exist, but no human trials are linked.`, trial); }
  const sourceIds = new Set((result?.studies || []).map(s => s.id));
  const shared = (result?.copilot?.tensions || []).find(t => t.status === 'record_metadata' && t.study_ids?.length > 1 && t.study_ids.every(id => sourceIds.has(id)));
  if (shared) add('shared_cohort', `${shared.study_ids.length} retrieved records name the same cohort or trial; participant overlap is possible and must be checked before treating them as independent replications.`);
  return out;
}

export function nextStep({ matrix, intents, estimates = [], question = {}, comparisons = [], outcome = '', utilityRecords = 0 }) {
  const rows = matrix?.rows || [];
  if (!rows.length) return null;
  const asked = key => intents.some(i => i.key === key && i.asked);
  const named = rows.filter(r => r.primary), focus = named.length ? named : rows.slice(0, 1), lead = focus[0];
  const cell = (row, layer) => row.cells.find(c => c.layer === layer);
  const population = edited(question.population) || 'the population you name', endpoint = edited(question.outcomes) || outcome || 'your primary outcome';
  const note = 'Automated suggestion from the empty and conflicting cells in this map. A starting point for design discussion, not a protocol and not clinical advice.';
  const markers = focus.filter(r => MARKERS.includes(r.type));
  const prediction = estimates.filter(e => e.fam.key === 'c_index_change');
  const maxGain = prediction.length ? Math.max(...prediction.map(e => Math.abs(e.point))) : null;
  if (markers.length && asked('utility') && !utilityRecords) {
    const [m, other] = markers, obs = markers.reduce((n, r) => n + cell(r, 'observational').count, 0);
    return { title: `Test whether ${m.name}-guided management changes ${lowerFirst(endpoint)}`, design: `Randomized comparison of ${m.name}-guided versus ${other ? `${other.name}-guided` : 'usual'} management`, population, outcome: endpoint, stratum: other ? `People whose ${m.name} and ${other.name} results disagree` : null,
      why: `The map holds ${obs} observational ${obs === 1 ? 'record' : 'records'}${prediction.length ? ` and ${prediction.length} risk-prediction ${prediction.length === 1 ? 'estimate' : 'estimates'} (C-index gains of at most ${num(maxGain)})` : ''} for ${list(markers.map(r => r.name))}, but no linked trial compares management strategies. That comparison answers clinical utility; more association studies would not.`, cells: [cell(m, 'interventional')], note };
  }
  const outside = comparisons.find(c => c.overlaps === 0);
  if (outside) return { title: 'Reconcile your estimate with the published range', design: 'Sensitivity analysis aligned to the published exposure contrast and adjustment set', population, outcome: endpoint, stratum: null, why: `Your interval overlaps none of the ${outside.of} published intervals on the same scale. Rule out differences in exposure scaling, adjustment and population before interpreting a real difference.`, cells: [], note };
  if (prediction.length && (asked('prediction') || asked('association'))) return { title: `Test whether adding ${lead.name} improves risk classification`, design: 'External validation with calibration and reclassification, not discrimination alone', population, outcome: endpoint, stratum: null, why: `Published C-index gains are at most ${num(maxGain)} on a 0.5–1 scale. Whether ${lead.name} moves people across decision thresholds in ${population} is still open.`, cells: [cell(lead, 'observational')], note };
  const untested = focus.find(r => r.type === 'intervention' && !cell(r, 'interventional').count && cell(r, 'preclinical').count + cell(r, 'mechanism').count);
  if (untested) return { title: `Run a first controlled human study of ${untested.name} for ${lowerFirst(endpoint)}`, design: 'Randomized, placebo-controlled pilot with a pre-registered primary outcome', population, outcome: endpoint, stratum: null, why: `${cell(untested, 'preclinical').count + cell(untested, 'mechanism').count} animal or laboratory records but no human trials are linked, so effects in people are untested.`, cells: [cell(untested, 'interventional')], note };
  if (asked('guideline') && focus.every(r => !cell(r, 'guidelines').count)) return { title: `Check guideline bodies directly for ${lead.name}`, design: 'Structured guidance review: scope, date and evidence basis', population, outcome: endpoint, stratum: null, why: 'No guideline or regulatory records are linked for the profiles in this question.', cells: [cell(lead, 'guidelines')], note };
  const layers = intents.filter(i => i.asked).map(i => i.layer);
  const candidates = focus.flatMap(r => r.cells).filter(c => !layers.length || layers.includes(c.layer));
  const empty = candidates.find(c => !c.count);
  if (empty) return { title: `Fill the empty ${empty.label.toLowerCase()} cell for ${empty.entity}`, design: { mechanism: 'Mechanistic or in vitro study', preclinical: 'Controlled animal study', observational: 'Prospective cohort with a pre-specified adjustment set', interventional: 'Randomized controlled trial', guidelines: 'Guidance review' }[empty.layer], population, outcome: endpoint, stratum: null, why: `Your question asks what this layer answers (${LAYERS.find(l => l.key === empty.layer).asks.toLowerCase()}), and the library links no records to it.`, cells: [empty], note };
  const densest = [...candidates].sort((a, b) => b.count - a.count)[0];
  return { title: `Start with the ${densest.count} ${densest.label.toLowerCase()} records for ${densest.entity}`, design: 'Critical appraisal of the existing records before new data collection', population, outcome: endpoint, stratum: null, why: 'They address your question most directly. Check their populations and comparators against yours before designing a new study.', cells: [densest], note };
}
function edited(values) { return Array.isArray(values) ? values[0] : values || ''; }

export function composeQuery(question, { edits = null, rows = [] } = {}) {
  const lines = [String(question || '').trim()];
  if (edits?.population) lines.push(`context: ${edits.population}`);
  if (edits?.outcome) lines.push(`outcome: ${edits.outcome}`);
  for (const key of edits?.intents || []) lines.push({ association: 'Focus: association.', prediction: 'Focus: prediction beyond existing models.', utility: 'Focus: clinical utility.', mechanism: 'Focus: mechanism.', guideline: 'Focus: guidelines.', enrichment: 'Focus: trial enrichment.' }[key]);
  if (!edits?.outcome) for (const outcome of [...new Set(rows.filter(r => r.outcome).map(r => r.outcome))].slice(0, 5)) lines.push(`outcome: ${outcome}`);
  return lines.filter(Boolean).join('\n').slice(0, 12000);
}
export const referenceOnly = text => /^\s*(?:pmid:?\s*)?\d{6,9}\s*$/i.test(text || '') || /^\s*(?:doi:?\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+\s*$/i.test(text || '');

const LAYER_FILTER = { mechanism: '(in vitro[tiab] OR mechanism[tiab] OR cell line[tiab])', preclinical: '(animals[mh] NOT humans[mh])', observational: '(cohort studies[mh] OR case-control studies[mh] OR cross-sectional studies[mh])', interventional: 'randomized controlled trial[pt]', guidelines: '(guideline[pt] OR practice guideline[pt] OR consensus[tiab])' };
export const pubmedSearch = (entity, layer) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`"${entity}"[tiab] AND ${LAYER_FILTER[layer]}`)}`;

export const BUSY_MESSAGE = 'Clarity’s evidence service is busy with other questions or briefly unreachable. Your question and table are still here; try again in about a minute.';
// Transient server states become a retryable busy message; request problems keep the server's own explanation.
export function mapFailure({ status = 0, data = null, error = null } = {}) {
  if (error?.name === 'AbortError') return { retry: true, message: 'The evidence service took too long to respond. It may be busy or waking up; try again in about a minute.' };
  if (error && !status) return { retry: true, message: BUSY_MESSAGE };
  if ([429, 502, 503, 504].includes(status)) return { retry: true, message: status === 503 && data?.error && data.code !== 'busy' ? data.error : BUSY_MESSAGE };
  return { retry: false, message: data?.error || 'The evidence map is unavailable. Try again shortly.' };
}
// Proxy error pages are HTML, not JSON.
export async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}
