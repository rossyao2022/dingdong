from pathlib import Path
from urllib.parse import urljoin,urlparse,urldefrag
from urllib.request import Request,urlopen
from html.parser import HTMLParser
import json,re,hashlib,concurrent.futures
root=Path('材料/网页/站点快照');root.mkdir(parents=True,exist_ok=True)
class Links(HTMLParser):
 def __init__(self):super().__init__();self.urls=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  for k in (['src'] if t in ('img','script','iframe','source') else ['href'] if t in ('a','link') else []):
   if a.get(k):self.urls.append((t,a[k]))
queue=['http://happykua.com/CareerAcademy.html','http://happykua.com/TalentRadar/index.html'];seen=set();results=[];assets=set()
while queue:
 url=queue.pop(0)
 if url in seen:continue
 seen.add(url)
 try:
  with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as r:b=r.read();status=r.status
  p=root/urlparse(url).path.lstrip('/');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);results.append({'url':url,'path':str(p),'bytes':len(b),'status':status})
  t=b.decode('utf-8','replace');h=Links();h.feed(t)
  for tag,v in h.urls:
   u=urldefrag(urljoin(url,v))[0];z=urlparse(u)
   if z.scheme not in ('http','https'):continue
   if tag=='a':
    if z.netloc=='happykua.com' and z.path.startswith('/TalentRadar/') and z.path.endswith('.html') and u not in seen:queue.append(u)
   else:assets.add(u)
  for v in re.findall(r'url\([\'\"]?([^\)\'\"]+)',t):assets.add(urljoin(url,v))
 except Exception as e:results.append({'url':url,'error':str(e)})
def getasset(u):
 z=urlparse(u)
 if z.scheme not in ('http','https'):return {'url':u,'status':'not_http'}
 p=root/z.path.lstrip('/') if z.netloc=='happykua.com' else root/'外部资源'/(hashlib.sha256(u.encode()).hexdigest()[:12]+'_'+(Path(z.path).name or 'asset'))
 try:
  with urlopen(Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:b=r.read();ct=r.headers.get('Content-Type');status=r.status
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);return {'url':u,'path':str(p),'bytes':len(b),'status':status,'content_type':ct}
 except Exception as e:return {'url':u,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:results.extend(ex.map(getasset,sorted(assets)))
Path('材料/原始数据/网页归档清单.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False,indent=2))
