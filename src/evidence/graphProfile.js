// Pure view model for graph-backed biomarker profiles (/api/evidence/graph/entity/<id>).
// Nothing here computes a new statistic: values are formatted exactly as extracted.
export const LAYERS=['mechanism','preclinical','observational','interventional','guidelines'];
const LAYER_LABELS={mechanism:'Mechanism',preclinical:'Preclinical',observational:'Observational',interventional:'Interventional',guidelines:'Guidelines'};
export const layerLabel=layer=>LAYER_LABELS[layer]||layer;

export const KINDS=['classification','discrimination','prognosis','association','effect','utility','guideline'];
const KIND_LABELS={classification:'Classification accuracy',discrimination:'Discrimination',prognosis:'Prognosis',association:'Associations',effect:'Effect estimates',utility:'Clinical utility',guideline:'Guidelines',other:'Other reported findings'};
const KIND_NOTES={
  classification:'How often the marker labels people correctly at a stated cut-off. Accuracy alone does not show that testing improves outcomes.',
  discrimination:'How well the marker separates people with and without the target condition. Separation is not calibration, and not clinical utility.',
  prognosis:'How the marker relates to a later course such as survival or progression. A prognostic marker is not necessarily predictive of treatment benefit.',
  association:'The marker and a condition or measurement vary together. Association is not causation, discrimination or utility.',
  effect:'A between-group comparison reported with its confidence interval.',
  utility:'Whether using the marker changed decisions or patient outcomes.',
  guideline:'What a guideline or consensus statement says, as quoted.',
  other:'Findings recorded before finding kinds were typed.',
};
const MEASURES={hazard_ratio:'HR',odds_ratio:'OR',risk_ratio:'RR',rate_ratio:'Rate ratio',mean_difference:'Mean difference',standardized_mean_difference:'SMD',risk_difference:'Risk difference',correlation:'Correlation',auc:'AUC',c_index:'C-index',delta_c_index:'Δ C-index',sensitivity:'Sensitivity',specificity:'Specificity',ppv:'PPV',npv:'NPV',accuracy:'Accuracy',likelihood_ratio_positive:'LR+',likelihood_ratio_negative:'LR−',cutoff:'Cut-off',median:'Median',mean:'Mean',proportion:'Proportion',percent:'Percent',p_value:'P value',recommendation:'Recommendation',other:'Reported measure'};
const OPERATORS={lt:'<',le:'≤',gt:'>',ge:'≥',eq:'='};
const num=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:3});
const unitText=unit=>unit==='%'?'%':unit?` ${unit}`:'';

export function valueText(f){
  if(f.measure==='recommendation')return 'Recommendation';
  const label=MEASURES[f.measure]||'Reported measure';
  if(f.estimate==null&&f.p_value!=null)return `P ${OPERATORS[f.p_operator]||'='} ${num(f.p_value)}`;
  if(f.estimate==null)return label;
  let text=`${label} ${num(f.estimate)}${unitText(f.unit)}`;
  if(f.lower!=null&&f.upper!=null)text+=` (${f.level!=null?`${num(f.level)}% CI `:''}${num(f.lower)} to ${num(f.upper)})`;
  if(f.cutoff!=null&&f.measure!=='cutoff')text+=` at a cut-off of ${num(f.cutoff)}${unitText(f.cutoff_unit)}`;
  return text;
}

// The profile query returns one row per finding × passage × layer; keep one row per finding.
export function flatten(rows){
  const seen=new Map();
  for(const row of rows||[]){
    const f={...(row.finding||{}),quote:row.quote??null,pmid:row.pmid??null,title:row.title??null,year:row.year??null,layer:row.layer??null,study_id:row.study_id??null};
    if(f.id&&!seen.has(f.id))seen.set(f.id,f);
  }
  return [...seen.values()];
}

export function groupFindings(rows){
  const list=flatten(rows);
  return [...KINDS,'other'].map(kind=>({kind,label:KIND_LABELS[kind],note:KIND_NOTES[kind],rows:list.filter(f=>kind==='other'?!KINDS.includes(f.kind):f.kind===kind)})).filter(g=>g.rows.length);
}

