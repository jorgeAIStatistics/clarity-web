import React, {useMemo} from 'react';
import {normalizeNeighborhood, layoutNeighborhood, graphHref} from './graphModel.js';
import GraphCanvas from './GraphCanvas.jsx';

export default function GraphNeighborhood({focus, related = [], go, height = 420, note}) {
  return (
    <MiniNeighborhood focus={focus} related={related} go={go} height={height} note={note} />
  );
}

export function MiniNeighborhood({focus, related = [], go, height = 280, note}) {
  const layout = useMemo(() => {
    const nb = normalizeNeighborhood({entity: focus, related, findings: []}, '');
    return layoutNeighborhood(nb, {});
  }, [focus, related]);
  return (
    <section className="os-module" aria-label="Knowledge graph neighborhood">
      <p className="os-caption">{note || '1-hop edges on this payload only. Open Graph for the research environment — walking a neighbor loads that object’s own 1-hop, not a multi-hop query.'}</p>
      {focus?.id && (
        <div className="os-actions" style={{marginBottom: 8}}>
          <button className="os-ghost" type="button" onClick={() => go(graphHref(focus.id))}>Open in graph</button>
        </div>
      )}
      <div style={{height}}>
        <GraphCanvas
          compact
          layout={layout}
          onSelectNode={n => n.path && go(n.path)}
          onSelectEdge={e => e.target?.path && go(e.target.path)}
          ariaLabel={`Compact 1-hop of ${focus?.name || focus?.id}`}
        />
      </div>
    </section>
  );
}
