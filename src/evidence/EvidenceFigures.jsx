import {motion, AnimatePresence, useReducedMotion} from 'framer-motion';
import React, {useState} from 'react';
import {ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine} from 'recharts';
import {plotScale} from '../platform/analysisModel.js';
import {EXAMPLE_FIGURES, FIGURE_TYPES, validateFigure, rocArea} from './figures.js';

const axisColor='#a2b0c7';
export function EvidenceFigure({figure}) {
  let valid;
  try {valid=validateFigure(figure);} catch {return <p role="status">This figure cannot be displayed because its data or provenance is incomplete.</p>;}
  const matrix=['correlation','response_matrix'].includes(valid.type);
  const forest=valid.type==='forest';
  const keys=Object.keys(valid.rows[0]);
  const columns=matrix?[...new Set(valid.rows.map(r=>r.column))]:[];
  const rows=matrix?[...new Set(valid.rows.map(r=>r.row))]:[];
  const bounded=['roc','calibration','kaplan_meier','risk_curve'].includes(valid.type);
  const forestScale=forest?plotScale(valid.rows.map(r=>({...r,metric:valid.measure}))):null;
  const scale=x=>180+(forestScale.x(x)-190)/490*410;
  const nullValue=forestScale?.nullValue;
  const chart=valid.type==='distribution'?'bar':'line';
  const Chart=chart==='bar'?BarChart:LineChart;
  return <figure className="ev-science-figure">
    <h3>{valid.title}</h3>
    {valid.illustrative&&<span className="ev-badge">SYNTHETIC TEACHING DATA</span>}
    <p>{valid.caption}</p>
    {matrix?<div className="ev-table-wrap"><table><caption>{valid.y_label} by {valid.x_label}</caption><thead><tr><th scope="col">{valid.y_label}</th>{columns.map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row}><th scope="row">{row}</th>{columns.map(column=>{const value=valid.rows.find(r=>r.row===row&&r.column===column)?.value;return <td key={column} style={{background:typeof value==='number'?`rgba(52,224,190,${Math.abs(value)*.25})`:undefined}}>{value==null?'Not reported':valid.type==='correlation'?value:`${(value*100).toFixed(1)}%`}</td>;})}</tr>)}</tbody></table></div>:forest?<div className="ev-forest" role="img" aria-label={valid.rows.map(r=>`${r.label}: ${r.estimate}, interval ${r.lower} to ${r.upper}`).join('; ')}>
      <svg role="img" aria-label={valid.title} viewBox={`0 0 650 ${valid.rows.length*58+50}`}>
        <line x1={scale(nullValue)} x2={scale(nullValue)} y1="8" y2={valid.rows.length*58} stroke="#a2b0c7" strokeDasharray="4 4"/>
        {valid.rows.map((r,i)=>{return <g key={r.label}><text x="5" y={i*58+30} fill="#c3d0df" fontSize="13">{r.label}</text><line x1={scale(r.lower)} x2={scale(r.upper)} y1={i*58+25} y2={i*58+25} stroke="#34e0be" strokeWidth="2"/><circle cx={scale(r.estimate)} cy={i*58+25} r="5" fill="#34e0be"/></g>;})}
        <text x={scale(nullValue)} textAnchor="middle" y={valid.rows.length*58+30} fill="#a2b0c7" fontSize="12">{nullValue} (no difference)</text>
      </svg><p className="ev-note">{valid.x_label} · {forestScale.ratio?"Logarithmic":"Linear"} scale. Each interval is a separate reported estimate; no pooled effect is calculated.</p>
    </div>:<div className="ev-chart" role="img" aria-label={`${valid.title}. ${valid.rows.length} data points; exact values in the table below.`}>
      <ResponsiveContainer width="100%" height={310}><Chart data={valid.rows} margin={{top:22,right:25,bottom:32,left:5}}><CartesianGrid stroke="#273347" strokeDasharray="3 3"/><XAxis dataKey="x" type="number" domain={['roc','calibration'].includes(valid.type)?[0,1]:['dataMin','dataMax']} stroke={axisColor} label={{value:valid.x_label,position:'bottom',fill:axisColor,fontSize:11}}/><YAxis domain={bounded?[0,1]:[0,'auto']} stroke={axisColor}/><Tooltip contentStyle={{background:'#141a26',border:'1px solid #334259'}}/>{['roc','calibration'].includes(valid.type)&&<ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="#a2b0c7" strokeDasharray="4 4"/>}{chart==='bar'?<Bar dataKey="y" name={valid.y_label} fill="#34e0be" isAnimationActive={false}/>:<Line dataKey="y" name={valid.y_label} type={valid.type==='kaplan_meier'?'stepAfter':'linear'} stroke="#34e0be" strokeWidth={2} dot={valid.type!=='kaplan_meier'} isAnimationActive={false}/>}</Chart></ResponsiveContainer>
    </div>}
    {valid.type==='roc'&&<p>Trapezoidal AUC: {rocArea(valid.rows)?.toFixed(3)??'Cannot calculate without a complete curve'}</p>}
    {!matrix&&<details><summary>View exact values</summary><div className="ev-table-wrap"><table><caption>{valid.title}: source values</caption><thead><tr>{keys.map(key=><th key={key} scope="col">{key==='x'?valid.x_label:key==='y'?valid.y_label:key}</th>)}</tr></thead><tbody>{valid.rows.map((r,i)=><tr key={i}>{keys.map(key=><td key={key}>{String(r[key])}</td>)}</tr>)}</tbody></table></div></details>}
    <figcaption>{valid.illustrative?'Illustration only; these values do not describe a patient, test, or clinical study.':<a href={valid.source_url} target="_blank" rel="noreferrer">Source: {valid.source_title||'View publication'} ↗</a>}</figcaption>
  </figure>;
}
export default function VisualizationWorkbench({types=Object.keys(FIGURE_TYPES), title="Scientific visualization studio"}) {
  const reduced=useReducedMotion();
  const [type,setType]=useState(types[0]);
  return <section className="ev-panel">
    <h2>{title}</h2>
    <p>Learn how to read the graphics behind biomarker, diagnostic, and precision-medicine evidence. All examples here are synthetic and labeled as teaching data.</p>
    <label htmlFor="figure-type">Choose a scientific graphic<select id="figure-type" name="figure-type" value={type} onChange={e=>setType(e.target.value)}>{Object.entries(FIGURE_TYPES).filter(([key])=>types.includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <AnimatePresence mode="wait" initial={false}><motion.div key={type} initial={{opacity:0,y:reduced?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-6}} transition={{duration:reduced?0:.2}}><EvidenceFigure figure={EXAMPLE_FIGURES.find(f=>f.type===type)}/></motion.div></AnimatePresence>
  </section>;
}
