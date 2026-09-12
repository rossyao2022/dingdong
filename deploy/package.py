#!/usr/bin/env python3
"""Archive only committed runtime files, and record their exact Git revision."""
import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
version = (root / 'VERSION').read_text().strip()
def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args]).decode().strip()
branch = git('branch', '--show-current')
if branch != f'codex/release-v{version}':
    raise SystemExit('Branch and VERSION mismatch')
paths = ['VERSION', '.dockerignore', 'backend', 'frontend', 'deploy']
if git('status', '--porcelain', '--', *paths):
    raise SystemExit('Commit release files before packaging')
revision = git('rev-parse', 'HEAD')
out = root / 'dist'
out.mkdir(exist_ok=True)
archive = out / f'dingdong-v{version}.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    names = git('ls-files', '--', *paths).splitlines()
    for name in names:
        if '/docs/' in name or name.startswith('deploy/evidence/'):
            continue
        tar.add(root / name, arcname=f'dingdong-v{version}/{name}', recursive=False)
    data = json.dumps({'version': version, 'branch': branch, 'commit': revision}, indent=2).encode()
    info = tarfile.TarInfo(f'dingdong-v{version}/RELEASE.json')
    info.size = len(data)
    tar.addfile(info, io.BytesIO(data))
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix(archive.suffix + '.sha256').write_text(f'{checksum}  {archive.name}\n')
print(archive)
