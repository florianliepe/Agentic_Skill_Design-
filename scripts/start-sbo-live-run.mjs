import fs from 'node:fs/promises';import {command} from './sbo-live-client.mjs';
const report=JSON.parse(await fs.readFile('.local/live-smoke-report.json'));const {workspace:w}=await command('sbo.workspace.read');
const id=crypto.randomUUID();await fs.writeFile('.local/live-run.json',JSON.stringify({id,caseId:report.caseId,inputVersion:w.cases.find(c=>c.id===report.caseId).version},null,2));
const result=await command('sbo.profile.draft.start',{caseId:report.caseId},w.revision,id);const run=result.workspace.runs.find(r=>r.id===id);console.log({runId:run.id,status:run.status,inputVersion:run.inputVersion});
