import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {host,secretDir} from './n8n-client.mjs';
const secret=(await fs.readFile(secretDir+'/team-access','utf8')).trim();
export async function command(command,payload={},revision,key=crypto.randomUUID(),access=secret){
 const request={contractVersion:'sbo.case.v1',command,payload,expectedVersion:revision,idempotencyKey:key,requestId:key};
 const r=await fetch(host+'/webhook/agentic-skill-design-v1',{method:'POST',headers:{'Content-Type':'application/json','x-n8n-webhook-secret':access,Origin:'https://florianliepe.github.io'},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={};}
 return {status:r.status,data,cors:r.headers.get('access-control-allow-origin')};
}
const unauthorized=await command('sbo.workspace.read',{},undefined,undefined,'invalid-test-access');assert.ok([401,403].includes(unauthorized.status));assert.equal(unauthorized.data.workspace,undefined);
const preflight=await fetch(host+'/webhook/agentic-skill-design-v1',{method:'OPTIONS',headers:{Origin:'https://florianliepe.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-n8n-webhook-secret'}});
assert.ok([200,204].includes(preflight.status));assert.equal(preflight.headers.get('access-control-allow-origin'),'https://florianliepe.github.io');
const read=await command('sbo.workspace.read');assert.equal(read.status,200);let w=read.data.workspace;assert.equal(w.skills.length,1012);assert.equal(w.roles.length,825);
const role=w.roles.find(r=>/business analyst/i.test(r.title))||w.roles.find(r=>r.purpose.length>150&&r.purpose.length<500)||w.roles[0];
const caseId='LIVE-VERIFY-'+Date.now();const c={id:caseId,version:0,title:'Live verification · '+role.title,unit:'Technical verification — not a business baseline',question:'Draft only evidence-backed requirements from this source JRD. This is an integration test for SME inspection.',owner:'Technical verification',targetDate:'2027-06-30',trigger:'On-demand review',roleId:role.id,relevance:'unknown',status:'draft',requirements:[],baselines:[],signals:[],measures:[],contributions:[],decisions:[],updatedAt:new Date().toISOString()};
const key=crypto.randomUUID();const saved=await command('sbo.case.save',{case:c},w.revision,key);assert.equal(saved.status,200);assert.ok(saved.data.ok);const afterSave=saved.data.workspace;
const replay=await command('sbo.case.save',{case:c},w.revision,key);assert.equal(replay.status,200);assert.equal(replay.data.workspace.cases.find(x=>x.id===caseId).version,afterSave.cases.find(x=>x.id===caseId).version);assert.equal(replay.data.workspace.audit.filter(x=>x.id===key).length,1);
const latest=(await command('sbo.workspace.read')).data.workspace;
const current=latest.cases.find(x=>x.id===caseId);const writes=await Promise.all(['A','B'].map(label=>command('sbo.case.save',{case:{...current,title:current.title+' — CAS '+label}},latest.revision)));
assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
const forbidden=await command('sbo.business.decide',{caseId},writes.find(r=>r.status===200).data.workspace.revision);assert.equal(forbidden.status,403);
w=(await command('sbo.workspace.read')).data.workspace;
const report={at:new Date().toISOString(),caseId,roleId:role.id,checks:{unauthorized:unauthorized.status,preflight:preflight.status,cors:read.cors,protectedSourceCounts:[w.skills.length,w.roles.length],idempotentReplay:'passed',concurrentSaves:writes.map(r=>r.status),sharedAccessApprovalDenied:forbidden.status},revision:w.revision};
await fs.writeFile('.local/live-smoke-report.json',JSON.stringify(report,null,2));console.log(report);
