import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Upload, Pencil, X } from 'lucide-react';
import { API_BASE } from '../platform/api.js';
import { researchInputError } from '../platform/tabular.js';
import { safeSource } from '../platform/profileModel.js';
import EffectDistribution from './EffectDistribution.jsx';
import { forestCaption, forestInterpretation } from './figureModel.js';
import CopilotResults from '../platform/CopilotResults.jsx';
import { loadVisualSnapshot } from '../profile/useVisualReport.js';
import { axisFor } from '../profile/visualModel.js';
import { LAYERS, BANDS, list } from '../profile/meaningModel.js';
import { describeEffect, measureFamily, num } from '../evidence/measures.js';
import { DEMO, MAP_VERSION, mapFailure, readJson, findingLine, detectIntents, coverageMatrix, publishedEstimates, outcomeOptions, landscapePanels, mapTensions, nextStep, composeQuery, referenceOnly, pubmedSearch, utilityRecordCount, cellFindings, cellAccuracy, briefing, predictionRows, predictionReading, leadMarker, entityBriefs } from './questionMap.js';
import { AccuracyFigures } from '../evidence/GraphProfile.jsx';
import { readResultTable, RESULT_ROLES } from './resultTable.js';
import './questionMap.css';

const TYPE = { biomarker: 'Biomarker', intervention: 'Compound', compound: 'Compound', test: 'Test', diagnostic: 'Test', screening: 'Screening', precision_oncology: 'Precision medicine', condition: 'Condition', precision_context: 'Setting', retrieved: 'From retrieved papers' };
const DIRECTION = { below: ['↓', 'Intervals below no difference'], above: ['↑', 'Intervals above no difference'], includes: ['◇', 'Intervals include no difference'], mixed: ['±', 'Mixed interval positions'], conflicting: ['⇅', 'Intervals on both sides of no difference'] };
const REVIEW = { automated: ['auto', 'Automated extraction'], partial: ['part', 'Partially reviewed'], reviewed: ['rev', 'Reviewed'] };
const LAYER_COLOR = { mechanism: '#8a70dc', preclinical: '#c7813a', observational: '#3f8ddb', interventional: '#1fa383', guidelines: '#b08418' };
const TENSION = { utility_gap: 'Association ≠ utility', association_vs_prediction: 'Association ≠ prediction', user_outside: 'Your study vs the field', conflicting: 'Conflicting', guideline_gap: 'Guidance gap', mechanism_gap: 'Mechanism gap', untested: 'Untested in people', shared_cohort: 'Shared participants' };
const USER_COLOR = '#d0b3ff';
const sameCell = (a, b) => a && b && a.entityId === b.entityId && a.layer === b.layer;

function Head({ id, letter, title, children, headingRef }) {
  return <div className="qm-panel-head"><span className="qm-letter" aria-hidden="true">{letter}</span><h2 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h2>{children}</div>;
}

