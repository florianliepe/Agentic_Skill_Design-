import {sha256} from '@noble/hashes/sha256';
const hash=value=>Buffer.from(sha256(new Uint8Array(Buffer.from(value,'utf8')))).toString('hex');
export const sessionHash=token=>hash('skill-design/session/'+token);
function constantEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
export function applyAuth(original,request,entropy,now=Date.now()){
 const store=JSON.parse(JSON.stringify(original)),fail=(status,code,message)=>({write:false,status,response:{ok:false,error:{code,message}}});
 if(!request||typeof request!=='object'||JSON.stringify(request).length>500000||!['request_code','verify_code','logout','workspace'].includes(request.action))return fail(422,'VALIDATION_ERROR','Invalid sign-in request.');
 if(!/^[a-f0-9]{64,}$/i.test(entropy||''))return fail(503,'ENTROPY_UNAVAILABLE','Sign-in is temporarily unavailable.');
 store.sessions=(store.sessions||[]).filter(s=>s.expiresAt>now);store.challenges=(store.challenges||[]).filter(c=>c.expiresAt>now&&!c.used);
 store.attempts=(store.attempts||[]).filter(a=>a.at>now-15*60000);
 const result=(status,response,extra={})=>({write:true,status,response,store,...extra});
 if(request.action==='request_code'){
  const email=String(request.email||'').trim().toLowerCase();if(!/^[^\s@,;<>]+@eraneos\.com$/.test(email)||email.length>254)return fail(422,'EMAIL_NOT_ELIGIBLE','Use your approved Eraneos email address.');
  if(store.attempts.length>=100||store.attempts.filter(a=>a.principal===hash(email)&&a.kind==='code').length>=3)return fail(429,'RATE_LIMIT','Please wait 15 minutes before requesting another code.');
  store.attempts.push({principal:hash(email),kind:'code',at:now});
  const member=store.members?.find(m=>m.email===email&&m.active!==false),challengeId=entropy.slice(0,32);
  const accepted={ok:true,challengeId,message:'If this address has workspace access, a sign-in code has been sent. It expires in 10 minutes.'};
  if(!member)return result(200,accepted);
  // Rejection sampling avoids a biased reduction into the 8-digit code range.
  const range=90000000,limit=Math.floor(4294967296/range)*range;let value,index=0;
  do{const bytes=hash('skill-design/code/'+entropy+'/'+index++);value=parseInt(bytes.slice(0,8),16);}while(value>=limit);
  const code=String(10000000+value%range);store.challenges=store.challenges.filter(c=>c.email!==email);
  store.challenges.push({id:challengeId,email,hash:hash(challengeId+':'+code),expiresAt:now+10*60000,attempts:0,used:false});
  return result(200,accepted,{pendingMail:{to:email,code,purpose:'skill_design_login'}});
 }
 if(request.action==='verify_code'){
  if(typeof request.challengeId!=='string'||!/^\d{8}$/.test(request.code||''))return fail(401,'INVALID_CODE','The code is invalid, expired or already used.');
  const challenge=store.challenges.find(c=>c.id===request.challengeId),member=store.members?.find(m=>m.email===challenge?.email&&m.active!==false);
  if(!challenge||!member||challenge.used||challenge.attempts>=5)return fail(401,'INVALID_CODE','The code is invalid, expired or already used.');
  challenge.attempts++;
  if(!constantEqual(challenge.hash,hash(challenge.id+':'+request.code)))return result(401,{ok:false,error:{code:'INVALID_CODE',message:'The code is invalid, expired or already used.'}});
  challenge.used=true;const token=hash('skill-design/token/'+entropy),expiresAt=now+8*3600000;
  store.sessions.push({hash:sessionHash(token),email:member.email,expiresAt});
  store.sessions=store.sessions.slice(-100);
  return result(200,{ok:true,session:{token,expiresAt,user:{email:member.email,roles:member.roles}}});
 }
 if(typeof request.token!=='string'||request.token.length>256)return fail(401,'SESSION_REQUIRED','Please sign in again.');
 const found=store.sessions.find(s=>constantEqual(s.hash,sessionHash(request.token))),member=store.members?.find(m=>m.email===found?.email&&m.active!==false);
 if(!found||!member)return fail(401,'SESSION_REQUIRED','Please sign in again.');
 if(request.action==='logout'){store.sessions=store.sessions.filter(s=>s!==found);return result(200,{ok:true});}
 const command=request.request?.command;
 const reads=['sbo.workspace.read','sbo.workspace.status','sbo.run.status','sbo.run.result','sbo.tna.export'];
 if(typeof command!=='string')return fail(422,'VALIDATION_ERROR','A workspace command is required.');
 if(!reads.includes(command)&&!member.roles.some(r=>['sme','hrbp','business','coe'].includes(r)))return fail(403,'FORBIDDEN','Your workspace role allows reading only.');
 // CoE and business releases remain on their separate, not-yet-connected publisher path.
 if(['sbo.coe.decide','sbo.business.decide','sbo.release.publish'].includes(command))return fail(403,'RELEASE_NOT_CONNECTED','Named sign-in is active; the formal release publisher is not connected yet.');
 return {write:false,status:200,response:{ok:true},forward:{...request.request,authContext:{verified:true,email:member.email,roles:member.roles}}};
}
