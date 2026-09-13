import React,{useEffect,useState} from 'react';
import OutcomeTable from './OutcomeTable.jsx';
import {entityBrief} from './profileModel.js';
let pending;
function load(){if(!pending)pending=fetch('/intervention-enrichment.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).catch(e=>{pending=null;throw e;});return pending;}
export default function SelectedExtracts({targetId}){
 const [profile,setProfile]=useState(null);
 useEffect(()=>{let active=true;setProfile(null);load().then(data=>{if(active)setProfile(data.profiles[targetId.replace('compound:','')]||null);}).catch(()=>{});return()=>{active=false;};},[targetId]);
 if(!profile)return null;
 const model=entityBrief({...profile,aliases:[],related:[],context:'Selected study records; clinical grades remain unchanged.'});
 return <div className="selected-extracts"><div className="section-heading"><div><p className="hp-eyebrow">SELECTED SOURCE ENRICHMENT</p><h2>Recent extraction, original context</h2></div><span className="pb-chip" data-status="automated_appraisal">Automated appraisal</span></div><p className="pb-note">{profile.studies.length} selected publications · source passages checked against retained abstracts. This is targeted enrichment, not a completed search or a new evidence grade.</p><OutcomeTable outcomes={model.outcomes}/><details className="appraisal-backlog"><summary>Extraction scope & provenance</summary>{profile.studies.map(s=><article key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a><p className="pb-note">PMID {s.pmid} · {s.cohort_id} · extracted {s.extraction.extracted_at}</p><blockquote>{s.scope_passage.text}</blockquote><p className="pb-note">{s.limitations.join(' ')}</p></article>)}</details></div>;
}
