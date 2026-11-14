// P2P(WebRTC·PeerJS) 전송 계층 — 이전 socket.io-client와 같은 API를 제공한다.
//   on / off / emit(ev, payload, ack) / timeout(ms).emit / connect(roomIdHint) / leave / id / connected
//
// 구조
// - 방장: 브라우저가 고정 peer id(`${PREFIX}${방코드}`)로 등록하고 hostRoom(방 로직)을 실행한다.
// - 게스트: 임의 peer id로 등록 후 방장에게 DataConnection으로 연결, 요청은 {t:'req'}, 응답은 {t:'ack'}, 방송은 {t:'ev'}.
// - 시그널링(최초 연결 중개)은 PeerJS 서버(기본: 공용 0.peerjs.com)를 쓴다. 자체 서버 없음.
// - 새로고침 복구: 세션(sessionStorage)에 역할·방 코드·이름 저장. 게스트는 재접속 후 이름으로 복귀,
//   방장은 저장된 방 상태로 같은 peer id에 재등록한다.

import Peer from 'peerjs';
import { createHostRoom } from './hostRoom.js';
import { getCase } from '../data/cases.js';
import { loadCaseAnswer } from '../game/grading.js';

const env = import.meta.env ?? {};
export const PEER_PREFIX = env.VITE_PEER_PREFIX || 'mini-crimes-v1-';
const SESSION_KEY = 'mc:session';
const HOST_SNAPSHOT_KEY = 'mc:hostRoom';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자(0/O, 1/I) 제외
const CODE_LEN = 6;
const T = {
  peerOpen: 10_000,      // 시그널링 서버 등록 대기
  connOpen: 8_000,       // 방장 연결 대기
  reconnectWindow: 20_000, // 게스트: 방장 재연결 시도 기간 (방장 새로고침 재등록은 실측 ~1초, room:get 대기 25초보다 짧게)
  rehostWindow: 20_000,  // 방장: 새로고침 후 같은 id 재등록 시도 기간 (이전 등록 해제 대기)
  retryGap: 1_500,
};

// PeerJS 서버 설정 — 기본은 공용 서버. 자체 PeerServer를 쓰려면 VITE_PEER_HOST 등을 지정.
function peerOptions() {
  const o = { debug: 1 };
  if (env.VITE_PEER_HOST) {
    o.host = env.VITE_PEER_HOST;
    if (env.VITE_PEER_PORT) o.port = Number(env.VITE_PEER_PORT);
    if (env.VITE_PEER_PATH) o.path = env.VITE_PEER_PATH;
    o.secure = env.VITE_PEER_SECURE !== 'false';
  }
  return o;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const genCode = () => Array.from({ length: CODE_LEN }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장소 차단 — 새로고침 복구만 불가 */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* noop */ } },
};

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    // open 후에는 error 리스너를 반드시 해제 — 남아 있으면 이후 첫 오류(시그널링 일시 끊김 'network',
    // 재연결 중 'peer-unavailable')에 peer가 destroy되어 방·게스트 연결이 통째로 죽는다
    const onOpen = () => { clearTimeout(timer); peer.off('error', onErr); resolve(peer); };
    const onErr = e => { clearTimeout(timer); peer.off('open', onOpen); peer.destroy(); reject(e); };
    const timer = setTimeout(() => {
      peer.off('open', onOpen); peer.off('error', onErr); peer.destroy();
      reject(Object.assign(new Error('peer open timeout'), { type: 'timeout' }));
    }, T.peerOpen);
    peer.once('open', onOpen);
    peer.once('error', onErr);
  });
}

function openConn(peer, targetId) {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(targetId, { reliable: true, serialization: 'json' });
    // peer가 disconnected/destroyed면 PeerJS가 undefined를 반환한다
    if (!conn) return reject(Object.assign(new Error('peer disconnected'), { type: 'disconnected' }));
    const cleanup = () => { clearTimeout(timer); peer.off('error', onPeerErr); };
    const timer = setTimeout(() => { cleanup(); conn.close(); reject(Object.assign(new Error('conn timeout'), { type: 'timeout' })); }, T.connOpen);
    // 대상 peer가 없으면 DataConnection이 아니라 Peer에 'peer-unavailable' 오류가 온다
    const onPeerErr = e => { if (e.type === 'peer-unavailable') { cleanup(); reject(e); } };
    peer.on('error', onPeerErr);
    conn.once('open', () => { cleanup(); resolve(conn); });
    conn.once('error', e => { cleanup(); reject(e); });
  });
}

class P2PSocket {
  constructor() {
    this.listeners = new Map();
    this._reset();
    // 페이지를 떠날 때(닫기·새로고침) 상대에게 즉시 알림 — WebRTC 연결 종료 감지는 수십 초 걸릴 수 있다
    globalThis.addEventListener?.('pagehide', () => this._bye());
  }

