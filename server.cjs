const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.json':'application/json; charset=utf-8', '.png':'image/png', '.md':'text/plain; charset=utf-8' };
http.createServer((req,res) => {
  let requestUrl, pathname;
  try { requestUrl = new URL(req.url,'http://localhost'); pathname = decodeURIComponent(requestUrl.pathname); } catch {res.writeHead(400).end();return;}
  if(/^\/(dingdong|TalentRadar)$/.test(pathname)){res.writeHead(308,{'Location':pathname+'/'+requestUrl.search}).end();return;}
  pathname = pathname.replace(/^\/(dingdong|TalentRadar)(?=\/|$)/,'');
  if(pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({code:50301,message:'Backend is not configured'}));return;}
  const file = path.resolve(root,'.'+(pathname === '/' || !pathname ? '/index.html' : pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});
}).listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('DingDong preview: http://127.0.0.1:'+(Number(process.env.PORT)||4173)+'/dingdong/'));
