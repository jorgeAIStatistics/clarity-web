import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import VisualProfile from './VisualProfile.jsx';
import useVisualReport from './useVisualReport.js';
import { prepareReport } from './visualModel.js';
import { API_BASE } from '../platform/api.js';
import { safeSource } from '../platform/profileModel.js';
import { entityReading, compoundReading, KIND_LABELS, BANDS, READING_VERSION } from './meaningModel.js';
import { describeEffect } from '../evidence/measures.js';
import './meaning.css';

const LAYER_NAMES = { mechanism: 'Mechanism', preclinical: 'Animal / lab', observational: 'Observational', interventional: 'Human trial', synthesis: 'Published synthesis', guidelines: 'Guidance', protocol: 'Protocol', unclassified: 'Unclassified' };
const BAND_STEPS = { none: 0, thin: 1, some: 2, dense: 3 };
const TYPE_LABELS = { intervention: 'Compound', biomarker: 'Biomarker', diagnostic: 'Diagnostic test', screening: 'Screening', precision_oncology: 'Precision medicine' };
const shortDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null;

function useMonitoring(targetId) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!targetId) return undefined;
    let active = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    fetch(`${API_BASE}/api/living-research/${encodeURIComponent(targetId)}`, { signal: controller.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Unavailable'))))
      .then(data => { if (active) setState({ ...data, id: targetId }); })
      .catch(() => { if (active) setState({ id: targetId, monitoring_status: 'unavailable' }); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [targetId]);
  return state?.id === targetId ? state : null;
}

function monitorLabel(m) {
  if (!m) return 'Checking literature monitoring…';
  if (m.monitoring_status === 'checked') return `Literature checked ${shortDate(m.last_checked) || ''}`.trim();
  if (m.monitoring_status === 'partial_failure') return 'Last literature check was incomplete';
  if (['not_scheduled', 'queued', 'not_started'].includes(m.monitoring_status)) return 'Literature monitoring not yet run';
  return 'Monitoring status unavailable';
}

function Kind({ kind }) {
  return <span className="mp-kind" data-kind={kind}>{KIND_LABELS[kind] || kind}</span>;
}

function Estimates({ estimates }) {
  if (!estimates?.length) return null;
  return <ul className="mp-estimates">{estimates.map(e => {
    const d = describeEffect(e);
    return <li key={e.id}>
      <span className="mp-number">{d.number}{d.pointOnly ? ' · interval not reported' : ''}</span>
      <span className="mp-est-meta">{[e.design, e.year, Number.isFinite(e.n) ? `n=${e.n.toLocaleString('en-US')}` : 'n not extracted', e.cohort && e.cohort.replaceAll('-', ' '), e.source].filter(Boolean).join(' · ')}</span>
      {(e.population || e.exposure || e.comparator) && <span className="mp-est-context">{[e.population && `Population: ${e.population}`, e.exposure && `Exposure: ${e.exposure}`, e.comparator && `Comparator: ${e.comparator}`].filter(Boolean).join(' · ')}</span>}
      <details><summary>Source passage{e.pmid ? ` · PMID ${e.pmid}` : ''}</summary><blockquote>{e.quote}</blockquote>{safeSource(e.url) && <a href={safeSource(e.url)} target="_blank" rel="noreferrer">Open the publication record <ArrowUpRight size={13} aria-hidden="true" /></a>}</details>
    </li>;
  })}</ul>;
}

function LayerStrip({ layers, syntheses }) {
  return <>
    <ol className="mp-layers">{layers.map(l => <li key={l.key} className="mp-layer" data-layer={l.key} data-band={l.band}>
      <h3>{l.label}</h3>
      <p className="mp-asks">{l.asks}</p>
      <div className="mp-bars" aria-hidden="true">{[1, 2, 3].map(step => <i key={step} className={BAND_STEPS[l.band] >= step ? 'on' : ''} />)}</div>
      <p className="mp-count"><strong>{l.count}</strong> <span>{l.count === 1 ? 'record' : 'records'} · {BANDS[l.band]}</span></p>
      {l.empty ? <p className="mp-empty">{l.empty}</p> : <>
        {l.direction && <p title="Where each reported interval sits relative to its no-difference value (1 for ratios, 0 for differences). Not a benefit judgment.">{l.direction.label}</p>}
        {l.note && <p>{l.note}</p>}
        <p className="mp-review" data-review={l.review?.key}>{l.review?.label}</p>
      </>}
    </li>)}</ol>
    <p className="mp-footnote">Bands count records in this profile (thin 1–2, some 3–9, dense 10+); they show coverage, not strength.{syntheses ? ` ${syntheses} published ${syntheses === 1 ? 'synthesis is' : 'syntheses are'} counted separately because they re-analyse primary studies.` : ''}</p>
  </>;
}

function EntityOutcome({ outcome }) {
  return <article className="mp-outcome">
    <h3>{outcome.name}</h3>
    {outcome.lines.map(line => <div className="mp-line" key={`${line.mode}|${line.fam.key}`}>
      <div className="mp-line-head"><Kind kind={line.kind} /><span className="mp-mode">{line.mode} · {line.fam.label}</span></div>
      <p className="mp-meaning">{line.text}</p>
      <Estimates estimates={line.estimates} />
    </div>)}
  </article>;
}

function CompoundOutcome({ outcome, onStudies }) {
  const n = outcome.numbers, ctx = outcome.context;
  const figures = [['Linked studies', n.studies], ['Human trials', n.trials], ['Observational', n.observational], ['Animal / lab', n.lab], ['Published reviews', n.syntheses], ['Verified estimates', n.verified]];
  return <article className="mp-outcome">
    <div className="mp-line-head"><h3>{outcome.name}</h3><Kind kind={outcome.kind} /></div>
    <p className="mp-meaning">{outcome.text}</p>
    <dl className="mp-figures">{figures.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}
      <div><dt>Automated grade</dt><dd>{outcome.grade || '—'}{outcome.gradeStatus === 'refresh_required' ? ' · refresh needed' : ''}</dd></div>
      {Number.isFinite(n.missingSampleSize) && n.studies ? <div><dt>Sample size missing</dt><dd>{n.missingSampleSize} of {n.studies}</dd></div> : null}
    </dl>
    <p className="mp-footnote">The automated grade summarizes study volume, design and conclusions; it is not a certainty rating or an effect size. Participants are not summed because reviews overlap.</p>
    <dl className="mp-context">
      <div><dt>Population mentioned</dt><dd>{ctx.population.join('; ') || 'Not extracted in structured form'}</dd></div>
      <div><dt>Dose mentioned</dt><dd>{ctx.dose.join('; ') || 'Not extracted'}</dd></div>
      <div><dt>Duration mentioned</dt><dd>{ctx.duration.join('; ') || 'Not extracted'}</dd></div>
      <div><dt>Comparator</dt><dd>{ctx.comparator || 'Not extracted'}</dd></div>
    </dl>
    <Estimates estimates={outcome.estimates} />
    {outcome.headline && <details className="mp-disclosure"><summary>Passage used by the automated conclusion check · PMID {outcome.headline.pmid}</summary><blockquote>{outcome.headline.quote}</blockquote></details>}
    {outcome.drafted && <details className="mp-disclosure"><summary>Model-drafted plain summary · {outcome.drafted.model} · not verified</summary><p>{outcome.drafted.text}</p>{outcome.drafted.grade && <p>{outcome.drafted.grade}</p>}<p className="mp-footnote">Written by a language model from the stored records. Counts and claims in it have not been checked against sources; rely on the reading and estimates above.</p></details>}
    <div className="mp-actions"><button type="button" onClick={onStudies}>See the {outcome.studies.length} studies behind this outcome</button></div>
  </article>;
}

function StudyRow({ s }) {
  const href = safeSource(s.url) || (s.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/` : undefined);
  return <article className="mp-study" data-layer={s.layer}>
    <header><span className="mp-layer-tag" data-layer={s.layer}>{LAYER_NAMES[s.layer] || 'Record'}</span><span>{s.design}{s.year ? ` · ${s.year}` : ''}</span>{href && <a href={href} target="_blank" rel="noreferrer">{s.pmid ? `PMID ${s.pmid}` : 'Source'} <ArrowUpRight size={12} aria-hidden="true" /></a>}</header>
    <h3>{s.title || 'Untitled record'}</h3>
    <div className="mp-study-grid">
      <div><h4>What was tested</h4><p>{s.tested.who}{Number.isFinite(s.tested.n) ? ` · n=${s.tested.n.toLocaleString('en-US')}` : ''}</p>{s.tested.exposure && <p>{s.tested.exposure}{s.tested.comparator ? ` versus ${s.tested.comparator}` : ''}</p>}{s.tested.duration && <p>Duration mentioned: {s.tested.duration}</p>}</div>
      <div><h4>What happened</h4>{s.happened.length ? s.happened.map((h, i) => <p key={i}>{h.text}{h.number && <span className="mp-number">{h.number}</span>}</p>)
        : s.conclusion ? <><p className="mp-footnote">{s.conclusion.basis}</p><blockquote>{s.conclusion.text}</blockquote></>
        : <p className="mp-muted">No result extracted. Read the abstract.</p>}</div>
      <div><h4>Why it matters</h4><ul>{s.limits.map(l => <li key={l}>{l}</li>)}</ul></div>
    </div>
    {s.happened.length > 0 && s.excerpt && <details className="mp-disclosure"><summary>Source passage</summary><blockquote>{s.excerpt}</blockquote></details>}
  </article>;
}

function StudyList({ rows }) {
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [rows]);
  if (!rows.length) return <p className="mp-muted">No study records are linked yet.</p>;
  const shown = all ? rows : rows.slice(0, 6);
  return <><div className="mp-studies">{shown.map(s => <StudyRow key={`${s.id}-${s.layer}`} s={s} />)}</div>
    {rows.length > shown.length && <button type="button" className="mp-more" onClick={() => setAll(true)}>Show all {rows.length} studies</button>}</>;
}

export default function MeaningProfile({ kind, view, entity, model, chemistry, showHeader = true }) {
  const visual = useVisualReport(model.targetId);
  const report = useMemo(() => prepareReport(visual.report, model), [visual.report, model]);
  const monitoring = useMonitoring(model.targetId);
  const reading = useMemo(() => (kind === 'compound' ? compoundReading(view, report, { monitoring }) : entityReading(entity, report, { monitoring })), [kind, view, entity, report, monitoring]);
  const [studyOutcome, setStudyOutcome] = useState(null);
  const focus = kind === 'compound' ? reading.outcomes.find(o => o.name === studyOutcome) || reading.outcomes[0] : null;
  const rows = kind === 'compound' ? focus?.studies || [] : reading.studies;
  function showStudies(name) {
    setStudyOutcome(name);
    requestAnimationFrame(() => document.getElementById('mp-studies')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  const nav = [['mp-snapshot', 'In plain terms'], ['mp-layers', 'Evidence layers'], ['mp-outcomes', 'Outcomes'], ['mp-studies', 'Studies'], ['mp-tensions', 'Tensions & gaps'], ['mp-estimates', 'Estimates & sources']];
  const matcher = `/explore/matcher?evidence=${encodeURIComponent(model.name)}${reading.outcomes[0]?.name ? `&outcome=${encodeURIComponent(reading.outcomes[0].name)}` : ''}`;
  return <article className="mp">
    <header className="mp-head">
      <p className="mp-eyebrow">{TYPE_LABELS[reading.type] || model.type} · living evidence profile</p>
      {showHeader && <h1>{model.name}</h1>}
      <p className="mp-question">{reading.question}</p>
      <div className="mp-status">
        <span className="mp-chip" data-review={reading.review.key}>{reading.review.key === 'automated' ? 'Automated reading · not expert-reviewed' : reading.review.label}</span>
        <span className="mp-chip" data-monitor={monitoring?.monitoring_status || 'loading'}>{monitorLabel(monitoring)}</span>
        {monitoring?.updates_pending_review > 0 && <span className="mp-chip plain">{monitoring.updates_pending_review.toLocaleString('en-US')} new records awaiting review</span>}
        <a className="mp-chip plain mp-chip-link" href={matcher}>Map a research question on this profile <ArrowUpRight size={13} aria-hidden="true" /></a>
      </div>
    </header>
    <nav className="mp-nav" aria-label="Profile sections">{nav.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>

    <section id="mp-snapshot" className="mp-section mp-snapshot" aria-labelledby="mp-snapshot-title">
      <div className="mp-section-head"><h2 id="mp-snapshot-title">In plain terms</h2><span>Automated reading · {READING_VERSION}</span></div>
      <ul className="mp-sentences">{reading.snapshot.map((s, i) => <li key={i}><Kind kind={s.kind} /><p>{s.text}</p></li>)}</ul>
      <details className="mp-disclosure"><summary>How this reading is made</summary><p>Fixed rules assemble each sentence from stored study records: layer counts, quote-backed estimates that passed source checks, the automated conclusion check and review status. No language model writes these sentences and nothing is pooled. When the stored fields cannot support a statement, the reading says so.</p><p>“Points to benefit” reflects an automated reading of study conclusions, not a certainty rating. Record counts show coverage, not strength.</p><a href="/methodology">Full methodology</a></details>
    </section>

    <section id="mp-layers" className="mp-section" aria-labelledby="mp-layers-title">
      <div className="mp-section-head"><h2 id="mp-layers-title">Five evidence layers</h2><span>Different questions, not a ladder of grades</span></div>
      <LayerStrip layers={reading.layers} syntheses={reading.syntheses} />
    </section>

    <section id="mp-outcomes" className="mp-section" aria-labelledby="mp-outcomes-title">
      <div className="mp-section-head"><h2 id="mp-outcomes-title">What each outcome shows</h2><span>Meaning first · numbers and sources beneath</span></div>
      <div className="mp-outcomes">
        {kind === 'compound' ? reading.outcomes.map(o => <CompoundOutcome key={o.name} outcome={o} onStudies={() => showStudies(o.name)} />) : reading.outcomes.map(o => <EntityOutcome key={o.name} outcome={o} />)}
        {kind === 'compound' && reading.endpoints.length > 0 && <><h3 className="mp-subhead">Source-validated trial endpoints</h3>{reading.endpoints.map(o => <EntityOutcome key={o.name} outcome={o} />)}</>}
        {!reading.outcomes.length && <p className="mp-unassessed">No outcome has quote-backed human data yet, so no finding is stated here.</p>}
        {reading.unassessed.length > 0 && reading.outcomes.length > 0 && <p className="mp-unassessed">Not yet assessed: {reading.unassessed.join(', ')}. No extracted or reviewed human outcome data for these yet.</p>}
      </div>
    </section>

    <section id="mp-studies" className="mp-section" aria-labelledby="mp-studies-title">
      <div className="mp-section-head"><h2 id="mp-studies-title">Studies, read one at a time</h2><span>What was tested · what happened · why it matters</span></div>
      {kind === 'compound' && reading.outcomes.length > 1 && <div className="mp-filter" role="group" aria-label="Outcome">{reading.outcomes.map(o => <button key={o.name} type="button" aria-pressed={focus?.name === o.name} onClick={() => setStudyOutcome(o.name)}>{o.name} <small>{o.studies.length}</small></button>)}</div>}
      <StudyList rows={rows} />
    </section>

    <section id="mp-tensions" className="mp-section" aria-labelledby="mp-tensions-title">
      <div className="mp-section-head"><h2 id="mp-tensions-title">Tensions and gaps</h2><span>Where layers disagree, stop short or stay silent</span></div>
      {reading.tensions.length ? <ul className="mp-tensions">{reading.tensions.map((t, i) => <li key={i}><span className="mp-layer-tag" data-layer={t.layer}>{LAYER_NAMES[t.layer] || 'Profile'}</span><p>{t.text}</p></li>)}</ul> : <p className="mp-muted">No tension was detected automatically. That is not evidence of agreement or complete coverage.</p>}
    </section>

    <section id="mp-estimates" className="mp-estimates-section" aria-label="Estimates and sources">
      <VisualProfile model={model} chemistry={chemistry} showHeader={false} embedded state={visual} />
      {reading.estimates === 0 && <p className="mp-footnote">No estimate in this profile has passed source validation yet; the source library above lists every linked publication.</p>}
    </section>
  </article>;
}
