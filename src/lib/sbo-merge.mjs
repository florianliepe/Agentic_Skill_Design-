// Three-way merge: independent edits combine, competing edits require a visible choice.
export function mergeCaseDraft(base,local,remote,choices={}){
 const fields=['title','unit','question','owner','targetDate','trigger','roleId','relevance','requirements','baselines','signals','measures','researchParameters'];
 const merged={...remote},conflicts=[];
 for(const field of fields){const a=JSON.stringify(base?.[field]),l=JSON.stringify(local[field]),r=JSON.stringify(remote[field]);
   if(l===a)merged[field]=remote[field];
   else if(r===a||l===r)merged[field]=local[field];
   else if(choices[field]==='local')merged[field]=local[field];
   else if(choices[field]==='remote')merged[field]=remote[field];
   else conflicts.push({field,local:local[field],remote:remote[field]});
 }
 return {merged,conflicts};
}
