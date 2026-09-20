import {EvidenceLayers,ResearchTools} from './EvidenceLayers.jsx';
import React,{useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import '../design/tokens.css';
import '../design/shell.css';
import './platform-home.css';

const domains=[
  ['01','Compounds & interventions','What has been studied, in whom, and with what result?','/research'],
  ['02','Biomarkers & lab markers','What does a measurement tell us—and what remains uncertain?','/biomarkers'],
  ['03','Diagnostics & screening','Does finding something earlier improve outcomes?','/tests'],
  ['04','Precision medicine','When does biological context change the evidence?','/precision-medicine'],
  ['05','Conditions & pathways','Follow a health question across different kinds of evidence.','/conditions'],
];

const demos=[
  {href:'/biomarkers/il-18',kicker:'Entity file',title:'IL-18',detail:'Cytokine · Q1–Q5 graph profile'},
  {href:'/explore/matcher',kicker:'Research question',title:'ApoB vs LDL-C',detail:'Incremental prediction · utility asked'},
  {href:'/biomarkers/kras',kicker:'Oncogene',title:'KRAS',detail:'Typed findings with intervals'},
];

const rungs=[
  ['What it is','Indexed'],
  ['Biology','Background'],
  ['Measurement','Partial'],
  ['What it indicates','Typed findings'],
  ['Does measuring help?','Not in library'],
];

export default function PlatformHome(){
  const [q,setQ]=useState('');
  const go=(event)=>{
    event.preventDefault();
    const text=q.trim();
    if(!text){window.location.href='/explore';return;}
    const ask=/[?]|(does|do|which|what|when|how)\b/i.test(text);
    window.location.href=ask?`/explore/matcher`:`/explore?q=${encodeURIComponent(text)}`;
  };
  return <main className="hp hp-instrument" lang="en">
    <section className="hp-hero">
      <div className="hp-copy">
        <p className="hp-eyebrow">Clarity · living evidence graph</p>
        <h1>Biomedical evidence,<br/><em>layered and current.</em></h1>
        <p className="hp-intro">A research instrument for compounds, biomarkers, tests, and precision signals. Association, discrimination, and clinical utility stay separate. Uncertainty stays on the page.</p>
        <form className="hp-omnisearch" action="/explore" method="get" onSubmit={go}>
          <label htmlFor="hp-q">Search an entity or ask a research question</label>
          <div className="hp-omnisearch-row">
            <input id="hp-q" name="q" value={q} onChange={e=>setQ(e.target.value)} placeholder="IL-18, KRAS, ApoB beyond LDL-C…" autoComplete="off"/>
            <button type="submit" className="hp-primary">Open in Clarity</button>
          </div>
          <p className="hp-caption">Entity names open the library. A question goes to Connect my research. Nothing here is a treatment recommendation.</p>
        </form>
        <div className="hp-actions">
          <a className="hp-primary" href="/explore">Explore the library <ArrowUpRight size={16}/></a>
          <a href="/explore/matcher">Connect my research <ArrowUpRight size={16}/></a>
        </div>
      </div>
      <aside className="hp-instrument-panel" aria-label="Product preview">
        <div className="hp-inst-head">
          <span className="hp-eyebrow">Live file · IL-18</span>
          <a href="/biomarkers/il-18">Open profile <ArrowUpRight size={14}/></a>
        </div>
        <h2>IL-18</h2>
        <p className="hp-inst-lead">IL-18 is a cytokine (IL-1 family protein). This preview uses the same five questions as the graph profile. Empty rungs stay empty.</p>
        <dl className="hp-inst-ids">
          <div><dt>HGNC</dt><dd>5986</dd></div>
          <div><dt>Ensembl</dt><dd>ENSG00000150782</dd></div>
          <div><dt>UniProt</dt><dd>Q14116</dd></div>
        </dl>
        <ol className="hp-rungs">
          {rungs.map(([label,state],i)=>
            <li key={label} data-state={state==='Not in library'?'gap':state==='Indexed'||state==='Typed findings'?'on':'soft'}>
              <em>Q{i+1}</em><strong>{label}</strong><span>{state}</span>
            </li>
          )}
        </ol>
        <p className="hp-inst-note">Fact · evidence · interpretation · gap are marked separately. Automated reading is not expert review.</p>
      </aside>
    </section>

    <section className="hp-demo-row" aria-label="Start from a real file">
      {demos.map(d=><a key={d.href} href={d.href} className="hp-demo">
        <span>{d.kicker}</span><strong>{d.title}</strong><p>{d.detail}</p>
      </a>)}
    </section>

    <ResearchTools/>

    <section className="hp-principle-band">
      <div>
        <p className="hp-eyebrow">One question. Distinct layers.</p>
        <h2>A mechanism is a starting point. A clinical outcome is a different question.</h2>
      </div>
      <EvidenceLayers/>
    </section>

    <section className="hp-domains">
      <div className="hp-section-title">
        <div>
          <p className="hp-eyebrow">Start with the question</p>
          <h2>Different questions. The right evidence for each.</h2>
        </div>
        <a href="/explore/compare">Compare profiles ↗</a>
      </div>
      {domains.map(([n,title,question,url])=>
        <a className="hp-domain" href={url} key={n}>
          <span className="hp-number">{n}</span>
          <div><h3>{title}</h3><p>{question}</p></div>
          <ArrowUpRight size={18}/>
        </a>
      )}
    </section>

    <section className="hp-editorial">
      <div>
        <p className="hp-eyebrow">Read the evidence, in context</p>
        <h2>More than a grade.</h2>
        <p>A profile should tell you what was measured, who was studied, how large the effect was, and what the data cannot establish.</p>
        <a href="/learn">Learn to read health evidence →</a>
      </div>
      <div>
        <h3>Traceable findings</h3>
        <p>Inspect study citations and available source passages. Unreported values stay unreported.</p>
        <h3>Visible uncertainty</h3>
        <p>Keep association, causation, accuracy, and clinical utility distinct. Intervals and source context stay visible beside every estimate.</p>
        <h3>Automated, source-bound updates</h3>
        <p>Eligible reported estimates pass automated source checks before publication. Source dates and exact passages remain attached to each release.</p>
      </div>
    </section>

    <section className="hp-closing">
      <span>Science first. Sources always.</span>
      <div>
        <a href="/research">Intervention catalog</a>
        <a href="/explore">All domains</a>
        <a href="/methodology">Methodology</a>
        <a href="/explore/matcher">Connect my research</a>
      </div>
    </section>
  </main>;
}
