import React from 'react';
import {kindColor} from './Figures.jsx';
import {KIND_LABEL} from './routes.js';
import {SOURCE_META, visualExtractId} from './identity.js';
import {findingPreview} from './graphModel.js';
import {pinStudy} from './store.js';

export default function GraphInspect({
  selection,
  focus,
  origin,
  go,
  onFocus,
  onAddHop,
  onPin,
  canAddHop,
  isFocus,
}) {
  if (!selection) {
    return (
      <aside className="os-inspect os-graph-inspect" aria-label="Graph inspector">
        <p className="os-eyebrow">Inspector</p>
        <h2>Select a node or an edge</h2>
        <p className="os-note">A node is an object. An edge is a typed relationship from this 1-hop payload. Color is kind, not significance. Topology is not evidence strength.</p>
      </aside>
    );
  }
  if (selection.type === 'edge') return (
    <EdgeInspect
      edge={selection.edge}
      origin={origin}
      go={go}
      onFocus={onFocus}
      onAddHop={onAddHop}
      canAddHop={canAddHop}
    />
  );
  return (
    <NodeInspect
      node={selection.node}
      edge={selection.edge}
      origin={origin}
      go={go}
      onFocus={onFocus}
      onAddHop={onAddHop}
      onPin={onPin}
      canAddHop={canAddHop}
      isFocus={isFocus}
    />
  );
}

function NodeInspect({node, edge, origin, go, onFocus, onAddHop, onPin, canAddHop, isFocus}) {
  const ident = {id: node.id, kind: node.kind, slug: String(node.id).split(':').slice(1).join(':')};
  const compareOk = ['biomarker', 'test', 'precision_context', 'intervention'].includes(node.kind);
  const derived = (node.origin || origin) === 'derived';
  const catalog = (node.origin || origin) === 'catalog';
  return (
    <aside className="os-inspect os-graph-inspect" aria-label="Node inspector">
      <p className="os-eyebrow">Node</p>
      <p className="os-kind" style={{'--kind': kindColor(node.kind)}}>{node.kindLabel || KIND_LABEL[node.kind]}</p>
      <h2>{node.name}</h2>
      <p className="os-id">{node.id}</p>
      <p className="os-note">{SOURCE_META[node.origin || origin]?.short || node.origin || origin || 'Origin as on this payload.'}</p>
      {derived && <p className="os-warn">Derived identity. Not a graph protein node. Findings are not copied onto it.</p>}
      {catalog && <p className="os-warn">Catalog-backed. Focusing this object will not invent edges.</p>}
      {edge && (
        <p className="os-lead">{edge.label}{edge.reason ? ` · ${edge.reason}` : ''} — {edge.classTitle}</p>
      )}
      <p className="os-caption">Q coverage is not inferred from this neighbor record. Open or focus the object to read its own payload.</p>
      <div className="os-actions">
        {!isFocus && <button className="os-primary" type="button" onClick={() => onFocus(node)}>Focus here</button>}
        <button className="os-ghost" type="button" onClick={() => go(node.path)}>Open entity</button>
        {canAddHop && <button className="os-ghost" type="button" onClick={() => onAddHop(edge)}>Add to path</button>}
        <button className="os-ghost" type="button" onClick={() => onPin(node)}>Pin</button>
        {compareOk && (
          <button className="os-ghost" type="button" onClick={() => go(`/compare?profile=${encodeURIComponent(visualExtractId(ident))}`)}>Compare</button>
        )}
        <button className="os-ghost" type="button" onClick={() => go(`/investigate?evidence=${encodeURIComponent(node.name)}`)}>Start investigation</button>
      </div>
      <p className="os-caption">Investigation opens the existing question map. It is not rebuilt in this release. Focus here loads this object’s own 1-hop — not a multi-hop query.</p>
    </aside>
  );
}

function EdgeInspect({edge, origin, go, onFocus, onAddHop, canAddHop}) {
  const ev = edge.evidence;
  const previews = (ev.attached || []).slice(0, 4).map(findingPreview);
  return (
    <aside className="os-inspect os-graph-inspect" aria-label="Edge inspector">
      <p className="os-eyebrow">Edge</p>
      <p className="os-kind" data-class={edge.class}>{edge.classTitle}</p>
      <h2>{edge.label}</h2>
      <p className="os-id">{edge.edge}{edge.reason ? ` · ${edge.reason}` : ''}</p>
      <dl className="os-facts">
        <div><dt>Source</dt><dd>{edge.source.kindLabel || edge.source.kind} · {edge.source.name}<div className="os-id">{edge.source.id}</div></dd></div>
        <div><dt>Target</dt><dd>{edge.target.kindLabel || edge.target.kind} · {edge.target.name}<div className="os-id">{edge.target.id}</div></dd></div>
        <div><dt>Origin</dt><dd>{SOURCE_META[edge.origin || origin]?.short || edge.origin || origin || '—'}</dd></div>
      </dl>
      <p className="os-lead">{edge.meaning}</p>
      <p className="os-warn">{ev.note}</p>
      {previews.map(f => (
        <figure key={f.id} className="os-g-finding">
          <strong>{f.text}</strong>
          <p className="os-note">{[f.kind, f.layer, f.population].filter(Boolean).join(' · ')}</p>
          {f.quote && <blockquote>{f.quote}</blockquote>}
          <p className="os-note">
            {f.pmid ? <a href={`https://pubmed.ncbi.nlm.nih.gov/${f.pmid}/`} target="_blank" rel="noreferrer">PMID {f.pmid}</a> : 'No PMID'}
            {f.year ? ` · ${f.year}` : ''}
            {f.review ? ` · ${f.review}` : ''}
          </p>
          {f.pmid && <button className="os-ghost" type="button" onClick={() => pinStudy(f)}>Save study</button>}
        </figure>
      ))}
      <div className="os-actions">
        <button className="os-primary" type="button" onClick={() => onFocus(edge.target)}>Focus target</button>
        <button className="os-ghost" type="button" onClick={() => go(edge.target.path)}>Open target</button>
        {canAddHop && <button className="os-ghost" type="button" onClick={() => onAddHop(edge)}>Add to path</button>}
        <button className="os-ghost" type="button" onClick={() => go(`/investigate?evidence=${encodeURIComponent(`${edge.source.name} ${edge.label} ${edge.target.name}`)}`)}>Start investigation</button>
      </div>
    </aside>
  );
}
