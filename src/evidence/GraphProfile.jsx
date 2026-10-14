import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {API_BASE} from '../platform/api.js';
import {kindWords,layerLabel,flatten,valueText,aucStrip,classificationRows,relationLabel,deadLetterText,diagnose,freshness,graphCandidates,graphMatches,graphPath,catalogFreshness,libraryIsShort,quotedRows,provenanceNote,bundledCatalog,bundledProfile,findingsCsv,findingsJson,graphPrefixes,identity,biology,measurement,meaning,utility,ladder,scopeNote,questions,fetchWithRetry,externalLinks,idCaption,ucscLink,kindBadge,LAYERS} from './graphProfile.js';
import FindingsWorkspace from '../research/FindingsWorkspace.jsx';
import FindingLedger from './FindingLedger.jsx';
import Inspector from './Inspector.jsx';
import {Crumbs} from '../design/Shell.jsx';
import './graph-profile.css';
import './ledger.css';
import './inspector.css';

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
const INDEX={biomarker:['/biomarkers','All biomarkers','BIOMARKERS'],diagnostic:['/diagnostics','All diagnostics','DIAGNOSTICS'],screening:['/screening','All screening','SCREENING'],precision_oncology:['/precision-medicine','All precision medicine','PRECISION MEDICINE']};
export function useGraphEntity(slug,type='biomarker',attempt=0){
  const [state,setState]=useState({status:'loading'});
  useEffect(()=>{
    if(!slug){setState({status:'missing'});return undefined;}
    let active=true,inFlight=null,waiting=null,painted=false;
    setState({status:'loading'});

    // Variants and genes share the biomarker address space; a biomarker id wins when both exist.
    const candidates=graphCandidates(type,slug);

    const once=async()=>{
      // Each attempt gets its own controller: a timed-out signal cannot be reused by the next try.
      const controller=new AbortController();inFlight=controller;
      const timer=setTimeout(()=>controller.abort(),15000);
      try{
        for(const candidate of candidates){
          const response=await fetch(`${API_BASE}/api/evidence/graph/entity/${encodeURIComponent(candidate)}`,{signal:controller.signal});
          if(response.status===404)continue;
          if(!response.ok)throw Object.assign(Error('request_failed'),{outcome:response.status});
          return response.json();
        }
        return null;
      }finally{clearTimeout(timer);}
    };

    // The published copy is served from this origin and lands in milliseconds, so it goes up first
    // and the live read replaces it if it arrives. Waiting for three 15-second attempts and their
    // delays before even looking at the copy is what put fifty seconds of skeleton in front of a
    // page the site was already carrying.
    const copy=bundledProfile(candidates).catch(()=>null);
    copy.then(bundled=>{
      if(active&&bundled&&!painted){painted=true;setState({status:'ready',data:bundled});}
    });

    fetchWithRetry(once,{
      sleep:ms=>new Promise(resolve=>{waiting=setTimeout(resolve,ms);}),
      // A retry notice would overwrite a page the reader is already reading.
      onRetry:tries=>{if(active&&!painted)setState({status:'retrying',attempt:tries});},
    }).then(data=>{
        if(!active)return;
        if(data){painted=true;setState({status:'ready',data});return;}
        // The graph answered 404 for every candidate. A published copy is still a record of what
        // was there; only say "no such page" when neither has it.
        if(!painted)copy.then(bundled=>{
          if(active)setState(bundled?{status:'ready',data:bundled}:{status:'missing'});
        });
      })
      .catch(()=>{
        if(!active||painted)return;  // nothing answered, but the copy is already on screen
        copy.then(bundled=>{
          if(active)setState(bundled?{status:'ready',data:bundled}:{status:'error'});
        });
      });

    return()=>{active=false;clearTimeout(waiting);inFlight?.abort();};
  },[slug,type,attempt]);
  return state;
}

