import {sha256} from '@noble/hashes/sha256';
export const importFields={skills:['name','definition','category','family','group','anchor1','anchor2','anchor3','anchor4','externalId'],roles:['title','purpose','knowledge','problemSolving','accountability','family','group','externalId']};
export const importHash=value=>Array.from(sha256(JSON.stringify(value)),b=>b.toString(16).padStart(2,'0')).join('');
export const conceptKey=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
const aliases={externalId:['id','external id','source id','skill id','role id'],name:['name','skill','skill name','kompetenz','faehigkeit','fähigkeit','skillbezeichnung'],definition:['definition','description','beschreibung','skill description'],category:['category','kategorie','type','skill type'],family:['family','cluster','job family','skill cluster'],group:['group','gruppe','bereich'],title:['title','role','job role','job title','rollenname','rolle'],purpose:['purpose','role purpose','aufgaben','responsibilities','description','beschreibung'],knowledge:['knowledge','kenntnisse'],problemSolving:['problem solving','problemSolving','problemlösung'],accountability:['accountability','verantwortung'],anchor1:['level 1','anchor1','proficiency 1'],anchor2:['level 2','anchor2','proficiency 2'],anchor3:['level 3','anchor3','proficiency 3'],anchor4:['level 4','anchor4','proficiency 4']};
export function suggestColumns(kind,headers){return Object.fromEntries((importFields[kind]||[]).map(field=>[field,headers.find(h=>(aliases[field]||[field]).some(a=>conceptKey(a)===conceptKey(h)))||'']));}
export function normalizeImport(kind,rows,mapping,existing=[],defaultCategory=''){
 if(!['skills','roles'].includes(kind))throw new Error('Choose skills or roles.');
 const records=[],errors=[],duplicates=[],warnings=[],seen=new Map(),known=new Map(existing.map(item=>[conceptKey(item.name||item.title),item]));
 const get=(row,field)=>mapping[field]?String(row[mapping[field]]??'').trim():'';
 for(const [index,row] of rows.entries()){
  const rowNumber=index+2,record=Object.fromEntries(importFields[kind].map(f=>[f,get(row,f)]));
  const name=kind==='skills'?record.name:record.title,definition=kind==='skills'?record.definition:record.purpose;
  if(!name||!definition){errors.push({row:rowNumber,message:kind==='skills'?'Name and definition are required.':'Title and purpose are required.'});continue;}
  if(Object.values(record).some(v=>v.length>12000)||name.length>300){errors.push({row:rowNumber,message:'A field exceeds the import text limit.'});continue;}
  if(kind==='skills'){
   const categories={technical:'Technical',technisch:'Technical',functional:'Functional',funktional:'Functional',behavioural:'Behavioural',behavioral:'Behavioural',verhaltensorientiert:'Behavioural'};
   const categoryKey=conceptKey(record.category||defaultCategory),category=Object.hasOwn(categories,categoryKey)?categories[categoryKey]:undefined;if(!category){errors.push({row:rowNumber,message:'Choose Technical, Functional or Behavioural, or set a default category.'});continue;}
   record.category=category;record.anchors=[record.anchor1,record.anchor2,record.anchor3,record.anchor4];
   if(record.anchors.some(Boolean)&&!record.anchors.every(Boolean)){errors.push({row:rowNumber,message:'Provide all four own proficiency anchors, or leave all four unassessed.'});continue;}
   if(!record.anchors.some(Boolean))record.anchors=[];
   for(const key of ['anchor1','anchor2','anchor3','anchor4'])delete record[key];
  }
  const key=conceptKey(name),prior=known.get(key)||seen.get(key);
  if(prior){const priorDefinition=prior.definition||prior.purpose;const changedFields=(kind==='skills'?['category','family','group']:['knowledge','problemSolving','accountability','family','group']).some(field=>record[field]&&conceptKey(record[field])!==conceptKey(prior[field]));const changedAnchors=kind==='skills'&&record.anchors.length&&JSON.stringify(record.anchors)!==JSON.stringify(prior.anchors||[]);if(conceptKey(priorDefinition)===conceptKey(definition)&&!changedFields&&!changedAnchors){duplicates.push({row:rowNumber,message:'Existing identical concept / duplicate row; kept once.',existingId:prior.id});continue;}errors.push({row:rowNumber,message:'This name already has a different definition, taxonomy or proficiency anchor set. Resolve the ambiguity before importing.'});continue;}
  if(kind==='skills'&&!record.anchors.length)warnings.push({row:rowNumber,message:'No proficiency anchors: targets must remain unknown until reviewed.'});record.sourceRow=rowNumber;record.family=record.family||'Imported · taxonomy review';record.group=record.group||'Imported';records.push(record);seen.set(key,record);
 }
 return {records,errors,duplicates,warnings};
}
export function materializeImport(kind,records,batchId,fileName){
 return records.map((record,i)=>{const id='IMP-'+batchId+'-'+(i+1),sourceRef='Import '+fileName+' / batch '+batchId+' / row '+record.sourceRow;
  return kind==='skills'?{...record,id,status:'imported_draft',sourceRef,identityHash:importHash(record),relatedCompetencies:[],importBatchId:batchId}:{...record,id,sourceRef,sourceHash:importHash(record),version:1,status:'imported_draft',importBatchId:batchId};});
}
