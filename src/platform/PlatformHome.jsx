import React,{useEffect,useState} from 'react';
import {EvidenceLayers} from './EvidenceLayers.jsx';
import {loadLibrary,onLibraryUpdate} from '../design/libraryStore.js';
import {bundledProfile,flatten,valueText,layerLabel,provenanceNote} from '../evidence/graphProfile.js';
import {readable,highlight} from '../evidence/Inspector.jsx';
import {contextLine} from '../evidence/FindingLedger.jsx';
import './home.css';

const DOMAINS=[
  ['Compounds & interventions','What has been studied, in whom, and with what result?','Supplements · medicines · nutrients · peptides','/research'],
  ['Biomarkers & lab markers','What does a measurement tell us — and what stays uncertain?','Association · prediction · clinical utility','/biomarkers'],
  ['Diagnostics & screening','Does finding something earlier improve outcomes?','Accuracy · absolute benefit · downstream harms','/tests'],
  ['Precision medicine','When does biological context change the evidence?','Cancer subtype · biomarker · treatment interaction','/precision-medicine'],
  ['Conditions & pathways','Follow one health question across kinds of evidence.','Metabolic · cardiovascular · cancer','/conditions'],
];
const EXAMPLES=['ApoB','HER2','creatine','colonoscopy screening','EGFR'];

function Counts(){
  const [data,setData]=useState(null),[failed,setFailed]=useState(false);
  useEffect(()=>{
    let live=true;
    loadLibrary().then(d=>{if(live)setData(d);}).catch(()=>{if(live)setFailed(true);});
    const stop=onLibraryUpdate(d=>{if(live)setData(d);});
    return()=>{live=false;stop();};
  },[]);
  if(failed)return <p className="c-note home-counts-note">The library could not be reached just now, so these counts are unavailable. Search still works once it answers.</p>;
  if(!data)return <div className="home-counts" aria-hidden="true">{[0,1,2,3].map(i=><span key={i} className="c-skel" style={{width:'86px',height:'15px'}}/>)}</div>;
  const counts=data.counts||{};
  return <>
    <dl className="home-counts">
      <div><dt>profiles</dt><dd className="c-num">{data.entries.length}</dd></div>
      {[['biomarker','biomarkers'],['intervention','compounds'],['precision_oncology','precision pairs'],['diagnostic','diagnostics']]
        .filter(([key])=>counts[key]).map(([key,label])=><div key={key}><dt>{label}</dt><dd className="c-num">{counts[key]}</dd></div>)}
    </dl>
    <p className="c-note home-counts-note">{data.coverage_statement}</p>
  </>;
}

// A real finding from a published profile, rendered with the parts the profile itself uses. Nothing
// here is illustrative: if the file does not load, the section does not appear. The chosen finding
// is not required to have an interval — most published abstracts do not report one, and a card that
// quietly demanded a tidy one would misrepresent what this library actually holds.
function WorkedExample(){
  const [state,setState]=useState(null);
  useEffect(()=>{
    let live=true;
    bundledProfile(['biomarker:il-18','biomarker:ca-125','biomarker:apob']).then(profile=>{
      if(!live||!profile)return;
      const rows=flatten(profile.findings).filter(f=>f.estimate!=null&&f.quote&&f.pmid);
      // The most informative row wins: one that names a population and a layer explains the most.
      const best=rows.map(f=>({f,score:(f.lower!=null?2:0)+(contextLine(f)?2:0)+(f.layer?1:0)}))
        .sort((a,b)=>b.score-a.score)[0];
      if(best)setState({entity:profile.entity,finding:best.f,at:profile.published_at});
    }).catch(()=>{});
    return()=>{live=false;};
  },[]);
  if(!state)return null;
  const {entity,finding,at}=state;
  const quote=readable(finding.quote);
  const interval=finding.lower!=null&&finding.upper!=null;
  return <figure className="home-example-card">
      <figcaption>One real finding, as its profile shows it</figcaption>
      <dl className="home-example-fields">
        <div><dt>Finding</dt><dd className="c-mono">{valueText(finding)}</dd></div>
        <div><dt>Population</dt><dd>{contextLine(finding)||'not stated'}</dd></div>
        <div><dt>Layer</dt><dd>{finding.layer?layerLabel(finding.layer):'not stated'}</dd></div>
        <div><dt>Provenance</dt><dd>{provenanceNote(finding)||'unclear'}</dd></div>
        <div><dt>Source</dt><dd>{finding.pmid?<a href={`https://pubmed.ncbi.nlm.nih.gov/${finding.pmid}/`} target="_blank" rel="noreferrer">PMID {finding.pmid}</a>:'no identifier'}{finding.year?` · ${finding.year}`:''}</dd></div>
      </dl>
      <blockquote className="c-quote">{highlight(quote,finding).map((part,i)=>part.mark?<mark key={i}>{part.text}</mark>:<React.Fragment key={i}>{part.text}</React.Fragment>)}</blockquote>
      <p className="c-note">
        {interval?'':'This abstract reported no interval, so none is shown — Clarity does not reconstruct one. '}
        Published copy from {String(at||'').slice(0,10)}, shown as stored: not computed, pooled or converted.
      </p>
      <p><a className="home-example-link" href={`/biomarkers/${String(entity.id).split(':').pop()}`}>Open the {entity.name} profile →</a></p>
    </figure>;
}

