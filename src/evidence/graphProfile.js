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
// A C-index change of 0.0004 must not round to 0; small values keep significant digits.
const num=n=>{const v=Number(n);return Math.abs(v)>0&&Math.abs(v)<0.01
  ?v.toLocaleString('en-US',{maximumSignificantDigits:2})
  :v.toLocaleString('en-US',{maximumFractionDigits:3});};
// Extractions sometimes put a whole clause in the unit field ("median 2.8-year follow-up; ...").
// A unit is short and symbol-like; anything else is a description and does not belong beside a number.
const unitText=unit=>{
  const text=String(unit||'').trim();
  if(!text)return '';
  if(text==='%'||text==='‰')return text;
  return text.length<=12&&!/[;,]/.test(text)?` ${text}`:'';
};

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
  // When a paper reported numbers about something else, name that something: "findings about other
  // markers" is unreadable, and on a test page the other marker is often the analyte the test
  // measures, which a reader can only judge if they can see the two names side by side.
  const others=(d.excluded||[]).filter(Boolean);
  if(d.code==='findings_about_other_markers'&&others.length)
    return `it reported numbers about ${listWords(others.map(m=>m.length>60?m.slice(0,57)+'…':m))}, and no passage named this page's subject, so nothing was attached`;
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
// A gene and the protein it encodes share a name, so the gene is addressed with a suffix and that
// suffix names the kind to look for. Tried first, then the plain prefixes, so an entity whose own
// slug happens to end in -gene still resolves.
const KIND_SUFFIX={'-gene':'gene','-variant':'variant','-protein':'protein'};
// The address to link a molecular neighbour by. A gene, variant or protein always takes the
// suffixed form: it is the only spelling that cannot land on the protein that shares its name, and
// graphCandidates resolves it whether or not there was a collision to begin with.
export function graphPath(id=''){
  const [prefix,slug]=String(id).split(':');
  if(!slug)return null;
  if(['gene','variant','protein'].includes(prefix))return `/biomarkers/${slug}-${prefix}`;
  if(prefix==='biomarker'||prefix==='metabolite')return `/biomarkers/${slug}`;
  return null;
}

export function graphCandidates(type,slug){
  const out=[];
  for(const [suffix,prefix] of Object.entries(KIND_SUFFIX))
    if(slug.endsWith(suffix)&&slug.length>suffix.length)out.push(`${prefix}:${slug.slice(0,-suffix.length)}`);
  for(const prefix of graphPrefixes(type))out.push(`${prefix}:${slug}`);
  return out;
}
export const routeTypes=root=>ROUTE_TYPES[root]||[];

// ---- The profile contract: Q1-Q5 and the evidence ladder ------------------
// Every sentence is computed from THIS entity's identity fields and its own findings. Two markers
// with different findings must not read alike, and nothing here infers utility from accuracy.
export const CONTRACT={
  biomarker:['What is it?','What biology does it represent?','Can we measure it reliably?','What does the value indicate?','Does measuring it actually help?'],
  diagnostic:['What is this test?','What does it detect?','How reliable is the measurement or reading?','How accurate is it, and in whom?','Does using the test change outcomes or harms?'],
  screening:['What is this screening test?','What does it look for?','How reliable is the measurement or reading?','How accurate is it, and in whom?','Does screening change outcomes and harms?'],
  precision_oncology:['What is the modifier?','What biology does the modifier represent?','How is the modifier measured?','Is it prognostic, or predictive of treatment benefit?','Does selecting treatment on it improve outcomes?'],
};
export const questions=type=>CONTRACT[type]||CONTRACT.biomarker;

const uniq=values=>[...new Set(values.filter(Boolean))];
const listWords=items=>{const x=uniq(items);return x.length<=1?(x[0]||''):x.length===2?`${x[0]} and ${x[1]}`:`${x.slice(0,-1).join(', ')} and ${x.at(-1)}`;};
const range=values=>{const lo=Math.min(...values),hi=Math.max(...values);return lo===hi?num(lo):`${num(lo)} to ${num(hi)}`;};
// Prose names a ratio in full; the short label belongs in a table, not a sentence.
const LONG_MEASURES={odds_ratio:'odds ratio',hazard_ratio:'hazard ratio',risk_ratio:'risk ratio',rate_ratio:'rate ratio',correlation:'correlation'};

