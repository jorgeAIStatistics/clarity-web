import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {API_BASE} from '../platform/api.js';
import {layerLabel,flatten,valueText,aucStrip,classificationRows,relationLabel,deadLetterText,diagnose,freshness,graphCandidates,graphMatches,graphPath,libraryIsShort,findingsCsv,findingsJson,graphPrefixes,identity,biology,measurement,meaning,utility,ladder,scopeNote,questions,fetchWithRetry,externalLinks,idCaption,ucscLink,kindBadge,LAYERS} from './graphProfile.js';
import FindingsWorkspace from '../research/FindingsWorkspace.jsx';
import './graph-profile.css';

function Link({to,go,children,...props}){return <a href={to} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&e.button===0){e.preventDefault();go(to);}}} {...props}>{children}</a>;}
const clip=(text,n)=>text.length>n?text.slice(0,n-1)+'…':text;

function AucStrip({strip}){
  const W=640,L=220,R=620,ROW=28,TOP=16,H=TOP+strip.points.length*ROW+36;
  const [lo,hi]=strip.domain;const x=v=>L+(v-lo)/(hi-lo)*(R-L);
  const ticks=lo===0?[0,0.25,0.5,0.75,1]:[0.5,0.6,0.7,0.8,0.9,1];
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${strip.points.length} reported AUC or C-index ${strip.points.length===1?'value':'values'}, each from one study, on a scale from ${lo} to 1.`}>
    {ticks.map(t=><g key={t}>
      <line x1={x(t)} x2={x(t)} y1={TOP-8} y2={H-30} stroke="currentColor" strokeOpacity={t===0.5?0.7:0.16} strokeDasharray={t===0.5?'4 3':undefined}/>
      <text x={x(t)} y={H-12} textAnchor="middle" fontSize="11" fill="currentColor">{t===0.5?'0.5 chance':t}</text>
    </g>)}
    {strip.points.map((p,i)=>{const y=TOP+i*ROW+ROW/2;const name=p.measure==='auc'?'AUC':'C-index';return <g key={p.id}>
      <text x={L-14} y={y+4} textAnchor="end" fontSize="11.5" fill="currentColor">{clip(p.label,34)}</text>
      {p.lower!=null&&p.upper!=null&&<line x1={x(p.lower)} x2={x(p.upper)} y1={y} y2={y} stroke="#34e0be" strokeWidth="2" strokeLinecap="round"/>}
      <circle cx={x(p.estimate)} cy={y} r="5" fill="#34e0be" stroke="#0a0d14" strokeWidth="2"><title>{`${name} ${p.estimate}${p.lower!=null&&p.upper!=null?` (${p.lower} to ${p.upper})`:''} · ${p.label}`}</title></circle>
    </g>;})}
  </svg>;
}

// Grounded classification table and AUC strip, shared by graph profiles and the matcher drawer.
export function AccuracyFigures({table,strip}){
  return <>
      {table.rows.length>0&&<figure className="gp-figure">
        <div className="ev-table-wrap"><table><thead><tr><th scope="col">Target</th><th scope="col">Cut-off</th><th scope="col">Assay</th>{table.columns.map(([m,label])=><th scope="col" key={m}>{label}</th>)}<th scope="col">Source</th></tr></thead>
          <tbody>{table.rows.map(r=><tr key={r.key}><td>{r.target||'Not stated'}</td><td>{r.cutoff||'Not stated'}</td><td>{r.assay||'Not stated'}</td>{table.columns.map(([m])=><td key={m} className="gp-num">{r.values[m]??'—'}</td>)}<td>{r.pmid?<a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer">PMID {r.pmid}</a>:'—'}</td></tr>)}</tbody></table></div>
        <figcaption>Classification accuracy as each abstract reports it, at the authors' own cut-off and assay. Values are not pooled or recalculated. Spectrum, verification bias and the reference standard are not assessed here, so rows from different studies are not directly comparable.</figcaption>
      </figure>}
      {strip.points.length>0&&<figure className="gp-figure">
        <AucStrip strip={strip}/>
        <figcaption>Reported AUC or C-index, with the interval when the abstract gives one. Each dot is one study's own estimate; populations, assays and reference standards differ, and nothing is pooled. The dashed line marks 0.5, no better than chance. Discrimination is not calibration or clinical utility.</figcaption>
      </figure>}
  </>;
}

const EMPTY_TABLE={rows:[],columns:[]},EMPTY_STRIP={points:[],domain:[0.5,1]};
function FindingList({rows}){
  return <ul className="gp-findings">{rows.map(f=><li key={f.id}>
    <div className="gp-finding-head"><strong>{valueText(f)}</strong><span>{[f.target&&`for ${f.target}`,f.population,f.setting].filter(Boolean).join(' · ')}</span></div>
    {f.quote&&<blockquote>{f.quote}</blockquote>}
    <small>{f.pmid&&<a href={`https://pubmed.ncbi.nlm.nih.gov/${f.pmid}/`} target="_blank" rel="noreferrer">PMID {f.pmid}</a>}{f.year?` · ${f.year}`:''}{f.layer?` · ${layerLabel(f.layer)} layer`:''} · {f.review_state==='reviewed'?'Reviewed':f.review_state==='partially_reviewed'?'Partially reviewed':'Automated reading, not expert-reviewed'}</small>
  </li>)}</ul>;
}

