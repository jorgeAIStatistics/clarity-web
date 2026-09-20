import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useGraphNeighborhood} from './data.js';
import {canonicalId, parseTypedId, SOURCE_META, identityFromKindSlug} from './identity.js';
import {KIND_LABEL, osPathFromId} from './routes.js';
import {kindColor} from './Figures.jsx';
import {
  normalizeNeighborhood, layoutNeighborhood, tableRows, filterOptions,
  pathHop, pathSummary, exportPathJson, exportTableCsv, graphHref, QUERY_LABEL, pathTableRows,
} from './graphModel.js';
import GraphCanvas, {serializeCanvasSvg} from './GraphCanvas.jsx';
import GraphInspect from './GraphInspect.jsx';
import {togglePin, savePinnedPath, loadOsStore, rememberLastGraphFocus} from './store.js';

const DEFAULT_FOCUS = 'precision_context:ret-selpercatinib';

function parseFocus(raw) {
  let id = canonicalId(raw) || String(raw || '').replace(/^graph:/, '');
  if (!id || !id.includes(':')) {
    const last = loadOsStore().lastGraphFocus?.id;
    id = canonicalId(last) || DEFAULT_FOCUS;
  }
  const parsed = parseTypedId(id);
  const kind = parsed.prefix === 'compound' ? 'intervention'
    : parsed.prefix === 'assay' ? 'test'
    : parsed.prefix === 'context' ? 'precision_context'
    : parsed.prefix;
  return {id: `${parsed.prefix}:${parsed.slug}`, kind, slug: parsed.slug};
}

