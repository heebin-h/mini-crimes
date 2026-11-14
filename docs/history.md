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

## 2026-11-14 — 게임 개발 체크리스트 기반 전체 리뷰 + 높음 3건 수정 (`fix/server-authority-data-safety`)

**리뷰**: 게임 QA 유형·멀티플레이 테스트·Socket.IO 공식 문서·추리 게임 설계·OWASP WebSocket·접근성·사전 제작 기준을 조사해 전체 대조. 결과 `docs/review/game-dev-checklist-review_2026-11-14.md` (높음 3·중간 8·낮음 3). 중간·낮음은 roadmap P0-2/P0-3 확장, P1-3~5, P3로 이관.

**수정 (높음 3건)**
- 로비에서 `answer:submit` 시 즉시 공개되어 정답이 전원에게 전송되던 문제(실측) → `answer:submit`·`game:reveal`은 `playing`에서만. payload 없음·null·문자열에도 서버 유지.
- `users.json`·`history.json` 파싱 실패 시 `[]`로 대체 → 다음 쓰기가 전체 덮어쓰기 → `server/jsonStore.js`: ENOENT만 빈 값, 손상은 에러(파일 보존), 쓰기는 tmp→rename.
- `server/data` 미추적이라 새 환경에서 쓰기 ENOENT(추정) → 쓰기 시 디렉터리 자동 생성. `DATA_DIR` env 추가(영속 디스크용).

**결정**: 손상 파일은 자동 백업·복구하지 않고 요청을 500으로 거부 — 데이터 보존 우선, 운영자가 로그(`[store] corrupt JSON`)로 인지 후 수동 복구.

**검증** (로컬, 서버 직접 기동 :3101, DATA_DIR 격리)
- 없는 DATA_DIR → 가입 200·파일 생성 / 손상 파일 → 가입 500·파일 해시 동일·로그 출력·서버 생존 / 재기동 후 기존 계정 유지·tmp 잔여 없음
- 로비 제출 `{ok:false, NOT_PLAYING}`·공개 없음, 로비 방장 공개 없음, 비정상 payload 3종 후 서버 생존, 진행 중 제출 → 공개·채점 정상
- 브라우저 회귀(2인 ×5, 1인 팀, 이전 방 거부, 늦은 로비, 노트 복원, 솔로, 결과→뒤로가기) 전부 PASS, 실제 `server/data` 해시 불변

**사고 기록**: 앞선 결과 화면 E2E(11-14 15:49)가 로컬 `server/data/history.json`에 테스트 기록 2건(userId `ra`·`rb`)을 남김. 이후 테스트는 DATA_DIR 격리.

## 2026-11-14 — `41b9673` 독립 리뷰 반영 (`fix/server-authority-data-safety`)

**리뷰 판정**: 머지 가능(중간 2·낮음 6). 단 중간 #2 "다른 소켓 핸들러 null payload 크래시"는 실측 결과 **높음으로 상향** — `room:create`·`room:join`·`note:update`·`clue:reveal`·`clue:focus`·`pointer:move`에 payload 없이 emit 1회로 서버 프로세스 종료(exit=1, TypeError). socket.io 4.8이 리스너를 `process.nextTick`에서 호출해 uncaughtException이 됨. 이 PR 이전부터 존재.

**수정**
- 모든 소켓 핸들러 공통 래퍼 `on()`: payload 객체 정규화(`emit(ev, cb)` 형태 포함), 예외 격리·로그·`{ok:false, INTERNAL}` ack
- `server/.env` 자동 로드(`process.loadEnvFile`, Node ≥20.12, 기존 env 우선) — 이전엔 어디서도 로드하지 않아 문서대로 `DATA_DIR`·`JWT_SECRET`을 적어도 무시됨. 기동 시 `[store] data dir` 로그
- jsonStore: 임시 파일 0600, fsync, 실패 시 tmp 정리, 배열 형식 검증(`{}`·`null` → STORE_CORRUPT), `DATA_DIR` 절대경로화
- history 기록 실패 로그(기존 `catch {}` 무음), 멀티 기록 플레이어별 격리
- 전역 에러 핸들러: status 없는 내부 오류는 `INTERNAL_SERVER_ERROR`만 응답(fs 오류 메시지의 서버 절대경로 노출 방지)
- 클라: 제출 거부(`NOT_PLAYING`) 시 토스트 안내
- README 환경변수 표 `DATA_DIR`·.env 로드·users.json 생성 시점 정정

