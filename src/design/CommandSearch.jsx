import React,{useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import {loadLibrary,onLibraryUpdate} from './libraryStore.js';
import {searchLibrary,TYPE_LABEL} from './librarySearch.js';

// A keystroke only belongs to the page when the page is not already taking keystrokes.
function typingSomewhere(target){
  if(!target)return false;
  const tag=(target.tagName||'').toLowerCase();
  return tag==='input'||tag==='textarea'||tag==='select'||target.isContentEditable===true;
}

export default function CommandSearch({go,placeholder='Search markers, genes, compounds, tests'}){
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [entries,setEntries]=useState(null);
  const [failed,setFailed]=useState(false);
  const input=useRef(null),box=useRef(null);
  const listId=useId();

  useEffect(()=>{
    let live=true;
    loadLibrary().then(d=>{if(live)setEntries(d.entries||[]);}).catch(()=>{if(live)setFailed(true);});
    const stop=onLibraryUpdate(d=>{if(live)setEntries(d.entries||[]);});
    return()=>{live=false;stop();};
  },[]);

  useEffect(()=>{
    const onKey=e=>{
      if(typingSomewhere(e.target))return;
      if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();input.current?.focus();}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.current?.focus();}
    };
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[]);

  useEffect(()=>{
    const away=e=>{if(box.current&&!box.current.contains(e.target))setOpen(false);};
    document.addEventListener('pointerdown',away);
    return()=>document.removeEventListener('pointerdown',away);
  },[]);

  const results=useMemo(()=>searchLibrary(entries,query),[entries,query]);
  const visible=open&&query.trim().length>0;

  const choose=useCallback(entry=>{
    setOpen(false);setQuery('');input.current?.blur();
    go(entry.path);
  },[go]);

  const onKeyDown=e=>{
    if(e.key==='Escape'){setOpen(false);return;}
    if(!visible||!results.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>(i+1)%results.length);}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i-1+results.length)%results.length);}
    else if(e.key==='Enter'){e.preventDefault();choose(results[Math.min(active,results.length-1)]);}
  };

  return <div className="cs" ref={box}>
    <div className="cs-field">
      <svg className="cs-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6"/><line x1="10.8" y1="10.8" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      <input
        ref={input} type="search" className="cs-input" value={query} placeholder={placeholder}
        role="combobox" aria-expanded={visible} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={visible&&results.length?`${listId}-${Math.min(active,results.length-1)}`:undefined}
        aria-label="Search the Clarity library"
        onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);}}
        onFocus={()=>setOpen(true)} onKeyDown={onKeyDown} autoComplete="off" spellCheck="false"/>
      <kbd className="cs-kbd" aria-hidden="true">/</kbd>
    </div>
    {visible&&<div className="cs-menu">
      <ul id={listId} role="listbox" aria-label="Search results">
        {results.map((entry,i)=><li key={entry.id} id={`${listId}-${i}`} role="option" aria-selected={i===active}
          onMouseEnter={()=>setActive(i)} onMouseDown={e=>{e.preventDefault();choose(entry);}}>
          <span className="cs-name">{entry.name}</span>
          <span className="cs-type">{TYPE_LABEL[entry.entity_type]||entry.entity_type}</span>
          <span className="cs-count c-num">{(entry.coverage?.quantified_outcomes||0)>0
            ? `${entry.coverage.quantified_outcomes} with estimates`
            : 'none indexed yet'}</span>
        </li>)}
      </ul>
      {!results.length&&<p className="cs-empty">
        {entries===null&&!failed?'Loading the library…'
          :failed?'The library could not be loaded, so search is unavailable. The engine may be restarting.'
          :<>No profile in this library matches “{query.trim()}”. That is not the same as no literature — Clarity only holds what has been indexed.</>}
      </p>}
      {results.length>0&&<p className="cs-foot">Searching {entries.length} stored profiles by name and alias.</p>}
    </div>}
  </div>;
}
