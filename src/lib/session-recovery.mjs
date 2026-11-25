// Bound automatic reads after an outage, without submitting credentials again.
export function createSessionRecovery({now=Date.now,maxAttempts=5}={}){
 let attempts=0,inFlight=false,done=false,nextAt=0;
 return {
  begin(visible=true){if(done||inFlight||!visible||attempts>=maxAttempts||now()<nextAt)return false;inFlight=true;attempts++;return true;},
  complete(retry){inFlight=false;done=!retry;nextAt=now()+Math.min(60000,15000*2**(attempts-1));},
  resume(){if(!done&&!inFlight&&attempts>=maxAttempts&&now()>=nextAt){attempts=0;nextAt=0;}},
  stop(){done=true;}
 };
}
