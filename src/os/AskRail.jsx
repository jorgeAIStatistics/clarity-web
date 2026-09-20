import React from 'react';

export default function AskRail({entity, go}) {
  const name = entity?.name || 'this object';
  const actions = [
    {
      label: `Open an investigation about ${name}`,
      hint: 'Uses the existing question map. No language model.',
      run: () => go(`/investigate?evidence=${encodeURIComponent(name)}`),
    },
    {
      label: 'Show only human evidence layers',
      hint: 'Observational + interventional findings. Mechanism is not translated.',
      run: () => document.getElementById('os-human')?.scrollIntoView({block: 'start'}),
    },
    {
      label: 'Where is this library silent?',
      hint: 'Gaps, dead letters, empty utility.',
      run: () => document.getElementById('os-gaps')?.scrollIntoView({block: 'start'}),
    },
    {
      label: 'Open the 1-hop graph',
      hint: 'Edges from this payload only.',
      run: () => go(`/graph?focus=${encodeURIComponent(entity.id)}`),
    },
  ];
  return (
    <section className="os-module">
      <h2>Ask</h2>
      <p className="os-caption">Structured research actions. This release does not call a generative model. A later grounded-AI slot can fill this rail without changing the rest of the instrument.</p>
      <div className="os-ask">
        {actions.map(a => (
          <button key={a.label} type="button" onClick={a.run}>
            <strong style={{display: 'block'}}>{a.label}</strong>
            <span className="os-note">{a.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
