# Mini Crimes

온라인 추리 보드게임 웹앱. 최대 8명이 같은 방에서 단서를 공유하며 범인·수단·동기를 추리한다. 솔로 플레이도 지원한다.

**서버 없는 정적 사이트**(GitHub Pages)로 동작한다. 팀 수사는 브라우저끼리 직접 연결(P2P)하고, 프로필·전적은 각 브라우저에 저장한다.

---

## 기술 스택

| 레이어 | 스택 |
|--------|------|
| 클라이언트 | React 19 + React Router 7 + Vite 8 |
| 팀 수사(멀티) | WebRTC P2P — PeerJS 1.5.5 (시그널링: 공용 `0.peerjs.com`) |
| 프로필·전적 | 기기별 로컬 프로필 (localStorage, 비밀번호 없음) |
| 배포 | GitHub Pages (정적) |
| 테스트 | `node --test` 단위 테스트, Playwright P2P E2E |

> 2026-11-14 이전에는 Express + Socket.IO 서버(`server/`)와 JWT 로그인을 썼다. 마지막 서버 버전 커밋: `b2ddb49`.

---

## 로컬 실행

```bash
cd client
npm install
npm run dev            # http://localhost:5173
```

서버를 띄울 필요가 없다. 팀 수사를 시험하려면 브라우저 창 2개(일반 창 + 시크릿 창 등, 프로필이 다르게)로 방을 만들고 참가한다. 인터넷 연결이 필요하다(PeerJS 시그널링).

---

## 구조

### 팀 수사 (P2P)

- **방장 브라우저가 방(서버 역할)을 맡는다.** 방 만들기 시 PeerJS에 `mini-crimes-v1-{방코드}` id로 등록하고, `client/src/net/hostRoom.js`(방 로직)를 실행한다.
- **게스트**는 임의 id로 등록 후 방장에게 DataConnection으로 연결한다. 요청 `{t:'req'}` · 응답 `{t:'ack'}` · 방송 `{t:'ev'}` · 이탈 `{t:'bye'}`.
- `client/src/net/socket.js`는 이전 socket.io-client와 같은 API(`on/off/emit/timeout/connect/leave`)를 제공한다. 화면 코드는 소켓 이벤트 규약(아래 표)을 그대로 쓴다.
- **방장 쪽 검증** (모든 게스트 메시지는 위조 가능하다는 전제)
  - phase 검사: 로비에서 제출·공개 불가, 공개 후 재개시 불가
  - 데이터 정리와 예외 격리
  - 케이스·단서 id 검증
  - 길이 상한: 이름 20자, 노트 5000자, 답안 200자
  - 피어별 빈도 제한
  - 같은 이름 처리: 접속 중인 같은 이름은 거부하고, 연결이 끊긴 같은 이름은 재접속으로 보고 자리를 이어받게 한다
  - 방 인원이 아닌 피어는 `room:join`·`room:get`만 보낼 수 있고, 나머지 이벤트는 무시한다. `room:create`는 방장 로컬 전용이라 게스트가 보내면 차단된다
  - 포인터 이벤트: 클라이언트에서 50ms 쓰로틀, 빈도 제한도 별도 버킷이라 다른 이벤트 한도를 소진하지 않는다
- **새로고침·재연결**
  - 게스트: 세션(sessionStorage)으로 재접속하고, 이름으로 자리·답안을 이어받는다.
  - 방장: 저장된 방 상태로 같은 id에 다시 등록한다(실측 약 0.8초).
  - 끊긴 플레이어는 20초 동안 유예한다. 이 동안은 전원 제출 판정에서 빠지지 않는다.
  - 방장이 페이지를 떠나면 게스트가 20초간 재연결을 시도한 뒤, 안내와 함께 홈으로 이동한다.

### 한계 (정적 사이트·P2P 특성)

