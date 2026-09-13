import React, { useEffect, useMemo, useState } from 'react';
import { buildReport, filterRows, magnitude, precision, direction, scale, sortRows, UNKNOWN } from './reportModel.js';
import { safeSource } from '../platform/profileModel.js';
import LivingResearch from '../evidence/LivingResearch.jsx';
import './report.css';
import { transitionView } from '../motion/navigation.js';
const layerNames = {
  mechanism: 'Cell / mechanism',
  preclinical: 'Animal',
  observational: 'Human observational',
  interventional: 'Human controlled',
  synthesis: 'Systematic review / meta-analysis',
  guidelines: 'Guidelines',
  protocol: 'Protocols',
  unclassified: 'Unclassified'
};
let enrichment;
function load() {
  return enrichment || (enrichment = Promise.all(['/intervention-enrichment.json', '/profile-report-context.json'].map(url => fetch(url).then(r => {
    if (!r.ok) throw Error('Source data unavailable');
    return r.json();
  }))).catch(e => {
    enrichment = null;
    throw e;
  }));
}
function Interval({
  row,
  onSource
}) {
  const e = row.effect;
  if (!e) return null;
  const {
    x,
    nullValue
  } = scale(e);
  return <figure className="ar-interval"><figcaption><button onClick={() => onSource(row.key)}>{row.year} · PMID {row.id} ↗</button><strong>{magnitude(e)}</strong><span>{e.interval_level ? `${e.interval_level}% ` : ''}CI {e.lower}–{e.upper}</span></figcaption><svg viewBox="0 0 600 90" role="img" aria-label={`${row.endpoint}: ${magnitude(e)}, interval ${e.lower} to ${e.upper}. Reference ${nullValue}. Each panel has its own scale.`}><line x1="30" x2="570" y1="35" y2="35" stroke="#334155" /><line x1={x(nullValue)} x2={x(nullValue)} y1="8" y2="55" stroke="#a1abc0" strokeDasharray="4 4" /><line x1={x(e.lower)} x2={x(e.upper)} y1="35" y2="35" stroke="#54dec3" strokeWidth="4" />{[e.lower, e.upper].map((v, i) => <line key={i} x1={x(v)} x2={x(v)} y1="26" y2="44" stroke="#54dec3" strokeWidth="2" />)}<circle cx={x(e.estimate)} cy="35" r="6" fill="#54dec3" /><text x={x(e.lower)} y="70" textAnchor="middle">{e.lower}</text><text x={x(e.upper)} y="70" textAnchor="middle">{e.upper}</text><text x={x(nullValue)} y="20" textAnchor="middle">{nullValue} · null</text></svg><p>{row.design} · N {row.sample_size?.toLocaleString() || 'not extracted'} · {row.population}</p><p>{row.dose} · {row.duration} · {row.endpoint}</p>{row.layer === 'synthesis' && <p>Published pooled estimate from this review; Clarity has not pooled it again.</p>}</figure>;
}
function Chips({
  values,
  value,
  onChange,
  label
}) {
  return <div className="ar-chips" role="group" aria-label={label}>{values.map(v => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{v}</button>)}</div>;
}
export default function AnalyticalProfile({
  model,
  children
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(false),
    [requested, setRequested] = useState(() => new URLSearchParams(location.search).get('outcome') || ''),
    [filters, setFilters] = useState({}),
    [chosen, setChosen] = useState(''),
    [preset, setPreset] = useState('Characteristics'),
    [order, setOrder] = useState('date'),
    [stage, setStage] = useState('Outcome matched'),
    [expanded, setExpanded] = useState('');
  useEffect(() => {
    let active = true;
    load().then(x => {
      if (active) setData(x);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const pop = () => {
      setRequested(new URLSearchParams(location.search).get('outcome') || '');
      setFilters({});
      setChosen('');
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const slug = model.targetId.replace('compound:', ''),
    outcomes = useMemo(() => buildReport(model, data?.[0]?.profiles?.[slug], data?.[1]?.profiles?.[slug]), [model, data, slug]);
  const selected = outcomes.find(o => o.name === requested) || outcomes[0],
    rows = filterRows(selected?.rows || [], filters),
    effects = rows.filter(r => r.effect),
    answer = effects.find(r => r.key === chosen) || effects[0],
    ordered = sortRows(rows, order);
  function select(name) {
    setRequested(name);
    setFilters({});
    setChosen('');
    setExpanded('');
    const url = new URL(location.href);
    url.searchParams.set('outcome', name);
    history.pushState({}, '', url);
  }
  function jump(key) {
    setExpanded(key);
    requestAnimationFrame(() => {
      const el = document.getElementById(`source-${key}`);
      el?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'center'
      });
      el?.focus({
        preventScroll: true
      });
    });
  }
  if (!data && !error) return <article className="ar-report" aria-busy="true"><section><p className="hp-eyebrow">INTERVENTION · SCIENTIFIC EVIDENCE REPORT</p><h1>{model.name}</h1><p role="status">Preparing the source-backed evidence report…</p><div className="ar-skeleton" aria-hidden="true" /><div className="ar-skeleton" aria-hidden="true" /></section></article>;
  if (!selected) return <section className="ar-report"><h1>{model.name}</h1><p>Study interpretation is awaiting source records.</p></section>;
  const caveat = answer?.limitation || 'Endpoint, comparison and population alignment require appraisal before a numerical conclusion can be drawn.';
  const needed = answer?.neededEvidence || (!answer ? 'Validate the exact outcome and intervention contrast in the retained sources, then extract the estimate and its uncertainty.' : answer.effect.lower <= 1 && answer.effect.upper >= 1 && ['hr', 'rr', 'or', 'rate_ratio'].includes(answer.effect.metric) ? `More precise evidence on ${selected.name.toLowerCase()} in ${answer.population}, using the same intervention contrast and a prespecified clinically meaningful threshold.` : `Assess clinical importance and risk of bias for ${selected.name.toLowerCase()}, then test applicability beyond the population in the selected source.`);
  const stages = {
    'Retrieved': null,
    'Relevant': null,
    'Classified': rows.filter(r => r.layer !== 'unclassified'),
    'Outcome matched': rows,
    'Completed studies': null,
    'Quantitatively extracted': rows.filter(r => r.effect),
    'Included in selected analysis': effects
  };
  const domains = {
    'Study design': `${[...new Set(rows.map(r => r.design).filter(Boolean))].join(', ') || 'Not classified'}. Designs inform interpretation; counts are not evidence quality.`,
    'Risk of bias': 'No study-level risk-of-bias assessment has been completed in this report. A published review may assess bias; its domain ratings have not been imported.',
    Consistency: 'No formal heterogeneity or consistency analysis has been performed. Different endpoints, populations and cointerventions must be assessed first.',
    Precision: precision(answer?.effect),
    Directness: answer?.contextQuote || 'Eligibility, baseline status and intervention alignment are not yet fully extracted.',
    'Publication bias': 'Not assessed. Missing records and publication counts cannot establish the presence or absence of publication bias.'
  };
  return <article className="ar-report">
 <nav className="ar-nav" aria-label="Evidence report sections">{['Answer', 'Landscape', 'Deep dive', 'Audit'].map((n, i) => <a href={`#ar-${i}`} key={n}><small>0{i + 1}</small>{n}</a>)}</nav>
 <section id="ar-0" className="ar-answer"><p className="hp-eyebrow">INTERVENTION · SCIENTIFIC EVIDENCE REPORT</p><h1>{model.name}</h1><Chips label="Selected outcome" values={outcomes.map(o => o.name)} value={selected.name} onChange={name => transitionView(() => select(name), {
        focus: false
      })} />
 {!data && !error && <p role="status">Loading source-validated findings…</p>}{error && <p role="alert">Selected source enrichment could not load. Cached records remain available in Audit. <button onClick={() => location.reload()}>Retry</button></p>}
 <h2>{answer ? answer.conclusion || `${selected.name}: ${direction(answer.effect).toLowerCase()} in the selected ${answer.layer === 'synthesis' ? 'review' : 'study'}.` : 'The retained evidence needs endpoint-level appraisal before a magnitude can be stated.'}</h2>
 <div className="ar-answer-grid"><div className="ar-main-estimate"><span className="ar-label">OBSERVED MAGNITUDE · SELECTED SOURCE</span><strong>{magnitude(answer?.effect)}</strong>{answer && <><span>{answer.effect.interval_level ? `${answer.effect.interval_level}% ` : ''}CI {answer.effect.lower}–{answer.effect.upper}</span><button className="ar-source" onClick={() => jump(answer.key)}>PMID {answer.id} · inspect passage ↗</button></>}<p>{precision(answer?.effect)}</p></div><div><span className="ar-label">CERTAINTY · SEPARATE FROM MAGNITUDE</span><p className="ar-grade">{selected.grade ? `${selected.grade} · existing automated rating` : 'Outcome appraisal pending'}</p><p>{selected.grade ? 'This cached topic rating has not been validated for the exact estimate or filtered population. It is not a formal domain-based certainty assessment.' : 'A traceable estimate does not by itself establish certainty.'}</p><span className="ar-label">STUDIED POPULATION</span><p>{answer?.population || 'Population context awaits structured extraction.'}</p></div></div>
 <div className="ar-caveat"><strong>Main limitation</strong><p>{caveat}</p></div>
 <div className="ar-actions"><a href={`/explore/matcher?evidence=${encodeURIComponent(model.name)}&outcome=${encodeURIComponent(selected.name)}`}>Use this evidence in my research ↗</a><a href={`/explore/matcher?evidence=${encodeURIComponent(model.name)}&outcome=${encodeURIComponent(selected.name)}`}>Compare with my study ↗</a></div></section>
 <section id="ar-1"><p className="hp-eyebrow">02 / LANDSCAPE</p><h2>Which outcomes have an interpretable estimate?</h2><p>Exact endpoints are separate from broader topic appraisals. Magnitudes use their original measures; no cross-outcome ranking is implied.</p><div className="ar-landscape">{outcomes.map(o => {
          const r = o.rows.find(r => r.effect);
          return <button key={o.name} aria-pressed={selected.name === o.name} onClick={() => transitionView(() => select(o.name), {
            focus: false
          })}><strong>{o.name}</strong><span>{o.grade ? `${o.grade} · cached topic rating` : 'Certainty appraisal pending'}</span><b>{magnitude(r?.effect)}</b><span>{direction(r?.effect)}</span><small>{o.rows.length} source records · {o.rows.filter(r => r.effect).length} endpoint estimates · {o.rows.filter(r => r.layer === 'synthesis').length} syntheses</small><span className="ar-landscape-context">{r?.population || 'Context extraction pending'}</span></button>;
        })}</div></section>
 <section id="ar-2"><p className="hp-eyebrow">03 / DEEP DIVE · {selected.name}</p><h2>Who and what does this finding apply to?</h2><div className="ar-filter-grid">{['population', 'design', 'baseline'].map(k => <label key={k}>{k}<select value={filters[k] || ''} onChange={e => {
            setFilters({
              ...filters,
              [k]: e.target.value
            });
            setChosen('');
          }}><option value="">All {k} contexts</option>{[...new Set(selected.rows.map(r => r[k] || UNKNOWN))].map(v => <option key={v}>{v}</option>)}</select></label>)}</div><div className="ar-filter-state" role="status">{rows.length} of {selected.rows.length} source records · {Object.values(filters).filter(Boolean).map(v => layerNames[v] || v).join(' · ') || 'All contexts'} <button onClick={() => {
          setFilters({});
          setChosen('');
        }}>Reset filters</button></div>
 <div className="ar-context">{effects.map(r => <button key={r.key} aria-pressed={answer?.key === r.key} onClick={() => setChosen(r.key)}><small>{r.year} · PMID {r.id}</small><strong>{r.population}</strong><span>Baseline · {r.baseline}</span><span>Exposure · {r.dose}</span><span>Follow-up · {r.duration}</span><span>Comparison · {r.comparator || UNKNOWN}</span></button>)}</div>{!effects.length && <div className="ar-empty"><strong>Context is awaiting endpoint appraisal</strong><p>The selected records remain inspectable below. Missing extracted estimates are not zero effects.</p></div>}
 <div className="ar-heading"><h2>Study estimates</h2><span className="ar-tag">NOT POOLED BY CLARITY</span></div><p>{effects.length < 2 ? 'Fewer than two validated endpoint estimates are available in this selection.' : 'Intervention contrasts, populations, follow-up and review overlap have not been established as compatible for pooling.'} Each source panel has its own labeled scale; panel positions cannot be compared across measures.</p><div className="ar-forests">{effects.map(r => <Interval key={r.key} row={r} onSource={jump} />)}</div>
 <h2>What explains certainty?</h2><div className="ar-certainty">{Object.entries(domains).map(([k, v]) => <details key={k}><summary>{k}<span>{k === 'Precision' && answer ? 'Inspect interval' : 'Appraisal context'}</span></summary><p>{v}</p></details>)}</div>
 <h2>How does the evidence reach humans?</h2><div className="ar-translation">{['mechanism', 'preclinical', 'observational', 'interventional', 'synthesis'].map(k => {
          const n = rows.filter(r => r.layer === k).length;
          return <button key={k} onClick={() => {
            setFilters({
              ...filters,
              layer: k
            });
            setChosen('');
            setPreset('Methods');
            document.getElementById('ar-matrix')?.scrollIntoView({
              block: 'start'
            });
          }}><span>{layerNames[k]}</span><strong>{n}</strong><small>{n ? 'Source records' : 'Coverage gap in this selection'}</small></button>;
        })}</div><p>Stages describe composition, not successful translation or evidence weight. Participants are reported per source below; overlapping trials and reviews are never summed. Statistical weights are unavailable because no new pooled model is fitted.</p>
 <h2>What limits this conclusion?</h2><div className="ar-limitations">{Object.entries({
          Population: answer?.contextQuote || 'Baseline and eligibility need extraction.',
          Measurement: `The selected endpoint is ${selected.name}; instruments and timepoints must be aligned before comparison.`,
          Imprecision: precision(answer?.effect),
          Heterogeneity: 'Observed differences between studies are descriptive. This report does not infer causal effect modification.',
          'Risk of bias': domains['Risk of bias'],
          Indirectness: caveat,
          'Data / extraction gaps': `${selected.candidates.length} legacy numerical candidates await endpoint and contrast validation; these are retained in Audit.`
        }).map(([k, v]) => <details key={k}><summary>{k}</summary><p>{v}</p></details>)}</div><aside className="ar-needed"><span className="ar-label">WHAT EVIDENCE IS STILL NEEDED?</span><p>{needed}</p></aside>
 <div id="ar-matrix"><h2>Study characteristics & research matrix</h2><p>Colored cells identify available fields, not study quality. Read population and methods before interpreting differences between estimates.</p><Chips label="Matrix column preset" values={['Characteristics', 'Overview', 'Methods', 'Results', 'Population', 'Audit']} value={preset} onChange={setPreset} /><label className="ar-sort">Order by <select value={order} onChange={e => setOrder(e.target.value)}><option value="date">Date</option><option value="population">Population</option><option value="effect">Effect (within measure and units)</option><option value="directness">Context availability (directness proxy)</option></select></label><div className="ar-table-scroll"><table><caption>{selected.name} · {preset} · {ordered.length} records</caption><thead><tr><th>Study / source</th>{(preset === 'Characteristics' ? ['Effect', 'Population', 'Baseline', 'Dose', 'Duration', 'Design', 'Instrument', 'Timepoint', 'Risk of bias'] : preset === 'Overview' ? ['Effect', 'Population', 'Design'] : preset === 'Methods' ? ['Dose', 'Duration', 'Design', 'Instrument', 'Risk of bias'] : preset === 'Results' ? ['Effect', 'Endpoint', 'Timepoint'] : preset === 'Population' ? ['Population', 'Baseline', 'Dose'] : ['Review', 'Provenance']).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{ordered.map(r => {
                const values = {
                  'Effect': r.effect ? `${magnitude(r.effect)}; CI ${r.effect.lower}–${r.effect.upper}` : UNKNOWN,
                  'Population': r.population,
                  'Design': r.design,
                  'Dose': r.dose,
                  'Duration': r.duration,
                  'Instrument': r.instrument,
                  'Risk of bias': r.rob,
                  'Endpoint': r.endpoint,
                  'Timepoint': r.timepoint,
                  'Baseline': r.baseline,
                  'Review': 'Automated appraisal',
                  'Provenance': r.span ? `Abstract offsets ${r.span.start}–${r.span.end}` : 'Source record; endpoint extraction pending'
                };
                const cols = preset === 'Characteristics' ? ['Effect', 'Population', 'Baseline', 'Dose', 'Duration', 'Design', 'Instrument', 'Timepoint', 'Risk of bias'] : preset === 'Overview' ? ['Effect', 'Population', 'Design'] : preset === 'Methods' ? ['Dose', 'Duration', 'Design', 'Instrument', 'Risk of bias'] : preset === 'Results' ? ['Effect', 'Endpoint', 'Timepoint'] : preset === 'Population' ? ['Population', 'Baseline', 'Dose'] : ['Review', 'Provenance'];
                return <tr id={`source-${r.key}`} key={r.key} tabIndex={-1}><th scope="row"><details open={expanded === r.key} onToggle={e => {
                      if (e.currentTarget.open) setExpanded(r.key);else if (expanded === r.key) setExpanded('');
                    }}><summary>{r.title || `PMID ${r.id}`} <small>{r.year}</small></summary><a href={safeSource(r.url) || `https://pubmed.ncbi.nlm.nih.gov/${r.id}/`} target="_blank" rel="noreferrer">Open source · {r.id} ↗</a>{r.quote && <blockquote>{r.quote}</blockquote>}{r.contextQuote && <p>{r.contextQuote}</p>}<p>N {r.sample_size?.toLocaleString() || 'not extracted'} · Automated appraisal · full-text review pending</p></details></th>{cols.map(c => <td key={c} data-known={Boolean(values[c] && values[c] !== UNKNOWN)}>{values[c] || UNKNOWN}</td>)}</tr>;
              })}</tbody></table></div></div>{children}</section>
 <section id="ar-3"><p className="hp-eyebrow">04 / AUDIT</p><h2>Data coverage & provenance</h2><p>These stages describe retained records, not a reconstructed systematic search. Unknown upstream counts are intentionally left unknown.</p><div className="ar-flow">{Object.entries(stages).map(([k, v]) => <button key={k} aria-pressed={stage === k} onClick={() => setStage(k)}><strong>{v?.length ?? 'Unknown'}</strong><span>{k}</span></button>)}</div><details open><summary>{stage} · inspect records</summary>{stages[stage] === null ? <p>This stage was not logged in the retained profile. Study completion must be verified from reports, not inferred from a non-protocol title.</p> : <ul>{stages[stage].map(r => <li key={r.key}><button onClick={() => jump(r.key)}>{r.title || r.id}</button> · {r.effect ? 'Validated endpoint estimate' : r.layer === 'protocol' ? 'Planned study; no completed result' : 'Endpoint extraction pending'}</li>)}</ul>}</details><details><summary>Legacy extraction candidates & exclusion reasons ({selected.candidates.length + selected.withheld.length})</summary>{selected.candidates.map((e, i) => <div key={i}><a href={safeSource(e.url)} target="_blank" rel="noreferrer">PMID {e.pmid}</a><p>Excluded from the report estimate: endpoint, intervention contrast and interval semantics require verification.</p><blockquote>{e.quote}</blockquote></div>)}{selected.withheld.map((e, i) => <p key={i}>PMID {e.pmid} · {e.reason}</p>)}</details><details><summary>Existing topic grade rationale (unchanged)</summary><p>This is legacy automated rationale, not a completed domain-level risk-of-bias or certainty assessment. Review counts do not establish independence or convergence.</p><ul>{selected.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></details><LivingResearch targetId={model.targetId} indexedCount={model.studies.length} lastExtracted={data?.[1]?.profiles?.[slug]?.last_enriched_at} /><p>Research and education only. No personal treatment recommendation. Exact source findings are automated appraisals awaiting human review.</p></section>
 </article>;
}
