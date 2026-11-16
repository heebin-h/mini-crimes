import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeartbeat, HEARTBEAT } from '../src/net/heartbeat.js';

// 가짜 시계: advance(ms)가 intervalMs 단위로 틱을 실행한다
function rig(opts = {}) {
  let t = 0;
  let fn = null;
  const pings = [];
  let timeouts = 0;
  const hb = createHeartbeat({
    now: () => t,
    setTimer: f => { fn = f; return 1; },
    clearTimer: () => { fn = null; },
    sendPing: opts.noPing ? undefined : () => pings.push(t),
    onTimeout: () => { timeouts++; },
  });
  const run = ms => { const end = t + ms; while (t < end && fn) { t += HEARTBEAT.intervalMs; fn(); } };
  const jump = ms => { t += ms; fn?.(); }; // 타이머 정지 후 한 번에 재개
  return { hb, run, jump, pings, get timeouts() { return timeouts; }, setNow: v => { t = v; } };
}

test('응답이 계속 오면 timeout 없음, 간격마다 ping', () => {
  const r = rig();
  r.hb.start();
  for (let i = 0; i < 10; i++) { r.run(HEARTBEAT.intervalMs); r.hb.touch(); }
  assert.equal(r.timeouts, 0);
  assert.equal(r.pings.length, 10);
});

test('침묵이 timeoutMs를 넘으면 정확히 한 번 timeout 후 정지', () => {
  const r = rig();
  r.hb.start();
  r.run(HEARTBEAT.timeoutMs);      // 15s: 아직 경계
  assert.equal(r.timeouts, 0);
  r.run(HEARTBEAT.intervalMs);     // 20s: 초과
  assert.equal(r.timeouts, 1);
  assert.equal(r.hb.running, false);
  r.run(60_000);
  assert.equal(r.timeouts, 1, '정지 후 재발화 없음');
});

test('방장 측(ping 없음)도 감시만 수행', () => {
  const r = rig({ noPing: true });
  r.hb.start();
  r.run(HEARTBEAT.timeoutMs + HEARTBEAT.intervalMs);
  assert.equal(r.timeouts, 1);
  assert.equal(r.pings.length, 0);
});

test('타이머가 오래 멈췄다 재개돼도(백그라운드 탭) 오탐하지 않음', () => {
  const r = rig();
  r.hb.start();
  r.jump(5 * 60_000); // 5분간 틱 없음 후 첫 틱
  assert.equal(r.timeouts, 0, '정지 구간은 침묵으로 치지 않는다');
  // 재개 후에도 실제 침묵이면 정상 감지
  r.run(HEARTBEAT.timeoutMs + HEARTBEAT.intervalMs);
  assert.equal(r.timeouts, 1);
});

test('stop 후 start 가능, onTimeout 예외는 삼킴', () => {
  let t = 0; let fn;
  const hb = createHeartbeat({ now: () => t, setTimer: f => { fn = f; return 1; }, clearTimer: () => { fn = null; }, onTimeout: () => { throw new Error('boom'); } });
  hb.start(); hb.stop(); assert.equal(hb.running, false);
  hb.start();
  for (let i = 0; i < 5; i++) { t += HEARTBEAT.intervalMs; fn?.(); }
  assert.equal(hb.running, false); // timeout 처리됨(예외 없이)
});
