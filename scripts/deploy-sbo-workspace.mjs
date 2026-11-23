import fs from 'node:fs/promises';
import {api} from './n8n-client.mjs';
// Explicit deployment entry point; never invoked by Pages CI or by the frontend.
const configPath='.local/deployment.json';
let config=JSON.parse(await fs.readFile(configPath,'utf8'));
if(!config.existingTeamCredentialId||config.existingTeamCredentialId.includes('PLACEHOLDER'))throw new Error('Configure the existing DEKRA header credential reference; do not create or expose a credential implicitly.');
const seed=JSON.parse(await fs.readFile('.local/source-workspace.json','utf8'));
if(seed.skills.length!==1012||seed.roles.length!==825||seed.cases.length)throw new Error('Unexpected initial source snapshot.');
await api('/workflows?limit=1'); // Fail before mutation if access is unavailable.
const persist=()=>fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
if(!config.tableId){
  const found=await api('/data-tables?limit=100');
  if((found.data||[]).some(t=>t.name==='Skill Design Studio workspace v1'))throw new Error('An existing table with this name needs reconciliation before proceeding.');
  const table=await api('/data-tables','POST',{name:'Skill Design Studio workspace v1',columns:[{name:'workspace',type:'string'},{name:'revision',type:'number'},{name:'payload',type:'string'}]});
  config.tableId=table.id;await persist();
}
const table=await api(`/data-tables/${config.tableId}`);
if(table.name!=='Skill Design Studio workspace v1')throw new Error('Refusing a table outside this deployment.');
const rows=await api(`/data-tables/${config.tableId}/rows?limit=2`);
if(!(rows.data||[]).length){
  await api(`/data-tables/${config.tableId}/rows`,'POST',{data:[{workspace:'main',revision:seed.revision,payload:JSON.stringify(seed)}]});
  config.seeded=true;await persist();
}else if(rows.data.length!==1||rows.data[0].workspace!=='main')throw new Error('Unexpected workspace rows; no overwrite performed.');
const text=await fs.readFile('n8n/sbo-workspace-api.template.json','utf8');
const workflow=JSON.parse(text.replaceAll('SBO_WORKSPACE_TABLE_ID',config.tableId).replaceAll('EXISTING_TEAM_HEADER_CREDENTIAL_ID',config.existingTeamCredentialId));
if(config.workflowId){
  const previous=await api(`/workflows/${config.workflowId}`);
  if(previous.name!==workflow.name)throw new Error('Refusing to update an unrelated workflow.');
  await fs.writeFile('.local/workspace-workflow-before-update.json',JSON.stringify(previous,null,2));
  await api(`/workflows/${config.workflowId}`,'PUT',workflow);
}else{
  const created=await api('/workflows','POST',workflow);config.workflowId=created.id;await persist();
}
console.log({workflowId:config.workflowId,tableId:config.tableId,activation:'not performed: inspect and smoke-test the isolated deployment first'});
