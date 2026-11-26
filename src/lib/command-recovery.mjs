// Rebase only explicit intents whose target evidence has not changed.
export function canRebaseCommand(before,after,operation,payload){
 if(!after)return false;
 if(operation==='sbo.skill.classify')return JSON.stringify(before.skillClassifications?.[payload.skillId])===JSON.stringify(after.skillClassifications?.[payload.skillId]);
 if(operation==='sbo.import.mapping.start')return true;
 if(['sbo.role.archive','sbo.role.restore'].includes(operation))return before.roles.some(r=>r.id===payload.roleId&&r.importBatchId)&&Boolean(before.archivedRoleIds?.includes(payload.roleId))===Boolean(after.archivedRoleIds?.includes(payload.roleId));
 if(operation==='sbo.import.discard'){const a=before.imports?.find(b=>b.id===payload.batchId),b=after.imports?.find(b=>b.id===payload.batchId);return a?.status==='staging'&&b?.status==='staging'&&a.received===b.received;}
 const unchanged=id=>{const a=before.cases.find(c=>c.id===id),b=after.cases.find(c=>c.id===id);return !!a&&!!b&&a.version===b.version&&a.archivedAt===b.archivedAt;};
 if(operation==='sbo.case.archive_many')return Array.isArray(payload.caseIds)&&payload.caseIds.length>0&&payload.caseIds.every(unchanged);
 const target=typeof payload.caseId==='string'?payload.caseId:before.runs.find(r=>r.id===payload.runId)?.caseId;
 return !!target&&unchanged(target);
}
