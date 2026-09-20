import React from 'react';
import PlatformLearn from '../platform/PlatformLearn.jsx';
import PlatformMethodology from '../platform/PlatformMethodology.jsx';

export default function Methods() {
  return (
    <main className="os-work os-methods">
      <p className="os-eyebrow">Methods</p>
      <h1>How to read what you are looking at</h1>
      <p className="os-lede">Literacy at the point of a figure, plus how Clarity extracts, refuses to pool, and marks gaps. Color never means statistical significance.</p>
      <style>{`.os-methods nav[aria-label="Primary"]{display:none}.os-methods .knowledge-page{padding:0;background:transparent}`}</style>
      <PlatformLearn />
      <div id="methodology" style={{paddingTop: 24}}>
        <PlatformMethodology />
      </div>
    </main>
  );
}
