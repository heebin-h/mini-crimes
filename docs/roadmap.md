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
  - [x] 로컬 E2E (playwright 2컨텍스트) 통과
  - [ ] 배포 환경 실기 확인 (배포 여부 자체 미확인)
- [ ] **P0-2 새로고침·재연결 시 방 복귀** — GamePage/LobbyPage에서 `connect()` + `connect` 시 `room:join` 재전송 후 `room:get`
  - [ ] 이름 중복 플레이어 재연결 오매칭 위험 검토 (`server/rooms.js` 이름 기반 매칭)
  - 현재 동작: 새로고침 시 GamePage는 동기화 실패 → 홈 이동 (P0-1의 임시 처리)
- [ ] **P0-3 회귀 방지 E2E 레포 편입** — 2인 흐름 + 이전 방 거부 + 늦은 로비 진입 + 노트 복원 + 솔로
  - [ ] playwright devDependency 추가 여부 결정

## P1 — 추리 성립·배포

- [ ] **P1-1 SP01~SP03 단서 보강 6건** (README `알려진 미결 이슈`) — 기존 단서 텍스트 보강 권장(이미지 1:1 구조)
- [x] **P1-2 서브경로 배포 이미지 404** — `assetUrl()` + BASE_URL (`chore/webp-images-base-url`, 미머지)
  - [ ] GitHub Pages 실배포 확인
- [x] 이미지 WebP 전환 5.8MB → 4.2MB (`chore/webp-images-base-url`, 미머지)

## P2 — 문서 정합성 (게임 영향 없음)

- [ ] SCENARIO_PLAN·시나리오 §9 V3 "자유 입력+키워드" 전제 → 4지선다 text 비교로 수정
- [ ] sp01 약물명 오타(문서 "미도라졸람") 수정, `db.js:482` "강효" 오타 확인
- [ ] sp02 동기·s1e04 사건 유형 서술 통일, "119"·원/유로·이름 중복 정리
- [x] 문서 이미지 파일명 .jpg → .webp (`chore/webp-images-base-url`, 미머지)

## P3 — 정리

- [ ] 빈 디렉터리 `client/public/cases/s1e01 s1e02 … sp03` 삭제
- [ ] README의 존재하지 않는 `client/src/data/` 수정
- [ ] `JWT_SECRET` 기본값 하드코딩(`server/index.js`) — 프로덕션 미설정 시 기동 거부 검토
