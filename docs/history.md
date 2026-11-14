# mini-crimes 작업 이력

> 날짜별 결정·근거·검증. 체크리스트는 `docs/roadmap.md`.

## 2026-11-10 — P0-1 멀티 방 상태 동기화 (`fix/room-state-sync`)

**증상**: 팀 수사에서 게스트 로비 "0/8 연결 중" 고착, 1인 팀 수사 8초 후 홈으로 튕김, 게임 화면 단서 0/0·현장 이미지·선택지 없음 → 플레이 불가. 솔로는 정상.

**근본 원인**: 서버는 `room:create`/`room:join`/`game:start` 직후 `room:state`를 1회 push. 클라이언트는 ack·`game:started` 수신 시 `navigate()`만 하고 다음 페이지가 마운트 후 `useEffect`에서야 구독 → 그 사이 도착한 상태 유실. 재요청 수단 없음.

**결정**
- pull(`room:get`) 추가, 기존 push 유지. `navigate(state)` 전달안은 새로고침 대응 불가라 기각.
- `room:get`은 요청 roomId와 소켓의 현재 방이 같을 때만 응답 — 같은 소켓으로 다른 방 URL 진입 시 이전 방 노출 방지.
- 클라는 URL roomId와 다른 방 상태 push도 무시(소켓이 이전 방에 남아 있음).
- 공유 노트는 진입 시 pull 결과에만 반영 — push마다 덮으면 입력 중 글자가 이전 값으로 되돌아갈 수 있음.
- GamePage 동기화 실패 시 홈 이동은 임시 처리. 새로고침 복귀는 P0-2.

**리뷰** (독립 리뷰 1회): 중간 3(이전 방 노출 회귀, 로비 `game:started` 유실 시 고착, GamePage 실패 미처리)·낮음 2(노트 미반영, 정상 경로 warn 로그) 전부 반영.

**검증** (로컬, playwright 2컨텍스트, server :3001 + vite :5173)

| 시나리오 | 수정 전 | 1차 수정 | 리뷰 반영 후 |
|---|---|---|---|
| 2인 생성→참가(2/8)→개시→단서 10장·현장→단서 공개 동기화 ×5 | 5 FAIL | 5 PASS | 5 PASS |
| 1인 팀 수사 (8초 경과 후에도 로비 유지 → 개시) | FAIL | PASS | PASS |
| 같은 소켓 다른 방 로비 URL → 이전 방 미노출 | — | FAIL | PASS |
| 개시 후 로비 늦게 진입 → 게임 진입 | — | FAIL | PASS |
| 같은 소켓 다른 방 게임 URL → 홈 | — | FAIL | PASS |
| 게임 재진입 시 공유 노트 복원 | — | FAIL | PASS |
| 솔로 모드 회귀 | PASS | PASS | PASS |

lint: 신규 경고 없음(기존 2건 동일). 배포 환경 실기 미확인.

## 2026-11-10 — 이미지 WebP 전환 + 서브경로 배포 이미지 404 (PR #2, main 머지 `c09f1e2`)

- 이미지 130장 JPEG → WebP(q75): 5.8MB → 4.2MB(−28%), 해상도 유지. JPEG q70 재인코딩은 원본보다 커져(7.5MB) 기각, WebP q60(−40%)은 현장 확대 시 열화 우려로 기각.
- `/cases/...` 절대경로가 `VITE_BASE=/mini-crimes/` 빌드에서 도메인 루트로 요청돼 404 → `client/src/assetUrl.js`로 `BASE_URL` 적용.
- 검증: `VITE_BASE=/mini-crimes/` build + preview에서 썸네일 7/7·현장 1280px·단서 640px 로드, 404 0건. GitHub Pages 실배포 미확인.

## 2026-11-14 — P0-1 머지 전 리뷰 반영 (`fix/room-state-sync`)

**리뷰** (독립 리뷰, 판정 "조건부 머지 가능"): 중간 1·낮음 3 전부 반영.
- [중간] 정답 공개 후 결과 화면에서 뒤로가기 2회 → 로비 재진입 시 pull이 `revealed` 방을 돌려줘 방장에게 `▶ 수사 개시`가 다시 노출, `game:start`에 phase 검사가 없어 재개시·재공개·history 중복 기록 가능 (pull 도입으로 생긴 경로)
  → 서버 `game:start`는 `phase === 'lobby'`만 허용, Lobby는 `revealed` 수신 시 홈으로
- [낮음] `game:started` 경로도 `replace` — 게임에서 뒤로가기 시 로비를 거치지 않음
- [낮음] Lobby 동기화 실패(`ROOM_NOT_FOUND`/timeout) 시 8초 대기 없이 즉시 홈 (8초 fallback은 무응답 대비로 유지)
- [낮음] roadmap P0-2 "현재 동작" 설명 정정

**검증** (로컬)
- 소켓 직접: 생성→개시→제출→공개 후 `game:start` 재전송 → `game:started` 미수신, phase `revealed` 유지
- 브라우저: 2인 제출→결과(3/3)→게스트 뒤로가기(게임 화면 안정, 루프 없음)→방장 뒤로가기 2회 → 홈, 개시 버튼 미노출, JS 에러 0
- 회귀 묶음(2인 ×5, 1인 팀, 이전 방 거부, 늦은 로비 진입, 노트 복원, 솔로) 전부 PASS
- origin/main(PR #2 머지본)과 병합 트리에서 lint·build·회귀 묶음 PASS (이번 수정 전 시점), 충돌 없음

**범위 밖으로 기록**: 서버 `currentRoomId`·socket.io room이 방을 옮겨도 해제되지 않아 이전 방의 `game:revealed`·`note:synced` 등이 다른 화면에 도착할 수 있음 (`room:state`만 roomId 필터). → roadmap P0-2 하위로 이관.