// Q1: what the object is. Curated class and specimen first; the generic kind sentence is the fallback.
export function identity(entity={},related=[]){
  const id=entity.identity||{};
  const molecular=related.filter(r=>['ENCODED_BY','VARIANT_OF','IN_PATHWAY','MEASURED_BY'].includes(r.edge));
  return {
    label:id.entity_class||objectKind(entity).label,
    curated:Boolean(id.entity_class),
    // Lower-case only the leading ordinary word: IL-1, MUC16 and NGS keep their case.
    text:id.identity_sentence?id.identity_sentence:id.entity_class?`${entity.name} is ${/^[aeiou]/i.test(id.entity_class)?'an':'a'} ${id.entity_class.replace(/^[A-Z][a-z]+/,w=>w.toLowerCase())}.`:objectKind(entity).text,
    specimen:id.specimen||null,
    aliases:(entity.aliases||[]).filter(a=>a!==entity.name),
    molecular,
    note:objectKind(entity).text,
  };
}

// Q2: biology. Mechanism or preclinical findings are evidence; a curated note is background.
export function biology(entity={},rows=[]){
  const indexed=flatten(rows).filter(f=>['mechanism','preclinical'].includes(f.layer));
  const note=(entity.identity||{}).pathway_note||null;
  if(indexed.length)return {state:'indexed',text:`${indexed.length} indexed mechanism or laboratory ${indexed.length===1?'finding':'findings'} for ${entity.name}.`,note,findings:indexed};
  if(note)return {state:'background',text:note,note:null,findings:[]};
  return {state:'empty',text:`Biology not indexed: no mechanism or laboratory finding for ${entity.name} is in the graph, and no background note is stored.`,note:null,findings:[]};
}

// Q3: can it be measured reliably. Assays named in the findings themselves, then the curated method.
export function measurement(entity={},rows=[]){
  const list=flatten(rows);
  const assays=uniq(list.map(f=>f.assay));
  const units=uniq(list.map(f=>f.cutoff_unit||f.unit));
  const method=(entity.identity||{}).assay_hint||null;
  const specimen=(entity.identity||{}).specimen||null;
  const gap=list.length>0&&assays.length===0;
  return {
    assays,units,method,specimen,gap,
    text:gap?`No indexed finding names the assay it used. Without the assay, platform and matrix, these values cannot be compared across studies or carried to a laboratory report — that is an analytical-validity gap, not a detail.`
      :assays.length?`Assays named in the indexed findings: ${listWords(assays)}.${units.length?` Reported in ${listWords(units)}.`:''} Values from different assays are not interchangeable unless the studies calibrated them.`
      :method?`No finding is indexed yet, so nothing here demonstrates analytical validity. ${method} is the usual method recorded for this entity.`
      :`Nothing is indexed about how ${entity.name} is measured.`,
  };
}

