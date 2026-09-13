export const LAYERS=[['mechanism','Mechanism / biology'],['preclinical','Preclinical / animal'],['observational','Human observational'],['interventional','Human interventional'],['guidelines','Guidelines / regulation']];
export function studyLayer(s){
  const design=String(s.design||s.study_type||'').toLowerCase(),population=String(s.population||'').toLowerCase();
  if(s.is_protocol||/\b(study protocol|trial protocol|protocol for (a|an|the) .{0,40}trial)\b/.test(String(s.title||'').toLowerCase())||design.includes('protocol'))return 'protocol';
  if(/guideline|practice recommendation|regulatory/.test(design))return 'guidelines';
  if(/animal|mouse|mice|rat\b|preclinical/.test(population)||/animal/.test(design))return 'preclinical';
  if(/in.?vitro|cell|mechanis/.test(population+' '+design))return 'mechanism';
  if(/meta.analysis|systematic review/.test(design))return 'synthesis';
  if(!/human/.test(population))return 'unclassified';
  if(/random|rct|clinical trial|intervention/.test(design))return 'interventional';
  if(/observ|cohort|case.control|cross.section/.test(design))return 'observational';
  return 'unclassified';
}
export function safeSource(url){try{return new URL(url).protocol==='https:'?url:undefined;}catch{return undefined;}}
export function uniqueStudies(outcomes){const result=new Map();for(const o of outcomes)for(const s of o.studies||[]){const id=s.pmid?`pmid:${s.pmid}`:s.doi?`doi:${s.doi.toLowerCase()}`:s.id||s.url;if(id&&!result.has(id))result.set(id,{...s,id});}return [...result.values()];}
export function compoundBrief(view){const studies=uniqueStudies(view.outcomes||[]);return {analysis:view.analysis,targetId:'compound:'+String(view.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name:view.name,type:'Intervention',aliases:view.aliases||[],maturity:view.analysis?.coverage.protocols?'Appraisal refresh needed':view.outcomeDependent?'Outcome-dependent':view.bestTier||view.tier||'Not assessed',generatedAt:view.generatedAt,summary:view.analysis?.summary||'Evidence interpretation is loading from the current engine.',studies,sourceCount:view.studyCount,outcomes:(view.outcomes||[]).map(o=>({name:o.outcome,grade:o.tier,direction:o.directionStatus==='assessed'?o.headlineEffect?.direction||'See study findings':'Not assessed',effectQuote:o.headlineEffect?.quote,effectSource:o.headlineEffect?.pmid?`https://pubmed.ncbi.nlm.nih.gov/${o.headlineEffect.pmid}/`:null,effect:o.headlineEffect&&!o.headlineEffect.estimated?`${o.headlineEffect.metric}: ${o.headlineEffect.value}${o.headlineEffect.ciLow!=null&&o.headlineEffect.ciHigh!=null?` (CI ${o.headlineEffect.ciLow}–${o.headlineEffect.ciHigh})`:''}`:'No verified headline estimate',population:'See cited study populations',exposure:'Not extracted in a structured appraisal',studies:o.studies||[],limitations:o.reasons||[]})),limitations:[studies.some(s=>studyLayer(s)==='protocol')?'This cached appraisal includes protocol records. They are separated from completed studies here; outcome grades require a refreshed appraisal under the protocol-exclusion rule.':null,view.thinEvidenceNote,view.honestyNote,'The headline grade describes evidence strength for an outcome; it is not an effect size or a probability of benefit.','Displayed source records may be a subset of the graded studies. Missing source metadata cannot establish absence of evidence.','Dose, exposure, study quality, and applicability require reading the cited study.'].filter(Boolean)};}
export function entityBrief(e){
 const studies=e.studies||[];
 return {
  targetId:'entity:'+e.id,name:e.name,type:e.entity_type.replaceAll('_',' '),aliases:e.aliases||[],
  maturity:e.review_status==='reviewed'?'Reviewed by dimension':'Appraisal incomplete',summary:e.summary,
  studies,sourceCount:studies.length,
  outcomes:e.outcomes.map(o=>{
   const matched=studies.filter(s=>String(s.outcome||'').toLowerCase()===o.name.toLowerCase());
   const effect=matched.find(s=>s.effect)?.effect;
   return {name:o.name,grade:o.rating||o.assessment||'Not yet assessed',direction:effect?'Study-specific estimate':'Not assessed',
    effect:effect?`${effect.measure}: ${effect.estimate} (${effect.confidence_level}% CI ${effect.lower}–${effect.upper})`:'No extracted estimate for this outcome',
    population:e.population,exposure:e.exposure,studies:matched};
  }),
  limitations:[e.context,'Reference summaries and source-linked trial results are distinct from completed study-level appraisals.','A missing layer indicates incomplete catalog coverage, not that no evidence exists.'].filter(Boolean),sources:e.sources||[]
 };
}
