import {recommendationKey} from './radar-model.mjs';
const cache=new WeakMap();
function indexed(workspace){
 const previous=cache.get(workspace);if(previous&&previous.revision===workspace.revision&&previous.cases===workspace.cases&&previous.skillsRef===workspace.skills)return previous;
 const skills=new Map(workspace.skills.map(s=>[s.id,s])),requirements=new Map(),findings=new Map();
 const add=(map,key,value)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(value);};
 for(const c of workspace.cases.filter(c=>!c.archivedAt)){
  for(const req of c.requirements)for(const [kind,id] of [['role',c.roleId],['business',c.unit]])if(id)add(requirements,JSON.stringify([kind,id,req.skillId]),{c,req});
  for(const signal of c.signals){const keys=new Set([recommendationKey(signal),...(signal.skillIds||[]).map(id=>'skill:'+id)].filter(Boolean));for(const scope of signal.scopeImpacts||[])for(const key of keys)add(findings,JSON.stringify([scope.kind,scope.id,key]),{c,signal,scope});}
 }
 const index={skills,requirements,findings,revision:workspace.revision,cases:workspace.cases,skillsRef:workspace.skills};cache.set(workspace,index);return index;
}
export function intelligenceRows(workspace,includeUnmapped=false){
 const cases=workspace.cases.filter(c=>!c.archivedAt),ids=new Set(cases.flatMap(c=>c.requirements.map(r=>r.skillId).concat(c.signals.flatMap(s=>s.skillIds))));
 const rows=workspace.skills.filter(s=>includeUnmapped||ids.has(s.id)).map(s=>({key:'skill:'+s.id,skillId:s.id,name:s.name,category:s.category,family:s.family,status:s.status,anchors:s.anchors,sourceRef:s.sourceRef}));
 const proposed=new Map();for(const c of cases)for(const signal of c.signals)if(signal.proposedSkill){const key=recommendationKey(signal);proposed.set(key,{key,name:signal.proposedSkill.name,category:signal.proposedSkill.category,family:'Emerging candidate',status:'proposed',anchors:[],sourceRef:signal.sourceUrl});}
 return [...rows,...proposed.values()];
}
export function intelligenceScopes(workspace,kind){
 const cases=workspace.cases.filter(c=>!c.archivedAt),scopes=new Map();for(const c of cases){const id=kind==='role'?c.roleId:c.unit;if(id)scopes.set(id,{id,label:kind==='role'?workspace.roles.find(r=>r.id===id)?.title||id:id});for(const s of c.signals)for(const scope of s.scopeImpacts||[])if(scope.kind===kind)scopes.set(scope.id,{id:scope.id,label:kind==='role'?workspace.roles.find(r=>r.id===scope.id)?.title||scope.id:scope.id});}return [...scopes.values()];
}
export function intelligenceCell(workspace,row,kind,scopeId,metric){
 const index=indexed(workspace),details=[];
 if(['relevance','impact','urgency','confidence'].includes(metric)){
  for(const {c,signal,scope} of index.findings.get(JSON.stringify([kind,scopeId,row.key]))||[]){const value=metric==='relevance'?scope.relevance:metric==='impact'?scope.impact:metric==='urgency'?signal.urgencyScore:signal.confidenceScore;details.push({value:value??null,context:scope.reason,caseTitle:c.title,task:signal.taskChange,sourceUrl:signal.sourceUrl,signalId:signal.id});}
 }else{
  for(const {c,req} of index.requirements.get(JSON.stringify([kind,scopeId,row.skillId]))||[]){
   const skill=index.skills.get(req.skillId),b=c.baselines.find(b=>b.skillId===req.skillId&&b.context===req.task&&b.demandConfirmed),target=Number.isInteger(req.target)&&skill?.anchors[req.target-1]?req.target:null,current=Number.isInteger(b?.current)&&skill?.anchors[b.current-1]?b.current:null;
   const value=metric==='target'?target:metric==='current'?current:metric==='coverage'?(b&&b.coverage!=='unknown'?b.coverage:null):current!==null&&target!==null?Math.max(0,target-current):null;
   details.push({value,context:b?.reason||'No comparable SME assessment',caseTitle:c.title,task:req.task,sourceUrl:'',target,current,coverage:b?.coverage||'unknown',evidence:req.evidence,assessedBy:b?.assessedBy||'',currentAnchor:current?skill.anchors[current-1]:'',targetAnchor:target?skill.anchors[target-1]:''});
  }
 }
 const known=details.filter(d=>d.value!==null),values=[...new Set(known.map(d=>d.value))];
 if(!details.length)return {label:'Not mapped',tone:'unmapped',details};if(!known.length)return {label:'Unknown',tone:'unknown',details};if(known.length!==details.length)return {label:`Partial (${known.length}/${details.length})`,tone:'unknown',details};if(values.length>1)return {label:`Mixed (${values.length})`,tone:'mixed',details};
 const value=values[0],level=typeof value==='number'?value:({insufficient:5,partial:3,sufficient:1})[value]||0;const severity=metric==='gap'?(level>=2?5:level===1?3:1):level;
 return {label:String(value),tone:severity>=4?'high':severity>=2?'medium':'low',details};
}
