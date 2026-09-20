import React, {lazy, Suspense, useCallback, useEffect, useState} from 'react';
import {canonicalPath} from '../platform/routes.js';
import {parseOsPath, titleForRoute, osPathFromId} from './routes.js';
import {useLibrary} from './data.js';
import Command from './Command.jsx';
import Workbench from './Workbench.jsx';
import Catalog from './Catalog.jsx';
import WorkspaceHome from './WorkspaceHome.jsx';
import EntityInstrument from './EntityInstrument.jsx';
import GraphNeighborhood from './GraphNeighborhood.jsx';
import Methods from './Methods.jsx';
import {useOsEntity} from './data.js';
import './os.css';

const EvidenceMatcher = lazy(() => import('../platform/EvidenceMatcher.jsx'));
const Comparison = lazy(() => import('../platform/Comparison.jsx'));

function readRoute() {
  const path = canonicalPath(window.location.pathname);
  return parseOsPath(path, window.location.search);
}

export default function OsApp() {
  const [route, setRoute] = useState(readRoute);
  const [cmd, setCmd] = useState(false);
  const [cmdMode, setCmdMode] = useState('entity');
  const lib = useLibrary();

  const go = useCallback((to) => {
    const url = new URL(to, window.location.origin);
    const next = url.pathname + url.search;
    if (next !== window.location.pathname + window.location.search) {
      window.history.pushState({}, '', next);
    }
    window.scrollTo(0, 0);
    setRoute(parseOsPath(canonicalPath(url.pathname), url.search));
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCmd(true); }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) { e.preventDefault(); setCmd(true); }
      if (e.key === 'Escape') setCmd(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const label = titleForRoute(route);
    document.title = route.screen === 'workbench' ? 'Clarity — biomedical evidence OS' : `${label} | Clarity`;
  }, [route]);

  useEffect(() => {
    const onClick = event => {
      const a = event.target.closest?.('a[href]');
      if (!a || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith('/examples/')) return;
      event.preventDefault();
      go(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [go]);

  const nav = route.screen;
  return (
    <div className="os-app">
      <header className="os-header">
        <a className="os-brand" href="/" onClick={e => { e.preventDefault(); go('/'); }}>
          <strong>Clarity</strong>
          <em>Evidence OS</em>
        </a>
        <button type="button" className="os-cmd-open" onClick={() => { setCmdMode('entity'); setCmd(true); }}>
          <span>Search an object or ask a question</span>
          <kbd>⌘K</kbd>
        </button>
        <nav className="os-nav" aria-label="Primary">
          <a href="/workspace" aria-current={nav === 'workspace' ? 'page' : undefined}>Workspace</a>
          <a href="/graph" aria-current={nav === 'graph' ? 'page' : undefined}>Graph</a>
          <a href="/catalog" aria-current={nav === 'catalog' ? 'page' : undefined}>Catalog</a>
        </nav>
        <div className="os-header-aside">
          <a href="/catalog?type=intervention">Interventions</a>
          <a href="/methods" aria-current={nav === 'methods' ? 'page' : undefined}>Methods</a>
        </div>
      </header>
      <div className="os-stage">
        {nav === 'workbench' && <Workbench entries={lib.entries} go={go} openCommand={m => { setCmdMode(m); setCmd(true); }} />}
        {nav === 'workspace' && <WorkspaceHome go={go} />}
        {nav === 'catalog' && <Catalog key={`${route.type}|${route.q}`} entries={lib.entries} go={go} initialType={route.type} initialQuery={route.q} />}
        {nav === 'entity' && <EntityInstrument key={`${route.kind}:${route.slug}`} kind={route.kind} slug={route.slug} go={go} />}
        {nav === 'graph' && <GraphScreen focus={route.focus} go={go} />}
        {nav === 'investigate' && (
          <Suspense fallback={<p className="os-status">Loading investigation…</p>}>
            <div className="os-work"><EvidenceMatcher /></div>
          </Suspense>
        )}
        {nav === 'compare' && (
          <Suspense fallback={<p className="os-status">Loading comparison…</p>}>
            <div className="os-work"><Comparison /></div>
          </Suspense>
        )}
        {nav === 'methods' && <Methods />}
        {nav === 'privacy' && <Policy kind="privacy" />}
        {nav === 'terms' && <Policy kind="terms" />}
        {nav === 'not-found' && (
          <main className="os-work"><h1>Not a Clarity address</h1><p>This path does not resolve to a workbench, catalog, graph, or typed object.</p><a className="os-primary" href="/" onClick={e => { e.preventDefault(); go('/'); }}>Workbench</a></main>
        )}
      </div>
      <Command open={cmd} onClose={() => setCmd(false)} entries={lib.entries} go={go} defaultMode={cmdMode} />
    </div>
  );
}

function GraphScreen({focus, go}) {
  const [kind, slug] = String(focus || 'precision_context:ret-selpercatinib').split(':');
  const mappedKind = kind === 'compound' ? 'intervention' : kind === 'precision_context' ? 'precision_context' : kind;
  const state = useOsEntity(mappedKind, slug || 'ret-selpercatinib');
  if (state.status === 'loading') return <p className="os-status">Loading neighborhood…</p>;
  if (!state.data?.entity) return <main className="os-work"><h1>No graph payload</h1><p>Open an entity first, then use Graph on its instrument.</p></main>;
  const e = state.data.entity;
  return (
    <div className="os-graph-page">
      <div className="os-graph-toolbar">
        <p className="os-eyebrow">Graph environment · 1-hop</p>
        <strong>{e.name}</strong>
        <button className="os-ghost" type="button" onClick={() => go(osPathFromId(e.id))}>Instrument</button>
      </div>
      <GraphNeighborhood focus={{id: e.id, name: e.name, kind: e.kind}} related={state.data.related || []} go={go} height={640} />
    </div>
  );
}

function Policy({kind}) {
  const privacy = kind === 'privacy';
  return (
    <main className="os-work">
      <p className="os-eyebrow">{privacy ? 'Privacy' : 'Terms'}</p>
      <h1>{privacy ? 'Privacy' : 'Terms & medical notice'}</h1>
      <p className="os-lede">{privacy
        ? 'No account is required. Investigations, pins and collections stay in this browser unless you export them. Matching sends a research description to Clarity’s retrieval API, not to a model provider.'
        : 'Clarity is for research and education. It does not diagnose, prescribe, or replace a clinician. Do not use it in an emergency.'}</p>
    </main>
  );
}
