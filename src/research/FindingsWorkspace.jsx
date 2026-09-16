import React, { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { safeSource } from '../platform/profileModel.js';
import { workspaceRows, facets, filterRows, toTsv, toCsv, toJson, methodsSnippet, SOURCES, COLUMNS } from './workspaceModel.js';

const FACETS = [['kind', 'Finding kind'], ['layer', 'Layer'], ['entity', 'Entity'], ['source', 'Where it came from']];
const label = (facet, value) => (facet === 'source' ? SOURCES[value] || value : value);

function download(text, mime, extension) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `clarity-findings.${extension}` });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FindingsWorkspace({ result, estimates, briefs = [], restatement = '', question = '' }) {
  const rows = useMemo(() => workspaceRows({ result, estimates }), [result, estimates]);
  const options = useMemo(() => facets(rows), [rows]);
  const [filters, setFilters] = useState({ kinds: [], layers: [], entities: [], sources: [], text: '' });
  const [selected, setSelected] = useState([]);
  const [said, setSaid] = useState('');
  const shown = useMemo(() => filterRows(rows, filters), [rows, filters]);
  if (!rows.length) return null;

  const chosen = shown.filter(row => selected.includes(row.id));
  const taken = chosen.length ? chosen : shown;
  const described = [
    filters.kinds.length && `kind ${filters.kinds.join(' or ')}`,
    filters.layers.length && `layer ${filters.layers.join(' or ')}`,
    filters.entities.length && `entity ${filters.entities.join(' or ')}`,
    filters.sources.length && `source ${filters.sources.map(s => SOURCES[s] || s).join(' or ')}`,
    filters.text.trim() && `text “${filters.text.trim()}”`,
  ].filter(Boolean).join(', ');
  const meta = { question, rows_shown: shown.length, rows_in_question: rows.length, filtered_by: described || null };
  const announce = message => { setSaid(message); setTimeout(() => setSaid(''), 4000); };
  const copy = (text, message) => {
    navigator.clipboard?.writeText(text).then(() => announce(message)).catch(() => announce('Copying was blocked; use a download instead.'));
  };
  const toggle = (key, value) => setFilters(current => {
    const list = current[key];
    return { ...current, [key]: list.includes(value) ? list.filter(x => x !== value) : [...list, value] };
  });

  return <section className="qm-panel qm-workspace-panel" aria-labelledby="qm-workspace">
    <div className="qm-panel-head"><span className="qm-letter" aria-hidden="true">W</span><h2 id="qm-workspace">Findings workspace</h2></div>
    <p className="qm-sub">Every finding behind this map in one table: filter it, take the rows you need, and copy a methods sentence that states what was and was not in the library.</p>

    <div className="qm-facets">
      <label className="qm-search-field">Search these findings
        <input type="search" value={filters.text} placeholder="outcome, population, assay, PMID…" onChange={e => setFilters({ ...filters, text: e.target.value })} />
      </label>
      {FACETS.filter(([facet]) => options[facet].length > 1).map(([facet, title]) => <fieldset key={facet}>
        <legend>{title}</legend>
        {options[facet].map(option => {
          const key = { kind: 'kinds', layer: 'layers', entity: 'entities', source: 'sources' }[facet];
          const active = filters[key].includes(option.value);
          return <button type="button" key={option.value} aria-pressed={active} onClick={() => toggle(key, option.value)}>
            {label(facet, option.value)} <span>{option.n}</span>
          </button>;
        })}
      </fieldset>)}
    </div>

    <div className="qm-workspace-actions">
      <p role="status">{shown.length} of {rows.length} {rows.length === 1 ? 'finding' : 'findings'} shown · {chosen.length ? `${chosen.length} selected` : 'none selected, so actions use every row shown'}</p>
      <div className="qm-actions">
        <button type="button" className="qm-button" onClick={() => copy(toTsv(taken), `${taken.length} rows copied as a table.`)}>Copy table</button>
        <button type="button" className="qm-button" onClick={() => download(toCsv(taken), 'text/csv', 'csv')}>Download CSV</button>
        <button type="button" className="qm-button" onClick={() => download(toJson(taken, meta), 'application/json', 'json')}>Download JSON</button>
        <button type="button" className="qm-button" onClick={() => copy(methodsSnippet({ question, restatement, rows: taken, briefs, result, filters: described || null }), 'Methods sentence copied.')}>Copy methods snippet</button>
        {selected.length > 0 && <button type="button" className="qm-button qm-ghost" onClick={() => setSelected([])}>Clear selection</button>}
      </div>
      <p className="qm-sr" aria-live="polite">{said}</p>
      {said && <p className="qm-note">{said}</p>}
    </div>

    <div className="qm-scroll">
      <table className="qm-workspace-table">
        <caption className="qm-sr">Findings behind this map, with their source, population and passage.</caption>
        <thead><tr>
          <th scope="col"><input type="checkbox" aria-label="Select every row shown" checked={shown.length > 0 && chosen.length === shown.length}
            onChange={e => setSelected(e.target.checked ? shown.map(r => r.id) : [])} /></th>
          <th scope="col">Entity</th><th scope="col">Kind</th><th scope="col">Reported</th><th scope="col">For</th>
          <th scope="col">Population</th><th scope="col">Layer</th><th scope="col">Source</th>
        </tr></thead>
        <tbody>{shown.map(row => <tr key={row.id} data-selected={selected.includes(row.id) || undefined}>
          <td><input type="checkbox" aria-label={`Select ${row.entity} ${row.display}`} checked={selected.includes(row.id)}
            onChange={() => setSelected(current => (current.includes(row.id) ? current.filter(x => x !== row.id) : [...current, row.id]))} /></td>
          <th scope="row">{row.entity || '—'}</th>
          <td>{row.kind}</td>
          <td className="qm-num">{row.display || '—'}</td>
          <td>{row.target || '—'}</td>
          <td>{row.population || 'Not stated'}</td>
          <td>{row.layer || '—'}</td>
          <td>{SOURCES[row.source]}{row.pmid && <> · {safeSource(`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`)
            ? <a href={`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`} target="_blank" rel="noreferrer">PMID {row.pmid} <ArrowUpRight size={12} aria-hidden="true" /></a>
            : `PMID ${row.pmid}`}</>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!shown.length && <p className="qm-note">No finding matches these filters. Clear one to see the rest.</p>}
    <p className="qm-note">Exports carry {COLUMNS.length} columns including the quoted passage and the review state. Automated extraction, not expert-reviewed; aggregate published results only.</p>
  </section>;
}
