// All routes remain on the existing authorised Eraneos gateway.
export function routeFor(operation){
 const routes={
  'sbo.import.mapping.start':{primary:'gpt-6-luna',fallback:'claude-sonnet-5',maxTokens:2800},
  'sbo.profile.draft.start':{primary:'gpt-6-luna',fallback:'claude-sonnet-5',maxTokens:6000},
  'sbo.trend.scan.start':{primary:'gpt-6-luna',fallback:'claude-sonnet-5',maxTokens:7000,reasoningEffort:'low'},
  'sbo.upskill.propose.start':{primary:'gpt-6-luna',fallback:'claude-sonnet-5',maxTokens:5000},
  'sbo.support.ask.start':{primary:'gpt-6-luna',fallback:'claude-sonnet-5',maxTokens:1800}
 };
 if(!routes[operation])throw new Error('UNSUPPORTED_AGENT_OPERATION');
 return {...routes[operation],timeoutMs:operation==='sbo.trend.scan.start'?75000:45000,maxAttempts:2};
}
export function modelRequestBody(route,model,messages){return {model,messages,max_tokens:route.maxTokens,temperature:1,...(model==='gpt-6-luna'&&route.reasoningEffort?{reasoning_effort:route.reasoningEffort}:{})};}
export function gatewayFailure(response){
 const status=Number(response?.statusCode||response?.error?.status||response?.error?.httpCode||0);
 if(status===401||status===403)return {code:'GATEWAY_AUTH',retryable:false,status};
 if(status===429){const retryAfter=response?.headers?.['retry-after'];return {code:'GATEWAY_RATE_LIMIT',retryable:!retryAfter,status,retryAfter:retryAfter?String(retryAfter).slice(0,80):undefined};}
 if(status>=500)return {code:'GATEWAY_UNAVAILABLE',retryable:true,status};
 if(status>=400)return {code:'GATEWAY_REQUEST',retryable:false,status};
 if(response?.error)return {code:'GATEWAY_TIMEOUT_OR_CONNECTION',retryable:true,status};
 const body=response?.body??response;
 if(body?.choices?.[0]?.finish_reason==='length')return {code:'OUTPUT_TRUNCATED',retryable:false,status};
 if(typeof body?.choices?.[0]?.message?.content!=='string'||!body.choices[0].message.content.trim())return {code:'EMPTY_MODEL_RESPONSE',retryable:false,status};
 return null;
}
export function gatewayValidation(output,prepared,validateMapping,validateSpecialist){
 const failure=gatewayFailure(output),body=output.body??output;
 const validated=failure?{valid:false,errors:[failure.code]}:prepared.operation==='sbo.profile.draft.start'?validateMapping(body.choices[0].message.content,prepared):validateSpecialist(body.choices[0].message.content,prepared);
 if(prepared.sourcesUnavailable)return {valid:false,errors:['SOURCE_UNAVAILABLE']};
 if(validated.valid&&prepared.sources&&prepared.requestedSourceCount>prepared.sources.length){if(validated.quality!=='incomplete_evidence')validated.quality='partial_sources';validated.result.residuals.push('Some selected sources could not be retrieved; review the reduced source coverage.');}
 if(validated.valid&&prepared.sources?.some(s=>s.sourceMode==='cached'))validated.result.residuals.push('Some evidence uses previously retrieved source text after live retrieval failed. Check the recorded retrieval dates before business adoption.');
 // No raw provider errors, headers, prompts or credentials enter telemetry.
 validated.diagnostics={model:prepared.usedModel,attempts:prepared.attempts||1,route:prepared.route.primary,latencyMs:Math.max(0,Date.now()-prepared.gatewayStartedAt),errorCode:failure?.code||(!validated.valid?'MODEL_VALIDATION':undefined),retryable:failure?.retryable||false};
 return validated;
}
