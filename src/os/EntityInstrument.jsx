import React, {useEffect, useState} from 'react';
import {
  identity, biology, measurement, meaning, utility,
  flatten, findingsCsv, findingsJson, quotedRows, freshness, externalLinks, ucscLink, deadLetterText, relationLabel,
} from '../evidence/graphProfile.js';
import {useOsEntity} from './data.js';
import {KIND_LABEL, osPathFromId} from './routes.js';
import {identityFromKindSlug, visualExtractId, SOURCE_META} from './identity.js';
import {questionsForKind, rungsForKind, usesBiomarkerContract} from './questions.js';
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
  const ident = identityFromKindSlug(kind, slug);

  useEffect(() => {
    const id = entity?.id || ident.id;
    if (!id) return;
    rememberEntity({id, name: entity?.name || slug, kind, path: ident.path, origin: state.source});
    setPinned(loadOsStore().pins.some(p => p.id === id || p.path === ident.path));
  }, [entity?.id, entity?.name, kind, ident.id, ident.path, state.source, slug]);

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
  const ask = questionsForKind(kind);
  const origin = state.source || data.origin;
  const rungs = rungsForKind(kind, entity, findings, related, {...data, origin});
  const quoted = quotedRows(data);
  const stale = freshness(data);
  const links = externalLinks(entity);
  const ucsc = ucscLink(entity);
  const isPinned = loadOsStore().pins.some(p => p.id === entity.id || p.path === ident.path);
  const graphBacked = origin === 'live' || origin === 'snapshot';
  const derived = origin === 'derived';
  const showBiomarkerFigures = usesBiomarkerContract(kind) && rows.length > 0;
  const showEvidenceChrome = graphBacked || rows.length > 0;

  function download(text, mime, ext) {
    const url = URL.createObjectURL(new Blob([text], {type: mime}));
    const a = Object.assign(document.createElement('a'), {href: url, download: `${entity.id.replace(':', '-')}.${ext}`});
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const focus = {id: entity.id, name: entity.name, kind: entity.kind || kind};

  return (
    <div className="os-entity" data-kind={kind} data-origin={origin || ''}>
      <aside className="os-identity">
        <p className="os-kind" style={{'--kind': kindColor(kind)}}>{KIND_LABEL[kind]}</p>
        <h1>{entity.name}</h1>
        <p className="os-id">{entity.id}</p>
        <SourceChip origin={origin} note={data.derived_note || data.catalog_note} derivedFrom={data.derived_from} go={go} />
        {stale && <p className="os-note">{stale}</p>}
        <p className="os-lead">{q1.text}</p>
        <dl className="os-facts">
          <div><dt>Class</dt><dd>{q1.label}</dd></div>
          {q1.specimen && kind !== 'protein' && kind !== 'gene' && <div><dt>Specimen</dt><dd>{q1.specimen}</dd></div>}
          <div><dt>Publications</dt><dd className="os-num">{derived ? '—' : (data.studies ?? '—')}</dd></div>
          <div><dt>Typed findings</dt><dd className="os-num">{derived ? 0 : rows.length}</dd></div>
          <div><dt>Backing</dt><dd>{SOURCE_META[origin]?.short || origin}</dd></div>
        </dl>
        {ask && (
          <nav className="os-qspine" aria-label={`${KIND_LABEL[kind]} question spine`}>
            {rungs.slice(0, ask.length).map((r, i) => (
              <a key={r.key} href={`#${r.target || 'os-q' + (i + 1)}`} data-indexed={r.constraint ? 'constraint' : r.indexed}>
                <span>Q{i + 1}</span>
                <span>{ask[i] || r.label}</span>
                <strong>{r.constraint ? 'Limit' : r.indexed ? 'Indexed' : 'Unavailable'}</strong>
              </a>
            ))}
          </nav>
        )}
        <div className="os-actions">
          <button className="os-ghost" type="button" onClick={() => {
            const next = togglePin({id: entity.id, name: entity.name, kind, path: ident.path, origin});
            setPinned(next.pins.some(p => p.id === entity.id || p.path === ident.path));
          }}>{isPinned || pinned ? 'Pinned' : 'Pin'}</button>
          <button className="os-ghost" type="button" onClick={() => go(`/graph?focus=${encodeURIComponent(entity.id)}`)}>Graph</button>
          <button className="os-ghost" type="button" onClick={() => go(`/explore/compare?profile=${encodeURIComponent(visualExtractId(ident))}`)}>Compare</button>
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
        {kind === 'gene' && <GeneStage entity={entity} related={related} findings={findings} q1={q1} q2={q2} ask={ask} origin={origin} go={go} onInspect={setInspect} />}
        {kind === 'protein' && <ProteinStage entity={entity} related={related} q1={q1} ask={ask} origin={origin} go={go} />}
        {kind === 'biomarker' && <BiomarkerStage entity={entity} findings={findings} q1={q1} q2={q2} q3={q3} q4={q4} q5={q5} ask={ask} onInspect={setInspect} />}
        {kind === 'variant' && <VariantStage entity={entity} related={related} findings={findings} q4={q4} ask={ask} go={go} onInspect={setInspect} />}
        {kind === 'test' && <TestStage entity={entity} findings={findings} q3={q3} q4={q4} q5={q5} ask={ask} onInspect={setInspect} />}
        {kind === 'precision_context' && <ContextStage entity={entity} related={related} findings={findings} q4={q4} q5={q5} ask={ask} go={go} onInspect={setInspect} />}
        {['metabolite', 'condition', 'pathway'].includes(kind) && (
          <GenericStage kind={kind} entity={entity} findings={findings} q4={q4} ask={ask} onInspect={setInspect} />
        )}

        {showEvidenceChrome && <LayerPipeline layers={data.layers} findings={findings} />}
        {derived && (
          <section className="os-module">
            <h2>No protein-level findings on this view</h2>
            <p className="os-lead">Clarity did not copy biomarker findings onto this protein. Open the measured biomarker to read circulating-level evidence.</p>
          </section>
        )}
        {showEvidenceChrome && (
          <div id="os-human">
            <FindingLedger rows={findings} onInspect={setInspect} />
          </div>
        )}
        {showEvidenceChrome && <StudyTimeline findings={findings} />}
        {(related.length > 0 || graphBacked) && (
          <GraphNeighborhood focus={focus} related={related} go={go} onInspect={item => setInspect(item)} />
        )}
        <GapMap
          rungs={rungs.filter(r => !r.constraint)}
          dead={derived ? [] : (data.dead_letters || [])}
          quoted={derived ? [] : quoted}
          utilityEmpty={usesBiomarkerContract(kind) && q5.state === 'empty'}
          kindLabel={KIND_LABEL[kind]}
        />
        {!derived && (data.dead_letters || []).length > 0 && (
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

function SourceChip({origin, note, derivedFrom, go}) {
  const meta = SOURCE_META[origin];
  if (!meta) return note ? <p className="os-warn">{note}</p> : null;
  return (
    <div className={`os-origin os-origin-${origin}`}>
      <p className="os-origin-label">{meta.short}</p>
      <p>{note || meta.long}</p>
      {derivedFrom && (
        <button className="os-ghost" type="button" onClick={() => go(osPathFromId(derivedFrom))}>
          Open backing object · {derivedFrom}
        </button>
      )}
    </div>
  );
}

function GeneStage({entity, related, findings, q1, q2, ask, origin, go, onInspect}) {
  const variants = related.filter(r => r.kind === 'Variant' || String(r.id).startsWith('variant:') || r.edge === 'VARIANT_OF');
  const rows = flatten(findings);
  return (
    <>
      <IdentitySchematic kind="gene" entity={entity} related={related} />
      <section className="os-module" id="os-q1">
        <h2><em>Q1</em> {ask[0]}</h2>
        <p className="os-lead">{q1.text}</p>
        <p className="os-caption">This is a gene as a unit of sequence. Findings about this gene are not findings about one of its variants, and not about protein or RNA levels.</p>
      </section>
      <section className="os-module" id="os-q2">
        <h2><em>Q2</em> {ask[1]}</h2>
        {entity.locus?.chrom ? (
          <p className="os-locus">{entity.locus.assembly || 'GRCh38'} · chr{entity.locus.chrom}:{entity.locus.start_bp?.toLocaleString()}–{entity.locus.end_bp?.toLocaleString()} · {entity.locus.gene_symbol}</p>
        ) : (
          <p className="os-lead" data-gap="true">Locus is not stored on this payload. That is a gap in Clarity, not a statement that the gene is unlocated.</p>
        )}
        {q2.findings?.length > 0
          ? <p className="os-lead">{q2.text}</p>
          : <p className="os-note">No mechanism or laboratory finding is attached to this gene node.</p>}
      </section>
      <section className="os-module" id="os-q3">
        <h2><em>Q3</em> {ask[2]}</h2>
        {variants.length ? variants.map(v => (
          <a key={v.id} className="os-ghost" href={osPathFromId(v.id)} onClick={e => { e.preventDefault(); go(osPathFromId(v.id)); }} style={{display: 'inline-flex', margin: 4}}>{v.name}</a>
        )) : <p className="os-lead" data-gap="true">No variant edges on this 1-hop payload. Catalog rows that share a symbol are not assumed to be this gene’s variants.</p>}
      </section>
      <section className="os-module" id="os-q4">
        <h2><em>Q4</em> {ask[3]}</h2>
        {rows.length
          ? <FindingLedger rows={findings} onInspect={onInspect} />
          : <p className="os-lead" data-gap="true">{origin === 'catalog' ? 'Catalog coverage is not a finding. Nothing gene-level is indexed on this page.' : 'No typed finding is attached to this gene.'}</p>}
      </section>
      <section className="os-module" id="os-q5">
        <h2><em>Q5</em> {ask[4]}</h2>
        <p className="os-lead">Do not mix gene-level status with a specific variant, protein abundance, circulating measurement, or clinical utility. Those are other objects, with their own pages.</p>
      </section>
    </>
  );
}

function ProteinStage({entity, related, q1, ask, origin, go}) {
  const gene = related.find(r => r.edge === 'ENCODED_BY' || r.kind === 'Gene' || String(r.id).startsWith('gene:'));
  const marker = related.find(r => r.kind === 'Biomarker' || String(r.id).startsWith('biomarker:'));
  const derived = origin === 'derived';
  return (
    <>
      <IdentitySchematic kind="protein" entity={entity} related={related} />
      <section className="os-module" id="os-q1">
        <h2><em>Q1</em> {ask[0]}</h2>
        <p className="os-lead">{q1.text}</p>
        <p className="os-caption">Protein level, transcript level and gene status are different measurements and are not interchangeable.</p>
      </section>
      <section className="os-module" id="os-q2">
        <h2><em>Q2</em> {ask[1]}</h2>
        {gene
          ? <a className="os-primary" href={osPathFromId(gene.id)} onClick={e => { e.preventDefault(); go(osPathFromId(gene.id)); }}>Encoded by · {gene.name}</a>
          : <p className="os-lead" data-gap="true">No encoding gene is linked on this payload.</p>}
      </section>
      <section className="os-module" id="os-q3">
        <h2><em>Q3</em> {ask[2]}</h2>
        <p className="os-lead" data-gap="true">
          {derived
            ? 'Unavailable. There is no protein node, so there are no protein-level findings. Circulating or assayed values live on the biomarker page and are not copied here.'
            : 'No protein-level finding is indexed on this node.'}
        </p>
      </section>
      <section className="os-module" id="os-q4">
        <h2><em>Q4</em> {ask[3]}</h2>
        <p className="os-lead">This identity is the molecular product. A measured biomarker (concentration, assay, specimen) is a different object.</p>
        {marker && (
          <a className="os-ghost" href={osPathFromId(marker.id)} onClick={e => { e.preventDefault(); go(osPathFromId(marker.id)); }}>
            Measured biomarker · {marker.name}
          </a>
        )}
      </section>
      <section className="os-module" id="os-q5">
        <h2><em>Q5</em> {ask[4]}</h2>
        <p className="os-lead">This view does not license claims about circulating levels, diagnostic accuracy, or clinical utility. UniProt {entity.external_ids?.uniprot || 'unrecorded'} identifies the product; it is not evidence.</p>
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

function VariantStage({entity, related, findings, q4, ask, go, onInspect}) {
  const gene = related.find(r => r.edge === 'VARIANT_OF' || String(r.id).startsWith('gene:'));
  const contexts = related.filter(r => r.kind === 'PrecisionContext' || String(r.id).startsWith('precision_context:') || r.reason === 'modifies_treatment');
  const rows = flatten(findings);
  return (
    <>
      <section className="os-module" id="os-q1">
        <h2><em>Q1</em> {ask[0]}</h2>
        <p className="os-caption">A specific sequence change. Evidence for one variant does not carry to the gene as a whole, or to another variant in it.</p>
      </section>
      <section className="os-module" id="os-q2">
        <h2><em>Q2</em> {ask[1]}</h2>
        {gene
          ? <a className="os-primary" href={osPathFromId(gene.id)} onClick={e => { e.preventDefault(); go(osPathFromId(gene.id)); }}>Parent gene · {gene.name}</a>
          : <p className="os-lead" data-gap="true">No parent gene is linked on this payload.</p>}
      </section>
      <section className="os-module" id="os-q3">
        <h2><em>Q3</em> {ask[2]}</h2>
        {rows.length ? <FindingLedger rows={findings} onInspect={onInspect} /> : <p className="os-lead" data-gap="true">No typed finding is attached to this variant.</p>}
        {q4.map(g => <div key={g.kind}><h3>{g.label}</h3>{g.sentences?.map(s => <p key={s}>{s}</p>)}</div>)}
      </section>
      <section className="os-module" id="os-q4">
        <h2><em>Q4</em> {ask[3]}</h2>
        {contexts.length
          ? contexts.map(p => <a key={p.id} className="os-ghost" href={osPathFromId(p.id)} onClick={e => { e.preventDefault(); go(osPathFromId(p.id)); }} style={{display: 'inline-flex', margin: 4}}>{p.name}</a>)
          : <p className="os-lead" data-gap="true">No precision-context edge is indexed on this variant.</p>}
      </section>
      <section className="os-module" id="os-q5">
        <h2><em>Q5</em> {ask[4]}</h2>
        <p className="os-lead">Do not generalize this variant to the whole gene, to other variants, or to protein or circulating measurements.</p>
      </section>
    </>
  );
}

function TestStage({entity, findings, q3, q4, q5, ask}) {
  return (
    <>
      <section className="os-module" id="os-q1"><h2><em>Q1</em> {ask[0]}</h2><p className="os-caption">A test as performed. Threshold, reference standard and population travel with every accuracy number. Predictive values depend on pre-test probability.</p></section>
      <section className="os-module" id="os-q3"><h2><em>Q3</em> {ask[2]}</h2><p>{q3.text}</p></section>
      <ClassificationTable findings={findings} />
      <AucFigure findings={findings} />
      <section className="os-module" id="os-q5"><h2><em>Q5</em> {ask[4]}</h2><p>{q5.text}</p><p className="os-caption">Detection is not benefit. Screening questions require downstream outcomes and harms, not accuracy alone.</p></section>
    </>
  );
}

function ContextStage({entity, related, findings, q4, q5, ask, go}) {
  const parts = related.slice(0, 6);
  return (
    <>
      <section className="os-module" id="os-q1">
        <h2><em>Q1</em> {ask[0]}</h2>
        <p className="os-caption">A marker × treatment × condition. Evidence here belongs to the combination, not to any part alone. Benefit in a selected subgroup is not by itself a biomarker-by-treatment interaction.</p>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          {parts.map(p => <a key={p.id} className="os-ghost" href={osPathFromId(p.id)} onClick={e => { e.preventDefault(); go(osPathFromId(p.id)); }}>{p.kind} · {p.name}</a>)}
        </div>
      </section>
      {q4.map(g => <section className="os-module" key={g.kind}><h2>{g.label}</h2>{g.sentences?.map(s => <p key={s}>{s}</p>)}</section>)}
      <section className="os-module" id="os-q5"><h2><em>Q5</em> {ask[4]}</h2><p>{q5.text}</p></section>
    </>
  );
}

function GenericStage({kind, entity, findings, q4, ask, onInspect}) {
  return (
    <section className="os-module" id="os-q1">
      <h2>{KIND_LABEL[kind]}</h2>
      <p className="os-caption">{kind === 'pathway' ? 'Pathway membership is not evidence about any single member.' : kind === 'condition' ? 'A disease or state that findings are reported for.' : 'Indexed object in the evidence graph.'}</p>
      {ask && <p className="os-note">{ask[0]}</p>}
      {q4.map(g => <div key={g.kind}><h3>{g.label}</h3>{g.sentences?.map(s => <p key={s}>{s}</p>)}</div>)}
      <FindingLedger rows={findings} onInspect={onInspect} />
    </section>
  );
}

function InterventionInstrument({slug, graph, go}) {
  const ident = identityFromKindSlug('intervention', slug);
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const dims = frameworks.frameworks?.intervention?.dimensions || ['Efficacy', 'Safety', 'Applicability'];
  const ask = questionsForKind('intervention');
  const [inspect, setInspect] = useState(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    rememberEntity({id: ident.id, name, kind: 'intervention', path: ident.path});
    setPinned(loadOsStore().pins.some(p => p.id === ident.id || p.path === ident.path));
  }, [ident.id, ident.path, name]);
  const related = graph.status === 'ready' ? (graph.data.related || []) : [];
  const origin = graph.source || (graph.status === 'missing' ? 'catalog' : graph.status === 'ready' ? graph.source : '');
  return (
    <div className="os-entity" data-kind="intervention" data-origin={origin || 'catalog'}>
      <aside className="os-identity">
        <p className="os-kind" style={{'--kind': kindColor('intervention')}}>Intervention</p>
        <h1>{name}</h1>
        <p className="os-id">{ident.id}</p>
        <SourceChip origin={origin === 'ready' ? 'live' : origin} />
        <p className="os-lead">{ask[0]}</p>
        <p className="os-caption">{frameworks.frameworks.intervention.method}</p>
        <nav className="os-qspine" aria-label="Intervention question spine">
          {ask.map((q, i) => (
            <a key={q} href={`#os-q${i + 1}`} data-indexed={i === 4 ? 'constraint' : 'true'}>
              <span>Q{i + 1}</span>
              <span>{q}</span>
              <strong>{i === 4 ? 'Limit' : 'Extract'}</strong>
            </a>
          ))}
        </nav>
        <dl className="os-facts">
          {dims.map(d => <div key={d}><dt>Dimension</dt><dd>{d}</dd></div>)}
        </dl>
        <div className="os-actions">
          <button className="os-ghost" type="button" onClick={() => {
            const next = togglePin({id: ident.id, name, kind: 'intervention', path: ident.path});
            setPinned(next.pins.some(p => p.id === ident.id));
          }}>{pinned ? 'Pinned' : 'Pin'}</button>
          <button className="os-ghost" type="button" onClick={() => go(`/graph?focus=${encodeURIComponent(ident.id)}`)}>Graph</button>
          <button className="os-ghost" type="button" onClick={() => go(`/explore/compare?profile=${encodeURIComponent(visualExtractId(ident))}`)}>Compare</button>
          <button className="os-ghost" type="button" onClick={() => go(`/investigate?evidence=${encodeURIComponent(name)}`)}>Investigate</button>
        </div>
        <AskRail entity={{id: ident.id, name}} go={go} />
      </aside>
      <main className="os-main">
        <section className="os-module" id="os-q1">
          <h2><em>Q1</em> {ask[0]}</h2>
          <p className="os-caption">Efficacy, safety and applicability stay separate. Human, animal and mechanistic evidence remain in their layers. No ranking across compounds is computed.</p>
        </section>
        <VisualProfile model={{targetId: ident.id, name, type: 'Intervention'}} showHeader={false} embedded />
        <section className="os-module" id="os-q5">
          <h2><em>Q5</em> {ask[4]}</h2>
          <p className="os-lead">These estimates do not license a ranking of compounds, a pooled effect, or a personal prediction. Detection of an estimate is not benefit.</p>
        </section>
        {related.length > 0 && <GraphNeighborhood focus={{id: ident.id, name, kind: 'intervention'}} related={related} go={go} onInspect={setInspect} />}
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
