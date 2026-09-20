import React from 'react';
import {kindColor} from './Figures.jsx';

const W = 960;
const H = 640;

export default function GraphCanvas({
  layout,
  selected,
  pathKeys = [],
  onSelectNode,
  onSelectEdge,
  compact = false,
  ariaLabel,
}) {
  const {center, nodes, edges} = layout;
  const cx = center.x * W;
  const cy = center.y * H;

  function nodeTab(node, i) {
    return {
      tabIndex: 0,
      role: 'button',
      onKeyDown: e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectNode?.(node); }
        if (e.key === 'ArrowRight') { e.preventDefault(); const n = nodes[(i + 1) % nodes.length]; if (n) onSelectNode?.(n); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); const n = nodes[(i - 1 + nodes.length) % nodes.length]; if (n) onSelectNode?.(n); }
        if (e.key === 'e' || e.key === 'E') {
          const edge = edges.find(x => x.key === node.edgeKey) || edges.find(x => x.target.id === node.id);
          if (edge) { e.preventDefault(); onSelectEdge?.(edge); }
        }
      },
    };
  }

  return (
    <div className={`os-graph-canvas${compact ? ' is-compact' : ''}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel || `1-hop neighborhood of ${center.name}`}
      >
        <title>{ariaLabel || `1-hop neighborhood of ${center.name}`}</title>
        {edges.map((e, i) => {
          const x1 = e.x1 * W, y1 = e.y1 * H, x2 = e.x2 * W, y2 = e.y2 * H;
          const onPath = pathKeys.includes(e.key);
          const active = selected?.type === 'edge' && selected.key === e.key;
          return (
            <g key={e.key}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                className="os-g-edge"
                data-class={e.class}
                data-path={onPath || undefined}
                data-active={active || undefined}
                strokeDasharray={e.class === 'structural' ? undefined : '6 5'}
              />
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="transparent"
                strokeWidth="18"
                style={{cursor: 'pointer'}}
                tabIndex={0}
                role="button"
                aria-label={`${e.label}: ${e.source.name} to ${e.target.name}. ${e.classTitle}`}
                onClick={ev => { ev.stopPropagation(); onSelectEdge?.(e); }}
                onKeyDown={ev => {
                  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelectEdge?.(e); }
                  if (ev.key === 'ArrowRight') {
                    ev.preventDefault();
                    const n = edges[(i + 1) % edges.length];
                    if (n) onSelectEdge?.(n);
                  }
                  if (ev.key === 'ArrowLeft') {
                    ev.preventDefault();
                    const n = edges[(i - 1 + edges.length) % edges.length];
                    if (n) onSelectEdge?.(n);
                  }
                }}
              >
                <title>{e.label}: {e.source.name} → {e.target.name}</title>
              </line>
              {!compact && (
                <text
                  x={x1 + (x2 - x1) * 0.68}
                  y={y1 + (y2 - y1) * 0.68 - 10}
                  textAnchor="middle"
                  className="os-g-elabel"
                  onClick={ev => { ev.stopPropagation(); onSelectEdge?.(e); }}
                >{e.label}</text>
              )}
            </g>
          );
        })}
        <NodeMark
          node={center}
          cx={cx} cy={cy}
          r={compact ? 22 : 28}
          focus
          compact={compact}
          selected={selected?.type === 'node' && selected.id === center.id}
          onSelect={() => onSelectNode?.(center)}
          tabProps={nodeTab(center, -1)}
        />
        {nodes.map((n, i) => (
          <NodeMark
            key={n.id + n.edgeKey}
            node={n}
            cx={n.x * W} cy={n.y * H}
            r={compact ? 14 : 16}
            compact={compact}
            selected={selected?.type === 'node' && selected.id === n.id && selected.key === n.edgeKey}
            onSelect={() => onSelectNode?.(n)}
            tabProps={nodeTab(n, i)}
          />
        ))}
      </svg>
      <p className="os-sr">Focus is drawn larger because it is the query center, not because it is more important. Color marks entity kind, not evidence quality. Dashed edges are evidence-linked; solid edges are structural identity.</p>
    </div>
  );
}

function wrapName(label, width) {
  const shown = String(label || '');
  if (shown.length <= width) return [shown];
  const cut = shown.lastIndexOf(' ', width);
  const i = cut > 8 ? cut : width;
  return [shown.slice(0, i).trim(), `${shown.slice(i).trim()}`.slice(0, width)];
}

function NodeMark({node, cx, cy, r, focus, compact, selected, onSelect, tabProps}) {
  const fill = kindColor(node.kind);
  const lines = wrapName(node.name || node.id, focus ? 22 : 16);
  const outward = focus ? 0 : (r + (compact ? 22 : 28));
  const lx = focus ? cx : cx + Math.cos(node.a || 0) * outward;
  const ly = focus ? cy + r + 16 : cy + Math.sin(node.a || 0) * outward;
  const projected = node.origin === 'derived' || node.origin === 'catalog';
  const showKind = !compact || focus;
  return (
    <g
      className="os-g-node"
      data-kind={node.kind}
      data-origin={node.origin || undefined}
      data-selected={selected || undefined}
      onClick={e => { e.stopPropagation(); onSelect?.(); }}
      style={{cursor: 'pointer'}}
      aria-label={`${node.kindLabel || node.kind} ${node.name}${projected ? `, ${node.origin}` : ''}`}
      {...tabProps}
    >
      {selected && <circle cx={cx} cy={cy} r={r + 5} fill="none" className="os-g-halo" />}
      <circle
        cx={cx} cy={cy} r={r}
        fill={fill}
        className={`${focus ? 'os-g-focus' : 'os-g-dot'}${projected ? ' is-projected' : ''}`}
      />
      {lines.map((line, i) => (
        <text key={i} x={lx} y={ly + i * 14} textAnchor="middle" className="os-g-nlabel">{line}</text>
      ))}
      {showKind && (
        <text x={lx} y={ly + lines.length * 14 + 4} textAnchor="middle" className="os-g-klabel">
          {node.kindLabel}{projected ? ` · ${node.origin}` : ''}
        </text>
      )}
    </g>
  );
}

export function serializeCanvasSvg(root) {
  const svg = root?.querySelector?.('svg');
  if (!svg) return '';
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
}
