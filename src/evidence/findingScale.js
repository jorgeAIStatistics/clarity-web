// Geometry for the finding ledger.
//
// The one rule this module exists to enforce: an interval is only ever drawn against an axis that
// its measure actually belongs to. A hazard ratio and a mean difference do not share a scale, and
// putting them on one would invent a comparison nobody reported. Measures with no defined scale
// (a cut-off, a median, a p-value) get no mark at all — the number stands on its own.

export const FAMILIES={
  // null at 1, read on a log axis: a halving and a doubling are the same distance from no effect.
  ratio:{measures:['hazard_ratio','odds_ratio','risk_ratio','rate_ratio','likelihood_ratio_positive','likelihood_ratio_negative'],
    nullValue:1,log:true,floor:[0.5,2],label:'ratio of risk, odds or rate',
    lower:'favours lower',higher:'favours higher'},
  // null at 0, linear.
  difference:{measures:['mean_difference','standardized_mean_difference','risk_difference','delta_c_index'],
    nullValue:0,log:false,floor:[-1,1],label:'difference between groups',
    lower:'below no difference',higher:'above no difference'},
  // 0.5 is chance; there is no null to cross, only a reference.
  discrimination:{measures:['auc','c_index'],nullValue:0.5,log:false,floor:[0.5,1],bounds:[0,1],
    label:'discrimination, where 0.5 is chance',lower:'worse than chance',higher:'better than chance'},
  // A proportion has no null at all. The axis runs 0 to 1 and the reference line is suppressed.
  proportion:{measures:['sensitivity','specificity','ppv','npv','accuracy','proportion'],
    nullValue:null,log:false,floor:[0,1],bounds:[0,1],label:'proportion from 0 to 1'},
  correlation:{measures:['correlation'],nullValue:0,log:false,floor:[-1,1],bounds:[-1,1],
    label:'correlation from −1 to 1',lower:'negative',higher:'positive'},
};

const BY_MEASURE=new Map();
for(const [name,family] of Object.entries(FAMILIES))for(const m of family.measures)BY_MEASURE.set(m,name);

export const measureFamily=measure=>BY_MEASURE.get(measure)||null;

// A row earns a mark only with a family and a finite estimate. A ratio at or below zero cannot be
// placed on a log axis, so it keeps its number and loses its mark rather than being clamped.
export function plottable(f){
  const family=measureFamily(f&&f.measure);
  if(!family)return false;
  const v=Number(f.estimate);
  if(!Number.isFinite(v))return false;
  if(FAMILIES[family].log&&v<=0)return false;
  return true;
}

const finite=v=>Number.isFinite(Number(v))?Number(v):null;

// Bounds come from every value the group actually shows — estimates and interval ends alike — so a
// mark is never drawn outside the axis it is measured against.
export function scaleFor(rows,familyName){
  const family=FAMILIES[familyName];
  if(!family)return null;
  const values=[];
  for(const f of rows||[]){
    if(measureFamily(f.measure)!==familyName||!plottable(f))continue;
    values.push(Number(f.estimate));
    const lo=finite(f.lower),hi=finite(f.upper);
    if(lo!=null&&(!family.log||lo>0))values.push(lo);
    if(hi!=null&&(!family.log||hi>0))values.push(hi);
  }
  if(!values.length)return null;
  if(family.nullValue!=null)values.push(family.nullValue);
  let min=Math.min(...values,family.floor[0]);
  let max=Math.max(...values,family.floor[1]);
  if(family.bounds){min=Math.max(min,family.bounds[0]);max=Math.min(max,family.bounds[1]);}
  if(!(max>min)){min=family.floor[0];max=family.floor[1];}
  const t=v=>family.log?Math.log10(v):v;
  const [a,b]=[t(min),t(max)];
  const pad=(b-a)*0.06;
  const lo=a-pad,hi=b+pad;
  const project=v=>{
    const n=Number(v);
    if(!Number.isFinite(n))return null;
    if(family.log&&n<=0)return null;
    return Math.min(1,Math.max(0,(t(n)-lo)/(hi-lo)));
  };
  return {
    family:familyName,log:family.log,min,max,
    nullValue:family.nullValue,nullAt:family.nullValue==null?null:project(family.nullValue),
    label:family.label,lowerLabel:family.lower||null,higherLabel:family.higher||null,
    project,ticks:ticksFor(family,min,max),
  };
}

function ticksFor(family,min,max){
  if(family.log){
    const out=[0.25,0.5,1,2,4].filter(v=>v>=min&&v<=max);
    return out.length>=2?out:[min,family.nullValue,max].filter((v,i,a)=>v!=null&&a.indexOf(v)===i);
  }
  const mid=family.nullValue!=null?family.nullValue:(min+max)/2;
  return [min,mid,max].filter((v,i,a)=>v!=null&&a.indexOf(v)===i);
}

// Everything the row needs to draw itself and to describe itself to a screen reader.
export function markFor(f,scale){
  if(!scale||!plottable(f)||measureFamily(f.measure)!==scale.family)return null;
  const estimate=Number(f.estimate);
  const lower=finite(f.lower),upper=finite(f.upper);
  const hasInterval=lower!=null&&upper!=null&&upper>=lower;
  const x=scale.project(estimate);
  if(x==null)return null;
  const x1=hasInterval?scale.project(lower):null,x2=hasInterval?scale.project(upper):null;
  // "Crosses the null" is a statement about the interval, so a row without one cannot make it.
  const crossesNull=hasInterval&&scale.nullValue!=null&&lower<=scale.nullValue&&upper>=scale.nullValue;
  return {
    x,x1,x2,hasInterval,crossesNull,
    // Clipped only when the reported interval runs past the axis, and said so in the label.
    clippedLow:hasInterval&&x1===0&&scale.project(lower)===0&&lower<scale.min,
    clippedHigh:hasInterval&&x2===1&&upper>scale.max,
  };
}

const show=v=>{
  const n=Number(v);
  if(!Number.isFinite(n))return String(v);
  return String(Math.abs(n)>=100?Math.round(n):Number(n.toFixed(Math.abs(n)<1?2:2))).replace(/\.0+$/,'');
};

// The mark's text equivalent. A sighted reader gets the geometry; everyone gets this sentence.
export function markDescription(f,scale,measureLabel){
  const mark=markFor(f,scale);
  const name=measureLabel||f.measure||'estimate';
  if(!mark)return null;
  const parts=[`${name} ${show(f.estimate)}`];
  if(mark.hasInterval)parts.push(`interval ${show(f.lower)} to ${show(f.upper)}`);
  else parts.push('interval not reported');
  if(scale.nullValue!=null&&mark.hasInterval)parts.push(mark.crossesNull?`crosses ${show(scale.nullValue)}`:`does not cross ${show(scale.nullValue)}`);
  if(mark.clippedLow||mark.clippedHigh)parts.push('interval extends past the axis');
  return parts.join(', ');
}

// Rows split into one block per measure family, in a stable order, each with its own axis. Rows
// whose measure has no scale come last as a plain list so their numbers are still shown.
export function splitByFamily(rows){
  const order=Object.keys(FAMILIES),groups=new Map(),unscaled=[];
  for(const f of rows||[]){
    const family=measureFamily(f.measure);
    if(!family||!plottable(f)){unscaled.push(f);continue;}
    if(!groups.has(family))groups.set(family,[]);
    groups.get(family).push(f);
  }
  const blocks=order.filter(name=>groups.has(name)).map(name=>({family:name,rows:groups.get(name),scale:scaleFor(groups.get(name),name)}));
  return {blocks,unscaled};
}