function UploadReading({ upload, name, onMapping, onClear }) {
  if (upload.error) return <div className="qm-upload" role="alert"><div className="qm-upload-head"><p><strong>{name}</strong> could not be used. {upload.error}</p><button type="button" onClick={onClear}>Remove</button></div></div>;
  const { table, mapping, rows, placeable, needs } = upload, issues = rows.filter(r => r.issues.length);
  return <div className="qm-upload">
    <div className="qm-upload-head"><p><strong>{name}</strong> · {placeable.length} of {rows.length} {rows.length === 1 ? 'row' : 'rows'} can be placed on the landscape</p><button type="button" onClick={onClear}>Remove</button></div>
    {needs.length > 0 && <p className="qm-need">To place results, the table still needs {list(needs)}. Choose what each column means below.</p>}
    <details open={needs.length > 0 || placeable.length < rows.length}><summary>What we understood</summary>
      <div className="qm-scroll"><table className="qm-mapping"><thead><tr><th scope="col">Your column</th><th scope="col">Read as</th><th scope="col">First value</th></tr></thead>
        <tbody>{table.headers.map((h, i) => <tr key={i}><th scope="row">{h}</th><td><select value={mapping[i]} aria-label={`Meaning of column ${h}`} onChange={e => onMapping(mapping.map((m, j) => (j === i ? e.target.value : m)))}><option value="ignore">Not used</option>{RESULT_ROLES.map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></td><td>{table.rows[0]?.[i] || '—'}</td></tr>)}</tbody></table></div>
      {placeable.length > 0 && <ul className="qm-read-rows">{placeable.slice(0, 6).map(r => <li key={r.id}><strong>{r.outcome}</strong> · {describeEffect(r).number} · {r.mode}{r.modeInferred ? ' (inferred)' : ''}{Number.isFinite(r.n) ? ` · n=${r.n.toLocaleString('en-US')}` : ''}</li>)}</ul>}
      {issues.length > 0 && <ul className="qm-issues">{issues.slice(0, 8).map(r => <li key={r.id}>Row {r.row}{r.outcome ? ` (${r.outcome})` : ''}: {r.issues.join('; ')}</li>)}</ul>}
    </details>
  </div>;
}

function Heatmap({ matrix, intents, highlight, onOpen }) {
  const askedLayers = new Set(intents.filter(i => i.asked).map(i => i.layer));
  return <>
    <div className="qm-scroll"><table className="qm-heat">
      <caption className="qm-sr">Records per profile and evidence layer. Select a cell to see its studies.</caption>
      <thead><tr><th scope="col">Profile</th>{LAYERS.map(l => <th scope="col" key={l.key} data-asked={askedLayers.has(l.key)}>{l.short}{askedLayers.has(l.key) && <small>asked</small>}</th>)}</tr></thead>
      <tbody>{matrix.rows.map(row => <tr key={row.id}>
        <th scope="row">{row.path ? <a href={row.path}>{row.name}</a> : <span>{row.name}</span>}<small>{TYPE[row.type] || row.type}{row.temporary ? ' · temporary' : row.primary ? ' · named' : ' · related'}{row.syntheses ? ` · +${row.syntheses} syntheses` : ''}</small></th>
        {row.cells.map(c => <td key={c.layer}><button type="button" className="qm-cell" data-band={c.band} data-highlight={sameCell(c, highlight)} onClick={() => onOpen(c)}
          title={`${c.count} records · ${c.review || 'GAP'}${c.examples[0]?.retrieved?.passage?.text ? ' · '+c.examples[0].retrieved.passage.text : ''}`}
          aria-label={`${row.name}, ${c.label}: ${c.count} ${c.count === 1 ? 'record' : 'records'}${c.direction ? `, ${DIRECTION[c.direction][1].toLowerCase()}` : ''}${c.review ? `, ${REVIEW[c.review][1].toLowerCase()}` : ''}. Open.`}>
          <span className="qm-count">{c.count || 'Gap'}</span>
          <span className="qm-cell-meta">{c.direction && <span title={DIRECTION[c.direction][1]}>{DIRECTION[c.direction][0]}</span>}{c.review && <span title={REVIEW[c.review][1]}>{REVIEW[c.review][0]}</span>}</span>
        </button></td>)}
      </tr>)}</tbody>
    </table></div>
    <div className="qm-legend" aria-label="Legend">
      {['none', 'thin', 'some', 'dense'].map(b => <span key={b}><i className="qm-swatch" data-band={b} />{b === 'none' ? 'Gap: no records' : `${BANDS[b]} (${b === 'thin' ? '1–2' : b === 'some' ? '3–9' : '10+'})`}</span>)}
      <span>↓ ↑ ◇ ⇅ where reported intervals sit against no difference</span><span>auto = automated extraction</span>
    </div>
  </>;
}

// Round tick values inside the plotted domain; axisFor's ticks span that domain end to end.
const LOG_TICKS = [0.05, 0.1, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2, 3, 4, 5, 10, 20];
function niceTicks(axis, scale) {
  const lo = axis.ticks[0], hi = axis.ticks.at(-1);
  if (scale === 'log') {
    let values = LOG_TICKS.filter(v => v >= lo && v <= hi);
    while (values.length > 6) values = values.filter((v, i) => i % 2 === 0 || v === 1);
    return values.length >= 2 ? { values, nice: true } : { values: axis.ticks, nice: false };
  }
  const span = hi - lo, magnitude = 10 ** Math.floor(Math.log10(span / 4));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => span / s <= 5);
  const values = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) values.push(Number(v.toPrecision(12)));
  return values.length >= 2 ? { values, nice: true } : { values: axis.ticks, nice: false };
}
// Fallback ticks share one scale; add precision only until neighbouring labels differ.
function tickLabels(ticks) {
  for (const digits of [2, 3, 4, 5]) {
    const labels = ticks.map(t => num(Number(t.toPrecision(digits))));
    if (new Set(labels).size === labels.length) return labels;
  }
  return ticks.map(t => num(t));
}
function Forest({ panel }) {
  const rank = { interventional: 0, synthesis: 1, observational: 2 };
  const published = [...panel.published].sort((a, b) => (rank[a.layer] ?? 3) - (rank[b.layer] ?? 3) || Number(b.year || 0) - Number(a.year || 0));
  const shown = published.slice(0, 12), rows = [...shown.map(e => ({ ...e, kind: 'published' })), ...panel.user.map(u => ({ ...u, kind: 'user' }))];
  const axis = axisFor(rows, panel.fam.scale, panel.fam.nullValue), ticks = niceTicks(axis, panel.fam.scale), labels = ticks.nice ? ticks.values.map(num) : tickLabels(ticks.values);
  const W = 660, left = 188, right = 636, x = v => left + ((axis.x(v) - 240) / 590) * (right - left);
  const rowH = 30, top = 30, height = top + rows.length * rowH + 34;
  const label = r => (r.kind === 'user' ? `Your study${r.arm ? ` · ${r.arm}` : ''}` : `${r.cohort ? r.cohort.replaceAll('-', ' ') : `PMID ${r.pmid}`}${r.year ? ` · ${r.year}` : ''}`);
  return <figure className="qm-forest">
    <figcaption><strong>{forestCaption(panel)}</strong><span>{panel.fam.label} · {panel.mode} · {panel.fam.scale === 'log' ? 'log' : 'linear'} axis · reported intervals · nothing pooled</span></figcaption>
    <div className="qm-svg-scroll"><svg viewBox={`0 0 ${W} ${height}`} role="group" aria-label={`${panel.fam.label} estimates for ${panel.mode.toLowerCase()}: ${published.length} published${panel.user.length ? `, ${panel.user.length} from your table` : ''}`}>
      {ticks.values.map((t, i) => <g key={i}><line x1={x(t)} x2={x(t)} y1={top - 6} y2={height - 28} className="qm-grid" /><text x={x(t)} y={height - 10} textAnchor="middle" className="qm-tick">{labels[i]}</text></g>)}
      {panel.fam.nullValue != null && <g><line x1={x(panel.fam.nullValue)} x2={x(panel.fam.nullValue)} y1={top - 12} y2={height - 28} className="qm-null" /><text x={x(panel.fam.nullValue)} y={top - 16} textAnchor="middle" className="qm-null-label">no difference</text></g>}
      {rows.map((r, i) => {
        const y = top + i * rowH + rowH / 2, user = r.kind === 'user', color = user ? USER_COLOR : LAYER_COLOR[r.layer] || '#9fb3c4', d = describeEffect(r), name = label(r);
        const mark = <g className={`qm-row${user ? ' user' : ''}`}>
          <title>{`${name}: ${d.number}${r.population ? ` · ${r.population}` : ''}${r.exposure ? ` · ${r.exposure}` : ''}`}</title>
          <rect x="0" y={y - rowH / 2} width={W} height={rowH} className="qm-row-hit" />
          <text x="10" y={y + 4} className="qm-row-label">{name.length > 27 ? `${name.slice(0, 26)}…` : name}</text>
          {Number.isFinite(r.lower) && <line x1={x(r.lower)} x2={x(r.upper)} y1={y} y2={y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
          {user ? <rect x={x(r.point) - 6} y={y - 6} width="12" height="12" transform={`rotate(45 ${x(r.point)} ${y})`} fill={color} stroke="#0b1822" strokeWidth="2" /> : <circle cx={x(r.point)} cy={y} r="5.5" fill={color} stroke="#0b1822" strokeWidth="2" />}
        </g>;
        return user || !safeSource(r.url) ? <React.Fragment key={r.id}>{mark}</React.Fragment> : <a key={r.id} href={safeSource(r.url)} target="_blank" rel="noreferrer" aria-label={`${name}: ${d.number}. Open the source.`}>{mark}</a>;
      })}
    </svg></div>
    {published.length > shown.length && <p className="qm-note">{published.length - shown.length} more published estimates are in the records list below.</p>}
    <p className="qm-limits">Limits: source-specific populations, exposures and follow-up; intervals are not pooled, weighted or converted between measures.</p>
    <p className="qm-interpret">{forestInterpretation(panel)}</p>
    {panel.note && <p className="qm-note">{panel.note}</p>}
    {panel.comparison.map(c => <p key={c.id} className="qm-compare"><span className="qm-tag">Computed</span>{c.text}</p>)}
  </figure>;
}

function CellDrawer({ cell, onClose, estimates }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    if (!dialog) return undefined;
    if (cell && !dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); previous?.focus?.(); };
  }, [cell]);
  if (!cell) return null;
  const layer = LAYERS.find(l => l.key === cell.layer);
  // Escape is handled here as well as by the native cancel event so the drawer always closes through React state.
  return <dialog ref={ref} className="qm-drawer" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <header><span className="qm-eyebrow">{cell.entity} · {cell.label}</span><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
    <h2 id={titleId}>{cell.count ? `${cell.count} ${cell.count === 1 ? 'record' : 'records'} in this layer` : 'A gap in this layer'}</h2>
    {cell && [...new Set(estimates.filter(e => e.layer === cell.layer && e.entityIds.includes(cell.entityId)).map(e => e.outcome))].map(outcome => landscapePanels(estimates.filter(e => e.layer === cell.layer && e.entityIds.includes(cell.entityId)), outcome).map(p => <Forest key={outcome+p.key} panel={p} />))}
    <p className="qm-asks">This layer answers: {layer.asks}</p>
    {cell.count ? <AccuracyFigures {...cellAccuracy(cell.examples, cell.entityId)} /> : null}
    {cell.count ? <>
      <p>{cell.direction ? `${DIRECTION[cell.direction][1]}: ${cell.directions.below} below, ${cell.directions.above} above, ${cell.directions.includes} including no difference.` : 'No reported intervals in these records.'} {REVIEW[cell.review]?.[1]}.</p>
      <ul className="qm-drawer-list">{cell.examples.map(x => <li key={x.id}>
        {safeSource(x.url) ? <a href={safeSource(x.url)} target="_blank" rel="noreferrer">{x.title || x.id} <ArrowUpRight size={13} aria-hidden="true" /></a> : <strong>{x.title || x.id}</strong>}
        <small>{[x.design, x.year, x.quantified ? 'has a quote-backed estimate' : null].filter(Boolean).join(' · ')}</small>
        {x.retrieved?.passage?.text && <blockquote>{x.retrieved.passage.text}</blockquote>}
        {cellFindings(x, cell.entityId).slice(0, 4).map((f, i) => <p key={i}>{findingLine(f)}</p>)}
      </li>)}</ul>
      {cell.count > cell.examples.length && <p className="qm-note">Showing {cell.examples.length} of {cell.count}. The profile lists every record.</p>}
    </> : <>
      <p>No {cell.label.toLowerCase()} records are linked to {cell.entity} in the Clarity library. This is a gap in the library, not proof that no such research exists.</p>
      <p><a href={pubmedSearch(cell.entity, cell.layer)} target="_blank" rel="noreferrer">Search PubMed for this layer <ArrowUpRight size={13} aria-hidden="true" /></a></p>
    </>}
    {cell.path && <a className="qm-button qm-primary" href={cell.path}>Open the {cell.entity} profile <ArrowUpRight size={15} aria-hidden="true" /></a>}
  </dialog>;
}

