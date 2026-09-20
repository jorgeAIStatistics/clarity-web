import React from 'react';
import {layerLabel, valueText, relationLabel} from '../evidence/graphProfile.js';
import {osPathFromId} from './routes.js';
import {pinStudy} from './store.js';

export default function Inspector({item, go}) {
  if (!item) {
    return (
      <aside className="os-inspect" aria-label="Inspector">
        <p className="os-eyebrow">Inspector</p>
        <h2 style={{fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, margin: '8px 0'}}>Select a finding, study or edge</h2>
        <p className="os-note">Quotes stay quotes. Estimates stay as extracted. Nothing here is pooled or graded by color.</p>
      </aside>
    );
  }
  if (item.type === 'node' || item.type === 'edge') {
    const n = item.node || item;
    return (
      <aside className="os-inspect">
        <p className="os-eyebrow">Graph object</p>
        <h2 style={{fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, margin: '6px 0 8px'}}>{n.name}</h2>
        <p className="os-id">{n.id}</p>
        {item.edge && <p className="os-lead">{relationLabel(item.edge)}{item.edge.reason ? ` · ${item.edge.reason}` : ''}</p>}
        <p className="os-note">{n.kind}. Opening this object loads its own 1-hop neighborhood. Multi-hop queries are not available in this release.</p>
        <div className="os-actions">
          <a className="os-primary" href={osPathFromId(n.id)} onClick={e => { e.preventDefault(); go(osPathFromId(n.id)); }}>Open instrument</a>
        </div>
      </aside>
    );
  }
  const f = item.finding || item;
  return (
    <aside className="os-inspect">
      <p className="os-eyebrow">Finding</p>
      <h2 style={{fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, margin: '6px 0 8px'}}>{valueText(f)}</h2>
      <dl className="os-facts">
        <div><dt>Kind</dt><dd>{f.kind || '—'}</dd></div>
        <div><dt>Target</dt><dd>{f.target || '—'}</dd></div>
        <div><dt>Population</dt><dd>{f.population || '—'}</dd></div>
        <div><dt>Assay</dt><dd>{f.assay || '—'}</dd></div>
        <div><dt>Layer</dt><dd>{f.layer ? layerLabel(f.layer) : '—'}</dd></div>
        <div><dt>Review</dt><dd>{f.review_state || 'automated'}</dd></div>
      </dl>
      {f.quote && <blockquote style={{margin: '12px 0', paddingLeft: 12, borderLeft: '2px solid var(--signal)', color: 'var(--text-2)', fontSize: 13}}>{f.quote}</blockquote>}
      <p className="os-note">{f.pmid ? <a href={`https://pubmed.ncbi.nlm.nih.gov/${f.pmid}/`} target="_blank" rel="noreferrer">PMID {f.pmid}</a> : 'No PMID'}{f.year ? ` · ${f.year}` : ''}{f.title ? ` · ${f.title}` : ''}</p>
      {f.pmid && <button className="os-ghost" style={{marginTop: 10}} onClick={() => pinStudy(f)}>Save study to this browser</button>}
    </aside>
  );
}
