// Aggregate result tables from researchers. Headers are mapped flexibly, values stay as written,
// nothing is converted between measures, and patient-level or identifying data are refused.
import { parseTable, researchInputError } from '../platform/tabular.js';
import { measureFamily, headerFamily, validInterval } from '../evidence/measures.js';

// Order matters: specific roles are tried before broad ones, and each role is used once.
export const RESULT_ROLES = [
  ['lower', 'Lower CI limit', /\b(?:lower|lcl|ll)\b|ci[ _.-]?(?:lo|low|lower|l)\b|low(?:er)?[ _.-]?(?:ci|bound|limit)|95\s*%?[ _.-]?(?:ci[ _.-]?)?(?:lo|low|lower)\b/i],
  ['upper', 'Upper CI limit', /\b(?:upper|ucl|ul)\b|ci[ _.-]?(?:hi|high|upper|u)\b|(?:high|upp)(?:er)?[ _.-]?(?:ci|bound|limit)|95\s*%?[ _.-]?(?:ci[ _.-]?)?(?:hi|high|upper)\b/i],
  ['ci', 'Confidence interval (one cell)', /^(?:95\s*%?\s*)?(?:ci|confidence interval)$|^confidence interval/i],
  ['level', 'Confidence level (%)', /(?:ci|confidence)[ _.-]?level|^level$/i],
  ['n', 'Sample size (n)', /^n$|^n[ _.(]|sample[ _.-]?size|^participants$|^subjects$|^number of participants|^total[ _]n$/i],
  ['metric', 'Effect measure', /metric|measure|effect[ _.-]?type|statistic|estimate[ _.-]?type/i],
  ['outcome', 'Outcome / endpoint', /outcome|endpoint|end[ _.-]point/i],
  ['comparator', 'Comparator / reference', /comparator|control|reference|versus|\bvs\b/i],
  ['timepoint', 'Follow-up / timepoint', /follow|timepoint|time[ _.-]point|duration|horizon/i],
  ['population', 'Population / setting', /population|setting|cohort|sample description/i],
  ['arm', 'Arm / subgroup', /\barm\b|group|subgroup|stratum/i],
  ['mode', 'Question type', /question[ _.-]?type|analysis[ _.-]?type|^mode$/i],
  ['exposure', 'Exposure / intervention', /exposure|intervention|treatment|predictor|marker|compound|variable/i],
  ['estimate', 'Estimate', /estimate|effect|^(?:a?hr|a?or|rr|irr|w?md|smd|beta|β)\b|^point|^value$|coef|ratio|difference|hazard|odds/i],
];
export const MODES = ['Association', 'Prediction', 'Treatment outcomes', 'Diagnostic performance'];
export const ROW_LIMIT = 200;

export function mapColumns(headers) {
  const used = new Set();
  return headers.map(h => {
    const hit = RESULT_ROLES.find(([role, , pattern]) => !used.has(role) && pattern.test(String(h).trim()));
    if (hit) used.add(hit[0]);
    return hit ? hit[0] : 'ignore';
  });
}

const MINUS = /[−–—‒]/g;
const NUM = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)';
const SEP = '(?:\\s*to\\s*|\\s*[,;]\\s*|\\s+-\\s+|-(?=[-+.\\d])|\\s+)';
export function parseNumber(value) {
  const text = String(value ?? '').trim().replace(MINUS, '-').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '').replace(/%$/, '');
  return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(text) ? Number(text) : null;
}
export function parseInterval(value) {
  const text = String(value ?? '').replace(MINUS, '-').trim();
  const m = text.match(new RegExp(`^[([]?\\s*(?:\\d{2}(?:\\.\\d)?\\s*%\\s*CI[:,]?\\s*)?(${NUM})${SEP}(${NUM})\\s*[)\\]]?$`, 'i'));
  return m ? { lower: Number(m[1]), upper: Number(m[2]) } : null;
}
// "1.21 (1.08-1.36)", "1.21 [95% CI 1.08, 1.36]" or "1.21; 95% CI 1.08 to 1.36"
export function parseEstimateCell(value) {
  const text = String(value ?? '').replace(MINUS, '-').trim();
  const m = text.match(new RegExp(`^(${NUM})\\s*[,;]?\\s*[([]\\s*(?:(\\d{2}(?:\\.\\d)?)\\s*%\\s*CI[:,]?\\s*)?(${NUM})${SEP}(${NUM})\\s*[)\\]]$`, 'i'))
    || text.match(new RegExp(`^(${NUM})\\s*[,;]\\s*(?:(\\d{2}(?:\\.\\d)?)\\s*%\\s*)?CI[:,]?\\s*(${NUM})${SEP}(${NUM})$`, 'i'));
  return m ? { point: Number(m[1]), level: m[2] ? Number(m[2]) : null, lower: Number(m[3]), upper: Number(m[4]) } : null;
}

