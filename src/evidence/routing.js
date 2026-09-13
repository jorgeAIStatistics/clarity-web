import catalog from './catalog.json';
export const TYPES = {biomarker:'Biomarkers', diagnostic:'Diagnostics', screening:'Screening', precision_oncology:'Precision medicine'};
export const PATHS = {biomarker:'biomarkers', diagnostic:'diagnostics', screening:'screening', precision_oncology:'precision-medicine'};
export const entityPath = entity => `/${PATHS[entity.entity_type]}/${entity.id}`;
export function isEvidencePath(path) {
  return /^\/(explore|biomarkers|diagnostics|screening|tests|conditions|precision-medicine)(\/|$)/.test(path);
}
export function findEvidence(query) {
  const q = query.trim().toLowerCase();
  return catalog.entities.find(entity => entity.id === q || entity.name.toLowerCase() === q || (entity.aliases||[]).some(alias=>alias.toLowerCase()===q));
}
export function evidenceMetadata(path) {
  const [root, slug] = path.split('/').filter(Boolean);
  const type = Object.keys(PATHS).find(key => PATHS[key] === root);
  const entity = catalog.entities.find(e => e.id === slug && e.entity_type === type);
  return {
    title: root==='explore'&&slug==='matcher'?'Evidence Matcher':root==='explore'&&slug==='compare'?'Compare evidence profiles':root==='explore'&&slug==='visualizations' ? 'Scientific visualization studio' : entity?.name || TYPES[type] || (root === 'conditions' ? 'Evidence by condition' : root === 'tests' ? 'Diagnostics & screening' : 'Explore health evidence'),
    description: entity?.summary || 'Explore biomarkers, diagnostics, screening, and precision medicine with source-linked evidence and interactive statistics.',
  };
}