const INDEX={biomarker:['/biomarkers','All biomarkers','BIOMARKERS'],diagnostic:['/diagnostics','All diagnostics','DIAGNOSTICS'],screening:['/screening','All screening','SCREENING'],precision_oncology:['/precision-medicine','All precision medicine','PRECISION MEDICINE']};
function Hero({name,go,type='biomarker',children}){
  const heading=useRef(null);
  const [path,back,eyebrow]=INDEX[type]||INDEX.biomarker;
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[name]);
  return <div className="ev-hero"><Link className="ev-back" to={path} go={go}><ArrowLeft size={15}/>{back}</Link><div className="ev-eyebrow">{eyebrow} / GRAPH PROFILE · AUTOMATED</div><h1 ref={heading} tabIndex={-1}>{name}</h1>{children}</div>;
}

export function useGraphEntity(slug,type='biomarker',attempt=0){
  const [state,setState]=useState({status:'loading'});
  useEffect(()=>{
    if(!slug){setState({status:'missing'});return undefined;}
    let active=true,inFlight=null,waiting=null;
    setState({status:'loading'});
    // Variants and genes share the biomarker address space; a biomarker id wins when both exist.
    const once=async()=>{
      // Each attempt gets its own controller: a timed-out signal cannot be reused by the next try.
      const controller=new AbortController();inFlight=controller;
      const timer=setTimeout(()=>controller.abort(),15000);
      try{
        for(const candidate of graphCandidates(type,slug)){
          const response=await fetch(`${API_BASE}/api/evidence/graph/entity/${encodeURIComponent(candidate)}`,{signal:controller.signal});
          if(response.status===404)continue;
          if(!response.ok)throw Object.assign(Error('request_failed'),{outcome:response.status});
          return response.json();
        }
        return null;
      }finally{clearTimeout(timer);}
    };
    fetchWithRetry(once,{
      sleep:ms=>new Promise(resolve=>{waiting=setTimeout(resolve,ms);}),
      onRetry:tries=>{if(active)setState({status:'retrying',attempt:tries});},
    }).then(data=>{if(active)setState(data?{status:'ready',data}:{status:'missing'});})
      .catch(()=>{if(active)setState({status:'error'});});
    return()=>{active=false;clearTimeout(waiting);inFlight?.abort();};
  },[slug,type,attempt]);
  return state;
}

