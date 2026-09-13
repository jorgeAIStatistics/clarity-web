const divide = (n, d) => d ? n / d : null;
function probability(x) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 1) throw new Error('Probabilities must be between 0 and 1.');
  return x;
}
export function diagnosticMetrics(sensitivity, specificity, prevalence, population = 1000) {
  const se = probability(sensitivity), sp = probability(specificity), p = probability(prevalence);
  if (!Number.isInteger(population) || population < 1 || population > 1000000) throw new Error('Invalid population.');
  const tp = population*p*se, fn = population*p*(1-se), tn = population*(1-p)*sp, fp = population*(1-p)*(1-sp);
  return {tp, fn, tn, fp, ppv:divide(tp,tp+fp), npv:divide(tn,tn+fn), postNegative:divide(fn,tn+fn), lrPositive:divide(se,1-sp), lrNegative:divide(1-se,sp), dor:divide(se*sp,(1-se)*(1-sp)), fpr:1-sp, fnr:1-se};
}
const reciprocalCount = difference => {
  const count=1/difference;
  if (!Number.isFinite(count)) return null;
  return Math.abs(count-Math.round(count))<1e-10 ? Math.round(count) : Math.ceil(count);
};
export function screeningMetrics(baseline, screened, falsePositive=0, procedures=0) {
  [baseline,screened,falsePositive,procedures].forEach(probability);
  const arr=baseline-screened;
  return {baseline:baseline*1000,screened:screened*1000,prevented:arr*1000,nns:arr>0?reciprocalCount(arr):null,nnh:arr<0?reciprocalCount(-arr):null,falsePositive:falsePositive*1000,procedures:procedures*1000};
}
