import React from 'react';
import {loadOsStore, loadInvestigations, STORAGE_NOTE} from './store.js';

export default function WorkspaceHome({go}) {
  const store = loadOsStore();
  const projects = loadInvestigations();
  return (
    <main className="os-work">
      <p className="os-eyebrow">Workspace</p>
      <h1>This browser’s bench</h1>
      <p className="os-lede">Investigations, recents, pins, saved studies and comparisons stay on this device. There is no account and no cloud sync in this release.</p>
      <p className="os-warn">{STORAGE_NOTE}</p>
      <div className="os-grid-2" style={{marginTop: 32}}>
        <section>
          <h2>Investigations</h2>
          <p className="os-note">The five-stage study workspace is unchanged scientifically. It is opened as an investigation, not as “Matcher” or “Copilot.”</p>
          {projects.length ? projects.map(p => (
            <a key={p.id} className="os-ghost" style={{display: 'block', margin: '8px 0'}} href="/investigate" onClick={e => { e.preventDefault(); go('/investigate'); }}>{p.title || 'Untitled project'}</a>
          )) : <p className="os-note">None saved. Start from Command → Question.</p>}
          <button className="os-primary" style={{marginTop: 12}} type="button" onClick={() => go('/investigate')}>New investigation</button>
        </section>
        <section>
          <h2>Pinned objects</h2>
          {store.pins.length ? store.pins.map(p => (
            <a key={p.id} href={p.path} onClick={e => { e.preventDefault(); go(p.path); }} style={{display: 'block', padding: '8px 0', borderBottom: '1px solid var(--line)'}}>{p.name}<small className="os-note" style={{display: 'block'}}>{p.kind}</small></a>
          )) : <p className="os-note">Pin from any entity instrument.</p>}
          <h2 style={{marginTop: 28}}>Saved studies</h2>
          {store.studies.length ? store.studies.map(s => (
            <a key={s.id} href={`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`} target="_blank" rel="noreferrer" style={{display: 'block', padding: '8px 0', borderBottom: '1px solid var(--line)'}}>{s.title || s.id}<small className="os-note" style={{display: 'block'}}>PMID {s.pmid}</small></a>
          )) : <p className="os-note">Inspect a finding and save its study.</p>}
          <h2 style={{marginTop: 28}}>Pinned graph paths</h2>
          {store.paths?.length ? store.paths.map(p => (
            <a key={p.id} href="/graph" onClick={e => { e.preventDefault(); go(p.hops?.[0] ? `/graph?focus=${encodeURIComponent(p.hops[0].from.id)}` : '/graph'); }} style={{display: 'block', padding: '8px 0', borderBottom: '1px solid var(--line)'}}>{p.name}<small className="os-note" style={{display: 'block'}}>{p.hops?.length || 0} hop{(p.hops?.length || 0) === 1 ? '' : 's'} · this browser</small></a>
          )) : <p className="os-note">Pin a walk from the graph environment.</p>}
          <h2 style={{marginTop: 28}}>Comparisons</h2>
          {store.comparisons.length ? store.comparisons.map(c => (
            <a key={c.id} href="/compare" onClick={e => { e.preventDefault(); go('/compare'); }} style={{display: 'block', padding: '8px 0'}}>{c.ids.join(' vs ')}</a>
          )) : <p className="os-note">Launch compare from an entity or catalog preview.</p>}
        </section>
      </div>
    </main>
  );
}