**검증** (서버 직접 기동 :3101, DATA_DIR 격리)
- 12개 이벤트 × 이상 payload 6종(없음·null·문자열·숫자·배열·함수), 방 안/밖 → 서버 생존, TypeError 0
- 이전 크래시 재현 6개 핸들러 전부 alive
- 가입 파일 권한 600, 비배열 JSON → 로그인 500 STORE_CORRUPT·파일 보존, EACCES → `INTERNAL_SERVER_ERROR`(경로 미노출)
- `.env`의 DATA_DIR·JWT_SECRET 적용(복사본 서버로 확인)
- 이전 데이터·권위 검증, 브라우저 회귀 전부 PASS, 실제 `server/data` 해시 불변
- 미검증: 클라 `NOT_PLAYING` 토스트는 정상 UI 흐름으로 유발 불가해 브라우저 확인 안 함

**정리**: 로컬 `server/data/history.json`의 테스트 기록 2건(`ra`·`rb`) 삭제(사용자 승인, 백업 후).

## 2026-11-14 — GitHub Pages 정적 전환: P2P 팀 수사 + 로컬 프로필 (`feat/static-p2p`)

**결정** (사용자): 배포는 GitHub Pages만, 자체 서버 없음. 팀 수사 = P2P(WebRTC, PeerJS 1.5.5 MIT, 시그널링은 공용 `0.peerjs.com`), 계정 = 기기별 로컬 프로필(비밀번호 없음).

**구조**
- `client/src/data/{cases,choices,answers}.js`: 서버 데이터 이전. 정답은 별도 청크로 채점 시 동적 로드. 변환 후 원본과 10케이스 메타·선택지·정답·정답 선택지 불변식 동일 확인.
- `client/src/net/hostRoom.js`: 서버 방 로직을 방장 브라우저용 순수 모듈로 이식 + 리뷰 미결 항목 반영(phase 검증, payload 정규화·예외 격리, caseId·clueId 검증, 이름 20·노트 5000·답안 200자, 피어별 토큰 버킷, 끊김 유예 20초, 같은 이름 신규 참가 거부(재접속 오매칭 방지), 방 인원 외 이벤트 무시).
- `client/src/net/socket.js`: socket.io-client와 같은 API의 P2P 전송 계층 — 화면 코드는 import 경로 유지. 새로고침 복구(sessionStorage 세션·방장 방 스냅샷), 페이지 이탈 시 `bye` 신호, 끊긴 요청 재연결 후 재전송.
- `client/src/profile/store.js` + `ProfileContext`·`ProfilePage`: 로그인·회원가입 대체. 전적은 프로필별 localStorage(최대 100건), 손상 값은 백업 키로 보존.
- 제거: `AuthContext.jsx`, `AuthPage.jsx`, `api.js`, `socket.io-client` 의존.

**디버깅 기록** (방장 이탈 E2E 실패 2회)
1. Playwright `context.close()`는 `pagehide`를 발생시키지 않아 bye 없이 WebRTC 감지(수십 초)에 의존 → 25초 room:get 타임아웃이 먼저 홈 이동(안내 없음). 실제 이탈과 같게 `about:blank` 이동으로 테스트 변경, 동기화 실패 이동에도 안내 추가.
2. 방 소멸 시 대기 요청에 LEFT 응답 → 화면이 '동기화 실패'로 먼저 이동 후 이탈 안내로 재이동(2회). 소멸 시 대기 요청은 응답 없이 폐기.

