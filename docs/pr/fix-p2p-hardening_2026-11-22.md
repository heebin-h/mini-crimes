# fix: P2P 하드닝(H-1~H-6) — 참가 토큰·heartbeat·ICE 설정 + 전체 QA와 발견 결함 수정

## 요약
`feat/static-p2p` 위에서 P2P 구조의 약점을 점검·보강하고, 게임 전체 경우의 수 QA(단위·변이·3엔진 E2E)를 추가했다. QA에서 나온 결함 중 판단이 필요 없는 5건은 같은 PR에서 고쳤다.

## 변경 사항
- **H-1 ICE:** "TURN 없음" 서술 정정(PeerJS 기본 공용 TURN 포함), `VITE_ICE_SERVERS`로 자체 ICE 지정.
- **H-2 참가 토큰:** 128bit 비밀 토큰으로 끊긴 자리 가로채기 차단(`TOKEN_REQUIRED`).
- **H-3 heartbeat:** 5초 ping/15초 침묵 감지, 백그라운드 탭 틱 간격 보호.
- **H-4 로드맵 정리**, **H-5·H-6 QA:** `client/test/exhaustive.test.js`, `client/e2e/{full,cross-browser,soak-edge}.e2e.mjs`, 증빙 `docs/qa/`.
- **QA 발견 수정(제품 코드):**
  - F1 노트: 입력 후 300ms 안에 이탈하면 유실 → 언마운트·`pagehide`에서 flush (`SharedNote.jsx`)
  - F2 방 코드: 앞 공백이 6자 제한에 잘림 → 공백 제거 후 절단 (`CaseSelectPage.jsx`)
  - F4 목록: 320px 이하 가로 넘침 → 시즌 탭 줄바꿈 (`CaseSelectPage.jsx`)
  - F6 모달 Escape 닫기(`hooks/useEscape.js`), F7 `html lang="ko"`

## 테스트
- 단위 45/45, 변이 테스트 18종 18/18 포착, 프로토콜 퍼저 129,792 이벤트 위반 0.
- 브라우저 E2E 89시나리오, 수정 후 Pages 모사 서버: **Chromium 90/90, Firefox 90/90, WebKit 89/90**, 엔진 혼합 팀(Chromium 방장 + WebKit·Firefox 게스트) 14/14, 기기 프로필 8/8, 유휴·침묵·동시 방 3/3.
- WebKit 1건: 방장이 닫히는 게스트에게 보낼 때 PeerJS 내부 타이머의 미처리 예외(`Error sending binary data through RTCDataChannel`). 기능 검사는 통과, 앱 코드로 잡기 어려워 관찰로 남김(F5).

## 추가 수정 (같은 PR)
- **F8 방장 신원 증명:** 방 id 선점 시 정상 게스트가 공격자에게 이름·토큰을 보내던 문제(앱 수준 10/10 실측). 방장이 ECDSA P-256 키로 접속마다 서명하고 게스트는 첫 공개키를 pin해, 재접속 때 토큰을 보내기 전에 검증한다(공격자 3변형 유출 0/3). `net/hostProof.js`, `net/socket.js`.
- **F3b 새 탭 복귀:** 참가 토큰·공개키를 방별 localStorage(6시간)로 옮겨 같은 브라우저의 새 탭에서 진행 중 게임에 복귀한다. 다른 브라우저·기기는 계속 거부.

## 알려진 한계 (이 PR 범위 밖)
- 방장이 이미 사라진 방에 **처음** 들어오는 사람은 진짜/가짜 방장을 구분할 수 없다(TOFU).
- 같은 origin(`<user>.github.io`)의 다른 페이지는 `mc:guestSessions`를 읽을 수 있다.
- 미검증: 실기기, 실제 NAT/TURN, 수 시간 세션, 사람 플레이테스트, 새 코드의 실제 Pages 동작(현재 라이브는 2026-11-09 구버전). 근거·목록: `docs/qa/2026-11-22-cross-browser-and-hijack/action-items.md`.
- Playwright E2E는 공용 PeerJS 네트워크가 필요해 CI에 넣지 않았다(`PLAYWRIGHT_MODULE`로 외부 설치 사용).

## 확인 방법
```bash
cd /Users/heebiny/diyProj/mini-crimes/client && npm test && npm run lint
npx vite build --outDir /private/tmp/mc-dist --emptyOutDir
python3 /Users/heebiny/diyProj/mini-crimes/docs/qa/2026-11-22-cross-browser-and-hijack/pages_like_server.py /private/tmp/mc-dist 5197 &
BROWSER=webkit ALLOW_404=1 PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5197 node e2e/full.e2e.mjs
```
