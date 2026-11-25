const bindings=['SBO_AUTH_TABLE_ID','SBO_INTERNAL_API_ID','SBO_MAIL_WORKFLOW_ID','SBO_WORKER_ID','SBO_WORKSPACE_TABLE_ID','SBO_SOURCE_CACHE_TABLE_ID','EXISTING_TEAM_HEADER_CREDENTIAL_ID','EXISTING_GATEWAY_CREDENTIAL_ID','VERIFIED_GATEWAY_MODEL'];
export function bindWorkflow(template,replacements){
 let text=template;for(const [name,value] of Object.entries(replacements)){if(typeof value!=='string'||!value.trim())throw new Error('Missing workflow binding: '+name);text=text.replaceAll(name,value);}
 const unresolved=bindings.filter(name=>text.includes(name));if(unresolved.length)throw new Error('Unresolved workflow bindings: '+unresolved.join(', '));
 return JSON.parse(text);
}
