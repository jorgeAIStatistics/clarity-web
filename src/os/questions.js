// OS-layer question contracts. Kind-specific.
//
// graphProfile.js CONTRACT is a biomarker / diagnostic / screening / precision
// oncology instrument. It is the scientific source for those kinds only.
// A gene must not inherit “Can we measure it reliably?” or “Does measuring it
// actually help?” — those questions do not match a gene’s scientific contract.
//
// Empty / unavailable is preferred to reuse. Nothing here invents findings.

import {questions as graphQuestions, ladder as biomarkerLadder, flatten} from '../evidence/graphProfile.js';

export const OS_CONTRACT = {
  gene: [
    'What sequence object is this?',
    'Where is it, and what does it encode?',
    'Which variants of it are indexed here?',
    'What gene-level findings exist?',
    'What must not be read from gene status?',
  ],
  protein: [
    'What molecular product is this?',
    'Which gene encodes it?',
    'Is protein-level evidence indexed?',
    'How is this distinct from a circulating measurement?',
    'What does this identity view not license?',
  ],
  variant: [
    'What sequence change is this?',
    'Which gene does it belong to?',
    'What findings are indexed for this variant alone?',
    'Is it used as a treatment modifier in this library?',
    'What must not be generalized from it?',
  ],
  biomarker: graphQuestions('biomarker'),
  metabolite: graphQuestions('biomarker'),
  test: graphQuestions('diagnostic'),
  assay: graphQuestions('diagnostic'),
  precision_context: graphQuestions('precision_oncology'),
  intervention: [
    'Does this intervention help?',
    'What harm or safety evidence is indexed?',
    'In whom was it studied?',
    'Which evidence layer do these estimates come from?',
    'What is not licensed by these estimates?',
  ],
  condition: [
    'What condition is this?',
    'What is indexed about it in this library?',
    'Which objects are studied in this condition?',
    'What findings are attached to the condition itself?',
    'What must not be inferred from a disease label?',
  ],
  pathway: [
    'What pathway is this?',
    'Which members are indexed?',
    'What findings are attached to the pathway itself?',
    'What membership does not license',
    'What must not be read from pathway membership?',
  ],
};

export function questionsForKind(kind) {
  return OS_CONTRACT[kind] || null;
}

function variantNeighbors(related = []) {
  return related.filter(r =>
    r.kind === 'Variant' || String(r.id).startsWith('variant:') || r.edge === 'VARIANT_OF');
}

function geneNeighbor(related = []) {
  return related.find(r => r.edge === 'VARIANT_OF' || r.edge === 'ENCODED_BY'
    || r.kind === 'Gene' || String(r.id).startsWith('gene:'));
}

function contextNeighbors(related = []) {
  return related.filter(r =>
    r.kind === 'PrecisionContext' || String(r.id).startsWith('precision_context:')
    || r.reason === 'modifies_treatment');
}

function rung(key, label, indexed, target, extra = {}) {
  return {
    key,
    label,
    indexed: Boolean(indexed),
    status: extra.status || (indexed ? 'Indexed' : 'Unavailable'),
    target,
    asks: extra.asks || '',
    constraint: Boolean(extra.constraint),
  };
}

export function rungsForKind(kind, entity = {}, findings = [], related = [], data = {}) {
  const ask = questionsForKind(kind);
  const rows = flatten(findings);
  if (kind === 'biomarker' || kind === 'metabolite' || kind === 'test' || kind === 'assay' || kind === 'precision_context') {
    return biomarkerLadder(entity, findings).map((r, i) => ({
      ...r,
      label: (ask && ask[i]) || r.label,
      target: r.target?.replace(/^gp-/, 'os-') || `os-q${i + 1}`,
    }));
  }
  if (!ask) return [];
  if (kind === 'gene') {
    const variants = variantNeighbors(related);
    const locus = Boolean(entity.locus?.chrom || entity.locus?.gene_symbol);
    return [
      rung('identity', ask[0], true, 'os-q1', {asks: 'A gene node exists in this library.'}),
      rung('locus', ask[1], locus, 'os-q2', {asks: 'Locus or encoding fields are stored.'}),
      rung('variants', ask[2], variants.length > 0, 'os-q3', {asks: 'VARIANT_OF edges on this payload.'}),
      rung('findings', ask[3], rows.length > 0, 'os-q4', {asks: 'Typed findings attached to this gene, not a variant.'}),
      rung('limits', ask[4], true, 'os-q5', {constraint: true, status: 'Constraint', asks: 'Gene status is not protein level, expression, or utility.'}),
    ];
  }
  if (kind === 'protein') {
    const gene = geneNeighbor(related);
    const derived = data.origin === 'derived' || Boolean(data.derived_from);
    const proteinFindings = derived ? [] : rows;
    return [
      rung('identity', ask[0], true, 'os-q1'),
      rung('gene', ask[1], Boolean(gene), 'os-q2'),
      rung('findings', ask[2], proteinFindings.length > 0, 'os-q3', {
        asks: derived ? 'No protein node; findings are not copied from the biomarker.' : 'Typed protein-level findings.',
      }),
      rung('distinct', ask[3], true, 'os-q4', {constraint: true, status: 'Constraint'}),
      rung('limits', ask[4], true, 'os-q5', {constraint: true, status: 'Constraint'}),
    ];
  }
  if (kind === 'variant') {
    const gene = geneNeighbor(related);
    const contexts = contextNeighbors(related);
    return [
      rung('identity', ask[0], true, 'os-q1'),
      rung('gene', ask[1], Boolean(gene), 'os-q2'),
      rung('findings', ask[2], rows.length > 0, 'os-q3'),
      rung('context', ask[3], contexts.length > 0, 'os-q4'),
      rung('limits', ask[4], true, 'os-q5', {constraint: true, status: 'Constraint'}),
    ];
  }
  if (kind === 'intervention') {
    return ask.map((label, i) => rung(`i${i + 1}`, label, i === 0, `os-q${i + 1}`, {
      constraint: i === 4,
      status: i === 4 ? 'Constraint' : (i === 0 ? 'Open' : 'See extract'),
    }));
  }
  return ask.map((label, i) => rung(`q${i + 1}`, label, rows.length > 0 && i < 4, `os-q${i + 1}`, {
    constraint: i === ask.length - 1,
  }));
}

export function usesBiomarkerContract(kind) {
  return kind === 'biomarker' || kind === 'metabolite' || kind === 'test' || kind === 'assay' || kind === 'precision_context';
}