  _reset() {
    this.mode = null;          // null | 'host' | 'guest'
    this.peer = null;
    this.id = undefined;
    this.connected = false;
    this.host = null;          // hostRoom (방장)
    this.conns = new Map();    // 방장: peerId → DataConnection
    this.conn = null;          // 게스트: 방장 연결
    this.pending = new Map();  // 게스트: ack 대기 { ev, p, ack } — 끊기면 재연결 후 재전송
    this.queue = [];           // 연결·복구 중 보낸 이벤트 (socket.io 버퍼링과 동일)
    this.seq = 0;
    this._reconnecting = false;
    this.epoch = (this.epoch ?? 0) + 1; // leave 이후 늦게 끝난 비동기 작업 무시용
  }

  // ── 이벤트 구독 ─────────────────────────────
  on(ev, fn) { if (!this.listeners.has(ev)) this.listeners.set(ev, new Set()); this.listeners.get(ev).add(fn); return this; }
  off(ev, fn) { this.listeners.get(ev)?.delete(fn); return this; }
  _local(ev, data) {
    for (const fn of [...(this.listeners.get(ev) ?? [])]) {
      try { fn(data); } catch (e) { console.error(`[p2p] listener ${ev} error`, e); }
    }
  }
  _deliver(ev, data) { queueMicrotask(() => this._local(ev, data)); }

  timeout(ms) {
    return {
      emit: (ev, payload, cb) => {
        if (typeof payload === 'function') { cb = payload; payload = undefined; }
        let done = false;
        const t = setTimeout(() => { if (!done) { done = true; cb(new Error('timeout')); } }, ms);
        this.emit(ev, payload, res => { if (done) return; done = true; clearTimeout(t); cb(null, res); });
      },
    };
  }

  // ── 송신 ─────────────────────────────────
  emit(ev, payload, ack) {
    if (typeof payload === 'function') { ack = payload; payload = undefined; }
    if (ev === 'room:create') return void this._startHost(payload ?? {}, ack);
    if (ev === 'room:join') return void this._startGuest(payload ?? {}, ack, false);
    if (this.mode === 'host' && this.connected) {
      return this.host.handle(this.id, ev, payload, ack ? r => queueMicrotask(() => ack(r)) : undefined);
    }
    if (this.mode === 'guest' && this.connected && this.conn?.open) return this._send(ev, payload, ack);
    if (this.mode) { this.queue.push([ev, payload, ack]); return; }
    ack?.({ ok: false, error: 'NOT_CONNECTED' });
  }

  _send(ev, payload, ack) {
    const msg = { t: 'req', ev, p: payload ?? null };
    if (ack) { msg.id = ++this.seq; this.pending.set(msg.id, { ev, p: payload, ack }); }
    try { this.conn.send(msg); } catch (e) {
      console.warn('[p2p] send failed', ev, e);
      if (ack) { this.pending.delete(msg.id); ack({ ok: false, error: 'SEND_FAILED' }); }
    }
  }

  _flush() {
    const q = this.queue; this.queue = [];
    for (const [ev, p, ack] of q) this.emit(ev, p, ack);
  }

  // ── 방장 ─────────────────────────────────
  async _startHost({ caseId, playerName }, ack) {
    this.leave();
    const epoch = this.epoch;
    let peer = null; let code = null;
    for (let i = 0; i < 5 && !peer; i++) {
      code = genCode();
      try { peer = await openPeer(PEER_PREFIX + code); } catch (e) {
        if (e.type !== 'unavailable-id') { console.error('[p2p] host open failed', e.type, e); break; }
      }
    }
    if (epoch !== this.epoch) { peer?.destroy(); return; }
    if (!peer) return ack?.({ ok: false, error: 'P2P_UNAVAILABLE' });

    this._becomeHost(peer);
    this.host.handle(this.id, 'room:create', { roomId: code, caseId, playerName }, res => {
      if (!res?.ok) { this.leave(); return ack?.(res); }
      ss.set(SESSION_KEY, { mode: 'host', roomId: code, playerName });
      this._local('connect');
      ack?.({ ok: true, roomId: code });
    });
  }

  _becomeHost(peer) {
    this.mode = 'host';
    this.peer = peer;
    this.id = peer.id;
    this.connected = true;
    this.host = createHostRoom({
      getCase,
      loadAnswer: loadCaseAnswer,
      send: (pid, ev, p) => this._hostSend(pid, ev, p),
      broadcast: (ev, p, except) => { for (const pid of this.host.members()) if (pid !== except) this._hostSend(pid, ev, p); },
      onChange: () => ss.set(HOST_SNAPSHOT_KEY, this.host?.snapshot()),
    });
    peer.on('connection', conn => {
      conn.on('data', msg => this._onHostData(conn, msg));
      conn.on('close', () => {
        if (this.conns.get(conn.peer) !== conn) return;
        this.conns.delete(conn.peer);
        this.host?.peerDisconnected(conn.peer);
      });
      conn.on('error', e => console.warn('[p2p] guest conn error', conn.peer, e));
    });
    this._watchSignaling(peer);
    peer.on('error', e => console.warn('[p2p] host peer error', e.type));
  }

