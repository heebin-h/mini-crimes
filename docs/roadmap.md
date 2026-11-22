# mini-crimes 로드맵 (체크리스트)

> 항목을 끝낼 때마다 체크하고 `docs/history.md`에 날짜·결정·근거·검증을 같은 커밋으로 남긴다.
> 출처: 2026-11-10 조사(작업 계획서). 미검증은 하위 `[ ]`로 남긴다.

## S — GitHub Pages 정적 전환 (2026-11-14 결정, `feat/static-p2p`)

> 결정: 배포는 GitHub Pages만 사용, 자체 서버 없음. 팀 수사는 P2P(WebRTC·PeerJS 1.5.5, 시그널링은 PeerJS 공용 서버 `0.peerjs.com`),
> 계정은 기기별 로컬 프로필(비밀번호 없음). 방장 브라우저가 기존 서버의 방 로직(검증 포함)을 실행하고, 기존 소켓 이벤트 규약을 유지한다.
> 이로써 서버 전제 항목(DATA_DIR·.env·JWT·헬스체크·서버 rate limit 등)은 대체·종료된다. 아래 P0~P3의 서버 관련 미완료 항목은 S 단계로 대체됨(`server/` 삭제, 2026-11-14).

- [x] **S-1 케이스 데이터·채점 클라이언트 이전** — `server/db.js`·`choices.js` → `client/src/data/`, 정답은 별도 청크(`answers-*.js`, 채점 시 동적 로드). 원본과 10케이스 동일성 스크립트 확인
  - [x] 한계 문서화(README): 정적 사이트라 정답을 완전히 숨길 수 없음(번들에 포함)
- [x] **S-2 로컬 프로필 + 로컬 전적** — 로그인·회원가입 제거, 프로필 생성·선택·삭제(localStorage), 전적은 프로필별 저장(솔로·팀 모두 각 기기에 기록)
- [x] **S-3 P2P 전송 계층** — `socket` 대체 모듈(동일 API: `on/off/emit/connect/id/connected/timeout`), ack·브로드캐스트·송신자 제외 전송
- [x] **S-4 방장 방 로직** — `server/rooms.js`·`index.js` 핸들러 이식: phase 검증, payload 정규화·예외 격리, caseId·clueId 검증, 이름 20자·노트 5000자 상한, 피어별 빈도 제한 (P1-3 대체)
- [x] **S-5 새로고침·재연결 복귀 (P0-2 대체)** — 게스트: 세션 저장 → 재접속 후 이름으로 복귀 / 방장: 방 상태 세션 저장 → 같은 방 ID로 재호스팅(실측 ~0.8초) / 끊김 퇴장 판정 유예 20초 / 페이지 이탈 시 bye 신호 / 방장 이탈 시 게스트 20초 재연결 시도 후 안내·홈
  - [ ] 방장 기기의 네트워크 단절(bye 없음) 시 감지는 WebRTC 타임아웃 의존(수십 초) — 실측 안 함
  - [ ] 서로 다른 네트워크(대칭 NAT 등)에서 직접 연결 실패 가능 — TURN 없음. 실기 확인 필요
- [x] **S-6 모바일 반응형 (P1-4)** — 케이스 선택·로비·게임·결과 화면 세로 배치 (≤768px 미디어쿼리)
  - [x] iPhone 13 뷰포트 실측: 전 화면 화면 밖 컨트롤 0·가로 스크롤 없음, 현장 사진 100px→390px, 단서 카드 겹침 0
  - [ ] 실제 iOS Safari·Android Chrome 기기 확인 (터치 줌·주소창 높이 변화)
- [x] **S-7 테스트·CI (P0-3 대체)** — 방 로직·채점·프로필 단위 테스트(`node --test`), CI에 lint·test, E2E 스크립트 레포 편입
  - [x] 단위 테스트 17건 (`client/test/`, `npm test`)
  - [x] P2P E2E 9시나리오 (`client/e2e/p2p.e2e.mjs`, `npm run e2e`, `ONLY=` 필터, 공용 PeerJS 서버 필요)
  - [x] 독립 리뷰 반영 (높음 2·중간 3·낮음 다수, 단위 21건)
  - [ ] 참가 비밀 토큰(이름·id 사칭 방지) — 구조적 한계로 README 기록, 필요 시 후속
  - [x] CI(deploy.yml)에 lint·test 추가, Node 20→22 (`node --test` 글롭은 Node ≥21), `VITE_SERVER_URL` 제거
