import React from 'react';
import {Dna, Microscope, Users, FlaskConical, BookOpen, ArrowUpRight, Network, Columns2} from 'lucide-react';
import {LAYERS} from './profileModel.js';
import './energy.css';
const icons=[Dna,Microscope,Users,FlaskConical,BookOpen];
const questions=['Biological plausibility','Translation to living systems','Patterns in populations','Effects of an intervention','Interpretation for a defined use'];
export function EvidenceLayers(){return <figure className="layer-diagram"><figcaption>Five lenses on the same question</figcaption><ol>{LAYERS.map(([id,name],i)=>{const Icon=icons[i];return <li key={id} data-layer={id}><Icon size={22} aria-hidden="true"/><div><strong>{name}</strong><span>{questions[i]}</span></div><small>0{i+1}</small></li>})}</ol><p>Different questions, not interchangeable grades. More records do not automatically mean stronger evidence.</p></figure>}
export function ResearchTools(){return <div className="research-tools"><a href="/explore/matcher"><Network aria-hidden="true"/><div><span>Match my research</span><strong>Find the literature behind your question</strong><p>Paste research text. Explore ranked profiles and source passages.</p></div><ArrowUpRight aria-hidden="true"/></a><a href="/explore/compare"><Columns2 aria-hidden="true"/><div><span>Compare profiles</span><strong>Keep findings and uncertainty side by side</strong><p>Compare evidence layers, outcomes, and review coverage.</p></div><ArrowUpRight aria-hidden="true"/></a></div>}
export function LibrarySkeleton(){return <div className="library-skeleton" aria-label="Loading evidence profiles" role="status"><span className="sr-only">Loading evidence profiles…</span>{Array.from({length:6},(_,i)=><div key={i} aria-hidden="true"><i/><i/><i/></div>)}</div>}
