import React,{useEffect,useMemo,useState} from 'react';
import {ResearchTools} from './EvidenceLayers.jsx';
import {loadLibrary,onLibraryUpdate} from '../design/libraryStore.js';
import {TYPE_LABEL} from '../design/librarySearch.js';
import {catalogFreshness} from '../evidence/graphProfile.js';
import './library.css';

const TYPES={intervention:'Compounds & interventions',biomarker:'Biomarkers',diagnostic:'Diagnostics',screening:'Screening',precision_oncology:'Precision medicine'};
// What a row's review state actually means, in the reader's words rather than the field's.
const STATUS={
  automated_appraisal:'Automated reading',
  refresh_required:'Awaiting refresh',
  reference_summary:'Reference context',
  partially_reviewed:'Partly reviewed',
  reviewed:'Reviewed',
};
const PAGE=25;
const fold=s=>String(s||'').toLowerCase();

// Rows carry two different quantities and they are not the same claim. Publications say how much
// was read; estimates say how much can be quoted. Sorting on the first alone would rank a profile
// with 183 abstracts and one usable number above one with four abstracts and seven.
export function rank(rows,sort){
  const byName=(a,b)=>a.name.localeCompare(b.name);
  const copy=[...rows];
  if(sort==='name')return copy.sort(byName);
  if(sort==='sources')return copy.sort((a,b)=>b.coverage.linked_studies-a.coverage.linked_studies||byName(a,b));
  if(sort==='recent')return copy.sort((a,b)=>String(b.last_enriched_at||b.generated_at||'').localeCompare(String(a.last_enriched_at||a.generated_at||''))||byName(a,b));
  return copy.sort((a,b)=>b.coverage.quantified_outcomes-a.coverage.quantified_outcomes||b.coverage.linked_studies-a.coverage.linked_studies||byName(a,b));
}

// Across-domain order interleaves the domains so the first screen is not one domain's alphabet.
export function interleave(rows){
  const groups=['biomarker','diagnostic','precision_oncology','screening','intervention'].map(t=>rows.filter(e=>e.entity_type===t));
  const out=[];
  for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const g of groups)if(g[i])out.push(g[i]);
  return out;
}

function Row({entry}){
  const outcomes=(entry.quantified_outcome_names?.length?entry.quantified_outcome_names:entry.outcomes)||[];
  const extra=outcomes.length>3?outcomes.length-3:0;
  const estimates=entry.coverage.quantified_outcomes||0;
  const aliases=(entry.aliases||[]).filter(a=>a!==entry.name).slice(0,2);
  return <a className="lib-row" href={entry.path} data-domain={entry.entity_type}>
    <div className="lib-id">
      <span className="lib-type">{TYPE_LABEL[entry.entity_type]||entry.entity_type} · {entry.category}</span>
      <h3>{entry.name}</h3>
      {aliases.length>0&&<p className="lib-alias">also {aliases.join(' · ')}</p>}
    </div>
    <p className="lib-outcomes">
      {outcomes.length
        ? <>{outcomes.slice(0,3).join(' · ')}{extra?` · +${extra} more`:''}</>
        : <span className="lib-none">no outcome named yet</span>}
    </p>
    <div className="lib-figures">
      <span className="lib-figure"><b className="c-num">{entry.coverage.linked_studies}</b> publications</span>
      <span className="lib-figure" data-present={estimates>0||undefined}>
        <b className="c-num">{estimates||'—'}</b> {estimates===1?'outcome with an estimate':'outcomes with estimates'}
      </span>
    </div>
    <div className="lib-state">
      <span className="c-tag" data-tone={entry.review_status==='reviewed'?'indexed':entry.review_status==='refresh_required'?'caution':undefined}>
        {STATUS[entry.review_status]||entry.review_status}
      </span>
      <small>{entry.last_enriched_at?`sources extracted ${String(entry.last_enriched_at).slice(0,10)}`:'last check: see profile'}</small>
    </div>
  </a>;
}

function Skeleton(){
  return <div className="lib-rows" aria-hidden="true">{[0,1,2,3,4,5].map(i=><div className="lib-row lib-row--skel" key={i}>
    <div className="lib-id"><div className="c-skel" style={{width:'44%',height:'10px'}}/><div className="c-skel" style={{width:'62%',height:'19px',marginTop:'9px'}}/></div>
    <div className="c-skel" style={{width:'80%',height:'12px'}}/>
    <div className="c-skel" style={{width:'70%',height:'12px'}}/>
    <div className="c-skel" style={{width:'60%',height:'12px'}}/>
  </div>)}</div>;
}