// A curated profile owns its URL. When the graph also holds typed findings for that entity, they
// belong on the same page — under the curated reading, never merged into it.
export function GraphFindings({slug,type='biomarker'}){
  const state=useGraphEntity(slug,type);
  if(state.status!=='ready')return null;
  const {entity,findings}=state.data;
  const rows=flatten(findings);
  if(!rows.length)return null;
  const q4=meaning(entity,findings),q5=utility(entity,findings),scope=scopeNote(entity,findings),rungs=ladder(entity,findings);
  const strip=aucStrip(findings),table=classificationRows(findings);
  const inLibrary=rungs.filter(r=>r.indexed).map(r=>r.label),missing=rungs.filter(r=>!r.indexed).map(r=>r.label);
  return <section className="ev-panel gp-inline" aria-labelledby="gp-inline-title">
    <h2 id="gp-inline-title">Also in the evidence graph</h2>
    <p className="ev-note">{rows.length} source-bound {rows.length===1?'finding':'findings'} extracted automatically for {entity.name}, kept separate from the curated reading above. Not expert-reviewed.</p>
    {scope&&<p className="gp-scope">{scope}</p>}
    {q4.map(g=><div className="gp-kind" key={g.kind}>
      <h3>{g.label}<span>{g.rows.length}</span></h3>
      {g.sentences.map(sentence=><p className="gp-meaning" key={sentence}>{sentence}</p>)}
      {g.kind==='classification'&&<AccuracyFigures table={table} strip={EMPTY_STRIP}/>}
      {g.kind==='discrimination'&&<AccuracyFigures table={EMPTY_TABLE} strip={strip}/>}
      <FindingList rows={g.rows}/>
    </div>)}
    <p className="gp-lead" data-gap={q5.state==='empty'||undefined}>{q5.text}</p>
    <p className="gp-inline-ladder"><span>In this library: {inLibrary.length?inLibrary.join(', '):'nothing yet'}</span><span>Not in this library yet: {missing.length?missing.join(', '):'nothing missing'}</span></p>
  </section>;
}

