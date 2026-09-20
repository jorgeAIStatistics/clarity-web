import {sameIdentity} from './identity.js';

const KEY = 'clarity-os-v1';
const PROJECTS = 'clarity-research-projects-v1';

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      recents: Array.isArray(raw.recents) ? raw.recents : [],
      pins: Array.isArray(raw.pins) ? raw.pins : [],
      collections: Array.isArray(raw.collections) ? raw.collections : [],
      comparisons: Array.isArray(raw.comparisons) ? raw.comparisons : [],
      figures: Array.isArray(raw.figures) ? raw.figures : [],
      studies: Array.isArray(raw.studies) ? raw.studies : [],
      paths: Array.isArray(raw.paths) ? raw.paths : [],
      lastGraphFocus: raw.lastGraphFocus || null,
    };
  } catch {
    return {recents: [], pins: [], collections: [], comparisons: [], figures: [], studies: [], paths: [], lastGraphFocus: null};
  }
}

function write(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

function itemKey(entry) {
  return {id: entry.id, path: entry.path, kind: entry.kind};
}

export function loadOsStore() {
  return read();
}

export function rememberEntity(entry) {
  if (!entry?.id) return read();
  const state = read();
  const item = {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    path: entry.path,
    origin: entry.origin,
    at: new Date().toISOString(),
  };
  state.recents = [item, ...state.recents.filter(x => !sameIdentity(itemKey(x), itemKey(entry)))].slice(0, 24);
  return write(state);
}

export function rememberLastGraphFocus(entry) {
  if (!entry?.id) return read();
  const state = read();
  state.lastGraphFocus = {...entry, at: new Date().toISOString()};
  return write(state);
}

export function togglePin(entry) {
  const state = read();
  const exists = state.pins.some(x => sameIdentity(itemKey(x), itemKey(entry)));
  state.pins = exists
    ? state.pins.filter(x => !sameIdentity(itemKey(x), itemKey(entry)))
    : [{...entry, at: new Date().toISOString()}, ...state.pins].slice(0, 40);
  return write(state);
}

export function pinStudy(study) {
  const state = read();
  const id = study.pmid ? `pmid:${study.pmid}` : study.id;
  if (!id) return state;
  const item = {id, pmid: study.pmid, title: study.title, year: study.year, path: study.path, at: new Date().toISOString()};
  state.studies = [item, ...state.studies.filter(x => x.id !== id)].slice(0, 40);
  return write(state);
}

export function saveComparison(ids) {
  const state = read();
  state.comparisons = [{id: ids.join('|'), ids, at: new Date().toISOString()}, ...state.comparisons].slice(0, 12);
  return write(state);
}

export function savePinnedPath(path) {
  const state = read();
  const item = {
    id: path.id || `path:${Date.now()}`,
    name: path.name,
    hops: path.hops || [],
    at: new Date().toISOString(),
  };
  state.paths = [item, ...(state.paths || []).filter(p => p.id !== item.id)].slice(0, 20);
  return write(state);
}

export function addToCollection(name, entry) {
  const state = read();
  const title = String(name || 'Untitled collection').slice(0, 80);
  let col = state.collections.find(c => c.name === title);
  if (!col) {
    col = {id: `col:${Date.now()}`, name: title, items: [], at: new Date().toISOString()};
    state.collections = [col, ...state.collections].slice(0, 20);
  }
  if (!col.items.some(x => sameIdentity(itemKey(x), itemKey(entry)))) {
    col.items = [{id: entry.id, name: entry.name, kind: entry.kind, path: entry.path}, ...col.items];
  }
  return write(state);
}

export function loadInvestigations() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS) || '[]').filter(p => p.schema === 1);
  } catch {
    return [];
  }
}

export const STORAGE_NOTE = 'Saved on this browser only. Clarity has no accounts in this release. Clearing site data deletes recents, pins, collections and investigations.';
