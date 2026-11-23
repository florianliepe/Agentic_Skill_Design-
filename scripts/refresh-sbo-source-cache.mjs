import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {api} from './n8n-client.mjs';import {sourceRegistry,textFromSource} from '../n8n/sbo-specialists.mjs';
const file='.local/deployment.json',config=JSON.parse(await fs.readFile(file,'utf8'));
if(!config.sourceCacheTableId){const t=await api('/data-tables','POST',{name:'Skill Design Studio public research cache v1',columns:[{name:'workspace',type:'string'},{name:'revision',type:'number'},{name:'payload',type:'string'}]});config.sourceCacheTableId=t.id;await fs.writeFile(file,JSON.stringify(config,null,2)+'\n');}
const old=await api('/data-tables/'+config.sourceCacheTableId+'/rows?limit=2');if(old.data.length>1)throw new Error('Unexpected cache rows');
const previous=old.data[0]?JSON.parse(old.data[0].payload).sources:[];
const results=await Promise.allSettled(sourceRegistry.map(async source=>{const response=await fetch(source.url,{headers:{'User-Agent':'SkillDesignStudioResearch/1.0'},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('HTTP_'+response.status);const text=textFromSource(await response.text());if(text.length<200)throw new Error('INSUFFICIENT_TEXT');return {...source,text,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(text).digest('hex')};}));
const sources=sourceRegistry.flatMap((source,i)=>results[i].status==='fulfilled'?[results[i].value]:previous.filter(p=>p.id===source.id));
const payload=JSON.stringify({sources}),revision=(old.data[0]?.revision||0)+1;
if(old.data[0])await api('/data-tables/'+config.sourceCacheTableId+'/rows/update','PATCH',{filter:{type:'and',filters:[{columnName:'workspace',condition:'eq',value:'research'},{columnName:'revision',condition:'eq',value:old.data[0].revision}]},data:{revision,payload}});
else await api('/data-tables/'+config.sourceCacheTableId+'/rows','POST',{data:[{workspace:'research',revision,payload}]});
console.log({cached:sources.map(s=>({id:s.id,chars:s.text.length,retrievedAt:s.retrievedAt})),unavailable:results.flatMap((r,i)=>r.status==='rejected'?[sourceRegistry[i].id]:[])});
