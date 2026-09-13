import {motion,AnimatePresence,useReducedMotion} from "framer-motion";
import {API_BASE as API} from "./api.js";
import React,{useEffect,useState} from 'react';
import catalog from '../evidence/catalog.json';
import {entityPath} from '../evidence/routing.js';
import {compoundBrief,entityBrief,studyLayer} from './profileModel.js';
import './platform.css';
function Column({options,initial}){
 const reduced=useReducedMotion();
 const [selection,setSelection]=useState(initial),[result,setResult]=useState(null);
 const option=options.find(o=>o.id===selection);
 useEffect(()=>{
   if(!option)return;
   if(option.entity){setResult({id:selection,model:entityBrief(option.entity)});return;}
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
   fetch(`${API}/api/profile?topic=${encodeURIComponent(option.name)}&category=${encodeURIComponent(option.category||'supplement')}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Profile unavailable');return r.json();}).then(({profile:p})=>{if(controller.signal.aborted)return;setResult({id:selection,model:compoundBrief({analysis:p.analysis,name:p.name,tier:p.tier,bestTier:p.best_tier,outcomeDependent:p.outcome_dependent,generatedAt:p.generated_at,studyCount:p.study_count,outcomes:(p.claims||[]).map(c=>({outcome:c.outcome,tier:c.tier,studies:c.studies||[],directionStatus:c.direction_status,headlineEffect:c.headline_effect?{...c.headline_effect,ciLow:c.headline_effect.ci_low,ciHigh:c.headline_effect.ci_high,estimated:c.headline_effect.ci_estimated}:null}))})});}).catch(()=>{if(!controller.signal.aborted)setResult({id:selection,error:true});else if(!disposed)setResult({id:selection,error:true});}).finally(()=>clearTimeout(timeout));
   let disposed=false;return()=>{disposed=true;clearTimeout(timeout);controller.abort();};
 },[selection,option]);
 const model=result?.id===selection?result.model:null;
 return <section className="pc-column"><label>Choose a profile<select value={selection} onChange={e=>setSelection(e.target.value)}>{options.map(o=><option key={o.id} value={o.id}>{o.name} · {o.entity?o.entity.entity_type.replaceAll('_',' '):'intervention'}</option>)}</select></label><AnimatePresence mode="wait" initial={false}><motion.div key={model?selection:`loading-${selection}`} initial={{opacity:0,y:reduced?0:5}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduced?0:.18}}>{model?<><span className="pb-chip" data-grade={model.maturity}>{model.maturity}</span><h2>{model.name}</h2><p>{model.summary}</p><h3>Question & population</h3><p>{option.entity?.evidence_question||'What outcome-specific intervention evidence is available?'}</p><p>{option.entity?.population||'Population varies by outcome and study.'}</p><h3>Available source records</h3><p>{model.studies.length} linked records · {model.studies.filter(s=>studyLayer(s)==='interventional').length} classified human trials · {model.studies.filter(s=>studyLayer(s)==='synthesis').length} evidence syntheses</p><h3>Outcome-specific maturity</h3><ul>{model.analysis?model.analysis.outcomes.map(o=><li key={o.name}><strong>{o.name}</strong><br/>{o.grade_status==='refresh_required'?'Appraisal refresh needed':o.legacy_grade}<br/>{o.effects.length} eligible reported estimates from {o.quantified_sources} sources</li>):model.outcomes.map(o=><li key={o.key||o.name}><strong>{o.name}</strong><br/>{o.grade}<br/>{o.effect}</li>)}</ul><h3>Limits of interpretation</h3><p>{model.limitations[0]}</p><a href={option.entity?entityPath(option.entity):`/compound/${option.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`}>Open full evidence profile ↗</a></>:<p role="status">{result?.id===selection&&result.error?'This profile could not be loaded. Choose another profile or try again later.':'Loading source-backed profile…'}</p>}</motion.div></AnimatePresence></section>;
}
export default function Comparison(){
 const [compounds,setCompounds]=useState([]),[failed,setFailed]=useState(false);
 useEffect(()=>{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);fetch(`${API}/api/catalog`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>setCompounds((data.catalog||[]).filter(c=>c.name).map(c=>({id:`compound:${c.slug||c.name}`,name:c.name,category:c.category})))).catch(()=>setFailed(true)).finally(()=>clearTimeout(timeout));return()=>{clearTimeout(timeout);controller.abort();};},[]);
 const options=React.useMemo(()=>[...catalog.entities.map(e=>({id:e.id,name:e.name,entity:e})),...compounds],[compounds]);
 return <div className="profile-comparison"><p>Compare the questions, populations, source coverage, and limitations side by side. Grades from different frameworks are not interchangeable; this view does not rank treatments or tests.</p>{failed&&<p className="pb-note">The intervention catalog is unavailable. Local biomarker, test, and precision-medicine profiles remain available.</p>}<div className="pc-grid"><Column options={options} initial="apob"/><Column options={options} initial="ldl-c"/></div></div>;
}
