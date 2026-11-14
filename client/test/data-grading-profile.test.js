// 케이스 데이터 정합성 · 채점 · 로컬 프로필 저장소 — node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CASES, getCase, caseExists } from '../src/data/cases.js';
import answers from '../src/data/answers.js';
import { scoreAll, stampOf } from '../src/game/grading.js';
import { createProfileStore, HISTORY_MAX, NAME_MAX } from '../src/profile/store.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('케이스 데이터: 10건, 단서 10장, 선택지 4개, 정답 선택지 정확히 1개, 이미지 존재', () => {
  assert.equal(ALL_CASES.length, 10);
  for (const c of ALL_CASES) {
    assert.equal(c.clueCards.length, 10, c.id);
    assert.ok(c.warningCard?.hint, c.id);
    const a = answers[c.id];
    assert.ok(a, `${c.id} answer`);
    for (const q of ['suspect', 'weapon', 'motive']) {
      const opts = c.choices[q];
      assert.equal(opts.length, 4, `${c.id} ${q}`);
      assert.equal(opts.filter(o => o.text === a[q].text).length, 1, `${c.id} ${q} 정답 선택지`);
      assert.ok(opts.every(o => !('correct' in o)), `${c.id} ${q} 정답 표시 노출`);
    }
    for (const img of [c.sceneImage, c.thumbnail, c.warningCard.image, ...c.clueCards.map(x => x.image)]) {
      assert.ok(fs.existsSync(path.join(PUBLIC, img)), `${c.id} ${img}`);
    }
  }
  assert.equal(getCase('s1e01').id, 's1e01');
  assert.equal(getCase('nope'), null);
  assert.equal(caseExists('sp03'), true);
});

test('채점: 정확 일치, 비문자열·누락은 오답', () => {
  const a = answers.s1e01;
  const all = scoreAll({ suspect: a.suspect.text, weapon: a.weapon.text, motive: a.motive.text }, a);
  assert.ok(Object.values(all).every(v => v.correct));
  const bad = scoreAll({ suspect: a.suspect.text + ' ', weapon: 1 }, a);
  assert.deepEqual(Object.values(bad).map(v => v.correct), [false, false, false]);
  assert.equal(scoreAll(null, a).suspect.correct, false);
  assert.equal(stampOf(3, 3), 'SOLVED');
  assert.equal(stampOf(0, 3), 'FAILED');
  assert.equal(stampOf(2, 3), 'PARTIAL');
});

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}

test('프로필: 생성·중복·선택·삭제(전적 포함)', () => {
  const st = memStorage();
  const s = createProfileStore(st);
  assert.equal(s.createProfile('  ').error, 'NAME_REQUIRED');
  const a = s.createProfile('수사관A'.repeat(10)).profile;
  assert.equal(a.name.length, NAME_MAX);
  assert.equal(s.createProfile(a.name).error, 'NAME_EXISTS');
  const b = s.createProfile('B').profile;
  assert.equal(s.setCurrentProfile('nope'), false);
  assert.equal(s.setCurrentProfile(b.id), true);
  assert.equal(s.getCurrentProfile().id, b.id);
  s.addHistory(b.id, { caseId: 's1e01' });
  s.deleteProfile(b.id);
  assert.equal(s.getCurrentProfile(), null);
  assert.deepEqual(s.getHistory(b.id), []);
  assert.equal(s.listProfiles().length, 1);
});

test('전적: 최신순 최대 100건', () => {
  const s = createProfileStore(memStorage());
  const p = s.createProfile('A').profile;
  for (let i = 0; i < HISTORY_MAX + 5; i++) s.addHistory(p.id, { n: i });
  const h = s.getHistory(p.id);
  assert.equal(h.length, HISTORY_MAX);
  assert.equal(h[0].n, HISTORY_MAX + 4);
});

test('손상된 저장값은 백업 후 기본값 (원본 보존)', () => {
  const st = memStorage({ 'mc:profiles': '[{"id":"x"' });
  const s = createProfileStore(st);
  const orig = console.warn; console.warn = () => {};
  try { assert.deepEqual(s.listProfiles(), []); } finally { console.warn = orig; }
  const backup = [...st._m.keys()].find(k => k.startsWith('mc:profiles:corrupt-'));
  assert.ok(backup);
  assert.equal(st.getItem(backup), '[{"id":"x"');
});

test('저장소 차단(예외)에서도 앱이 죽지 않음', () => {
  const s = createProfileStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } });
  const orig = console.warn; console.warn = () => {};
  try {
    assert.deepEqual(s.listProfiles(), []);
    assert.equal(s.createProfile('A').error, 'STORAGE_FAILED');
    assert.equal(s.getCurrentProfile(), null);
  } finally { console.warn = orig; }
});
