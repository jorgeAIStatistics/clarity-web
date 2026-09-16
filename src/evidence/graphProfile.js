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

// ---- What the object is, and what its findings license --------------------
const OBJECT_KINDS={
  Biomarker:['Biomarker','A quantity measured in a sample or image. What it means depends on the assay, the units and the population it was measured in.'],
  Gene:['Gene','A gene as a unit of sequence. Findings about a gene are not findings about one of its variants, and not about protein or RNA levels.'],
  Variant:['Variant','A specific sequence change. Evidence for one variant does not carry to the gene as a whole, or to another variant in it.'],
  Protein:['Protein','A protein product. Protein level, transcript level and gene status are different measurements and are not interchangeable.'],
  Test:['Test','A test or procedure as it is performed, including its threshold and reference standard.'],
  Assay:['Assay','A specific measurement method. Values from different assays are often not comparable without calibration.'],
  PrecisionContext:['Precision context','A marker, a treatment and a condition considered together; evidence here belongs to that combination, not to any part alone.'],
  Condition:['Condition','A disease or state that findings are reported for.'],
  Metabolite:['Metabolite','A small molecule measured in a sample.'],
  Pathway:['Pathway','A set of interacting molecules; pathway membership is not evidence about any single member.'],
};
export function objectKind(entity={}){
  const [label,text]=OBJECT_KINDS[entity.kind]||OBJECT_KINDS[{biomarker:'Biomarker',gene:'Gene',variant:'Variant',protein:'Protein',test:'Test',assay:'Assay',precision_context:'PrecisionContext',condition:'Condition',metabolite:'Metabolite',pathway:'Pathway'}[entity.type]]||['Entity','An entity in the evidence graph.'];
  return {label,text};
}
const MAY={
  classification:'Compare its reported accuracy at the stated cut-off, assay and reference standard against another test studied the same way.',
  discrimination:'Compare how well models using it rank people, on the study’s own cohort and outcome.',
  prognosis:'Describe how it relates to a later course such as survival or progression, in the population studied.',
  association:'Describe how it varies with a condition or another measurement, in the population studied.',
  effect:'Read a between-group comparison with its interval, for the contrast the study actually made.',
  utility:'Point to evidence that using it changed a decision or an outcome — the only kind here that speaks to clinical value.',
  guideline:'Quote what a named guideline or consensus statement says, with its date and scope.',
};
const MUST_NOT={
  classification:'Do not carry a cut-off to another assay, sample type or population; accuracy is not evidence that testing improves outcomes.',
  discrimination:'Do not read a higher AUC or C-index as better care: discrimination is not calibration and not a decision.',
  prognosis:'Do not read a prognostic association as a prediction of who benefits from treatment; that needs a treatment-by-marker interaction.',
  association:'Do not read association as causation, or as evidence that changing the marker changes the outcome.',
  effect:'Do not transfer an effect measured in one contrast, dose or population to another.',
  guideline:'Do not treat a quoted recommendation as current: check the guideline’s own date and scope.',
};
const IDENTITY_LIMITS={
  Gene:'Do not mix gene-level findings with findings about a specific variant, or with protein or expression levels.',
  Variant:'Do not generalize this variant to the whole gene, or to other variants in it.',
  Protein:'Do not read protein-level findings as gene or transcript findings.',
};

// Uses are derived only from the finding kinds actually indexed; with no findings, nothing is licensed.
export function usageNotes(entity={},rows=[]){
  const kinds=[...new Set(flatten(rows).map(f=>f.kind).filter(Boolean))];
  const order=k=>KINDS.indexOf(k);
  const present=kinds.filter(k=>MAY[k]).sort((a,b)=>order(a)-order(b));
  const may=present.map(k=>({kind:k,text:MAY[k]}));
  const mustNot=present.filter(k=>MUST_NOT[k]).map(k=>({kind:k,text:MUST_NOT[k]}));
  if(present.length&&!present.includes('utility'))mustNot.unshift({kind:'utility',text:`Nothing indexed here shows that measuring ${entity.name||'this marker'} changes decisions or outcomes; no clinical-utility finding is recorded.`});
  const identity=IDENTITY_LIMITS[entity.kind];
  if(identity)mustNot.push({kind:'identity',text:identity});
  return {may,mustNot,empty:!present.length};
}

// ---- Export ---------------------------------------------------------------
export const EXPORT_COLUMNS=['entity_id','entity_name','finding_id','kind','measure','estimate','lower','upper','interval_level','unit','cutoff','cutoff_unit','assay','target','population','setting','comparator','p_value','p_operator','layer','review_state','pmid','year','title','quote'];
const csvCell=v=>{const t=v==null?'':String(v);return /[",\n]/.test(t)?`"${t.replaceAll('"','""')}"`:t;};
export function findingsCsv(entity={},rows=[]){
  const lines=[EXPORT_COLUMNS.join(',')];
  for(const f of flatten(rows)){
    lines.push([entity.id,entity.name,f.id,f.kind,f.measure,f.estimate,f.lower,f.upper,f.level,f.unit,f.cutoff,f.cutoff_unit,f.assay,f.target,f.population,f.setting,f.comparator,f.p_value,f.p_operator,f.layer,f.review_state,f.pmid,f.year,f.title,f.quote].map(csvCell).join(','));
  }
  return lines.join('\n')+'\n';
}
export function findingsJson(entity={},rows=[],layers=[]){
  return JSON.stringify({version:'clarity-graph-findings-v1',exported_at:new Date().toISOString(),entity,layers,findings:flatten(rows)},null,2);
}

// Which graph id prefixes an index route may resolve. A biomarker URL never resolves a test.
export const ROUTE_PREFIXES={biomarker:['biomarker','variant','gene','protein','metabolite'],diagnostic:['test','assay'],screening:['test','assay'],precision_oncology:['precision_context']};
export const ROUTE_TYPES={biomarkers:['biomarker'],diagnostics:['diagnostic'],screening:['screening'],tests:['diagnostic','screening'],'precision-medicine':['precision_oncology']};
export const graphPrefixes=type=>ROUTE_PREFIXES[type]||ROUTE_PREFIXES.biomarker;
export const routeTypes=root=>ROUTE_TYPES[root]||[];