const KIND_MEANING={
  association:(name,group)=>{
    const ratios=group.filter(f=>LONG_MEASURES[f.measure]&&f.estimate!=null);
    const others=group.filter(f=>!ratios.includes(f));
    const parts=[];
    if(ratios.length)parts.push(`${name} was associated with ${listWords(ratios.map(f=>f.target))} (${listWords(ratios.map(f=>`${LONG_MEASURES[f.measure]} ${num(f.estimate)}`))})`);
    // Lower-case the leading measure word only: units such as pg/mL and labels such as AUC keep their case.
    const lead=text=>String(text).replace(/^[A-Z][a-z]+/,w=>w.toLowerCase());
    if(others.length)parts.push(`${ratios.length?'Levels reported as ':`${name} was reported as `}${listWords(others.map(f=>`${lead(valueText(f))} for ${f.target}`))}`);
    return [`${parts.join('. ')}.`,
      'An association is not causation: the studies did not change the marker and watch the outcome.',
      'Group values can overlap almost completely even when their averages differ, so a difference that is biologically interesting can still be useless for telling two people apart.'];
  },
  discrimination:(name,group)=>{
    // A standalone AUC and a change in C-index answer different questions and must not share a sentence.
    const areas=group.filter(f=>['auc','c_index'].includes(f.measure)&&f.estimate!=null);
    const deltas=group.filter(f=>f.measure==='delta_c_index'&&f.estimate!=null);
    // An AUC reported as 81.65 is on a 0-100 scale; saying 0.5 is chance would misread it by a factor of 100.
    const percent=f=>f.unit==='%'||f.estimate>1;
    const lines=[];
    for(const [scaled,rows] of [[false,areas.filter(f=>!percent(f))],[true,areas.filter(percent)]]){
      if(!rows.length)continue;
      lines.push(`Reported discrimination for ${listWords(rows.map(f=>f.target))}: ${MEASURES[rows[0].measure]} ${range(rows.map(f=>f.estimate))}${scaled?'%':''} on a scale where ${scaled?'50% is':'0.5 is'} chance.`);
    }
    if(deltas.length)lines.push(`Added to a model that already exists, ${name} moved the C-index by at most ${num(Math.max(...deltas.map(f=>Math.abs(f.estimate))))} on that same 0.5\u20131 scale.`);
    if(!lines.length)lines.push(`Discrimination is reported for ${listWords(group.map(f=>f.target))} without a usable value.`);
    lines.push(deltas.length?'A model can rank people slightly better and still change no decision: incremental discrimination is not utility.'
      :'Discrimination describes how well the marker ranks people inside that study\u2019s own sample. It is not calibration, and it does not show that any decision changed.');
    lines.push('Even a high value leaves overlapping distributions: some people above the cut-off do not have the condition, and some below it do.');
    return lines;
  },
  classification:(name,group)=>{
    const ACCURACY=['sensitivity','specificity','ppv','npv','accuracy','likelihood_ratio_positive','likelihood_ratio_negative'];
    const accuracy=group.filter(f=>ACCURACY.includes(f.measure)&&f.estimate!=null);
    // A bare threshold is not an accuracy result; do not dress it up as one.
    const cut=uniq(group.map(f=>f.cutoff!=null?`${num(f.cutoff)}${f.cutoff_unit?` ${f.cutoff_unit}`:''}`
      :f.measure==='cutoff'&&f.estimate!=null?`${num(f.estimate)}${unitText(f.unit)}`:null));
    const targets=listWords(group.map(f=>f.target));
    const lines=[accuracy.length
      ? `At the authors\u2019 own cut-off${cut.length?` (${listWords(cut)})`:''}, the indexed studies report ${listWords(accuracy.map(f=>`${MEASURES[f.measure]||f.measure} ${num(f.estimate)}${f.unit==='%'?'%':''}`))} for ${targets}.`
      : `A cut-off${cut.length?` of ${listWords(cut)}`:''} was used to classify ${targets}, with no sensitivity or specificity indexed at that threshold.`,
      'A cut-off is a property of the study that chose it: another assay, spectrum of disease or population moves it.'];
    if(accuracy.length)lines.push('Sensitivity and specificity say nothing about how many positives are true in your setting; that depends on how common the condition is there.');
    return lines;
  },
  prognosis:(name,group)=>[
    `${name} was reported against later course — ${listWords(group.map(f=>f.target))} — as ${listWords(group.map(f=>valueText(f)))}.`,
    'Prognostic is not predictive: knowing who does worse is not evidence about who benefits from a treatment, which needs a treatment-by-marker interaction.'],
  effect:(name,group)=>[
    `Between-group comparisons: ${listWords(group.map(f=>valueText(f)))} for ${listWords(group.map(f=>f.target))}.`,
    'The contrast, dose and population belong to the study that reported it and do not transfer unchanged.'],
};

// Q4: what the value indicates, one subhead per kind that actually exists.
export function meaning(entity={},rows=[]){
  const name=entity.name||'This marker';
  return groupFindings(rows).filter(g=>KIND_MEANING[g.kind]).map(g=>({
    kind:g.kind,label:g.label,rows:g.rows,
    sentences:KIND_MEANING[g.kind](name,g.rows).slice(0,3),
  }));
}

