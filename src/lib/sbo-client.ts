import type { Response, Workspace } from './sbo-types';
export const apiUrl=process.env.NEXT_PUBLIC_SBO_API_URL || 'https://eraneos-agentic-platform.azurewebsites.net/webhook/agentic-skill-design-v1';
export async function command(password:string,operation:string,payload:Record<string,unknown>={},revision?:number,requestId=crypto.randomUUID()):Promise<Response>{
  const response=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json','x-n8n-webhook-secret':password},body:JSON.stringify({contractVersion:'sbo.case.v1',command:operation,requestId,idempotencyKey:requestId,expectedVersion:revision,payload}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(response.status===401||response.status===403)throw new Error('Access was not accepted. Check your team access or contact the workspace owner.');
  let data:Response;
  try{data=await response.json();}catch{throw new Error('The workspace did not return a valid response. Your local draft is still available.');}
  if(!response.ok||!data.ok)throw new Error(data.error?.message||`Workspace request failed (${response.status}).`);
  return data;
}
export function downloadSnapshot(value:unknown,name:string){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function cloneWorkspace(workspace:Workspace):Workspace{return structuredClone(workspace);}
