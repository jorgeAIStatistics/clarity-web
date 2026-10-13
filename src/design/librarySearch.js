// Ranking for the library search box. Kept free of every app import so it can be tested directly.
const fold=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'');

// Ranked so an exact name beats an alias and an alias beats a word inside a longer name. Without
// this, typing "alk" surfaces "alkaline phosphatase" above the ALK gene.
export function searchLibrary(entries,query,limit=8){
  const q=fold(query).trim();
  if(!q||!entries)return [];
  const out=[];
  for(const e of entries){
    const name=fold(e.name),aliases=(e.aliases||[]).map(fold);
    let score=null;
    if(name===q)score=0;
    else if(aliases.includes(q))score=1;
    else if(name.startsWith(q))score=2;
    else if(aliases.some(a=>a.startsWith(q)))score=3;
    else if(new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`).test(name))score=4;
    else if(name.includes(q))score=5;
    else if(aliases.some(a=>a.includes(q)))score=6;
    if(score==null)continue;
    // Within a tier, a profile that can answer something comes before one with nothing indexed.
    const indexed=(e.coverage?.quantified_outcomes||0)>0?0:1;
    out.push({entry:e,score,indexed,name});
  }
  out.sort((a,b)=>a.score-b.score||a.indexed-b.indexed||a.name.length-b.name.length||a.name.localeCompare(b.name));
  return out.slice(0,limit).map(r=>r.entry);
}

export const TYPE_LABEL={intervention:'Compound',biomarker:'Biomarker',diagnostic:'Diagnostic',screening:'Screening',precision_oncology:'Precision medicine'};
