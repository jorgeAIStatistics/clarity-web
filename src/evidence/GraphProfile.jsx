import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {API_BASE} from '../platform/api.js';
import {layerLabel,groupFindings,flatten,valueText,aucStrip,classificationRows,relationLabel,deadLetterText,LAYERS} from './graphProfile.js';
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

function Hero({name,go,children}){
  const heading=useRef(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[name]);
  return <div className="ev-hero"><Link className="ev-back" to="/biomarkers" go={go}><ArrowLeft size={15}/>All biomarkers</Link><div className="ev-eyebrow">BIOMARKERS / GRAPH PROFILE · AUTOMATED</div><h1 ref={heading} tabIndex={-1}>{name}</h1>{children}</div>;
}

export default function GraphProfile({slug,go}){
  const [state,setState]=useState({status:'loading'});const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    setState({status:'loading'});
    // Variants and genes share the biomarker address space; a biomarker id wins when both exist.
    const load=async()=>{
      for(const prefix of ['biomarker','variant','gene']){
        const r=await fetch(`${API_BASE}/api/evidence/graph/entity/${prefix}:${encodeURIComponent(slug)}`,{signal:controller.signal});
        if(r.status===404)continue;
        if(!r.ok)throw Error(String(r.status));
        return r.json();
      }
      return null;
    };
    load().then(data=>{if(active)setState(data?{status:'ready',data}:{status:'missing'});})
      .catch(()=>{if(active)setState({status:'error'});})
      .finally(()=>clearTimeout(timer));
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[slug,attempt]);

  if(state.status==='loading')return <div className="gp" aria-busy="true"><div className="ev-hero"><div className="ev-eyebrow">BIOMARKERS / GRAPH PROFILE · AUTOMATED</div><div className="gp-skeleton gp-skeleton-title"/><div className="gp-skeleton"/></div><ul className="gp-layers" aria-hidden="true">{LAYERS.map(l=><li key={l} className="gp-layer gp-layer-skeleton"/>)}</ul><p className="ev-note" role="status">Loading the graph profile…</p></div>;
  if(state.status==='missing')return <div className="gp"><Hero name="Page not found" go={go}/><section className="ev-panel"><h2>This evidence page does not exist</h2><p>No biomarker in the Clarity graph uses this address.</p><Link to="/biomarkers" go={go}>Return to biomarkers</Link></section></div>;
  if(state.status==='error')return <div className="gp"><Hero name="Profile unavailable" go={go}/><section className="ev-panel"><h2>The graph profile could not be loaded</h2><p>The evidence engine may be starting up. Try again in a minute.</p><button onClick={()=>setAttempt(n=>n+1)}>Try again</button></section></div>;

  const {entity,layers,findings,related,studies,dead_letters:dead}=state.data;
  const groups=groupFindings(findings),total=flatten(findings).length,strip=aucStrip(findings),table=classificationRows(findings);
  const aliases=entity.aliases.filter(a=>a!==entity.name);
  return <div className="gp">
    <Hero name={entity.name} go={go}>
      <p className="ev-intro">What indexed publications report about {entity.name}, kept apart by evidence layer and by finding kind. Each reading comes from a quoted source passage and is automated, not expert-reviewed.</p>
      <dl className="gp-identity">
        {aliases.length>0&&<div><dt>Also written as</dt><dd>{aliases.join(' · ')}</dd></div>}
        <div><dt>Linked publications</dt><dd>{studies}</dd></div>
        <div><dt>Typed findings</dt><dd>{total}</dd></div>
        {Object.entries(entity.external_ids||{}).map(([k,v])=><div key={k}><dt>{k.toUpperCase()}</dt><dd>{v}</dd></div>)}
      </dl>
    </Hero>

    <section className="gp-section" aria-labelledby="gp-layers">
      <div className="gp-section-head"><h2 id="gp-layers">Evidence by layer</h2><p className="ev-note">A gap means no typed finding is indexed for that layer yet. It is a gap in Clarity's library, not evidence that none exist.</p></div>
      <ul className="gp-layers">{layers.map(l=><li key={l.layer} className="gp-layer" data-state={l.n_findings>0?'findings':'gap'}>
        <div className="gp-layer-top"><span>{layerLabel(l.layer)}</span><strong>{l.n_findings>0?`${l.n_findings} ${l.n_findings===1?'finding':'findings'}`:'Gap'}</strong></div>
        {l.sentences.map(s=><p key={s}>{s}</p>)}
      </li>)}</ul>
    </section>

    {groups.length>0&&<section className="gp-section" aria-labelledby="gp-findings">
      <div className="gp-section-head"><h2 id="gp-findings">Findings by kind</h2><p className="ev-note">Association, discrimination, classification and clinical utility answer different questions. None of them implies the next.</p></div>
      <AccuracyFigures table={table} strip={strip}/>
      {groups.map(g=><div className="gp-kind" key={g.kind}>
        <h3>{g.label}<span>{g.rows.length}</span></h3><p className="ev-note">{g.note}</p>
        <ul className="gp-findings">{g.rows.map(f=><li key={f.id}>
          <div className="gp-finding-head"><strong>{valueText(f)}</strong><span>{[f.target&&`for ${f.target}`,f.population,f.setting].filter(Boolean).join(' · ')}</span></div>
          {f.quote&&<blockquote>{f.quote}</blockquote>}
          <small>{f.pmid&&<a href={`https://pubmed.ncbi.nlm.nih.gov/${f.pmid}/`} target="_blank" rel="noreferrer">PMID {f.pmid}</a>}{f.year?` · ${f.year}`:''}{f.layer?` · ${layerLabel(f.layer)} layer`:''} · {f.review_state==='reviewed'?'Reviewed':f.review_state==='partially_reviewed'?'Partially reviewed':'Automated reading, not expert-reviewed'}</small>
        </li>)}</ul>
      </div>)}
    </section>}

    {related.length>0&&<section className="gp-section" aria-labelledby="gp-related">
      <div className="gp-section-head"><h2 id="gp-related">Molecular identity</h2><p className="ev-note">Genes, proteins and variants are separate entities. A finding about one is not attached to another.</p></div>
      <ul className="gp-related">{related.map(r=><li key={r.edge+r.id}><span>{relationLabel(r)}</span>{/^(biomarker|variant):/.test(r.id)?<Link to={`/biomarkers/${r.id.split(':')[1]}`} go={go}>{r.name}</Link>:<strong>{r.name}</strong>}<small>{r.kind}</small></li>)}</ul>
    </section>}

    {dead.length>0&&<details className="gp-dead"><summary>{dead.length} extraction {dead.length===1?'attempt':'attempts'} produced no typed finding</summary>
      <ul>{dead.map(d=><li key={`${d.pmid}-${d.at}`}>{d.pmid?`PMID ${d.pmid}`:'Source'}: {deadLetterText(d)}.</li>)}</ul>
      <p className="ev-note">Recorded so the next extraction pass knows why. A rejected passage is not evidence against {entity.name}.</p>
    </details>}

    <p className="ev-note gp-foot">Automated graph profile built from published abstracts. It describes what studies report and is not a clinical decision or individual risk tool.</p>
  </div>;
}
