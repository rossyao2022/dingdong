from pathlib import Path

for path in ['/opt/dingdong', '/app', '/var/run/docker.sock', '/root/.ssh']:
    assert not Path(path).exists(), path
for path in ['/host-status/deny-test', '/usr/local/deny-test']:
    try:
        Path(path).write_text('denied')
    except OSError:
        pass
    else:
        raise AssertionError('Unexpected write allowed: ' + path)
print('BOUNDARY_OK')
