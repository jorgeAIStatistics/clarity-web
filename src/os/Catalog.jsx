import React, {useMemo, useState} from 'react';
import {libraryKind, pathForEntry, KIND_LABEL} from './routes.js';
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

export default function Catalog({entries, go, initialType = '', initialQuery = ''}) {
  const [type, setType] = useState(initialType || '');
  const [q, setQ] = useState(initialQuery || '');
  const [selected, setSelected] = useState(null);
  const rows = useMemo(() => {
    const base = (entries || []).map(e => ({...e, kind: libraryKind(e), path: pathForEntry(e)}));
    const typed = type ? base.filter(e => e.kind === type) : base;
    if (!q.trim()) return typed.sort((a, b) => (b.coverage?.quantified_outcomes || 0) - (a.coverage?.quantified_outcomes || 0) || a.name.localeCompare(b.name));
    return searchEntities(typed, q, 400);
  }, [entries, type, q]);
  const preview = selected || rows[0];
  const counts = useMemo(() => {
    const c = {'': entries.length};
    for (const e of entries || []) {
      const k = libraryKind(e);
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [entries]);

  return (
    <div className="os-catalog">
      <aside className="os-filters">
        <p className="os-eyebrow">Catalog</p>
        <h2>Typed objects</h2>
        <p className="os-note">Interventions are a kind, not a separate product. Proteins without a graph node still appear when a UniProt identity can be opened from a related biomarker.</p>
        <div className="os-filter-list">
          {FILTERS.map(([id, label]) => (
            <button key={id || 'all'} type="button" aria-pressed={type === id} onClick={() => setType(id)} style={{'--kind': kindColor(id || 'biomarker')}}>
              {label}<span className="os-num">{id === 'protein' && !counts.protein ? 'view' : (counts[id] || 0)}</span>
            </button>
          ))}
        </div>
        {type === 'protein' && !counts.protein && (
          <p className="os-warn" style={{marginTop: 16}}>This catalog snapshot has no `protein:` nodes. Open <a href="/protein/il18" onClick={e => { e.preventDefault(); go('/protein/il18'); }}>IL-18 protein</a> as an identity view derived from the indexed biomarker — findings stay on the biomarker page.</p>
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
              <tr><th>Kind</th><th>Name</th><th>Findings</th><th>Publications</th><th>Utility</th></tr>
            </thead>
            <tbody>
              {rows.map(e => {
                const badge = kindBadge(e);
                return (
                  <tr key={e.id} aria-selected={preview?.id === e.id} onClick={() => setSelected(e)} onDoubleClick={() => go(e.path)}>
                    <td className="os-kind" style={{'--kind': kindColor(e.kind)}}>{KIND_LABEL[e.kind] || e.kind}</td>
                    <td>{e.name}</td>
                    <td className="os-num">{badge.text}</td>
                    <td className="os-num">{e.coverage?.linked_studies ?? '—'}</td>
                    <td>{e.utility_indexed ? 'Indexed' : <span className="os-gap">None</span>}</td>
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
            <p className="os-id">{String(preview.id).replace(/^graph:/, '')}</p>
            <p className="os-lead">{preview.summary || 'No summary stored on this catalog row.'}</p>
            <dl className="os-facts">
              <div><dt>Publications</dt><dd className="os-num">{preview.coverage?.linked_studies ?? '—'}</dd></div>
              <div><dt>Quantified outcomes</dt><dd className="os-num">{preview.coverage?.quantified_outcomes ?? '—'}</dd></div>
              <div><dt>Layers tagged</dt><dd>{(preview.graph_layers || []).join(' · ') || '—'}</dd></div>
            </dl>
            <div className="os-actions">
              <button className="os-primary" type="button" onClick={() => go(preview.path)}>Open instrument</button>
              <button className="os-ghost" type="button" onClick={() => go(`/graph?focus=${encodeURIComponent(String(preview.id).replace(/^graph:/, ''))}`)}>Graph</button>
            </div>
          </>
        ) : <p className="os-note">No rows in this filter.</p>}
      </aside>
    </div>
  );
}
