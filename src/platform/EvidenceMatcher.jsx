import React,{useEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {API_BASE} from './api.js';
import {safeSource} from './profileModel.js';
import './platform.css';
import CopilotResults from './CopilotResults.jsx';
import TabularImport from './TabularImport.jsx';
import {researchInputError} from './tabular.js';
const example='We are studying apolipoprotein B (ApoB), LDL cholesterol and HbA1c in adults, focusing on cardiovascular events and how biomarker associations differ from clinical utility.';
export default function EvidenceMatcher(){
 const [text,setText]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef(null),heading=useRef(null),reduce=useReducedMotion();
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function submit(e){e.preventDefault();const problem=researchInputError(text);if(problem){setError(problem);return;}controller.current?.abort();const c=new AbortController();controller.current=c;setBusy(true);setError('');setResult(null);const timeout=setTimeout(()=>c.abort(),30000);
  try{const response=await fetch(`${API_BASE}/api/evidence/match`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:c.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'Matching is unavailable.');if(controller.current===c){setResult(data);requestAnimationFrame(()=>heading.current?.focus());}}
  catch(err){if(controller.current===c)setError(err.name==='AbortError'?'The library took too long to respond. Your text is still here; try again.':err.message);}
  finally{clearTimeout(timeout);if(controller.current===c)setBusy(false);}
 }
 return <section className="knowledge-page"><header><p className="hp-eyebrow">RESEARCH SUPPORT / EVIDENCE MATCHER</p><h2>Connect your research.</h2><p>Find where your question intersects with Clarity’s entities and source records. Paste study text or map an aggregate CSV/TSV table into searchable research concepts.</p></header><TabularImport onUse={value=>{controller.current?.abort();controller.current=null;setBusy(false);setText(value);setResult(null);setError('');document.getElementById('research-text')?.focus();}}/><form action={`${API_BASE}/api/evidence/match`} method="post" onSubmit={submit}><label htmlFor="research-text">Research text (required)</label><p id="research-help" className="pb-note">20–12,000 characters. Submitted to Clarity for library retrieval; not saved or sent to a model provider. Use research descriptions without patient identifiers. This tool does not analyze personal health.</p><textarea id="research-text" name="text" required minLength={20} maxLength={12000} value={text} onChange={e=>{controller.current?.abort();controller.current=null;setBusy(false);setText(e.target.value);setResult(null);setError('');}} aria-describedby="research-help"/><p className="pb-note">{text.length.toLocaleString()} / 12,000 characters</p><div className="knowledge-actions"><button type="submit" disabled={busy}>{busy?'Mapping your research question…':'Build research landscape'}</button><button type="button" onClick={()=>{setText(example);setResult(null);setError('');}} disabled={busy}>Try a biomarker example</button><button type="button" onClick={()=>{controller.current?.abort();controller.current=null;setBusy(false);setText('');setResult(null);setError('');}}>Clear</button></div></form>{error&&<p role="alert">{error}</p>}
 {result&&<motion.div initial={{opacity:0,y:reduce?0:8}} animate={{opacity:1,y:0}} transition={{duration:reduce?0:.2}}><CopilotResults key={result.feedback_token||text} result={result} heading={heading}/></motion.div>}
 {!result&&<section className="knowledge-grid"><article><h3>Retrieve, then appraise</h3><p>Matching identifies candidate connections. Original sources, evidence layers and limitations remain visible.</p></article><article><h3>Built for research questions</h3><p>Biomarker aliases and related biomedical terms broaden retrieval. A match does not establish causality or a treatment recommendation.</p></article></section>}</section>;
}
