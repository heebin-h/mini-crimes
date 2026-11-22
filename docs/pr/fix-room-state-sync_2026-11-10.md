# fix: 팀 수사(멀티) 모드 방 상태 유실로 게임 진행 불가 버그 수정

## 요약
팀 수사 모드에서 로비·게임 화면이 방 상태를 받지 못해 **게임 화면이 비어 플레이가 불가능**하던 버그를 수정합니다. 솔로 모드는 영향 없음.

## 증상
- 게스트 로비가 `수사 팀 — 0/8 · 연결 중...`에 고착
- 1인 팀 수사: 로비에서 8초 후 홈으로 튕김
- 게임 화면: 단서 `0/0`, 현장 이미지 `NO IMAGE LOADED`, 제출 선택지 없음 → 진행 불가

## 근본 원인
서버는 `room:create` / `room:join` / `game:start` 직후 `room:state`를 **1회 push**합니다. 클라이언트는 ack·`game:started` 수신 시 `navigate()`만 하고, 다음 페이지는 마운트 후 `useEffect`에서야 구독하므로 그 사이 도착한 상태가 유실됩니다. 상태를 다시 요청할 수단이 없었습니다.

## 변경 사항
**server/index.js**
- `room:get {roomId}` (ack) 추가 — 소켓의 현재 방 상태 반환. 요청 roomId와 다르면 `ROOM_NOT_FOUND` (이전 방 노출 방지)
- `game:start`는 `lobby` 단계에서만 허용 — 정답 공개 후 재개시·history 중복 기록 방지

**client/src/hooks/useSocket.js**
- `useRoomSync(roomId, enabled, onRoom, onError)` — 마운트 시 `room:get` (timeout 5s), 실패 시 `onError`

**client/src/pages/LobbyPage.jsx**
- 마운트 시 동기화, `phase: 'playing'`이면 게임으로 진입 (`game:started` 유실 대비), `revealed`면 홈
- 동기화 실패 시 즉시 홈, 게임 진입은 `replace` (뒤로가기 시 로비 미경유)
- URL roomId와 다른 방 상태 무시, roomId 변경 시 상태 초기화

**client/src/pages/GamePage.jsx**
- 멀티 마운트 시 동기화 + 공유 노트 복원(pull 결과에만 적용 — push마다 덮으면 입력 중 글자 손실 가능)
- 동기화 실패 시 홈 이동 (빈 화면 고착 방지)
- URL roomId와 다른 방 상태 무시

**docs/roadmap.md, docs/history.md** — 체크리스트·작업 이력 추가

기존 `room:state` push는 그대로 유지합니다.

## 검증
로컬 (server :3001 + vite :5173), playwright 브라우저 2컨텍스트 E2E:

| 시나리오 | 수정 전 | 수정 후 |
|---|---|---|
| 2인 생성→참가(양쪽 2/8)→개시→단서 10장·현장 이미지→단서 공개 동기화 (×5) | FAIL | PASS |
| 1인 팀 수사 (8초 경과 후에도 로비 유지 → 개시) | FAIL | PASS |
| 같은 소켓으로 다른 방 로비 URL → 이전 방 미노출 | FAIL | PASS |
| 개시 후 로비 늦게 진입 → 게임 진입 | FAIL | PASS |
| 같은 소켓으로 다른 방 게임 URL → 홈 이동 | FAIL | PASS |
| 게임 재진입 시 공유 노트 복원 | FAIL | PASS |
| 솔로 모드 회귀 | PASS | PASS |
| 2인 제출→결과(3/3)→뒤로가기 / 방장 뒤로가기 2회 → 홈(재개시 버튼 미노출) | — | PASS |
| 정답 공개 후 `game:start` 재전송(소켓 직접) → 무시, phase 유지 | — | PASS |

- `npm run lint`: 신규 경고 없음
- 독립 코드 리뷰 2회 — 1차 5건(중간 3·낮음 2, `d76860e`), 머지 전 4건(중간 1·낮음 3, `af82d8f`) 전부 반영
- origin/main(PR #2 머지본)과 병합 트리에서 lint·build·E2E 통과(`af82d8f` 이전 시점), `af82d8f` 이후 충돌 없음 재확인

## 범위 밖 / 후속
- **새로고침·재연결 시 방 복귀는 미포함 (P0-2)** — 현재는 게임 화면에서 새로고침 시 홈으로 이동
- E2E 스크립트 레포 편입 (P0-3)
- 배포 환경 실기 확인 미실시

🤖 Generated with [Claude Code](https://claude.com/claude-code)