function IntentEditor({ initial, onSubmit, onCancel }) {
  const [population, setPopulation] = useState(initial.population), [outcome, setOutcome] = useState(initial.outcome), [intents, setIntents] = useState(initial.intents);
  return <form className="qm-intent-editor" onSubmit={e => { e.preventDefault(); onSubmit({ population: population.trim(), outcome: outcome.trim(), intents }); }}>
    <label>Population<input value={population} onChange={e => setPopulation(e.target.value)} placeholder="For example: adults without cardiovascular disease" /></label>
    <label>Outcome<input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="For example: cardiovascular events" /></label>
    <fieldset><legend>What the question asks</legend>{detectIntents('', [], []).map(i => <label key={i.key} className="qm-check"><input type="checkbox" checked={intents.includes(i.key)} onChange={e => setIntents(v => (e.target.checked ? [...v, i.key] : v.filter(k => k !== i.key)))} />{i.label}</label>)}</fieldset>
    <div className="qm-actions"><button type="submit" className="qm-button qm-primary">Update the map</button><button type="button" className="qm-button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export default function QuestionMap() {
  const [question, setQuestion] = useState('');
  const [tableText, setTableText] = useState(''), [tableName, setTableName] = useState(''), [mapping, setMapping] = useState(null), [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState({ phase: 'idle' }), [result, setResult] = useState(null), [submitted, setSubmitted] = useState(''), [resolved, setResolved] = useState(null);
  const [edits, setEdits] = useState(null), [editingIntent, setEditingIntent] = useState(false), [editingQuestion, setEditingQuestion] = useState(false);
  const [outcome, setOutcome] = useState(''), [drill, setDrill] = useState(null), [highlight, setHighlight] = useState(null), [snapshot, setSnapshot] = useState({});
  const controller = useRef(null), mapHeading = useRef(null), started = useRef(false);

  const upload = useMemo(() => (tableText ? readResultTable(tableText, { mapping }) : null), [tableText, mapping]);
  const userRows = upload?.rows || [];
  const ready = status.phase === 'ready' && result;
  const busy = ['resolving', 'mapping'].includes(status.phase);
  const matrix = useMemo(() => (result ? coverageMatrix(result, submitted) : null), [result, submitted]);
  const estimates = useMemo(() => (result ? publishedEstimates(result, snapshot) : []), [result, snapshot]);
  const intents = useMemo(() => detectIntents(submitted, result?.copilot?.question?.focus, edits?.intents || (result?.intent ? result.intent.intents.map(x => ({ clinical_utility: 'utility' }[x] || x)) : null)), [submitted, result, edits]);
  const questionFields = useMemo(() => ({ population: edits?.population ? [edits.population] : result?.copilot?.question?.population || [], outcomes: edits?.outcome ? [edits.outcome] : result?.copilot?.question?.outcomes || [] }), [edits, result]);
  const options = useMemo(() => outcomeOptions(estimates, userRows, questionFields.outcomes), [estimates, userRows, questionFields]);
  const current = options.some(o => o.name === outcome) ? outcome : options[0]?.name || '';
  const panels = useMemo(() => landscapePanels(estimates, current, userRows, { marker: matrix ? leadMarker(matrix) : null }), [estimates, current, userRows, matrix]);
  const comparisons = panels.flatMap(p => p.comparison);
  const tensions = matrix ? mapTensions({ matrix, intents, estimates, result, comparisons }) : [];
  const next = matrix ? nextStep({ matrix, intents, estimates, question: questionFields, comparisons, outcome: current, utilityRecords: utilityRecordCount(result) }) : null;
  const predictionSet = predictionRows(estimates), prediction = { rows: predictionSet, reading: predictionReading(predictionSet) };
  const brief = matrix ? briefing({ result, matrix, intents, estimates, userRows, comparisons, questionFields, outcome: current }) : null;
  const briefs = matrix ? entityBriefs({ result, matrix, estimates }) : [];

  useEffect(() => () => controller.current?.abort(), []);
  // A new map takes the first screen: panel A at the top, heatmap and landscape directly beneath.
  useEffect(() => {
    if (!ready) return;
    requestAnimationFrame(() => {
      mapHeading.current?.closest('section')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      mapHeading.current?.focus({ preventScroll: true });
    });
  }, [ready]);
  useEffect(() => { if (result) loadVisualSnapshot().then(d => setSnapshot(d.profiles || {})).catch(() => {}); }, [result]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo')) { loadDemo(); return; }
    const evidence = params.get('evidence');
    if (evidence) {
      const text = `What does the evidence show about ${evidence}${params.get('outcome') ? ` and ${params.get('outcome')}` : ''}, and where are the gaps?`;
      setQuestion(text);
      run({ text });
    }
  }, []);

  async function run({ text = question, nextEdits = edits, rows = userRows } = {}) {
    const problem = researchInputError(text);
    if (problem) { setStatus({ phase: 'error', message: problem }); return; }
    controller.current?.abort();
    const c = new AbortController(), timer = setTimeout(() => c.abort(), 75000);
    controller.current = c;
    try {
      let body = text.trim(), reference = null;
      if (referenceOnly(body)) {
        setStatus({ phase: 'resolving' });
        const response = await fetch(`${API_BASE}/api/research/definition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body }), signal: c.signal });
        const draft = await readJson(response) || {};
        if (!response.ok) throw Object.assign(Error('request_failed'), { failure: mapFailure({ status: response.status, data: draft }) });
        if (!(draft.paper?.title || draft.paper?.abstract)) throw Error(draft.error || 'That reference could not be resolved. Paste its title or abstract instead.');
        reference = { input: body, title: draft.paper.title || 'Resolved publication' };
        body = `${draft.paper.title || ''}\n${draft.paper.abstract || ''}`.trim();
      }
      if (body.length < 20) throw Error('Describe the research question in at least 20 characters.');
      setStatus({ phase: 'mapping' });
      const response = await fetch(`${API_BASE}/api/evidence/match`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: composeQuery(body, { edits: nextEdits, rows }), workspace: true }), signal: c.signal });
      const data = await readJson(response);
      if (!response.ok || !data) throw Object.assign(Error('request_failed'), { failure: mapFailure({ status: response.ok ? 502 : response.status, data }) });
      if (controller.current !== c) return;
      setResult(data); setSubmitted(body); setResolved(reference); setOutcome(''); setDrill(null); setEditingQuestion(false);
      setStatus({ phase: 'ready' });
    } catch (error) {
      if (controller.current !== c) return;
      // A network failure (TypeError) is how browsers report an overloaded proxy without CORS headers.
      const failure = error.failure || (['AbortError', 'TypeError'].includes(error.name) ? mapFailure({ error }) : { retry: false, message: error.message });
      setStatus({ phase: 'error', message: failure.message, retry: failure.retry ? { text, nextEdits, rows } : null });
    } finally { clearTimeout(timer); }
  }

  function useTable(text, name) { setTableText(text); setTableName(name); setMapping(null); }
  function readFile(file) {
    if (!file) return;
    if (file.size > 1048576) { setStatus({ phase: 'error', message: 'Choose a table smaller than 1 MB.' }); return; }
    const reader = new FileReader();
    reader.onload = () => useTable(String(reader.result || ''), file.name);
    reader.onerror = () => setStatus({ phase: 'error', message: 'That file could not be read. Save it as CSV or TSV and try again.' });
    reader.readAsText(file);
  }
  async function loadDemo() {
    setQuestion(DEMO.question); setEdits(null);
    try {
      const text = await fetch(DEMO.table).then(r => { if (!r.ok) throw Error(); return r.text(); });
      useTable(text, DEMO.tableName);
      run({ text: DEMO.question, nextEdits: null, rows: readResultTable(text).rows || [] });
    } catch { run({ text: DEMO.question, nextEdits: null, rows: [] }); }
  }
  const dropProps = {
    onDragOver: e => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: e => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files?.[0]); },
  };
  const fileInput = <label className="qm-button qm-file">Choose a table<input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={e => { readFile(e.target.files?.[0]); e.target.value = ''; }} /></label>;
  const restatement = result?.copilot?.question?.restatement || '';
  const byType = result ? Object.entries(result.entities.reduce((m, e) => ({ ...m, [e.entity_type]: [...(m[e.entity_type] || []), e] }), {})) : [];

  return <div className="qm">
    <section className={`qm-input${ready && !editingQuestion ? ' compact' : ''}`} aria-label="Research question">
      {ready && !editingQuestion ? <div className="qm-question-bar">
        <div><span className="qm-eyebrow">Your question{resolved ? ` · resolved from ${resolved.input}` : ''}</span><p>{resolved ? resolved.title : submitted}</p>{tableName && <small>Results table: {tableName}</small>}</div>
        <button type="button" className="qm-button" onClick={() => setEditingQuestion(true)}>Change question or table</button>
      </div> : <form onSubmit={e => { e.preventDefault(); run(); }}>
        <h2>Map a research question</h2>
        <p className="qm-lede">Paste a question, abstract, protocol summary, PMID or DOI. Clarity lays it across the five evidence layers and, if you add an aggregate results table, places your study on the published landscape.</p>
        <label className="qm-field">Question, abstract, PMID or DOI<textarea value={question} maxLength={12000} rows={4} onChange={e => setQuestion(e.target.value)} placeholder="Does ApoB add information beyond LDL-C for cardiovascular events in adults, and does acting on it improve outcomes?" /></label>
        <div className="qm-drop" data-active={dragging} {...dropProps}>
          <Upload size={18} aria-hidden="true" /><div><strong>Add aggregate results (optional)</strong><span>CSV or TSV · one row per outcome or subgroup · columns such as outcome, measure, estimate, lower, upper, n</span></div>{fileInput}
        </div>
        {upload && <UploadReading upload={upload} name={tableName} onMapping={setMapping} onClear={() => { setTableText(''); setTableName(''); setMapping(null); }} />}
        <div className="qm-actions">
          <button type="submit" className="qm-button qm-primary" disabled={busy || !question.trim()}>{busy ? 'Mapping…' : 'Map my question'}</button>
          <button type="button" className="qm-button" onClick={loadDemo} disabled={busy}>Load the ApoB vs LDL-C demo</button>
          {ready && <button type="button" className="qm-button" onClick={() => setEditingQuestion(false)}>Keep the current map</button>}
        </div>
        <p className="qm-note">Claude parses your question; Clarity retrieves from Neo4j. The full question text is not stored. Its parsed fields (entity names, outcome, population and setting, which are short phrases from your wording) and their links to graph entities are kept for seven days to show which topics lack evidence, then deleted. Unrecognized entity names follow the same seven-day limit. Tables are read in this browser; only their outcome names join the search. Aggregate research data only, never patient-level records. Not for personal health decisions.</p>
      </form>}
    </section>

    {status.phase === 'error' && <div role="alert" className="qm-error"><p>{status.message}</p>{status.retry && <button type="button" className="qm-button" onClick={() => run(status.retry)}>Try again</button>}</div>}
    {busy && <div className="qm-skeleton" role="status" aria-busy="true"><p>{status.phase === 'resolving' ? 'Resolving the reference…' : 'Mapping your question across the evidence layers…'}</p><div><i /><i /><i /><i /></div></div>}
    {!ready && !busy && <div className="qm-preview" aria-label="What the map shows">
      {[['A', 'Intent', 'Association, clinical utility, mechanism and guidance, kept apart.'], ['B', 'Coverage heatmap', 'Your concepts against the five evidence layers, with gaps as first-class cells.'], ['C', 'Outcome landscape', 'Published estimates for one outcome, with your own result placed on the same scale.'], ['D–E', 'Tensions and next step', 'Where the layers stop short, and one research design that would answer it.']].map(([letter, title, text]) => <div key={letter}><span className="qm-letter">{letter}</span><strong>{title}</strong><p>{text}</p></div>)}
    </div>}

    {ready && !busy && <div className="qm-map">
      {brief && <section className="qm-panel qm-briefing" aria-labelledby="qm-brief">
        <Head id="qm-brief" letter="0" title="What the retrieved evidence says about this question" headingRef={mapHeading}><span className="qm-tag">Automated</span></Head>
        <ol className="qm-brief">{brief.sentences.map(s => <li key={s.kind} data-kind={s.kind}>{s.text}</li>)}</ol>
        {briefs.length > 0 && <div className="qm-briefs">{briefs.map(b => <article key={b.id} className="qm-entity-brief">
          <h3>{b.path ? <a href={b.path}>{b.name}</a> : b.name}<span>{b.source === 'graph' ? `${b.findings} typed ${b.findings === 1 ? 'finding' : 'findings'} in this library` : b.source === 'retrieved' ? `${b.findings} retrieved ${b.findings === 1 ? 'estimate' : 'estimates'}` : 'nothing in this library'}</span></h3>
          {b.scope && <p className="qm-brief-scope">{b.scope}</p>}
          <dl>
            {b.q4.map(line => <div key={line.kind}><dt>{line.label}</dt><dd>{line.text}</dd></div>)}
            <div><dt>Clinical utility</dt><dd>{b.q5}</dd></div>
          </dl>
          <p className="qm-brief-ladder"><span>In this library: {b.inLibrary.length ? b.inLibrary.join(', ') : 'nothing yet'}</span><span>Not yet: {b.missing.length ? b.missing.join(', ') : 'nothing missing'}</span></p>
        </article>)}</div>}
        <p className="qm-note">{brief.basis}</p>
      </section>}
      <section className="qm-panel qm-intent" aria-labelledby="qm-a">
        <Head id="qm-a" letter="A" title="What your question asks" headingRef={brief ? undefined : mapHeading}><button type="button" className="qm-button qm-ghost" onClick={() => setEditingIntent(v => !v)}><Pencil size={14} aria-hidden="true" /> Edit</button></Head>
        <p className="qm-restatement">{restatement}{edits && <span className="qm-tag">Edited</span>}</p>
        {result.parse?.mode === 'rules' && <p className="qm-need">{result.copilot.question.note}</p>}
        <div className="qm-intent-row">
          <ul className="qm-intents" aria-label="Evidence questions in your question">{intents.map(i => <li key={i.key} data-asked={i.asked} title={`${i.question} Answered by ${i.answeredBy}.`}>
            <span className="qm-intent-mark" aria-hidden="true">{i.asked ? '●' : '○'}</span><strong>{i.label}</strong><span className="qm-intent-col">{i.asked ? 'asked' : 'not asked'} · {LAYERS.find(l => l.key === i.layer).short} column</span>
          </li>)}</ul>
          <p className="qm-detected">{byType.map(([type, items]) => <span key={type}><strong>{TYPE[type] || type}</strong>{items.map((e, i) => <React.Fragment key={e.id}>{i ? ', ' : ''}{e.path ? <a href={e.path}>{e.name}</a> : <span>{e.name}</span>}</React.Fragment>)}</span>)}</p>
        </div>
        <details className="qm-intent-help"><summary>Why these questions are kept apart</summary><ul>{intents.map(i => <li key={i.key}><strong>{i.label}.</strong> {i.question} Answered by {i.answeredBy}, shown in the {LAYERS.find(l => l.key === i.layer).short} column.</li>)}</ul><p>{result.copilot.question.note}</p></details>
        {editingIntent && <IntentEditor initial={{ population: questionFields.population[0] || '', outcome: questionFields.outcomes[0] || '', intents: intents.filter(i => i.asked).map(i => i.key) }} onCancel={() => setEditingIntent(false)} onSubmit={value => { setEdits(value); setEditingIntent(false); run({ text: submitted, nextEdits: value }); }} />}
      </section>

      <div className="qm-main-grid">
        <section className="qm-panel" aria-labelledby="qm-b">
          <Head id="qm-b" letter="B" title="Evidence coverage by layer" />
          <p className="qm-sub">Shade shows how many records the library holds, not how strong they are. Gaps are cells too. Select any cell to see its studies.</p>
          {matrix.rows.length ? <Heatmap matrix={matrix} intents={intents} highlight={highlight} onOpen={setDrill} /> : <p>No entity could be resolved. Edit the named biomarker, intervention or condition and try again.</p>}
          <p className="qm-note">{matrix.note}</p>
        </section>

        <section className="qm-panel" aria-labelledby="qm-c">
          <Head id="qm-c" letter="C" title="Outcome landscape" />
          {options.length > 0 ? <label className="qm-select">Outcome<select value={current} onChange={e => setOutcome(e.target.value)}>{options.map(o => <option key={o.name} value={o.name}>{o.name} · {o.count} published{o.user ? ` · ${o.user} yours` : ''}</option>)}</select></label>
            : <p>No quote-backed estimates were retrieved for these profiles. Open a heatmap cell to read the records.</p>}
          {panels.map(p => <React.Fragment key={p.key}><Forest panel={p} /><EffectDistribution panel={p} /></React.Fragment>)}
          {panels.length > 0 && <div className="qm-legend"><span><i className="qm-dot" style={{ background: LAYER_COLOR.interventional }} />Human trial</span><span><i className="qm-dot" style={{ background: LAYER_COLOR.observational }} />Observational</span><span><i className="qm-dot" style={{ background: '#9fb3c4' }} />Synthesis or other</span><span><i className="qm-diamond" />Your study</span></div>}
          {prediction.rows.length > 0 && <figure className="qm-pred">
            <figcaption><strong>{prediction.reading.title}</strong><span>{prediction.rows.length} reported {prediction.rows.length === 1 ? 'analysis' : 'analyses'} · every outcome in this question · nothing pooled</span></figcaption>
            <div className="qm-scroll"><table>
              <thead><tr><th scope="col">Source</th><th scope="col">Added to the model</th><th scope="col">Reported value</th><th scope="col">Interval vs no change</th></tr></thead>
              <tbody>{prediction.rows.map(r => <tr key={r.id}>
                <th scope="row">{safeSource(r.url) ? <a href={safeSource(r.url)} target="_blank" rel="noreferrer">{r.pmid ? `PMID ${r.pmid}` : r.title}</a> : <span>{r.title || r.pmid}</span>}<small>{[r.year, r.design].filter(Boolean).join(' · ')}</small></th>
                <td>{r.added || r.unit || 'Not stated in the record'}{r.comparator && <small>versus {r.comparator}</small>}</td>
                <td className="qm-num">{r.number}</td>
                <td>{r.side === 'includes' ? 'Includes no change' : r.side ? 'Excludes no change' : 'No interval reported'}</td>
              </tr>)}</tbody>
            </table></div>
            <p className="qm-interpret">{prediction.reading.sentences.join(' ')}</p>
            <p className="qm-limits">{prediction.reading.limits}</p>
            <details className="qm-pred-quotes"><summary>Source passages</summary><ul>{prediction.rows.map(r => <li key={r.id}><blockquote>{r.quote}</blockquote><small>{r.pmid ? `PMID ${r.pmid}` : r.title} · {r.outcome}</small></li>)}</ul></details>
          </figure>}
          {!upload?.placeable?.length && <div className="qm-drop compact" data-active={dragging} {...dropProps}><div><strong>Place your own study on this landscape</strong><span>Drop an aggregate results table here, or choose one.</span></div>{fileInput}</div>}
          {upload && !upload.error && upload.placeable.length > 0 && !panels.some(p => p.user.length) && <p className="qm-note">Your table’s outcomes ({list([...new Set(upload.placeable.map(r => r.outcome))])}) do not match this outcome. Choose one of your outcomes above.</p>}
          {upload && <details className="qm-upload-inline"><summary>Your table: {tableName}</summary><UploadReading upload={upload} name={tableName} onMapping={setMapping} onClear={() => { setTableText(''); setTableName(''); setMapping(null); }} /></details>}
        </section>
      </div>

      <div className="qm-side-grid">
        <section className="qm-panel" aria-labelledby="qm-d">
          <Head id="qm-d" letter="D" title="Tensions and gaps" />
          {tensions.length ? <ul className="qm-tensions">{tensions.map((t, i) => <li key={i}>
            <button type="button" disabled={!t.cell} onMouseEnter={() => setHighlight(t.cell)} onMouseLeave={() => setHighlight(null)} onFocus={() => setHighlight(t.cell)} onBlur={() => setHighlight(null)} onClick={() => t.cell && setDrill(t.cell)}>
              <span className="qm-tag">{TENSION[t.kind] || 'Note'}</span><span>{t.text}</span>{t.cell && <small>{t.cell.entity} · {t.cell.label} →</small>}
            </button>
          </li>)}</ul> : <p>No tension was detected automatically. That is not evidence of agreement or complete coverage.</p>}
        </section>
        <section className="qm-panel qm-next" aria-labelledby="qm-e">
          <Head id="qm-e" letter="E" title="Next research step" />
          {next ? <>
            <h3>{next.title}</h3>
            <dl>{[['Design', next.design], ['Population', next.population], ['Outcome', next.outcome], ['Stratum', next.stratum]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <p><strong>Why.</strong> {next.why}</p>
            <p className="qm-note">{next.note}</p>
          </> : <p>Map a question with at least one named profile to get a suggested next step.</p>}
        </section>
      </div>

      <details className="qm-panel qm-records"><summary>Records, passages and reading path · {result.studies.length} retrieved of {result.coverage.studies.toLocaleString('en-US')} indexed</summary><CopilotResults result={result} /></details>
      <p className="qm-workspace">Need row-level inclusion decisions, dimension-by-dimension comparison and an audit trail? <a href="/explore/matcher?mode=workspace">Open the study workspace</a></p>
      <details className="qm-method"><summary>Method and limits</summary><p>{MAP_VERSION} on {result.version}. Coverage counts graph records constrained to the current question; directions place reported intervals against each measure’s no-difference value and are not benefit or harm judgments. Published estimates are quote-backed extractions shown on their own measure’s axis; nothing is pooled or converted. Tensions and the next step come from fixed rules over these cells, and support or contradiction is never judged automatically. The library is selected, not an exhaustive search.</p></details>
    </div>}
    <CellDrawer estimates={estimates} cell={drill} onClose={() => setDrill(null)} />
  </div>;
}
