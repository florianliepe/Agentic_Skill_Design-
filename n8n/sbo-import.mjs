import {importFields,importHash,normalizeImport,materializeImport} from '../src/lib/bulk-import.mjs';
export function stageImport(w,p,now){
 const invalid=message=>({error:message});
 if(!/^[\w-]{1,70}$/.test(p.batchId||'')||!['skills','roles'].includes(p.kind)||!Array.isArray(p.headers)||!p.headers.length||p.headers.length>100||new Set(p.headers).size!==p.headers.length||p.headers.some(h=>typeof h!=='string'||!h||h.length>200)||!p.mapping||typeof p.mapping!=='object'||Object.entries(p.mapping).some(([k,v])=>!importFields[p.kind].includes(k)||typeof v!=='string'||v&&!p.headers.includes(v)))return invalid('Invalid import identity, headers or column mapping.');
 if(!Number.isInteger(p.part)||!Number.isInteger(p.total)||p.total<1||p.total>50||p.part<0||p.part>=p.total||!Array.isArray(p.rows)||!p.rows.length||p.rows.length>250||JSON.stringify(p.rows).length>180000||p.rows.some(row=>!row||Array.isArray(row)||typeof row!=='object'||Object.entries(row).some(([k,v])=>!p.headers.includes(k)||typeof v!=='string'||v.length>12000))||typeof p.fileName!=='string'||p.fileName.length>200)return invalid('Invalid import chunk. Limit each part to 250 rows and 180 KB of text.');
 w.imports=w.imports||[];let batch=w.imports.find(b=>b.id===p.batchId);
 const spec={kind:p.kind,headers:p.headers,mapping:p.mapping,total:p.total,fileName:p.fileName,defaultCategory:p.defaultCategory||''},fingerprint=importHash(spec);
 if(batch&&batch.fingerprint!==fingerprint)return invalid('The import definition changed. Start a new import batch.');
 if(batch&&batch.status==='committed')return {unchanged:true};
 if(batch&&batch.status!=='staging')return invalid('This import is no longer staged. Start a new import.');
 if(!batch){if(w.imports.filter(b=>b.status==='staging').length>=10)return invalid('Discard an unused staged import before starting another.');batch={id:p.batchId,...spec,fingerprint,status:'staging',at:now,parts:{},received:0};w.imports.push(batch);}
 const content=JSON.stringify(p.rows);if(batch.parts[p.part])return JSON.stringify(batch.parts[p.part])===content?{unchanged:true}:invalid('This part already contains different rows. Start a new batch.');
 if(Object.values(batch.parts).flat().length+p.rows.length>2000||JSON.stringify(batch.parts).length+content.length>3000000)return invalid('Split the file: maximum 2,000 rows / 3 MB of staged text per import.');
 batch.parts[p.part]=p.rows;batch.received=Object.keys(batch.parts).length;return {};
}
export function commitImport(w,p,now){
 const batch=w.imports?.find(b=>b.id===p.batchId);if(!batch)return {error:'Import batch not found.'};if(batch.status==='committed')return {unchanged:true};
 if(batch.status!=='staging'||batch.received!==batch.total)return {error:'Upload all file parts before confirming the import.'};
 const rows=Array.from({length:batch.total},(_,i)=>batch.parts[i]).flat();
 const preview=normalizeImport(batch.kind,rows,batch.mapping,w[batch.kind],batch.defaultCategory);
 if(preview.errors.length)return {error:'Import is not ready: '+preview.errors.slice(0,5).map(e=>'row '+e.row+': '+e.message).join(' ')};
 const added=materializeImport(batch.kind,preview.records,batch.id,batch.fileName);if(w[batch.kind].length+added.length>20000)return {error:'Workspace catalogue limit reached.'};
 batch.sourceHash=importHash(rows);w.sourceManifest=[...(w.sourceManifest||[]),{name:batch.fileName,sha256:batch.sourceHash,rows:rows.length,classification:'imported_draft'}];w[batch.kind].push(...added);batch.status='committed';batch.committedAt=now;batch.report={added:added.length,duplicates:preview.duplicates.length,needsAnchors:preview.warnings.length};delete batch.parts;return {};
}
