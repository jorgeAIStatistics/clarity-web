import React, {useMemo, useState} from 'react';
import {relationLabel} from '../evidence/graphProfile.js';
import {osPathFromId, KIND_LABEL} from './routes.js';
import {kindColor} from './Figures.jsx';

function kindOf(node) {
  if (node.kind) return String(node.kind).replace('PrecisionContext', 'precision_context').replace('Compound', 'intervention');
  const prefix = String(node.id || '').replace(/^graph:/, '').split(':')[0];
  return prefix === 'compound' ? 'intervention' : prefix;
}

export default function GraphNeighborhood({focus, related = [], go, onInspect, height = 420, note}) {
  const [mode, setMode] = useState('graph');
  const [kindFilter, setKindFilter] = useState('all');
  const [edgeFilter, setEdgeFilter] = useState('all');
  const [pinned, setPinned] = useState([]);
  const [selected, setSelected] = useState(null);

  const nodes = useMemo(() => {
    const center = {id: focus.id, name: focus.name, kind: focus.kind || focus.type, x: 0.5, y: 0.48};
    const edges = (related || []).filter(r => r.id && r.id !== focus.id)
      .filter(r => kindFilter === 'all' || kindOf(r) === kindFilter)
      .filter(r => edgeFilter === 'all' || r.edge === edgeFilter);
    const n = edges.length;
    const around = edges.map((r, i) => {
      const a = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2;
      const rad = n > 8 ? 0.38 : 0.32;
      return {
        ...r,
        x: 0.5 + Math.cos(a) * rad,
        y: 0.48 + Math.sin(a) * rad * 0.92,
      };
    });
    return {center, around, edges};
  }, [focus, related, kindFilter, edgeFilter]);

  const kinds = [...new Set((related || []).map(kindOf))];
  const edges = [...new Set((related || []).map(r => r.edge).filter(Boolean))];

  function inspect(node, edge) {
    const payload = {type: 'node', node, edge};
    setSelected(node.id);
    onInspect?.(payload);
  }

  const W = 900, H = height;
  return (
    <section className="os-module" aria-label="Knowledge graph neighborhood">
      <div className="os-graph-toolbar" style={{paddingLeft: 0}}>
        <p className="os-eyebrow" style={{marginRight: 8}}>1-hop neighborhood</p>
        <button className="os-ghost" aria-pressed={mode === 'graph'} onClick={() => setMode('graph')}>Graph</button>
        <button className="os-ghost" aria-pressed={mode === 'table'} onClick={() => setMode('table')}>Table</button>
        <label className="os-note">Kind
          <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} style={{marginLeft: 6, background: 'var(--panel)', color: 'inherit', border: '1px solid var(--line)'}}>
            <option value="all">All</option>
            {kinds.map(k => <option key={k} value={k}>{KIND_LABEL[k] || k}</option>)}
          </select>
        </label>
        <label className="os-note">Edge
          <select value={edgeFilter} onChange={e => setEdgeFilter(e.target.value)} style={{marginLeft: 6, background: 'var(--panel)', color: 'inherit', border: '1px solid var(--line)'}}>
            <option value="all">All</option>
            {edges.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <span className="os-note">{nodes.around.length} neighbor{nodes.around.length === 1 ? '' : 's'} indexed</span>
      </div>
      <p className="os-caption">{note || 'Only edges returned on this entity’s graph payload. Expanding a neighbor loads that object’s own 1-hop list — this is not a multi-hop query.'}</p>
      {mode === 'graph' ? (
        <div className="os-graph-canvas" style={{height}}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Neighborhood of ${focus.name}`}>
            {nodes.around.map(n => {
              const x1 = nodes.center.x * W, y1 = nodes.center.y * H, x2 = n.x * W, y2 = n.y * H;
              return (
                <g key={n.id + n.edge}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#33425a" strokeWidth="1.4" />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fill="#8b9bb3" fontSize="10" fontFamily="JetBrains Mono, monospace">{relationLabel(n)}</text>
                </g>
              );
            })}
            <NodeCircle node={nodes.center} W={W} H={H} active selected={selected === nodes.center.id} onClick={() => inspect(nodes.center)} />
            {nodes.around.map(n => (
              <NodeCircle key={n.id} node={n} W={W} H={H} selected={selected === n.id} onClick={() => inspect(n, n)} />
            ))}
          </svg>
        </div>
      ) : (
        <table className="os-ledger">
          <thead><tr><th>Edge</th><th>Neighbor</th><th>Kind</th><th></th></tr></thead>
          <tbody>
            {nodes.around.map(n => (
              <tr key={n.id + n.edge} onClick={() => inspect(n, n)}>
                <td>{relationLabel(n)}</td>
                <td>{n.name}</td>
                <td style={{color: kindColor(kindOf(n))}}>{KIND_LABEL[kindOf(n)] || n.kind}</td>
                <td><a href={osPathFromId(n.id)} onClick={e => { if (!e.metaKey) { e.preventDefault(); go(osPathFromId(n.id)); } }}>Open</a></td>
              </tr>
            ))}
            {!nodes.around.length && <tr><td colSpan={4}>No graph edges are indexed on this payload.</td></tr>}
          </tbody>
        </table>
      )}
      <div className="os-actions">
        {selected && selected !== focus.id && (
          <>
            <button className="os-ghost" onClick={() => { const n = nodes.around.find(x => x.id === selected); if (n) go(osPathFromId(n.id)); }}>Open selected entity</button>
            <button className="os-ghost" onClick={() => setPinned(p => p.includes(selected) ? p : [...p, `${focus.id}→${selected}`])}>Pin this hop</button>
          </>
        )}
        {pinned.length > 0 && <span className="os-note">Pinned path: {pinned.join(' · ')}</span>}
      </div>
    </section>
  );
}

function NodeCircle({node, W, H, onClick, selected, active}) {
  const cx = node.x * W, cy = node.y * H;
  const fill = kindColor(kindOf(node));
  const r = active ? 28 : 18;
  const label = node.name || node.id;
  return (
    <g onClick={onClick} style={{cursor: 'pointer'}}>
      <circle cx={cx} cy={cy} r={r + (selected ? 4 : 0)} fill="none" stroke={selected ? fill : 'transparent'} strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={active ? 0.9 : 0.75} stroke="#07090f" strokeWidth="2" />
      <text x={cx} y={cy + r + 16} textAnchor="middle" fill="#e8eef7" fontSize={active ? 13 : 11} fontFamily="Source Serif 4, Georgia, serif">{label.length > 28 ? label.slice(0, 27) + '…' : label}</text>
    </g>
  );
}

export function MiniNeighborhood({focus, related = [], height = 280, go}) {
  return <GraphNeighborhood focus={focus} related={related} go={go} height={height} />;
}
