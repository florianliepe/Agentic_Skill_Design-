import fs from 'node:fs/promises';
import {secretDir,host} from './n8n-client.mjs';
export async function command(command,payload={},revision,key=crypto.randomUUID()){
 const token=process.env.SBO_SESSION_TOKEN;if(token){const r=await fetch(host+'/webhook/agentic-skill-design-auth-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workspace',token,request:{contractVersion:'sbo.case.v1',command,payload,expectedVersion:revision,idempotencyKey:key,requestId:key}}),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok||!d.ok)throw new Error(`SBO ${command}: HTTP ${r.status}, ${d.error?.code||'REQUEST_FAILED'}`);return d;}
 const access=(await fs.readFile(secretDir+'/team-access','utf8')).trim();
 const r=await fetch(host+'/webhook/agentic-skill-design-v1',{method:'POST',headers:{'Content-Type':'application/json','x-n8n-webhook-secret':access},body:JSON.stringify({contractVersion:'sbo.case.v1',command,payload,expectedVersion:revision,idempotencyKey:key,requestId:key}),signal:AbortSignal.timeout(30000)});
 const d=await r.json();if(!r.ok||!d.ok)throw new Error(`SBO ${command}: HTTP ${r.status}, ${d.error?.code||'REQUEST_FAILED'}`);return d;
}
