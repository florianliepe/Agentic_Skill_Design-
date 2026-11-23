// Pure command handler. The n8n wrapper atomically CAS-commits the returned payload.
export function applyCommand(original, request, now = new Date().toISOString()) {
  const error=(code,message,status=422)=>({write:false,status,response:{ok:false,error:{code,message}}});
  if(!request||typeof request!=='object'||Array.isArray(request)||JSON.stringify(request).length>500000)return error('VALIDATION_ERROR','Invalid request or request too large.');
  if(request.contractVersion!=='sbo.case.v1')return error('VALIDATION_ERROR','Unsupported contract version.');
  const readCommands=['sbo.workspace.read','sbo.run.status','sbo.run.result','sbo.tna.export'];
  const op=request.command,p=request.payload||{};
  const w=JSON.parse(JSON.stringify(original));
  const result=()=>({ok:true,workspace:w,revision:w.revision});
  if(op==='sbo.workspace.read')return {write:false,status:200,response:result()};
  if(op==='sbo.run.status'||op==='sbo.run.result'){
    const run=w.runs.find(r=>r.id===p.runId);if(!run)return error('NOT_FOUND','Run not found.',404);
    return {write:false,status:200,response:{ok:true,run}};
  }
  if(op==='sbo.tna.export'){
    const c=w.cases.find(c=>c.id===p.caseId);if(!c||c.version!==p.caseVersion)return error('VERSION_CONFLICT','Refresh the selected case before export.',409);
    return {write:false,status:200,response:{ok:true,export:{case:c,sourceManifest:w.sourceManifest,ruleVersion:'sbo-rules-1.0.0',workspaceRevision:w.revision}}};
  }
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
  if(op==='sbo.case.save'){
    const incoming=p.case;const problem=failCase(incoming);if(problem)return error('VALIDATION_ERROR',problem);
    if(!/^[\w-]{1,100}$/.test(incoming.id))return error('VALIDATION_ERROR','Invalid case identifier.');
    const existing=w.cases.find(c=>c.id===incoming.id);
    if(JSON.stringify(incoming.individualAssessments||[])!==JSON.stringify(existing?.individualAssessments||[]))return error('IDENTITY_REQUIRED','Individual assessments require verified subject-level access. They are not stored through shared team access.',403);
    if(existing&&incoming.version!==existing.version)return error('VERSION_CONFLICT','The case version changed.',409);
    if(!existing&&incoming.version!==0)return error('VERSION_CONFLICT','New cases start at version zero.',409);
    const next=Object.fromEntries(['id','title','unit','question','owner','targetDate','trigger','roleId','relevance','requirements','baselines','signals','measures'].map(key=>[key,incoming[key]]));
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
  } else if(op==='sbo.profile.draft.start'||op==='sbo.trend.scan.start'){
    const capability=op==='sbo.profile.draft.start'?'profileDraft':'trendResearch';
    if(!w.runtimeCapabilities?.[capability])return error('INTEGRATION_NOT_READY','This agent is not connected yet. Manual evidence-based editing is available.',503);
    const c=w.cases.find(c=>c.id===p.caseId);if(!c)return error('NOT_FOUND','Save the case before starting an analysis.',404);
    if(op==='sbo.profile.draft.start'&&!c.roleId)return error('VALIDATION_ERROR','Select a global role for profile drafting.');
    if(w.runs.some(r=>r.caseId===c.id&&['queued','running'].includes(r.status)))return error('RUN_ACTIVE','An analysis is already active for this case.',409);
    const run={id:request.idempotencyKey,caseId:c.id,operation:op,status:'queued',quality:'pending',stage:'Queued for analysis',inputVersion:c.version,startedAt:now,updatedAt:now,inputCase:JSON.parse(JSON.stringify(c)),retryOfRunId:p.retryOfRunId};w.runs.push(run);
  } else if(op==='sbo.run.interrupt'){
    const run=w.runs.find(r=>r.id===p.runId);if(!run)return error('NOT_FOUND','Run not found.',404);
    if(['queued','running'].includes(run.status)){run.status='interrupted';run.quality='interrupted';run.updatedAt=now;run.stage='Stopped before result adoption';}
  } else if(op==='sbo.run.adopt'){
    const run=w.runs.find(r=>r.id===p.runId),c=w.cases.find(c=>c.id===run?.caseId);if(!run||!c||run.status!=='succeeded')return error('RESULT_NOT_READY','No valid result is available.',409);
    if(c.version!==run.inputVersion)return error('VERSION_CONFLICT','This result used an earlier case version. Compare it or start a new analysis.',409);
    if(run.adopted)return error('VALIDATION_ERROR','This result is already adopted.');
    c.requirements=[...c.requirements,...(run.result?.requirements||[]).filter(r=>!c.requirements.some(x=>x.skillId===r.skillId&&x.task===r.task))];c.signals=[...c.signals,...(run.result?.signals||[])];const problem=failCase(c);if(problem)return error('INVALID_MODEL_OUTPUT',problem);
    c.version++;c.updatedAt=now;c.status='draft';c.decisions=[];run.adopted=true;caseId=c.id;version=c.version;
  }else return error('VALIDATION_ERROR','Unsupported operation.');
  if(w.cases.length>200)return error('LIMIT','Pilot case limit reached.');
  w.revision++;w.audit.push({id:request.idempotencyKey,action:op,at:now,caseId,version,actorType:'shared_pilot_access'});
  w.receipts=[...(w.receipts||[]),{key:request.idempotencyKey,fingerprint,at:now,revision:w.revision}];
  return {write:true,previousRevision:original.revision,revision:w.revision,payload:JSON.stringify(w),status:op.endsWith('.start')?202:200,response:result()};
}
