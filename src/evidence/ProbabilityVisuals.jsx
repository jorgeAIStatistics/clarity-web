import React, {useId,useState} from 'react';
import './probability-visuals.css';

const percent=value=>value==null?'Not defined':`${(value*100).toFixed(1)}%`;
export function BayesianUpdate({pre,positive,negative}) {
  return <figure className="ev-bayes"><figcaption><strong>One starting probability, two possible updates</strong><p>These are probabilities of disease, conditional on the selected test result.</p></figcaption><div className="ev-bayes-grid">{[['Before the test',pre],['After a positive test',positive],['After a negative test',negative]].map(([label,value])=><div key={label}><span>{label}</span><strong>{percent(value)}</strong><div className="ev-probability-track" aria-hidden="true"><i style={{width:`${(value??0)*100}%`}}/></div></div>)}</div></figure>;
}
export function PeopleComparison({baseline,screened,falsePositive,procedures,years}) {
  const id=useId(),[selected,setSelected]=useState('mortality');
  const choices={mortality:{label:'Deaths',a:baseline,b:screened,aLabel:'Without screening',bLabel:'With screening'},falsePositive:{label:'False positives',b:falsePositive,bLabel:'With screening'},procedures:{label:'Unnecessary procedures',b:procedures,bLabel:'With screening'}};
  const current=choices[selected];
  const groups=current.a==null?[[current.bLabel,current.b]]:[[current.aLabel,current.a],[current.bLabel,current.b]];
  return <figure className="ev-person-comparison"><figcaption><strong>See the absolute counts</strong><p>One square = one person out of 1,000 over {years} years. Each panel uses the same denominator. Outcomes can overlap, so they are shown separately.</p></figcaption><label htmlFor={id}>Outcome to display<select id={id} value={selected} onChange={e=>setSelected(e.target.value)}>{Object.entries(choices).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label><div className="ev-person-panels">{groups.map(([label,count])=><div key={label}><h3>{label}</h3><p><strong>{Number(count.toFixed(2))} of 1,000</strong> · {current.label.toLowerCase()}</p><div className="ev-people" aria-hidden="true">{Array.from({length:1000},(_,i)=><i key={i} className={i<Math.round(count)?'ev-event':''}/>)}</div></div>)}</div><p className="ev-note">Squares round to whole people; the counts above retain the calculation. This is an illustrative scenario, not trial results.</p></figure>;
}
