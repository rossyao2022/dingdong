#!/usr/bin/python3
"""Read process metadata only. Never read cmdline, environ or business files."""
import json, os, datetime
from pathlib import Path
rows=[]
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit(): continue
    try:
        status={line.split(':',1)[0]:line.split(':',1)[1].strip() for line in (proc/'status').read_text().splitlines() if ':' in line}
        rows.append({'pid':int(proc.name),'ppid':int(status['PPid']),'uid':int(status['Uid'].split()[0]),'name':status['Name'],'state':status['State']})
    except (OSError, KeyError, ValueError): continue
out=Path('/opt/remote-desktop-commander/host-status/processes.json')
tmp=out.with_suffix('.tmp')
tmp.write_text(json.dumps({'scope':'host process names and states only; no command arguments or environment','updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'processes':sorted(rows,key=lambda p:p['pid'])},indent=2)+'\n')
os.chmod(tmp,0o644)
os.replace(tmp,out)
