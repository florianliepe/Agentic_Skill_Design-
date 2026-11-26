export const primaryCategories=['Technical','Functional','Behavioural'];
// A topical lens never creates another copy or replaces a source classification.
export function aiDomain(workspace,skill){
 const reviewed=workspace.skillClassifications?.[skill.id];
 if(reviewed)return {...reviewed,primaryCategory:skill.category,reviewed:true};
 const specific=/\b(?:AI|artificial intelligence|machine learning|deep learning|neural networks?|natural language processing|computer vision|generative|AutoML|prompt engineering)\b/i.test(skill.name);
 return {aiScope:specific?'specific':'none',primaryCategory:skill.category,secondaryCategory:'',reason:specific?'AI-specific terminology in the source name; suggested topic, not a changed definition.':'No AI-specific source name.',reviewed:false};
}
export function validClassification(skill,value){
 if(!skill||!value||!['specific','contextual','none'].includes(value.aiScope)||typeof value.reason!=='string'||value.reason.trim().length<12||value.reason.length>4000)return false;
 if(Object.keys(value).some(k=>!['aiScope','secondaryCategory','applicationContext','reason'].includes(k)))return false;
 if(value.secondaryCategory&&(!primaryCategories.includes(value.secondaryCategory)||value.secondaryCategory===skill.category))return false;
 if(value.aiScope==='contextual'&&(typeof value.applicationContext!=='string'||value.applicationContext.trim().length<12||value.applicationContext.length>4000))return false;
 return true;
}
