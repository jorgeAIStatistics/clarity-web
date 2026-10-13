import React from 'react';
import {valueText,layerLabel,provenanceNote} from './graphProfile.js';
import {splitByFamily,markFor,markDescription,FAMILIES} from './findingScale.js';

const MEASURE_SHORT={hazard_ratio:'HR',odds_ratio:'OR',risk_ratio:'RR',rate_ratio:'Rate ratio',mean_difference:'Mean difference',
  standardized_mean_difference:'SMD',risk_difference:'Risk difference',delta_c_index:'Δ C-index',correlation:'Correlation',auc:'AUC',
  c_index:'C-index',sensitivity:'Sensitivity',specificity:'Specificity',ppv:'PPV',npv:'NPV',accuracy:'Accuracy',
  likelihood_ratio_positive:'LR+',likelihood_ratio_negative:'LR−'};

const num=v=>{const n=Number(v);return Number.isFinite(n)?String(Number(n.toFixed(2))):String(v??'');};
const tick=v=>Number.isFinite(Number(v))?String(Number(Number(v).toFixed(2))):String(v);

// The population a finding belongs to, said once. The stored fields repeat each other often enough
// that printing them all reads as three populations where there is one.
export function contextLine(f){
  const parts=[];
  if(f.target)parts.push(f.target);
  for(const value of [f.population,f.setting,f.comparator]){
    const text=(value||'').trim();
    if(!text)continue;
    const seen=parts.some(p=>p.toLowerCase()===text.toLowerCase()||p.toLowerCase().includes(text.toLowerCase())||text.toLowerCase().includes(p.toLowerCase()));
    if(!seen)parts.push(text);
  }
  return parts.join(' · ');
}

// The axis belongs in the plot column, not under the whole table: a strip beneath the table would
// be measured against the table's width and would not line up with the marks it labels.
function Axis({scale}){
  if(!scale)return null;
  return <span className="fl-axis" aria-hidden="true">
    {scale.ticks.map(t=>{
      const x=scale.project(t);
      return x==null?null:<i key={t} style={{left:`${x*100}%`}} data-null={scale.nullValue!=null&&t===scale.nullValue||undefined}>{tick(t)}</i>;
    })}
  </span>;
}

function Mark({f,scale}){
  const mark=markFor(f,scale);
  if(!mark)return <td className="fl-plot"/>;
  const pct=v=>`${(v*100).toFixed(2)}%`;
  return <td className="fl-plot">
    <span className="fl-track">
      {scale.nullAt!=null&&<i className="fl-null" style={{left:pct(scale.nullAt)}}/>}
      {mark.hasInterval&&<i className="fl-ci" style={{left:pct(mark.x1),width:pct(Math.max(mark.x2-mark.x1,0.004))}}
        data-clipped-low={mark.clippedLow||undefined} data-clipped-high={mark.clippedHigh||undefined}/>}
      <i className="fl-point" style={{left:pct(mark.x)}} data-open={mark.crossesNull||undefined} data-bare={!mark.hasInterval||undefined}/>
    </span>
  </td>;
}

function Row({f,scale,onInspect,active}){
  const measure=MEASURE_SHORT[f.measure]||null;
  const description=scale?markDescription(f,scale,measure||f.measure):null;
  const context=contextLine(f);
  const prov=provenanceNote(f);
  const cited=(f.provenance||'')==='cited';
  const interval=f.lower!=null&&f.upper!=null;
  return <tr data-cited={cited||undefined} data-active={active||undefined}>
    <td className="fl-kind">{f.kindLabel}{f.layer&&<small>{layerLabel(f.layer)}</small>}</td>
    <td className="fl-est">
      <span className={measure&&f.estimate!=null?'c-num':'c-mono'}>{measure&&f.estimate!=null?`${measure} ${num(f.estimate)}`:valueText(f)}</span>
      {measure&&f.estimate!=null&&(interval
        ? <small className="c-num">{f.level!=null?`${num(f.level)}% CI `:''}{num(f.lower)} – {num(f.upper)}</small>
        : <small className="fl-missing">interval not reported</small>)}
      {description&&<span className="c-sr">{description}</span>}
    </td>
    {scale?<Mark f={f} scale={scale}/>:<td className="fl-plot"/>}
    <td className="fl-context">{context||<span className="fl-missing">population not stated</span>}</td>
    <td className="fl-prov">{prov?<span data-cited={cited||undefined}>{prov}</span>:<span className="fl-missing">provenance unclear</span>}</td>
    <td className="fl-source">
      <button type="button" className="fl-inspect" onClick={()=>onInspect(f)} aria-expanded={Boolean(active)}>
        {f.pmid?<>PMID {f.pmid}</>:'Source'}
      </button>
    </td>
  </tr>;
}

