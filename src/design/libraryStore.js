// One library read for the whole app. The header search, the library page and the home counts all
// want the same 300-odd rows; sharing one request keeps a page change from starting a second one
// against an engine that can take seconds to answer.
//
// It resolves twice on purpose. The copy built into this site is served from this origin and
// arrives in milliseconds, so it goes out first, labelled as a published copy. The live read keeps
// running behind it and replaces it when it lands. Waiting for the retries to be spent before
// painting anything is what left the index empty for five seconds on a cold engine.
import {API_BASE} from '../platform/api.js';
import {bundledCatalog,fetchWithRetry} from '../evidence/graphProfile.js';

let pending=null;
const listeners=new Set();

export function resetLibrary(){pending=null;listeners.clear();}

/** Called again with the live payload if one arrives after the bundled copy was handed out. */
export function onLibraryUpdate(fn){listeners.add(fn);return()=>listeners.delete(fn);}

export function loadLibrary(request=fetch){
  if(pending)return pending;
  const live=(async()=>{
    const once=async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await request(`${API_BASE}/api/library`,{signal:controller.signal});
        if(!response.ok)throw Object.assign(Error('request_failed'),{outcome:response.status});
        return response.json();
      }finally{clearTimeout(timer);}
    };
    const data=await fetchWithRetry(once,{sleep:ms=>new Promise(r=>setTimeout(r,ms))});
    if(!Array.isArray(data?.entries)||!data.entries.length)throw Error('empty');
    return data;
  })();

  pending=(async()=>{
    const bundled=await bundledCatalog(request).catch(()=>null);
    if(bundled){
      // Hand over the published copy now; upgrade in place if the graph answers.
      live.then(data=>{for(const fn of listeners)fn(data);}).catch(()=>{});
      return bundled;
    }
    try{return await live;}
    catch(error){
      pending=null;  // a failed read is not an empty library; the next caller may try again
      throw Object.assign(error,{unavailable:true});
    }
  })();
  return pending;
}

export {searchLibrary,TYPE_LABEL} from './librarySearch.js';
