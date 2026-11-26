// 방장 신원 증명 — 방 id(`PREFIX+방코드`)는 방장이 사라지면 누구나 재등록할 수 있다(공용 시그널링 실측 50/50).
// 방장이 ECDSA P-256 키쌍을 만들고, 게스트는 첫 접속 때 공개키를 기억(pin)한다. 이후 재접속(새로고침·재호스팅·새 탭)마다
// 게스트가 보낸 nonce에 방장이 서명하고, 게스트는 pin과 같은 키의 유효한 서명일 때만 참가 토큰을 보낸다.
// 한계: 첫 접속은 pin할 대상이 없어 TOFU(처음 본 키를 신뢰)다. 방장이 이미 사라진 방에 처음 들어오는 사람은 구분할 수 없다.

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIG = { name: 'ECDSA', hash: 'SHA-256' };

const b64 = buf => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => {
  const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
const message = (roomId, nonce) => enc.encode(`mc-host-proof|${roomId}|${nonce}`);

/** 새 키쌍 → { pub, priv } (JWK). 방장이 방 생성 때 한 번 만든다 */
export async function generateHostKey() {
  const kp = await subtle().generateKey(ALG, true, ['sign', 'verify']);
  const [pub, priv] = await Promise.all([subtle().exportKey('jwk', kp.publicKey), subtle().exportKey('jwk', kp.privateKey)]);
  return { pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, priv };
}

/** nonce에 서명 (방 코드를 함께 서명해 다른 방의 서명 재사용을 막는다) */
export async function signProof(priv, roomId, nonce) {
  const key = await subtle().importKey('jwk', priv, ALG, false, ['sign']);
  return b64(await subtle().sign(SIG, key, message(roomId, nonce)));
}

const validPub = p => p && p.kty === 'EC' && p.crv === 'P-256' && typeof p.x === 'string' && typeof p.y === 'string' && p.x.length < 100 && p.y.length < 100;

/** 서명 검증. 잘못된 형식·검증 예외는 모두 false */
export async function verifyProof(pub, roomId, nonce, sig) {
  try {
    if (!validPub(pub) || typeof sig !== 'string' || sig.length > 200) return false;
    const key = await subtle().importKey('jwk', { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, ALG, false, ['verify']);
    return await subtle().verify(SIG, key, unb64(sig), message(roomId, nonce));
  } catch { return false; }
}

export const samePub = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.crv === b.crv && a.kty === b.kty;
export const isValidPub = validPub;
