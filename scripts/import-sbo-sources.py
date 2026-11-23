"""Read-only source adapter. Private output must remain outside public/build inputs."""
import csv, hashlib, json, sys
from pathlib import Path
import openpyxl

root = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
if output.name != 'source-workspace.json' or output.parent.name != '.local':
    raise SystemExit('Private output must be .local/source-workspace.json')
skills, roles, manifest = [], [], []
def text(v): return '' if v is None else str(v).strip()
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
catalogue = root / 'DEKRA_Extended_Skill_Catalogue_Candidate.xlsx'
w = openpyxl.load_workbook(catalogue, read_only=True, data_only=True)
sheet = w['Canonical catalogue']
for rownum, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), 2):
    if not row[0]: continue
    s={'id':text(row[0]),'name':text(row[1]),'category':text(row[2]),'family':text(row[3]),'group':text(row[4]),'definition':text(row[6]),'anchors':[text(v) for v in row[7:11]],'status':'proposed','sourceStatus':text(row[22]),'sourceRef':f'{catalogue.name} / Canonical catalogue!A{rownum}:Z{rownum}','relatedCompetencies':[text(v) for v in row[13:16] if v],'futureRelevance':text(row[17])}
    s['identityHash']=hashlib.sha256(json.dumps({k:s[k] for k in ['id','name','definition','anchors']},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    skills.append(s)
manifest.append({'name':catalogue.name,'sha256':digest(catalogue),'rows':len(skills),'classification':'internal','sheet':'Canonical catalogue','adoption':'Existing proposed statuses preserved; no new approval'})
comp=root/'DEKRA_CFC_38_Competencies_FIN_20261311.csv'
with comp.open(encoding='utf-8-sig',newline='') as f: rows=list(csv.reader(f,delimiter=';'))
for rownum,row in enumerate(rows,1):
    if len(row)<11 or not row[2].startswith('CFC-'):continue
    s={'id':row[2],'name':row[3],'category':'Behavioural','family':row[0],'group':row[1],'definition':row[4],'anchors':row[5:9],'status':'reference','sourceStatus':row[9],'sourceRef':f'{comp.name} / row {rownum}','relatedCompetencies':[]}
    s['identityHash']=hashlib.sha256(json.dumps({k:s[k] for k in ['id','name','definition','anchors']},sort_keys=True,ensure_ascii=False).encode()).hexdigest();skills.append(s)
manifest.append({'name':comp.name,'sha256':digest(comp),'rows':sum(s['id'].startswith('CFC-') for s in skills),'classification':'internal','adoption':'Confirmed source labels retained separately; no simulated CoE approval'})
for group,name in [('G1','Group 1 - Final Job Catalogue_v2.xlsx'),('G2','Group 2 - Final Job Catalogue_v1.xlsx')]:
    p=root/name;w=openpyxl.load_workbook(p,read_only=True,data_only=True);sheet=w.worksheets[0];count=0
    for rownum,row in enumerate(sheet.iter_rows(min_row=2,values_only=True),2):
        if len(row)<14 or not row[9] or not row[10]:continue
        roles.append({'id':f'{group}-{rownum}','title':text(row[9]),'family':text(row[0]),'group':group,'purpose':text(row[10]),'knowledge':text(row[11]),'problemSolving':text(row[12]),'accountability':text(row[13]),'sourceRef':f'{name} / {sheet.title}!J{rownum}:N{rownum}','sourceHash':digest(p),'version':1,'status':'source_reference'});count+=1
    manifest.append({'name':name,'sha256':digest(p),'rows':count,'classification':'internal','sheet':sheet.title})
assert len(skills)==1012, f'Unexpected reference count: {len(skills)}'
assert len({s['id'] for s in skills})==len(skills), 'Duplicate skill IDs'
assert len(roles)==825, f'Expected 825 populated JRD rows, found {len(roles)}'
assert len({r['id'] for r in roles})==825
workspace={'schemaVersion':1,'revision':1,'skills':skills,'roles':roles,'cases':[],'runs':[],'audit':[],'sourceManifest':manifest,'mode':'pilot','governanceMode':'coe_final','identityVerified':False}
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(workspace,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'skills':974,'competencies':38,'roles':len(roles),'sources':manifest,'privateOutput':str(output)},ensure_ascii=True))
