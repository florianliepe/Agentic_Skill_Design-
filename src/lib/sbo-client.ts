import type { Response, Workspace } from './sbo-types';
import {mergeTransportWorkspace,retryableTransportStatus} from './sbo-transport.mjs';
let workspaceCache:{access:string;workspace:Workspace}|null=null;
export function clearWorkspaceCache(){workspaceCache=null;}
export const apiUrl=process.env.NEXT_PUBLIC_SBO_API_URL || 'https://eraneos-agentic-platform.azurewebsites.net/webhook/agentic-skill-design-v1';
export class WorkspaceError extends Error {constructor(message:string,public code:string,public status:number){super(message);this.name='WorkspaceError';}}
export const personalApiUrl=process.env.NEXT_PUBLIC_SBO_PERSONAL_API_URL||'https://eraneos-agentic-platform.azurewebsites.net/webhook/agentic-skill-design-auth-v1';
export type PlatformRole='Owner'|'Developer'|'User';
export type AdminSnapshot={canEdit:boolean;platformRole:PlatformRole;email:string;revision:number;members:{email:string;platformRole:PlatformRole;active:boolean;passwordConfigured:boolean;activeSessions:number}[];audit:{at:string;actor:string;action:string;target:string}[]};
export type PersonalSession={token:string;expiresAt:number;user:{email:string;roles:string[];platformRole:PlatformRole}};
type PersonalResponse=Response&{challengeId?:string;message?:string;admin?:AdminSnapshot;session?:PersonalSession};
export async function personalAccess(body:Record<string,unknown>):Promise<PersonalResponse>{
 let response:globalThis.Response;try{response=await fetch(personalApiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(['login','set_password'].includes(String(body.action))?60000:20000)});}catch{throw new WorkspaceError('The workspace connection was interrupted. Your draft is preserved. Retry when the service is available.','CONNECTION_UNAVAILABLE',0);}
 let result:PersonalResponse;try{result=await response.json();}catch{throw new WorkspaceError('Personal sign-in is unavailable. Please retry later.','AUTH_UNAVAILABLE',response.status);}
 if(!response.ok||!result.ok)throw new WorkspaceError(result.error?.message||'Unable to process personal access.',result.error?.code||'AUTH_ERROR',response.status);return result;
}
async function commandOnce(password:string,operation:string,payload:Record<string,unknown>={},revision?:number,requestId=crypto.randomUUID()):Promise<Response>{
  if(password.startsWith('session:'))return personalAccess({action:'workspace',token:password.slice(8),request:{contractVersion:'sbo.case.v1',command:operation,requestId,idempotencyKey:requestId,expectedVersion:revision,payload,responseMode:operation==='sbo.workspace.read'?undefined:'compact'}});
  const response=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json','x-n8n-webhook-secret':password},body:JSON.stringify({contractVersion:'sbo.case.v1',command:operation,requestId,idempotencyKey:requestId,expectedVersion:revision,payload}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(response.status===401||response.status===403)throw new Error('Access was not accepted. Check your team access or contact the workspace owner.');
  let data:Response;
  try{data=await response.json();}catch{throw new Error('The workspace did not return a valid response. Your local draft is still available.');}
  if(!response.ok||!data.ok)throw new WorkspaceError(data.error?.message||`Workspace request failed (${response.status}).`,data.error?.code||'REQUEST_FAILED',response.status);
  return data;
}
export async function command(password:string,operation:string,payload:Record<string,unknown>={},revision?:number,requestId=crypto.randomUUID()):Promise<Response>{
 for(let attempt=0;attempt<2;attempt++){
  try{const result=await commandOnce(password,operation,payload,revision,requestId);if(result.workspace){const merged=mergeTransportWorkspace(workspaceCache?.access===password?workspaceCache.workspace:null,result.workspace);workspaceCache={access:password,workspace:merged};result.workspace=merged;}return result;}
  catch(error){if(attempt||!(error instanceof WorkspaceError)||!retryableTransportStatus(error.status)||error.status===429)throw error;await new Promise(resolve=>setTimeout(resolve,400));}
 }
 throw new Error('Request did not complete.');
}
export function downloadSnapshot(value:unknown,name:string){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function cloneWorkspace(workspace:Workspace):Workspace{return structuredClone(workspace);}
