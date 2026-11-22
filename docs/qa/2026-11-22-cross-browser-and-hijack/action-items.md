# 취합: 커밋할 것 · 수정할 것 · 사용자만 할 수 있는 것 (2026-11-22)

> 기준 브랜치 `fix/p2p-hardening`(HEAD `a6f1848`, H-4). 아래 "커밋"은 **아직 하나도 실행하지 않았다.** push는 SSH 키가 없어 불가능하다(`git ls-remote` → `Permission denied (publickey)`).

## A. 커밋할 것 (미커밋 변경 전체)

`git status` 현재: 수정 2개(`docs/history.md`, `docs/roadmap.md`), 신규 `client/e2e/{cross-browser,full,soak-edge}.e2e.mjs`, `client/test/exhaustive.test.js`, `docs/qa/`, `docs/pr/`.

| # | 커밋 제안(메시지 초안) | 포함 파일 | 비고 |
|---|---|---|---|
| 1 | `test: 전수·시뮬레이션·프로토콜 퍼저 테스트 추가 (H-5)` | `client/test/exhaustive.test.js` | 단위 40/40에 포함 |
| 2 | `test(e2e): 브라우저 전체 E2E — 솔로·팀·라우팅·프로필·모바일·3엔진(BROWSER)·혼합 엔진·유휴/침묵/동시 방 (H-5, H-6)` | `client/e2e/full.e2e.mjs`, `client/e2e/cross-browser.e2e.mjs`, `client/e2e/soak-edge.e2e.mjs` | `PLAYWRIGHT_MODULE`로 외부 playwright 사용, CI 미편입(기존 방침 유지) |
| 3 | `docs(qa): PeerJS id 재등록 50회 · 전체 게임 커버리지 · 미검증 재검증 증빙 (H-5, H-6)` | `docs/qa/` 3개 폴더(로그·SHA·스크립트 포함) | 변이 테스트 스크립트·진단 스크립트 포함 |
| 4 | `docs: 로드맵·이력에 H-5·H-6 반영` | `docs/roadmap.md`, `docs/history.md` | 아래 D절 참고 |
| ? | (미정) `docs/pr/` 4개 | `docs/pr/*.md` (2026-11-10~14 PR 초안, 이번 작업 산물 아님) | **이전 세션의 미추적 파일**. 같이 커밋할지, 건드리지 않을지 결정 필요 |

> 커밋 1~3은 제품 코드를 바꾸지 않는다. 코드 수정(B절)은 별도 커밋으로 분리하는 것을 권한다.

## B. 수정할 것 (제품 코드·문서) — 우선순위순

각 항목은 **재현 근거**가 있고, 수정 여부는 아직 결정되지 않았다. 크기는 추정이다.

| 순위 | ID | 내용 | 위치 | 근거 | 수정 후보 | 크기 |
|---|---|---|---|---|---|---|
| 1 | **F4** | 목록 화면이 너비 ≤320px에서 가로 스크롤(331px). 시즌 탭이 줄바꿈 없이 한 줄이고 버튼 패딩 20px | `client/src/pages/CaseSelectPage.jsx:198`(탭 컨테이너), `:211`(`padding: '8px 20px'`) | 3엔진 모두 재현. 너비 280~320에서 목록만 넘침(340 이상 정상). iPhone SE(320)·Galaxy S9+(320) 프로필 실패. `diag/width-sweep.mjs` | 탭 컨테이너 `flexWrap: 'wrap'` 또는 좁은 화면에서 패딩 축소 | 1~3줄 |
| 2 | **F1** | 노트 입력 후 300ms 안에 이탈하면 마지막 입력 유실 | `client/src/components/game/SharedNote.jsx:10`(cleanup이 타이머만 취소), `:16` | E2E `메모 디바운스 경계`: 즉시 새로고침 `""`, 600ms 뒤 `"메모-600"` (3엔진 동일) | 언마운트·`pagehide`·제출 시 대기 값을 flush | 5~10줄 |
| 3 | **F2** | 방 코드 앞 공백 붙여넣기 → 6자 제한에 잘려 "방을 찾을 수 없습니다" | `client/src/pages/CaseSelectPage.jsx:135`(`maxLength={6}`) | `diag/join-code-variants.mjs`, E2E `방 코드 입력 변형` (Firefox·WebKit도 동일) | 공백 제거 후 길이 제한(`trim().slice(0,6)`) | 2~4줄 |
| 4 | **F3b** | 게임 진행 중 탭을 닫거나 다른 브라우저(예: 메신저 인앱 브라우저→외부 브라우저)로 열면 **영구 복귀 불가**(유예 20초 안·밖 모두 "이미 진행 중인 게임입니다"). 같은 탭 새로고침만 복귀 | 참가 토큰 `client/src/net/socket.js`(`sessionStorage`), `client/src/net/hostRoom.js`(재접속 조건 이름+토큰) | `rejoin-new-tab.mjs` A 성공 / B·C 거부. H-2 사칭 방지와 맞바꾼 동작 | **정책 결정 필요**: 토큰을 `localStorage`(방별 키+만료)로 옮기면 같은 브라우저 새 탭 복귀 가능, 다른 브라우저/기기 복귀는 여전히 불가. 안내 문구 개선만 하는 선택지도 있음 | 정책에 따라 다름 |
| 5 | **F8** | 방장이 사라진 뒤(새로고침 재호스팅 구간·종료) 같은 방 id를 선점한 공격자에게 정상 게스트가 접속해 이름·토큰을 전송 | `client/src/net/socket.js` (`PEER_PREFIX + code` 고정 id) | `hijack-app-level.mjs` 10/10, 로그 `hijack-app-level.log` | **설계 결정 필요**(큰 변경): 방장 재호스팅 시 비밀 키 서명 challenge, 방 id에 방장이 만든 추가 난수 포함(코드 길이↑), 게스트가 첫 응답의 방장 증명을 검증 등. README 한계 서술은 먼저 고칠 수 있음 | 큼 |
| 6 | **F6** | 모달(`.modal-overlay`)이 Escape로 안 닫힘 | `client/src/components/game/AnswerModal.jsx:17`, `CluePanel.jsx:100`, `CaseBriefModal.jsx:23` | `a11y-kbd-flow.log` | `keydown` Escape → `onClose` (공통 훅 하나) | 5~10줄 |
| 7 | **F7** | `<html lang="en">`인데 UI는 한국어 | `client/index.html:2` | `a11y-audit.log` | `lang="ko"` | 1줄 |
| 8 | F5 | WebKit 방장에서 게스트가 닫히는 순간 PeerJS 내부 `_trySend`에서 미처리 예외 `Error sending binary data through RTCDataChannel`(3회 중 2회, 기능 영향 없음) | PeerJS 라이브러리 내부 타이머 | WebKit 팀 시나리오 `pageerror` 수집 3회 중 2회(터미널 출력으로만 확인, 별도 로그 파일 없음) | 앱 코드로는 잡기 어려움. 관찰 유지 | — |
| 9 | 문서 | `README.md` 한계 문구 "이론상 가능" → "시그널링 수준 실측 확인(50/50) + 앱 수준 확인(10/10)" | `README.md` | `docs/qa/2026-11-20-peerjs-id-reuse/README.md` 후속 판단 | 문구 교체 | 1~2줄 |