export default function GraphEnv({focus: focusParam, go}) {
  const parsed = parseFocus(focusParam);
  const ident = identityFromKindSlug(parsed.kind, parsed.slug);
  const state = useGraphNeighborhood(parsed.kind, parsed.slug);
  const [mode, setMode] = useState('graph');
  const [filters, setFilters] = useState({kind: 'all', edge: 'all', origin: 'all', layer: 'all', class: 'all'});
  const [selection, setSelection] = useState(null);
  const [walk, setWalk] = useState([]);
  const [walkIndex, setWalkIndex] = useState(-1);
  const [hops, setHops] = useState([]);
  const [sheet, setSheet] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const canvasRoot = useRef(null);

  const skipWalk = useRef(false);
  const walkIndexRef = useRef(-1);

  const origin = state.source || state.data?.origin || '';
  const neighborhood = useMemo(
    () => state.data ? normalizeNeighborhood(state.data, origin) : null,
    [state.data, origin],
  );
  const layout = useMemo(
    () => neighborhood ? layoutNeighborhood(neighborhood, filters) : null,
    [neighborhood, filters],
  );
  const options = useMemo(() => neighborhood ? filterOptions(neighborhood) : {kinds: [], edges: [], origins: [], classes: [], layers: []}, [neighborhood]);
  const rows = useMemo(() => layout ? tableRows(layout) : [], [layout]);
  const pathRows = useMemo(() => pathTableRows(hops), [hops]);
  const kindsOnCanvas = useMemo(() => {
    const set = new Set(layout?.nodes.map(n => n.kind) || []);
    if (neighborhood?.focus?.kind) set.add(neighborhood.focus.kind);
    return [...set];
  }, [layout, neighborhood?.focus?.kind]);

  useEffect(() => {
    setSelection(null);
    setFilters({kind: 'all', edge: 'all', origin: 'all', layer: 'all', class: 'all'});
    setSheet(false);
  }, [ident.id]);

  useEffect(() => {
    if (!neighborhood?.focus) return;
    if (state.status === 'querying' && !state.source) return;
    rememberLastGraphFocus({id: neighborhood.focus.id, name: neighborhood.focus.name, kind: neighborhood.focus.kind, path: neighborhood.focus.path, origin});
    if (skipWalk.current) {
      skipWalk.current = false;
      return;
    }
    const step = {id: neighborhood.focus.id, name: neighborhood.focus.name, kind: neighborhood.focus.kind, origin};
    setWalk(w => {
      if (w[walkIndexRef.current]?.id === step.id) return w;
      const next = [...w.slice(0, walkIndexRef.current + 1), step].slice(-24);
      walkIndexRef.current = next.length - 1;
      setWalkIndex(next.length - 1);
      return next;
    });
  }, [neighborhood?.focus?.id, neighborhood?.focus?.name, state.status, state.source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (document.querySelector('.os-cmd')) return;
      if (e.key === 'Escape') { setSelection(null); setSheet(false); return; }
      if (e.key === 'g' || e.key === 'G') { setMode('graph'); return; }
      if (e.key === 't' || e.key === 'T') { setMode('table'); return; }
      if (e.key === '[') { goWalk(walkIndexRef.current - 1); return; }
      if (e.key === ']') { goWalk(walkIndexRef.current + 1); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const node = layout?.nodes[n - 1];
        if (node) {
          e.preventDefault();
          const edge = layout.edges.find(x => x.target.id === node.id && x.key === node.edgeKey) || layout.edges.find(x => x.target.id === node.id);
          setSelection({type: 'node', id: node.id, key: node.edgeKey || node.id, node, edge});
          setSheet(true);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  function goWalk(i) {
    if (i < 0 || i >= walk.length) return;
    skipWalk.current = true;
    walkIndexRef.current = i;
    setWalkIndex(i);
    go(graphHref(walk[i].id));
  }

  const queryLabel = state.livePending ? 'Querying live graph'
    : (QUERY_LABEL[state.query || origin] || SOURCE_META[origin]?.short || '');

  const pathKeys = hops
    .filter(h => h.from.id === neighborhood?.focus.id || h.to.id === neighborhood?.focus.id)
    .map(h => layout?.edges.find(e => e.target.id === h.to.id || e.target.id === h.from.id)?.key)
    .filter(Boolean);

  const focusHere = useCallback((node) => {
    if (!node?.id) return;
    go(graphHref(node.id));
  }, [go]);

  function selectNode(node) {
    const edge = layout?.edges.find(e => e.target.id === node.id && e.key === node.edgeKey) || layout?.edges.find(e => e.target.id === node.id);
    setSelection({type: 'node', id: node.id, key: node.edgeKey || node.id, node, edge});
    setSheet(true);
  }
  function selectEdge(edge) {
    setSelection({type: 'edge', key: edge.key, edge, id: edge.target.id});
    setSheet(true);
  }
  function addHop(edge) {
    if (!edge || !neighborhood) return;
    const hop = pathHop(neighborhood.focus, edge);
    if (!hop) return;
    setHops(h => {
      if (h.some(x => x.from.id === hop.from.id && x.to.id === hop.to.id && x.edge === hop.edge)) return h;
      return [...h, hop];
    });
  }
  function pinNode(node) {
    togglePin({id: node.id, name: node.name, kind: node.kind, path: node.path, origin: node.origin || origin});
  }
  function persistPath() {
    if (!hops.length) return;
    savePinnedPath({name: pathSummary(hops), hops});
    setSavedAt(Date.now());
  }
  function download(text, mime, filename) {
    const url = URL.createObjectURL(new Blob([text], {type: mime}));
    const a = Object.assign(document.createElement('a'), {href: url, download: filename});
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  const canAdd = Boolean(selection?.edge && neighborhood && pathHop(neighborhood.focus, selection.edge));
  const emptyEdges = neighborhood && neighborhood.edges.length === 0;
  const focusNode = neighborhood?.focus || {id: ident.id, name: parsed.slug, kind: parsed.kind, kindLabel: KIND_LABEL[parsed.kind], path: ident.path};

  return (
    <div className="os-graph-env" data-origin={origin || ''} data-query={state.query || ''}>
      <aside className="os-graph-rail" aria-label="Graph context">
        <p className="os-eyebrow">Graph · 1-hop walk</p>
        <p className="os-kind" style={{'--kind': kindColor(focusNode.kind)}}>{KIND_LABEL[focusNode.kind] || focusNode.kind}</p>
        <h1>{focusNode.name || parsed.slug}</h1>
        <p className="os-id">{focusNode.id}</p>
        <div className={`os-origin os-origin-${origin || 'querying'}`}>
          <p className="os-origin-label">{queryLabel}</p>
          <p>{state.livePending
            ? 'Showing the published snapshot while the live graph is queried. Snapshot is not live.'
            : (SOURCE_META[origin]?.long || 'This is the 1-hop neighborhood stored on this object’s payload.')}</p>
        </div>
        <dl className="os-facts">
          <div><dt>Relationships on payload</dt><dd className="os-num">{neighborhood ? neighborhood.edges.length : '—'}</dd></div>
          <div><dt>Typed findings on focus</dt><dd className="os-num">{neighborhood ? neighborhood.findings.length : '—'}</dd></div>
          <div><dt>Publications</dt><dd className="os-num">{neighborhood?.studies ?? '—'}</dd></div>
        </dl>
        <p className="os-caption">Only edges returned for this focus. Focusing a neighbor loads that object’s own 1-hop. This is not a multi-hop query.</p>

        <div className="os-graph-modes" role="tablist" aria-label="Graph or table">
          <button type="button" role="tab" aria-selected={mode === 'graph'} onClick={() => setMode('graph')}>Graph</button>
          <button type="button" role="tab" aria-selected={mode === 'table'} onClick={() => setMode('table')}>Table</button>
          <button type="button" role="tab" aria-selected={mode === 'path'} onClick={() => setMode('path')} disabled={!hops.length}>Path</button>
        </div>

        <fieldset className="os-graph-filters" data-shown={layout?.shown ?? 0} data-total={layout?.total ?? 0}>
          <legend>Hide, do not delete</legend>
          <p className="os-caption">Filters hide relationships. They do not assert that hidden edges do not exist.</p>
          <div className="os-filter-chips" role="group" aria-label="Hide by kind">
            <button type="button" aria-pressed={filters.kind === 'all'} onClick={() => setFilters(f => ({...f, kind: 'all'}))}>All kinds</button>
            {options.kinds.map(k => (
              <button key={k} type="button" aria-pressed={filters.kind === k} onClick={() => setFilters(f => ({...f, kind: k}))}>{KIND_LABEL[k] || k}</button>
            ))}
          </div>
          <label>Relationship
            <select name="graph-filter-edge" value={filters.edge} onChange={e => setFilters(f => ({...f, edge: e.target.value}))}>
              <option value="all">All relationships</option>
              {options.edges.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label>Class
            <select name="graph-filter-class" value={filters.class} onChange={e => setFilters(f => ({...f, class: e.target.value}))}>
              <option value="all">Structural + evidence-linked</option>
              {options.classes.map(k => <option key={k} value={k}>{k === 'structural' ? 'Structural identity' : k === 'evidence_link' ? 'Evidence-linked' : k}</option>)}
            </select>
          </label>
          {options.origins.length > 0 && (
            <label>Origin
              <select name="graph-filter-origin" value={filters.origin} onChange={e => setFilters(f => ({...f, origin: e.target.value}))}>
                <option value="all">All origins</option>
                {options.origins.map(k => <option key={k} value={k}>{SOURCE_META[k]?.short || k}</option>)}
              </select>
            </label>
          )}
          {options.layers.length > 0 && (
            <label>Finding layer on edge
              <select name="graph-filter-layer" value={filters.layer} onChange={e => setFilters(f => ({...f, layer: e.target.value}))}>
                <option value="all">Any / none</option>
                {options.layers.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
          )}
          {layout && (
            <p className="os-note os-filter-count">Showing {layout.shown} of {layout.total} relationship{layout.total === 1 ? '' : 's'}{layout.hidden ? ` · ${layout.hidden} hidden by filter` : ''}.</p>
          )}
          {(filters.kind !== 'all' || filters.edge !== 'all' || filters.origin !== 'all' || filters.layer !== 'all' || filters.class !== 'all') && (
            <button className="os-ghost" type="button" onClick={() => setFilters({kind: 'all', edge: 'all', origin: 'all', layer: 'all', class: 'all'})}>Show hidden</button>
          )}
        </fieldset>

        <section>
          <p className="os-eyebrow">Walk history</p>
          <p className="os-caption">Where you focused. Not a scientific path.</p>
          <div className="os-graph-trail" aria-label="Walk history">
            {walk.map((step, i) => (
              <button
                key={`${step.id}-${i}`}
                type="button"
                className="os-ghost"
                data-current={i === walkIndex || undefined}
                onClick={() => goWalk(i)}
              >{step.name}</button>
            ))}
            {!walk.length && <p className="os-note">Focus an object to start a walk.</p>}
          </div>
          <div className="os-actions">
            <button className="os-ghost" type="button" disabled={walkIndex <= 0} onClick={() => goWalk(walkIndex - 1)}>Back</button>
            <button className="os-ghost" type="button" disabled={walkIndex < 0 || walkIndex >= walk.length - 1} onClick={() => goWalk(walkIndex + 1)}>Forward</button>
          </div>
        </section>

        <section>
          <p className="os-eyebrow">Pinned scientific path</p>
          <p className="os-caption">Hops you added from real 1-hop edges. Missing intermediates are not inferred.</p>
          <ol className="os-graph-path">
            {hops.map((h, i) => (
              <li key={`${h.from.id}-${h.to.id}-${i}`}>
                <button type="button" className="os-path-link" onClick={() => go(graphHref(h.from.id))}>{h.from.name}</button>
                <span className="os-note"> {h.label}{h.reason ? ` · ${h.reason}` : ''} </span>
                <button type="button" className="os-path-link" onClick={() => go(graphHref(h.to.id))}>{h.to.name}</button>
              </li>
            ))}
          </ol>
          {!hops.length && <p className="os-note">Select an edge or neighbor, then Add to path.</p>}
          <div className="os-actions">
            <button className="os-ghost" type="button" disabled={!hops.length} onClick={() => setHops(h => h.slice(0, -1))}>Remove last hop</button>
            <button className="os-ghost" type="button" disabled={!hops.length} onClick={() => setHops([])}>Clear path</button>
            <button className="os-ghost" type="button" disabled={!hops.length} onClick={() => setMode('path')}>Open path as table</button>
            <button className="os-ghost" type="button" disabled={!hops.length} onClick={persistPath}>Save path in this browser</button>
            <button className="os-ghost" type="button" disabled={!hops.length} onClick={() => download(exportPathJson({hops, name: pathSummary(hops)}), 'application/json', 'clarity-graph-path.json')}>Export path JSON</button>
          </div>
          <SavedPaths go={go} tick={savedAt} />
        </section>

        <div className="os-actions">
          <button className="os-ghost" type="button" onClick={() => go(focusNode.path || osPathFromId(ident.id))}>Open entity</button>
          <button className="os-ghost" type="button" onClick={() => go(`/investigate?evidence=${encodeURIComponent(focusNode.name || parsed.slug)}`)}>Start investigation</button>
          {layout && <button className="os-ghost" type="button" onClick={() => download(exportTableCsv(rows), 'text/csv', 'clarity-graph-neighborhood.csv')}>Export table CSV</button>}
          {mode === 'graph' && <button className="os-ghost" type="button" onClick={() => download(serializeCanvasSvg(canvasRoot.current), 'image/svg+xml', 'clarity-graph.svg')}>Export graph SVG</button>}
        </div>
      </aside>

      <section className="os-graph-stage" aria-label="Neighborhood">
        {state.status === 'querying' && !neighborhood && (
          <div className="os-graph-skeleton" role="status">
            <p className="os-eyebrow">Querying live graph</p>
            <h2>{KIND_LABEL[parsed.kind] || parsed.kind} · {parsed.slug}</h2>
            <p className="os-id">{ident.id}</p>
            <p>Loading this object’s 1-hop payload. A published snapshot will appear if the live graph does not answer.</p>
          </div>
        )}
        {state.status === 'missing' && (
          <div className="os-graph-skeleton">
            <h2>No graph payload</h2>
            <p>No live, snapshot, or catalog row for <code>{ident.id}</code>. That is a gap in Clarity, not a statement about the literature.</p>
          </div>
        )}
        {emptyEdges && (
          <p className="os-warn" style={{margin: '12px 16px 0'}}>
            {origin === 'catalog'
              ? 'Catalog row only. No graph edges are stored, and none are invented.'
              : origin === 'derived'
                ? 'Derived identity. Edges shown, if any, are projections from the backing object.'
                : 'This payload lists no neighbors.'}
          </p>
        )}
        {layout && mode === 'graph' && (
          <div ref={canvasRoot} className="os-graph-stage-canvas">
            {layout.hidden > 0 && (
              <p className="os-graph-hidden-banner">{layout.hidden} relationship{layout.hidden === 1 ? '' : 's'} hidden by filter — still present on the payload.</p>
            )}
            <GraphCanvas
              layout={layout}
              selected={selection}
              pathKeys={pathKeys}
              onSelectNode={selectNode}
              onSelectEdge={selectEdge}
              ariaLabel={`1-hop neighborhood of ${focusNode.name}. ${layout.shown} of ${layout.total} relationships shown.`}
            />
            <ul className="os-graph-legend" aria-label="Entity kinds on this canvas">
              {kindsOnCanvas.map(k => (
                <li key={k}><span className="os-g-swatch" style={{'--kind': kindColor(k)}} />{KIND_LABEL[k] || k}{k === focusNode.kind ? ' · focus' : ''}</li>
              ))}
            </ul>
            <p className="os-graph-hint">Color is kind, not significance. Larger node is the query center. Solid = structural; dashed = evidence-linked. 1–9 select a neighbor · [ ] walk · G graph · T table · Esc inspector.</p>
          </div>
        )}
        {layout && mode === 'table' && (
          <div className="os-graph-table-wrap">
            <p className="os-caption">Same 1-hop payload as the canvas. Filtering hides rows; it does not assert absence.</p>
            <NeighborhoodTable rows={rows} layout={layout} selection={selection} onSelect={selectEdge} origin={origin} />
            {hops.length > 0 && (
              <p className="os-note">Pinned path: {pathSummary(hops)}. Path hops not on this 1-hop stay in the rail; they are not added as extra rows.</p>
            )}
          </div>
        )}
        {mode === 'path' && (
          <div className="os-graph-table-wrap">
            <p className="os-caption">Pinned scientific path. Each hop is a stored 1-hop edge. Missing intermediates are not inferred. This is not a multi-hop query result.</p>
            {!hops.length && <p className="os-note">No hops yet. Select an edge and Add to path.</p>}
            {hops.length > 0 && <NeighborhoodTable rows={pathRows} origin={origin} />}
          </div>
        )}
      </section>

      <div className={`os-graph-dock${sheet ? ' is-open' : ''}`}>
        <button type="button" className="os-graph-sheet-toggle" onClick={() => setSheet(s => !s)}>
          {sheet ? 'Hide inspector' : 'Inspector'}
        </button>
        <GraphInspect
          selection={selection}
          focus={focusNode}
          origin={origin}
          go={go}
          onFocus={focusHere}
          onAddHop={addHop}
          onPin={pinNode}
          canAddHop={canAdd}
          isFocus={selection?.type === 'node' && selection.id === focusNode.id}
        />
      </div>
    </div>
  );
}

function NeighborhoodTable({rows, layout, selection, onSelect, origin}) {
  return (
    <table className="os-ledger">
      <thead>
        <tr>
          <th>Source</th><th>Source kind</th><th>Relationship</th><th>Reason</th>
          <th>Target</th><th>Target kind</th><th>Origin</th><th>Evidence</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr
            key={r.key}
            aria-selected={selection?.key === r.key}
            onClick={() => {
              const edge = layout?.edges?.find(e => e.key === r.key);
              if (edge) onSelect?.(edge);
            }}
          >
            <td>{r.source}</td>
            <td>{KIND_LABEL[r.sourceKind] || r.sourceKind}</td>
            <td>{r.relationship}</td>
            <td>{r.reason || '—'}</td>
            <td>{r.target}</td>
            <td>{KIND_LABEL[r.targetKind] || r.targetKind}</td>
            <td>{SOURCE_META[r.origin]?.short || r.origin || origin || '—'}</td>
            <td>{r.evidenceLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SavedPaths({go, tick}) {
  const paths = loadOsStore().paths || [];
  if (!paths.length) return null;
  return (
    <div className="os-recents" style={{marginTop: 12}} data-saved={tick || 0}>
      {paths.map(p => (
        <button
          key={p.id}
          type="button"
          className="os-ghost"
          style={{display: 'block', width: '100%', textAlign: 'left', marginBottom: 4}}
          onClick={() => p.hops?.[0] && go(graphHref(p.hops[0].from.id))}
        >{p.name}<small className="os-note" style={{display: 'block'}}>{p.hops?.length || 0} hop{(p.hops?.length || 0) === 1 ? '' : 's'}</small></button>
      ))}
    </div>
  );
}
