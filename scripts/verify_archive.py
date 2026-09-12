from pathlib import Path
import json,re,hashlib,zipfile,openpyxl,warnings
warnings.simplefilter('ignore',UserWarning)
root=Path(__file__).resolve().parent.parent
p=root/'材料';source=json.loads((p/'原始数据/主文档.json').read_text());content=source['data']['document']['content'];attachments=[]
for name,size,token in re.findall(r'<source name="([^"]+)".*?size="(\d+)" token="([^"]+)"',content):
 f=p/'附件'/name
 with zipfile.ZipFile(f) as z:assert z.testzip() is None
 assert f.stat().st_size==int(size)
 attachments.append({'name':name,'bytes':f.stat().st_size,'source_bytes':int(size),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'token':token})
ws={}
for f in (p/'附件').glob('*.xlsx'):
 w=openpyxl.load_workbook(f,data_only=False);ws[f.name]=[{'name':s.title,'rows':s.max_row,'columns':s.max_column,'state':s.sheet_state} for s in w]
files=[]
for f in sorted(p.rglob('*')):
 if f.is_file() and f.name!='归档校验.json':files.append({'path':str(f.relative_to(root)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
out={'date':'2026-09-09','source':'https://fdugaoqiqi.feishu.cn/wiki/QE9rwIMlUiCc88kXQn4cmZmon4g','attachments':attachments,'workbooks':ws,'files':files}
(p/'原始数据/归档校验.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({'attachments_verified':len(attachments),'worksheets':sum(len(x) for x in ws.values()),'files_hashed':len(files),'bytes':sum(x['bytes'] for x in files)},ensure_ascii=False))
