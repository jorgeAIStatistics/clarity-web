import React, {useEffect, useMemo, useRef, useState} from 'react';
import {classifyCommand, searchEntities, disambiguate} from './search.js';
import {kindColor} from './Figures.jsx';
import {KIND_LABEL} from './routes.js';

const KIND_NOTE = {
  gene: 'A gene as sequence. Not a variant, protein, or circulating measurement.',
  protein: 'A molecular product. Protein-level evidence is not circulating-biomarker evidence.',
  variant: 'One sequence change. Do not generalize to the gene or to other variants.',
  biomarker: 'A quantity measured in a sample or image. Assay, units and population travel with the value.',
  intervention: 'A compound or exposure. Efficacy, safety and applicability stay separate.',
  test: 'A test as performed. Accuracy is not evidence that testing helps.',
  precision_context: 'Marker × treatment × condition. Evidence belongs to the combination.',
  condition: 'A disease or state findings are reported for.',
  metabolite: 'A small molecule measured in a sample.',
};

export default function Command({open, onClose, entries, go, seed = '', defaultMode}) {
  const [text, setText] = useState(seed);
  const [mode, setMode] = useState(defaultMode || 'entity');
  const [cursor, setCursor] = useState(0);
  const input = useRef(null);
  useEffect(() => {
    if (open) {
      setText(seed);
      setMode(defaultMode || 'entity');
      setTimeout(() => input.current?.focus(), 20);
    }
  }, [open, seed, defaultMode]);
  const classified = classifyCommand(text);
  const effectiveMode = classified.mode === 'question' ? 'question' : classified.mode === 'command' ? 'command' : mode;
  const hits = useMemo(() => searchEntities(entries, classified.mode === 'command' ? classified.arg : text, 20), [entries, text, classified]);
  const ambi = disambiguate(hits, text);

  useEffect(() => { setCursor(0); }, [text, effectiveMode]);

  function run(hit) {
    if (!hit) return;
    go(hit.path);
    onClose();
  }
  function ask() {
    go(`/investigate?q=${encodeURIComponent(text)}`);
    onClose();
  }

  if (!open) return null;
  const current = hits[cursor];
  return (
    <div className="os-cmd" role="dialog" aria-label="Command" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="os-cmd-panel">
        <div className="os-cmd-modes">
          <button type="button" aria-pressed={effectiveMode === 'entity'} onClick={() => setMode('entity')}>Entity</button>
          <button type="button" aria-pressed={effectiveMode === 'question'} onClick={() => setMode('question')}>Question</button>
        </div>
        <div className="os-cmd-input">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <input
            ref={input}
            value={text}
            placeholder={effectiveMode === 'question' ? 'Does creatine improve cognition?' : 'BRCA1, ApoB, semaglutide, EGFR…'}
            onChange={e => setText(e.target.value)}
            aria-label={effectiveMode === 'question' ? 'Scientific question' : 'Entity search'}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, hits.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
              if (e.key === 'Enter') {
                if (effectiveMode === 'question') ask();
                else if (classified.cmd === 'graph' && hits[0]) { go(`/graph?focus=${encodeURIComponent(hits[0].id)}`); onClose(); }
                else run(hits[cursor] || hits[0]);
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        {effectiveMode === 'question' ? (
          <div className="os-cmd-q">
            <p className="os-eyebrow">Scientific question</p>
            <h3 style={{fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, margin: '8px 0'}}>{text || 'Ask a research question'}</h3>
            <p>This opens an investigation against the retained library: a question map, angle coverage, tensions and source passages. It is a deterministic match, not a chatbot.</p>
            {hits.length > 0 && (
              <p className="os-note">Named in the catalog: {hits.slice(0, 6).map(h => `${h.name} (${h.kindLabel})`).join(' · ')}</p>
            )}
            <button className="os-primary" type="button" onClick={ask} disabled={!text.trim()}>Open as investigation</button>
          </div>
        ) : (
          <div className="os-cmd-body">
            <div className="os-cmd-list" role="listbox">
              {ambi.ambiguous && (
                <p className="os-note" style={{padding: '8px 16px'}}>
                  Ambiguous symbol — {ambi.kinds.map(k => KIND_LABEL[k] || k).join(', ')}. These are different objects. Pick a type.
                </p>
              )}
              {hits.map((h, i) => (
                <button
                  type="button"
                  key={h.id + h.path}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => run(h)}
                >
                  <span className="os-kind" style={{'--kind': kindColor(h.kind)}}>{h.kindLabel}{h.derived ? ' · derived' : ''}</span>
                  <span>{h.name}<small style={{display: 'block', color: 'var(--mute)', fontSize: 11}}>{h.id}</small></span>
                  <span className="os-num">{h.derived ? 'view' : (h.coverage.quantified_outcomes || h.coverage.linked_studies || 0)}</span>
                </button>
              ))}
              {text && !hits.length && <p className="os-status">No indexed object matches. Try a gene symbol, biomarker, or compound name — or switch to Question.</p>}
              {!text && <p className="os-status">Search the graph and catalog by name. A gene, a protein, a circulating measurement and a drug are different pages even when they share a symbol.</p>}
            </div>
            <div className="os-cmd-side">
              {current ? (
                <>
                  <span className="os-kind" style={{'--kind': kindColor(current.kind)}}>{current.kindLabel}</span>
                  <h3>{current.name}</h3>
                  <p className="os-id">{current.id}</p>
                  <p>{KIND_NOTE[current.kind] || 'Indexed object. Open the instrument to inspect findings, gaps and neighbors.'}</p>
                  <p>{current.summary || ''}</p>
                  {current.derived && <p className="os-warn">Derived identity view. Not a graph node. Findings are not copied onto it.</p>}
                  <p className="os-cmd-note">{current.derived ? 'No protein-level findings are claimed here.' : `${current.coverage.linked_studies || 0} publications · ${current.coverage.quantified_outcomes || 0} outcomes with estimates. Counts are coverage, not grades.`}</p>
                  <div className="os-actions">
                    <button className="os-primary" type="button" onClick={() => run(current)}>Open entity</button>
                    <button className="os-ghost" type="button" onClick={() => { go(`/graph?focus=${encodeURIComponent(current.id)}`); onClose(); }}>Open graph</button>
                  </div>
                </>
              ) : (
                <p className="os-note">Entity search returns typed objects. EGFR the gene is not eGFR the filtration estimate. IL18 the gene is not IL-18 the circulating measurement.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