// Figure only for grounded values on their native 0–1 scale; percentages are not converted.
export function aucStrip(rows){
  const points=flatten(rows).filter(f=>['auc','c_index'].includes(f.measure)&&f.quote&&f.unit!=='%'&&f.estimate!=null&&f.estimate>=0&&f.estimate<=1
    &&(f.lower==null||(f.lower>=0&&f.lower<=f.estimate))&&(f.upper==null||(f.upper<=1&&f.upper>=f.estimate)))
    .map(f=>({id:f.id,label:[f.target,f.pmid&&`PMID ${f.pmid}`].filter(Boolean).join(' · ')||'Reported value',estimate:f.estimate,lower:f.lower??null,upper:f.upper??null,measure:f.measure}));
  const low=Math.min(1,...points.map(p=>p.lower??p.estimate));
  return {points,domain:[low<0.5?0:0.5,1]};
}

export const CLASSIFICATION_COLUMNS=[['sensitivity','Sensitivity'],['specificity','Specificity'],['ppv','PPV'],['npv','NPV'],['likelihood_ratio_positive','LR+'],['likelihood_ratio_negative','LR−'],['accuracy','Accuracy']];
const cell=f=>f.estimate==null?null:`${num(f.estimate)}${f.unit==='%'?'%':''}${f.lower!=null&&f.upper!=null?` (${num(f.lower)}–${num(f.upper)})`:''}`;

// One row per study × target × cut-off × assay, so sensitivity and specificity from the same threshold sit together.
export function classificationRows(rows){
  const out=new Map();
  for(const f of flatten(rows).filter(f=>f.kind==='classification'&&f.quote)){
    if(!CLASSIFICATION_COLUMNS.some(([m])=>m===f.measure)||f.estimate==null)continue;
    const key=[f.study_id||f.pmid,f.target,f.cutoff,f.cutoff_unit,f.assay].join('|');
    const row=out.get(key)||{key,pmid:f.pmid,target:f.target,assay:f.assay,cutoff:f.cutoff==null?null:`${num(f.cutoff)}${unitText(f.cutoff_unit)}`,values:{}};
    row.values[f.measure]=cell(f);
    out.set(key,row);
  }
  const list=[...out.values()];
  return {rows:list,columns:CLASSIFICATION_COLUMNS.filter(([m])=>list.some(r=>r.values[m]!=null))};
}

const RELATIONS={ENCODED_BY:['Encoded by','Encodes'],VARIANT_OF:['Variant of','Has variant'],MEASURED_BY:['Measured by','Measures'],IN_PATHWAY:['In pathway','Pathway member']};
const REASONS={same_outcome:'Studied for the same outcome',same_population:'Studied in the same population',predicts:'Predicts',measures:'Measures',modifies_treatment:'Modifies treatment',same_gene:'Same gene',same_pathway:'Same pathway'};
export function relationLabel(r){
  if(r.edge==='RELATED_TO')return REASONS[r.reason]||'Related';
  const pair=RELATIONS[r.edge];
  return pair?pair[r.outgoing?0:1]:r.edge;
}

const REJECTIONS={
  rejected_missing_fields:'a measure was named, but its value or required fields were not in the passage',
  rejected_wrong_kind:'the measure did not fit the finding kind claimed',
  rejected_unsupported_passage:'the passage did not state the measure or kind claimed',
  rejected_invalid_interval:'the confidence interval was incomplete or reversed',
  rejected_out_of_range:'a value was outside its possible range',
  rejected_numeric_token:'a number could not be read exactly from the source',
  rejected_span_invalid:'the cited span did not exist in the source',
  no_observations_reported:'no biomarker finding with a reported value was found',
  rejected_other:'rejected by validation',
};
export function deadLetterText(d){
  const reasons=Object.entries(d.reasons||{}).filter(([,n])=>n>0);
  if(!reasons.length)return 'no typed finding passed validation';
  return reasons.map(([k,n])=>`${REJECTIONS[k]||k.replaceAll('_',' ')}${n>1?` (${n}×)`:''}`).join('; ');
}

// Graph entities the bundled catalog does not profile, filtered by the index search box and
// ordered so pages with typed findings come before GAP pages.
export function graphMatches(rows,query=''){
  const q=String(query||'').trim().toLowerCase();
  return (rows||[]).filter(e=>[e.name,e.category,...(e.aliases||[])].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>(b.coverage.quantified_outcomes-a.coverage.quantified_outcomes)||a.name.localeCompare(b.name));
}