- **정답을 완전히 숨길 수 없다.** 정답은 별도 파일(`answers-*.js`)로 분리해 채점할 때만 불러오지만, 공개된 정적 파일이라 개발자 도구로 볼 수 있다.
- **방장이 나가면 방이 끝난다.** 방 상태는 방장 브라우저에만 있다.
- **네트워크 환경에 따라 연결이 실패하거나 느릴 수 있다.** 기본 ICE 설정(PeerJS 1.5.5 기본값)에는 Google STUN과 PeerJS 공용 TURN(`turn:eu-0/us-0.turn.peerjs.com`)이 들어 있어 대칭 NAT도 중계로 연결될 수 있다. 다만 공용 TURN은 무료·무보증이고 실제 연결 성공률은 실측하지 않았다. 안정성이 필요하면 `VITE_ICE_SERVERS`로 자체 TURN을 지정한다. 같은 Wi-Fi가 가장 안정적이다.
- **시그널링은 공용 PeerJS 서버에 의존한다.** 장애가 나면 방 만들기·참가가 안 된다. 자체 PeerServer를 쓰려면 `VITE_PEER_*`를 지정한다.
- **프로필·전적은 그 브라우저에만 있다.** 다른 기기와 공유되지 않고, 사이트 데이터를 지우면 함께 삭제된다.
- **계정 인증은 없지만 자리 가로채기는 막는다.** 참가할 때 브라우저가 랜덤 비밀 토큰(128bit)을 만들어 세션에 저장하고, 방장은 이름과 토큰이 모두 같은 끊긴 플레이어에게만 재접속을 허용한다. 토큰은 `room:state` 등으로 다른 사람에게 전달되지 않는다. 한계: 토큰은 그 탭의 sessionStorage에만 있어서 탭을 닫으면 복귀할 수 없고(끊긴 자리는 로비면 20초 뒤 반환), 방장 브라우저는 모든 토큰을 알고 있으며, 방장 자체의 위변조는 막지 못한다. 공용 시그널링 서버에서 끊긴 피어 id를 다른 사람이 재등록하는 것도 이론상 가능하다. 친구끼리 하는 파티 게임 용도를 전제로 한다.
- **GitHub Pages 프로젝트 사이트는 `<user>.github.io` origin을 같은 사용자의 다른 레포와 공유한다.** 그래서 `mc:*` localStorage·sessionStorage에 다른 레포 페이지도 접근할 수 있다. 방장 복구 스냅샷은 형식 검증을 거친다.

### 파일 구조

```
client/
├── src/
│   ├── data/
│   │   ├── cases.js         # 케이스 10개: 메타·단서·경고 카드 (정답 없음)
│   │   ├── choices.js       # 4지선다 선택지 (정답 표시 없음)
│   │   └── answers.js       # 정답 — 채점 시 동적 import (별도 청크)
│   ├── game/grading.js      # 채점 (선택지 text 정확 일치)
│   ├── net/
│   │   ├── hostRoom.js      # 방장 방 로직 (순수 모듈, 단위 테스트 대상)
│   │   └── socket.js        # P2P 전송 계층 (PeerJS)
│   ├── profile/store.js     # 로컬 프로필·전적 (localStorage)
│   ├── ProfileContext.jsx   # 현재 프로필 상태
│   ├── pages/               # Profile·CaseSelect·Lobby·Game·Result
│   ├── components/          # 공용 + 게임 컴포넌트
│   ├── hooks/               # useSocketEvent, useRoomSync, useZoom
│   └── assetUrl.js          # BASE_URL 기준 이미지 경로
├── public/cases/{caseId}/   # scene·thumb·warning·clue_01~10 (.webp)
├── test/                    # node --test 단위 테스트
└── e2e/p2p.e2e.mjs          # P2P 브라우저 E2E
```

**채점 방식**: 제출한 선택지 text가 `answers.js`의 `answer.{question}.text`와 정확히 같으면 정답이다. `choices.js`의 정답 선택지 text와 `answers.js` text는 반드시 같아야 한다. 단위 테스트가 이를 검사한다.

---

