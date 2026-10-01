"""Read-only checks. No credentials, business rows or command arguments printed."""
import json,subprocess,hashlib
from pathlib import Path
root=Path('/opt/remote-desktop-commander')
def cmd(*args):return subprocess.check_output(args,text=True).strip()
container=json.loads(cmd('docker','inspect','remote-desktop-commander'))[0]
h=container['HostConfig']
assert container['State']['Running'], 'agent container not running'
current=json.loads(cmd('docker','inspect',*[x['id'] for x in json.loads((root/'install/business-baseline.json').read_text())]))
baseline={x['id']:x for x in json.loads((root/'install/business-baseline.json').read_text())}
unchanged=all(x['Image']==baseline[x['Id']]['image'] and x['State']['StartedAt']==baseline[x['Id']]['started_at'] and x['State']['Running'] for x in current)
assert unchanged,'business container changed'
assert container['Config']['User']=='10001:10001'
assert h['ReadonlyRootfs'] and not h['Privileged'] and h['CapDrop']==['ALL']
assert 'no-new-privileges=true' in h['SecurityOpt']
assert h['NetworkMode']=='bridge' and not h.get('PidMode') and not h.get('PortBindings')
assert h['Memory']==536870912 and h['NanoCpus']==500000000 and h['PidsLimit']==128
mounts=[{'source':x['Source'],'target':x['Destination'],'writable':x['RW']} for x in container['Mounts']]
assert {x['target'] for x in mounts}=={'/workspace','/state','/host-status'}
assert {x['source'] for x in mounts}=={str(root/'workspace'),str(root/'state'),str(root/'host-status')}
assert not next(x for x in mounts if x['target']=='/host-status')['writable']
assert (root/'state').stat().st_mode&0o777==0o700
device_file=root/'state/.desktop-commander-device/device.json'
if device_file.exists(): assert device_file.stat().st_mode&0o777==0o600
ufw=cmd('ufw','status');assert 'Status: active' in ufw
print(json.dumps({'service_active':cmd('systemctl','is-active','remote-desktop-commander.service'),'autostart':cmd('systemctl','is-enabled','remote-desktop-commander.service'),'host_status_timer':cmd('systemctl','is-enabled','rdc-host-status.timer'),'container_image':container['Image'],'container_running':container['State']['Running'],'user':container['Config']['User'],'readonly_root':h['ReadonlyRootfs'],'privileged':h['Privileged'],'cap_drop':h['CapDrop'],'no_new_privileges':h['SecurityOpt'],'network_mode':h['NetworkMode'],'pid_mode':h['PidMode'],'published_ports':h['PortBindings'],'memory':h['Memory'],'cpus':h['NanoCpus']/1e9,'pids_limit':h['PidsLimit'],'mounts':mounts,'private_state_permissions':'0700','saved_device_credentials_present':(root/'state/.desktop-commander-device/device.json').exists(),'existing_business_containers_unchanged':unchanged,'nginx':cmd('systemctl','is-active','nginx'),'ssh':cmd('systemctl','is-active','ssh'),'firewall_status':ufw,'public_version':cmd('curl','-kfsS','--max-time','10','https://1.15.23.152/dingdong/version.txt')},indent=2))
