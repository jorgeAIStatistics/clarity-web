export function studyLabels(d) {
  const s = `${d.design || ''} ${d.species || ''}`.toLowerCase();
  if (/animal|mice|rats|murine/.test(s)) return {
    exposure: 'Exposure',
    population: 'Model',
    comparator: 'Reference group',
    outcome: 'Outcome'
  };
  if (/cell|in vitro/.test(s)) return {
    exposure: 'Treatment / exposure',
    population: 'Cell / model',
    comparator: 'Control',
    outcome: 'Outcome',
    instrument: 'Assay'
  };
  if (/diagnostic/.test(s)) return {
    exposure: 'Index test',
    comparator: 'Reference standard',
    outcome: 'Target condition'
  };
  if (/random|rct/.test(s)) return {
    exposure: 'Intervention',
    comparator: 'Comparator',
    outcome: 'Outcome'
  };
  if (/cohort|observ|case.control|cross.section/.test(s) || /plasma|serum|biomarker|predictor/.test(d.exposure || '')) return {
    exposure: 'Biomarker / predictor',
    comparator: 'Reference group',
    outcome: 'Outcome'
  };
  return {
    exposure: 'Exposure / intervention / predictor',
    comparator: 'Comparator / reference',
    outcome: 'Outcome'
  };
}
export function meaningfulFields(d) {
  return ['population', 'exposure', 'outcome', 'design', 'method'].filter(k => d[k]?.trim()).length;
}
export function unresolved(d) {
  return ['exposure', 'outcome'].filter(k => !d[k]?.trim());
}
export function mergedDraft(previous, result) {
  return {
    ...previous,
    definition: {
      ...Object.fromEntries(Object.keys(previous.definition).map(k => [k, ''])),
      ...result.definition
    },
    draft: result,
    confirmed: false,
    result: null,
    comparisonConfirmed: false
  };
}
