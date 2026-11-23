import fs from 'node:fs/promises';import {api} from './n8n-client.mjs';
const config=JSON.parse(await fs.readFile(process.argv[2]||'.local/case-regression-config.json','utf8'));
const deployment=JSON.parse(await fs.readFile('.local/deployment.json','utf8'));
const logic=(await fs.readFile('n8n/sbo-logic.mjs','utf8')).replace(/^export /gm,'');
const prefix='CASE-REGRESSION-'+Date.now();
const code=logic+'\nconst config='+JSON.stringify(config)+';const prefix='+JSON.stringify(prefix)+`;
const state=$getWorkflowStaticData('global');if(state.complete)return [];
const original=JSON.parse($input.first().json.payload);let w=original,c=w.cases.find(c=>c.id===config.caseId);
if(!c||c.version!==(state.expectedVersion??config.expectedVersion))throw new Error('CASE_CHANGED_STOP_REGRESSION');
const phase=state.phase||0,keys=['mapping','trends','upskilling'];
const apply=(command,payload,suffix)=>{const out=applyCommand(w,{contractVersion:'sbo.case.v1',command,payload,idempotencyKey:prefix+'-'+suffix,expectedVersion:w.revision},undefined,{technical:true});if(!out.response.ok)throw new Error(out.response.error.code);w=JSON.parse(out.payload);c=w.cases.find(c=>c.id===config.caseId);};
if(phase===0){
 apply('sbo.contribution.submit',{caseId:c.id,actor:'Business SME statement supplied by Florian Liepe',target:'Organisational baseline',text:config.quote+' Ist-Proficiency und Vergleichbarkeit zur künftigen Nachfrage sind noch zu validieren.'},'sme-note');
 apply('sbo.profile.draft.start',{caseId:c.id},'mapping');
}else{
 const run=w.runs.find(r=>r.id===prefix+'-'+keys[phase-1]);if(!run||['queued','running'].includes(run.status))return [];
 if(run.status!=='succeeded')throw new Error('REGRESSION_AGENT_FAILED_'+(run.diagnostics?.errorCode||run.quality));
 apply('sbo.run.adopt',{runId:run.id},'adopt-'+phase);
 if(phase===1){apply('sbo.case.save',{case:{...c,researchParameters:{businessField:c.unit,region:'Global',focus:'AI-assisted consulting: business use case evaluation, solution design, output verification and responsible AI',process:'Client question to validated recommendation',technology:'Generative AI',horizon:'1 year',sourceIds:['nist-ai','oecd-ai','cedefop','dekra-digital','wef-jobs']}}},'scope');apply('sbo.trend.scan.start',{caseId:c.id},'trends');}
 if(phase===2){
  const proposed=config.requirements.map((r,i)=>({id:prefix+'-future-'+i,skillId:r.skillId,task:r.task,section:'depth',target:null,rationale:'Technischer Diskussionsentwurf für breitere KI-Anwendung im Consulting; SME-Zielanker noch festzulegen.',evidence:'SME-Dialog 23.11.2026; vorhandene Katalogdefinition '+r.skillId+'; Aufgaben sind eine vorgeschlagene Erweiterung der globalen Referenz-JRD.',critical:true,future:true,jrdChange:true,trendStatus:'emerging'}));
  const baselines=config.requirements.map(r=>({skillId:r.skillId,context:r.task,current:null,coverage:r.coverage,reason:config.quote+' Übertragung auf die neue Aufgabe und Nachfragebasis noch zu bestätigen.',assessedBy:'Qualitative SME-Aussage; technisch übertragen',assessedAt:'2026-11-23',demandConfirmed:false}));
  apply('sbo.case.save',{case:{...c,requirements:[...c.requirements,...proposed],baselines:[...c.baselines,...baselines]}},'future-requirements');apply('sbo.upskill.propose.start',{caseId:c.id},'upskilling');
 }
}
return [{json:{previousRevision:original.revision,revision:w.revision,payload:JSON.stringify(w),phase:phase+1,expectedVersion:c.version,complete:phase===3}}];`;
const nodes=[
 {id:'timer',name:'Regression recovery timer',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[0,300],parameters:{rule:{interval:[{field:'minutes',minutesInterval:1}]}}},
 {id:'gate',name:'Until completed',type:'n8n-nodes-base.code',typeVersion:2,position:[200,300],parameters:{jsCode:'return $getWorkflowStaticData("global").complete?[]:[{json:{continue:true}}];'}},
 {id:'read',name:'Read regression case',type:'n8n-nodes-base.dataTable',typeVersion:1,position:[400,300],parameters:{operation:'get',dataTableId:{__rl:true,value:deployment.tableId,mode:'id'},matchType:'allConditions',filters:{conditions:[{keyName:'workspace',condition:'eq',keyValue:'main'}]},returnAll:true}},
 {id:'prepare',name:'Prepare guarded regression step',type:'n8n-nodes-base.code',typeVersion:2,position:[600,300],parameters:{jsCode:code}},
 {id:'commit',name:'Commit unchanged regression revision',type:'n8n-nodes-base.dataTable',typeVersion:1,position:[800,300],alwaysOutputData:true,parameters:{operation:'update',dataTableId:{__rl:true,value:deployment.tableId,mode:'id'},matchType:'allConditions',filters:{conditions:[{keyName:'workspace',condition:'eq',keyValue:'main'},{keyName:'revision',condition:'eq',keyValue:'={{ $json.previousRevision }}'}]},columns:{mappingMode:'defineBelow',value:{payload:'={{ $json.payload }}',revision:'={{ $json.revision }}'},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false},options:{}}},
 {id:'receipt',name:'Record committed regression phase',type:'n8n-nodes-base.code',typeVersion:2,position:[1000,300],parameters:{jsCode:'if(!$json.payload)throw new Error("REGRESSION_CAS_CONFLICT");const p=$("Prepare guarded regression step").first().json;Object.assign($getWorkflowStaticData("global"),{phase:p.phase,expectedVersion:p.expectedVersion,complete:p.complete});return p.complete?[]:[{json:{dispatch:true}}];'}},
 {id:'dispatch',name:'Dispatch regression analysis',type:'n8n-nodes-base.executeWorkflow',typeVersion:1.2,position:[1200,300],onError:'continueRegularOutput',parameters:{source:'database',workflowId:{__rl:true,value:deployment.workerId,mode:'id'},workflowInputs:{mappingMode:'defineBelow',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false},options:{waitForSubWorkflow:false}}}
];
const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
const workflow=await api('/workflows','POST',{name:'Skill Design Studio | temporary case regression '+prefix,nodes,connections,settings:{executionOrder:'v1',saveDataErrorExecution:'none',saveDataSuccessExecution:'none',executionTimeout:30}});
await fs.writeFile('.local/case-regression.json',JSON.stringify({workflowId:workflow.id,prefix,caseId:config.caseId,startedAt:new Date().toISOString()}));
await api('/workflows/'+workflow.id+'/activate','POST',{});console.log({caseRegressionStarted:true,workflowId:workflow.id,publicEndpoints:0});
