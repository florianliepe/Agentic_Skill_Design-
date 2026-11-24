import fs from 'node:fs/promises';
import {api} from './n8n-client.mjs';
import {migrateIdentityVault} from '../n8n/sbo-auth.mjs';
const path='.local/deployment.json',config=JSON.parse(await fs.readFile(path,'utf8'));
const backupDir='.local/refinement-backup';await fs.mkdir(backupDir,{recursive:true});
const save=()=>fs.writeFile(path,JSON.stringify(config,null,2)+'\n');
async function deploy(key,workflow){
 let id=config[key];if(id){const before=await api('/workflows/'+id);if(before.name!==workflow.name)throw new Error('Refusing unrelated workflow update: '+key);await fs.writeFile(`${backupDir}/${key}.json`,JSON.stringify(before,null,2));await api('/workflows/'+id,'PUT',workflow);}else{const created=await api('/workflows','POST',workflow);id=created.id;config[key]=id;await save();}
 if(key==='workflowId'&&config.legacyRetired)await api('/workflows/'+id+'/deactivate','POST',{});else await api('/workflows/'+id+'/activate','POST',{});return id;
}
const instantiate=async(file,replacements)=>{let text=await fs.readFile(file,'utf8');for(const [a,b] of Object.entries(replacements))text=text.replaceAll(a,b);return JSON.parse(text);};
// Change only the Skill Studio API and its worker; preserve all current source and case data.
const workspace=await instantiate('n8n/sbo-workspace-api.template.json',{SBO_WORKSPACE_TABLE_ID:config.tableId,EXISTING_TEAM_HEADER_CREDENTIAL_ID:config.existingTeamCredentialId});await deploy('workflowId',workspace);
const worker=await instantiate('n8n/sbo-mapping-worker.template.json',{SBO_WORKSPACE_TABLE_ID:config.tableId,EXISTING_GATEWAY_CREDENTIAL_ID:config.gatewayCredentialId,VERIFIED_GATEWAY_MODEL:'claude-sonnet-5',SBO_WORKER_ID:config.workerId,SBO_SOURCE_CACHE_TABLE_ID:config.sourceCacheTableId});worker.settings.executionTimeout=210;await deploy('workerId',worker);
if(!config.authTableId){const table=await api('/data-tables','POST',{name:'Skill Design Studio personal access v1',columns:[{name:'workspace',type:'string'},{name:'revision',type:'number'},{name:'payload',type:'string'}]});config.authTableId=table.id;await save();}
const authTable=await api('/data-tables/'+config.authTableId);if(authTable.name!=='Skill Design Studio personal access v1')throw new Error('Unexpected authentication table');
const authRows=await api('/data-tables/'+config.authTableId+'/rows?limit=2');
if(!authRows.data.length)await api('/data-tables/'+config.authTableId+'/rows','POST',{data:[{workspace:'auth',revision:1,payload:JSON.stringify(migrateIdentityVault({members:[{email:'florian.liepe@eraneos.com',roles:['sme'],active:true}],challenges:[],sessions:[],attempts:[]}))}]});
else if(authRows.data.length!==1||authRows.data[0].workspace!=='auth')throw new Error('Unexpected sign-in rows');
else {const row=authRows.data[0],before=JSON.parse(row.payload);if(before.authVersion!==2){await fs.writeFile(backupDir+'/identity-before-password.json',row.payload);await api('/data-tables/'+config.authTableId+'/rows/update','PATCH',{filter:{type:'and',filters:[{columnName:'workspace',condition:'eq',value:'auth'},{columnName:'revision',condition:'eq',value:row.revision}]},data:{revision:row.revision+1,payload:JSON.stringify(migrateIdentityVault(before))}});const check=await api('/data-tables/'+config.authTableId+'/rows?limit=1');if(JSON.parse(check.data[0].payload).authVersion!==2)throw new Error('Identity migration conflicted');}}
// Reuse the verified sender credential, not Pandora sessions or project data.
const reference=await api('/workflows/OvGwJlAsbVMG4kQl');const sender=reference.nodes.find(n=>n.type==='n8n-nodes-base.microsoftOutlook');if(!sender?.credentials?.microsoftOutlookOAuth2Api)throw new Error('Verified mail sender reference missing');
const mail={name:'Skill Design Studio | login code delivery v1',nodes:[
 {id:'input',name:'Trusted login request',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.1,position:[0,300],parameters:{inputSource:'passthrough'}},
 {id:'validate',name:'Validate Studio mail',type:'n8n-nodes-base.code',typeVersion:2,position:[220,300],parameters:{jsCode:'const b=$input.first().json;if(b.purpose!=="skill_design_password_reset"||typeof b.to!=="string"||!/^[^\\s@,;<>]+@eraneos\\.com$/.test(b.to)||!/^\\d{8}$/.test(String(b.code)))throw new Error("Invalid Studio login recipient");return [{json:{to:b.to,subject:"Your Skill Design Studio password setup/reset code",text:"Your Skill Design Studio password setup/reset code is "+b.code+". It expires in 10 minutes and can be used once. If you did not request this code, ignore this email."}}];'}},
 {...sender,id:'send',name:'Send Studio code',position:[440,300],parameters:{...sender.parameters,toRecipients:'={{ $json.to }}',subject:'={{ $json.subject }}',bodyContent:'={{ $json.text }}'}},
 {id:'receipt',name:'Mail accepted',type:'n8n-nodes-base.code',typeVersion:2,position:[660,300],parameters:{jsCode:'return [{json:{accepted:true}}];'}}
],connections:{'Trusted login request':{main:[[{node:'Validate Studio mail',type:'main',index:0}]]},'Validate Studio mail':{main:[[{node:'Send Studio code',type:'main',index:0}]]},'Send Studio code':{main:[[{node:'Mail accepted',type:'main',index:0}]]}},settings:{executionOrder:'v1',callerPolicy:'workflowsFromSameOwner',saveDataErrorExecution:'none',saveDataSuccessExecution:'none',saveManualExecutions:false,executionTimeout:30}};
await deploy('mailWorkflowId',mail);
const internal=await instantiate('n8n/sbo-personal-workspace.template.json',{SBO_WORKSPACE_TABLE_ID:config.tableId});await deploy('personalWorkspaceId',internal);
const auth=await instantiate('n8n/sbo-personal-access.template.json',{SBO_AUTH_TABLE_ID:config.authTableId,SBO_INTERNAL_API_ID:config.personalWorkspaceId,SBO_MAIL_WORKFLOW_ID:config.mailWorkflowId,SBO_WORKER_ID:config.workerId});await deploy('personalAccessId',auth);
// Capabilities are enabled only after the corresponding worker and routes are deployed.
let enabled=false;for(let attempt=0;attempt<3&&!enabled;attempt++){
 const rows=await api('/data-tables/'+config.tableId+'/rows?limit=2');if(rows.data.length!==1)throw new Error('Unexpected workspace rows');const row=rows.data[0],w=JSON.parse(row.payload);
 if(attempt===0)await fs.writeFile(backupDir+'/workspace-before.json',JSON.stringify(w));
 w.runtimeCapabilities={...w.runtimeCapabilities,profileDraft:true,trendResearch:true,upskilling:true,support:true};w.revision++;
 const receipt=await api('/data-tables/'+config.tableId+'/rows/update','PATCH',{filter:{type:'and',filters:[{columnName:'workspace',condition:'eq',value:'main'},{columnName:'revision',condition:'eq',value:row.revision}]},data:{revision:w.revision,payload:JSON.stringify(w)}});
 const latest=await api('/data-tables/'+config.tableId+'/rows?limit=1');enabled=JSON.parse(latest.data[0].payload).runtimeCapabilities.support===true;void receipt;
}
if(!enabled)throw new Error('Capabilities update conflicted; reconcile before enabling the frontend');
console.log(JSON.stringify({workspace:config.workflowId,worker:config.workerId,personalAccess:config.personalAccessId,mailDelivery:config.mailWorkflowId,capabilities:['profile','trends','upskilling','support'],publication:'not performed'}));
