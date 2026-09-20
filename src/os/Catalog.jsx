import React, {useMemo, useState} from 'react';
import {KIND_LABEL} from './routes.js';
import {identityFromEntry, DERIVED_IDENTITIES} from './identity.js';
import {kindColor} from './Figures.jsx';
import {searchEntities} from './search.js';
import {kindBadge} from '../evidence/graphProfile.js';

const FILTERS = [
  ['', 'All kinds'],
  ['gene', 'Genes'],
  ['protein', 'Proteins'],
  ['biomarker', 'Biomarkers'],
  ['intervention', 'Interventions'],
  ['variant', 'Variants'],
  ['test', 'Tests'],
  ['precision_context', 'Precision contexts'],
  ['condition', 'Conditions'],
];

function asRow(entry) {
  const ident = identityFromEntry(entry);
  return {
    ...entry,
    id: ident.id,
    kind: ident.kind,
    path: ident.path,
    envelope: ident.envelope,
    rawId: ident.rawId,
  };
}

export default function Catalog({entries, go, initialType = '', initialQuery = ''}) {
  const [type, setType] = useState(initialType || '');
  const [q, setQ] = useState(initialQuery || '');
  const [selected, setSelected] = useState(null);
  const normalized = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const e of entries || []) {
      const row = asRow(e);
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    return rows;
  }, [entries]);
  const rows = useMemo(() => {
    const typed = type === 'protein' && !normalized.some(e => e.kind === 'protein')
      ? DERIVED_IDENTITIES.map(d => ({...d, kind: 'protein', coverage: {}, utility_indexed: false}))
      : (type ? normalized.filter(e => e.kind === type) : normalized);
    if (!q.trim()) return [...typed].sort((a, b) => (b.coverage?.quantified_outcomes || 0) - (a.coverage?.quantified_outcomes || 0) || a.name.localeCompare(b.name));
    const hits = searchEntities(entries || [], q, 400);
    if (type) return hits.filter(h => h.kind === type);
    return hits;
  }, [normalized, entries, type, q]);
  const preview = selected || rows[0];
  const counts = useMemo(() => {
    const c = {'': normalized.length};
    for (const e of normalized) c[e.kind] = (c[e.kind] || 0) + 1;
    if (!c.protein) c.protein = DERIVED_IDENTITIES.length;
    return c;
  }, [normalized]);

  return (
    <div className="os-catalog">
      <aside className="os-filters">
        <p className="os-eyebrow">Catalog</p>
        <h2>Typed objects</h2>
        <p className="os-note">One object, one id. Catalog <code>entity:</code> rows resolve to the same canonical id as their graph node. Proteins without a graph node appear only as derived identity views.</p>
        <div className="os-filter-list">
          {FILTERS.map(([id, label]) => (
            <button key={id || 'all'} type="button" aria-pressed={type === id} onClick={() => { setType(id); setSelected(null); }} style={{'--kind': kindColor(id || 'biomarker')}}>
              {label}<span className="os-num">{id === 'protein' && !normalized.some(e => e.kind === 'protein') ? 'derived' : (counts[id] || 0)}</span>
            </button>
          ))}
        </div>
        {type === 'protein' && !normalized.some(e => e.kind === 'protein') && (
          <p className="os-warn" style={{marginTop: 16}}>This catalog snapshot has no <code>protein:</code> nodes. Derived identity views are listed here so a protein is not silently collapsed into its biomarker.</p>
        )}
      </aside>
      <section className="os-catalog-main">
        <div className="os-search-field">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter this ledger…" aria-label="Filter catalog" />
          <span className="os-num">{rows.length}</span>
        </div>
        <div style={{overflow: 'auto', maxHeight: 'calc(100vh - 120px)'}}>
          <table className="os-ledger">
            <thead>
              <tr><th>Kind</th><th>Name</th><th>Canonical id</th><th>Findings</th><th>Publications</th><th>Utility</th></tr>
            </thead>
            <tbody>
              {rows.map(e => {
                const badge = kindBadge(e);
                return (
                  <tr key={e.id} aria-selected={preview?.id === e.id} onClick={() => setSelected(e)} onDoubleClick={() => go(e.path)}>
                    <td className="os-kind" style={{'--kind': kindColor(e.kind)}}>{KIND_LABEL[e.kind] || e.kind}</td>
                    <td>{e.name}{e.derived || e.origin === 'derived' ? <small className="os-note"> · derived</small> : null}</td>
                    <td className="os-id">{e.id}</td>
                    <td className="os-num">{e.derived ? '—' : badge.text}</td>
                    <td className="os-num">{e.coverage?.linked_studies ?? '—'}</td>
                    <td>{e.derived ? <span className="os-gap">Not a finding source</span> : e.utility_indexed ? 'Indexed' : <span className="os-gap">None</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="os-preview">
        {preview ? (
          <>
            <p className="os-kind" style={{'--kind': kindColor(preview.kind)}}>{KIND_LABEL[preview.kind]}</p>
            <h2>{preview.name}</h2>
            <p className="os-id">{preview.id}</p>
            {(preview.derived || preview.origin === 'derived') && <p className="os-warn">Derived identity view. Not a graph protein node.</p>}
            <p className="os-lead">{preview.summary || 'No summary stored on this catalog row.'}</p>
            <dl className="os-facts">
              <div><dt>Publications</dt><dd className="os-num">{preview.coverage?.linked_studies ?? '—'}</dd></div>
              <div><dt>Quantified outcomes</dt><dd className="os-num">{preview.coverage?.quantified_outcomes ?? '—'}</dd></div>
              <div><dt>Layers tagged</dt><dd>{(preview.graph_layers || []).join(' · ') || '—'}</dd></div>
            </dl>
            <div className="os-actions">
              <button className="os-primary" type="button" onClick={() => go(preview.path)}>Open instrument</button>
              <button className="os-ghost" type="button" onClick={() => go(`/graph?focus=${encodeURIComponent(preview.id)}`)}>Graph</button>
            </div>
          </>
        ) : <p className="os-note">No rows in this filter.</p>}
      </aside>
    </div>
  );
}