// A curated profile owns its URL. When the graph also holds typed findings for that entity, they
// belong on the same page — under the curated reading, never merged into it.
export function GraphFindings({slug,type='biomarker'}){
  const state=useGraphEntity(slug,type);
  const [inspecting,setInspecting]=useState(null);
  if(state.status!=='ready')return null;
  const {entity,findings}=state.data;
  const rows=flatten(findings);
  if(!rows.length)return null;
  const q4=meaning(entity,findings),q5=utility(entity,findings),scope=scopeNote(entity,findings),rungs=ladder(entity,findings);
  const strip=aucStrip(findings),table=classificationRows(findings);
  const ledgerRows=q4.flatMap(group=>group.rows.map(row=>({...row,kindLabel:group.label})));
  const inLibrary=rungs.filter(r=>r.indexed).map(r=>r.label),missing=rungs.filter(r=>!r.indexed).map(r=>r.label);
  return <section className="gp-inline" aria-labelledby="gp-inline-title">
    <h2 id="gp-inline-title">Also in the evidence graph</h2>
    <p className="c-note">{rows.length} source-bound {rows.length===1?'finding':'findings'} extracted automatically for {entity.name}, kept separate from the curated reading above. Not expert-reviewed.</p>
    {scope&&<p className="c-body">{scope}</p>}
    {q4.map(group=><p className="c-body gp-kind-note" key={group.kind}><b>{group.label}.</b> {group.sentences.join(' ')}</p>)}
    {table.rows.length>0&&<AccuracyFigures table={table} strip={EMPTY_STRIP}/>}
    {strip.points.length>0&&<AccuracyFigures table={EMPTY_TABLE} strip={strip}/>}
    <FindingLedger rows={ledgerRows} onInspect={setInspecting} activeId={inspecting?.id}
      caption={`Graph findings indexed for ${entity.name}.`}/>
    <p className="c-body" data-gap={q5.state==='empty'||undefined}>{q5.text}</p>
    <p className="c-note gp-inline-ladder">
      <span>In this library: {inLibrary.length?inLibrary.join(', '):'nothing yet'}</span>
      <span>Not in this library yet: {missing.length?missing.join(', '):'nothing missing'}</span>
    </p>
    {inspecting&&<Inspector finding={inspecting} onClose={()=>setInspecting(null)} entityName={entity.name}/>}
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


// Short rail labels. The questions themselves stay as written in the contract; the rail needs a
// handful of words a reader can scan, and "Q1" was our word for it, not theirs.
const SHORT={
  biomarker:['What it is','Biology','Measurement','Findings','Does it help'],
  diagnostic:['What it is','What it detects','Reliability','Accuracy','Does it help'],
  screening:['What it is','What it looks for','Reliability','Accuracy','Does it help'],
  precision_oncology:['The modifier','Biology','Measurement','Prognostic or predictive','Does it help'],
};
const RUNG_SLOTS=[0,1,2,3,4,5];

function jumpTo(id){
  const target=document.getElementById(id);
  if(!target)return;
  const smooth=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({block:'start',behavior:smooth?'smooth':'auto'});
  target.focus?.({preventScroll:true});
}

function Section({id,n,label,question,count,children}){
  return <section className="gp-section" id={id} aria-labelledby={`${id}-h`}>
    <div className="gp-section-head">
      <h2 id={`${id}-h`} tabIndex={-1}>{question}</h2>
      {count!=null&&count>0&&<span className="gp-section-count c-num">{count}</span>}
    </div>
    {children}
  </section>;
}

// The three-pane reading frame: where you are in the page, the reading itself, and the source you
// are inspecting — none of which should make the others move.
function ProfileFrame({go,index,back,name,type,sections,related,inspecting,onClose,entityName,children}){
  const [here,setHere]=useState(sections?.[0]?.id);
  useEffect(()=>{
    if(!sections)return undefined;
    const nodes=sections.map(s=>document.getElementById(s.id)).filter(Boolean);
    if(!nodes.length||typeof IntersectionObserver==='undefined')return undefined;
    const seen=new Map();
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)seen.set(entry.target.id,entry.intersectionRatio);
      const best=[...seen.entries()].filter(([,ratio])=>ratio>0).sort((a,b)=>b[1]-a[1])[0];
      if(best)setHere(best[0]);
    },{rootMargin:'-70px 0px -55% 0px',threshold:[0,0.25,0.6]});
    for(const node of nodes)observer.observe(node);
    return()=>observer.disconnect();
  },[sections]);

  const crumbs=name?[{label:'Library',to:'/explore'},{label:back?.replace(/^All /,'')||'Biomarkers',to:index},{label:name}]:null;
  return <div className="gp-frame" data-inspecting={inspecting?true:undefined}>
    <nav className="gp-rail" aria-label="On this page">
      {sections&&<>
        <p className="gp-rail-title">On this page</p>
        <ol>{sections.map(s=><li key={s.id}>
          <a href={`#${s.id}`} aria-current={here===s.id?'true':undefined}
             onClick={e=>{e.preventDefault();jumpTo(s.id);}}>
            <span className="gp-rail-n">{s.n}</span>{s.label}
            {s.count!=null&&s.count>0&&<span className="gp-rail-count c-num">{s.count}</span>}
          </a></li>)}</ol>
      </>}
      {related&&related.length>0&&<>
        <p className="gp-rail-title">Related entities</p>
        <ul className="gp-rail-related">{related.slice(0,6).map(r=>{const to=graphPath(r.id);return <li key={r.edge+r.id}>
          {to?<Link to={to} go={go}>{r.name}</Link>:<span>{r.name}</span>}</li>;})}</ul>
      </>}
    </nav>
    <div className="gp-column">
      {crumbs&&<Crumbs items={crumbs} go={go}/>}
      {children}
    </div>
    <Inspector finding={inspecting} onClose={onClose} entityName={entityName}/>
  </div>;
}

