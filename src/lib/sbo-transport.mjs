export function mergeTransportWorkspace(previous,incoming){
 if(!incoming)return previous;
 if(!Array.isArray(incoming.skills)||!Array.isArray(incoming.roles)){
  if(!previous)throw new Error('Bootstrap the workspace before requesting compact data.');
  if(incoming.revision<previous.revision)return previous;
  return {...previous,...incoming,skills:previous.skills,roles:previous.roles};
 }
 return previous&&incoming.revision<previous.revision?previous:incoming;
}
export function retryableTransportStatus(status){return [0,429,502,503,504].includes(status);}
