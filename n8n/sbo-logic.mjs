import {importHash} from '../src/lib/bulk-import.mjs';
import {stageImport,commitImport} from './sbo-import.mjs';
import {validClassification} from '../src/lib/ai-domain.mjs';
import {validScenario,evolutionEvidence} from '../src/lib/profile-evolution.mjs';
import {applyEvolutionDraft} from './sbo-evolution-commands.mjs';
// Pure command handler. The n8n wrapper atomically CAS-commits the returned payload.
export function applyCommand(original, request, now = new Date().toISOString(), verifiedContext = null) {
  const error=(code,message,status=422)=>({write:false,status,response:{ok:false,error:{code,message}}});
  if(!request||typeof request!=='object'||Array.isArray(request)||JSON.stringify(request).length>500000)return error('VALIDATION_ERROR','Invalid request or request too large.');
  if(request.contractVersion!=='sbo.case.v1')return error('VALIDATION_ERROR','Unsupported contract version.');
  const readCommands=['sbo.workspace.read','sbo.workspace.status','sbo.run.status','sbo.run.result','sbo.tna.export'];
  const op=request.command,p=request.payload||{};
  let w=original;
  const publicRun=r=>{const {inputCase,inputSources,inputImport,inputEvolution,...safe}=r;void inputCase;void inputSources;void inputImport;void inputEvolution;return safe;};
  const publicWorkspace=()=>{const {history,receipts,...safe}=w;void history;void receipts;const data={...safe,runs:w.runs.map(publicRun),audit:w.audit.slice(-100),imports:(w.imports||[]).map(b=>{const {parts,...summary}=b;void parts;return summary;})};if((request.responseMode==="compact"||op==="sbo.workspace.status")&&op!=='sbo.import.commit'){delete data.skills;delete data.roles;}return data;};
  const result=()=>({ok:true,workspace:publicWorkspace(),revision:w.revision});
  if(op==='sbo.workspace.read'||op==='sbo.workspace.status')return {write:false,status:200,response:result()};
  if(op==='sbo.run.status'||op==='sbo.run.result'){
    const run=w.runs.find(r=>r.id===p.runId);if(!run)return error('NOT_FOUND','Run not found.',404);
    return {write:false,status:200,response:{ok:true,run:publicRun(run)}};
  }
  if(op==='sbo.tna.export'){
    const c=w.cases.find(c=>c.id===p.caseId);if(!c||c.version!==p.caseVersion)return error('VERSION_CONFLICT','Refresh the selected case before export.',409);
    return {write:false,status:200,response:{ok:true,export:{case:c,sourceManifest:w.sourceManifest,ruleVersion:'sbo-rules-1.0.0',workspaceRevision:w.revision}}};
  }
  w=JSON.parse(JSON.stringify(original));
  if(!readCommands.includes(op)&&(!/^[\w-]{1,100}$/.test(request.idempotencyKey||'')))return error('VALIDATION_ERROR','A stable operation identifier is required.');
  const fingerprint=JSON.stringify({command:op,payload:p,expectedVersion:request.expectedVersion});
  const prior=(w.receipts||[]).find(r=>r.key===request.idempotencyKey);
  if(prior)return prior.fingerprint===fingerprint?{write:false,status:200,response:{...result(),receipt:prior}}:error('IDEMPOTENCY_CONFLICT','This operation identifier was used with different content.',409);
  if(request.expectedVersion!==w.revision)return error('VERSION_CONFLICT','The workspace changed. Your draft is preserved. Refresh and compare before saving.',409);
  if(op==='sbo.coe.decide'||op==='sbo.release.publish'||op==='sbo.business.decide')return error('FORBIDDEN','Named, verified roles are not connected. Real approvals and publication are unavailable in this pilot.',403);
  const required=(value)=>typeof value==='string'&&value.trim().length>0&&value.length<=12000;
  const failCase=(c)=>{
    if(!c||!required(c.title)||!required(c.unit)||!required(c.owner)||!required(c.question)||!/^\d{4}-\d{2}-\d{2}$/.test(c.targetDate))return 'Complete title, department, owner, question and target date.';
    if(c.roleId&&!w.roles.some(r=>r.id===c.roleId))return 'Select an existing global role.';
    if(!['high','medium','low','unknown'].includes(c.relevance))return 'Invalid business relevance.';
    if(!Array.isArray(c.requirements)||c.requirements.length>200)return 'Invalid requirement collection.';
    if(['baselines','signals','measures','contributions'].some(k=>!Array.isArray(c[k])||c[k].length>500))return 'Invalid case collections.';
    if([...c.requirements,...c.baselines,...c.signals,...c.measures].some(x=>!x||typeof x!=='object'))return 'Invalid case item.';
    if(c.signals.some(s=>!Array.isArray(s.skillIds)))return 'Signal skill links must be an array.';
    for(const s of c.signals){for(const k of ['relevanceScore','impactScore','urgencyScore','confidenceScore'])if(s[k]!==undefined&&s[k]!==null&&(!Number.isInteger(s[k])||s[k]<1||s[k]>5))return 'Radar scores use 1–5 or Unknown.';if(s.scopeImpacts&&(!Array.isArray(s.scopeImpacts)||s.scopeImpacts.length>12||s.scopeImpacts.some(x=>!x||!['role','business'].includes(x.kind)||typeof x.id!=='string'||x.id.length>200||x.kind==='role'&&!w.roles.some(r=>r.id===x.id)||typeof x.reason!=='string'||x.reason.length>12000||[x.relevance,x.impact].some(v=>v!==null&&(!Number.isInteger(v)||v<1||v>5)))))return 'Invalid role or business-area impact estimate.';}
    if(c.individualAssessments!==undefined&&(!Array.isArray(c.individualAssessments)||c.individualAssessments.length>500))return 'Invalid individual assessment collection.';
    for(const a of c.individualAssessments||[]){if(!a||!required(a.personRef)||!required(a.task)||!required(a.reason)||!required(a.assessedBy)||!['self','reviewer'].includes(a.kind)||a.status!=='draft'||!w.skills.some(s=>s.id===a.skillId)||a.current!==null&&(!Number.isInteger(a.current)||a.current<1||a.current>4))return 'Individual assessment requires a subject reference, context, assessor, own anchor and evidence.';}
    if(new Set(c.requirements.map(r=>r.id)).size!==c.requirements.length)return 'Duplicate requirement identifiers.';
    for(const r of c.requirements){
      const skill=w.skills.find(s=>s.id===r.skillId);
      if(!skill||!['core','depth'].includes(r.section)||!required(r.task)||!required(r.rationale)||!required(r.evidence))return 'Every requirement needs a canonical skill, task, rationale and evidence.';
      if(r.target!==null&&(!Number.isInteger(r.target)||r.target<1||r.target>4||!skill.anchors[r.target-1]))return 'Choose an existing skill-specific anchor or Unknown.';
    }
    for(const b of c.baselines||[]){if(!w.skills.some(s=>s.id===b.skillId)||!['sufficient','partial','insufficient','unknown'].includes(b.coverage)||!required(b.reason)||!required(b.context)||!required(b.assessedBy))return 'Baseline requires skill, context, coverage, assessor and a reason.';if(b.current!==null&&(!Number.isInteger(b.current)||b.current<1||b.current>4))return 'Invalid current anchor.';}
    for(const s of c.signals||[]){if(!required(s.title)||!required(s.taskChange)||!required(s.humanResponsibility)||!['1 year','2 years','3–5 years'].includes(s.horizon)||s.skillIds.some(id=>!w.skills.some(k=>k.id===id)))return 'Signal requires a task change, human responsibility, horizon and valid skill links.';if(s.sourceUrl&&!/^https:\/\/[^\s]+$/.test(s.sourceUrl))return 'Sources must use HTTPS.';}
    for(const m of c.measures||[]){if(!w.skills.some(s=>s.id===m.skillId)||![m.format,m.objective,m.owner,m.successCriterion,m.prerequisites].every(required)||m.availabilityStatus!=='not_checked')return 'Measures need a skill, objective, format, owner, prerequisites and success criterion. Availability stays unchecked.';}
    return '';
  };
  let caseId=p.caseId||p.case?.id||'', version=0;
  if(['sbo.import.stage','sbo.import.commit','sbo.import.discard','sbo.case.archive_many','sbo.case.archive','sbo.case.restore','sbo.role.archive','sbo.role.restore','sbo.import.mapping.start'].includes(op)&&verifiedContext?.platformRole!=='Owner'&&!verifiedContext?.technical)return error('FORBIDDEN','Only the workspace Owner can import or archive records.',403);
  if(op==='sbo.skill.classify'){
    if(verifiedContext?.platformRole!=='Owner'&&!verifiedContext?.technical)return error('FORBIDDEN','Only the Owner can maintain reviewed topic classifications.',403);
    const skill=w.skills.find(s=>s.id===p.skillId);if(!validClassification(skill,p.classification))return error('VALIDATION_ERROR','Select an AI scope and explain its boundary. Contextual AI and secondary categories need an explicit rationale.');
    const x=p.classification;w.skillClassifications={...(w.skillClassifications||{}),[skill.id]:{aiScope:x.aiScope,secondaryCategory:x.secondaryCategory||'',applicationContext:x.aiScope==='contextual'?x.applicationContext:'',reason:x.reason,updatedAt:now,updatedBy:verifiedContext?.email||'Technical verification'}};
  }else if(op==='sbo.profile.evolution.apply'){
    const applied=applyEvolutionDraft(w,p,now);if(applied.error)return error('EVOLUTION_CONFLICT',applied.error,409);caseId=applied.caseId;version=applied.version;
  }else if(op==='sbo.import.stage'||op==='sbo.import.commit'){
    const outcome=op==='sbo.import.stage'?stageImport(w,p,now):commitImport(w,p,now);if(outcome.error)return error('IMPORT_VALIDATION',outcome.error);if(outcome.unchanged)return {write:false,status:200,response:result()};
  }else if(op==='sbo.import.discard'){
    const batch=w.imports?.find(b=>b.id===p.batchId);if(!batch||batch.status!=='staging')return error('IMPORT_VALIDATION','Only a staged import can be discarded.');delete batch.parts;batch.status='discarded';
  }else if(op==='sbo.case.archive_many'){
    if(!Array.isArray(p.caseIds)||!p.caseIds.length||p.caseIds.length>100||p.caseIds.some(id=>!w.cases.some(c=>c.id===id)))return error('VALIDATION_ERROR','Choose up to 100 existing cases.');
    if(w.runs.some(r=>p.caseIds.includes(r.caseId)&&['queued','running'].includes(r.status)))return error('CASE_BUSY','A selected case still has an active analysis.',409);
    for(const c of w.cases.filter(c=>p.caseIds.includes(c.id)&&!c.archivedAt)){w.history=[...(w.history||[]),{caseId:c.id,version:c.version,snapshot:JSON.parse(JSON.stringify(c))}];c.archivedAt=now;c.version++;c.updatedAt=now;}
  }else if(op==='sbo.case.archive'||op==='sbo.case.restore'){

    const c=w.cases.find(c=>c.id===p.caseId);if(!c)return error('NOT_FOUND','Case not found.',404);if(w.runs.some(r=>r.caseId===c.id&&['queued','running'].includes(r.status)))return error('CASE_BUSY','Stop or complete this case’s analysis before archiving.',409);
    const archived=op.endsWith('.archive');if(Boolean(c.archivedAt)===archived)return {write:false,status:200,response:result()};
    w.history=[...(w.history||[]),{caseId:c.id,version:c.version,snapshot:JSON.parse(JSON.stringify(c))}];if(archived)c.archivedAt=now;else delete c.archivedAt;c.version++;c.updatedAt=now;caseId=c.id;version=c.version;
  }else if(op==='sbo.role.archive'||op==='sbo.role.restore'){
    const role=w.roles.find(r=>r.id===p.roleId);if(!role?.importBatchId)return error('SOURCE_IMMUTABLE','Global source roles remain in the library. Only imported roles can be archived.');
    w.archivedRoleIds=[...new Set(w.archivedRoleIds||[])];if(op.endsWith('.archive')){if(!w.archivedRoleIds.includes(role.id))w.archivedRoleIds.push(role.id);}else w.archivedRoleIds=w.archivedRoleIds.filter(id=>id!==role.id);
  }else if(op==='sbo.import.mapping.start'){
    if(!w.runtimeCapabilities?.importMapping)return error('INTEGRATION_NOT_READY','Import mapping is not connected.',503);
    if(!['skills','roles'].includes(p.kind)||!Array.isArray(p.headers)||p.headers.length>100||p.headers.some(h=>!required(h)||h.length>200)||!Array.isArray(p.samples)||p.samples.length>5||JSON.stringify(p.samples).length>25000)return error('VALIDATION_ERROR','Supply up to five sample rows and valid headers.');
    if(w.runs.some(r=>r.operation===op&&['queued','running'].includes(r.status)))return error('ANALYSIS_BUSY','Wait for the current import mapping.',409);
    w.runs.push({id:request.idempotencyKey,caseId:'workspace-import',operation:op,status:'queued',quality:'pending',stage:'Queued for import column mapping',inputVersion:0,inputCase:{id:'workspace-import',version:0,title:'Import column mapping',unit:'Workspace',owner:verifiedContext?.email||'Owner',question:'Map source columns to the selected import schema.',requirements:[],baselines:[],roleId:''},inputImport:{kind:p.kind,headers:p.headers,samples:p.samples},importSignature:importHash({kind:p.kind,headers:p.headers,samples:p.samples}),startedAt:now,updatedAt:now});
  }else if(op==='sbo.case.save'){
    const incoming=p.case;const problem=failCase(incoming);if(problem)return error('VALIDATION_ERROR',problem);
    if(!/^[\w-]{1,100}$/.test(incoming.id))return error('VALIDATION_ERROR','Invalid case identifier.');
    const existing=w.cases.find(c=>c.id===incoming.id);if(existing?.archivedAt)return error('CASE_ARCHIVED','Restore this case before editing.');
    if(JSON.stringify(incoming.individualAssessments||[])!==JSON.stringify(existing?.individualAssessments||[]))return error('IDENTITY_REQUIRED','Individual assessments require verified subject-level access. They are not stored through shared team access.',403);
    if(existing&&incoming.version!==existing.version)return error('VERSION_CONFLICT','The case version changed.',409);
    if(!existing&&incoming.version!==0)return error('VERSION_CONFLICT','New cases start at version zero.',409);
    if(incoming.researchParameters){const rp=incoming.researchParameters;if(!['All horizons','1 year','2 years','3–5 years'].includes(rp.horizon)||rp.expandSources!==undefined&&typeof rp.expandSources!=='boolean')return error('VALIDATION_ERROR','Choose a supported horizon and source expansion mode.');if(rp.roleIds&&(!Array.isArray(rp.roleIds)||rp.roleIds.length>6||rp.roleIds.some(id=>!w.roles.some(r=>r.id===id))))return error('VALIDATION_ERROR','Choose up to six existing target roles.');if(rp.businessAreas&&(!Array.isArray(rp.businessAreas)||rp.businessAreas.length>6||rp.businessAreas.some(x=>typeof x!=='string'||!x.trim()||x.length>200)))return error('VALIDATION_ERROR','Choose up to six business areas.');if(!['businessField','region','focus','process','technology','horizon'].every(k=>typeof rp[k]==='string'&&rp[k].length<12000)||!Array.isArray(rp.sourceIds)||rp.sourceIds.length>8||rp.sourceIds.some(id=>!['nist-ai','oecd-ai','cedefop','dekra-digital','wef-jobs','wef-skills','cedefop-forecast','eu-digcomp'].includes(id)))return error('VALIDATION_ERROR','Invalid research parameters or source selection.');}
    const next=Object.fromEntries(['id','title','unit','question','owner','targetDate','trigger','roleId','relevance','requirements','baselines','signals','measures','researchParameters'].map(key=>[key,incoming[key]]));
    next.evolution=existing?.evolution;
    Object.assign(next,{version:(existing?.version||0)+1,updatedAt:now,status:'draft',decisions:[],contributions:existing?.contributions||[]});
    next.individualAssessments=existing?.individualAssessments||[];
    w.history=[...(w.history||[]),...(existing?[{caseId:existing.id,version:existing.version,snapshot:existing}]:[])];
    w.cases=existing?w.cases.map(c=>c.id===next.id?next:c):[...w.cases,next];version=next.version;
  } else if(op==='sbo.contribution.submit'){
    const c=w.cases.find(c=>c.id===p.caseId);if(!c)return error('NOT_FOUND','Case not found.',404);
    if(!required(p.actor)||!required(p.text)||!required(p.target))return error('VALIDATION_ERROR','Contribution needs attribution, target and text.');
    c.contributions.push({id:request.idempotencyKey,actor:p.actor,target:p.target,text:p.text,baseVersion:c.version,at:now,resolution:'open'});c.version++;c.status='draft';c.decisions=[];c.updatedAt=now;version=c.version;
  } else if(op==='sbo.contribution.resolve'){
    const c=w.cases.find(c=>c.id===p.caseId),item=c?.contributions.find(i=>i.id===p.id);if(!item)return error('NOT_FOUND','Contribution not found.',404);
    if(!['accepted','parked'].includes(p.resolution)||!required(p.reason))return error('VALIDATION_ERROR','Record a resolution and reason.');
    item.resolution=p.resolution;item.resolutionReason=p.reason;c.version++;c.updatedAt=now;c.decisions=[];c.status='draft';version=c.version;
  } else if(op==='sbo.change.submit'){
    const c=w.cases.find(c=>c.id===p.caseId);if(!c)return error('NOT_FOUND','Case not found.',404);
    if(!c.requirements.length||c.contributions.some(x=>x.resolution==='open'))return error('VALIDATION_ERROR','Add requirements and resolve open contributions before submitting.');
    c.status='in_business_review';c.version++;c.updatedAt=now;version=c.version;
  } else if(op==='sbo.review.trigger'){
    if(!required(p.eventId)||!required(p.caseId))return error('VALIDATION_ERROR','Review event and case required.');
    const c=w.cases.find(c=>c.id===p.caseId);if(!c)return error('NOT_FOUND','Case not found.',404);
    w.reviewEvents=w.reviewEvents||[];if(!w.reviewEvents.some(e=>e.eventId===p.eventId)){w.reviewEvents.push({eventId:p.eventId,caseId:p.caseId,reason:p.reason,at:now});c.status='review_due';c.version++;c.updatedAt=now;}version=c.version;
  } else if(op==='sbo.catalogue.propose'){
    const proposal=p.proposal;if(!proposal||!['create','update','archive'].includes(proposal.action)||![proposal.name,proposal.definition,proposal.category,proposal.family,proposal.reason].every(required))return error('VALIDATION_ERROR','Catalogue proposals need a definition, category, cluster and evidence-based reason.');
    if(proposal.action!=='create'&&!w.skills.some(s=>s.id===proposal.skillId))return error('NOT_FOUND','Original catalogue concept not found.',404);
    w.catalogueProposals=w.catalogueProposals||[];if(w.catalogueProposals.length>=300)return error('LIMIT','Review existing catalogue proposals before creating more.');
    w.catalogueProposals.push({id:request.idempotencyKey,action:proposal.action,skillId:proposal.action==='create'?undefined:proposal.skillId,name:proposal.name,definition:proposal.definition,category:proposal.category,family:proposal.family,reason:proposal.reason,status:'draft',at:now});
  } else if(['sbo.profile.draft.start','sbo.trend.scan.start','sbo.upskill.propose.start','sbo.support.ask.start','sbo.profile.evolve.start'].includes(op)){
    const capability=({'sbo.profile.draft.start':'profileDraft','sbo.trend.scan.start':'trendResearch','sbo.upskill.propose.start':'upskilling','sbo.support.ask.start':'support','sbo.profile.evolve.start':'profileEvolution'})[op];
    if(!w.runtimeCapabilities?.[capability])return error('INTEGRATION_NOT_READY','This agent is not connected yet. Manual evidence-based editing is available.',503);
    const c=w.cases.find(c=>c.id===p.caseId)||(op==='sbo.support.ask.start'?{id:'workspace-support',version:0,title:'Workspace support',unit:'Workspace',question:'Explain the platform and its current capabilities.',owner:'Support requester',targetDate:'',roleId:'',requirements:[],baselines:[],signals:[],measures:[],contributions:[]}:null);if(!c)return error('NOT_FOUND','Save the case before starting an analysis.',404);
    if(c.archivedAt)return error('CASE_ARCHIVED','Restore this case before analysing.');
    if(['sbo.profile.draft.start','sbo.profile.evolve.start'].includes(op)&&(w.archivedRoleIds||[]).includes(c.roleId))return error('ROLE_ARCHIVED','Restore the imported source role before mapping.');
    if(op==='sbo.profile.draft.start'&&!c.roleId)return error('VALIDATION_ERROR','Select a global role for profile drafting.');
    if(op==='sbo.upskill.propose.start'&&!c.requirements.length)return error('VALIDATION_ERROR','Create role requirements before requesting development formats.');
    if(op==='sbo.support.ask.start'&&!required(p.question))return error('VALIDATION_ERROR','Enter a support question.');
    if(op==='sbo.trend.scan.start'&&c.researchParameters?.sourceIds?.length===0)return error('VALIDATION_ERROR','Select at least one curated source.');
    if(w.runs.some(r=>r.caseId===c.id&&['queued','running'].includes(r.status)&&((r.operation==='sbo.support.ask.start')===(op==='sbo.support.ask.start'))))return error('RUN_ACTIVE','An analysis is already active for this case.',409);
    let evolutionInput;if(op==='sbo.profile.evolve.start'){if(!validScenario(p.scenario)||!c.roleId||!w.roles.some(r=>r.id===c.roleId)||!c.requirements.length||c.requirements.length>20)return error('VALIDATION_ERROR','A mapped JRD with 1–20 requirements and a valid scenario is required.');const evidence=evolutionEvidence(w,c);if(evidence.signals.length<5)return error('EVIDENCE_REQUIRED','Complete and review an emerging-skill scan with at least five evidenced findings first.');evolutionInput={signals:evidence.signals,researchRunId:evidence.runId};}
    const run={id:request.idempotencyKey,caseId:c.id,operation:op,...(evolutionInput?{scenario:p.scenario,inputEvolution:evolutionInput}:{} ),status:'queued',quality:'pending',stage:'Queued for analysis',inputVersion:c.version,startedAt:now,updatedAt:now,inputCase:JSON.parse(JSON.stringify(c)),retryOfRunId:p.retryOfRunId,...(op==='sbo.support.ask.start'?{question:p.question.slice(0,4000),section:typeof p.section==='string'?p.section.slice(0,80):'Overview'}:{})};w.runs.push(run);
  } else if(op==='sbo.run.interrupt'){
    const run=w.runs.find(r=>r.id===p.runId);if(!run)return error('NOT_FOUND','Run not found.',404);
    if(['queued','running'].includes(run.status)){run.status='interrupted';run.quality='interrupted';run.updatedAt=now;run.stage='Stopped before result adoption';}
  } else if(op==='sbo.run.adopt'){
    const run=w.runs.find(r=>r.id===p.runId),c=w.cases.find(c=>c.id===run?.caseId);if(!run||!c||run.status!=='succeeded')return error('RESULT_NOT_READY','No valid result is available.',409);
    if(c.version!==run.inputVersion)return error('VERSION_CONFLICT','This result used an earlier case version. Compare it or start a new analysis.',409);
    if(run.adopted)return error('VALIDATION_ERROR','This result is already adopted.');
    if(run.operation==='sbo.profile.evolve.start')return error('VALIDATION_ERROR','Review scenario overrides in Role evolution and apply the separate future draft there.');
    if(run.operation==='sbo.support.ask.start')return error('VALIDATION_ERROR','Support responses do not automatically change a case. Confirm a suggested action or edit the working draft.');
    c.requirements=[...c.requirements,...(run.result?.requirements||[]).filter(r=>!c.requirements.some(x=>x.skillId===r.skillId&&x.task===r.task))];c.signals=[...c.signals,...(run.result?.signals||[])];c.measures=[...c.measures,...(run.result?.measures||[])];const problem=failCase(c);if(problem)return error('INVALID_MODEL_OUTPUT',problem);
    c.version++;c.updatedAt=now;c.status='draft';c.decisions=[];run.adopted=true;caseId=c.id;version=c.version;
  }else return error('VALIDATION_ERROR','Unsupported operation.');
  if(w.cases.filter(c=>!c.archivedAt).length>200||w.cases.length>2000)return error('LIMIT','Maximum 200 active cases and 2,000 retained cases. Archive active test cases before adding more.');
  w.revision++;w.audit.push({id:request.idempotencyKey,action:op,at:now,caseId,version,actorType:verifiedContext?.technical?'technical_acceptance':verifiedContext?.verified?'verified_person':'shared_pilot_access',...(verifiedContext?.verified?{actorId:verifiedContext.email}:{})});
  w.receipts=[...(w.receipts||[]),{key:request.idempotencyKey,fingerprint,at:now,revision:w.revision}];
  return {write:true,previousRevision:original.revision,revision:w.revision,payload:JSON.stringify(w),status:op.endsWith('.start')?202:200,response:result()};
}
