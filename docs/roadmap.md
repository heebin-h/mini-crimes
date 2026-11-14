# mini-crimes 로드맵 (체크리스트)

> 항목을 끝낼 때마다 체크하고 `docs/history.md`에 날짜·결정·근거·검증을 같은 커밋으로 남긴다.
> 출처: 2026-11-10 조사(작업 계획서). 미검증은 하위 `[ ]`로 남긴다.

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
- [ ] **P0-2 새로고침·재연결 시 방 복귀** — GamePage/LobbyPage에서 `connect()` + `connect` 시 `room:join` 재전송 후 `room:get`
  - [ ] 이름 중복 플레이어 재연결 오매칭 위험 검토 (`server/rooms.js` 이름 기반 매칭)
  - [ ] 방 이동 시 서버 `currentRoomId`·socket.io room 해제 (이전 방 `game:revealed`·`note:synced` 등이 다른 화면에 도착 가능, 현재 `room:state`만 roomId 필터)
  - 현재 동작(P0-1 임시 처리): 새로고침 시 GamePage는 소켓 미연결로 `room:get` timeout(5s) → 홈, LobbyPage는 새 소켓이라 `ROOM_NOT_FOUND` → 즉시 홈
- [ ] **P0-3 회귀 방지 E2E 레포 편입** — 2인 흐름 + 이전 방 거부 + 늦은 로비 진입 + 노트 복원 + 솔로
  - [ ] playwright devDependency 추가 여부 결정

- [x] **P0-4 서버 권위·데이터 안전 (리뷰 높음 3건)** (`fix/server-authority-data-safety`) — 근거 `docs/review/game-dev-checklist-review_2026-11-14.md`
  - [x] `answer:submit`·`game:reveal`은 `playing`에서만 (로비 제출 시 정답 전원 공개 차단)
  - [x] 리뷰 반영: 모든 소켓 핸들러 공통 래퍼 — payload 정규화 + 예외 격리 (빈 payload 한 번으로 서버 프로세스 종료되던 6개 핸들러, 실측)
  - [x] 리뷰 반영: `server/.env` 자동 로드(이전엔 미로드라 DATA_DIR·JWT_SECRET 문서대로 적어도 무시), 기동 시 data dir 로그
  - [x] 리뷰 반영: 저장 파일 0600·fsync·실패 시 tmp 정리·배열 형식 검증, history 실패 로그·플레이어별 격리, 내부 오류 메시지 비노출, 제출 거부 시 클라 안내
  - [x] 회원·기록 JSON: 손상 시 덮어쓰기 거부(500), 원자적 쓰기(tmp→rename), 디렉터리 자동 생성
  - [x] `DATA_DIR` 환경변수 (영속 디스크 지정용)
  - [ ] 배포 환경 영속 디스크/DB 결정 (휘발성 디스크면 재배포마다 계정 소실)
- [ ] **P0-2 확장 (리뷰)** — `connectionStateRecovery` 적용 + 복구 실패 시 앱 재동기화, 끊김 퇴장 판정 유예(전원 제출 판정에서 잠깐 끊긴 사람 제외 방지)
- [ ] **P0-3 확장 (리뷰)** — 서버 권위·네트워크(지연·끊김)·데이터 손상 테스트 추가, CI에 lint·E2E

## P1 — 추리 성립·배포

- [ ] **P1-3 입력 검증·빈도 제한 (리뷰 중간)** — `room:create` caseId 검증(`caseExists` 미사용), 이름·노트 길이 상한, `maxHttpBufferSize`, `clue:reveal` id 검증, 로그인·가입·소켓 이벤트 rate limit
- [ ] **P1-4 모바일 (리뷰 중간)** — 지원 여부 결정. 현재 iPhone 13에서 플레이 불가(현장 폭 100px, 단서 카드 겹침)
- [ ] **P1-5 추론 경로표 + 외부 플레이테스트 (리뷰 중간)** — 케이스별 결론 3개 × 근거 단서 2개 이상, 용의자별 배제 단서 (P1-1과 함께)

- [ ] **P1-1 SP01~SP03 단서 보강 6건** (README `알려진 미결 이슈`) — 기존 단서 텍스트 보강 권장(이미지 1:1 구조)
- [x] **P1-2 서브경로 배포 이미지 404** — `assetUrl()` + BASE_URL (PR #2 `chore/webp-images-base-url`, main 머지 c09f1e2)
  - [ ] GitHub Pages 실배포 확인
- [x] 이미지 WebP 전환 5.8MB → 4.2MB (PR #2 `chore/webp-images-base-url`, main 머지 c09f1e2)

## P2 — 문서 정합성 (게임 영향 없음)

- [ ] SCENARIO_PLAN·시나리오 §9 V3 "자유 입력+키워드" 전제 → 4지선다 text 비교로 수정
- [ ] sp01 약물명 오타(문서 "미도라졸람") 수정, `db.js:482` "강효" 오타 확인
- [ ] sp02 동기·s1e04 사건 유형 서술 통일, "119"·원/유로·이름 중복 정리
- [x] 문서 이미지 파일명 .jpg → .webp (PR #2 `chore/webp-images-base-url`, main 머지 c09f1e2)

## P3 — 정리

- [ ] 헬스체크(`/health`)·SIGTERM 종료 처리·에러 수집 (리뷰 낮음)
- [ ] 소켓 인증 정책 결정 — 현재 토큰 없이 방 생성·참가 가능 (리뷰 낮음)

- [ ] 빈 디렉터리 `client/public/cases/s1e01 s1e02 … sp03` 삭제
- [ ] README의 존재하지 않는 `client/src/data/` 수정
- [ ] `JWT_SECRET` 기본값 하드코딩(`server/index.js`) — 프로덕션 미설정 시 기동 거부 검토
