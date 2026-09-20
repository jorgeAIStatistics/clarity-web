import {isQuestionQuery, KIND_LABEL} from './routes.js';
import {derivedForQuery, identityFromEntry} from './identity.js';

const squeeze = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const tokens = text => String(text || '').split(/[^A-Za-z0-9]+/).filter(Boolean);

function startsAsWord(hay, q) {
  if (!q) return false;
  if (hay === q) return true;
  if (!hay.startsWith(q)) return false;
  const next = hay[q.length];
  return !next || /[^a-z0-9]/.test(next);
}

const KIND_TIE = {
  gene: 0,
  variant: 1,
  protein: 2,
  precision_context: 3,
  biomarker: 4,
  metabolite: 5,
  test: 6,
  intervention: 7,
  condition: 8,
  pathway: 9,
};

export function matchScore(entry, query) {
  const raw = String(query || '').trim();
  const q = raw.toLowerCase();
  if (!q) return 0;
  const tight = squeeze(q);
  const name = String(entry.name || '').toLowerCase();
  const aliases = (entry.aliases || []).map(a => String(a));
  const aliasesLower = aliases.map(a => a.toLowerCase());
  const id = String(entry.id || '').toLowerCase().replace(/^graph:/, '');
  const slug = id.split(':').slice(1).join(':');
  const nameTokens = tokens(entry.name);
  const aliasTokens = aliases.flatMap(tokens);
  let score = 0;

  if (name === q || squeeze(name) === tight) score = 100;
  else if (nameTokens.some(t => t === raw)) score = 97;
  else if (startsAsWord(name, q) || startsAsWord(squeeze(name), tight)) score = 80;
  else if (aliasTokens.some(t => t === raw) || aliases.includes(raw)) score = 74;
  else if (nameTokens.some(t => t.toLowerCase() === q)) score = 78;
  else if (aliasesLower.includes(q) || aliases.some(a => squeeze(a) === tight)) score = 70;
  else if (aliasesLower.some(a => startsAsWord(a, q))) score = 64;
  else if (id === q || slug === tight) score = 68;
  else {
    const hay = [name, ...aliasesLower].join(' ');
    if (name.includes(q) || (tight.length > 1 && squeeze(hay).includes(tight))) {
      const tok = [...name.split(/[^a-z0-9]+/), ...aliasesLower];
      if (tok.some(t => t === q || startsAsWord(t, q))) score = 40;
      else if (tight.length >= 5) score = 16;
    }
  }
  if (!score) return 0;

  // Gene symbol on the id beats a same-spelling alias on another object,
  // except EGFR vs eGFR: mixed-case eGFR is the filtration estimate, not the gene.
  const filtrationCase = /^e[A-Z]/.test(raw);
  if (!filtrationCase && id.startsWith('gene:') && slug === tight) score = Math.max(score, 100);
  if (!filtrationCase && id.startsWith('variant:') && (slug === tight || slug.startsWith(`${tight}-`))) score = Math.max(score, 88);
  if (score < 90 && id.startsWith('protein:') && slug.replace(/-/g, '') === tight) score += 6;
  return score;
}

export function searchEntities(entries, query, limit = 24) {
  const scored = [];
  const seen = new Set();
  for (const entry of entries || []) {
    const ident = identityFromEntry(entry);
    if (seen.has(ident.id)) continue;
    const scoredEntry = {...entry, id: ident.id};
    const score = matchScore(scoredEntry, query);
    if (!score) continue;
    seen.add(ident.id);
    scored.push({
      score,
      kind: ident.kind,
      kindLabel: KIND_LABEL[ident.kind] || ident.kind,
      id: ident.id,
      name: entry.name,
      aliases: entry.aliases || [],
      summary: entry.summary || '',
      path: ident.path,
      coverage: entry.coverage || {},
      category: entry.category || '',
      entity_type: entry.entity_type,
      graph_layers: entry.graph_layers || [],
      finding_kinds: entry.finding_kinds || {},
      utility_indexed: entry.utility_indexed,
      review_status: entry.review_status,
      origin: ident.envelope === 'entity' ? 'catalog' : 'graph',
      envelope: ident.envelope,
    });
  }
  for (const derived of derivedForQuery(query)) {
    if (seen.has(derived.id)) continue;
    const score = matchScore(derived, query);
    if (!score) continue;
    seen.add(derived.id);
    scored.push({
      score,
      kind: derived.kind,
      kindLabel: 'Protein',
      id: derived.id,
      name: derived.name,
      aliases: derived.aliases || [],
      summary: derived.summary,
      path: derived.path,
      coverage: {},
      derived: true,
      origin: 'derived',
    });
  }
  scored.sort((a, b) => b.score - a.score
    || (KIND_TIE[a.kind] ?? 20) - (KIND_TIE[b.kind] ?? 20)
    || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

export function disambiguate(hits, query) {
  const q = squeeze(query);
  if (!q) return {ambiguous: false, kinds: [], items: hits};
  const pool = hits.filter(h =>
    squeeze(h.name).includes(q)
    || squeeze(h.id).includes(q)
    || (h.aliases || []).some(a => squeeze(a).includes(q))
  );
  const kinds = [...new Set(pool.map(h => h.kind))];
  return {ambiguous: kinds.length > 1 && pool.length > 1, kinds, items: pool.length ? pool : hits};
}

export function classifyCommand(query) {
  const text = String(query || '').trim();
  if (!text) return {mode: 'idle'};
  if (text.startsWith('/')) {
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    return {mode: 'command', cmd: (cmd || '').toLowerCase(), arg: rest.join(' ')};
  }
  if (isQuestionQuery(text)) return {mode: 'question', text};
  return {mode: 'entity', text};
}

export function emptyLayers() {
  return ['mechanism', 'preclinical', 'observational', 'interventional', 'guidelines'].map(layer => ({
    layer, n_findings: 0, status: 'GAP', sentences: [],
  }));
}
