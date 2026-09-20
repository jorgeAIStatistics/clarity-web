import React from 'react';
import {layerLabel, LAYERS, valueText, flatten, aucStrip, classificationRows} from '../evidence/graphProfile.js';
import {osPathFromId, libraryKind} from './routes.js';

const KIND_COLOR = {
  gene: 'var(--os-kind-gene)',
  protein: 'var(--os-kind-protein)',
  biomarker: 'var(--os-kind-biomarker)',
  variant: 'var(--os-kind-variant)',
  intervention: 'var(--os-kind-intervention)',
  compound: 'var(--os-kind-intervention)',
  test: 'var(--os-kind-test)',
  precision_context: 'var(--os-kind-context)',
  condition: 'var(--os-kind-condition)',
  pathway: 'var(--os-kind-pathway)',
  Gene: 'var(--os-kind-gene)',
  Protein: 'var(--os-kind-protein)',
  Biomarker: 'var(--os-kind-biomarker)',
  Variant: 'var(--os-kind-variant)',
  Test: 'var(--os-kind-test)',
  Assay: 'var(--os-kind-test)',
  PrecisionContext: 'var(--os-kind-context)',
  Condition: 'var(--os-kind-condition)',
  Pathway: 'var(--os-kind-pathway)',
  Compound: 'var(--os-kind-intervention)',
};

export function kindColor(kind) {
  return KIND_COLOR[kind] || 'var(--mute)';
}

