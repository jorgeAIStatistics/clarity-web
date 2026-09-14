import {useEffect,useState} from 'react';
import {API_BASE} from '../platform/api.js';
let snapshot;
export function loadVisualSnapshot(){return snapshot||(snapshot=fetch('/visual-evidence.json').then(r=>{if(!r.ok)throw Error('Snapshot unavailable');return r.json();}).catch(e=>{snapshot=null;throw e;}));}
export default function useVisualReport(targetId){
 const [state,setState]=useState({});
 useEffect(()=>{if(!targetId)return;let active=true,live=false;const c=new AbortController();let timer;
  loadVisualSnapshot().then(d=>{if(active&&!live)setState({id:targetId,report:d.profiles[targetId]||null});}).catch(()=>{if(active&&!live)setState({id:targetId,report:null});});
  // Current automated releases augment the immutable bundled snapshot. Failure
  // leaves that snapshot available; it never changes its source-set date.
  timer=setTimeout(()=>c.abort(),10000);
  fetch(`${API_BASE}/api/visual-evidence/${encodeURIComponent(targetId)}`,{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(active&&d.version==='visual-evidence-v1'&&d.report){live=true;setState({id:targetId,report:d.report});}}).catch(()=>{}).finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);c.abort();};
 },[targetId]);
 return state.id===targetId?state:{loading:true};
}