const Head=({scale})=><thead><tr>
  <th scope="col">Kind / layer</th><th scope="col">Estimate</th>
  <th scope="col" className="fl-plot-head"><span className="fl-plot-label">Interval</span><Axis scale={scale}/></th>
  <th scope="col">Population</th><th scope="col">Provenance</th><th scope="col">Source</th>
</tr></thead>;

/* One ledger per entity. Rows are grouped by the axis they belong on; nothing is pooled, converted
   or ranked. The ledger replaces a stack of cards because seven findings only answer "do these
   agree?" when they are aligned on one scale. */
export default function FindingLedger({rows,onInspect,activeId,caption}){
  if(!rows||!rows.length)return null;
  const {blocks,unscaled}=splitByFamily(rows);
  return <div className="fl">
    {blocks.map(block=>{
      const family=FAMILIES[block.family];
      return <section className="fl-block" key={block.family}>
        <div className="fl-block-head">
          <h3>{block.rows.length} on a {family.label} scale</h3>
          {block.scale&&<p className="c-note">
            {family.lower&&family.higher&&block.scale.nullValue!=null
              ? <>Left of {tick(block.scale.nullValue)} is {family.lower}; right is {family.higher}. A hollow marker means the interval crosses {tick(block.scale.nullValue)} — that is not proof of no effect.</>
              : <>Each mark is one study's own estimate. Nothing is pooled.</>}
          </p>}
        </div>
        <div className="c-table-wrap">
          <table className="c-table fl-table">
            {caption&&<caption className="c-sr">{caption}</caption>}
            <Head scale={block.scale}/>
            <tbody>{block.rows.map(f=><Row key={f.id} f={f} scale={block.scale} onInspect={onInspect} active={activeId===f.id}/>)}</tbody>
          </table>
        </div>
      </section>;
    })}
    {unscaled.length>0&&<section className="fl-block">
      <div className="fl-block-head">
        <h3>{unscaled.length} reported without a comparable scale</h3>
        <p className="c-note">A cut-off, a median or a bare p-value has no axis to sit on. The reported value is shown as stored.</p>
      </div>
      <div className="c-table-wrap">
        <table className="c-table fl-table">
          <thead><tr><th scope="col">Kind / layer</th><th scope="col">Reported</th><th scope="col">Population</th><th scope="col">Provenance</th><th scope="col">Source</th></tr></thead>
          <tbody>{unscaled.map(f=>{
            const prov=provenanceNote(f),context=contextLine(f);
            return <tr key={f.id} data-cited={(f.provenance||'')==='cited'||undefined} data-active={activeId===f.id||undefined}>
              <td className="fl-kind">{f.kindLabel}{f.layer&&<small>{layerLabel(f.layer)}</small>}</td>
              <td className="fl-est"><span className="c-mono">{valueText(f)}</span></td>
              <td className="fl-context">{context||<span className="fl-missing">population not stated</span>}</td>
              <td className="fl-prov">{prov||<span className="fl-missing">provenance unclear</span>}</td>
              <td className="fl-source"><button type="button" className="fl-inspect" onClick={()=>onInspect(f)} aria-expanded={activeId===f.id}>{f.pmid?`PMID ${f.pmid}`:'Source'}</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>}
  </div>;
}
