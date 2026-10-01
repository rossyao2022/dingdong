import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: '/usr/local/bin/node',
  args: ['/opt/agent/node_modules/@wonderwhy-er/desktop-commander/dist/index.js', '--no-onboarding'],
  env: { HOME: '/state', PATH: '/usr/local/bin:/usr/bin:/bin', SHELL: '/bin/sh', DC_REMOTE_DEVICE: 'true', DESKTOP_COMMANDER_DISABLE_TELEMETRY: '1' },
  stderr: 'pipe',
});
const client = new Client({ name: 'restricted-production-install-verifier', version: '1.0.0' });
const result = { transport: 'local stdio on production container, not paired ChatGPT remote E2E', checks: {} };
const text = r => (r.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  assert.notEqual(r.isError, true, `${name}: ${text(r)}`);
  return r;
}
try {
  await client.connect(transport);
  result.tools_available = (await client.listTools()).tools.length;
  const file = '/workspace/rdc-install-test.txt';
  await call('write_file', { path: file, content: 'RDC_TEST_ALPHA\n', mode: 'rewrite' });
  result.checks.file_create = true;
  assert.match(text(await call('read_file', { path: file })), /RDC_TEST_ALPHA/);
  result.checks.file_read = true;
  await call('edit_block', { file_path: file, old_string: 'RDC_TEST_ALPHA', new_string: 'RDC_TEST_BETA', expected_replacements: 1 });
  assert.match(text(await call('read_file', { path: file })), /RDC_TEST_BETA/);
  result.checks.file_modify = true;
  const terminal = text(await call('start_process', { command: 'id; pwd; python3 --version; node --version; rg --version | head -1', timeout_ms: 10000 }));
  assert.match(terminal, /uid=10001/);
  assert.match(terminal, /Python 3/);
  assert.match(terminal, /v22\./);
  result.checks.nonroot_terminal = true;
  const processes = text(await call('list_processes', {}));
  assert.match(processes, /PID:/);
  assert.match(processes, /node/);
  result.checks.container_process_list = true;
  const host = text(await call('read_file', { path: '/host-status/processes.json', length: 1000 }));
  assert.match(host, /host process names and states only/);
  assert.match(host, /"pid"/);
  assert(!host.includes('cmdline'));
  result.checks.host_process_summary = true;
  const search = await call('start_search', { path: '/workspace', pattern: 'RDC_TEST_BETA', searchType: 'content', literalSearch: true, timeout_ms: 10000 });
  const match = text(search).match(/Session ID:\s*(\S+)/i);
  if (match) {
    let found = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 150));
      if (text(await call('get_more_search_results', { sessionId: match[1] })).includes('RDC_TEST_BETA')) { found = true; break; }
    }
    assert(found, 'search content missing');
    await call('stop_search', { sessionId: match[1] });
  } else assert.match(text(search), /RDC_TEST_BETA/);
  result.checks.real_search = true;
  const deny = await client.callTool({ name: 'read_file', arguments: { path: '/etc/passwd' } });
  assert.equal(deny.isError, true);
  result.checks.file_allowlist_denies_system_path = true;
  assert.match(text(await call('start_process', { command: 'python3 /opt/agent/boundary-test.py', timeout_ms: 10000 })), /BOUNDARY_OK/);
  result.checks.host_and_rootfs_boundaries = true;
  assert.match(text(await call('get_config', {})), /telemetryEnabled.*false/);
  result.checks.telemetry_off = true;
  result.success = true;
} catch (e) { result.success = false; result.failure = String(e); process.exitCode = 1; }
finally { await client.close(); }
console.log(JSON.stringify(result, null, 2));
