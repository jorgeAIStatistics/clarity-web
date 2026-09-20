import React from 'react';

const LAYERS = [
  ['Mechanism', 'How might a biological process work? A plausible mechanism does not establish a benefit in people.'],
  ['Preclinical', 'What happened in cells or animals? Species, experimental conditions, and exposures limit translation.'],
  ['Observational', 'What patterns occur in people? Confounding and reverse causation can explain an association.'],
  ['Interventional', 'What changed when an intervention was tested? Compare populations, controls, outcomes, effect sizes, and uncertainty.'],
  ['Guidelines', 'How do guidelines and regulators interpret a specific use? Their scope, population, and date matter.'],
];

const KINDS = [
  ['Gene', 'A unit of sequence. Findings about a gene are not findings about one of its variants, and not about protein or RNA levels.'],
  ['Protein', 'A molecular product. Protein level, transcript level and gene status are not interchangeable.'],
  ['Variant', 'A specific sequence change. Evidence for one variant does not carry to the gene or to another variant.'],
  ['Biomarker', 'A quantity measured in a sample or image. Assay, units and population travel with every value.'],
  ['Test / assay', 'A procedure as performed. Accuracy is not evidence that testing improves outcomes.'],
  ['Precision context', 'Marker × treatment × condition. Evidence belongs to the combination.'],
  ['Intervention', 'A compound or exposure. Efficacy, safety and applicability stay separate. Nothing is ranked across compounds.'],
];

export default function Methods() {
  return (
    <main className="os-work os-methods">
      <p className="os-eyebrow">Methods</p>
      <h1>How to read what you are looking at</h1>
      <p className="os-lede">Literacy at the point of a figure, plus how Clarity extracts, refuses to pool, and marks gaps. Color never means statistical significance.</p>

      <section className="os-module">
        <h2>Five layers. Five different questions.</h2>
        <ol className="os-pipeline" style={{gridTemplateColumns: 'repeat(5, 1fr)'}}>
          {LAYERS.map(([label, text], i) => (
            <li key={label}>
              <strong>0{i + 1} {label}</strong>
              <span className="os-caption" style={{display: 'block', fontSize: 12, marginTop: 8}}>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="os-module">
        <h2>Typed objects are not interchangeable</h2>
        <ul className="os-findings">
          {KINDS.map(([label, text]) => (
            <li key={label}><strong>{label}.</strong> {text}</li>
          ))}
        </ul>
      </section>

      <section className="os-module">
        <h2>Question contracts</h2>
        <p className="os-lead">Each kind has its own Q-spine. A gene does not inherit biomarker questions. An empty module is a gap in this library, not a license to reuse another kind’s answers.</p>
        <ul className="os-findings">
          <li><strong>Biomarker.</strong> What is it? What biology? Can we measure it reliably? What does the value indicate? Does measuring it actually help?</li>
          <li><strong>Gene.</strong> What sequence object? Where is it, and what does it encode? Which variants are indexed? What gene-level findings exist? What must not be read from gene status?</li>
          <li><strong>Protein.</strong> What product? Which gene encodes it? Is protein-level evidence indexed? How is it distinct from a circulating measurement? What does this view not license?</li>
          <li><strong>Intervention.</strong> Does it help? What harm is indexed? In whom? Which layer? What is not licensed?</li>
        </ul>
      </section>

      <section className="os-module">
        <h2>What every plotted estimate must pass</h2>
        <ul className="os-findings">
          <li><strong>Source identity.</strong> A PubMed identifier or canonical URL, retained passage, and source hash.</li>
          <li><strong>Numerical integrity.</strong> Finite reported values, valid bounds, ordered intervals. Missing intervals remain missing.</li>
          <li><strong>Scientific context.</strong> Endpoint, population, exposure and comparator stay with the number. Association, prediction, diagnostic performance and intervention outcomes remain separate.</li>
          <li><strong>No pooling.</strong> Clarity does not fit a new pooled effect, reconstruct survival curves, or rank treatments. Color marks kind or evidence layer, never significance.</li>
        </ul>
      </section>

      <section className="os-module">
        <h2>Association is not utility. Detection is not benefit.</h2>
        <p className="os-lead">Two measurements moving together does not establish that changing one changes the other. A test can detect more disease without improving outcomes. False positives, unnecessary procedures, and overdiagnosis belong in the same appraisal.</p>
      </section>

      <section className="os-module">
        <h2>Where evidence comes from on a page</h2>
        <ul className="os-findings">
          <li><strong>Live graph.</strong> The engine answered this object’s graph payload.</li>
          <li><strong>Bundled snapshot.</strong> The engine did not answer in time; the last published graph payload is shown.</li>
          <li><strong>Catalog row.</strong> Coverage counts only. Typed findings are not reconstructed.</li>
          <li><strong>Derived identity.</strong> A projection of another node (for example a protein from a biomarker with UniProt). Findings are not copied across.</li>
        </ul>
      </section>

      <p className="os-note">Research and education only. Not medical advice. Investigations use a deterministic question map — not a language model.</p>
    </main>
  );
}