export default function GraphProfile({slug,go,type='biomarker'}){
  const [attempt,setAttempt]=useState(0);
  const [inspecting,setInspecting]=useState(null);
  const state=useGraphEntity(slug,type,attempt);
  const [index,back]=INDEX[type]||INDEX.biomarker;

  // A new entity is a new set of findings; the panel must not keep showing the last one's passage.
  useEffect(()=>{setInspecting(null);},[slug,type]);

  if(state.status==='loading'||state.status==='retrying')return <ProfileFrame crumbs={null}>
    <div className="gp-read" aria-busy="true">
      <div className="gp-mast"><div className="c-skel" style={{width:'180px',height:'13px'}}/><div className="c-skel" style={{width:'44%',height:'46px',marginTop:'14px'}}/></div>
      <div className="gp-rungs" aria-hidden="true">{RUNG_SLOTS.map(i=><div className="gp-rung" key={i}><div className="c-skel" style={{width:'70%',height:'11px'}}/><div className="c-skel" style={{width:'36%',height:'18px',marginTop:'8px'}}/></div>)}</div>
      <p className="c-note" role="status" style={{marginTop:'var(--s5)'}}>{state.status==='retrying'?'The evidence engine is waking up. Retrying…':'Loading this profile…'}</p>
    </div>
  </ProfileFrame>;

  if(state.status==='missing')return <ProfileFrame>
    <div className="gp-read"><div className="gp-mast"><h1>Page not found</h1></div>
      <p className="c-lede">No entity in the Clarity graph uses this address.</p>
      <p style={{marginTop:'var(--s4)'}}><Link className="c-btn" to={index} go={go}>{back}</Link></p></div>
  </ProfileFrame>;

  if(state.status==='error')return <ProfileFrame>
    <div className="gp-read"><div className="gp-mast"><h1>Profile unavailable</h1></div>
      <div className="c-notice" data-tone="caution"><Diagnosis/></div>
      <p style={{marginTop:'var(--s4)'}}><button type="button" className="c-btn" onClick={()=>setAttempt(n=>n+1)}>Try again</button></p></div>
  </ProfileFrame>;

  const {entity,layers,findings,related,studies,dead_letters:dead}=state.data;
  const stale=freshness(state.data),quoted=quotedRows(state.data);
  const all=flatten(findings),total=all.length,strip=aucStrip(findings),table=classificationRows(findings);
  const q1=identity(entity,related),q2=biology(entity,findings),q3=measurement(entity,findings),q4=meaning(entity,findings),q5=utility(entity,findings);
  const rungs=ladder(entity,findings),scope=scopeNote(entity,findings),ask=questions(type),links=externalLinks(entity),ucsc=ucscLink(entity);
  const badge=kindBadge(entity);
  // Every ledger row carries the label of the kind it was grouped under, so the table can say it.
  const ledgerRows=q4.flatMap(group=>group.rows.map(row=>({...row,kindLabel:group.label})));
  const q2Rows=q2.findings.map(row=>({...row,kindLabel:'Mechanism'}));
  const q5Rows=q5.rows.map(row=>({...row,kindLabel:'Utility'}));
  const indexedRungs=rungs.filter(r=>r.indexed).length;

  const download=(text,mime,extension)=>{
    const url=URL.createObjectURL(new Blob([text],{type:mime}));
    const link=Object.assign(document.createElement('a'),{href:url,download:`${entity.id.replace(':','-')}-findings.${extension}`});
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const sections=[
    {id:'gp-s1',n:1,label:SHORT[type]?.[0]||'What it is',question:ask[0]},
    {id:'gp-s2',n:2,label:SHORT[type]?.[1]||'Biology',question:ask[1]},
    {id:'gp-s3',n:3,label:SHORT[type]?.[2]||'Measurement',question:ask[2]},
    {id:'gp-s4',n:4,label:SHORT[type]?.[3]||'Findings',question:ask[3],count:total},
    {id:'gp-s5',n:5,label:SHORT[type]?.[4]||'Does it help',question:ask[4]},
  ];

  return <ProfileFrame
    go={go} index={index} back={back} name={entity.name} type={type}
    sections={sections} related={q1.molecular} inspecting={inspecting}
    onClose={()=>setInspecting(null)} entityName={entity.name}>
    <div className="gp-read">
      <div className="gp-mast">
        <div className="gp-mast-main">
          <p className="gp-kindline">
            <span className="c-tag" data-tone="indexed">{kindWords(entity.kind)}</span>
            {q1.aliases.length>0&&<span className="c-note" style={{display:'inline'}}>also written {q1.aliases.slice(0,3).join(' · ')}</span>}
          </p>
          <h1 tabIndex={-1} id="gp-title">{entity.name}</h1>
        </div>
        {(links.length>0||ucsc)&&<dl className="gp-ids">
          {links.map(link=><div key={link.key}><dt>{link.label}</dt><dd><a href={link.url} target="_blank" rel="noreferrer">{link.id}</a></dd></div>)}
          {ucsc&&<div key="ucsc"><dt>UCSC</dt><dd><a href={ucsc.url} target="_blank" rel="noreferrer">{ucsc.position}</a></dd></div>}
        </dl>}
      </div>

      {stale&&<div className="c-notice" data-tone="caution" role="status">{stale}</div>}

      <p className="c-lede gp-scope">
        {studies} linked {studies===1?'publication':'publications'}; {total} {total===1?'finding carries':'findings carry'} a reported estimate.
        {scope?` ${scope}`:''}
      </p>

      <div className="gp-rungs" role="group" aria-label="How far the indexed evidence goes">
        {rungs.map(r=><a className="gp-rung" key={r.key} data-indexed={r.indexed||undefined} href={`#${r.target}`}
          onClick={e=>{e.preventDefault();jumpTo(r.target);}}>
          <span className="gp-rung-label">{r.label}</span>
          <strong>{r.indexed?'indexed':'not indexed'}</strong>
          {r.indexed&&<small>{r.asks}</small>}
        </a>)}
      </div>
      <p className="c-note">{indexedRungs} of {rungs.length} rungs hold something. Not indexed means Clarity holds nothing here, not that nothing exists.</p>

      <Section {...sections[0]}>
        <p className="c-body">{q1.text}{q1.specimen?` Measured in ${q1.specimen.toLowerCase()}.`:''}</p>
        {!q1.curated&&<p className="c-note">No curated class is stored for this entity yet, so this is the generic description for its kind.</p>}
        <dl className="gp-facts">
          <div><dt>Class</dt><dd>{q1.label}</dd></div>
          {q1.specimen&&<div><dt>Specimen</dt><dd>{q1.specimen}</dd></div>}
          {q1.aliases.length>0&&<div><dt>Aliases</dt><dd>{q1.aliases.join(' · ')}</dd></div>}
        </dl>
        {(links.length>0||ucsc)&&<p className="c-note">{idCaption(entity)}</p>}
        {q1.molecular.length>0&&<>
          <p className="c-note">Gene, protein and variant are separate entities here. A finding about one is never attached to another.</p>
          <ul className="gp-related">{q1.molecular.map(r=>{const to=graphPath(r.id);return <li key={r.edge+r.id}>
            <span className="gp-rel-edge">{relationLabel(r)}</span>
            {to?<Link to={to} go={go}>{r.name}</Link>:<strong>{r.name}</strong>}
            <span className="gp-rel-kind">{r.kind}</span>
          </li>;})}</ul>
        </>}
      </Section>

      <Section {...sections[1]}>
        {q2.state==='background'&&<p className="c-tag" data-tone="caution" style={{display:'inline-flex',marginBottom:'var(--s3)'}}>background, not a finding</p>}
        <p className="c-body">{q2.text}</p>
        {q2Rows.length>0&&<FindingLedger rows={q2Rows} onInspect={setInspecting} activeId={inspecting?.id}
          caption={`Mechanism and preclinical findings indexed for ${entity.name}.`}/>}
        {q2.state==='indexed'&&q2.note&&<p className="c-note">Background: {q2.note}</p>}
      </Section>

      <Section {...sections[2]}>
        <p className="c-body" data-gap={q3.gap||undefined}>{q3.text}</p>
        <dl className="gp-facts">
          {q3.assays.length>0&&<div><dt>Assays named</dt><dd>{q3.assays.join(' · ')}</dd></div>}
          {q3.units.length>0&&<div><dt>Units reported</dt><dd>{q3.units.join(' · ')}</dd></div>}
          {q3.method&&<div><dt>Usual method</dt><dd>{q3.method} <span className="c-note" style={{display:'inline'}}>(background)</span></dd></div>}
        </dl>
      </Section>

      <Section {...sections[3]}>
        {total===0
          ? <div className="c-gap"><strong>No typed finding is indexed for {entity.name}.</strong>
              <p>This page supports no claim about what its value indicates. That is a statement about this library, not about the literature.</p></div>
          : <>
            {q4.map(group=><p className="c-body gp-kind-note" key={group.kind}><b>{group.label}.</b> {group.sentences.join(' ')}</p>)}
            {table.rows.length>0&&<AccuracyFigures table={table} strip={EMPTY_STRIP}/>}
            {strip.points.length>0&&<AccuracyFigures table={EMPTY_TABLE} strip={strip}/>}
            <FindingLedger rows={ledgerRows} onInspect={setInspecting} activeId={inspecting?.id}
              caption={`Every typed finding indexed for ${entity.name}, with its estimate, interval, population, provenance and source.`}/>
            <p className="gp-export">
              <button type="button" className="c-btn c-btn--sm" onClick={()=>download(findingsCsv(entity,findings),'text/csv','csv')}>Download CSV</button>
              <button type="button" className="c-btn c-btn--sm" onClick={()=>download(findingsJson(entity,findings,layers),'application/json','json')}>Download JSON</button>
              <span className="c-note" style={{display:'inline'}}>One row per finding, with its passage, source and review state.</span>
            </p>
          </>}
        {quoted.length>0&&<details className="gp-fold">
          <summary>Quoted from other papers — not counted toward {entity.name} ({quoted.length})</summary>
          <p className="c-note">{quoted.length===1?'This number was':'These numbers were'} repeated from work the paper cited. {quoted.length===1?'It is':'They are'} not evidence from this study, count toward nothing on this page, and are shown only so the passage is not hidden.</p>
          <FindingLedger rows={quoted.map(r=>({...r,kindLabel:'Quoted'}))} onInspect={setInspecting} activeId={inspecting?.id}
            caption="Numbers this paper repeated from its own citations."/>
        </details>}
      </Section>

      <Section {...sections[4]}>
        {q5.state==='empty'
          ? <div className="c-gap"><strong>{q5.text}</strong>
              <p>A utility finding is one where the measurement changed what was done and the outcome was followed. Nothing here reports that.</p></div>
          : <p className="c-body">{q5.text}</p>}
        {q5Rows.length>0&&<FindingLedger rows={q5Rows} onInspect={setInspecting} activeId={inspecting?.id}
          caption={`Utility findings indexed for ${entity.name}.`}/>}
      </Section>

      {dead.length>0&&<details className="gp-fold">
        <summary>{dead.length} extraction {dead.length===1?'attempt':'attempts'} produced no typed finding</summary>
        <ul className="gp-dead-list">{dead.map(d=><li key={`${d.pmid}-${d.at}`}>{d.pmid?`PMID ${d.pmid}`:'Source'}: {deadLetterText(d)}.</li>)}</ul>
        <p className="c-note">Recorded so the next extraction pass knows why. A rejected passage is not evidence against {entity.name}.</p>
      </details>}

      {total>0&&<div className="gp-workspace">
        <FindingsWorkspace
          result={{entities:[{id:entity.id,name:entity.name}],graph_findings:all.map(f=>({...f,entity_id:entity.id}))}}
          estimates={[]} letter="F" title={`Every ${entity.name} finding in one table`} context="profile" subject={entity.name}
          briefs={[{name:entity.name,missing:rungs.filter(r=>!r.indexed).map(r=>r.label)}]}
          intro="Filter this profile's findings by kind, layer or measure, take the rows you need, and copy a methods sentence that states what this library did and did not hold."/>
      </div>}

      <p className="c-note gp-foot">{badge.text}. Built from published abstracts, with curated identity text marked as background. It describes what studies report and is not a clinical decision or individual risk tool.</p>
    </div>
  </ProfileFrame>;
}

// Graph biomarkers from /api/library that the bundled catalog does not profile, as browsable cards.
// The index's whole shelf hangs on this one request: when it failed the page silently showed only
// the curated profiles, which reads as "the library is small" rather than "a request failed". It
// retries on the statuses a restarting engine returns, and says plainly when it has given up.
export function useGraphBiomarkers(enabled=true){
  const [state,setState]=useState({rows:null,failed:false,waking:false,published:null});
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
    const settle=d=>{if(active)setState({
      rows:(d.entries||[]).filter(e=>String(e.id).startsWith('graph:')),
      failed:libraryIsShort(d),waking:false,published:catalogFreshness(d),
    });};
    fetchWithRetry(once,{
      sleep:ms=>new Promise(resolve=>{waiting=setTimeout(resolve,ms);}),
      onRetry:()=>{if(active)setState(s=>({...s,waking:true}));},
    }).then(settle)
      .catch(async()=>{
        // The engine answered nothing at all — a container that is not running has no snapshot to
        // serve. The catalog built into this site still knows every graph profile, and showing
        // those beats showing fourteen curated rows as though that were the library.
        const bundled=await bundledCatalog();
        if(!active)return;
        if(bundled)settle(bundled);
        else setState({rows:null,failed:true,waking:false,published:null});
      });
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
      {badge.detail&&<span className="gp-card-kinds">{badge.detail}</span>}
      {badge.total>0&&!badge.utility&&<span className="gp-card-gap">no utility finding</span>}
      <span>{entity.coverage.linked_studies} publications</span>
    </div>
  </a>;
}

export function GraphBiomarkerList({go,query='',rows=undefined,failed=false,label='From the evidence graph'}){
  const fetched=useGraphBiomarkers(rows===undefined);
  const all=rows===undefined?fetched.rows:rows, missing=rows===undefined?fetched.failed:failed;
  const waking=rows===undefined&&fetched.waking&&!all;
  const published=rows===undefined?fetched.published:null;
  const shown=graphMatches(all,query);
  // Pages that can answer something lead; names with nothing indexed stay searchable behind a fold.
  const withFindings=shown.filter(e=>e.coverage.quantified_outcomes>0),gaps=shown.filter(e=>!e.coverage.quantified_outcomes);
  return <section className="ev-browser" aria-labelledby="gp-graph-list">
    <div className="ev-library-title"><h2 id="gp-graph-list">{label}{all?` (${all.length})`:''}</h2><span role="status">{missing?'These profiles could not be loaded, so this count is short. The engine may be restarting.':all?`${withFindings.length} with typed findings · ${gaps.length} not yet`:waking?'The evidence engine is waking up. Retrying…':'Loading…'}</span></div>
    {published&&<p className="gp-stale" role="status">{published}</p>}
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