## 환경변수 (`client/.env.local`, 모두 선택)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VITE_BASE` | `/` | 빌드 base path. GitHub Pages 서브경로 배포 시 `/mini-crimes/` |
| `VITE_PEER_HOST` 등 | (공용 서버) | 자체 PeerServer 사용 시 `VITE_PEER_HOST`·`PORT`·`PATH`·`SECURE` |
| `VITE_ICE_SERVERS` | (PeerJS 기본값) | 자체 STUN/TURN 지정. `RTCIceServer[]` JSON, 지정 시 기본값(공용 TURN 포함)을 대체 |
| `VITE_PEER_PREFIX` | `mini-crimes-v1-` | PeerJS id 접두어 (같은 시그널링 서버를 쓰는 다른 앱과 충돌 방지) |

---

## 테스트

```bash
cd client
npm run lint
npm test                                   # 단위: 방 로직·채점·프로필·케이스 데이터 정합성(이미지 존재 포함)
npx vite --port 5173 &                      # E2E는 dev 서버 필요
PLAYWRIGHT_MODULE=<playwright 경로> npm run e2e   # P2P 시나리오 8개 (인터넷 필요)
```

E2E 시나리오는 다음 8개다.
1. 프로필 생성
2. 2인 전체 흐름
3. 1인 팀 수사
4. 잘못된 코드·같은 이름 거부
5. 게스트 새로고침 복귀
6. 방장 새로고침 재호스팅
7. 방장 이탈 안내
8. 솔로 채점·전적

---

## 배포 (GitHub Pages)

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 다음 순서로 실행된다(Node 22).
1. lint
2. 단위 테스트
3. 빌드
4. Pages 배포

lint나 테스트가 실패하면 배포하지 않는다.

- Secret(선택): `VITE_BASE` (기본 `/mini-crimes/`)
- SPA 라우팅: `dist/index.html`을 `dist/404.html`로 복사해 처리한다.
- 서버 주소 Secret(`VITE_SERVER_URL`)은 더 이상 쓰지 않는다.

---

## 케이스 목록

### 메인 시리즈 (S1)

| ID | 영문 제목 | 한글 제목 | 설정 |
|----|-----------|-----------|------|
| S1E01 | Homicide in Cold Blood | 냉혹한 살인 | 밀라노 외곽 빌라, 서재 독살 |
| S1E02 | Family Matters | 가족의 문제 | 토스카나 농가, 저녁 식사 중 독살 |
| S1E03 | The Drowned King | 물에 빠진 왕 | 지중해 항구, 요트 익사 |
| S1E04 | Like Cat and Mouse | 고양이와 쥐처럼 | 로마 박물관, 수장고 둔기 폭행(피해자 생존) |
| S1E05 | Game Over | 게임 오버 | 밀라노 e스포츠 센터, 화장실 독살 |
| S1E06 | A Wrong Choice | 잘못된 선택 | 피렌체 외곽 저택, 계단 추락 |
| S1E07 | The Last Masterpiece | 마지막 걸작 | 베네치아 아틀리에, 납 중독 |

### 스페셜 시리즈 (SP)

| ID | 영문 제목 | 한글 제목 | 설정 |
|----|-----------|-----------|------|
| SP01 | Trick or Treat | 트릭 오어 트릿 | 할로윈 파티, 수면제 혼합 후 방치 |
| SP02 | Murder on New Year's Eve | 새해 전야의 살인 | 밀라노 옥상 파티, 난간 조작 추락 |
| SP03 | The Wedding Crash | 결혼식의 참사 | 시칠리아 결혼식, 알레르기 쇼크 |

각 케이스: 단서 카드 10장 + 경고 카드 1장 + 3문항(범인/수단/동기) 4지선다. 정답 포지션 분포(30문항): a 8 / b 7 / c 7 / d 8.

---

## 소켓 이벤트 맵 (P2P 메시지 규약)

C = 플레이어(게스트 또는 방장 자신), H = 방장 방 로직.