- [x] **S-8 문서** — README(정적 구조·P2P 한계·로컬 프로필·테스트·배포·이벤트 규약·케이스 추가 경로) 재작성, `VITE_SERVER_URL` 제거, `server/` 삭제(사용자 결정, 마지막 서버 버전 `b2ddb49`)
- [x] **S-9 콘텐츠 (P1-1·P2)** — SP01~03 배제 단서 보강, 문서 불일치 정리
  - [x] SP01 에밀리(운동화·힐=드레스 세트 구두)·커티스(거실 목격)·케이터링(홀 서빙) / SP02 프란체스카(로비 바)·재킷(미켈레가 벗김)·관리인(지하) / SP03 루치아노(화장실 복도)·알베르토(당일 예식·촬영)
  - [x] 10개 시나리오 V3를 4지선다 판정으로 교체, SCENARIO_PLAN 채점·SP02 동기 정정, sp01 약물명·"강효" 오타, 119→118, 원→유로/달러
  - [ ] 이름 중복은 유지 결정(채점 데이터 연쇄 수정 위험) — README 기록
  - [ ] 외부 플레이테스트 (P1-5)

## H — P2P 후속 보강 (2026-11-17 재분석, `fix/p2p-hardening`)

> 근거: `docs/history.md` 2026-11-17 항목. 코드로 가능한 것만 처리하고, 실기기·실망 확인은 하위 `[ ]`로 남긴다.

- [x] **H-1 ICE(TURN) 서술 정정 + 자체 TURN 지정** — PeerJS 1.5.5 기본값에 공용 TURN이 있음(`TURN 없음` 서술은 오류). `VITE_ICE_SERVERS`(RTCIceServer[] JSON)로 기본값 대체 가능
  - [ ] 서로 다른 네트워크·모바일 데이터에서 공용 TURN 경유 연결 성공 실측
- [x] **H-2 참가 비밀 토큰** — 끊긴 플레이어 슬롯을 이름만으로 가로채는 사칭 차단 (S-7의 "참가 비밀 토큰" 항목 완료, 구 P0-2 "이름 중복 재연결 오매칭"도 대체)
  - [x] 단위 테스트: 토큰 불일치 거부·필수·비노출
  - [ ] E2E 재접속 시나리오로 실제 PeerJS 경유 확인 (공용 시그널링 필요)
- [x] **H-3 heartbeat** — 방장·게스트 침묵 단절(bye·close 없음) 감지 (S-5 "방장 기기 네트워크 단절 감지" 항목 대체: 5초 ping·15초 침묵 시 처리)
  - [x] 단위 테스트(백그라운드 탭 타이머 정지 오탐 방지 포함), E2E 9/9 회귀 통과(26초 시나리오에서 오탐 없음)
  - [ ] 실제 침묵 단절(전원 차단·Wi-Fi 끊김) 감지 시간 실측 — Playwright offline 에뮬레이션이 WebRTC 데이터 채널에 먹는지 미확인이라 시도하지 않음. 실기기에서 확인 필요
- [x] **H-5 전체 게임 경우의 수 QA** — 변수 축 감사 → `client/test/exhaustive.test.js`(전수·시뮬레이션·퍼저)·`client/e2e/full.e2e.mjs`(브라우저 89개) 추가, 변이 18/18. 증빙 `docs/qa/2026-11-21-full-game-coverage/`
  - [x] 개발 서버 88/89(1건 일시 실패·210판 재현 시도 0건), 서브경로 빌드 89/89, 단위 40/40
  - [ ] F1 노트 디바운스 유실(입력 후 300ms 내 이탈) 수정 여부 결정
  - [ ] F2 방 코드 앞 공백 붙여넣기 실패 수정 여부 결정
  - [ ] 미검증: 실기기·Chromium 외 브라우저·실제 NAT/TURN·침묵 단절 시간·시나리오 추리 품질(P1-5)·실제 Pages 배포본
