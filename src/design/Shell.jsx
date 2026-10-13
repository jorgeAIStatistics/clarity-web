import React from 'react';
import CommandSearch from './CommandSearch.jsx';

// One header for the whole product. Everything that used to carry its own bar — the evidence
// explorer, the workspace, the guide pages — renders inside this one instead, so there is a single
// place that shows where you are and a single search.
export function Nav({to,go,children,...rest}){
  const onClick=e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return; // let the browser open a tab
    e.preventDefault();go(to);
  };
  return <a href={to} onClick={onClick} {...rest}>{children}</a>;
}

const SECTIONS=[
  {key:'library',label:'Library',to:'/explore'},
  {key:'compare',label:'Compare',to:'/explore/compare'},
  {key:'match',label:'Match my research',to:'/explore/matcher'},
  {key:'learn',label:'Learn',to:'/learn'},
];

export function Header({go,section,trailing}){
  return <header className="shell-header">
    <a href="#shell-main" className="shell-skip">Skip to content</a>
    <Nav to="/" go={go} className="shell-brand" aria-label="Clarity, home">
      <span className="shell-mark" aria-hidden="true"/>Clarity
    </Nav>
    <CommandSearch go={go}/>
    <nav className="shell-nav" aria-label="Sections">
      {SECTIONS.map(s=><Nav key={s.key} to={s.to} go={go} aria-current={section===s.key?'page':undefined}>{s.label}</Nav>)}
    </nav>
    {trailing}
  </header>;
}

export function Crumbs({items,go}){
  if(!items||!items.length)return null;
  return <nav className="shell-crumbs" aria-label="Breadcrumb">
    <ol>{items.map((item,i)=><li key={item.to||item.label}>
      {item.to&&i<items.length-1?<Nav to={item.to} go={go}>{item.label}</Nav>:<span aria-current="page">{item.label}</span>}
    </li>)}</ol>
  </nav>;
}

export function Footer({go}){
  return <footer className="shell-footer">
    <p>Research and education. Clarity reports what studies say; it is not medical advice and not an individual risk tool.</p>
    <nav aria-label="About Clarity">
      <Nav to="/methodology" go={go}>Methodology</Nav>
      <Nav to="/privacy" go={go}>Privacy</Nav>
      <Nav to="/terms" go={go}>Terms</Nav>
    </nav>
  </footer>;
}

export default function Shell({go,section,crumbs,children,wide=false,trailing=null}){
  return <div className="shell">
    <Header go={go} section={section} trailing={trailing}/>
    <main id="shell-main" className={wide?'shell-main shell-main--wide':'shell-main'} tabIndex={-1}>
      <Crumbs items={crumbs} go={go}/>
      {children}
    </main>
    <Footer go={go}/>
  </div>;
}
