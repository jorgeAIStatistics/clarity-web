// Bounded CSV/TSV parser. Values remain strings; formulas are never evaluated.
export const LIMITS={bytes:1048576,rows:500,columns:40};
export function researchInputError(text){
 if(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)||/\b(?:patient|participant|subject)[ _-]*(?:id|identifier|name)\b|\b(?:mrn|ssn|date[ _-]*of[ _-]*birth|dob|first[ _-]*name|last[ _-]*name|phone[ _-]*number|home[ _-]*address)\b/i.test(text))return 'Patient identifiers or contact fields detected. Use an aggregate research table without identifying fields.';
 if(/\b(?:my|your)\s+(?:blood|lab|test|medical|health)\s*(?:results?|values?|tests?|records?|report)?\b|\bwhat\s+(?:should|can)\s+i\s+take\b/i.test(text))return 'Personal-health interpretation is outside this tool. Use a study description or aggregate research results.';
 return '';
}
export function parseTable(input,delimiter='auto',headerRow=1){
 if(new TextEncoder().encode(input).length>LIMITS.bytes)throw Error('Choose a file smaller than 1 MB.');
 if(input.includes('\0'))throw Error('This does not look like a UTF-8 CSV or TSV file.');
 const text=input.replace(/^\uFEFF/,'');
 if(delimiter==='auto'){
  let quoted=false,commas=0,tabs=0;
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted){if(ch===',')commas++;if(ch==='\t')tabs++;if(ch==='\n'&&(commas||tabs))break;}}
  delimiter=tabs>commas?'\t':',';
 }
 if(![',','\t'].includes(delimiter))throw Error('Choose comma or tab separation.');
 let rows=[],row=[],cell='',quoted=false,closed=false;
 const field=()=>{row.push(cell.trim());cell='';closed=false;if(row.length>LIMITS.columns)throw Error('Limit the table to 40 columns.');};
 const line=()=>{field();rows.push(row);row=[];if(rows.length>LIMITS.rows+20)throw Error('Limit the table to 500 data rows and at most 20 header/preamble rows.');};
 for(let i=0;i<text.length;i++){
  const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'){if(cell.trim()||closed)throw Error('Unexpected quote: check the file’s quoting or delimiter.');cell='';quoted=true;}
  else if(ch===delimiter)field();else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;line();}
  else if(closed&&!/\s/.test(ch))throw Error('Unexpected text after a quoted field.');else cell+=ch;
 }
 if(quoted)throw Error('An opening quote has no closing quote.');
 if(cell||row.length)line();
 if(!Number.isInteger(headerRow)||headerRow<1||headerRow>20||headerRow>rows.length)throw Error('Choose a header row from 1 to 20 that exists in this file.');
 const selected=rows.slice(headerRow-1);const header=selected.shift();const data=selected.filter(r=>r.some(Boolean));
 if(!data.length)throw Error('Include a header and at least one data row.');if(data.length>LIMITS.rows)throw Error('Limit the table to 500 data rows.');
 const width=Math.max(header.length,...data.map(r=>r.length));const ragged=data.filter(r=>r.length!==header.length).length;
 const names=new Map();const headers=Array.from({length:width},(_,i)=>{const h=header[i]||`Column ${i+1}`;const n=(names.get(h)||0)+1;names.set(h,n);return n>1?`${h} (${n})`:h;});
 return {headers,rows:data.map(r=>Array.from({length:width},(_,i)=>r[i]||'')),delimiter,ragged,blankRows:selected.length-data.length};
}
export function defaultMapping(headers){return headers.map(h=>/biomarker|analyte|gene|variant|protein|compound|intervention|marker|test name/i.test(h)?'topic':/outcome|endpoint/i.test(h)?'outcome':/condition|disease|population|study|design|context/i.test(h)?'context':'ignore');}
export function mappedQuery(table,mapping){
 if(!mapping.includes('topic'))throw Error('Map at least one column to Research topic / marker.');
 const lines=[];let skipped=0;
 for(const row of table.rows){const terms=row.map((v,i)=>mapping[i]&&mapping[i]!=='ignore'&&v&&!/^[\s\d.,+−\-eE%<>=/]+$/.test(v)?`${mapping[i]}: ${v}`:'').filter(Boolean);if(!terms.length){skipped++;continue;}const line=terms.join('; ');if(!lines.includes(line))lines.push(line);}
 if(!lines.length)throw Error('No research terms found. Map marker names, outcomes or study context, not just numeric values.');
 const query=lines.join('\n');if(query.length>12000)throw Error('Mapped text exceeds 12,000 characters. Use fewer rows or columns.');
 return {query,uniqueRows:lines.length,skipped};
}