// Q5: does measuring it help. Utility and guidelines only, never inferred from accuracy.
export function utility(entity={},rows=[]){
  const list=flatten(rows);
  const useful=list.filter(f=>f.kind==='utility');
  const guidance=list.filter(f=>f.kind==='guideline');
  if(!useful.length&&!guidance.length)return {state:'empty',rows:[],
    text:`No indexed evidence that measuring ${entity.name} changes decisions or outcomes. Nothing on this page — association, accuracy or discrimination — can stand in for that evidence.`};
  return {state:'indexed',rows:[...useful,...guidance],
    text:`${useful.length?`${useful.length} indexed clinical-utility ${useful.length===1?'finding':'findings'}`:'No indexed clinical-utility finding'}${guidance.length?` and ${guidance.length} guideline ${guidance.length===1?'statement':'statements'}`:''} for ${entity.name}. Read each one for the decision it actually tested.`};
}

// The ladder: which rungs the graph can speak to at all.
export const RUNGS=['discovery','biology','analytical','clinical','incremental','utility'];
const RUNG_LABELS={discovery:'Discovery',biology:'Biology',analytical:'Analytical validation',clinical:'Clinical validation',incremental:'Incremental value',utility:'Clinical utility'};
const RUNG_ASKS={discovery:'Reported findings exist here.',biology:'A mechanism or laboratory finding is here.',analytical:'The findings name the assay used.',clinical:'Association, discrimination, classification or prognosis is here.',incremental:'Something compares it with the tools already in use.',utility:'Something tests whether using it changes decisions or outcomes.'};
// Each rung points at the question that already explains it, filled or empty.
const RUNG_TARGET={discovery:'gp-q4',biology:'gp-q2',analytical:'gp-q3',clinical:'gp-q4',incremental:'gp-q4',utility:'gp-q5'};
export const IN_LIBRARY='In this library',NOT_IN_LIBRARY='Not in this library yet';
const INCREMENTAL=/\badded to\b|\bincremental\b|\bbeyond\b|\bin addition to\b|\bcombined with\b|\bversus\b/i;
export function ladder(entity={},rows=[]){
  const list=flatten(rows);
  const has=kinds=>list.some(f=>kinds.includes(f.kind));
  const state={
    discovery:list.length>0,
    biology:list.some(f=>['mechanism','preclinical'].includes(f.layer)),
    analytical:list.some(f=>f.assay),
    clinical:has(['association','discrimination','classification','prognosis','effect']),
    incremental:list.some(f=>f.measure==='delta_c_index'||INCREMENTAL.test(`${f.target||''} ${f.marker||''} ${f.comparator||''}`)),
    // A guideline statement is not evidence that measuring changes outcomes; only a utility finding is.
    utility:has(['utility']),
  };
  return RUNGS.map(key=>({key,label:RUNG_LABELS[key],asks:RUNG_ASKS[key],indexed:state[key],
    status:state[key]?IN_LIBRARY:NOT_IN_LIBRARY,target:RUNG_TARGET[key]}));
}

// What the indexed evidence is actually about, so a reader does not take it for the general case.
// A population that names no one in particular — "patients", "adults", "participants" — narrows
// nothing, and a sentence built on it ("Indexed evidence is currently from patients") claims a
// scope the findings do not have. Those read as no stated population at all.
const VAGUE=/^(?:the\s+)?(?:patients?|adults?|participants?|subjects?|individuals?|people|persons?|cases?|humans?|men|women|children|controls?)$/i;
const statesAPopulation=text=>Boolean(String(text||'').trim())&&!VAGUE.test(String(text).trim());

// Numbers a paper quoted from other papers. They carry no weight here and are never mixed into the
// findings: this only turns the payload's quoted list into rows a page can fold away. A finding
// that simply does not say whose result it is stays unlabelled — silence is not a claim of
// authorship, and badging it "primary" would invent one.
export function quotedRows(data){
  return (data?.quoted||[]).map(q=>({
    id:q.finding?.id,measure:q.finding?.measure,estimate:q.finding?.estimate,lower:q.finding?.lower,upper:q.finding?.upper,
    level:q.finding?.level,unit:q.finding?.unit,target:q.finding?.target||'',population:q.finding?.population||'',
    marker:q.finding?.marker||'',quote:q.quote||'',pmid:q.pmid||'',title:q.title||'',year:q.year||'',
  })).filter(r=>r.id);
}

