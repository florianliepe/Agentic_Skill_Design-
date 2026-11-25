export const radarDrivers=['Social','Technological','Economic','Environmental','Political','Legal'];
export const scoreLabels=['Unknown','Minimal','Limited','Moderate','Substantial','Critical'];
export function scopeTargets(workspace,c){
 const ids=[...new Set([c.roleId,...(c.researchParameters?.roleIds||[])].filter(Boolean))].slice(0,6);
 return [...ids.map(id=>workspace.roles.find(r=>r.id===id)).filter(Boolean).map(r=>({kind:'role',id:r.id,label:r.title,purpose:r.purpose})),...[...new Set((c.researchParameters?.businessAreas?.length?c.researchParameters.businessAreas:[c.unit]).filter(Boolean))].slice(0,6).map(label=>({kind:'business',id:label,label}))];
}
export function recommendationKey(signal){return signal.proposedSkill?'new:'+String(signal.proposedSkill.name).normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '):signal.skillIds?.length===1?'skill:'+signal.skillIds[0]:'';}
export function distinctRecommendations(signals){return new Set(signals.map(recommendationKey).filter(Boolean)).size;}
export function portfolioScopes(workspace,kind){const cases=workspace.cases.filter(c=>!c.archivedAt);return kind==='role'?[...new Set(cases.map(c=>c.roleId).filter(Boolean))].map(id=>({id,label:workspace.roles.find(r=>r.id===id)?.title||id})):[...new Set(cases.map(c=>c.unit))].map(id=>({id,label:id}));}
