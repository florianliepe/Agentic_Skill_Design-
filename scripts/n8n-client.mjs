import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
export const secretDir=path.join(os.homedir(),'.codex','secrets','agentic-skill-design');
export const host='https://eraneos-agentic-platform.azurewebsites.net';
export async function api(route,method='GET',body){
  if(!route.startsWith('/')||route.includes('://'))throw new Error('Invalid API route');
  const key=(await fs.readFile(path.join(secretDir,'n8n-api-key'),'utf8')).trim();
  if(key.includes('...')||key.split('.').length!==3||key.length<100)throw new Error('A complete n8n API key is required; the abbreviated display value is not a credential.');
  const response=await fetch(host+'/api/v1'+route,{method,headers:{'X-N8N-API-KEY':key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`n8n ${method} ${route.split('?')[0]} returned HTTP ${response.status}. No response payload was logged.`);
  if(response.status===204)return {};
  return response.json();
}
