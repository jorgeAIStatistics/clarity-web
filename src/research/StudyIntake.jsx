import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../platform/api.js';
import { FIELDS } from './model.js';
import { meaningfulFields, studyLabels, unresolved } from './intakeModel.js';
import { safeSource } from '../platform/profileModel.js';
export default function StudyIntake({
  project: p,
  onText,
  onDraft,
  onField,
  onConfirm
}) {
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(''),
    [editing, setEditing] = useState(false),
    [identifier, setIdentifier] = useState(''),
    [useId, setUseId] = useState(false);
  const active = useRef(null),
    fieldRef = useRef(null),
    cardRef = useRef(null);
  useEffect(() => () => {active.current?.abort();active.current=null;}, []);
  useEffect(() => {
    active.current?.abort();
    active.current=null;
    setBusy(false);
    setFailure('');
  }, [p.text]);
  const labels = {
      ...FIELDS,
      population: 'Population',
      ...studyLabels(p.definition)
    },
    missing = unresolved(p.definition),
    recognized = meaningfulFields(p.definition),
    hasDraft = Boolean(p.draft && recognized >= 2 || editing || p.confirmed);
  function editField(key,value) {active.current?.abort();active.current=null;setBusy(false);setFailure('');onField(key,value);}
  async function analyze() {
    active.current?.abort();
    const c = new AbortController();
    active.current = c;
    setBusy(true);
    setFailure('');
    const reference = identifier.trim();
    const explicitReference = /\b10\.\d{4,9}\/|\bPMID\b|pubmed\.ncbi|^\d{6,9}$|^Title:/i.test(reference) ? reference : `Title: ${reference}`;
    const text = useId && reference ? `${explicitReference}\n\n${p.text}` : p.text;
    const timeout = setTimeout(() => c.abort(), 40000);
    try {
      const r = await fetch(`${API_BASE}/api/research/definition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text
        }),
        signal: c.signal
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || 'Study drafting is unavailable.');
      if (active.current !== c || c.signal.aborted) return;
      onDraft(result);
      setEditing(false);
      if (result.status === 'needs_input' || meaningfulFields(result.definition) < 2) setFailure("We couldn't reliably structure this study.");else requestAnimationFrame(() => cardRef.current?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest'
      }));
    } catch (e) {
      if (active.current === c) setFailure(e.name === 'AbortError' ? 'Analysis timed out. Retry or edit the study manually.' : e.message);
    } finally {
      clearTimeout(timeout);
      if (active.current === c) setBusy(false);
    }
  }
  const keys = ['population', 'exposure', 'comparator', 'outcome', 'design', 'timepoint', 'method'];
  return <><section className="rw-panel rw-intake"><label htmlFor="study-description">Paste a research question, abstract, protocol, PMID or DOI</label><textarea id="study-description" ref={fieldRef} maxLength={9000} rows={5} value={p.text} placeholder="Paste your study here. You can also start with PMID: 41976322 or a DOI." onChange={e => {
        onText(e.target.value);
        setEditing(false);
      }} /><p className="rw-input-note">Research support only. Use aggregate research, without patient identifiers. Recognized references resolve through PubMed / Europe PMC. For a title lookup, start with “Title:”.</p>{useId && <label>PMID, DOI or exact article title<input value={identifier} onChange={e => setIdentifier(e.target.value)} maxLength={300} /></label>}<button className="rw-primary" disabled={busy || !p.text.trim() && !identifier.trim()} onClick={analyze}>{busy ? 'Recognizing and structuring your study…' : 'Analyze my study'}</button>{busy && <p role="status">Looking up source metadata and available methods. Nothing is confirmed automatically.</p>}
 {failure && <div className="rw-intake-failure" role="alert"><h3>{failure}</h3><p>You can add a PMID or DOI, retry, or provide the key study details yourself.</p><div className="rw-actions"><button disabled={busy} onClick={analyze}>Retry</button><button onClick={() => setUseId(true)}>Use PMID / DOI</button><button onClick={() => setEditing(true)}>Edit manually</button></div></div>}
 {!hasDraft && !failure && <button className="rw-text-button" onClick={() => setEditing(true)}>Define manually</button>}</section>
 {hasDraft && <section className="rw-panel rw-understood" ref={cardRef} aria-label="Parsed study summary"><p className="hp-eyebrow">DRAFT · YOUR REVIEW REQUIRED</p><h3>{recognized >= 2 ? 'Clarity understood your study as:' : 'Describe the key study details'}</h3>{p.draft?.paper && <div className="rw-paper"><span className="pb-chip">Paper recognized</span><h4><a href={safeSource(p.draft.paper.url)} target="_blank" rel="noreferrer">{p.draft.paper.title} ↗</a></h4><p>{p.draft.paper.authors}</p>{p.draft.paper.pmcid && <a href={`https://pmc.ncbi.nlm.nih.gov/articles/${p.draft.paper.pmcid}/`} target="_blank" rel="noreferrer">Open full-text source ↗</a>}<p>{p.draft.paper.journal} · {p.draft.paper.year} · PMID {p.draft.paper.pmid || 'not available'} · DOI {p.draft.paper.doi || 'not available'}</p><p>{p.draft.paper.full_text_available ? 'Full text available' : 'Abstract only'} · {p.draft.paper.full_text_used ? 'Abstract + full-text methods used' : 'Abstract metadata used'} · {p.draft.paper.metadata_provider} · retrieved {p.draft.paper.retrieved_at}</p></div>}
 {p.draft?.warnings?.map((w, i) => <p className="rw-notice" key={i}>{w}</p>)}
 {recognized > 0 && <><p className="rw-question"><strong>Research question</strong><br />{p.definition.exposure || 'Which exposure'} → {p.definition.outcome || 'which outcome'}{p.definition.population ? ` in ${p.definition.population}` : ''}?</p><dl className="rw-summary-grid">{keys.filter(k => p.definition[k]).map(k => <div key={k}><dt>{labels[k]}</dt><dd>{p.definition[k]}<small>{p.draft?.definition?.[k] !== p.definition[k] ? 'Researcher provided / edited' : p.draft?.provenance?.[k]?.origin?.replaceAll('_', ' ') || 'Researcher provided'}</small></dd></div>)}</dl>{!p.definition.comparator && <p className="rw-input-note">{labels.comparator}: not yet specified. Review this before comparing numerical estimates.</p>}<p className="rw-input-note">The primary outcome and reference group need your approval. A proposed endpoint is not a claim that the authors designated it as primary.</p></>}
 {missing.length > 0 && !editing && <div className="rw-clarify"><h4>Clarity needs {missing.length === 1 ? 'one detail' : `${missing.length} details`} before matching:</h4>{missing.map(k => <label key={k}>{k === 'outcome' ? 'Which outcome should be treated as primary?' : `What is the ${labels[k].toLowerCase()}?`}<input value={p.definition[k] || ''} onChange={e => editField(k, e.target.value)} maxLength={900} /></label>)}</div>}
 {editing && <div className="rw-fields">{keys.map(k => <label key={k}>{labels[k]}{['exposure', 'outcome'].includes(k) ? ' (required)' : ''}<input value={p.definition[k] || ''} onChange={e => editField(k, e.target.value)} maxLength={900} /></label>)}</div>}
 <details><summary>Measurement details & source passages</summary><dl className="rw-summary-grid">{Object.keys(FIELDS).filter(k => !keys.includes(k) && p.definition[k]).map(k => <div key={k}><dt>{labels[k]}</dt><dd>{p.definition[k]}</dd></div>)}</dl>{Object.entries(p.draft?.provenance || {}).map(([k, v]) => <details key={k}><summary>{labels[k] || k} · {v.origin.replaceAll('_', ' ')}</summary><blockquote>{v.quote}</blockquote><p>{v.source_id || 'Your pasted text'} · {v.kind}</p>{p.draft?.conflicts?.[k] && <p>Source value: {p.draft.conflicts[k].source_value}. Your explicit field takes precedence and requires review.</p>}{p.draft?.definition?.[k] !== p.definition[k] && <p>Researcher edit: {p.definition[k] || 'cleared'}. The passage above supports the original draft, not this edit.</p>}</details>)}</details>
 {editing && <details><summary>Advanced study details</summary><div className="rw-fields">{Object.entries(FIELDS).filter(([k]) => !keys.includes(k)).map(([k, label]) => <label key={k}>{labels[k] || label}<input value={p.definition[k] || ''} onChange={e => editField(k, e.target.value)} maxLength={900} /></label>)}</div></details>}
 <div className="rw-actions"><button className="rw-primary" disabled={busy || missing.length > 0} onClick={onConfirm}>Looks right — continue</button><button onClick={() => setEditing(v => !v)}>{editing ? 'Finish editing' : 'Edit'}</button></div></section>}
 </>;
}
