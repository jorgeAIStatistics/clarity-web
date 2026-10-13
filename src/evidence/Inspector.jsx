import React,{useEffect,useRef} from 'react';
import {valueText,layerLabel,provenanceNote} from './graphProfile.js';
import {contextLine} from './FindingLedger.jsx';

const REVIEW={reviewed:'Reviewed',partially_reviewed:'Partially reviewed'};
const reviewText=f=>REVIEW[f.review_state]||'Automated reading — not expert-reviewed';

// The reported numbers inside the passage, marked so the eye lands on the sentence the estimate was
// read from. Only the figures this finding actually carries are marked; nothing else is highlighted.
export function highlight(quote,finding){
  if(!quote)return [{text:''}];
  const numbers=[finding.estimate,finding.lower,finding.upper,finding.cutoff]
    .filter(v=>v!=null&&Number.isFinite(Number(v)))
    .map(v=>String(Number(v)))
    .filter(v=>v.length>1);
  if(!numbers.length)return [{text:quote}];
  const escaped=numbers.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const pattern=new RegExp(`(${escaped.join('|')})`,'g');
  return quote.split(pattern).filter(part=>part!=='').map(part=>numbers.includes(part)?{text:part,mark:true}:{text:part});
}

// Abstracts arrive with their section headers glued to the following sentence — "…both).ConclusionHER2
// expression…". The text is stored exactly as read; this only re-inserts the break for display.
const SECTIONS='Background|Objective|Objectives|Aim|Aims|Introduction|Methods|Method|Materials and Methods|Results|Result|Findings|Conclusion|Conclusions|Discussion|Interpretation|Purpose|Significance';
export function readable(quote){
  if(!quote)return '';
  return String(quote)
    .replace(new RegExp(`([.)\\]])\\s*(${SECTIONS})(?=[A-Z(])`,'g'),'$1 — $2: ')
    .replace(new RegExp(`(^|\\s)(${SECTIONS}):?\\s*(?=[A-Z(])`,'g'),'$1$2: ')
    .replace(/\s{2,}/g,' ')
    .trim();
}

export default function Inspector({finding,onClose,entityName}){
  const panel=useRef(null),heading=useRef(null);
  useEffect(()=>{
    if(!finding)return undefined;
    const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}};
    document.addEventListener('keydown',onKey);
    // Focus moves to the panel so the next Tab is inside it and a screen reader announces the change.
    heading.current?.focus({preventScroll:true});
    return()=>document.removeEventListener('keydown',onKey);
  },[finding,onClose]);

  if(!finding)return <aside className="insp insp--empty" aria-label="Source inspector">
    <p className="c-note">Select a source on any finding to read the passage it was taken from. The page keeps its place.</p>
  </aside>;

  const context=contextLine(finding),prov=provenanceNote(finding),cited=(finding.provenance||'')==='cited';
  const quote=readable(finding.quote);
  return <aside className="insp" ref={panel} aria-label="Source inspector">
    <div className="insp-bar">
      <h3 ref={heading} tabIndex={-1}>Source passage</h3>
      <button type="button" className="c-btn c-btn--quiet c-btn--sm" onClick={onClose}>Close</button>
    </div>
    <div className="insp-body">
      <p className="insp-title">{finding.title||'Title not stored for this source'}</p>
      <dl className="insp-meta">
        <div><dt>Source</dt><dd>{finding.pmid
          ? <a href={`https://pubmed.ncbi.nlm.nih.gov/${finding.pmid}/`} target="_blank" rel="noreferrer">PMID {finding.pmid}</a>
          : 'No identifier stored'}{finding.year?` · ${finding.year}`:''}</dd></div>
        {finding.layer&&<div><dt>Layer</dt><dd>{layerLabel(finding.layer)}</dd></div>}
        <div><dt>Reading</dt><dd>{reviewText(finding)}</dd></div>
      </dl>

      <p className="insp-section">What the source reports</p>
      {quote
        ? <blockquote className="c-quote">{highlight(quote,finding).map((part,i)=>part.mark?<mark key={i}>{part.text}</mark>:<React.Fragment key={i}>{part.text}</React.Fragment>)}</blockquote>
        : <p className="c-note">No passage is stored for this finding. The estimate was recorded without the sentence it came from.</p>}

      <p className="insp-section">What Clarity read from it</p>
      <dl className="insp-meta">
        <div><dt>Finding</dt><dd className="c-mono">{valueText(finding)}</dd></div>
        {context&&<div><dt>Population</dt><dd>{context}</dd></div>}
        {finding.assay&&<div><dt>Assay</dt><dd>{finding.assay}</dd></div>}
        <div><dt>Provenance</dt><dd>{prov||'unclear — the sentence does not say whose result this is'}</dd></div>
      </dl>

      {cited
        ? <div className="c-notice" data-tone="caution">This paper repeated a number from work it cited. It is not {entityName||'this entity'} evidence from this study and counts toward nothing on this page — it is shown only so the passage is not hidden.</div>
        : <p className="c-note">The passage is shown as stored. Clarity did not compute, pool or convert the value.</p>}
    </div>
  </aside>;
}
