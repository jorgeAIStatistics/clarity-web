// OS routing lives beside the legacy canonicalPath helper. Old URLs stay valid aliases.
// Scientific contracts in graphProfile.js are not modified.

export const KIND_PREFIX = {
  gene: 'gene',
  protein: 'protein',
  biomarker: 'biomarker',
  metabolite: 'metabolite',
  variant: 'variant',
  test: 'test',
  assay: 'test',
  precision_context: 'context',
  condition: 'condition',
  pathway: 'pathway',
  compound: 'intervention',
  intervention: 'intervention',
};

export const PREFIX_KIND = {
  gene: 'gene',
  protein: 'protein',
  biomarker: 'biomarker',
  metabolite: 'metabolite',
  variant: 'variant',
  test: 'test',
  context: 'precision_context',
  condition: 'condition',
  pathway: 'pathway',
  intervention: 'intervention',
};

export const KIND_LABEL = {
  gene: 'Gene',
  protein: 'Protein',
  biomarker: 'Biomarker',
  metabolite: 'Metabolite',
  variant: 'Variant',
  test: 'Test',
  assay: 'Assay',
  precision_context: 'Precision context',
  condition: 'Condition',
  pathway: 'Pathway',
  intervention: 'Intervention',
  compound: 'Intervention',
};

const OLD_ROOT_TO_KIND = {
  biomarkers: 'biomarker',
  diagnostics: 'test',
  screening: 'test',
  tests: 'test',
  'precision-medicine': 'precision_context',
  conditions: 'condition',
  compound: 'intervention',
};

export function graphId(kind, slug) {
  const prefix = kind === 'intervention' ? 'compound' : kind === 'precision_context' ? 'precision_context' : kind === 'test' ? 'test' : kind;
  return `${prefix}:${slug}`;
}

export function osPathFromId(id = '') {
  const raw = String(id).replace(/^graph:/, '');
  const [prefix, ...rest] = raw.split(':');
  const slug = rest.join(':');
  if (!prefix || !slug) return '/catalog';
  const root = KIND_PREFIX[prefix] || KIND_PREFIX[prefix.replaceAll('_', '')];
  if (root) return `/${root}/${slug}`;
  return '/catalog';
}

export function libraryKind(entry = {}) {
  const id = String(entry.id || '');
  const inner = id.startsWith('graph:') ? id.slice(6) : id;
  const prefix = inner.split(':')[0];
  if (prefix === 'gene' || entry.category === 'Gene') return 'gene';
  if (prefix === 'protein') return 'protein';
  if (prefix === 'variant') return 'variant';
  if (prefix === 'precision_context' || entry.entity_type === 'precision_oncology') return 'precision_context';
  if (prefix === 'test' || prefix === 'assay' || entry.entity_type === 'diagnostic' || entry.entity_type === 'screening') return 'test';
  if (prefix === 'compound' || entry.entity_type === 'intervention') return 'intervention';
  if (prefix === 'condition' || entry.entity_type === 'condition') return 'condition';
  if (prefix === 'pathway') return 'pathway';
  if (prefix === 'metabolite') return 'metabolite';
  if (prefix === 'biomarker' || entry.entity_type === 'biomarker') return 'biomarker';
  if (entry.path) {
    const mapped = parseOsPath(entry.path);
    if (mapped.kind) return mapped.kind;
  }
  return entry.entity_type || 'biomarker';
}

export function pathForEntry(entry) {
  const id = String(entry.id || '').replace(/^graph:/, '');
  if (id.includes(':')) {
    const fromId = osPathFromId(id);
    if (fromId !== '/catalog') return fromId;
  }
  if (entry.path) {
    const mapped = parseOsPath(entry.path);
    if (mapped.screen === 'entity') return osPathFromId(graphId(mapped.kind, mapped.slug));
  }
  return '/catalog';
}

export function parseOsPath(pathname = '/', search = '') {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search || '');
  if (path === '/') return {screen: 'workbench'};
  if (path === '/workspace') return {screen: 'workspace'};
  if (path === '/catalog' || path === '/explore') {
    return {screen: 'catalog', type: params.get('type') || '', q: params.get('q') || ''};
  }
  if (path === '/research' || path === '/interventions') {
    return {screen: 'catalog', type: 'intervention', q: params.get('q') || ''};
  }
  if (path === '/graph') return {screen: 'graph', focus: params.get('focus') || ''};
  if (path === '/investigate' || path === '/explore/matcher' || path === '/connect' || path === '/researcher') {
    return {screen: 'investigate'};
  }
  if (path === '/explore/compare') return {screen: 'compare'};
  if (path === '/methods' || path === '/learn' || path === '/learn/basics' || path === '/learn/evidence' || path === '/methodology') {
    return {screen: 'methods', hash: path === '/methodology' ? 'methodology' : ''};
  }
  if (path === '/privacy') return {screen: 'privacy'};
  if (path === '/terms') return {screen: 'terms'};
  if (path === '/biomarkers' || path === '/tests' || path === '/diagnostics' || path === '/screening' || path === '/precision-medicine' || path === '/conditions') {
    const type = {
      '/biomarkers': 'biomarker',
      '/tests': 'test',
      '/diagnostics': 'test',
      '/screening': 'test',
      '/precision-medicine': 'precision_context',
      '/conditions': 'condition',
    }[path];
    return {screen: 'catalog', type, q: params.get('q') || ''};
  }

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && PREFIX_KIND[parts[0]]) {
    return {screen: 'entity', kind: PREFIX_KIND[parts[0]], slug: parts[1], id: graphId(PREFIX_KIND[parts[0]], parts[1])};
  }
  if (parts.length === 2 && OLD_ROOT_TO_KIND[parts[0]]) {
    const kind = inferKindFromLegacySlug(OLD_ROOT_TO_KIND[parts[0]], parts[1]);
    return {screen: 'entity', kind, slug: stripKindSuffix(parts[1]), id: graphId(kind, stripKindSuffix(parts[1])), legacy: true};
  }
  return {screen: 'not-found', path};
}

const SUFFIX_KIND = {'-gene': 'gene', '-protein': 'protein', '-variant': 'variant'};

export function stripKindSuffix(slug) {
  for (const suffix of Object.keys(SUFFIX_KIND)) {
    if (slug.endsWith(suffix) && slug.length > suffix.length) return slug.slice(0, -suffix.length);
  }
  return slug;
}

export function inferKindFromLegacySlug(fallback, slug) {
  for (const [suffix, kind] of Object.entries(SUFFIX_KIND)) {
    if (slug.endsWith(suffix) && slug.length > suffix.length) return kind;
  }
  return fallback;
}

export function titleForRoute(route) {
  if (route.screen === 'workbench') return 'Clarity';
  if (route.screen === 'workspace') return 'Workspace';
  if (route.screen === 'catalog') return route.type ? `${KIND_LABEL[route.type] || route.type} · Catalog` : 'Catalog';
  if (route.screen === 'graph') return 'Graph';
  if (route.screen === 'investigate') return 'Investigation';
  if (route.screen === 'compare') return 'Compare';
  if (route.screen === 'methods') return 'Methods';
  if (route.screen === 'entity') return route.slug;
  return 'Clarity';
}

export function isQuestionQuery(text) {
  const q = String(text || '').trim();
  if (!q) return false;
  if (q.includes('?')) return true;
  return /^(does|do|did|what|which|how|why|is|are|can|could|should|where|when|who)\b/i.test(q)
    || /\b(pathways?|associated with|predict|compare|evidence for)\b/i.test(q);
}