  // 시그널링 서버 연결만 끊긴 경우 재등록 — 지수 백오프(즉시 재시도 반복 방지). 데이터 연결은 유지된다
  _watchSignaling(peer) {
    let n = 0;
    peer.on('open', () => { n = 0; });
    peer.on('disconnected', () => {
      const d = Math.min(30_000, 1000 * 2 ** n++);
      setTimeout(() => { if (this.peer === peer && !peer.destroyed && peer.disconnected) peer.reconnect(); }, d);
    });
  }

  _hostSend(pid, ev, p) {
    if (pid === this.id) return this._deliver(ev, p);
    const c = this.conns.get(pid);
    if (c?.open) { try { c.send({ t: 'ev', ev, p }); } catch (e) { console.warn('[p2p] host send failed', pid, ev, e); } }
  }

  _onHostData(conn, msg) {
    if (msg?.t === 'bye') { // 게스트가 페이지를 떠남 — 연결 종료 감지를 기다리지 않고 유예 시작
      if (this.conns.get(conn.peer) === conn) { this.conns.delete(conn.peer); this.host?.peerDisconnected(conn.peer); }
      return;
    }
    if (!msg || msg.t !== 'req' || typeof msg.ev !== 'string') return;
    // room:create는 방장 로컬 전용 — 게스트가 보내면 방을 덮어쓰고 방장 권한을 가져갈 수 있다
    if (msg.ev === 'room:create') return;
    this.conns.set(conn.peer, conn);
    const reply = msg.id != null ? r => { if (conn.open) conn.send({ t: 'ack', id: msg.id, r }); } : undefined;
    this.host.handle(conn.peer, msg.ev, msg.p, reply);
  }

  async _rehost(s) {
    const snap = ss.get(HOST_SNAPSHOT_KEY);
    if (!snap || snap.roomId !== s.roomId) return this._lost('HOST_STATE_MISSING');
    this.mode = 'host'; // 복구 중 보낸 이벤트는 큐에 쌓인다
    const epoch = this.epoch;
    const until = Date.now() + T.rehostWindow;
    while (Date.now() < until) {
      try {
        const peer = await openPeer(PEER_PREFIX + s.roomId);
        if (epoch !== this.epoch) { peer.destroy(); return; }
        this._becomeHost(peer);
        if (!this.host.restore(snap, peer.id)) return this._lost('HOST_STATE_INVALID');
        this._local('connect');
        this._flush();
        return;
      } catch (e) {
        if (epoch !== this.epoch) return;
        if (e.type !== 'unavailable-id') console.warn('[p2p] rehost failed', e.type);
        await sleep(T.retryGap); // 이전 등록이 시그널링 서버에서 해제될 때까지 대기
      }
    }
    this._lost('REHOST_FAILED');
  }

  // ── 게스트 ─────────────────────────────────
  async _startGuest({ roomId, playerName }, ack, isRestore) {
    if (!isRestore) this.leave();
    const code = String(roomId ?? '').trim().toUpperCase();
    this.mode = 'guest';
    const epoch = this.epoch;
    const fail = error => {
      if (epoch !== this.epoch) return;
      this.leave();
      ack?.({ ok: false, error });
    };
    let peer;
    try { peer = await openPeer(); } catch (e) { console.error('[p2p] guest open failed', e.type); return fail('P2P_UNAVAILABLE'); }
    if (epoch !== this.epoch) return peer.destroy();
    this.peer = peer;
    this.id = peer.id;
    this._watchSignaling(peer);
    peer.on('error', e => { if (e.type !== 'peer-unavailable') console.warn('[p2p] guest peer error', e.type); });

    let conn;
    try { conn = await openConn(peer, PEER_PREFIX + code); } catch (e) {
      return fail(e.type === 'peer-unavailable' ? 'ROOM_NOT_FOUND' : 'CONNECT_TIMEOUT');
    }
    if (epoch !== this.epoch) return conn.close();
    this._attachGuestConn(conn, code, playerName);

    this._send('room:join', { roomId: code, playerName }, res => {
      if (epoch !== this.epoch) return;
      if (!res?.ok) { this.leave(); return ack?.(res ?? { ok: false, error: 'JOIN_FAILED' }); }
      ss.set(SESSION_KEY, { mode: 'guest', roomId: code, playerName });
      this.connected = true;
      this._local('connect');
      this._flush();
      ack?.(res);
    });
  }

