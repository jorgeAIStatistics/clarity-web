import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api.js';
import catalog from '../evidence/catalog.json';
import { compoundBrief, entityBrief, studyLayer, safeSource } from './profileModel.js';
import '../research/workspace.css';
const canonical = s => String(s).toLowerCase().replace(/\s*[—–].*$/, '').trim();
function useProfile(option) {
  const [state, setState] = useState({});
  useEffect(() => {
    if (!option) return;
    if (option.entity) {
      setState({
        id: option.id,
        model: entityBrief(option.entity)
      });
      return;
    }
    const c = new AbortController(),
      timer = setTimeout(() => {setState({id:option.id,error:true});c.abort();}, 20000);
    setState({});
    fetch(`${API_BASE}/api/profile?topic=${encodeURIComponent(option.name)}&category=${encodeURIComponent(option.category || 'supplement')}`, {
      signal: c.signal
    }).then(r => {
      if (!r.ok) throw Error();
      return r.json();
    }).then(({
      profile: p
    }) => setState({
      id: option.id,
      model: compoundBrief({
        analysis: p.analysis,
        name: p.name,
        bestTier: p.best_tier,
        tier: p.tier,
        generatedAt: p.generated_at,
        studyCount: p.study_count,
        outcomes: (p.claims || []).map(x => ({
          outcome: x.outcome,
          tier: x.tier,
          studies: x.studies || [],
          headlineEffect: x.headline_effect ? {
            ...x.headline_effect,
            ciLow: x.headline_effect.ci_low,
            ciHigh: x.headline_effect.ci_high,
            estimated: x.headline_effect.ci_estimated
          } : null
        }))
      })
    })).catch(() => {
      if (!c.signal.aborted) setState({
        id: option.id,
        error: true
      });
    }).finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [option]);
  return state.id === option?.id ? state : {};
}
export default function Comparison() {
  const [compounds, setCompounds] = useState([]),
    [a, setA] = useState('apob'),
    [b, setB] = useState('ldl-c'),
    [all, setAll] = useState(false),
    [outcome, setOutcome] = useState(''),
    [project, setProject] = useState(null);
  useEffect(() => {
    const c = new AbortController();
    fetch('/library.json', {
      signal: c.signal
    }).then(r => r.json()).then(d => setCompounds(d.entries.filter(x => x.entity_type === 'intervention'))).catch(() => {});
    return () => c.abort();
  }, []);
  const options = useMemo(() => [...catalog.entities.map(e => ({
      id: e.id,
      name: e.name,
      entity: e
    })), ...compounds], [compounds]),
    left = useProfile(options.find(x => x.id === a)),
    right = useProfile(options.find(x => x.id === b)),
    models = [left.model, right.model];
  const names = models.map(m => [...new Set((m?.outcomes || []).map(o => canonical(o.name)))]),
    common = names[0].filter(x => names[1].includes(x)),
    available = all ? [...new Set(names.flat())] : common,
    chosen = available.includes(outcome) ? outcome : available[0] || '',
    rows = models.map(m => (m?.outcomes || []).filter(o => canonical(o.name) === chosen));
  const value = (i, key) => {
    const m = models[i],
      o = rows[i];
    if (!m) return 'Loading / unavailable';
    if (key === 'Bottom line') return m.summary;
    if (key === 'Outcome') return chosen || 'No shared outcome';
    if (key === 'Certainty') return [...new Set(o.map(x => x.grade))].filter(x => x && !/appraisal|pending/i.test(x)).join(' · ') || 'Certainty not appraised; extraction status is separate';
    if (key === 'Effect magnitude') return o.some(x => x.effectQuote) ? <details><summary>{o.filter(x => x.effectQuote).length} source-specific findings; no combined magnitude</summary>{o.filter(x => x.effectQuote).map((x, j) => <div key={x.key || j}><p>{x.effect}</p><small>{x.exposure} · {x.comparator}</small><a href={safeSource(x.effectSource)} target="_blank" rel="noreferrer">Inspect original source ↗</a></div>)}</details> : 'Effect magnitude not reliably extractable';
    if (key === 'Population') return [...new Set(o.map(x => x.population))].filter(Boolean).join(' | ') || 'Not extracted';
    if (key === 'Human trials') return m.studies.filter(s => studyLayer(s) === 'interventional').length + ' classified records; not a quality score';
    if (key === 'Syntheses') return m.studies.filter(s => studyLayer(s) === 'synthesis').length + ' records; participant overlap possible';
    if (key === 'Main limitation') return m.limitations[0];
    return 'Not appraised in a comparable structured field';
  };
  return <div className="research-workspace"><p>Compare one scientific question across aligned evidence bodies. Certainty and magnitude remain separate.</p><div className="rw-fields">{[[a, setA, 'Evidence A'], [b, setB, 'Evidence B']].map(([v, set, label]) => <label key={label}>{label}<select value={v} onChange={e => set(e.target.value)}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>)}</div><section className="rw-panel">{(left.error||right.error)&&<p role="status">A selected profile could not be loaded. Choose another profile or retry later.</p>}<h2>What outcome are you comparing?</h2><label className="rw-check"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />Show all outcomes (default: common outcomes)</label><label>Outcome<select value={chosen} onChange={e => setOutcome(e.target.value)}>{!available.length && <option value="">No shared outcome identified</option>}{available.map(x => <option key={x}>{x}</option>)}</select></label>{models.every(Boolean) && !common.length && <p className="rw-notice">These profiles do not answer the same primary scientific question. Their overall grades should not be interpreted as one being better.</p>}<p>Shared outcome labels do not establish comparable exposures, populations or estimands.</p><p>Direct head-to-head status has not been appraised. Shared citations do not prove a direct comparison; this view uses separate evidence bodies.</p><label>Add my saved study<select value={project?.id || ''} onChange={e => {
          try {
            setProject(JSON.parse(localStorage.getItem('clarity-research-projects-v1') || '[]').find(x => x.id === e.target.value) || null);
          } catch {
            setProject(null);
          }
        }}><option value="">No study column</option>{(() => {
            try {
              return JSON.parse(localStorage.getItem('clarity-research-projects-v1') || '[]').map(p => <option key={p.id} value={p.id}>{p.title}</option>);
            } catch {
              return [];
            }
          })()}</select></label><div className="rw-scroll"><table className="rw-table"><thead><tr><th>Scientific dimension</th><th>{models[0]?.name || 'Evidence A'}</th><th>{models[1]?.name || 'Evidence B'}</th>{project && <th>MY STUDY · USER PROVIDED</th>}</tr></thead><tbody>{['Bottom line', 'Outcome', 'Certainty', 'Effect magnitude', 'Population', 'Human trials', 'Syntheses', 'Directness', 'Duration', 'Safety', 'Risk of bias', 'Main limitation'].map(key => <tr key={key}><th>{key}</th>{[0, 1].map(i => <td key={i}>{value(i, key)}</td>)}{project && <td>{key === 'Bottom line' ? project.text : key === 'Outcome' ? project.definition.outcome : key === 'Population' ? project.definition.population : key === 'Duration' ? project.definition.duration : key === 'Effect magnitude' ? `${project.userResult.metric}: ${project.userResult.estimate || 'Not entered'}${project.userResult.lower && project.userResult.upper ? ` (${project.userResult.confidence_level}% CI ${project.userResult.lower}–${project.userResult.upper})` : ''}` : 'Not independently appraised'}</td>}</tr>)}</tbody></table></div></section><details className="rw-panel"><summary>Audit / data coverage</summary>{models.map((m, i) => <p key={i}>{m?.name}: {m?.studies.length || 0} linked publications; {m?.outcomes.filter(o => o.effectQuote).length || 0} traceable finding rows. These counts do not measure certainty.</p>)}<p>Common outcomes use normalized labels, not a validated harmonization of estimands. Inspect population, comparator and time horizon in the original reports.</p></details><a href="/explore/matcher">Compare individual studies in the research workspace →</a></div>;
}
