import {importHash} from './bulk-import.mjs';
import {distinctRecommendations} from './radar-model.mjs';
export const defaultScenario={adoption:60,automation:30,transformation:50,horizon:'2 years'};
export function validScenario(s){return !!s&&['adoption','automation','transformation'].every(k=>Number.isInteger(s[k])&&s[k]>=0&&s[k]<=100)&&['1 year','2 years','3–5 years'].includes(s.horizon)&&Object.keys(s).every(k=>['adoption','automation','transformation','horizon'].includes(k));}
export function profileHash(c){return importHash({roleId:c.roleId,requirements:c.requirements});}
export function evolutionProposal(c,completed){return completed?.id===c.evolution?.runId?c.evolution:completed?.result?.profileEvolution||c.evolution;}
export function evolutionEvidence(workspace,c){
 const run=workspace.runs.filter(r=>r.caseId===c.id&&r.operation==='sbo.trend.scan.start'&&r.status==='succeeded'&&r.result?.researchCoverage?.complete&&distinctRecommendations(r.result.signals)>=5&&(r.inputVersion===c.version||r.sourceRole?.id===c.roleId&&r.result.signals.every(s=>c.signals.some(saved=>saved.id===s.id)))).at(-1);
 const signals=run?.result.signals||(c.evolution?.sourceProfileHash===profileHash(c)?c.evolution.signals:[]);
 return {signals,runId:run?.id||'',candidateSkills:signals.flatMap(s=>s.proposedSkill?[s.proposedSkill]:[])};
}
export function evolutionPreview(workspace,c){
 const {signals}=evolutionEvidence(workspace,c),changes=c.requirements.map(r=>({id:r.id,requirementId:r.id,skillId:r.skillId,currentTask:r.task,futureTask:r.task,currentTarget:r.target,futureTarget:r.target,relevance:null,status:r.trendStatus||(r.future?'emerging':'core'),reason:'Existing working-profile entry. Future demand has not been assessed.',signalIds:[],jrdChange:false}));
 const existing=new Set(changes.map(x=>x.skillId));
 for(const s of signals)for(const id of s.skillIds)if(!existing.has(id)&&workspace.skills.some(x=>x.id===id)){existing.add(id);changes.push({id:'candidate-'+id,requirementId:null,skillId:id,currentTask:'',futureTask:s.taskChange,currentTarget:null,futureTarget:null,relevance:s.relevanceScore??null,status:'emerging',reason:s.emergenceReason||s.applicability||'Research proposal requiring SME review.',signalIds:[s.id],jrdChange:true});}
 return changes;
}
export function validateEvolution(data,prepared){
 const errors=[],text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=4000,base=prepared.baseRequirements,signals=prepared.signals,skills=prepared.candidates;
 if(!data||!Array.isArray(data.changes)||data.changes.length>30||!Array.isArray(data.questions)||data.questions.length>3||!Array.isArray(data.residuals)||[...data.questions,...data.residuals].some(x=>!text(x)))return {valid:false,errors:['INVALID_EVOLUTION_SCHEMA']};
 const seen=new Set(),changes=[];
 for(const [i,x] of data.changes.entries()){
  const skill=skills.find(s=>s.id===x.skillId),requirement=x.requirementId?base.find(r=>r.id===x.requirementId):null;
  if(!skill||x.requirementId&&!requirement||requirement&&requirement.skillId!==x.skillId||!requirement&&base.some(r=>r.skillId===x.skillId)||seen.has(x.requirementId||x.skillId)){errors.push('EVOLUTION_IDENTITY:'+i);continue;}
  seen.add(x.requirementId||x.skillId);
  if(!text(x.futureTask)||!text(x.reason)||!['core','emerging','declining'].includes(x.status)||!Number.isInteger(x.relevance)||x.relevance<1||x.relevance>5||x.futureTarget!==null&&(!Number.isInteger(x.futureTarget)||x.futureTarget<1||x.futureTarget>4||!skill.anchors[x.futureTarget-1])){errors.push('EVOLUTION_ANCHOR_OR_SCHEMA:'+i);continue;}
  const changed=!requirement||x.futureTask!==requirement.task||x.futureTarget!==requirement.target||x.status!==(requirement.trendStatus||(requirement.future?'emerging':'core'));
  if(!Array.isArray(x.signalIds)||x.signalIds.length>8||x.signalIds.some(id=>!signals.some(s=>s.id===id&&s.skillIds.includes(x.skillId)))||changed&&!x.signalIds.length){errors.push('EVOLUTION_EVIDENCE:'+i);continue;}
  changes.push({id:prepared.runId+'-change-'+i,requirementId:requirement?.id||null,skillId:skill.id,currentTask:requirement?.task||'',futureTask:x.futureTask,currentTarget:requirement?.target??null,futureTarget:x.futureTarget,relevance:x.relevance,status:x.status,reason:x.reason,signalIds:[...new Set(x.signalIds)],jrdChange:changed});
 }
 if(base.some(r=>!changes.some(x=>x.requirementId===r.id)))errors.push('EVOLUTION_OMITS_BASE_REQUIREMENTS');
 return errors.length?{valid:false,errors}:{valid:true,quality:'scenario_proposal_needs_sme_review',result:{profileEvolution:{runId:prepared.runId,roleId:prepared.roleId,baseVersion:prepared.inputVersion,sourceProfileHash:prepared.sourceProfileHash,scenario:prepared.scenario,changes,signals,unmappedCandidates:signals.filter(s=>s.proposedSkill).map(s=>s.proposedSkill)},questions:data.questions,residuals:data.residuals}};
}
