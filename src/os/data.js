import {useEffect, useState} from 'react';
import {API_BASE} from '../platform/api.js';
import {bundledCatalog, bundledProfile, graphCandidates} from '../evidence/graphProfile.js';
import {emptyLayers} from './search.js';
import {libraryKind} from './routes.js';

export function useLibrary() {
  const [state, setState] = useState({status: 'loading', entries: []});
  useEffect(() => {
    let live = true;
    const once = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const r = await fetch(`${API_BASE}/api/library`, {signal: controller.signal});
        if (!r.ok) throw Object.assign(Error('fail'), {outcome: r.status});
        return r.json();
      } finally { clearTimeout(timer); }
    };
    once()
      .then(d => { if (live && Array.isArray(d.entries)) setState({status: 'ready', entries: d.entries, meta: d}); })
      .catch(async () => {
        const bundled = await bundledCatalog();
        if (!live) return;
        if (bundled?.entries) setState({status: 'snapshot', entries: bundled.entries, meta: bundled});
        else setState({status: 'error', entries: []});
      });
    return () => { live = false; };
  }, []);
  return state;
}

export function useOsEntity(kind, slug) {
  const [state, setState] = useState({status: 'loading'});
  useEffect(() => {
    if (!kind || !slug) { setState({status: 'missing'}); return undefined; }
    let live = true;
    const ids = candidateIds(kind, slug);
    const once = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        for (const id of ids) {
          const r = await fetch(`${API_BASE}/api/evidence/graph/entity/${encodeURIComponent(id)}`, {signal: controller.signal});
          if (r.status === 404) continue;
          if (!r.ok) throw Object.assign(Error('fail'), {outcome: r.status});
          return {id, data: await r.json(), source: 'live'};
        }
        return null;
      } finally { clearTimeout(timer); }
    };
    once()
      .then(async hit => {
        if (!live) return;
        if (hit?.data) { setState({status: 'ready', data: hit.data, source: 'live', requested: ids[0]}); return; }
        const resolved = await resolveOffline(ids, kind, slug);
        if (!live) return;
        if (resolved) setState({status: 'ready', ...resolved, requested: ids[0]});
        else setState({status: 'missing', requested: ids[0]});
      })
      .catch(async () => {
        const resolved = await resolveOffline(ids, kind, slug);
        if (!live) return;
        if (resolved) setState({status: 'ready', ...resolved, requested: ids[0]});
        else setState({status: 'error'});
      });
    return () => { live = false; };
  }, [kind, slug]);
  return state;
}

async function resolveOffline(ids, kind, slug) {
  const bundled = await bundledProfile(ids);
  if (bundled) return {data: bundled, source: 'snapshot'};
  if (kind === 'protein') {
    const derived = await deriveProtein(slug);
    if (derived) return {data: derived, source: 'derived'};
  }
  const catalog = await catalogFallback(ids, kind);
  if (catalog) return {data: catalog, source: 'catalog'};
  return null;
}

function candidateIds(kind, slug) {
  if (kind === 'gene') return [`gene:${slug}`, ...graphCandidates('biomarker', `${slug}-gene`)];
  if (kind === 'protein') return [`protein:${slug}`, `protein:${slug.replace(/^il/, 'il-')}`, ...graphCandidates('biomarker', `${slug}-protein`)];
  if (kind === 'variant') return [`variant:${slug}`, ...graphCandidates('biomarker', `${slug}-variant`)];
  if (kind === 'intervention') return [`compound:${slug}`];
  if (kind === 'precision_context') return [`precision_context:${slug}`];
  if (kind === 'test') return [`test:${slug}`, `assay:${slug}`];
  return graphCandidates('biomarker', slug);
}

async function deriveProtein(slug) {
  const markerIds = [`biomarker:${slug}`, `biomarker:${slug.replace(/(\d)/, '-$1')}`];
  const tryIds = /il-?18/i.test(slug) ? ['biomarker:il-18', ...markerIds] : markerIds;
  const bundled = await bundledProfile([...new Set(tryIds)]);
  if (!bundled?.entity) return null;
  const e = bundled.entity;
  const geneRel = (bundled.related || []).find(r => r.edge === 'ENCODED_BY');
  const geneId = geneRel?.id || (e.locus?.gene_symbol ? `gene:${e.locus.gene_symbol.toLowerCase()}` : null);
  return {
    entity: {
      id: `protein:${(e.locus?.gene_symbol || slug).toLowerCase()}`,
      name: `${e.name} protein`,
      kind: 'Protein',
      type: 'protein',
      aliases: e.aliases || [],
      external_ids: e.external_ids || {},
      locus: e.locus,
      identity: {
        entity_class: e.identity?.entity_class || 'Protein product',
        identity_sentence: e.identity?.identity_sentence || `${e.name} is a protein product.`,
      },
    },
    layers: emptyLayers(),
    findings: [],
    quoted: [],
    related: [
      geneId ? {edge: 'ENCODED_BY', id: geneId, name: geneRel?.name || `${e.locus?.gene_symbol} gene`, kind: 'Gene', outgoing: true} : null,
      {edge: 'RELATED_TO', reason: 'measures', id: e.id, name: e.name, kind: 'Biomarker', outgoing: true},
    ].filter(Boolean),
    studies: 0,
    dead_letters: [],
    derived_from: e.id,
    derived_note: `${e.name} is indexed in this library as a measured biomarker, not as a separate protein node. This view is the molecular object (UniProt ${e.external_ids?.uniprot || 'unrecorded'}). Protein-level findings are not copied from the biomarker page: gene, protein and circulating measurement stay distinct.`,
  };
}

async function catalogFallback(ids) {
  const bundled = await bundledCatalog();
  const entries = bundled?.entries || [];
  for (const id of ids) {
    const entry = entries.find(e => e.id === `graph:${id}` || e.id === id);
    if (!entry) continue;
    const k = libraryKind(entry);
    return {
      entity: {
        id,
        name: entry.name,
        kind: k === 'gene' ? 'Gene' : k === 'protein' ? 'Protein' : k === 'variant' ? 'Variant' : 'Entity',
        type: k,
        aliases: entry.aliases || [],
        identity: {identity_sentence: `${entry.name} is indexed in the Clarity catalog as a ${k}.`},
      },
      layers: emptyLayers(),
      findings: [],
      quoted: [],
      related: [],
      studies: entry.coverage?.linked_studies ?? 0,
      dead_letters: [],
      catalog_only: true,
      catalog_note: `The live graph entity payload was unavailable. This page uses the catalog row only — it does not reconstruct typed findings. Catalog coverage: ${entry.coverage?.quantified_outcomes || 0} quantified outcomes, ${entry.coverage?.linked_studies || 0} publications.${entry.summary ? ` Catalog note: ${entry.summary}` : ''}`,
    };
  }
  return null;
}