export function LayerPipeline({layers = [], findings = []}) {
  const rows = flatten(findings);
  const counts = Object.fromEntries(LAYERS.map(l => [l, rows.filter(f => f.layer === l).length]));
  const fromPayload = Object.fromEntries((layers || []).map(l => [l.layer, l]));
  return (
    <figure className="os-module">
      <h2>Evidence layers</h2>
      <p className="os-caption">A layer is indexed only when a finding in this library speaks to it. Color marks the layer, not statistical significance. Empty is a gap in Clarity, not proof of absence.</p>
      <ol className="os-pipeline">
        {LAYERS.map(layer => {
          const n = counts[layer] || fromPayload[layer]?.n_findings || 0;
          const gap = n === 0;
          return (
            <li key={layer} data-gap={gap} style={{borderTop: `2px solid var(--layer-${layer})`}}>
              <strong>{layerLabel(layer)}</strong>
              <span className="os-num">{n}</span>
              <small>{gap ? 'Not indexed' : 'Indexed'}</small>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export function GapMap({rungs = [], dead = [], quoted = [], utilityEmpty, kindLabel}) {
  const missing = rungs.filter(r => !r.indexed);
  const items = [
    ...missing.map(r => ({k: `rung-${r.key || r.label}`, t: `${r.label} not indexed`, d: 'Clarity holds nothing for this rung yet.'})),
    utilityEmpty ? {k: 'gap-utility', t: 'No clinical-utility finding', d: 'Accuracy, association or prognosis is not evidence that using the marker helps.'} : null,
    quoted.length ? {k: 'quoted', t: `${quoted.length} quoted, not counted`, d: 'Numbers repeated from other papers are shown separately and do not count here.'} : null,
    dead.length ? {k: 'dead', t: `${dead.length} extraction attempt${dead.length === 1 ? '' : 's'} produced no typed finding`, d: 'A rejected passage is not evidence against this object.'} : null,
  ].filter(Boolean);
  return (
    <section className="os-module" id="os-gaps">
      <h2>Gaps in this library</h2>
      {!items.length && <p className="os-lead">No structural gaps were computed from the indexed fields for this {kindLabel || 'entity'}.</p>}
      <ul className="os-findings">
        {items.map(x => (
          <li key={x.k}>
            <strong className="os-gap">{x.t}</strong>
            <div className="os-note">{x.d}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FindingLedger({rows = [], onInspect}) {
  const list = flatten(rows);
  if (!list.length) return <p className="os-note">No typed findings are indexed for this object.</p>;
  return (
    <div className="os-table-wrap" style={{overflowX: 'auto'}}>
      <table className="os-ledger">
        <caption className="os-sr">Source-bound findings. Values are as extracted. Nothing is pooled.</caption>
        <thead>
          <tr>
            {['Kind', 'Measure', 'Target', 'Population', 'Layer', 'Source'].map(h => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {list.map(f => (
            <tr key={f.id} onClick={() => onInspect?.(f)}>
              <td>{f.kind}</td>
              <td className="os-num">{valueText(f)}</td>
              <td>{f.target || '—'}</td>
              <td>{f.population || '—'}</td>
              <td>{f.layer ? layerLabel(f.layer) : '—'}</td>
              <td>{f.pmid ? `PMID ${f.pmid}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function IdentitySchematic({kind, entity = {}, related = []}) {
  const gene = related.find(r => r.kind === 'Gene' || String(r.id).startsWith('gene:'));
  const protein = related.find(r => r.kind === 'Protein' || String(r.id).startsWith('protein:'));
  const marker = related.find(r => r.kind === 'Biomarker' || String(r.id).startsWith('biomarker:'));
  const nodes = [];
  if (kind === 'gene' || gene) nodes.push({id: gene?.id || entity.id, label: gene?.name || entity.name, k: 'Gene'});
  if (kind === 'protein' || protein) nodes.push({id: protein?.id || (kind === 'protein' ? entity.id : null), label: protein?.name || (kind === 'protein' ? entity.name : 'Protein'), k: 'Protein'});
  if (kind === 'biomarker' || marker) nodes.push({id: marker?.id || (kind === 'biomarker' ? entity.id : null), label: marker?.name || (kind === 'biomarker' ? entity.name : 'Measurement'), k: 'Biomarker'});
  const shown = nodes.filter(n => n.id);
  if (shown.length < 2 && entity.locus?.gene_symbol && kind !== 'gene') {
    shown.unshift({id: `gene:${entity.locus.gene_symbol.toLowerCase()}`, label: `${entity.locus.gene_symbol} gene`, k: 'Gene'});
  }
  return (
    <figure className="os-module">
      <h2>Identity</h2>
      <p className="os-caption">Gene, protein and measured biomarker are separate objects. A finding about one is not attached to another.</p>
      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
        {shown.map((n, i) => (
          <React.Fragment key={n.id}>
            <a href={osPathFromId(n.id)} className="os-ghost" style={{borderColor: kindColor(n.k)}}>
              <span className="os-kind" style={{'--kind': kindColor(n.k)}}>{n.k}</span> {n.label}
            </a>
            {i < shown.length - 1 && <span className="os-note">→</span>}
          </React.Fragment>
        ))}
      </div>
      {entity.locus?.chrom && (
        <p className="os-locus" style={{marginTop: 12}}>
          {entity.locus.assembly || 'GRCh38'} · chr{entity.locus.chrom}:{entity.locus.start_bp?.toLocaleString()}–{entity.locus.end_bp?.toLocaleString()} · {entity.locus.gene_symbol}
        </p>
      )}
    </figure>
  );
}

export function AucFigure({findings}) {
  const strip = aucStrip(findings);
  if (!strip.points.length) return null;
  const W = 640, L = 200, R = 620, ROW = 28, TOP = 16, H = TOP + strip.points.length * ROW + 36;
  const [lo, hi] = strip.domain;
  const x = v => L + (v - lo) / (hi - lo) * (R - L);
  const ticks = lo === 0 ? [0, 0.25, 0.5, 0.75, 1] : [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const clip = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
  return (
    <figure className="os-module">
      <h2>Reported discrimination</h2>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${strip.points.length} reported AUC or C-index values, not pooled.`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP - 8} y2={H - 30} stroke="currentColor" strokeOpacity={t === 0.5 ? 0.7 : 0.16} strokeDasharray={t === 0.5 ? '4 3' : undefined} />
            <text x={x(t)} y={H - 12} textAnchor="middle" fontSize="11" fill="currentColor">{t === 0.5 ? '0.5 chance' : t}</text>
          </g>
        ))}
        {strip.points.map((p, i) => {
          const y = TOP + i * ROW + ROW / 2;
          return (
            <g key={p.id}>
              <text x={L - 14} y={y + 4} textAnchor="end" fontSize="11.5" fill="currentColor">{clip(p.label, 32)}</text>
              {p.lower != null && p.upper != null && <line x1={x(p.lower)} x2={x(p.upper)} y1={y} y2={y} stroke="#3ee0c4" strokeWidth="2" />}
              <circle cx={x(p.estimate)} cy={y} r="5" fill="#3ee0c4" />
            </g>
          );
        })}
      </svg>
      <figcaption className="os-caption">Each point is one study’s own AUC or C-index. Populations and assays differ. Nothing is pooled. Discrimination is not calibration or clinical utility.</figcaption>
    </figure>
  );
}

export function ClassificationTable({findings}) {
  const table = classificationRows(findings);
  if (!table.rows.length) return null;
  return (
    <figure className="os-module">
      <h2>Classification at the authors’ cut-off</h2>
      <div style={{overflowX: 'auto'}}>
        <table className="os-ledger">
          <thead>
            <tr>
              <th>Target</th><th>Cut-off</th><th>Assay</th>
              {table.columns.map(([m, label]) => <th key={m}>{label}</th>)}
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(r => (
              <tr key={r.key}>
                <td>{r.target || 'Not stated'}</td>
                <td className="os-num">{r.cutoff || 'Not stated'}</td>
                <td>{r.assay || 'Not stated'}</td>
                {table.columns.map(([m]) => <td key={m} className="os-num">{r.values[m] ?? '—'}</td>)}
                <td>{r.pmid ? <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer">PMID {r.pmid}</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="os-caption">Accuracy at a stated cut-off and assay. Rows from different studies are not comparable. Accuracy is not evidence that testing improves outcomes.</figcaption>
    </figure>
  );
}

export function StudyTimeline({findings}) {
  const rows = flatten(findings).filter(f => f.year);
  if (!rows.length) return null;
  const years = [...new Set(rows.map(f => Number(f.year)))].filter(Number.isFinite).sort((a, b) => a - b);
  if (years.length < 2) {
    return <p className="os-note">Indexed years: {years.join(', ') || 'not reported'}.</p>;
  }
  const lo = years[0], hi = years.at(-1);
  const x = y => ((y - lo) / (hi - lo || 1)) * 100;
  return (
    <figure className="os-module">
      <h2>When these findings were published</h2>
      <svg viewBox="0 0 640 70" role="img" aria-label={`Findings from ${lo} to ${hi}`}>
        <line x1="16" x2="624" y1="32" y2="32" stroke="#33425a" />
        {years.map(y => (
          <g key={y}>
            <circle cx={16 + x(y) * 6.08} cy="32" r="4" fill="#3ee0c4" />
            <text x={16 + x(y) * 6.08} y="58" textAnchor="middle" fontSize="11" fill="#8b9bb3">{y}</text>
          </g>
        ))}
      </svg>
      <figcaption className="os-caption">Publication year of indexed records. This is not a systematic search date.</figcaption>
    </figure>
  );
}

export function CatalogPulse({entries}) {
  const kinds = ['gene', 'protein', 'biomarker', 'variant', 'intervention', 'test', 'precision_context'];
  const counts = Object.fromEntries(kinds.map(k => [k, 0]));
  const layers = Object.fromEntries(LAYERS.map(l => [l, 0]));
  for (const e of entries || []) {
    const k = libraryKind(e);
    if (counts[k] != null) counts[k] += 1;
    for (const layer of e.graph_layers || []) if (layers[layer] != null) layers[layer] += 1;
  }
  return (
    <figure>
      <p className="os-eyebrow">Indexed objects</p>
      <h2 style={{fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, margin: '6px 0 12px'}}>What this library currently holds</h2>
      <table className="os-pulse">
        <thead><tr><th>Kind</th><th>Objects</th></tr></thead>
        <tbody>
          {kinds.filter(k => counts[k]).map(k => (
            <tr key={k}><td style={{color: kindColor(k)}}>{k.replace('_', ' ')}</td><td className="os-num">{counts[k]}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="os-caption" style={{marginTop: 12}}>Layer-tagged graph entries (an object can contribute to several layers):</p>
      <ol className="os-pipeline">
        {LAYERS.map(l => (
          <li key={l} style={{borderTop: `2px solid var(--layer-${l})`}}>
            <strong>{layerLabel(l)}</strong>
            <span className="os-num">{layers[l]}</span>
          </li>
        ))}
      </ol>
      <figcaption className="os-caption">Counts describe this catalog snapshot. They are not grades and not a complete literature search.</figcaption>
    </figure>
  );
}

