import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHostKey, signProof, verifyProof, samePub, isValidPub } from '../src/net/hostProof.js';

test('올바른 키·방·nonce의 서명은 검증된다', async () => {
  const k = await generateHostKey();
  const sig = await signProof(k.priv, 'ABC123', 'nonce-1');
  assert.equal(await verifyProof(k.pub, 'ABC123', 'nonce-1', sig), true);
});

test('다른 키(공격자)의 서명은 pin된 키로 검증되지 않는다', async () => {
  const host = await generateHostKey(); const evil = await generateHostKey();
  const sig = await signProof(evil.priv, 'ABC123', 'n');
  assert.equal(await verifyProof(host.pub, 'ABC123', 'n', sig), false);
  assert.equal(samePub(host.pub, evil.pub), false);
});

test('nonce·방 코드가 다르면 재사용된 서명도 거부(재전송 공격 차단)', async () => {
  const k = await generateHostKey();
  const sig = await signProof(k.priv, 'ABC123', 'n1');
  assert.equal(await verifyProof(k.pub, 'ABC123', 'n2', sig), false);
  assert.equal(await verifyProof(k.pub, 'ZZZ999', 'n1', sig), false);
});

test('형식이 깨진 입력은 예외 없이 false', async () => {
  const k = await generateHostKey();
  for (const [pub, sig] of [[null, 'x'], [{}, 'x'], [k.pub, ''], [k.pub, 123], [k.pub, '!!!'], [{ ...k.pub, crv: 'P-384' }, 'x'], [k.pub, 'A'.repeat(500)]]) {
    assert.equal(await verifyProof(pub, 'ABC123', 'n', sig), false);
  }
  assert.equal(isValidPub(k.pub), true);
  assert.equal(isValidPub({ kty: 'EC', crv: 'P-256', x: 1, y: 2 }), false);
});

test('내보낸 개인키(JWK)로 재호스팅 후에도 같은 pub으로 검증된다', async () => {
  const k = await generateHostKey();
  const restored = JSON.parse(JSON.stringify(k)); // sessionStorage 왕복
  const sig = await signProof(restored.priv, 'ABC123', 'n');
  assert.equal(await verifyProof(k.pub, 'ABC123', 'n', sig), true);
});