> F5 재현성: 단독 재실행 3회 중 2회 관찰, 이후 3엔진 전체 실행(`logs/e2e-pageslike-webkit.log`)에서는 0건. 증거가 약하므로 "관찰"로만 취급한다.

## C. 사용자만 할 수 있는 것 / 이 환경에서 불가능한 것

| 항목 | 이유 | 하는 방법 |
|---|---|---|
| **push·PR** | SSH 키 없음(`Permission denied (publickey)`), `gh` 미인증 | `! gh auth login` 또는 SSH 키 등록 후 `git push -u origin fix/p2p-hardening` |
| **새 코드의 실제 Pages 동작** | 라이브 사이트는 구버전(2026-11-09, `socket.io`). 배포하려면 push→merge 필요 | 배포 후 라이브 URL에 대고 `BASE_URL=https://heebin-h.github.io/mini-crimes node client/e2e/full.e2e.mjs` |
| **실기기(iOS Safari·Android Chrome)** | 이 환경에 기기 없음 | 같은 Wi-Fi에서 `cd client && npx vite --host` → 폰으로 `http://<PC IP>:5173` (단, 폰에서 Vite 서빙은 Firefox ICE 현상처럼 서버 영향이 있을 수 있어 정적 빌드 서빙 권장) |
| **실제 NAT·모바일 데이터·TURN** | 같은 PC 루프백만 가능 | 폰(LTE)과 PC(Wi-Fi)로 팀 방 1회 — 실패 시 `VITE_ICE_SERVERS`로 자체 TURN 지정(H-1) |
| **수 시간 세션·자정·TZ** | 시간이 걸림 | 방 하나를 켜 두고 몇 시간 뒤 제출 |
| **시나리오 풀이 가능성·난이도** | 사람 판단 | 플레이테스트. 휴리스틱상 의심 3문항: `s1e03/weapon`, `s1e04/weapon`, `s1e05/motive` |

## D. 문서 동기화 (커밋 4에 포함할 내용)

- `docs/roadmap.md` H-6 신설: 3엔진 88/89×3, 혼합 엔진 14/14, 기기 프로필 6/8, 앱 수준 탈취 10/10, 유휴 100초·침묵·동시 방 통과, F4~F8 결정 대기 체크박스.
- `docs/history.md` H-6 항목: 정정(전 단계 모바일 320 주장 오류, 일시 실패 원인 추정 정정) 포함.
- `docs/qa/2026-11-21-full-game-coverage/` 의 README·findings·coverage-matrix에 정정 주석 추가(모바일 행, 미검증 목록 갱신).

## E. 이번 재검증에서 바꾼 테스트 코드 (제품 코드 무수정)

- `client/e2e/full.e2e.mjs`: `BROWSER=chromium|firefox|webkit`, `ALLOW_404=1`(Pages 모사 서버의 라우트 404 허용·자산 404는 계속 결함), 결과 화면 렌더 대기 추가, 취소된 요청(`aborted/cancelled`)을 결함으로 세지 않음(WebKit 오탐 제거), 모바일 넘침 판정을 **선언한 뷰포트 너비 기준**으로 수정(F4를 놓친 원인), 실패 시 페이지 오류 출처·스택 기록.
- 신규: `cross-browser.e2e.mjs`, `soak-edge.e2e.mjs`.
