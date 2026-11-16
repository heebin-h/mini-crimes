// 연결 생존 감시 (순수 모듈 — node --test 대상).
// bye·close 이벤트 없이 끊긴 경우(전원 차단·Wi-Fi 단절 등)를 timeoutMs 안에 감지한다.
//
// - touch(): 상대로부터 어떤 메시지든 받을 때 호출
// - sendPing이 있으면 intervalMs마다 ping을 보낸다 (게스트 측). 없으면 감시만 한다 (방장 측)
// - 탭이 백그라운드로 가면 브라우저가 타이머를 수십 초~분 단위로 늦춘다. 틱 간격이 intervalMs*3을 넘으면
//   "우리가 멈췄던 것"으로 보고 lastSeen을 현재로 되돌려 오탐(정상 연결을 끊음)을 막는다.

export const HEARTBEAT = { intervalMs: 5_000, timeoutMs: 15_000 };

export function createHeartbeat({
  now = () => Date.now(),
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = t => clearInterval(t),
  intervalMs = HEARTBEAT.intervalMs,
  timeoutMs = HEARTBEAT.timeoutMs,
  sendPing,
  onTimeout,
}) {
  let timer = null;
  let lastSeen = 0;
  let lastTick = 0;
  let fired = false;

  function tick() {
    const t = now();
    if (t - lastTick > intervalMs * 3) lastSeen = t; // 타이머 정지(백그라운드 등) 후 재개 — 판정 보류
    lastTick = t;
    if (!fired && t - lastSeen > timeoutMs) {
      fired = true;
      stop();
      try { onTimeout?.(); } catch (e) { console.warn('[heartbeat] onTimeout error', e); }
      return;
    }
    if (sendPing) { try { sendPing(); } catch { /* 전송 실패는 timeout이 처리 */ } }
  }

  function start() {
    if (timer) return;
    lastSeen = lastTick = now();
    fired = false;
    timer = setTimer(tick, intervalMs);
  }

  function stop() {
    if (timer) { clearTimer(timer); timer = null; }
  }

  return { start, stop, touch() { lastSeen = now(); }, get running() { return timer !== null; } };
}