  _attachGuestConn(conn, code, playerName) {
    // connected는 room:join 승인 후에 세운다 — 그 전 화면 이벤트는 큐로 가서 끊긴 동안의 이벤트 뒤에 순서대로 전송
    this.conn = conn;
    conn.on('data', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'ev' && typeof msg.ev === 'string') this._deliver(msg.ev, msg.p);
      else if (msg.t === 'ack') { const pd = this.pending.get(msg.id); this.pending.delete(msg.id); pd?.ack(msg.r); }
      else if (msg.t === 'bye') onClosed(); // 방장이 페이지를 떠남(새로고침이면 곧 재호스팅) — 즉시 재연결 시작
    });
    let closed = false;
    const onClosed = () => {
      if (closed || this.conn !== conn) return; // leave()·교체로 닫힌 연결
      closed = true;
      this.connected = false;
      // 응답 못 받은 요청은 재연결 후 다시 보낸다 (방장 새로고침 중 room:get 실패로 홈으로 튕기지 않게)
      for (const { ev, p, ack } of this.pending.values()) {
        // room:join은 재전송하면 _startGuest(leave 포함)가 다시 돌므로 실패로 돌려준다 — 재연결 루프가 재시도
        if (ev === 'room:join') ack({ ok: false, error: 'DISCONNECTED' });
        else this.queue.push([ev, p, ack]);
      }
      this.pending.clear();
      try { conn.close(); } catch { /* noop */ }
      this._reconnectGuest(code, playerName);
    };
    conn.on('close', onClosed);
  }

  async _reconnectGuest(code, playerName) {
    if (this._reconnecting) return; // 재연결 중 다시 끊겨도 루프를 겹쳐 돌리지 않는다
    this._reconnecting = true;
    const epoch = this.epoch;
    try {
      const until = Date.now() + T.reconnectWindow;
      while (Date.now() < until) {
        await sleep(T.retryGap);
        if (epoch !== this.epoch) return;
        try {
          if (this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
          const conn = await openConn(this.peer, PEER_PREFIX + code);
          if (epoch !== this.epoch) return conn.close();
          this._attachGuestConn(conn, code, playerName);
          const res = await new Promise(r => this._send('room:join', { roomId: code, playerName }, r));
          if (epoch !== this.epoch) return;
          if (res?.error === 'DISCONNECTED' || res?.error === 'SEND_FAILED') continue; // join 중 다시 끊김 — 재시도
          if (res?.ok) { this.connected = true; this._local('connect'); this._flush(); return; }
          return this._lost(res?.error ?? 'JOIN_FAILED'); // 방은 있으나 복귀 거부(진행 중 신규 등)
        } catch { /* 방장 새로고침 중일 수 있음 — 재시도 */ }
      }
      if (epoch === this.epoch) this._lost('HOST_LOST');
    } finally {
      if (epoch === this.epoch) this._reconnecting = false;
    }
  }

  // ── 공통 ─────────────────────────────────
  /** 새로고침 후 페이지가 호출 — 세션이 URL의 방과 같을 때만 복구 */
  connect(roomIdHint) {
    if (this.mode) return;
    const s = ss.get(SESSION_KEY);
    if (!s?.roomId || (roomIdHint && s.roomId !== roomIdHint)) return;
    if (s.mode === 'host') this._rehost(s);
    else this._startGuest({ roomId: s.roomId, playerName: s.playerName }, null, true);
  }

  _lost(reason) {
    console.warn('[p2p] room lost:', reason);
    // 대기 중 요청은 조용히 버린다 — LEFT 응답이 화면의 '동기화 실패' 이동을 먼저 일으켜 이탈 안내를 덮지 않게
    this.queue = [];
    this.pending.clear();
    this.leave();
    this._local('host:lost', { reason });
  }

  _bye() {
    const targets = this.mode === 'host' ? [...this.conns.values()] : this.conn ? [this.conn] : [];
    for (const c of targets) { try { if (c.open) c.send({ t: 'bye' }); } catch { /* noop */ } }
  }

  /** 방 나가기(홈 이동 등). 방장이면 방이 종료된다. */
  leave() {
    this._bye();
    for (const [, , ack] of this.queue) ack?.({ ok: false, error: 'LEFT' });
    for (const { ack } of this.pending.values()) ack({ ok: false, error: 'LEFT' });
    const { peer, conn, conns, host } = this;
    this.conn = null; // close 핸들러가 재연결을 시작하지 않도록 먼저 해제
    this.conns = new Map();
    try { conn?.close(); } catch { /* noop */ }
    for (const c of conns.values()) { try { c.close(); } catch { /* noop */ } }
    host?.dispose();
    try { peer?.destroy(); } catch { /* noop */ }
    ss.del(SESSION_KEY);
    ss.del(HOST_SNAPSHOT_KEY);
    this._reset();
  }
}

export const socket = new P2PSocket();
