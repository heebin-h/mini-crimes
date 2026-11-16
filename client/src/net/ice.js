// ICE 서버 설정 파서 (순수 함수 — node --test 대상).
// 미지정이면 null → PeerJS 기본값(Google STUN + PeerJS 공용 TURN eu-0/us-0)이 적용된다.
// 지정하면 기본값을 대체한다(공용 TURN 포함 전부).
export function parseIceServers(raw, log = console.error) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const ok = Array.isArray(v) && v.length > 0
      && v.every(s => s && typeof s === 'object' && (typeof s.urls === 'string' || (Array.isArray(s.urls) && s.urls.length > 0)));
    if (!ok) throw new Error('RTCIceServer 배열이 아님');
    return v;
  } catch (e) {
    log(`[p2p] VITE_ICE_SERVERS 무시(PeerJS 기본값 사용): ${e.message}`);
    return null;
  }
}