// After the retries are spent, say which layer is down instead of guessing at a wait.
function Diagnosis(){
  const [said,setSaid]=useState('Checking whether the engine or the evidence graph is down…');
  useEffect(()=>{
    let active=true;
    diagnose(url=>fetch(url),API_BASE).then(r=>{if(active)setSaid(r.text);}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  return <p role="status">{said}</p>;
}

export default function GraphProfile({slug,go,type='biomarker'}){
  const [attempt,setAttempt]=useState(0);
  const state=useGraphEntity(slug,type,attempt);

  if(state.status==='loading'||state.status==='retrying')return <div className="gp" aria-busy="true"><div className="ev-hero"><div className="ev-eyebrow">BIOMARKERS / GRAPH PROFILE · AUTOMATED</div><div className="gp-skeleton gp-skeleton-title"/><div className="gp-skeleton"/></div><ul className="gp-layers" aria-hidden="true">{LAYERS.map(l=><li key={l} className="gp-layer gp-layer-skeleton"/>)}</ul><p className="ev-note" role="status">{state.status==='retrying'?'The evidence engine is waking up. Retrying…':'Loading the graph profile…'}</p></div>;
  if(state.status==='missing')return <div className="gp"><Hero name="Page not found" go={go} type={type}/><section className="ev-panel"><h2>This evidence page does not exist</h2><p>No biomarker in the Clarity graph uses this address.</p><Link to="/biomarkers" go={go}>Return to biomarkers</Link></section></div>;
  if(state.status==='error')return <div className="gp"><Hero name="Profile unavailable" go={go} type={type}/><section className="ev-panel"><h2>The graph profile could not be loaded</h2><Diagnosis/><button onClick={()=>setAttempt(n=>n+1)}>Try again</button></section></div>;

  const {entity,layers,findings,related,studies,dead_letters:dead}=state.data;
  const stale=freshness(state.data);
  const total=flatten(findings).length,strip=aucStrip(findings),table=classificationRows(findings);
  const q1=identity(entity,related),q2=biology(entity,findings),q3=measurement(entity,findings),q4=meaning(entity,findings),q5=utility(entity,findings);
  const rungs=ladder(entity,findings),scope=scopeNote(entity,findings),ask=questions(type),links=externalLinks(entity),ucsc=ucscLink(entity);
  const download=(text,mime,extension)=>{
    const url=URL.createObjectURL(new Blob([text],{type:mime}));
    const link=Object.assign(document.createElement('a'),{href:url,download:`${entity.id.replace(':','-')}-findings.${extension}`});
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div className="gp">
    <Hero name={entity.name} go={go} type={type}>
      {stale&&<p className="gp-stale" role="status">{stale}</p>}
      <p className="ev-intro">{q1.text}{q1.specimen?` Measured in ${q1.specimen.toLowerCase()}.`:''} This page answers five questions in order, from what the object is to whether measuring it helps, using only findings indexed in the graph.</p>
      <dl className="gp-identity">
        {q1.aliases.length>0&&<div><dt>Also written as</dt><dd>{q1.aliases.join(' · ')}</dd></div>}
        <div><dt>Linked publications</dt><dd>{studies}</dd></div>
        <div><dt>Typed findings</dt><dd>{total}</dd></div>
      </dl>
    </Hero>

    <section className="gp-section" aria-labelledby="gp-ladder-title">
      <div className="gp-section-head"><h2 id="gp-ladder-title">How far the evidence goes</h2><p className="ev-note">A rung is indexed only when a finding in this graph speaks to it. Not indexed means Clarity holds nothing, not that nothing exists.</p></div>
      <ol className="gp-ladder">{rungs.map(r=><li key={r.key} data-indexed={r.indexed}>
        <a href={`#${r.target}`} onClick={event=>{event.preventDefault();document.getElementById(r.target)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});document.getElementById(r.target)?.focus?.({preventScroll:true});}}>
          <span>{r.label}</span><strong>{r.status}</strong>{r.indexed&&<small>{r.asks}</small>}
        </a>
      </li>)}</ol>
    </section>

    <section className="gp-q" aria-labelledby="gp-q1">
      <h2 id="gp-q1" tabIndex={-1}><em>Q1</em>{ask[0]}</h2>
      <p className="gp-lead">{q1.text}</p>
      {!q1.curated&&<p className="ev-note">No curated class is stored for this entity yet, so this is the generic description for its kind.</p>}
      {scope&&<p className="gp-scope">{scope}</p>}
      <dl className="gp-facts">
        <div><dt>Class</dt><dd>{q1.label}</dd></div>
        {q1.specimen&&<div><dt>Specimen</dt><dd>{q1.specimen}</dd></div>}
        {q1.aliases.length>0&&<div><dt>Aliases</dt><dd>{q1.aliases.join(' · ')}</dd></div>}
      </dl>
      {(links.length>0||ucsc)&&<div className="gp-ids">
        <ul>{links.map(link=><li key={link.key}><a href={link.url} target="_blank" rel="noreferrer">{link.label} <code>{link.id}</code></a><small>{link.about}</small></li>)}
          {ucsc&&<li key="ucsc"><a href={ucsc.url} target="_blank" rel="noreferrer">UCSC <code>{ucsc.position}</code></a><small>{ucsc.about}</small></li>}</ul>
        <p className="ev-note">{idCaption(entity)}</p>
      </div>}
      {q1.molecular.length>0&&<>
        <p className="ev-note">Gene, protein and variant are separate entities here. A finding about one is never attached to another.</p>
        <ul className="gp-related">{q1.molecular.map(r=>{const to=graphPath(r.id);return <li key={r.edge+r.id}><span>{relationLabel(r)}</span>{to?<Link to={to} go={go}>{r.name}</Link>:<strong>{r.name}</strong>}<small>{r.kind}</small></li>;})}</ul>
      </>}
    </section>

    <section className="gp-q" aria-labelledby="gp-q2">
      <h2 id="gp-q2" tabIndex={-1}><em>Q2</em>{ask[1]}</h2>
      {q2.state==='background'&&<p className="gp-badge">Background, not a finding</p>}
      <p className="gp-lead">{q2.text}</p>
      {q2.findings.length>0&&<FindingList rows={q2.findings}/>}
      {q2.state==='indexed'&&q2.note&&<p className="ev-note">Background: {q2.note}</p>}
    </section>

    <section className="gp-q" aria-labelledby="gp-q3">
      <h2 id="gp-q3" tabIndex={-1}><em>Q3</em>{ask[2]}</h2>
      <p className="gp-lead" data-gap={q3.gap||undefined}>{q3.text}</p>
      <dl className="gp-facts">
        {q3.assays.length>0&&<div><dt>Assays named</dt><dd>{q3.assays.join(' · ')}</dd></div>}
        {q3.units.length>0&&<div><dt>Units reported</dt><dd>{q3.units.join(' · ')}</dd></div>}
        {q3.method&&<div><dt>Usual method</dt><dd>{q3.method} <span className="ev-note">(background)</span></dd></div>}
      </dl>
    </section>

    <section className="gp-q" aria-labelledby="gp-q4">
      <h2 id="gp-q4" tabIndex={-1}><em>Q4</em>{ask[3]}</h2>
      {q4.length===0&&<p className="gp-lead">No typed finding is indexed for {entity.name}, so this page supports no claim about what its value indicates.</p>}
      {q4.map(g=><div className="gp-kind" key={g.kind}>
        <h3>{g.label}<span>{g.rows.length}</span></h3>
        {g.sentences.map(sentence=><p className="gp-meaning" key={sentence}>{sentence}</p>)}
        {g.kind==='classification'&&<AccuracyFigures table={table} strip={EMPTY_STRIP}/>}
        {g.kind==='discrimination'&&<AccuracyFigures table={EMPTY_TABLE} strip={strip}/>}
        <FindingList rows={g.rows}/>
      </div>)}
      {total>0&&<p className="gp-export">The whole profile as one file: <button type="button" onClick={()=>download(findingsCsv(entity,findings),'text/csv','csv')}>Download CSV</button> <button type="button" onClick={()=>download(findingsJson(entity,findings,layers),'application/json','json')}>Download JSON</button> <span className="ev-note">One row per finding, with its passage, source and review state. The workspace below takes a filtered selection instead.</span></p>}
    </section>

    <section className="gp-q" aria-labelledby="gp-q5">
      <h2 id="gp-q5" tabIndex={-1}><em>Q5</em>{ask[4]}</h2>
      <p className="gp-lead" data-gap={q5.state==='empty'||undefined}>{q5.text}</p>
      {q5.rows.length>0&&<FindingList rows={q5.rows}/>}
    </section>

    {dead.length>0&&<details className="gp-dead"><summary>{dead.length} extraction {dead.length===1?'attempt':'attempts'} produced no typed finding</summary>
      <ul>{dead.map(d=><li key={`${d.pmid}-${d.at}`}>{d.pmid?`PMID ${d.pmid}`:'Source'}: {deadLetterText(d)}.</li>)}</ul>
      <p className="ev-note">Recorded so the next extraction pass knows why. A rejected passage is not evidence against {entity.name}.</p>
    </details>}

    {total>0&&<FindingsWorkspace
      result={{entities:[{id:entity.id,name:entity.name}],graph_findings:flatten(findings).map(f=>({...f,entity_id:entity.id}))}}
      estimates={[]} letter="F" title={`Every ${entity.name} finding in one table`} context="profile" subject={entity.name}
      briefs={[{name:entity.name,missing:rungs.filter(r=>!r.indexed).map(r=>r.label)}]}
      intro="Filter this profile's findings by kind, layer or measure, take the rows you need, and copy a methods sentence that states what this library did and did not hold."/>}

    <p className="ev-note gp-foot">Automated graph profile built from published abstracts, with curated identity text marked as background. It describes what studies report and is not a clinical decision or individual risk tool.</p>
  </div>;
}

// Graph biomarkers from /api/library that the bundled catalog does not profile, as browsable cards.
// The index's whole shelf hangs on this one request: when it failed the page silently showed only
// the curated profiles, which reads as "the library is small" rather than "a request failed". It
// retries on the statuses a restarting engine returns, and says plainly when it has given up.
export function useGraphBiomarkers(enabled=true){
  const [state,setState]=useState({rows:null,failed:false,waking:false});
  useEffect(()=>{
    if(!enabled)return undefined;
    let active=true,waiting=null;
    const once=async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await fetch(`${API_BASE}/api/library`,{signal:controller.signal});
        if(!response.ok)throw Object.assign(Error('request_failed'),{outcome:response.status});
        return response.json();
      }finally{clearTimeout(timer);}
    };
    fetchWithRetry(once,{
      sleep:ms=>new Promise(resolve=>{waiting=setTimeout(resolve,ms);}),
      onRetry:()=>{if(active)setState(s=>({...s,waking:true}));},
    }).then(d=>{if(active)setState({rows:(d.entries||[]).filter(e=>String(e.id).startsWith('graph:')),failed:libraryIsShort(d),waking:false});})
      .catch(()=>{if(active)setState({rows:null,failed:true,waking:false});});
    return()=>{active=false;clearTimeout(waiting);};
  },[enabled]);
  return state;
}
function Card({entity,go}){
  const badge=kindBadge(entity);
  return <a className="ev-entity-card" href={entity.path} onClick={ev=>{if(!ev.metaKey&&!ev.ctrlKey&&!ev.shiftKey&&!ev.altKey&&ev.button===0){ev.preventDefault();go(entity.path);}}}>
    <div className="ev-entity-card-top"><span>{entity.category} · evidence graph</span></div>
    <h3>{entity.name}</h3>
    <p>{(entity.aliases||[]).filter(a=>a!==entity.name).slice(0,3).join(' · ')||'No other names indexed'}</p>
    <div className="ev-entity-card-bottom">
      <span>{badge.text}</span>
      {badge.kinds.length>0&&!badge.utility&&<span className="gp-card-gap">no utility finding</span>}
      <span>{entity.coverage.linked_studies} publications</span>
    </div>
  </a>;
}