export function scopeNote(entity={},rows=[]){
  const list=flatten(rows);
  if(!list.length)return null;
  const where=uniq(list.map(f=>f.population||f.setting).filter(statesAPopulation)).slice(0,3);
  if(!where.length)return `Indexed findings do not state which population they came from, so their scope is unknown.`;
  return `Indexed evidence is currently from ${listWords(where)}. Other uses of ${entity.name} are not indexed here, and absence is not evidence against them.`;
}

// ---- Retry policy ---------------------------------------------------------
// The engine restarts on every deploy and answers 502/503, or nothing at all, for a few seconds.
// A page loaded in that window should recover by itself. A 404 is an answer, not a failure.
// A page served from the published snapshot is readable but may be behind the graph, so it says
// when it was published rather than letting a stale copy pass for a live read.
export function freshness(data){
  if(data?.served_from!=='snapshot')return null;
  const at=String(data.published_at||'').slice(0,10);
  // Slow and unreachable are different facts about the engine, and a reader deciding whether to
  // reload benefits from knowing which one they hit.
  const why=data.fallback_reason==='slow'?'did not answer in time':'did not answer';
  return at?`Published ${at}. The live evidence graph ${why}, so this page is the last published copy; a finding added since then is not shown.`
           :`The live evidence graph ${why}, so this page is the last published copy.`;
}

// When a profile will not load, "try again in a minute" is a guess. These two endpoints turn it
// into an answer: /api/health says whether the engine is up at all, and the graph stats endpoint is
// the cheapest read that proves the graph itself is reachable. A reader who is told which of the
// two is down knows whether waiting will help.
export async function diagnose(request,base=''){
  const reachable=async path=>{try{const response=await request(`${base}${path}`);return Boolean(response&&response.ok);}catch{return false;}};
  if(!await reachable('/api/health'))
    return {engine:false,graph:false,text:'The evidence engine is not answering yet. It restarts on every deploy and usually comes back within a minute.'};
  if(!await reachable('/api/evidence/graph/stats'))
    return {engine:true,graph:false,text:'The engine is running, but the evidence graph behind it is not answering, so no profile can be read right now. Pages with a published copy are still being served from it.'};
  return {engine:true,graph:true,text:'The engine and the evidence graph are both answering, so this page failed for some other reason. Trying again usually works.'};
}

// An engine that answers 200 with zero graph rows has read a cold or unreachable database. The
// page cannot tell that from a genuinely small library, and believing it is how the index read
// "14 profiles" with nothing saying a read had failed. An older engine sends no count at all, and
// silence is not a zero.
export function libraryIsShort(payload){
  return typeof payload?.graph_rows==='number'&&payload.graph_rows===0;
}

// The catalog takes about thirteen seconds to build on a cold process, so the engine serves the
// last published copy instead of letting the page time out into its fourteen curated profiles.
// Readable, but possibly behind, and the page says which rather than letting one pass for the other.
export function catalogFreshness(payload){
  if(payload?.served_from!=='snapshot')return null;
  const at=String(payload.published_at||'').slice(0,10);
  return `Catalog published ${at||'earlier'}. The live evidence graph did not answer in time, so this list may be short of nodes added since.`;
}

export const RETRY_DELAYS=[1500,4000];
export function shouldRetry(outcome){
  if(outcome==='network')return true;
  return [408,425,429,500,502,503,504].includes(Number(outcome));
}

// The loop is separated from React so it can be tested with a fake clock and a fake request.
// An error carrying `outcome` is an HTTP status; anything else is treated as a network failure.
export async function fetchWithRetry(attemptOnce,{delays=RETRY_DELAYS,sleep,onRetry}={}){
  const wait=sleep||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  for(let tries=0;;tries++){
    try{
      return await attemptOnce(tries);
    }catch(error){
      if(tries>=delays.length||!shouldRetry(error?.outcome??'network'))throw error;
      onRetry?.(tries+1);
      await wait(delays[tries]);
    }
  }
}

