import {profileHash,validScenario} from '../src/lib/profile-evolution.mjs';
export function applyEvolutionDraft(workspace,p,now){
 const run=workspace.runs.find(r=>r.id===p.runId),c=workspace.cases.find(c=>c.id===run?.caseId),editing=!!c?.evolution&&c.evolution.runId===run?.id&&run?.adopted,proposal=editing?c.evolution:run?.result?.profileEvolution;
 if(!c||!proposal||run.operation!=='sbo.profile.evolve.start'||run.status!=='succeeded'||run.adopted&&!editing)return {error:'A successful role scenario or its saved future draft is required.'};
 if(c.archivedAt||c.version!==p.caseVersion||!editing&&c.version!==run.inputVersion||profileHash(c)!==proposal.sourceProfileHash)return {error:'The source profile or saved future draft changed. Refresh, or run the revised profile again before applying it.'};
 if(!validScenario(p.scenario)||Object.keys(proposal.scenario).some(k=>p.scenario[k]!==proposal.scenario[k]))return {error:'The sliders changed. Reanalyse this scenario before applying its proposal.'};
 if(!Array.isArray(p.edits)||p.edits.length>30||new Set(p.edits.map(e=>e.id)).size!==p.edits.length)return {error:'Invalid scenario edits.'};
 const changes=JSON.parse(JSON.stringify(proposal.changes));
 for(const edit of p.edits){
  const x=changes.find(x=>x.id===edit.id),skill=workspace.skills.find(s=>s.id===x?.skillId);
  if(!x||!skill||!Number.isInteger(edit.relevance)||edit.relevance<1||edit.relevance>5||!['core','emerging','declining'].includes(edit.status)||edit.futureTarget!==null&&(!Number.isInteger(edit.futureTarget)||edit.futureTarget<1||edit.futureTarget>4||!skill.anchors[edit.futureTarget-1]))return {error:'An edit uses an unknown skill, invalid relevance or unavailable proficiency anchor.'};
  if(edit.futureTarget!==x.futureTarget||edit.relevance!==x.relevance||edit.status!==x.status){if(typeof edit.reason!=='string'||edit.reason.trim().length<12||edit.reason.length>4000)return {error:'Explain each manual override in at least 12 characters.'};Object.assign(x,{futureTarget:edit.futureTarget,relevance:edit.relevance,status:edit.status,manualReason:edit.reason,manuallyEdited:true,jrdChange:x.jrdChange||edit.futureTarget!==x.currentTarget||edit.status!=='core'});}
 }
 workspace.history=[...(workspace.history||[]),{caseId:c.id,version:c.version,snapshot:JSON.parse(JSON.stringify(c))}];
 c.evolution={...JSON.parse(JSON.stringify(proposal)),changes,status:'draft',appliedAt:now};c.version++;c.updatedAt=now;c.status='draft';c.decisions=[];run.adopted=true;
 return {caseId:c.id,version:c.version};
}