export function inferUserMode(fam, text = '') {
  if (fam?.key === 'sensitivity' || fam?.key === 'specificity') return 'Diagnostic performance';
  if (fam?.key === 'c_index' || fam?.key === 'c_index_change') return 'Prediction';
  if (/placebo|random|trial|usual care|allocated|versus control|vs\.? control|intervention arm/i.test(text)) return 'Treatment outcomes';
  return 'Association';
}

export function readResults(table, mapping) {
  const index = role => mapping.indexOf(role);
  const get = (row, role) => index(role) >= 0 ? String(row[index(role)] ?? '').trim() : '';
  const header = role => index(role) >= 0 ? table.headers[index(role)] : '';
  const headerLevel = `${header('estimate')} ${header('ci')} ${header('lower')}`.match(/(\d{2}(?:\.\d)?)\s*%/);
  return table.rows.map((row, i) => {
    const issues = [], outcome = get(row, 'outcome'), metricText = get(row, 'metric');
    let point = parseNumber(get(row, 'estimate')), lower = parseNumber(get(row, 'lower')), upper = parseNumber(get(row, 'upper')), level = parseNumber(get(row, 'level'));
    const combined = point == null ? parseEstimateCell(get(row, 'estimate')) : null;
    if (combined) { point = combined.point; lower = combined.lower; upper = combined.upper; level ??= combined.level; }
    if ((lower == null || upper == null) && get(row, 'ci')) { const ci = parseInterval(get(row, 'ci')); if (ci) { lower = ci.lower; upper = ci.upper; } }
    if (level == null && headerLevel) level = Number(headerLevel[1]);
    const fam = measureFamily(metricText) || headerFamily(header('estimate'));
    const modeText = get(row, 'mode');
    const mode = (modeText && MODES.find(m => m.toLowerCase().startsWith(modeText.toLowerCase().slice(0, 5)))) || inferUserMode(fam, [get(row, 'exposure'), get(row, 'comparator'), get(row, 'arm')].join(' '));
    if (!outcome) issues.push('No outcome named');
    if (point == null) issues.push('No numeric estimate');
    if (!fam) issues.push(metricText ? `Effect measure “${metricText}” not recognized` : 'Effect measure not stated');
    if ((lower == null) !== (upper == null)) { issues.push('Only one confidence limit given; the interval is not used'); lower = upper = null; }
    if (fam && point != null && !validInterval(fam, point, lower, upper)) issues.push(fam.scale === 'log' && (point <= 0 || lower <= 0) ? 'Ratio values must be above 0' : 'Interval does not contain the estimate');
    const placeable = Boolean(outcome && fam && point != null && validInterval(fam, point, lower, upper));
    if (placeable && lower == null) issues.push('No interval: shown as a point only');
    return { id: `user-${i + 1}`, row: i + 1, outcome, arm: get(row, 'arm'), n: parseNumber(get(row, 'n')), metric: metricText || fam?.label || '', fam, point, lower, upper, level, population: get(row, 'population'), exposure: get(row, 'exposure'), comparator: get(row, 'comparator'), timepoint: get(row, 'timepoint'), mode, modeInferred: !modeText, placeable, issues };
  });
}

export function readResultTable(text, { delimiter = 'auto', headerRow = 1, mapping = null } = {}) {
  const problem = researchInputError(text);
  if (problem) return { error: problem };
  let table;
  try { table = parseTable(text, delimiter, headerRow); } catch (error) { return { error: error.message }; }
  if (table.rows.length > ROW_LIMIT) return { error: `This looks like row-level data (${table.rows.length} rows). Upload aggregate results instead: one row per outcome or subgroup, at most ${ROW_LIMIT} rows.` };
  const map = mapping && mapping.length === table.headers.length ? mapping : mapColumns(table.headers);
  const rows = readResults(table, map);
  const needs = [
    !map.includes('outcome') && 'a column naming the outcome',
    !map.includes('estimate') && 'a column with the effect estimate',
    !map.includes('metric') && !headerFamily(table.headers[map.indexOf('estimate')]) && 'the effect measure (for example HR, OR or mean difference) as a column or in the estimate header',
  ].filter(Boolean);
  return { table, mapping: map, rows, placeable: rows.filter(r => r.placeable), needs };
}
