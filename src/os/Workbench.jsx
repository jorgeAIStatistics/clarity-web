import React, {useEffect, useMemo, useState} from 'react';
import {CatalogPulse, kindColor} from './Figures.jsx';
import {MiniNeighborhood} from './GraphNeighborhood.jsx';
import {libraryKind, pathForEntry, KIND_LABEL} from './routes.js';
import {identityFromEntry} from './identity.js';
import {loadOsStore, loadInvestigations, STORAGE_NOTE} from './store.js';
import {bundledProfile} from '../evidence/graphProfile.js';

const KINDS = [
  ['gene', 'Genes'],
  ['protein', 'Proteins'],
  ['biomarker', 'Biomarkers'],
  ['intervention', 'Interventions'],
  ['variant', 'Variants'],
  ['test', 'Tests'],
  ['precision_context', 'Precision contexts'],
  ['condition', 'Conditions'],
];

function seedProfile(entries) {
  const prefer = ['graph:precision_context:ret-selpercatinib', 'graph:variant:egfr-activating-mutation', 'graph:gene:brca1', 'graph:biomarker:il-18'];
  for (const id of prefer) {
    const hit = entries.find(e => e.id === id);
    if (hit) return hit;
  }
  return entries.find(e => (e.id || '').includes('precision_context')) || entries[0];
}

export default function Workbench({entries, go, openCommand, graphSeed}) {
  const store = loadOsStore();
  const projects = loadInvestigations();
  const seed = graphSeed || seedProfile(entries || []);
  const [related, setRelated] = useState([]);
  useEffect(() => {
    if (!seed) { setRelated([]); return undefined; }
    const id = identityFromEntry(seed).id;
    let live = true;
    bundledProfile([id]).then(profile => {
      if (live) setRelated(profile?.related || []);
    });
    return () => { live = false; };
  }, [seed]);
  const counts = useMemo(() => {
    const c = {};
    for (const e of entries || []) {
      const k = libraryKind(e);
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [entries]);

  return (
    <div className="os-bench">
      <section className="os-pane">
        <p className="os-eyebrow">Clarity / evidence OS</p>
        <h1>A biomedical<br /><em>evidence graph</em><br />you can interrogate.</h1>
        <p className="os-lede">Search a gene, protein, biomarker or intervention. Ask a scientific question. Inspect source-bound findings. Association is not utility. Nothing is pooled in this interface.</p>
        <button className="os-primary" style={{marginTop: 18}} type="button" onClick={() => openCommand('entity')}>Search an object</button>
        <button className="os-ghost" style={{marginTop: 18, marginLeft: 8}} type="button" onClick={() => openCommand('question')}>Ask a question</button>
        <nav className="os-kind-index" aria-label="Typed catalog">
          {KINDS.map(([id, label]) => (
            <a key={id} href={`/catalog?type=${id}`} onClick={e => { e.preventDefault(); go(`/catalog?type=${id}`); }} style={{'--kind': kindColor(id)}}>
              <span style={{width: 8, height: 8, background: kindColor(id), display: 'inline-block'}} />
              {label}
              <strong className="os-num">{counts[id] || (id === 'protein' ? 'identity views' : 0)}</strong>
            </a>
          ))}
        </nav>
      </section>
      <section className="os-pane">
        <CatalogPulse entries={entries} />
        {seed && (
          <div style={{marginTop: 28}}>
            <p className="os-eyebrow">Live neighborhood · {KIND_LABEL[libraryKind(seed)]}</p>
            <h2 style={{fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, margin: '4px 0 0'}}>
              <a href={pathForEntry(seed)} onClick={e => { e.preventDefault(); go(pathForEntry(seed)); }}>{seed.name}</a>
            </h2>
            {related.length ? (
              <MiniNeighborhood
                focus={{id: identityFromEntry(seed).id, name: seed.name, kind: libraryKind(seed)}}
                related={related}
                go={go}
                height={300}
              />
            ) : (
              <p className="os-note" style={{marginTop: 12}}>No 1-hop edges are stored on the bundled snapshot for this object. The graph page will try the live engine, then this snapshot — it will not invent neighbors.</p>
            )}
          </div>
        )}
      </section>
      <aside className="os-pane">
        <p className="os-eyebrow">This browser</p>
        <h2 style={{fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22}}>Workbench</h2>
        <p className="os-warn">{STORAGE_NOTE}</p>
        <h3 style={{marginTop: 22, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--mute)'}}>Investigations</h3>
        <div className="os-recents">
          {projects.length ? projects.map(p => (
            <a key={p.id} href="/investigate" onClick={e => { e.preventDefault(); go('/investigate'); }}>{p.title || 'Untitled'}<small>{p.savedAt ? `Saved ${p.savedAt.slice(0, 10)}` : 'Unsaved session exists in matcher'}</small></a>
          )) : <p className="os-empty os-note">No local investigations yet. Ask a question to start one.</p>}
        </div>
        <h3 style={{marginTop: 22, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--mute)'}}>Recent objects</h3>
        <div className="os-recents">
          {store.recents.length ? store.recents.slice(0, 8).map(r => (
            <a key={r.id} href={r.path} onClick={e => { e.preventDefault(); go(r.path); }}>{r.name}<small>{r.kind}</small></a>
          )) : <p className="os-empty os-note">Open a gene, protein, biomarker or intervention and it will appear here.</p>}
        </div>
        <div className="os-actions" style={{marginTop: 24}}>
          <a className="os-ghost" href="/workspace" onClick={e => { e.preventDefault(); go('/workspace'); }}>Open workspace</a>
          <a className="os-ghost" href="/methods" onClick={e => { e.preventDefault(); go('/methods'); }}>Methods</a>
        </div>
      </aside>
    </div>
  );
}
