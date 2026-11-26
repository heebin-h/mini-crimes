# mini-crimes 게임 개발 체크리스트 기반 리뷰 (2026-11-14)

> 기준: 웹 조사(게임 QA 유형, 멀티플레이 테스트, Socket.IO 공식 문서, 추리 게임 설계, OWASP WebSocket, 게임 접근성, 사전 제작) → mini-crimes 전체(`fix/room-state-sync` `af82d8f` 기준)에 대조.
> 검증 방법: 코드 정독 + 로컬 실측(소켓 직접 호출, playwright iPhone 13 뷰포트). 실측하지 않은 항목은 "추정"으로 표기.

## 결론

- **PR `fix/room-state-sync`는 머지 가능.** 아래 문제는 모두 이 PR 이전부터 있던 것이고, 이 PR이 만든 회귀는 없음.
- **다음 작업 최우선(높음)** — 아래 2건 + 후속 리뷰에서 실측된 "빈 payload로 서버 다운" 1건(§3 첫 행):
  - 대기 중(로비) 답안 제출 시 **정답이 전원에게 공개됨** (실측)
  - 회원 파일 읽기 실패 시 **전체 계정이 지워질 수 있음** (코드 근거)
- 배포 전 차단 요소:
  - 모바일 화면에서 플레이 불가 (실측)
  - 서버 데이터 폴더 부재 시 회원가입 실패 (코드 근거, 추정)
  - 자동 테스트·CI 검사 없음
- 추리 설계 쪽은 "단서만으로 풀 수 있는가"를 검증하는 절차가 없음. SP01~03 미결 6건이 그 증상.

## 1. 조사한 기준 요약

