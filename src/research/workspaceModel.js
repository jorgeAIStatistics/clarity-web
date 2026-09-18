// Findings workspace: one table a researcher can filter, select, take away, and cite.
// Every row keeps where it came from — a typed finding in the graph, or an estimate retrieved for
// this question — because the two carry different warranties and must never be silently merged.
import { valueText } from '../evidence/graphProfile.js';

export const SOURCES = { graph: 'In this library', retrieved: 'Retrieved for this question' };

const clean = value => (value == null ? '' : String(value));

export function workspaceRows({ result, estimates = [] } = {}) {
  const names = Object.fromEntries((result?.entities || []).map(e => [e.id, e.name]));
  const rows = (result?.graph_findings || []).map(f => ({
    id: `graph:${f.id}`, source: 'graph', entityId: f.entity_id, entity: names[f.entity_id] || f.entity_id,
    kind: f.kind || 'association', measure: f.measure, value: f.estimate ?? null, lower: f.lower ?? null, upper: f.upper ?? null,
    unit: f.unit ?? null, cutoff: f.cutoff ?? null, n: f.n ?? null, target: f.target || f.statement || '', population: f.population || '',
    assay: f.assay || '', layer: f.layer || '', pmid: f.pmid || '', title: f.title || '', year: f.year || '',
    quote: f.quote || '', review: f.review_state || 'automated', provenance: f.provenance || 'unclear',
    display: valueText({ measure: f.measure, estimate: f.estimate, lower: f.lower, upper: f.upper, level: f.level, unit: f.unit, cutoff: f.cutoff, cutoff_unit: f.cutoff_unit }),
  }));
  for (const e of estimates) {
    rows.push({
      id: `retrieved:${e.id}`, source: 'retrieved', entityId: (e.entityIds || [])[0] || '', entity: (e.entityIds || []).map(id => names[id]).filter(Boolean).join(' · '),
      kind: { Association: 'association', Prediction: 'discrimination', 'Treatment outcomes': 'effect', 'Diagnostic performance': 'classification' }[e.mode] || 'association',
      measure: e.fam?.label || '', value: e.point ?? null, lower: e.lower ?? null, upper: e.upper ?? null, unit: e.unit ?? null, cutoff: null, n: e.n ?? null,
      target: e.outcome || '', population: e.population || '', assay: '', layer: e.layer || '', pmid: e.pmid || '', title: e.title || '',
      year: e.year || '', quote: e.quote || '', review: e.review === 'reviewed' ? 'reviewed' : 'automated', provenance: 'unclear',
      display: [e.fam?.label, e.point, Number.isFinite(e.lower) ? `(${e.lower} to ${e.upper})` : ''].filter(x => x !== '' && x != null).join(' '),
    });
  }
  return rows;
}

export function facets(rows) {
  const count = key => {
    const tally = new Map();
    for (const row of rows) if (row[key]) tally.set(row[key], (tally.get(row[key]) || 0) + 1);
    return [...tally].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([value, n]) => ({ value, n }));
  };
  return { kind: count('kind'), measure: count('measure'), layer: count('layer'), entity: count('entity'), source: count('source') };
}

export function filterRows(rows, { kinds = [], measures = [], layers = [], entities = [], sources = [], text = '' } = {}) {
  const needle = text.trim().toLowerCase();
  return rows.filter(row => (!kinds.length || kinds.includes(row.kind))
    && (!measures.length || measures.includes(row.measure))
    && (!layers.length || layers.includes(row.layer))
    && (!entities.length || entities.includes(row.entity))
    && (!sources.length || sources.includes(row.source))
    && (!needle || [row.entity, row.target, row.population, row.measure, row.assay, row.quote, row.pmid].join(' ').toLowerCase().includes(needle)));
}

// Sample size sits beside the estimate because an estimate without it cannot be weighed, and it was
// stored on every finding while appearing in neither the table nor the export.
export const COLUMNS = ['entity', 'kind', 'measure', 'value', 'lower', 'upper', 'unit', 'cutoff', 'n', 'target', 'population', 'assay', 'layer', 'pmid', 'year', 'review', 'provenance', 'source', 'quote'];
const cell = (row, key) => (key === 'source' ? SOURCES[row.source] || row.source : clean(row[key]));

export function toTsv(rows) {
  return [COLUMNS.join('\t'), ...rows.map(row => COLUMNS.map(key => cell(row, key).replace(/[\t\n]+/g, ' ')).join('\t'))].join('\n');
}

export function toCsv(rows) {
  const escape = value => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return [COLUMNS.join(','), ...rows.map(row => COLUMNS.map(key => escape(cell(row, key))).join(','))].join('\n') + '\n';
}

export function toJson(rows, meta = {}) {
  return JSON.stringify({ version: 'clarity-findings-export-v1', exported_at: new Date().toISOString(), ...meta, rows }, null, 2);
}

// A paragraph a researcher can paste into their methods, stating the boundary of the search as
// well as its result. Absence is reported as absence of indexing, never as absence of evidence.
export function methodsSnippet({ question = '', restatement = '', rows = [], briefs = [], result = null, filters = null, context = 'question', subject = '' } = {}) {
  const typed = rows.filter(r => r.source === 'graph');
  const retrieved = rows.filter(r => r.source === 'retrieved');
  const byKind = [...new Set(typed.map(r => r.kind))].sort().map(kind => `${typed.filter(r => r.kind === kind).length} ${kind}`);
  const named = briefs.filter(b => !b.context);
  const missing = [...new Set(named.flatMap(b => b.missing || []))];
  const entities = named.map(b => b.name).join(', ') || 'no entity was resolved';
  const asked = restatement || question.trim().slice(0, 300);
  const when = new Date().toISOString().slice(0, 10);
  const named_subject = subject || entities;
  const lines = [
    context === 'profile'
      ? `Source: the Clarity evidence-graph profile for ${named_subject}, read on ${when}.`
      : `Question as parsed: ${asked}`,
    context === 'profile'
      ? `A finding is attached to ${named_subject} only when that name is written in the passage it came from; related markers are never added.`
      : `Entities resolved from the question text: ${entities}. Only entities named in the question are linked; related markers are never added.`,
    typed.length
      ? `In this library: ${typed.length} typed finding${typed.length === 1 ? '' : 's'} (${byKind.join(', ')}), each bound to a quoted source passage.`
      : 'In this library: no typed finding is indexed for these entities.',
    retrieved.length ? `Retrieved for this question: ${retrieved.length} quote-backed estimate${retrieved.length === 1 ? '' : 's'} from indexed records.` : null,
    missing.length ? `Not in this library for at least one entity: ${missing.join(', ').toLowerCase()}. Absence here means Clarity holds no matching record, not that no such study exists.` : null,
    filters ? `Rows shown were filtered by ${filters}.` : null,
    `Extraction is automated and not expert-reviewed. Aggregate published results only; no patient-level data. Clarity, ${when}.`,
  ];
  return lines.filter(Boolean).join(' ');
}
