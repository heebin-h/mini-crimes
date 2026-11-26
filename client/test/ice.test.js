import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIceServers } from '../src/net/ice.js';

const quiet = () => {};

test('미지정·빈 값은 null (PeerJS 기본값 사용)', () => {
  assert.equal(parseIceServers(undefined, quiet), null);
  assert.equal(parseIceServers('', quiet), null);
});

test('유효한 RTCIceServer 배열은 그대로 반환', () => {
  const raw = JSON.stringify([{ urls: 'stun:a:3478' }, { urls: ['turn:b:3478'], username: 'u', credential: 'c' }]);
  assert.deepEqual(parseIceServers(raw, quiet), JSON.parse(raw));
});

test('잘못된 JSON·형식은 null + 로그', () => {
  const logs = [];
  const log = m => logs.push(m);
  for (const bad of ['{', '{}', '[]', '[1]', '[{"url":"x"}]', '[{"urls":[]}]', 'null']) {
    assert.equal(parseIceServers(bad, log), null, bad);
  }
  assert.equal(logs.length, 7);
});