| 방향 | 이벤트 | 설명 |
|------|--------|------|
| C→H | `room:create` | 방 생성 (caseId, playerName) — 방장만, 로컬 처리 |
| C→H | `room:join` | 방 입장 / 재접속 (roomId, playerName, token — 필수, 16~64자 `[A-Za-z0-9_-]`, 없으면 `TOKEN_REQUIRED`) |
| C→H | `room:get` | 현재 방 상태 요청 (roomId) — 화면 진입·재연결 시 |
| C→H | `game:start` | 게임 시작 (방장, 로비에서만) |
| C→H | `clue:reveal` | 단서 카드 공개 |
| C→H | `clue:focus` | 단서 카드 포커스 |
| C→H | `warning:use` | 경고 카드 사용 |
| C→H | `note:update` | 공유 노트 변경 |
| C→H | `pointer:move` / `pointer:leave` | 현장 사진 위 포인터 |
| C→H | `answer:submit` | 최종 답안 제출 (진행 중에만) |
| C→H | `game:reveal` | 정답 공개 강제 (방장, 진행 중에만) |
| H→C | `room:state` | 방 상태 전체 |
| H→C | `game:started` | 게임 시작 |
| H→C | `clue:revealed` / `clue:focused` | 단서 공개 확정 / 타인 포커스 |
| H→C | `warning:used` | 경고 카드 사용 확정 |
| H→C | `note:synced` | 공유 노트 동기화 |
| H→C | `pointer:moved` / `pointer:cleared` | 타인 포인터 |
| H→C | `answer:submitted` | 답안 제출 알림 |
| H→C | `game:revealed` | 정답 + 채점 결과 |
| H→C | `player:left` | 플레이어 연결 끊김 (20초 유예) |
| 로컬 | `connect` / `host:lost` | (재)연결됨 / 방장 연결 끊김으로 방 종료 |

---

## 알려진 미결 이슈

- SP01~SP03 배제 단서 부족 6건은 2026-11-14에 기존 단서 본문 보강으로 해결했다(단서 수·이미지 불변, 정답 불변). 상세: `docs/history.md`.
- 인물 이름 중복(루카: S1E01·S1E07 범인, 미켈레: S1E05·SP02 범인, 알베르토: S1E01·S1E03·SP03)은 유지했다. 각 케이스가 독립된 이야기이고, 이름을 바꾸려면 단서·선택지·정답·키워드를 함께 바꿔야 해서 채점이 어긋날 위험이 있다.
- 각 케이스를 실제로 풀 수 있는지는 외부 플레이테스트로 확인해야 한다(정답률·소요 시간·막힌 단서 기록 권장).

---

## 케이스·단서 추가 방법

### 기존 단서 수정

`client/src/data/cases.js`의 해당 케이스 `clueCards` 배열에서 `description`을 수정한다. `label`은 카드 제목, `description`은 본문이다.

### 새 케이스 추가

1. **`client/src/data/cases.js`**: `SEASON_1` 또는 `SPECIAL` 배열에 케이스 객체를 추가한다(정답 필드 없음).
   ```js
   {
     id: 's1e08', season: 1, episode: 8,
     title: 'English Title', titleKo: '한글 제목',
     synopsis: '...',
     sceneImage: '/cases/s1e08/scene.webp', thumbnail: '/cases/s1e08/thumb.webp',
     clueCards: [ clue('s1e08', 1, '단서 제목', '단서 설명'), /* … 10장 */ ],
     warningCard: { id: 'warning', label: '경고 카드', image: '/cases/s1e08/warning.webp', hint: '힌트' },
     questions: STD_QUESTIONS,
   }
   ```
2. **`client/src/data/choices.js`**: 같은 id로 문항별 선택지 4개를 넣는다(정답 표시 없음).
3. **`client/src/data/answers.js`**: 같은 id로 `{ suspect, weapon, motive }: { text, keywords }`를 넣는다. `text`는 정답 선택지 text와 **정확히 일치**해야 한다.
4. **이미지**: `client/public/cases/s1e08/`에 `scene`·`thumb`·`warning`·`clue_01`~`clue_10`(`.webp`)을 추가한다.
5. `npm test`로 정합성(선택지 4개, 정답 1개 일치, 이미지 존재)을 확인한다.
