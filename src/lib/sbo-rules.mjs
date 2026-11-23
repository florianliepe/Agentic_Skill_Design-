// Shared deterministic rules: used unchanged by the browser and n8n validator.
export const ruleVersion = 'sbo-rules-1.0.0';
export function priority(relevance, severity, critical = false) {
  if (relevance === 'unknown' || severity === 'unknown') return 'Clarify';
  if (critical && severity === 'high') return 'P1';
  return ({high:{high:'P1',medium:'P1',low:'P2'},medium:{high:'P1',medium:'P2',low:'P3'},low:{high:'P2',medium:'P3',low:'P3'}})[relevance]?.[severity] || 'Clarify';
}
export function assessRequirement(requirement, baseline, skill, relevance) {
  const catalogue = !skill ? 'missing' : skill.status === 'approved' ? 'available' : 'pending_review';
  const sameContext = baseline?.context === requirement.task;
  const comparable = Boolean(baseline && sameContext && baseline.demandConfirmed);
  const anchored = Number.isInteger(requirement.target) && Boolean(skill?.anchors?.[requirement.target - 1]);
  const currentAnchored = Number.isInteger(baseline?.current) && Boolean(skill?.anchors?.[baseline.current - 1]);
  const proficiency = !comparable ? 'not_comparable' : !anchored || !currentAnchored ? 'unknown' : baseline.current >= requirement.target ? 'meets' : baseline.current === requirement.target-1 ? 'partially_meets' : 'does_not_meet';
  const coverage = comparable ? baseline.coverage : 'unknown';
  const proficiencySeverity = proficiency === 'does_not_meet' ? 'high' : proficiency === 'partially_meets' ? 'medium' : proficiency === 'meets' ? 'low' : 'unknown';
  const coverageSeverity = coverage === 'insufficient' ? 'high' : coverage === 'partial' ? 'medium' : coverage === 'sufficient' ? 'low' : 'unknown';
  const noGap = proficiency === 'meets' && coverage === 'sufficient';
  const known = [proficiencySeverity,coverageSeverity].filter(s=>s!=='unknown');
  const severity = known.includes('high')?'high':known.includes('medium')?'medium':known.length===2?'low':'unknown';
  return {requirementId:requirement.id,skillId:requirement.skillId,catalogue,profile:requirement.jrdChange?'jrd_change_pending':requirement.future?'future_proposal':'present',proficiency,coverage,severity,priority:noGap?'No gap':priority(relevance,severity,requirement.critical),needsClarification:!comparable||proficiency==='unknown'||coverage==='unknown',ruleVersion};
}
export function assessCase(c, skills) { return c.requirements.map(r=>assessRequirement(r,c.baselines.find(b=>b.skillId===r.skillId&&b.context===r.task),skills.find(s=>s.id===r.skillId),c.relevance)); }
export function searchSkills(skills, query, category='All') {
  const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return skills.filter(s=>(category==='All'||s.category===category)&&terms.every(t=>`${s.id} ${s.name} ${s.definition} ${s.family}`.toLowerCase().includes(t)));
}
export function reviewBlockers(c, skills) {
  const blockers=[];
  if(!c.requirements.length) blockers.push('Add evidence-linked requirements.');
  if(c.requirements.some(r=>!r.evidence.trim()||!r.rationale.trim()||!r.task.trim()))blockers.push('Complete task, rationale and evidence for every requirement.');
  if(c.requirements.some(r=>r.jrdChange))blockers.push('A proposed task requires a separately approved JRD version.');
  if(c.requirements.some(r=>r.target===null))blockers.push('Clarify or explicitly defer unknown target anchors.');
  if(c.requirements.some(r=>skills.find(s=>s.id===r.skillId)?.status!=='approved'))blockers.push('Referenced catalogue concepts still require governance review.');
  if(c.contributions.some(c=>c.resolution==='open'))blockers.push('Resolve or park open SME contributions with a reason.');
  return blockers;
}
export function tnaSnapshot(c, workspace) {
  return {schemaVersion:'sbo.tna.v1',caseId:c.id,caseVersion:c.version,workspaceRevision:workspace.revision,generatedAt:c.updatedAt,unit:c.unit,targetDate:c.targetDate,ruleVersion,sourceManifest:workspace.sourceManifest,requirements:c.requirements,baselines:c.baselines,gaps:assessCase(c,workspace.skills),measures:c.measures,status:c.status,decisions:c.decisions};
}
