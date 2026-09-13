import {API_BASE as API} from "../platform/api.js";
import React, {useEffect,useState} from 'react';
import './living-research.css';

const date=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Not yet checked';
const safeUrl=value=>{try{return new URL(value).protocol==='https:'?value:undefined;}catch{return undefined;}};

export default function LivingResearch({targetId,compact=false,indexedCount=0,lastExtracted=null}) {
  const [result,setResult]=useState(null);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    fetch(`${API}/api/living-research/${encodeURIComponent(targetId)}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Unavailable');return response.json();})
      .then(data=>{if(active)setResult({...data,target_id:targetId});})
      .catch(()=>{if(active)setResult({target_id:targetId,monitoring_status:'unavailable',updates:[]});})
      .finally(()=>clearTimeout(timeout));
    return()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[targetId]);
  const data=result?.target_id===targetId?result:null;
  return <section className={`living-evidence ${compact?'living-evidence-compact':''}`} aria-label="Living research updates">
    <div className="living-evidence-heading"><h2>{indexedCount?"Sources indexed":"Living research"}</h2><span>{!data?'Checking status…':data.monitoring_status==='checked'?'Literature checked':data.monitoring_status==='partial_failure'?'Some sources could not be checked':['queued','not_started'].includes(data.monitoring_status)?'Awaiting first monitoring check':data.monitoring_status==='not_scheduled'?'Awaiting monitoring setup':'Monitoring unavailable'}</span></div>
    <p>{indexedCount>0&&<>{indexedCount} source records · {lastExtracted?`Selected extraction ${lastExtracted} · `:""}</>}Last completed literature check: <strong>{date(data?.last_checked)}</strong></p>
    <p className="living-evidence-note">{data?.updates_pending_review>0?`${data.updates_pending_review} candidate updates await review. `:''}Monitoring dates describe completed searches; extraction dates describe selected records. Grade changes require review.</p>
    {data?.updates?.length>0?<details><summary>Reviewed change history ({data.updates.length} updates)</summary>{data.updates.map(update=><article key={update.proposal_id}>
      <h3><a href={safeUrl(update.paper.url)} target="_blank" rel="noreferrer">{update.paper.title} ↗</a></h3>
      <p>{update.paper.is_preprint?'Preprint · ':''}{update.paper.nct_id?'Trial registry update · ':''}Reviewed by {update.review.reviewer} · {date(update.published_at)}</p>
      {update.summary&&<p>{update.summary}</p>}<p>{update.review.note}</p>
      <details><summary>View extracted findings and source passages</summary>{Object.entries(update.facts).map(([field,fact])=><div className="living-fact" key={field}><h4>{field.replaceAll('_',' ')}</h4><p>{fact.value}</p><blockquote>{fact.quote}</blockquote></div>)}</details>
    </article>)}</details>:data?.last_checked?<p>No reviewed research updates have been published for this profile yet.</p>:null}
  </section>;
}
