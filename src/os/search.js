import {isQuestionQuery, libraryKind, pathForEntry, KIND_LABEL} from './routes.js';

const squeeze = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function matchScore(entry, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const tight = squeeze(q);
  const name = String(entry.name || '').toLowerCase();
  const aliases = (entry.aliases || []).map(a => String(a).toLowerCase());
  const hay = [name, ...aliases, entry.category, entry.path, entry.id].join(' ').toLowerCase();
  const id = String(entry.id || '').toLowerCase();
  let score = 0;
  if (name === q || squeeze(name) === tight) score = 100;
  else if (name.startsWith(q) || squeeze(name).startsWith(tight)) score = 80;
  else if (aliases.includes(q) || aliases.some(a => squeeze(a) === tight)) score = 68;
  else if (aliases.some(a => a.startsWith(q))) score = 70;
  else if (hay.includes(q) || (tight.length > 1 && squeeze(hay).includes(tight))) score = 40;
  if (!score) return 0;
  if (id.includes(`gene:${tight}`) || id.endsWith(`:${tight}`)) score += 8;
  if (id.includes(`variant:${tight}`)) score += 4;
  return score;
}

export function searchEntities(entries, query, limit = 24) {
  const scored = [];
  for (const entry of entries || []) {
    const score = matchScore(entry, query);
    if (!score) continue;
    const kind = libraryKind(entry);
    scored.push({
      score,
      kind,
      kindLabel: KIND_LABEL[kind] || kind,
      id: String(entry.id || '').replace(/^graph:/, ''),
      name: entry.name,
      aliases: entry.aliases || [],
      summary: entry.summary || '',
      path: pathForEntry(entry),
      coverage: entry.coverage || {},
      category: entry.category || '',
      entity_type: entry.entity_type,
      graph_layers: entry.graph_layers || [],
      finding_kinds: entry.finding_kinds || {},
      utility_indexed: entry.utility_indexed,
      review_status: entry.review_status,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
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