export function GraphBiomarkerList({go,query='',rows=undefined,failed=false,label='From the evidence graph'}){
  const fetched=useGraphBiomarkers(rows===undefined);
  const all=rows===undefined?fetched.rows:rows, missing=rows===undefined?fetched.failed:failed;
  const waking=rows===undefined&&fetched.waking&&!all;
  const shown=graphMatches(all,query);
  // Pages that can answer something lead; names with nothing indexed stay searchable behind a fold.
  const withFindings=shown.filter(e=>e.coverage.quantified_outcomes>0),gaps=shown.filter(e=>!e.coverage.quantified_outcomes);
  return <section className="ev-browser" aria-labelledby="gp-graph-list">
    <div className="ev-library-title"><h2 id="gp-graph-list">{label}{all?` (${all.length})`:''}</h2><span role="status">{missing?'These profiles could not be loaded, so this count is short. The engine may be restarting.':all?`${withFindings.length} with typed findings · ${gaps.length} not yet`:waking?'The evidence engine is waking up. Retrying…':'Loading…'}</span></div>
    <p className="ev-note">Automated graph profiles: aliases, five evidence layers and typed findings with source passages. GAP means no typed finding is indexed yet, not that none exist.</p>
    {all&&<>
      {withFindings.length>0&&<div className="ev-grid">{withFindings.map(e=><Card key={e.id} entity={e} go={go}/>)}</div>}
      {gaps.length>0&&<details className="gp-gap-list" open={Boolean(query.trim())}>
        <summary>{gaps.length} {gaps.length===1?'name':'names'} in the library with no typed finding yet</summary>
        <p className="ev-note">These pages carry aliases and an honest gap statement. Searching still finds them.</p>
        <div className="ev-grid">{gaps.map(e=><Card key={e.id} entity={e} go={go}/>)}</div>
      </details>}
      {!shown.length&&<p className="ev-note">No graph entity matches this search.</p>}
    </>}
  </section>;
}
