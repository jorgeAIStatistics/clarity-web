import React, {useEffect, useMemo, useState} from 'react';
import {
  identity, biology, measurement, meaning, utility, ladder, questions, flatten,
  findingsCsv, findingsJson, quotedRows, freshness, externalLinks, ucscLink, deadLetterText, relationLabel,
} from '../evidence/graphProfile.js';
import {useOsEntity} from './data.js';
import {KIND_LABEL, osPathFromId} from './routes.js';
import {rememberEntity, togglePin, loadOsStore} from './store.js';
import {LayerPipeline, GapMap, FindingLedger, IdentitySchematic, AucFigure, ClassificationTable, StudyTimeline, kindColor} from './Figures.jsx';
import GraphNeighborhood from './GraphNeighborhood.jsx';
import Inspector from './Inspector.jsx';
import AskRail from './AskRail.jsx';
import VisualProfile from '../profile/VisualProfile.jsx';
import frameworks from '../evidence/frameworks.json';

export default function EntityInstrument({kind, slug, go}) {
  const state = useOsEntity(kind, slug);
  const [inspect, setInspect] = useState(null);
  const [pinned, setPinned] = useState(false);
  const data = state.data;
  const entity = data?.entity;

  useEffect(() => {
    if (entity?.id) rememberEntity({id: entity.id, name: entity.name, kind, path: osPathFromId(entity.id)});
    setPinned(loadOsStore().pins.some(p => p.id === entity?.id));
  }, [entity?.id, entity?.name, kind]);

  if (kind === 'intervention') {
    return <InterventionInstrument slug={slug} graph={state} go={go} />;
  }
  if (state.status === 'loading') {
    return <p className="os-status" role="status">Loading the {KIND_LABEL[kind] || kind} instrument…</p>;
  }
  if (state.status === 'error') {
    return <main className="os-work"><h1>Graph profile unavailable</h1><p>The evidence engine did not answer, and no bundled snapshot matches this address.</p><button className="os-ghost" onClick={() => go('/catalog')}>Catalog</button></main>;
  }
  if (state.status === 'missing' || !entity) {
    return <Missing kind={kind} slug={slug} go={go} />;
  }

  const related = data.related || [];
  const findings = data.findings || [];
  const rows = flatten(findings);
  const q1 = identity(entity, related);
  const q2 = biology(entity, findings);
  const q3 = measurement(entity, findings);
  const q4 = meaning(entity, findings);
  const q5 = utility(entity, findings);
  const rungs = ladder(entity, findings);
  const ask = questions(kind === 'precision_context' ? 'precision_oncology' : kind === 'test' ? 'diagnostic' : 'biomarker');
  const quoted = quotedRows(data);
  const stale = freshness(data);
  const links = externalLinks(entity);
  const ucsc = ucscLink(entity);
  const store = loadOsStore();
  const isPinned = store.pins.some(p => p.id === entity.id);

  function download(text, mime, ext) {
    const url = URL.createObjectURL(new Blob([text], {type: mime}));
    const a = Object.assign(document.createElement('a'), {href: url, download: `${entity.id.replace(':', '-')}.${ext}`});
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const focus = {id: entity.id, name: entity.name, kind: entity.kind || kind};

  return (
    <div className="os-entity" data-kind={kind}>
      <aside className="os-identity">
        <p className="os-kind" style={{'--kind': kindColor(kind)}}>{KIND_LABEL[kind]}</p>
        <h1>{entity.name}</h1>
        <p className="os-id">{entity.id}</p>
        {state.source === 'snapshot' && <p className="os-warn">Bundled snapshot. Live graph did not answer in time.</p>}
        {state.source === 'derived' && <p className="os-warn">{data.derived_note}</p>}
        {state.source === 'catalog' && <p className="os-warn">{data.catalog_note}</p>}
        {stale && <p className="os-note">{stale}</p>}
        <p className="os-lead">{q1.text}</p>
        <dl className="os-facts">
          <div><dt>Class</dt><dd>{q1.label}</dd></div>
          {q1.specimen && <div><dt>Specimen</dt><dd>{q1.specimen}</dd></div>}
          <div><dt>Publications</dt><dd className="os-num">{data.studies ?? '—'}</dd></div>
          <div><dt>Typed findings</dt><dd className="os-num">{rows.length}</dd></div>
        </dl>
        {kind !== 'intervention' && kind !== 'protein' && (
          <nav className="os-qspine" aria-label="Question spine">
            {rungs.slice(0, ask.length).map((r, i) => (
              <a key={r.key} href={`#${r.target || 'os-q' + (i + 1)}`} data-indexed={r.indexed}>
                <span>Q{i + 1}</span>
                <span>{ask[i] || r.label}</span>
                <strong>{r.indexed ? 'Indexed' : 'Gap'}</strong>
              </a>
            ))}
          </nav>
        )}
        <div className="os-actions">
          <button className="os-ghost" type="button" onClick={() => {
            const next = togglePin({id: entity.id, name: entity.name, kind, path: osPathFromId(entity.id)});
            setPinned(next.pins.some(p => p.id === entity.id));
          }}>{isPinned || pinned ? 'Pinned' : 'Pin'}</button>
          <button className="os-ghost" type="button" onClick={() => go(`/graph?focus=${encodeURIComponent(entity.id)}`)}>Graph</button>
          <button className="os-ghost" type="button" onClick={() => go(`/explore/compare?profile=${encodeURIComponent(kind === 'biomarker' ? `entity:${slug}` : entity.id)}`)}>Compare</button>
          {rows.length > 0 && <button className="os-ghost" type="button" onClick={() => download(findingsCsv(entity, findings), 'text/csv', 'csv')}>CSV</button>}
          {rows.length > 0 && <button className="os-ghost" type="button" onClick={() => download(findingsJson(entity, findings, data.layers), 'application/json', 'json')}>JSON</button>}
        </div>
        {(links.length > 0 || ucsc) && (
          <ul style={{listStyle: 'none', padding: 0, marginTop: 16}}>
            {links.map(l => <li key={l.key}><a href={l.url} target="_blank" rel="noreferrer">{l.label} <code>{l.id}</code></a><div className="os-note">{l.about}</div></li>)}
            {ucsc && <li><a href={ucsc.url} target="_blank" rel="noreferrer">UCSC {ucsc.position}</a></li>}
          </ul>
        )}
        <AskRail entity={entity} go={go} />
      </aside>

      <main className="os-main">
        {kind === 'gene' && <GeneStage entity={entity} related={related} findings={findings} q1={q1} q2={q2} go={go} onInspect={setInspect} />}
        {kind === 'protein' && <ProteinStage entity={entity} related={related} data={data} q1={q1} go={go} onInspect={setInspect} />}
        {kind === 'biomarker' && <BiomarkerStage entity={entity} findings={findings} q1={q1} q2={q2} q3={q3} q4={q4} q5={q5} ask={ask} onInspect={setInspect} />}
        {kind === 'variant' && <VariantStage entity={entity} related={related} findings={findings} q4={q4} go={go} onInspect={setInspect} />}
        {kind === 'test' && <TestStage entity={entity} findings={findings} q3={q3} q4={q4} q5={q5} ask={ask} onInspect={setInspect} />}
        {kind === 'precision_context' && <ContextStage entity={entity} related={related} findings={findings} q4={q4} q5={q5} go={go} onInspect={setInspect} />}
        {['metabolite', 'condition', 'pathway'].includes(kind) && (
          <GenericStage kind={kind} entity={entity} findings={findings} q4={q4} onInspect={setInspect} />
        )}

        <LayerPipeline layers={data.layers} findings={findings} />
        <div id="os-human">
          <FindingLedger rows={findings} onInspect={setInspect} />
        </div>
        <StudyTimeline findings={findings} />
        <GraphNeighborhood focus={focus} related={related} go={go} onInspect={item => setInspect(item)} />
        <GapMap rungs={rungs} dead={data.dead_letters || []} quoted={quoted} utilityEmpty={q5.state === 'empty'} kindLabel={KIND_LABEL[kind]} />
        {(data.dead_letters || []).length > 0 && (
          <details className="os-module">
            <summary>{data.dead_letters.length} extraction attempts with no typed finding</summary>
            <ul>{data.dead_letters.map(d => <li key={`${d.pmid}-${d.at}`}>{d.pmid ? `PMID ${d.pmid}` : 'Source'}: {deadLetterText(d)}.</li>)}</ul>
          </details>
        )}
      </main>
      <Inspector item={inspect} go={go} />
    </div>
  );
}

function GeneStage({entity, related, findings, q1, q2, go, onInspect}) {
  const variants = related.filter(r => r.kind === 'Variant' || String(r.id).startsWith('variant:') || r.edge === 'VARIANT_OF');
  return (
    <>
      <IdentitySchematic kind="gene" entity={entity} related={related} />
      <section className="os-module" id="os-q1">
        <h2>Gene as a unit of sequence</h2>
        <p className="os-lead">{q1.text}</p>
        <p className="os-caption">Findings about this gene are not findings about one of its variants, and not about protein or RNA levels.</p>
      </section>
      <section className="os-module">
        <h2>Variants indexed on this payload</h2>
        {variants.length ? variants.map(v => (
          <a key={v.id} className="os-ghost" href={osPathFromId(v.id)} onClick={e => { e.preventDefault(); go(osPathFromId(v.id)); }} style={{display: 'inline-flex', margin: 4}}>{v.name}</a>
        )) : <p className="os-note">No variant edges on this 1-hop payload. Variants that share a name in the catalog are not assumed to be this gene’s variants.</p>}
      </section>
      {q2.findings?.length > 0 && <section className="os-module" id="os-q2"><h2>Biology indexed</h2><FindingLedger rows={q2.findings} onInspect={onInspect} /></section>}
    </>
  );
}

function ProteinStage({entity, related, data, q1, go, onInspect}) {
  return (
    <>
      <IdentitySchematic kind="protein" entity={entity} related={related} />
      <section className="os-module" id="os-q1">
        <h2>Protein product</h2>
        <p className="os-lead">{q1.text}</p>
        <p className="os-caption">Protein level, transcript level and gene status are different measurements and are not interchangeable.</p>
        {data.derived_note && <p className="os-warn">{data.derived_note}</p>}
      </section>
      <section className="os-module">
        <h2>Molecular neighbors</h2>
        <ul className="os-findings">
          {related.map(r => (
            <li key={r.id}>
              <span className="os-kind" style={{'--kind': kindColor(r.kind)}}>{r.kind}</span>{' '}
              <a href={osPathFromId(r.id)} onClick={e => { e.preventDefault(); go(osPathFromId(r.id)); }}>{r.name}</a>
              <div className="os-note">{relationLabel(r)}</div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function BiomarkerStage({entity, findings, q1, q2, q3, q4, q5, ask, onInspect}) {
  return (
    <>
      <IdentitySchematic kind="biomarker" entity={entity} related={q1.molecular || []} />
      <section className="os-module" id="os-q1"><h2><em>Q1</em> {ask[0]}</h2><p className="os-lead">{q1.text}{q1.specimen ? ` Measured in ${q1.specimen.toLowerCase()}.` : ''}</p></section>
      <section className="os-module" id="os-q2"><h2><em>Q2</em> {ask[1]}</h2><p className="os-lead">{q2.text}</p></section>
      <section className="os-module" id="os-q3"><h2><em>Q3</em> {ask[2]}</h2><p className="os-lead" data-gap={q3.gap || undefined}>{q3.text}</p>
        <dl className="os-facts">{q3.assays?.length > 0 && <div><dt>Assays named</dt><dd>{q3.assays.join(' · ')}</dd></div>}{q3.units?.length > 0 && <div><dt>Units</dt><dd>{q3.units.join(' · ')}</dd></div>}</dl>
      </section>
      <section className="os-module" id="os-q4">
        <h2><em>Q4</em> {ask[3]}</h2>
        {q4.length === 0 && <p className="os-lead">No typed finding is indexed, so this page supports no claim about what the value indicates.</p>}
        {q4.map(g => (
          <div key={g.kind}>
            <h3>{g.label} <span className="os-num">{g.rows.length}</span></h3>
            {g.sentences?.map(s => <p className="os-lead" key={s}>{s}</p>)}
          </div>
        ))}
        <ClassificationTable findings={findings} />
        <AucFigure findings={findings} />
      </section>
      <section className="os-module" id="os-q5">
        <h2><em>Q5</em> {ask[4]}</h2>
        <p className="os-lead">{q5.text}</p>
        <p className="os-caption">The only finding kind that speaks to clinical value is utility. Accuracy, association and prognosis do not substitute for it.</p>
      </section>
    </>
  );
}

function VariantStage({entity, related, findings, q4, go, onInspect}) {
  const gene = related.find(r => r.edge === 'VARIANT_OF' || String(r.id).startsWith('gene:'));
  return (
    <>
      <section className="os-module">
        <h2>A specific sequence change</h2>
        <p className="os-caption">Evidence for one variant does not carry to the gene as a whole, or to another variant in it.</p>
        {gene && <a className="os-primary" href={osPathFromId(gene.id)} onClick={e => { e.preventDefault(); go(osPathFromId(gene.id)); }}>Parent gene · {gene.name}</a>}
      </section>
      {q4.map(g => <section className="os-module" key={g.kind}><h2>{g.label}</h2>{g.sentences?.map(s => <p key={s}>{s}</p>)}</section>)}
    </>
  );
}

function TestStage({entity, findings, q3, q4, q5, ask}) {
  return (
    <>
      <section className="os-module"><h2>Test as performed</h2><p className="os-caption">Threshold, reference standard and population travel with every accuracy number. Predictive values depend on pre-test probability.</p></section>
      <section className="os-module"><h2>{ask[2]}</h2><p>{q3.text}</p></section>
      <ClassificationTable findings={findings} />
      <AucFigure findings={findings} />
      <section className="os-module"><h2>{ask[4]}</h2><p>{q5.text}</p><p className="os-caption">Detection is not benefit. Screening questions require downstream outcomes and harms, not accuracy alone.</p></section>
    </>
  );
}

function ContextStage({entity, related, findings, q4, q5, go}) {
  const parts = related.slice(0, 6);
  return (
    <>
      <section className="os-module">
        <h2>Marker × treatment × condition</h2>
        <p className="os-caption">Evidence here belongs to the combination, not to any part alone. Benefit in a selected subgroup is not by itself a biomarker-by-treatment interaction.</p>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          {parts.map(p => <a key={p.id} className="os-ghost" href={osPathFromId(p.id)} onClick={e => { e.preventDefault(); go(osPathFromId(p.id)); }}>{p.kind} · {p.name}</a>)}
        </div>
      </section>
      {q4.map(g => <section className="os-module" key={g.kind}><h2>{g.label}</h2>{g.sentences?.map(s => <p key={s}>{s}</p>)}</section>)}
      <section className="os-module"><h2>Utility of selecting on this modifier</h2><p>{q5.text}</p></section>
    </>
  );
}

function GenericStage({kind, entity, findings, q4, onInspect}) {
  return (
    <section className="os-module">
      <h2>{KIND_LABEL[kind]}</h2>
      <p className="os-caption">{kind === 'pathway' ? 'Pathway membership is not evidence about any single member.' : kind === 'condition' ? 'A disease or state that findings are reported for.' : 'Indexed object in the evidence graph.'}</p>
      {q4.map(g => <div key={g.kind}><h3>{g.label}</h3>{g.sentences?.map(s => <p key={s}>{s}</p>)}</div>)}
      <FindingLedger rows={findings} onInspect={onInspect} />
    </section>
  );
}

function InterventionInstrument({slug, graph, go}) {
  const targetId = `compound:${slug}`;
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const dims = frameworks.frameworks?.intervention?.dimensions || ['Efficacy', 'Safety', 'Applicability'];
  const [inspect, setInspect] = useState(null);
  useEffect(() => { rememberEntity({id: targetId, name, kind: 'intervention', path: `/intervention/${slug}`}); }, [slug, name]);
  const related = graph.status === 'ready' ? (graph.data.related || []) : [];
  return (
    <div className="os-entity" data-kind="intervention">
      <aside className="os-identity">
        <p className="os-kind" style={{'--kind': kindColor('intervention')}}>Intervention</p>
        <h1>{name}</h1>
        <p className="os-id">{targetId}</p>
        <p className="os-lead">{frameworks.frameworks.intervention.question}</p>
        <p className="os-caption">{frameworks.frameworks.intervention.method}</p>
        <dl className="os-facts">
          {dims.map(d => <div key={d}><dt>Dimension</dt><dd>{d}</dd></div>)}
        </dl>
        <div className="os-actions">
          <button className="os-ghost" type="button" onClick={() => togglePin({id: targetId, name, kind: 'intervention', path: `/intervention/${slug}`})}>Pin</button>
          <button className="os-ghost" type="button" onClick={() => go(`/explore/compare?profile=${encodeURIComponent(targetId)}`)}>Compare</button>
          <button className="os-ghost" type="button" onClick={() => go(`/investigate?evidence=${encodeURIComponent(name)}`)}>Investigate</button>
        </div>
        <AskRail entity={{id: targetId, name}} go={go} />
      </aside>
      <main className="os-main">
        <section className="os-module">
          <h2>Does this intervention help?</h2>
          <p className="os-caption">Efficacy, safety and applicability stay separate. Human, animal and mechanistic evidence remain in their layers. No ranking across compounds is computed.</p>
        </section>
        <VisualProfile model={{targetId, name, type: 'Intervention'}} showHeader={false} embedded />
        {related.length > 0 && <GraphNeighborhood focus={{id: targetId, name, kind: 'intervention'}} related={related} go={go} onInspect={setInspect} />}
        {graph.status === 'missing' && <p className="os-note">This compound is not a graph node in the current payload. The report below is the intervention evidence extract, not a Neo4j neighborhood.</p>}
      </main>
      <Inspector item={inspect} go={go} />
    </div>
  );
}

function Missing({kind, slug, go}) {
  return (
    <main className="os-work">
      <p className="os-kind" style={{'--kind': kindColor(kind)}}>{KIND_LABEL[kind]}</p>
      <h1>Not in this library</h1>
      <p className="os-lede">No {KIND_LABEL[kind].toLowerCase()} node is indexed at <code>{kind}:{slug}</code>. That is a gap in Clarity, not a statement about the literature.</p>
      <button className="os-primary" type="button" onClick={() => go('/catalog')}>Return to catalog</button>
    </main>
  );
}