| 영역 | 기준 (출처) |
|---|---|
| QA 유형 | 기능·회귀·스모크, 호환성(기기/OS/브라우저), 성능(프레임·메모리·로딩), 플레이테스트, 현지화 ([QAwerk](https://qawerk.com/blog/types-of-game-testing-techniques/), [Snoopgame 출시 체크리스트](https://snoopgame.com/blog/is-your-game-ready-for-launch-a-checklist-for-final-game-testing/), [HeadSpin](https://www.headspin.io/blog/types-of-game-testing-guide)) |
| 멀티플레이 | 지연·패킷손실 시뮬레이션, 전 클라이언트 상태 수렴, 행동 중 끊김→재접속(유예 시간), 상태 스냅샷 재동기화 ([helpmetest](https://helpmetest.com/blog/multiplayer-game-testing/), [abratabia](https://abratabia.com/game-testing/multiplayer-testing.php)) |
| Socket.IO 재연결 | `connectionStateRecovery`: 짧은 끊김 시 socket id·room·놓친 이벤트 복구. 실패할 수 있으므로 앱 레벨 재동기화 병행 필수 ([공식 문서](https://socket.io/docs/v4/connection-state-recovery)) |
| 서버 권위·보안 | 클라 입력은 위조 가능 전제, 게임 상태·규칙으로 검증, 이벤트별 권한 확인, 메시지 크기·빈도 제한 ([OWASP WebSocket](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet), [abratabia 권위 서버](https://abratabia.com/multiplayer-web-games/authoritative-servers.php)) |
| 추리 설계 | 공정성(단서만으로 해결 가능), 결론마다 단서 다중 배치(Three Clue Rule), 용의자별 혐의·배제 단서, 외부 플레이테스트로 단서 과부족 확인 ([The Alexandrian](https://thealexandrian.net/creations/misc/three-clue-rule.html), [Golden Idol 개발기](https://www.gamedeveloper.com/road-to-igf-2023/-the-case-of-the-golden-idol-i-used-frequent-testing-to-improve-its-mystery-solving), [bugnet](https://bugnet.io/blog/how-to-design-a-detective-or-mystery-game)) |
| 접근성 | 키보드로 전 기능, 색만으로 정보 전달 금지, 대비 4.5:1, 텍스트 확대 ([Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/basic/), [IGDA Top Ten](https://igda-gasig.org/how/game-accessibility-top-ten-se/)) |
| 사전 제작 | 짧고 갱신되는 GDD, 프로토타입→버티컬 슬라이스, 범위 관리 ([Game Developer](https://www.gamedeveloper.com/game-platforms/what-you-should-take-out-of-pre-production), [bugnet](https://bugnet.io/blog/vertical-slice-vs-prototype-what-to-build-first)) |

## 2. 체크리스트 대조

| 영역 | 현황 | 판정 | 근거 |
|---|---|---|---|
| 설계 문서(GDD) | `docs/SCENARIO_PLAN.md` + 시나리오 10개. 채점 방식이 구현과 불일치 | ⚠️ | roadmap P2 |
| 기능 테스트 | 로컬 E2E만 있음(scratchpad), 레포 `test-multi-flow.mjs`는 서버 수동 기동 필요 | ⚠️ | `server/test-multi-flow.mjs` |
| 회귀·스모크(CI) | `npm test` 없음, CI는 빌드·배포만(lint·test 없음) | ❌ | `package.json:7`, `.github/workflows/deploy.yml` |
| 서버 권위(입력 검증) | phase·caseId·길이 검증 없음 | ❌ | §3 H1·M1·M2 |
| 빈도·크기 제한 | 없음 | ❌ | §3 M3 |
| 재연결·유예 | 끊기면 즉시 퇴장 처리, 새로고침 복귀 없음 | ❌ | §3 M4, roadmap P0-2 |
| 상태 수렴 | `room:get` pull로 개선됨(이번 PR) | ✅ | `docs/history.md` |
| 데이터 영속성 | JSON 파일, 손상 시 전체 유실 경로, 방은 메모리(재시작 시 소멸) | ❌ | §3 H2·H3·M7 |
| 호환성(모바일) | 반응형 없음, iPhone 13에서 플레이 불가 | ❌ | §3 M5 |
| 성능 | 이미지 4.2MB(WebP), JS 330KB(gzip 102KB) | ✅ | PR #2, 빌드 출력 |
| 플레이테스트·공정성 | 해결 가능성 검증 절차 없음, SP01~03 배제 단서 6건 부족 | ❌ | README 미결 이슈, §3 M6 |
| 접근성 | 대비 양호(`--ink-muted #a8a8a8` / `--bg #080808` ≈ 8.4:1, 계산값), 단서 카드는 `<button>`, 화면 줌 ± 버튼 있음. 스크린리더 미확인 | ⚠️ | `client/src/index.css:5,25` |
| 현지화 | 한국어 단일. 배경(이탈리아)과 표기 불일치(119·원/유로) | ⚠️ | roadmap P2 |
| 운영 | 헬스체크·graceful shutdown·에러 수집 없음, `JWT_SECRET` 기본값 | ⚠️ | §3 L2, roadmap P3 |

## 3. 발견 사항 (심각도순)

| 심각도 | 위치 | 문제 | 근거 | 수정안 |
|---|---|---|---|---|
| **높음** (후속 리뷰에서 발견) | `server/index.js` 소켓 핸들러 6개 | payload 없이 emit 1회로 **서버 프로세스 종료** (`room:create`·`room:join`·`note:update`·`clue:reveal`·`clue:focus`·`pointer:move`) | 실측: exit=1, `TypeError: Cannot destructure property ... of 'undefined'`. socket.io가 리스너를 nextTick에서 호출 → uncaughtException | 공통 래퍼로 payload 정규화 + try/catch (`41b9673` 후속 커밋에서 수정) |
| **높음** | `server/index.js` `answer:submit`·`game:reveal` 핸들러 | phase 검사 없음 → **로비에서 답안 제출 시 즉시 공개, 정답이 전원에게 전송** | 실측: 로비에서 `answer:submit` → `game:revealed` 수신, `caseAnswer.suspect.text = "루카 모레노 (조카)"` | `const room = getRoom(currentRoomId); if (!room \|\| room.phase !== 'playing') return ack?.({ ok:false, error:'NOT_PLAYING' });` — `game:reveal`도 동일 |
| **높음** | `server/users.js:7-9,11-13,24-30` (`history.js` 동일) | 파일 파싱 실패(부분 쓰기·손상) 시 `[]` 반환 → 다음 가입이 `[]+신규`로 **덮어써 전체 계정 소실**. 쓰기가 원자적이지 않음 | 코드: `catch { return []; }` 후 `save(all)` | `load()`: ENOENT만 `[]`, 그 외는 throw. `save()`: `fs.writeFileSync(FILE+'.tmp', ...); fs.renameSync(FILE+'.tmp', FILE);` |
| **높음**(배포 시) | `server/users.js:4`, `.gitignore` | `server/data/`가 git에 없음(추적 0건) → 새 배포 환경에서 `writeFileSync` ENOENT → 회원가입 500 (추정, 미실측). Render 등 휘발성 디스크면 재배포마다 계정·기록 소실 | `git ls-files server/data` = 0 | 기동 시 `fs.mkdirSync(path.dirname(FILE), { recursive: true })`. 영속 디스크 또는 DB 결정 필요 |
| 중간 | `server/index.js` `room:create` | caseId 검증 없음 → 없는 케이스로 방 생성, 게임 화면 빈 상태 | 실측: `caseId:'NOPE'` 방 생성 성공 | `if (!caseExists(caseId)) return ack?.({ error:'CASE_NOT_FOUND' });` (`db.js`에 `caseExists` 이미 있음, 미사용) |
| 중간 | `server/index.js` `room:create`/`room:join`/`note:update`, `register` | 길이 제한 없음 — 이름 5000자 수용(실측), 노트 무제한, 기본 버퍼 1MB | 실측 `nameLen: 5000` | 이름 `String(n).trim().slice(0,20)`, 노트 `slice(0,5000)`, `new Server(httpServer, { maxHttpBufferSize: 64*1024, ... })` |
| 중간 | 서버 전역 | 빈도 제한 없음 — 로그인 무차별 대입, `pointer:move`·`note:update` 폭주 | 코드에 limiter 없음 | 로그인·가입에 `express-rate-limit`. 소켓은 이벤트별 토큰 버킷(OWASP 출발점 ≈100 msg/min, pointer는 별도 상한) |
| 중간 | `server/rooms.js:57-75,103-109` | 끊기면 즉시 `connected=false` → 전원 제출 판정에서 제외되어 **잠깐 끊긴 사람 없이 공개**될 수 있음, 새로고침 복귀 없음 | 코드: `submitAnswer`가 연결된 플레이어만 셈 | P0-2에서 `connectionStateRecovery: { maxDisconnectionDuration: 2*60*1000 }` + 복구 실패 시 `room:join` 재전송·`room:get`, 퇴장 판정 유예(예: 30초) |
| 중간 | `client/src/pages/GamePage.jsx`, `CaseSelectPage.jsx` (미디어쿼리 0건) | **모바일 플레이 불가** — iPhone 13에서 현장 사진 폭 100px, 단서 카드 겹침, 줌 버튼·안내문 겹침, 케이스 선택 화면 컨트롤 17개 화면 밖 | 실측 스크린샷(playwright `devices['iPhone 13']`) | 모바일 지원 여부 결정 → 지원 시 `@media (max-width: 768px)`에서 세로 배치(현장 상단·단서/노트 탭 전환) |
| 중간 | 콘텐츠 전반 | 해결 가능성 검증 절차 없음. SP01~03 배제 단서 부족 6건(README) | README `알려진 미결 이슈` | 케이스별 "추론 경로표"(결론 3개 × 근거 단서 2개 이상, 용의자별 배제 단서) 작성 → 미충족 칸 보강 → 비개발자 플레이테스트(단서별 메모·소요 시간·정답률) |
| 중간 | 저장소·CI | 테스트 스크립트·CI 검사 없음 → 회귀가 그대로 배포됨 | `package.json:7`, `deploy.yml`에 lint/test 없음 | P0-3 E2E 편입 + `deploy.yml` 빌드 전 `npm run lint` + E2E job |
| 중간 | `server/rooms.js:5` | 방이 메모리에만 있음 → 서버 재시작·무료 호스팅 슬립 시 진행 중 게임 소멸 | 코드: `const rooms = new Map()` | 파티 게임 특성상 수용 가능. 대신 호스팅 슬립 정책 확인 + 클라에 "서버 재시작됨" 안내(현재는 홈 이동) |
| 낮음 | `server/index.js` `clue:reveal` | clueId 검증 없음 → 임의 ID가 공개 목록에 쌓여 `EVIDENCE` 수치 왜곡 가능 | 코드: `revealClue`가 문자열 그대로 push | 해당 케이스 `clueCards`에 있는 id만 허용 |
| 낮음 | `server/index.js` | 헬스체크·종료 처리·에러 수집 없음 | 코드에 `/health`·`SIGTERM` 없음 | `app.get('/health', (_,res)=>res.json({ok:true, rooms: …}))`, `process.on('SIGTERM', …)` |
| 낮음 | 소켓 인증 | 소켓은 토큰 없이 방 생성·참가 가능(화면만 로그인 요구) | `index.js` connection 핸들러 | 의도된 설계인지 결정. 로그인 필수면 `io.use` 미들웨어로 토큰 검증 |

## 4. 테스트 계획 (기준 → mini-crimes 구체 케이스)

| 분류 | 테스트 | 자동화 |
|---|---|---|
| 스모크 | 서버 기동, `/api/cases` 10건, 솔로 1케이스 진입 | CI |
| 기능·회귀 | 2인 생성→참가→개시→단서 공개 동기화→제출→결과, 1인 팀 수사, 이전 방 거부, 늦은 로비 진입, 노트 복원, 결과 후 뒤로가기·재개시 차단 (이번 PR E2E) | P0-3 |
| 서버 권위 | 로비 제출·로비 공개 거부, 없는 caseId 거부, 긴 이름·노트 절단, 임의 clueId 무시, 방장 외 개시·공개 거부 | 소켓 단위 테스트 |
| 네트워크 | 게임 중 `socket.io.engine.close()` → 복구(`socket.recovered`)·상태 수렴, 지연 300ms·패킷손실(브라우저 throttling) 하 단서·노트 동기화, 새로고침 복귀, 8인 동시 | E2E + 수동 |
| 데이터 | `users.json` 손상 파일로 기동 → 가입 시 기존 계정 보존, `server/data` 없는 상태로 기동·가입 | 단위 |
| 호환성 | Chrome·Safari·Firefox 데스크톱, iOS Safari·Android Chrome(모바일 지원 결정 시), 서브경로 배포(`/mini-crimes/`) | playwright 프로젝트별 |
| 성능 | 첫 로딩(4G 기준), 케이스 진입 시 이미지 13장 로딩, 30분 세션 메모리 | 수동 |
| 콘텐츠·플레이테스트 | 케이스별 추론 경로표 충족, 정답 선택지 text = `answer.text`(검사 스크립트 있음), 외부 플레이어 정답률·소요 시간·막힌 지점 | 표 + 수동 |
| 접근성 | 키보드만으로 단서 열기·제출, 포커스 표시, 200% 확대 시 레이아웃 | 수동 |

## 5. roadmap 이관안

- **P0 (즉시)**
  - 서버 phase 검증(`answer:submit`·`game:reveal`)
  - 회원·기록 파일 안전 로드·원자적 쓰기
  - `server/data` 자동 생성
- **P0-2에 포함**
  - `connectionStateRecovery`
  - 퇴장 판정 유예
- **P1**
  - caseId·길이·clueId 검증
  - 빈도 제한
  - 모바일 지원 결정·반응형
  - 케이스별 추론 경로표 + 외부 플레이테스트(P1-1과 통합)
- **P0-3 확장**
  - 서버 권위·네트워크·데이터 테스트 추가
  - CI에 lint·E2E
- **P3**
  - 헬스체크·종료 처리
  - 소켓 인증 정책 결정
