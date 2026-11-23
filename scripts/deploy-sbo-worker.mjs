import fs from 'node:fs/promises';
import {api} from './n8n-client.mjs';
const p='.local/deployment.json';const c=JSON.parse(await fs.readFile(p));
if(!c.tableId||!c.gatewayCredentialId)throw new Error('Workspace and existing gateway credential required.');
const template=await fs.readFile('n8n/sbo-mapping-worker.template.json','utf8');
const w=JSON.parse(template.replaceAll('SBO_WORKSPACE_TABLE_ID',c.tableId).replaceAll('EXISTING_GATEWAY_CREDENTIAL_ID',c.gatewayCredentialId).replaceAll('VERIFIED_GATEWAY_MODEL','claude-sonnet-5').replaceAll('SBO_WORKER_ID',c.workerId||'SBO_WORKER_ID').replaceAll('SBO_SOURCE_CACHE_TABLE_ID',c.sourceCacheTableId||'SBO_SOURCE_CACHE_TABLE_ID'));
if(c.workerId){const old=await api('/workflows/'+c.workerId);if(old.name!==w.name)throw new Error('Unrelated workflow refused');await api('/workflows/'+c.workerId,'PUT',w);}else{const result=await api('/workflows','POST',w);c.workerId=result.id;await fs.writeFile(p,JSON.stringify(c,null,2));}
await api('/workflows/'+c.workerId+'/activate','POST',{});
const rows=await api('/data-tables/'+c.tableId+'/rows?limit=2');if(rows.data.length!==1)throw new Error('Expected exactly one workspace row');
const row=rows.data[0],data=JSON.parse(row.payload);data.runtimeCapabilities={...data.runtimeCapabilities,profileDraft:true};data.revision++;
await api('/data-tables/'+c.tableId+'/rows/update','PATCH',{filter:{type:'and',filters:[{columnName:'workspace',condition:'eq',value:'main'},{columnName:'revision',condition:'eq',value:row.revision}]},data:{revision:data.revision,payload:JSON.stringify(data)}});
console.log({workerId:c.workerId,active:true,profileDraft:'enabled for live acceptance; public login remains disabled until acceptance passes'});
