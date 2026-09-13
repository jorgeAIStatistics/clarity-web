import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { API_BASE } from '../platform/api.js';
import TabularImport from '../platform/TabularImport.jsx';
import CopilotResults from '../platform/CopilotResults.jsx';
import { safeSource } from '../platform/profileModel.js';
import { blankProject, FIELDS, DIMENSIONS, VERSION, suggestDefinition, validateProject, matchedRows, quantitativeGate, overlay, interpretation, toCSV, RATIOS } from './model.js';
import './workspace.css';
const KEY = 'clarity-research-projects-v1';
const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]').filter(p => p.schema === 1);
  } catch {
    return [];
  }
};
function download(name, value, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([value], {
      type
    })),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
const fmt = e => e ? `${e.measure} ${e.estimate}${e.lower != null ? ` (${e.confidence_level}% CI ${e.lower}–${e.upper})` : ''}` : 'Not reported';
function Forest({
  gate,
  user,
  onInspect
}) {
  const svg = useRef(),
    data = [...gate.selected.map(r => ({
      id: r.id,
      label: r.study.pmid || r.study.id,
      e: r.finding.effect
    })), ...(user.eligible ? [{
      id: 'user',
      label: 'MY STUDY · USER PROVIDED',
      e: user.effect
    }] : [])],
    ratio = RATIOS.includes(data[0]?.e.measure),
    transform = v => ratio ? Math.log(v) : v,
    nullValue = ratio ? 1 : 0,
    lo = Math.min(transform(nullValue), ...data.map(d => transform(d.e.lower))),
    hi = Math.max(transform(nullValue), ...data.map(d => transform(d.e.upper))),
    x = v => 210 + (transform(v) - lo) / (hi - lo || 1) * 450;
  return <section className="rw-panel"><h3>Estimates on a common scale</h3><p>Non-pooled comparison · {data[0]?.e.measure} · {ratio ? 'logarithmic' : 'linear'} axis</p><div className="rw-scroll"><svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 860 ${data.length * 64 + 45}`} role="img" aria-label="Study-specific estimates and reported confidence intervals; no pooled effect"><line x1={x(nullValue)} x2={x(nullValue)} y1="8" y2={data.length * 64 + 8} stroke="#abc0d4" strokeDasharray="4 4" />{data.map((d, i) => <g key={d.id} fill={d.id === 'user' ? '#d6b5ff' : '#a4f0df'}><title>{d.label}: {fmt(d.e)}</title><text x="8" y={i * 64 + 27} fontSize="13">{d.label}</text><line x1={x(d.e.lower)} x2={x(d.e.upper)} y1={i * 64 + 24} y2={i * 64 + 24} stroke="currentColor" /><circle cx={x(d.e.estimate)} cy={i * 64 + 24} r="5" /><text x="680" y={i * 64 + 27} fontSize="12">{d.e.estimate} [{d.e.lower}, {d.e.upper}]</text></g>)}<text x={x(nullValue)} y={data.length * 64 + 30} fill="#bccbd9" fontSize="12">Reference {nullValue}</text></svg></div><p><strong>Shows:</strong> reported magnitudes and intervals for the selected comparison context. <strong>Does not show:</strong> a pooled effect or formal difference test. <strong>For this project:</strong> inspect precision and context before interpreting magnitude.</p><div className="rw-actions">{data.map(d => <button key={d.id} onClick={() => onInspect(d.id)}>Inspect {d.label}</button>)}<button onClick={() => download('clarity-forest.svg', svg.current.outerHTML, 'image/svg+xml')}>Export SVG</button></div></section>;
}
export default function Workspace() {
  const [p, setP] = useState(blankProject),
    [tab, setTab] = useState('question'),
    [saved, setSaved] = useState(readSaved),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    [lane, setLane] = useState('all'),
    [filter, setFilter] = useState(''),
    [inspect, setInspect] = useState(null);
  const controller = useRef(),
    reduced = useReducedMotion();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (inspect) requestAnimationFrame(() => {
      const node = document.getElementById('study-inspector');
      node?.focus({
        preventScroll: true
      });
      node?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  }, [inspect, reduced]);
  useEffect(() => {
    const name = new URLSearchParams(location.search).get('evidence');
    if (name) setP(v => ({
      ...v,
      text: `Research question about ${name}`,
      definition: {
        ...v.definition,
        exposure: name
      }
    }));
  }, []);
  const rows = useMemo(() => matchedRows(p), [p]),
    gate = quantitativeGate(p, rows),
    user = overlay(p, gate),
    insight = interpretation(p, rows),
    selected = rows.find(r => r.id === inspect),
    visible = rows.filter(r => (lane === 'all' || r.lane === lane) && [r.study.title, ...Object.values(r.mapped)].join(' ').toLowerCase().includes(filter.toLowerCase()));
  function change(patch, event = 'Project edited') {
    setP(v => {
      const last = v.audit.at(-1),
        coalesce = last?.event === event && event.includes('edited'),
        entry = {
          at: new Date().toISOString(),
          event,
          before: coalesce ? last.before : Object.fromEntries(Object.keys(patch).map(k => [k, v[k]])),
          after: patch
        };
      return {
        ...v,
        ...patch,
        audit: [...(coalesce ? v.audit.slice(0, -1) : v.audit), entry]
      };
    });
  }
  function definition(k, v) {
    controller.current?.abort();
    controller.current=null;
    setBusy(false);
    change({
      definition: {
        ...p.definition,
        [k]: v
      },
      confirmed: false,
      comparisonConfirmed: false
    }, `Study Definition edited: ${k}`);
  }
  function save() {
    if (saved.length >= 10 && !saved.some(x => x.id === p.id)) {
      setStatus('Ten projects are saved. Export and delete a saved project before saving another.');
      return;
    }
    try {
      const next = {
          ...p,
          savedAt: new Date().toISOString()
        },
        list = [next, ...saved.filter(x => x.id !== p.id)].slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(list));
      setSaved(list);
      setP(next);
      setStatus('Saved on this browser. Export a manifest for a portable backup.');
    } catch {
      setStatus('Browser storage is unavailable or full. Export the JSON manifest to keep this project.');
    }
  }
  async function search() {
    const problem = validateProject(p);
    if (problem || !p.confirmed) {
      setStatus(problem || 'Confirm the Study Definition first.');
      return;
    }
    const text = [p.text, ...Object.entries(p.definition).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n');
    if (text.length > 12000) {
      setStatus('Limit the research description and definition to 12,000 characters.');
      return;
    }
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setStatus('');
    const timer = setTimeout(() => c.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/api/evidence/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          workspace: true
        }),
        signal: c.signal
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Retrieval failed');
      if(c.signal.aborted||controller.current!==c)return;
      change({
        result,
        matchedDefinition: JSON.stringify(p.definition),
        decisions: {},
        overrides: {},
        comparisonConfirmed: false
      }, `Searched retained Clarity index; ${result.version}; ${result.coverage.studies} indexed sources; ${result.studies.length} selected; strategy: confirmed definition + description`);
      setTab('match');
      setInspect(null);
    } catch (e) {
      if(controller.current===c)setStatus(e.name === 'AbortError' ? 'Retrieval interrupted. Your definition remains here.' : e.message);
    } finally {
      clearTimeout(timer);
      if(controller.current===c)setBusy(false);
    }
  }
  function decide(r, value) {
    change({
      decisions: {
        ...p.decisions,
        [r.id]: {
          status: value,
          reason: p.decisions[r.id]?.reason || ''
        }
      },
      comparisonConfirmed: false
    }, `${r.id}: ${value}`);
  }
  function newProject() {
    controller.current?.abort();
    controller.current=null;
    setBusy(false);
    setP(blankProject());
    setTab('question');
    setStatus('New unsaved project.');
  }
  return <div className="research-workspace"><header className="rw-header"><p className="hp-eyebrow">MY RESEARCH, IN THE EVIDENCE</p><h2>Research context workspace</h2><p>Define your study. Inspect comparable evidence. Keep every conclusion connected to its source.</p><span className="pb-chip">Browser-local project · research only</span></header><details className="rw-privacy"><summary>Project storage, privacy & current scope</summary><p>Projects are unsaved until you choose Save on this browser. Saved projects remain in this browser’s local storage until deleted or browser data is cleared; they are not encrypted or protected by a Clarity account. Anyone with access to this browser profile can read them. Up to 10 projects are retained. Raw CSV/TSV files stay local; only mapped concepts are retained in the project. No project data enters public profiles.</p><p>When you choose Match, your description and confirmed definition are sent to Clarity’s retrieval API, not stored as a server project or sent to a model provider. This release accepts aggregate research descriptions and CSV/TSV concepts, not patient-level data. PDF/XLSX ingestion and raw-data statistical modeling are not enabled. Reference IDs can accompany a description; this is not an exhaustive external database search.</p></details><div className="rw-actions"><button onClick={save}>Save on this browser</button><button onClick={() => download('clarity-project.json', JSON.stringify({
        ...p,
        engine: VERSION,
        rows,
        gate,
        interpretation: insight
      }, null, 2))}>Export project / audit JSON</button><button onClick={newProject}>New project</button><label>Open saved project<select value="" onChange={e => {
          const found = saved.find(x => x.id === e.target.value);
          if (found) {
            controller.current?.abort();
            setBusy(false);
            setP(found);
            setTab('question');
            setStatus('Loaded the last saved version.');
          }
        }}><option value="">Choose…</option>{saved.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label></div>{p.savedAt && <p className="pb-note">Last saved {new Date(p.savedAt).toLocaleString()}. Edits require saving again. <button onClick={() => {
        try {
          const list = saved.filter(x => x.id !== p.id);
          localStorage.setItem(KEY, JSON.stringify(list));
          setSaved(list);
          setP(v => ({
            ...v,
            savedAt: null
          }));
          setStatus('Saved browser copy deleted. Current unsaved session remains until you choose New project or close the page.');
        } catch {
          setStatus('Browser storage could not be changed.');
        }
      }}>Delete saved copy</button></p>}{status && <p role="status" className="rw-notice">{status}</p>}<nav className="rw-steps" aria-label="Research workflow">{[['question', '1 My question'], ['match', '2 Match'], ['synthesize', '3 Synthesize'], ['interpret', '4 Interpret'], ['audit', '5 Audit']].map(([k, label]) => <button key={k} aria-current={tab === k ? 'step' : undefined} onClick={() => {
        setTab(k);
        if (k === 'synthesize') change({}, 'Viewed synthesis gates and source-specific figures; no pooling or metric conversion');
      }}>{label}</button>)}</nav><motion.div key={tab} initial={{
      opacity: reduced ? 1 : 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: reduced ? 0 : .2
    }}>
 {tab === 'question' && <><section className="rw-panel"><h3>What are you doing?</h3><fieldset className="rw-stage"><legend>Research stage</legend>{[['planning', 'Planning a study'], ['analyzing', 'Analyzing results'], ['writing', 'Interpreting / writing results']].map(([v, label]) => <label key={v}><input type="radio" name="stage" checked={p.stage === v} onChange={() => change({
                stage: v
              })} />{label}</label>)}</fieldset><p>{p.stage === 'planning' ? 'Identify comparable populations, methods and endpoints before finalizing the protocol.' : p.stage === 'analyzing' ? 'Specify your estimand and comparison context. No statistical model is chosen automatically.' : 'Position the result against comparable reports and document its limits.'}</p><label>Project title<input maxLength={120} value={p.title} onChange={e => change({
              title: e.target.value
            })} /></label><label>Research question, abstract, protocol or reference collection<textarea maxLength={9000} value={p.text} onChange={e => {
              controller.current?.abort();
              setBusy(false);
              change({
                text: e.target.value,
                confirmed: false,
                result: null,
                comparisonConfirmed: false
              });
            }} /></label><label>Hypothesis (optional)<input maxLength={500} value={p.hypothesis} onChange={e => change({
              hypothesis: e.target.value,
              confirmed: false,
              comparisonConfirmed: false
            })} /></label><button onClick={() => {
            change({
              definition: suggestDefinition(p.text),
              confirmed: false,
              result: null,
              comparisonConfirmed: false
            }, 'Drafted definition from explicitly labeled text; no inferred missing values');
            setStatus('Drafted only recognized fields. Review and fill the Study Definition below.');
          }}>Draft Study Definition</button></section><details className="rw-panel"><summary>Use an aggregate CSV / TSV table</summary><TabularImport onUse={text => change({
            text,
            confirmed: false,
            result: null,
            comparisonConfirmed: false
          }, 'Mapped aggregate table concepts; raw file not retained')} /></details><form className="rw-panel" action="#" onSubmit={e => {
          e.preventDefault();
          const problem = validateProject(p);
          if (problem) {
            setStatus(problem);
            return;
          }
          change({
            confirmed: true
          }, 'Researcher confirmed Study Definition; missing fields remain unknown');
          setStatus('Study Definition confirmed. Unknown fields remain explicitly unknown.');
        }}><h3>Study Definition</h3><p>USER PROVIDED · Drafted fields require your confirmation. Leave unknown values blank. Exposure and primary outcome are required; missing comparability fields prevent quantitative comparison.</p><div className="rw-fields">{Object.entries(FIELDS).filter(([k]) => DIMENSIONS.includes(k) || k === 'units').map(([k, label]) => <label key={k}>{label}{['exposure', 'outcome'].includes(k) ? ' (required)' : ''}<input name={k} required={['exposure', 'outcome'].includes(k)} maxLength={400} value={p.definition[k] || ''} onChange={e => definition(k, e.target.value)} placeholder="Unknown / not specified" /></label>)}</div><details><summary>Additional design, model and analysis fields</summary><div className="rw-fields">{Object.entries(FIELDS).filter(([k]) => !DIMENSIONS.includes(k) && k !== 'units').map(([k, label]) => <label key={k}>{label}<input name={k} maxLength={400} value={p.definition[k] || ''} onChange={e => definition(k, e.target.value)} placeholder="Unknown / not specified" /></label>)}</div></details><button type="submit">Confirm Study Definition</button> <span className="pb-chip">{p.confirmed ? 'Confirmed by researcher' : 'Awaiting confirmation'}</span></form><button className="rw-primary" disabled={busy} onClick={search}>{busy ? 'Retrieving source records…' : 'Match confirmed study to evidence'}</button></>}
 {tab !== 'question' && !p.result && <section className="rw-panel"><h3>Start with a confirmed study</h3><p>Define the question and match it to the library before inspecting this stage.</p><button onClick={() => setTab('question')}>Go to My question</button></section>}
 {tab === 'match' && p.result && <><section className="rw-panel"><h3>Which records are scientifically comparable?</h3><p>Matching reports explicit dimension overlap, not a probability of directness. Same wording still requires scientific review; unknown fields earn no credit. Each row is one study–outcome record.</p><div className="rw-fields"><label>Evidence lane<select value={lane} onChange={e => setLane(e.target.value)}><option value="all">All lanes, kept separate</option>{[...new Set(rows.map(r => r.lane))].map(x => <option key={x}>{x}</option>)}</select></label><label>Filter design, outcome, population or exposure<input value={filter} onChange={e => setFilter(e.target.value)} /></label></div><p role="status">{visible.length} of {rows.length} study–outcome records · {p.result.studies.length} publications retrieved</p><div className="rw-scroll"><table className="rw-table"><thead><tr>{['Study / source', 'Layer / design', 'Population / N', 'Exposure / comparator', 'Outcome / magnitude', 'Dimension match', 'Include?'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={r.id}><td><button onClick={() => setInspect(r.id)}>{r.study.title}</button><small>{r.study.id}</small></td><td>{r.lane}<small>{r.study.design || 'Unknown design'}</small></td><td>{r.mapped.population || 'Not extracted'}<small>N: {r.mapped.n || 'Not reported'}</small></td><td>{r.mapped.exposure || 'Not extracted'}<small>Comparator: {r.mapped.comparator || 'Not extracted'}</small></td><td>{r.mapped.outcome || 'Not extracted'}<button onClick={() => setInspect(r.id)}>{fmt(r.finding?.effect)}</button></td><td><strong>{r.exact} same / {DIMENSIONS.length} dimensions</strong><small>{DIMENSIONS.length - r.known} unknown</small><button onClick={() => setInspect(r.id)}>Inspect mismatches</button></td><td><select aria-label={`Decision for ${r.id}`} value={r.decision} onChange={e => decide(r, e.target.value)}><option value="undecided">Undecided</option><option value="include">Include</option><option value="exclude">Exclude</option></select></td></tr>)}</tbody></table></div><button onClick={() => download('clarity-study-matrix.csv', toCSV(rows), 'text/csv')}>Export evidence table CSV</button></section><section className="rw-panel"><h3>Evidence neighborhood</h3><p>Each node is a study–outcome record. Layers describe study scope, not a ladder proving translation. Click a node for its finding, context and provenance.</p><div className="rw-map">{['mechanism', 'preclinical', 'observational', 'interventional', 'synthesis', 'guidelines', 'unclassified'].map(layer => <div key={layer} data-layer={layer}><h4>{layer}</h4>{rows.filter(r => r.study.layer === layer).map(r => <button key={r.id} onClick={() => setInspect(r.id)}>{r.study.pmid || r.study.id}<small>{r.study.design || 'Design unknown'} · {r.mapped.outcome || 'Outcome not extracted'} · {r.finding?.effect ? fmt(r.finding.effect) : 'Magnitude not extracted'} · N {r.mapped.n || '?'} · {r.exact} same dimensions</small></button>)}{!rows.some(r => r.study.layer === layer) && <small>No retrieved records</small>}</div>)}</div><p>Shows the retrieved study set. Does not establish translational concordance or literature completeness. Use it to locate missing layers for this question.</p></section><section className="rw-panel"><h3>Study-characteristic heatmap</h3><div className="rw-scroll"><table className="rw-table"><thead><tr><th>Study</th>{DIMENSIONS.map(k => <th key={k}>{FIELDS[k]}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={r.id}><th><button onClick={() => setInspect(r.id)}>{r.study.id}</button></th>{DIMENSIONS.map(k => <td key={k} data-match={r.dimensions[k].state} title={`${p.definition[k] || 'Unspecified'} ↔ ${r.mapped[k] || 'Unknown'}`}>{r.dimensions[k].state}</td>)}</tr>)}</tbody></table></div><p>Shows recorded context differences relative to your definition, not risk of bias or study quality. Unknown context identifies what needs extraction before comparison.</p></section></>}
 {tab === 'synthesize' && p.result && <><section className="rw-panel"><h3>Can these estimates be compared?</h3><p>{gate.pooling}</p><label className="rw-check"><input type="checkbox" checked={p.comparisonConfirmed} onChange={e => change({
              comparisonConfirmed: e.target.checked
            }, 'Comparison applicability confirmation changed')} />I have reviewed the included source passages, comparison mappings and applicability to the confirmed Study Definition.</label>{!gate.eligible && <><span className="pb-chip">Quantitative comparison withheld</span><ul>{gate.reasons.map(x => <li key={x}>{x}</li>)}</ul><p>Use the matrix and source inspector to complete missing context. User-entered mappings remain separate from source facts.</p></>}</section>{gate.eligible && <Forest gate={gate} user={user} onInspect={setInspect} />}<section className="rw-panel"><h3>Contextualize my result</h3><p>USER PROVIDED · Aggregate study estimate only. Your result is never added to published evidence or a pooled estimate.</p><div className="rw-fields">{[['metric', 'Effect metric'], ['estimate', 'Estimate'], ['lower', 'Lower confidence limit'], ['upper', 'Upper confidence limit'], ['confidence_level', 'Confidence level (%)']].map(([k, label]) => <label key={k}>{label}<input value={p.userResult[k]} onChange={e => change({
                userResult: {
                  ...p.userResult,
                  [k]: e.target.value
                }
              }, `User result edited: ${k}`)} /></label>)}</div><p>{user.note}</p>{user.eligible && <ul>{user.comparisons.map(x => <li key={x.id}>{x.id}: {x.sameDirection ? 'same side of the null' : 'different side of the null'}; intervals {x.intervalOverlap ? 'overlap' : 'do not overlap'}. COMPUTED RESULT.</li>)}</ul>}</section><section className="rw-panel"><h3>Human / animal / cell concordance</h3><div className="rw-scroll"><table className="rw-table"><thead><tr><th>Outcome</th><th>Cell</th><th>Animal</th><th>Human</th></tr></thead><tbody>{[...new Set(rows.map(r => r.mapped.outcome).filter(Boolean))].map(outcome => <tr key={outcome}><th>{outcome}</th>{[['mechanism'], ['preclinical'], ['observational', 'interventional']].map((layers, i) => <td key={i}>{rows.filter(r => r.mapped.outcome === outcome && layers.includes(r.study.layer)).map(r => <button key={r.id} onClick={() => setInspect(r.id)}>{fmt(r.finding?.effect)}<small>{r.study.id} · concordance not appraised</small></button>)}{!rows.some(r => r.mapped.outcome === outcome && layers.includes(r.study.layer)) && 'Not retrieved'}</td>)}</tr>)}</tbody></table></div><p>Shows source-specific observations across layers, without pooling. It does not establish a coherent mechanistic chain, replication or human benefit. Review endpoint meaning and model differences to assess translation.</p></section></>}
 {tab === 'interpret' && p.result && <><section className="rw-panel"><h3>What limits this comparison?</h3><p>{insight.dominant}</p><h4>Differences to investigate</h4>{insight.differences.length ? insight.differences.map(d => <details key={d.key}><summary>{FIELDS[d.key]} · {d.values.length} recorded contexts</summary><ul>{d.values.map(v => <li key={v}>{v}</li>)}</ul></details>) : <p>No contrasting context has been established among included records. This is not evidence of agreement.</p>}<p>Do not call these differences biological disagreement until outcome definitions, adjustment, follow-up and overlapping participants are resolved. Risk of bias remains unappraised.</p></section><section className="rw-panel"><h3>What does my study add?</h3><p>{insight.contribution}</p><label>Researcher interpretation and contribution rationale<textarea value={p.notes} onChange={e => change({
              notes: e.target.value
            }, 'Researcher interpretation edited')} maxLength={5000} /></label><h4>What evidence would most reduce uncertainty?</h4><p>{insight.dominant} A targeted source review or study using that explicitly specified context is more informative than simply increasing the paper count.</p></section><details className="rw-panel"><summary>Explore the question-level research landscape</summary><CopilotResults result={p.result} /></details></>}
 {tab === 'audit' && <section className="rw-panel"><h3>Source facts → user mappings → calculations</h3><p>Engine {VERSION}. Retrieval {p.result?.version || 'not run'}. No live external search is implied: this project searches Clarity’s retained source index. Original estimates are preserved; no metric conversion or pooled computation is performed. Generated comparisons use recorded values and the confirmed user mappings.</p><p>Numerical labels: ABSTRACT EXTRACTED for retained finding passages; USER PROVIDED for mappings and your result; COMPUTED RESULT for coordinate transforms, dimension counts and interval comparisons. Missing values stay NOT REPORTED. No model-inferred numbers enter analysis.</p><button onClick={() => download('clarity-analysis-manifest.json', JSON.stringify({
          ...p,
          engine: VERSION,
          rows,
          gate,
          user,
          interpretation: insight
        }, null, 2))}>Export complete analysis manifest</button><ol>{p.audit.map((a, i) => <li key={i}><time>{a.at}</time> · {a.event}</li>)}</ol><h4>Inclusion / exclusion record</h4>{rows.map(r => <p key={r.id}>{r.id} · {r.decision} · {r.reason || 'No rationale entered'}</p>)}</section>}
 </motion.div>{selected && <section id="study-inspector" tabIndex={-1} className="rw-inspector" aria-label="Study and extraction inspector"><button onClick={() => setInspect(null)}>Close source inspector</button><h3>{selected.study.title}</h3><a href={safeSource(selected.study.url)} target="_blank" rel="noreferrer">{selected.study.id} · original publication ↗</a><p>SOURCE FACT · {selected.study.review_status || 'Review status unrecorded'} · Risk of bias not appraised</p><p>{fmt(selected.finding?.effect)}</p><blockquote>{selected.finding?.quote || selected.study.passage?.text || 'No retained passage'}</blockquote><p>{selected.finding?.quote ? 'ABSTRACT EXTRACTED' : 'SOURCE PASSAGE / NO QUANTITATIVE EXTRACTION'} · {selected.study.id} · {selected.finding?.source_span ? `characters ${selected.finding.source_span.start}–${selected.finding.source_span.end}` : 'See retained source passage'} · original value retained · transformation: none</p><p>{selected.study.population} · {selected.study.exposure}</p><h4>Scientific dimensions</h4><div className="rw-scroll"><table className="rw-table"><thead><tr><th>Dimension</th><th>My study</th><th>Source field</th><th>Match</th></tr></thead><tbody>{DIMENSIONS.map(k => <tr key={k}><th>{FIELDS[k]}</th><td>{p.definition[k] || 'Unspecified'}</td><td>{selected.original[k] || 'Not extracted'}{p.overrides[selected.id]?.[k] && <small>USER MAPPING: {p.overrides[selected.id][k]}</small>}</td><td>{selected.dimensions[k].label}</td></tr>)}</tbody></table></div><details><summary>Confirm context from original report / document a mapping</summary><p>USER PROVIDED · These fields do not replace original source facts. Enter comparable wording only after checking the original report; record the section or table in the rationale.</p><div className="rw-fields">{['population', 'exposure', 'comparator', 'outcome', 'design', 'timepoint', 'species', 'units'].map(k => <label key={k}>{FIELDS[k]}<input value={p.overrides[selected.id]?.[k] || ''} onChange={e => change({
              overrides: {
                ...p.overrides,
                [selected.id]: {
                  ...p.overrides[selected.id],
                  [k]: e.target.value
                }
              },
              comparisonConfirmed: false
            }, `${selected.id}: researcher mapped ${k}`)} /></label>)}</div></details><label>Inclusion / exclusion rationale and mapping source location<textarea value={p.decisions[selected.id]?.reason || ''} onChange={e => change({
          decisions: {
            ...p.decisions,
            [selected.id]: {
              status: selected.decision,
              reason: e.target.value
            }
          },
          comparisonConfirmed: false
        }, `${selected.id}: rationale edited`)} /></label><button onClick={() => decide(selected, 'include')}>Include this outcome</button> <button onClick={() => decide(selected, 'exclude')}>Exclude this outcome</button></section>}{inspect === 'user' && <section className="rw-panel"><h3>User-result provenance</h3><p>USER PROVIDED · entered in this project · no transformation. Values and edit history are retained in the project manifest.</p><button onClick={() => setInspect(null)}>Close</button></section>}</div>;
}