- [x] **H-6 미검증 재검증** — Firefox·WebKit 전체 E2E, 혼합 엔진 팀, 기기 프로필, 앱 수준 id 탈취, 유휴·침묵·동시 방, 접근성·휴리스틱. 증빙 `docs/qa/2026-11-22-cross-browser-and-hijack/`(취합: `action-items.md`)
  - [x] 3엔진 각 88/89(실패 1건=F4), 혼합 엔진 팀 14/14, 기기 프로필 6/8(320폭 2건=F4), 앱 수준 탈취 10/10, 유휴 100초·침묵 감지·동시 방 2개 통과
  - [x] 정정: 전 단계 "모바일 320 넘침 0"은 오류(F4), 일시 실패 2건은 렌더 전 읽기 경쟁 조건 추정
  - [x] F4 목록 320px 가로 넘침 수정 (`CaseSelectPage.jsx` 시즌 탭 `flexWrap`)
  - [x] F8 방장 id 선점 대응: 방장 ECDSA 서명 + 게스트 공개키 pin(재접속 시 토큰 전 검증). 첫 접속은 TOFU 한계
  - [x] F3b 같은 브라우저 새 탭 복귀(방별 localStorage 6시간), 다른 브라우저는 거부 유지
  - [x] F6 Escape로 모달 닫기, F7 `html lang="ko"`
  - [x] F1 노트 flush(언마운트·pagehide), F2 방 코드 공백 정규화
  - [x] README "이론상 가능" 문구 정정
  - [ ] 남은 미검증: 실기기, 실제 NAT/TURN, 수 시간 세션, 사람 플레이테스트, 새 코드의 실제 Pages 배포(push 불가)
- [x] **H-4 구버전 P0~P3 정리** — S 단계로 대체된 서버 전제 항목에 대체 근거를 표시, P3 잔여 정리(빈 디렉터리 삭제)

## P0 — 멀티(팀 수사) 진행 불가 버그

- [x] **P0-1 방 상태 pull 동기화** (`fix/room-state-sync`)
  - [x] 서버 `room:get {roomId}` (ack) — URL roomId 불일치 시 `ROOM_NOT_FOUND`
  - [x] 클라 `useRoomSync` — LobbyPage·GamePage 마운트 시 호출, timeout 5s
  - [x] 리뷰 반영: Lobby `phase:'playing'` 수신 시 게임 진입 (game:started 유실 대비)
  - [x] 리뷰 반영: GamePage 동기화 실패 시 홈 이동 (빈 화면 고착 방지)
  - [x] 리뷰 반영: 진입 시 sharedNote 복원 (pull 결과에만 적용)
  - [x] 리뷰 반영: URL roomId와 다른 방 push 무시 + roomId 변경 시 Lobby 상태 초기화
  - [x] 리뷰 반영(머지 전): 서버 `game:start` lobby 단계만 허용, Lobby `revealed` 수신 시 홈, 동기화 실패 시 즉시 홈
  - [x] 로컬 E2E (playwright 2컨텍스트) 통과 — 제출→결과→뒤로가기 포함
  - [ ] 배포 환경 실기 확인 (배포 여부 자체 미확인)
- [x] **P0-2 새로고침·재연결 시 방 복귀** — **S-5로 대체**(`socket.connect(roomId)` 세션 복구 + `room:join` 재전송 + `room:get`)
  - [x] 이름 중복 플레이어 재연결 오매칭 위험 → **H-2 참가 토큰**으로 해소
  - [x] 방 이동 시 서버 `currentRoomId`·socket.io room 해제 → 서버 삭제(S-8)로 소멸, P2P는 방 이동 시 `leave()`로 연결·세션 정리
  - 현재 동작(P0-1 임시 처리): 새로고침 시 GamePage는 소켓 미연결로 `room:get` timeout(5s) → 홈, LobbyPage는 새 소켓이라 `ROOM_NOT_FOUND` → 즉시 홈
- [x] **P0-3 회귀 방지 E2E 레포 편입** — **S-7로 대체**(`client/e2e/p2p.e2e.mjs` 9시나리오: 2인 흐름·노트 복원(게스트 새로고침)·솔로 등)
  - [x] playwright devDependency 추가 여부 → 추가하지 않음. `PLAYWRIGHT_MODULE` 환경변수로 외부 설치 경로를 지정(공용 PeerJS 네트워크가 필요해 CI에는 넣지 않음)
  - [ ] '늦은 로비 진입' 전용 E2E 시나리오는 없음(단위 테스트의 phase 검증으로만 커버)