export default function PlatformHome(){
  const [query,setQuery]=useState('');
  const submit=e=>{
    e.preventDefault();
    const q=query.trim();
    window.location.href=q?`/explore?q=${encodeURIComponent(q)}`:'/explore';
  };
  return <main className="home" lang="en">
    <section className="home-open">
     <div className="home-open-text">
      <h1>Find out what the research reports, and what it does not.</h1>
      <p className="c-lede home-sub">Clarity reads biomedical papers into typed findings: an estimate, its interval, the population it was measured in, the layer of evidence it belongs to, and the passage it came from. Where nothing has been indexed, it says so instead of filling the gap.</p>

      <form className="home-search" onSubmit={submit} role="search">
        <label className="c-label" htmlFor="home-q">Search the library</label>
        <div className="home-search-row">
          <input id="home-q" className="c-field home-search-input" type="search" value={query}
            onChange={e=>setQuery(e.target.value)} placeholder="a marker, gene, compound or test"
            autoComplete="off" spellCheck="false"/>
          <button type="submit" className="c-btn c-btn--primary">Search</button>
        </div>
        <p className="home-examples">
          <span className="c-note">Try</span>
          {EXAMPLES.map(name=><a key={name} className="c-chip" href={`/explore?q=${encodeURIComponent(name)}`}>{name}</a>)}
        </p>
      </form>

      <Counts/>
     </div>
     <WorkedExample/>
    </section>

    <section className="home-layers" aria-labelledby="home-layers-h">
      <div className="home-layers-text">
        <h2 id="home-layers-h">A mechanism is a starting point. A clinical outcome is a different question.</h2>
        <p className="c-lede">Clarity keeps five layers apart rather than averaging them into a grade. More records on one layer do not make the question above it answered.</p>
      </div>
      <EvidenceLayers/>
    </section>

    <section className="home-domains" aria-labelledby="home-domains-h">
      <h2 id="home-domains-h">Start from the kind of question you have</h2>
      <ul>
        {DOMAINS.map(([title,question,detail,url])=><li key={url}>
          <a href={url}>
            <h3>{title}</h3>
            <p className="home-domain-q">{question}</p>
            <p className="home-domain-detail">{detail}</p>
          </a>
        </li>)}
      </ul>
    </section>

    <section className="home-close" aria-labelledby="home-close-h">
      <h2 id="home-close-h">What a profile will and will not tell you</h2>
      <div className="home-close-grid">
        <div><h3>It will</h3><ul>
          <li>Show every indexed estimate on one scale, with its interval and population.</li>
          <li>Keep association, discrimination, prognosis and utility as separate questions.</li>
          <li>Open the exact passage each number was read from.</li>
          <li>Name the rungs where nothing has been indexed.</li>
        </ul></div>
        <div><h3>It will not</h3><ul>
          <li>Pool estimates across studies or convert one measure into another.</li>
          <li>Rank compounds, or award a single quality score.</li>
          <li>Treat an automated reading as an expert appraisal.</li>
          <li>Give advice about you. Clarity reports research; it is not a clinical tool.</li>
        </ul></div>
      </div>
      <p><a className="c-btn" href="/learn">Learn to read health evidence</a> <a className="c-btn" href="/methodology">How Clarity decides what to publish</a></p>
    </section>
  </main>;
}