**검증**
- 단위 17건 PASS (방 로직 11·데이터/채점/프로필 6)
- E2E 8/8 PASS (공용 PeerJS 서버 경유, 로컬 Vite): 프로필 진입, 2인 전체 흐름(단서·노트 동기화, 결과 3/3, 양쪽 전적), 1인 팀, 잘못된 코드·같은 이름 거부, 게스트 새로고침 복귀(단서·노트 유지 후 동기화 계속), 방장 새로고침 재호스팅(~0.8초) 후 게스트 재연결·결과, 방장 이탈 → 20.8초 후 안내·홈, 솔로 채점·전적
- 미검증: 서로 다른 네트워크·모바일 데이터 환경의 P2P 연결(TURN 없음), 방장 네트워크 단절(bye 없음) 감지 시간

## 2026-11-14 — S-6 모바일 반응형 · S-7 CI (`feat/static-p2p`)

- 모바일: 화면 코드가 inline style이라 주요 컨테이너에 className(`mc-header`·`mc-select-*`·`mc-game-*`)을 붙이고 `index.css` ≤768px 미디어쿼리에서 `!important`로 세로 배치. 데스크톱 스타일은 불변.
  - 검증(iPhone 13 뷰포트): 케이스 선택·게임·단서 모달·제출 모달·결과·로비·프로필 전부 화면 밖 컨트롤 0, 가로 스크롤 없음. 게임 현장 사진 폭 100px → 390px, 단서 카드 겹침 0. 실기기 미확인.
- CI: `deploy.yml`에 lint·단위 테스트 단계 추가(실패 시 배포 중단), Node 20 → 22(`node --test` 경로 글롭은 Node ≥21 — 20이면 테스트 파일을 못 찾아 실패), `VITE_SERVER_URL` 제거. `vite.config.js` 서버 프록시 제거, `client/.env.example`을 `VITE_BASE`·`VITE_PEER_*`로 교체.
  - 검증: 로컬에서 CI 순서(lint → test → `VITE_BASE=/mini-crimes/` build) 통과. GitHub Actions 실행은 push 후 확인 필요.

## 2026-11-14 — S-8 문서 · `server/` 삭제 (`feat/static-p2p`)

- `server/` 추적 파일 12개 git 삭제 (사용자 결정). 마지막 서버 버전 커밋 `b2ddb49`(README에 기록). 로컬 `server/data/`(실사용자 데이터, gitignore)·`server/node_modules`는 디스크에 유지.
- README 재작성: 정적 구조, P2P 동작·한계(정답 완전 비공개 불가, 방장 이탈 시 종료, TURN 없음, 공용 시그널링 의존, 로컬 저장), 파일 구조, 환경변수(`VITE_BASE`·`VITE_PEER_*`), 테스트·배포, 이벤트 규약(`room:get`·`host:lost` 추가), 케이스 추가 경로(`client/src/data/*`).
- P2 정리 1건: README S1E04 "수장고 둔기 살인" → "둔기 폭행(피해자 생존)" — 게임 데이터 synopsis "목숨은 건졌지만 아직 의식이 없다" 근거.

## 2026-11-14 — origin/main(PR #2) 병합: WebP·assetUrl 반영 (`feat/static-p2p`)

**발견**: 이 브랜치는 PR #2 머지 전 시점에서 갈라져 케이스 경로가 `.jpg`였다. 그대로 main에 머지하면 main에는 WebP만 있으므로 모든 이미지가 깨진다. 또 `server/db.js`(main에서 수정, 여기서 삭제)가 충돌한다.

**처리**: `git merge origin/main`
- 충돌 3건
  - `README.md`: 이 브랜치 버전 채택(WebP·assetUrl 이미 반영)
  - `client/src/data/cases.js`: git이 `server/db.js`의 이름 변경으로 인식 → 이 브랜치 버전 채택 후 경로 `.jpg`→`.webp` 22곳
  - `CaseSelectPage.jsx`: import 블록 병합(`assetUrl` + 프로필·로컬 데이터)
- 결과: 추적 jpg 0 / webp 130, `server/` 추적 0.

**검증**
- lint 신규 경고 없음
- 단위 17 PASS (이미지 존재 검사가 WebP 경로 확인)
- `VITE_BASE=/mini-crimes/` 빌드 성공
- P2P E2E 8/8 PASS
- 모바일 7화면: 화면 밖 컨트롤 0, 가로 스크롤 없음