- [x] **P0-4 서버 권위·데이터 안전 (리뷰 높음 3건)** (`fix/server-authority-data-safety`) — 근거 `docs/review/game-dev-checklist-review_2026-11-14.md`
  - [x] `answer:submit`·`game:reveal`은 `playing`에서만 (로비 제출 시 정답 전원 공개 차단)
  - [x] 리뷰 반영: 모든 소켓 핸들러 공통 래퍼 — payload 정규화 + 예외 격리 (빈 payload 한 번으로 서버 프로세스 종료되던 6개 핸들러, 실측)
  - [x] 리뷰 반영: `server/.env` 자동 로드(이전엔 미로드라 DATA_DIR·JWT_SECRET 문서대로 적어도 무시), 기동 시 data dir 로그
  - [x] 리뷰 반영: 저장 파일 0600·fsync·실패 시 tmp 정리·배열 형식 검증, history 실패 로그·플레이어별 격리, 내부 오류 메시지 비노출, 제출 거부 시 클라 안내
  - [x] 회원·기록 JSON: 손상 시 덮어쓰기 거부(500), 원자적 쓰기(tmp→rename), 디렉터리 자동 생성
  - [x] `DATA_DIR` 환경변수 (영속 디스크 지정용)
  - [ ] 배포 환경 영속 디스크/DB 결정 (휘발성 디스크면 재배포마다 계정 소실)
- [x] **P0-2 확장 (리뷰)** — `connectionStateRecovery`는 socket.io 전제라 소멸. 끊김 퇴장 판정 유예 20초는 S-5(`hostRoom` `graceMs`), 침묵 단절 감지는 H-3
- [x] **P0-3 확장 (리뷰)** — 서버 권위 → `hostRoom` 단위 테스트, 데이터 손상 → 프로필 저장소 테스트, CI에 lint·test 추가(S-7)
  - [ ] CI에 E2E는 미포함(공용 PeerJS 서버 의존으로 CI 불안정 우려, 로컬 `npm run e2e`로만 실행)

## P1 — 추리 성립·배포

- [x] **P1-3 입력 검증·빈도 제한 (리뷰 중간)** — **S-4로 대체**(서버 전제 항목 중 로그인·가입·`maxHttpBufferSize`는 서버 삭제로 소멸) — `room:create` caseId 검증(`caseExists` 미사용), 이름·노트 길이 상한, `maxHttpBufferSize`, `clue:reveal` id 검증, 로그인·가입·소켓 이벤트 rate limit
- [x] **P1-4 모바일 (리뷰 중간)** — **S-6로 완료** — 지원 여부 결정. 현재 iPhone 13에서 플레이 불가(현장 폭 100px, 단서 카드 겹침)
- [ ] **P1-5 추론 경로표 + 외부 플레이테스트 (리뷰 중간)** — 케이스별 결론 3개 × 근거 단서 2개 이상, 용의자별 배제 단서 (P1-1과 함께)

- [x] **P1-1 SP01~SP03 단서 보강 6건** — **S-9로 완료** (README `알려진 미결 이슈`) — 기존 단서 텍스트 보강 권장(이미지 1:1 구조)
- [x] **P1-2 서브경로 배포 이미지 404** — `assetUrl()` + BASE_URL (PR #2 `chore/webp-images-base-url`, main 머지 c09f1e2)
  - [ ] GitHub Pages 실배포 확인
- [x] 이미지 WebP 전환 5.8MB → 4.2MB (PR #2 `chore/webp-images-base-url`, main 머지 c09f1e2)

## P2 — 문서 정합성 (게임 영향 없음)

- [x] SCENARIO_PLAN·시나리오 §9 V3 "자유 입력+키워드" 전제 → 4지선다 text 비교로 수정 (S-9)
- [x] sp01 약물명 오타(문서 "미도라졸람") 수정, "강효" 오타 확인 (S-9)
- [x] sp02 동기·s1e04 사건 유형 서술 통일, "119"·원/유로 정리 (S-9)
  - [ ] 이름 중복(루카·미켈레·알베르토)은 채점 데이터 연쇄 수정 위험으로 유지 결정 — README 기록
- [x] 문서 이미지 파일명 .jpg → .webp (PR #2 `chore/webp-images-base-url`, main 머지 c09f1e2)

## P3 — 정리

- [x] 헬스체크(`/health`)·SIGTERM 종료 처리·에러 수집 (리뷰 낮음) — 서버 삭제(S-8)로 소멸
- [x] 소켓 인증 정책 결정 — 계정 없음(로컬 프로필) + 참가 비밀 토큰(H-2)으로 결정

- [x] 빈 디렉터리 `client/public/cases/s1e01 s1e02 … sp03` 삭제 (H-4, git 미추적이라 커밋 diff에는 없음)
- [x] README의 존재하지 않는 `client/src/data/` 수정 — 현재 `client/src/data/`가 실재하며 README 구조도와 일치(S-1·S-8)
- [x] `JWT_SECRET` 기본값 하드코딩(`server/index.js`) — 서버·JWT 삭제(S-2·S-8)로 소멸
