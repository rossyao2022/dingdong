import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRequestId } from '../api.js';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('HTTP origin without randomUUID still generates distinct RFC 4122 v4 request IDs', () => {
  const httpCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  const ids = Array.from({ length: 100 }, () => createRequestId(httpCrypto));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, uuidV4);
});

test('secure contexts can use the native crypto implementation', () => {
  assert.match(createRequestId(webcrypto), uuidV4);
});

test('missing cryptographic randomness does not silently generate weak IDs', () => {
  assert.throws(() => createRequestId({}));
});