export default function Library({initialType='',heading=true}){
  const home=initialType?'/research':'/explore';
  const params=new URLSearchParams(typeof window!=='undefined'&&window.location.pathname===home?window.location.search:'');
  const [query,setQuery]=useState(params.get('q')||'');
  const [type,setType]=useState(params.get('type')||initialType);
  const [category,setCategory]=useState(params.get('category')||'');
  const [sort,setSort]=useState(params.get('sort')||'balanced');
  const [page,setPage]=useState(1);
  const [data,setData]=useState(null),[error,setError]=useState(false);

  useEffect(()=>{
    let active=true;
    loadLibrary().then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError(true);});
    const stop=onLibraryUpdate(d=>{if(active)setData(d);});
    return()=>{active=false;stop();};
  },[]);

  // Filters live in the URL so a filtered library can be linked, reloaded and shared.
  useEffect(()=>{
    setPage(1);
    if(typeof window==='undefined'||location.pathname!==home)return;
    const p=new URLSearchParams();
    for(const [key,value] of Object.entries({q:query,type,category,sort:sort==='balanced'?'':sort}))if(value)p.set(key,value);
    history.replaceState(history.state,'',`${location.pathname}${p.size?'?'+p:''}${location.hash}`);
  },[query,type,category,sort,home]);

  const rows=useMemo(()=>{
    const q=fold(query).trim();
    const filtered=(data?.entries||[]).filter(e=>
      (!type||e.entity_type===type)&&(!category||e.category===category)&&
      (!q||fold([e.name,...(e.aliases||[]),...(e.outcomes||[]),...(e.conditions||[]),e.category].join(' ')).includes(q)));
    const ranked=rank(filtered,sort);
    return sort==='balanced'&&!type?interleave(ranked):ranked;
  },[data,query,type,category,sort]);

  const categories=useMemo(()=>[...new Set((data?.entries||[]).filter(e=>!type||e.entity_type===type).map(e=>e.category))].sort(),[data,type]);
  const pages=Math.max(1,Math.ceil(rows.length/PAGE));
  const filtered=Boolean(query||type||category||sort!=='balanced');
  const stale=catalogFreshness(data);

  return <section className="lib" lang="en">
    {heading&&<header className="lib-head">
      <h1>The Clarity library</h1>
      <p className="c-lede">Every profile Clarity holds, searchable by name, alias, condition or studied outcome. A profile exists because something was indexed for it — not because the evidence is strong.</p>
    </header>}

    <div className="lib-controls">
      <div className="lib-search">
        <label className="c-label" htmlFor="lib-q">Search the library</label>
        <input id="lib-q" className="c-field" type="search" value={query} placeholder="creatine, ApoB, cognition, EGFR…"
          onChange={e=>setQuery(e.target.value)} autoComplete="off"/>
      </div>
      <div><label className="c-label" htmlFor="lib-type">Domain</label>
        <select id="lib-type" className="c-field" value={type} onChange={e=>{setType(e.target.value);setCategory('');}}>
          <option value="">All domains</option>
          {Object.entries(TYPES).map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select></div>
      <div><label className="c-label" htmlFor="lib-cat">Category</label>
        <select id="lib-cat" className="c-field" value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}
        </select></div>
      <div><label className="c-label" htmlFor="lib-sort">Order</label>
        <select id="lib-sort" className="c-field" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="balanced">Most outcomes with estimates</option>
          <option value="name">Name</option>
          <option value="sources">Publication count</option>
          <option value="recent">Recently extracted</option>
        </select></div>
    </div>

    {data&&<div className="lib-facets">
      <button type="button" className="c-chip" aria-pressed={!type} onClick={()=>{setType('');setCategory('');}}>
        All <span className="c-chip-n">{data.entries.length}</span></button>
      {Object.entries(data.counts||{}).map(([key,count])=><button type="button" key={key} className="c-chip"
        aria-pressed={type===key} onClick={()=>{setType(type===key?'':key);setCategory('');}}>
        {TYPES[key]} <span className="c-chip-n">{count}</span></button>)}
    </div>}

    <div className="lib-status">
      <p role="status">{data
        ? <>{rows.length.toLocaleString()} {rows.length===1?'profile':'profiles'}{rows.length>PAGE?` · showing ${Math.min((page-1)*PAGE+1,rows.length)}–${Math.min(page*PAGE,rows.length)}`:''}</>
        : error?'The library could not be loaded. The engine may be restarting — reload to try again.'
        :'Loading the library…'}</p>
      {filtered&&<button type="button" className="c-btn c-btn--quiet c-btn--sm"
        onClick={()=>{setQuery('');setType(initialType);setCategory('');setSort('balanced');}}>Reset filters</button>}
    </div>

    {stale&&<div className="c-notice" data-tone="caution" role="status">{stale}</div>}
    {data&&<p className="c-note">{data.coverage_statement}</p>}

    {!data&&!error&&<Skeleton/>}
    {data&&rows.length>0&&<><h2 className="c-sr">Matching profiles</h2><div className="lib-rows">{rows.slice((page-1)*PAGE,page*PAGE).map(e=><Row key={e.id} entry={e}/>)}</div></>}
    {data&&!rows.length&&<div className="c-gap">
      <strong>No profile in this library matches {query?`“${query.trim()}”`:'these filters'}.</strong>
      <p>That is a statement about what Clarity has indexed, not about the literature. Clear a filter, or try an alias or the gene symbol.</p>
    </div>}

    {pages>1&&<nav className="lib-pages" aria-label="Library pages">
      <button type="button" className="c-btn c-btn--sm" disabled={page===1} onClick={()=>setPage(n=>n-1)}>← Previous</button>
      <span className="c-note">Page {page} of {pages}</span>
      <button type="button" className="c-btn c-btn--sm" disabled={page>=pages} onClick={()=>setPage(n=>n+1)}>Next →</button>
    </nav>}

    <ResearchTools/>
  </section>;
}
