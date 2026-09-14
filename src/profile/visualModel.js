export const LAYER_LABELS = {mechanism:'Biology',preclinical:'Animal',observational:'Observational',interventional:'Controlled trials',synthesis:'Published syntheses',guidelines:'Guidance',protocol:'Protocols',unclassified:'Source records'};
export function validRecord(r) {
  if(!r || r.method!=='visual-evidence-v1' || !r.hash || !r.sourceHash || !/^\d+$/.test(r.pmid) || r.url!==`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`)return false;
  if(!r.quote || !r.context?.population || !r.context?.exposure || !r.context?.comparator)return false;
  if(!Number.isInteger(r.span?.start)||!Number.isInteger(r.span?.end)||r.span.start<0||r.span.end<=r.span.start||Array.from(r.sourceText||'').slice(r.span.start,r.span.end).join('')!==r.quote)return false;
  if(!Number.isFinite(r.point)||!['linear','log'].includes(r.scale))return false;
  if(r.scale==='log'&&r.point<=0)return false;
  if(r.lower==null&&r.upper==null)return true;
  return [r.lower,r.upper,r.intervalLevel].every(Number.isFinite)&&r.lower<=r.point&&r.point<=r.upper&&r.intervalLevel>0&&r.intervalLevel<100&&(r.scale!=='log'||r.lower>0);
}
export function prepareReport(report, model) {
  const records=(report?.records||[]).filter(validRecord);
  const known=new Map((report?.studies||[]).map(s=>[String(s.id).replace('pmid:',''),s]));
  for(const s of model?.studies||[]){const id=String(s.pmid||s.id||'').replace('pmid:','');if(id&&!known.has(id))known.set(id,{...s,id,layer:'unclassified'});}
  return {...report,id:report?.id||model?.targetId,name:model?.name||report?.name,records,studies:[...known.values()]};
}
export function options(records,key){return [...new Set(records.map(r=>r[key]).filter(Boolean))];}
export function rowsFor(report,{outcome,mode,layer='all',population='all',cohort='all'}) {
  return report.records.filter(r=>(!outcome||r.outcome===outcome)&&(!mode||r.mode===mode)&&(layer==='all'||r.layer===layer)&&(population==='all'||r.context.population===population)&&(cohort==='all'||r.cohort===cohort));
}
export function panelsFor(rows) {
  const panels=new Map();
  for(const r of rows){const key=[r.metric,r.scale,r.mode].join('|');if(!panels.has(key))panels.set(key,[]);panels.get(key).push(r);}
  return [...panels].map(([key,records])=>({key,records,metric:records[0].metric,scale:records[0].scale,nullValue:records[0].nullValue}));
}
export function axisFor(rows,scale='linear',nullValue=null) {
  const transform=scale==='log'?Math.log:x=>x,inverse=scale==='log'?Math.exp:x=>x;
  const values=rows.flatMap(r=>[r.point,r.lower,r.upper]).filter(Number.isFinite);
  if(nullValue!=null)values.push(nullValue);
  let lo=Math.min(...values.map(transform)),hi=Math.max(...values.map(transform));
  if(!Number.isFinite(lo)||!Number.isFinite(hi)){lo=0;hi=1;}
  const pad=(hi-lo||Math.max(Math.abs(lo),.1))*.12;lo-=pad;hi+=pad;
  if(scale==='linear'&&rows.length&&rows.every(r=>['Sensitivity','Specificity','Partial η²'].includes(r.metric))){lo=Math.max(0,lo);hi=Math.min(rows[0].unit==='percent'?100:1,hi);}
  return {x:v=>240+(transform(v)-lo)/(hi-lo)*590,ticks:Array.from({length:5},(_,i)=>inverse(lo+(hi-lo)*i/4))};
}
export const format=v=>Number.isFinite(v)?Number(v.toPrecision(4)).toLocaleString(undefined,{maximumFractionDigits:5}):'';
export const intervalLabel=r=>r.lower!=null?`${r.intervalLevel}% CI ${format(r.lower)}–${format(r.upper)}`:'Point estimate · interval unreported';
export function compatibility(rows){return new Set(rows.map(r=>r.compatibilityKey)).size===1&&rows.length>0;}
export function exportSnapshot(report,selection){return {schema:'clarity-visual-export-v1',exportedAt:new Date().toISOString(),selection,report};}
