import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {command} from './sbo-live-client.mjs';
const file='.local/refinement-live-runs.json';
if(process.argv[2]==='start'){
 let w=(await command('sbo.workspace.read')).workspace;
 const invoke=async(op,payload,key=crypto.randomUUID())=>{for(let i=0;i<4;i++){const latest=(await command('sbo.workspace.read')).workspace;try{return await command(op,payload,latest.revision,key);}catch(e){if(!String(e).includes('VERSION_CONFLICT')||i===3)throw e;}}};
 const source=w.cases.find(c=>c.requirements.length>0);if(!source)throw new Error('A previously validated technical profile is needed for the upskilling check');
 const tests=[['trends','sbo.trend.scan.start'],['upskilling','sbo.upskill.propose.start'],['support','sbo.support.ask.start']];const entries=[];
 for(const [label,operation] of tests){
  w=(await command('sbo.workspace.read')).workspace;const id='REFINEMENT-'+label+'-'+Date.now();
  const c={...source,id,version:0,title:'Technical verification · '+label,unit:'Technical integration test — not a business baseline',question:'How will AI-assisted consulting change evidence verification, requirements analysis and responsible client delivery?',owner:'Technical verification',targetDate:'2027-11-23',requirements:label==='upskilling'?source.requirements:[],baselines:[],signals:[],measures:[],contributions:[],decisions:[],individualAssessments:[],roleId:label==='trends'?'':source.roleId,relevance:'high',researchParameters:{businessField:'Management consulting',region:'Global',focus:'AI-assisted consulting and responsible evidence verification',process:'Client request to validated recommendation',technology:'Artificial intelligence',horizon:'1 year',sourceIds:['nist-ai','oecd-ai','cedefop','dekra-digital','wef-jobs']}};
  await invoke('sbo.case.save',{case:c});const runId=crypto.randomUUID();
  await invoke(operation,{caseId:id,question:'Explain the next best step for this case and suggest a role profile analysis. Do not change or approve anything.',section:'Role profiles'},runId);entries.push({label,caseId:id,runId});
  await fs.writeFile(file,JSON.stringify({startedAt:new Date().toISOString(),entries},null,2));
 }
 await fs.writeFile(file,JSON.stringify({startedAt:new Date().toISOString(),entries},null,2));console.log({queued:entries.map(x=>x.label)});
}else{
 const state=JSON.parse(await fs.readFile(file,'utf8')),w=(await command('sbo.workspace.read')).workspace;
 const runs=state.entries.map(t=>{const r=w.runs.find(r=>r.id===t.runId);return {...t,status:r?.status,quality:r?.quality,stage:r?.stage,requirements:r?.result?.requirements?.length||0,signals:r?.result?.signals?.length||0,measures:r?.result?.measures?.length||0,answer:!!r?.result?.answer,error:r?.error};});
 console.log(JSON.stringify(runs,null,2));
 if(runs.every(r=>r.status==='succeeded')){for(const r of runs)assert.equal(r.error,undefined);await fs.writeFile('.local/refinement-live-report.json',JSON.stringify({at:new Date().toISOString(),runs},null,2));}
}
