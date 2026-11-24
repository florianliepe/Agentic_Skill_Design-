import {sha256} from '@noble/hashes/sha256';
import {pbkdf2} from '@noble/hashes/pbkdf2';
import {HMAC} from '@noble/hashes/hmac';
// n8n hides prototypes returned by Object.getPrototypeOf. Preserve noble's
// state-copy logic while supplying a real SHA-256 HMAC instance.
const cloneHmac=HMAC.prototype._cloneInto;
HMAC.prototype._cloneInto=function(to){return cloneHmac.call(this,to||new HMAC(sha256,new Uint8Array()));};
const hash=value=>Buffer.from(sha256(new Uint8Array(Buffer.from(value,'utf8')))).toString('hex');
export const sessionHash=token=>hash('skill-design/session/'+token);
const roles=['Owner','Developer','User'],iterations=600000;
const derive=(password,salt)=>Buffer.from(pbkdf2(sha256,password,salt,{c:iterations,dkLen:32})).toString('hex');
function constantEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
export function migrateIdentityVault(original){
 const store=JSON.parse(JSON.stringify(original));
 if(store.authVersion===2)return store;
 store.authVersion=2;store.sessions=[];store.challenges=[];store.attempts=[];
 for(const m of store.members||[])m.platformRole=m.email==='florian.liepe@eraneos.com'?'Owner':'User';
 return store;
}
export function applyAuth(original,request,entropy,now=Date.now()){
 const store=JSON.parse(JSON.stringify(original)),fail=(status,code,message)=>({write:false,status,response:{ok:false,error:{code,message}}});
 if(!request||typeof request!=='object'||JSON.stringify(request).length>500000||!['login','request_code','set_password','verify_code','logout','workspace','admin_read','admin_member_save','admin_revoke_sessions'].includes(request.action))return fail(422,'VALIDATION_ERROR','Invalid access request.');
 if(!/^[a-f0-9]{64,}$/i.test(entropy||''))return fail(503,'ENTROPY_UNAVAILABLE','Sign-in is temporarily unavailable.');
 store.sessions=(store.sessions||[]).filter(s=>s.expiresAt>now);store.challenges=(store.challenges||[]).filter(c=>c.expiresAt>now&&!c.used);
 store.attempts=(store.attempts||[]).filter(a=>a.at>now-15*60000);store.audit=store.audit||[];
 const result=(status,response,extra={})=>({write:true,status,response,store,...extra});
 const audit=(actor,action,target)=>{store.audit.push({at:new Date(now).toISOString(),actor,action,target});store.audit=store.audit.slice(-500);};
 const email=String(request.email||'').trim().toLowerCase();
 const eligible=/^[^\s@,;<>]+@eraneos\.com$/.test(email)&&email.length<=254;
 if(request.action==='verify_code')return fail(410,'PASSWORD_REQUIRED','Use email and password. Set your password with an email code first.');
 if(request.action==='request_code'){
  if(!eligible)return fail(422,'EMAIL_NOT_ELIGIBLE','Use your approved Eraneos email address.');
  if(store.attempts.length>=100||store.attempts.filter(a=>a.principal===hash(email)&&a.kind==='code').length>=3)return fail(429,'RATE_LIMIT','Please wait 15 minutes before requesting another code.');
  store.attempts.push({principal:hash(email),kind:'code',at:now});
  const member=store.members?.find(m=>m.email===email&&m.active!==false),challengeId=entropy.slice(0,32);
  const accepted={ok:true,challengeId,message:'If this address has workspace access, a password setup/reset code has been sent. It expires in 10 minutes.'};
  if(!member)return result(200,accepted);
  const range=90000000,limit=Math.floor(4294967296/range)*range;let value,index=0;
  do{value=parseInt(hash('skill-design/code/'+entropy+'/'+index++).slice(0,8),16);}while(value>=limit);
  const code=String(10000000+value%range);store.challenges=store.challenges.filter(c=>c.email!==email);
  store.challenges.push({id:challengeId,email,hash:hash(challengeId+':'+code),expiresAt:now+10*60000,attempts:0});
  return result(200,accepted,{pendingMail:{to:email,code,purpose:'skill_design_password_reset'}});
 }
 if(request.action==='set_password'){
  if(typeof request.password!=='string'||request.password.length<15||request.password.length>128)return fail(422,'PASSWORD_POLICY','Use a password or passphrase with 15–128 characters.');
  const challenge=store.challenges.find(c=>c.id===request.challengeId),member=store.members?.find(m=>m.email===challenge?.email&&m.active!==false);
  if(!challenge||!member||challenge.attempts>=5)return fail(401,'INVALID_CODE','The code is invalid, expired or already used.');
  challenge.attempts++;
  if(!/^\d{8}$/.test(request.code||'')||!constantEqual(challenge.hash,hash(challenge.id+':'+request.code)))return result(401,{ok:false,error:{code:'INVALID_CODE',message:'The code is invalid, expired or already used.'}});
  const salt=hash('skill-design/password-salt/'+entropy);
  member.password={algorithm:'PBKDF2-SHA256',iterations,salt,hash:derive(request.password,salt),changedAt:new Date(now).toISOString()};
  store.challenges=store.challenges.filter(c=>c.email!==member.email);store.sessions=store.sessions.filter(s=>s.email!==member.email);store.attempts=store.attempts.filter(a=>a.principal!==hash(member.email));
  audit(member.email,'password_changed',member.email);
  return result(200,{ok:true,message:'Password saved. All previous sessions were signed out. Sign in with your new password.'});
 }
 if(request.action==='login'){
  if(!eligible||typeof request.password!=='string'||request.password.length>128)return fail(401,'INVALID_CREDENTIALS','Email or password was not accepted.');
  if(store.attempts.length>=100||store.attempts.filter(a=>a.principal===hash(email)&&a.kind==='login').length>=5)return fail(429,'RATE_LIMIT','Too many sign-in attempts. Please wait 15 minutes.');
  store.attempts.push({principal:hash(email),kind:'login',at:now});
  const member=store.members?.find(m=>m.email===email&&m.active!==false),verifier=member?.password;
  const candidate=derive(request.password,verifier?.salt||hash('skill-design/dummy-salt'));
  if(!verifier||verifier.algorithm!=='PBKDF2-SHA256'||verifier.iterations!==iterations||!constantEqual(candidate,verifier.hash))return result(401,{ok:false,error:{code:'INVALID_CREDENTIALS',message:'Email or password was not accepted.'}});
  store.attempts=store.attempts.filter(a=>a.principal!==hash(email));
  const token=hash('skill-design/token/'+entropy),expiresAt=now+(request.remember===true?7*24:8)*3600000;
  store.sessions.push({hash:sessionHash(token),email,expiresAt});store.sessions=store.sessions.slice(-100);audit(email,'signed_in',email);
  return result(200,{ok:true,session:{token,expiresAt,user:{email,roles:member.roles||[],platformRole:member.platformRole||'User'}}});
 }
 if(typeof request.token!=='string'||request.token.length>256)return fail(401,'SESSION_REQUIRED','Please sign in again.');
 const found=store.sessions.find(s=>constantEqual(s.hash,sessionHash(request.token))),member=store.members?.find(m=>m.email===found?.email&&m.active!==false);
 if(!found||!member)return fail(401,'SESSION_REQUIRED','Please sign in again.');
 if(request.action==='logout'){store.sessions=store.sessions.filter(s=>s!==found);return result(200,{ok:true});}
 if(request.action.startsWith('admin_')){
  if(!['Owner','Developer'].includes(member.platformRole))return fail(403,'FORBIDDEN','Your platform role has no admin cockpit access.');
  if(request.action==='admin_read')return {write:false,status:200,response:{ok:true,admin:{canEdit:member.platformRole==='Owner',platformRole:member.platformRole,email:member.email,revision:store.adminRevision||0,members:(store.members||[]).map(m=>({email:m.email,platformRole:m.platformRole||'User',active:m.active!==false,passwordConfigured:!!m.password,activeSessions:store.sessions.filter(s=>s.email===m.email).length})),audit:store.audit.slice(-100).reverse()}}};
  if(member.platformRole!=='Owner')return fail(403,'FORBIDDEN','Developer access is read-only. Only an Owner may change access.');
  if(request.expectedRevision!==(store.adminRevision||0))return fail(409,'ADMIN_CONFLICT','Access settings changed. Refresh and review before saving.');
  if(!eligible)return fail(422,'EMAIL_NOT_ELIGIBLE','Use an Eraneos email address.');
  const target=store.members.find(m=>m.email===email);
  if(request.action==='admin_member_save'){
   if(!roles.includes(request.platformRole)||typeof request.active!=='boolean')return fail(422,'VALIDATION_ERROR','Choose a valid platform role and access status.');
   if(target?.platformRole==='Owner'&&target.active!==false&&(request.platformRole!=='Owner'||!request.active)&&store.members.filter(m=>m.platformRole==='Owner'&&m.active!==false).length<=1)return fail(409,'LAST_OWNER','The last active Owner cannot be disabled or demoted.');
   if(target){if(target.platformRole!==request.platformRole||target.active!==request.active)store.sessions=store.sessions.filter(s=>s.email!==email);Object.assign(target,{platformRole:request.platformRole,active:request.active});}
   else store.members.push({email,platformRole:request.platformRole,active:request.active,roles:['sme']});
   if(!request.active)store.challenges=store.challenges.filter(c=>c.email!==email);
   audit(member.email,'access_updated',email);
  }else {if(!target)return fail(404,'MEMBER_NOT_FOUND','Access record not found.');store.sessions=store.sessions.filter(s=>s.email!==email);audit(member.email,'sessions_revoked',email);}
  store.adminRevision=(store.adminRevision||0)+1;
  return result(200,{ok:true,message:'Access settings saved.'});
 }
 const command=request.request?.command,reads=['sbo.workspace.read','sbo.workspace.status','sbo.run.status','sbo.run.result','sbo.tna.export'];
 if(typeof command!=='string')return fail(422,'VALIDATION_ERROR','A workspace command is required.');
 if(!reads.includes(command)&&!member.platformRole&&!(member.roles||[]).some(r=>['sme','hrbp','business','coe'].includes(r)))return fail(403,'FORBIDDEN','Your workspace role allows reading only.');
 if(['sbo.coe.decide','sbo.business.decide','sbo.release.publish'].includes(command))return fail(403,'RELEASE_NOT_CONNECTED','Platform access does not grant formal business or CoE release authority.');
 return {write:false,status:200,response:{ok:true},forward:{...request.request,authContext:{verified:true,email:member.email,roles:member.roles||[],platformRole:member.platformRole||'User'}}};
}