// ---- External identifiers -------------------------------------------------
// A nickname is not an identity. Each id links to the registry that issued it, and the caption
// says what the id is for: a variant's ids describe the gene it alters, not the variant.
const ID_SOURCES={
  hgnc:['HGNC','gene',id=>`https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${encodeURIComponent(id)}`],
  ensembl:['Ensembl','gene',id=>`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${encodeURIComponent(id)}`],
  uniprot:['UniProt','protein',id=>`https://www.uniprot.org/uniprotkb/${encodeURIComponent(id)}`],
  ensembl_protein:['Ensembl protein','canonical protein',id=>`https://www.ensembl.org/Homo_sapiens/Transcript/ProteinSummary?p=${encodeURIComponent(id)}`],
  mondo:['MONDO','disease',id=>`https://www.ebi.ac.uk/ols4/ontologies/mondo/classes?short_form=${encodeURIComponent(String(id).replace(':','_'))}`],
  chebi:['ChEBI','molecule',id=>`https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${encodeURIComponent(id)}`],
  ncit:['NCIt','concept',id=>`https://ncithesaurus.nci.nih.gov/ncitbrowser/ConceptReport.jsp?code=${encodeURIComponent(id)}`],
};
export function externalLinks(entity={}){
  const ids=entity.external_ids||{};
  return Object.entries(ID_SOURCES).filter(([key])=>ids[key]).map(([key,[label,about,url]])=>({key,label,about,id:ids[key],url:url(ids[key])}));
}
// Only two assemblies of a coordinate exist for our purposes, and we publish one. A coordinate
// read on an assembly we did not record is not a place, so it produces no link at all.
const UCSC_ASSEMBLY={GRCh38:'hg38'};

// A locus link belongs on the objects a locus describes: a gene, and a variant of one. A serum
// protein measurement is not a question about a stretch of chromosome, so those pages get none —
// this is a link out to UCSC, never a genome browser embedded in Clarity.
export function ucscLink(entity={}){
  const kind=entity.kind||entity.type;
  if(!['Gene','gene','Variant','variant'].includes(kind))return null;
  const l=entity.locus||{};
  const db=UCSC_ASSEMBLY[l.assembly];
  if(!db||!l.chrom||!Number.isFinite(Number(l.start_bp))||!Number.isFinite(Number(l.end_bp)))return null;
  const position=`chr${l.chrom}:${Number(l.start_bp)}-${Number(l.end_bp)}`;
  return {
    position,assembly:l.assembly,symbol:l.gene_symbol||null,
    url:`https://genome.ucsc.edu/cgi-bin/hgTracks?db=${db}&position=${encodeURIComponent(position)}`,
    about:['Variant','variant'].includes(kind)
      ? `The locus of ${l.gene_symbol||'the gene'} on ${l.assembly}. The variant alters this gene; these coordinates are the gene's, not the variant's.`
      : `The locus of ${l.gene_symbol||'this gene'} on ${l.assembly}.`,
  };
}

export function idCaption(entity={}){
  const kind=entity.kind||entity.type;
  if(kind==='Variant'||kind==='variant')return 'These identify the gene and protein this variant alters. The variant itself is a separate object.';
  if(kind==='PrecisionContext'||kind==='precision_context')return 'These identify the gene at the centre of this marker-and-treatment pair.';
  if(kind==='Gene'||kind==='gene')return 'The gene, and the protein it encodes. That protein and any variant of this gene are separate objects here, with their own pages and their own findings.';
  return 'These identify the gene that encodes it and the protein that is measured.';
}

// What a library card should say: which kinds of finding a page holds, and whether anything
// speaks to using the marker. "3 findings" hides that all three are accuracy and none is utility.
export function kindBadge(entry={}){
  const kinds=Object.entries(entry.finding_kinds||{}).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const total=entry.coverage?.quantified_outcomes||kinds.reduce((sum,[,n])=>sum+n,0);
  if(!total)return {text:'Not in this library yet',kinds:[],utility:false};
  const shown=kinds.slice(0,2).map(([kind,n])=>`${n} ${kind}`);
  if(kinds.length>2)shown.push(`+${kinds.length-2} more`);
  return {text:shown.join(' · ')||`${total} typed ${total===1?'finding':'findings'}`,kinds:kinds.map(([kind])=>kind),utility:Boolean(entry.utility_indexed)};
}
