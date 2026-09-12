#!/usr/bin/env python3
"""Generate host-local secrets; never include .env in a release archive."""
import argparse
import secrets
from pathlib import Path
from urllib.parse import urlsplit

p = argparse.ArgumentParser()
p.add_argument('origin', help='Public origin, for example https://demo.example.com')
p.add_argument('--bind', default='127.0.0.1')
p.add_argument('--port', type=int, default=18080)
a = p.parse_args()
u = urlsplit(a.origin)
if u.scheme not in ('http', 'https') or not u.hostname or u.path or u.query or u.fragment or u.username or u.password:
    p.error('origin must be http(s)://hostname[:port] without a path')
if not 1 <= a.port <= 65535:
    p.error('invalid port')
root = Path(__file__).resolve().parent
with open(root / '.env', 'x', opener=lambda path, flags: __import__('os').open(path, flags, 0o600)) as f:
    f.write(f'APP_VERSION={(root.parent / "VERSION").read_text().strip()}\nPUBLIC_ORIGIN={a.origin}\nPUBLIC_SCHEME={u.scheme}\nBIND_ADDRESS={a.bind}\nHTTP_PORT={a.port}\n')
    for k in ['POSTGRES_PASSWORD', 'DJANGO_SECRET_KEY', 'JWT_SIGNING_KEY']:
        f.write(f'{k}={secrets.token_hex(32)}\n')
print('Created deploy/.env with mode 0600; existing files are never overwritten.')
