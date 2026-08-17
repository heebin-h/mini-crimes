# Mini Crimes

온라인 추리 보드게임 웹앱. 최대 8명이 실시간으로 같은 방에서 단서를 공유하며 범인·수단·동기를 추리한다.
솔로 플레이도 지원한다.

---

## 기술 스택

| 레이어 | 스택 |
|--------|------|
| 서버 | Node.js 20 + Express 5 + Socket.IO 4.8 |
| 클라이언트 | React 19 + React Router DOM 7 + Vite 8 |
| 인증 | JWT (30일, localStorage) + bcryptjs |
| 영속성 | JSON 파일 (`server/data/`) |
| 배포 | 클라이언트 → GitHub Pages / 서버 → Render·Railway 등 |

---

## 로컬 실행

```bash
# 1. 서버
cd server
npm install
node index.js          # http://localhost:3001

# 2. 클라이언트 (별도 터미널)
cd client
npm install
npm run dev            # http://localhost:5173
```

개발 시 `vite.config.js`가 `/api`·`/socket.io` 요청을 `localhost:3001`로 프록시한다.
단, `client/src/socket.js`는 `VITE_SERVER_URL`이 비어 있으면 `http://localhost:3001`에 직접 연결하므로, 로컬 개발에서는 서버가 반드시 실행 중이어야 한다.

### 테스트 계정

`server/data/users.json`은 gitignore 대상이므로 저장소에 포함되지 않는다.
로컬에서 테스트하려면 앱에서 직접 회원가입(`/register`)하거나, 아래 계정을 `users.json`에 수동으로 추가한다 (비밀번호 `pass1234`).

| 이름 | 이메일 |
|------|--------|
| 테스트수사관 | test@gmail.com |
| 김민준 | minjun@test.com |
| 이서연 | seoyeon@test.com |
| 박지호 | jiho@test.com |
| 최유나 | yuna@test.com |
| 정하은 | haeun@test.com |

`server/data/users.json`이 없으면 서버 최초 실행 시 빈 배열로 자동 생성된다.

---

## 환경변수

### 서버 (`server/.env`)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | 서버 포트 |
| `JWT_SECRET` | `minicrimessecret2025` | **프로덕션에서는 반드시 교체** |
| `CLIENT_URL` | `http://localhost:5173` | CORS 허용 Origin (배포 시 클라이언트 도메인) |
| `NODE_ENV` | — | `production` 설정 시 `client/dist` 정적 서빙 활성화 |

```bash
# server/.env 예시
PORT=3001
JWT_SECRET=교체하세요_32자_이상_랜덤_문자열
CLIENT_URL=https://<github-username>.github.io
```

### 클라이언트 (`client/.env.local`)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VITE_SERVER_URL` | `''` | REST API base (`api.js`). 빈 문자열이면 Vite 프록시 경유. Socket.IO는 `http://localhost:3001` 직접 연결로 폴백. 배포 시 실제 서버 URL로 설정 |
| `VITE_BASE` | `/` | 빌드 base path. GitHub Pages 서브경로 배포 시 `/mini-crimes/` |

```bash
# client/.env.local 예시 (로컬 개발 — 설정 불필요)
# VITE_SERVER_URL=
# VITE_BASE=/
```

---

## 배포

### 클라이언트 → GitHub Pages

`main` 브랜치 push 시 `.github/workflows/deploy.yml`이 자동 실행된다.

GitHub 저장소 Settings에서 두 Secret을 설정해야 한다:

| Secret | 예시 값 |
|--------|---------|
| `VITE_SERVER_URL` | `https://mini-crimes-api.onrender.com` |
| `VITE_BASE` | `/mini-crimes/` |

SPA 라우팅: `dist/index.html`을 `dist/404.html`로 복사해 GitHub Pages의 404 → SPA fallback을 처리한다.

### 서버 → Render / Railway

환경변수를 아래와 같이 설정:

```
PORT=<자동 할당>
JWT_SECRET=<32자 이상 랜덤>
CLIENT_URL=https://<github-username>.github.io
NODE_ENV=production
```

`NODE_ENV=production`일 때 서버가 `client/dist`를 정적 서빙한다 (단일 서버 배포도 가능).

---

## 케이스 목록

### 메인 시리즈 (S1)

| ID | 영문 제목 | 한글 제목 | 설정 |
|----|-----------|-----------|------|
| S1E01 | Homicide in Cold Blood | 냉혹한 살인 | 밀라노 외곽 빌라, 서재 독살 |
| S1E02 | Family Matters | 가족의 문제 | 토스카나 농가, 저녁 식사 중 독살 |
| S1E03 | The Drowned King | 물에 빠진 왕 | 지중해 항구, 요트 익사 |
| S1E04 | Like Cat and Mouse | 고양이와 쥐처럼 | 로마 박물관, 수장고 둔기 살인 |
| S1E05 | Game Over | 게임 오버 | 밀라노 e스포츠 센터, 화장실 독살 |
| S1E06 | A Wrong Choice | 잘못된 선택 | 피렌체 외곽 저택, 계단 추락 |
| S1E07 | The Last Masterpiece | 마지막 걸작 | 베네치아 아틀리에, 납 중독 |

### 스페셜 시리즈 (SP)

| ID | 영문 제목 | 한글 제목 | 설정 |
|----|-----------|-----------|------|
| SP01 | Trick or Treat | 트릭 오어 트릿 | 할로윈 파티, 수면제 혼합 후 방치 |
| SP02 | Murder on New Year's Eve | 새해 전야의 살인 | 밀라노 옥상 파티, 난간 조작 추락 |
| SP03 | The Wedding Crash | 결혼식의 참사 | 시칠리아 결혼식, 알레르기 쇼크 |

각 케이스: 단서 카드 10장 + 경고 카드 1장 + 3문항(범인/수단/동기) 4지선다.

---

## 데이터 파일 구조

```
server/
├── data/
│   ├── users.json       # 회원 목록 (gitignore, 서버 최초 실행 시 자동 생성)
│   └── history.json     # 플레이 기록 (gitignore, 첫 플레이 후 자동 생성)
├── db.js                # 케이스 데이터 + 정답 (10개 케이스)
├── choices.js           # 선택지 목록 (correct:true = 서버 전용)
├── scoring.js           # 채점 로직
├── rooms.js             # 멀티플레이 방 상태 관리 (in-memory)
├── users.js             # 회원 CRUD (file-based)
├── history.js           # 기록 CRUD (file-based)
├── index.js             # Express 서버 + Socket.IO 이벤트
└── test-multi-flow.mjs  # 멀티플레이 플로우 통합 테스트

client/src/
├── pages/               # 라우트 단위 페이지 컴포넌트
├── components/          # 공용 + 게임 전용 컴포넌트
├── hooks/               # useSocket, useZoom 등 커스텀 훅
├── data/                # 클라이언트 전용 정적 데이터
├── App.jsx              # BrowserRouter + 라우트 정의
├── AuthContext.jsx      # JWT 인증 상태 전역 관리
├── socket.js            # Socket.IO 인스턴스 (autoConnect: false)
└── api.js               # REST API base URL 헬퍼
```

**채점 방식**: 플레이어가 제출한 선택지 text를 `choices.js`의 `correct:true` 항목 text와 비교한다. `choices.js`에 선택지가 없는 경우에만 `db.js` `answer.keywords` 부분 일치 폴백을 사용한다. `choices.js` text와 `db.js` answer.text는 항상 동일해야 한다 (어긋나면 채점 불가).

**정답 포지션 분포** (총 30문항):
- a: 8개 / b: 7개 / c: 7개 / d: 8개

---

## 소켓 이벤트 맵

| 방향 | 이벤트 | 설명 |
|------|--------|------|
| C→S | `room:create` | 방 생성 (caseId, playerName) |
| C→S | `room:join` | 방 입장 / 재연결 (roomId, playerName) |
| C→S | `game:start` | 게임 시작 (방장만) |
| C→S | `clue:reveal` | 단서 카드 공개 |
| C→S | `clue:focus` | 단서 카드 포커스 브로드캐스트 |
| C→S | `warning:use` | 경고 카드 사용 |
| C→S | `note:update` | 공유 노트 변경 |
| C→S | `pointer:move` | 마우스 포인터 위치 브로드캐스트 |
| C→S | `pointer:leave` | 마우스 포인터 이탈 |
| C→S | `answer:submit` | 최종 답안 제출 |
| C→S | `game:reveal` | 정답 공개 강제 (방장만) |
| S→C | `room:state` | 방 상태 전체 동기화 |
| S→C | `game:started` | 게임 시작 알림 |
| S→C | `clue:revealed` | 단서 공개 확정 |
| S→C | `clue:focused` | 타인 단서 포커스 |
| S→C | `warning:used` | 경고 카드 사용 확정 |
| S→C | `note:synced` | 공유 노트 동기화 |
| S→C | `pointer:moved` | 타인 포인터 위치 |
| S→C | `pointer:cleared` | 타인 포인터 제거 (`pointer:leave` 수신 시 발생) |
| S→C | `answer:submitted` | 답안 제출 알림 |
| S→C | `game:revealed` | 정답 + 채점 결과 |
| S→C | `player:left` | 플레이어 이탈 |

---

## REST API

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| POST | `/api/auth/register` | — | 회원가입 |
| POST | `/api/auth/login` | — | 로그인 |
| GET | `/api/auth/me` | JWT | 내 정보 |
| GET | `/api/cases` | — | 케이스 목록 (정답 제외) |
| POST | `/api/score` | 선택 | 솔로 채점 + 기록 저장 |
| GET | `/api/history` | JWT | 내 플레이 기록 |

---

## 알려진 미결 이슈

### MEDIUM — 스토리 단서 보강 필요 (db.js)

| 케이스 | 이슈 |
|--------|------|
| SP01 | 에밀리 크레인(전처) 배제 단서 없음 — 힐 자국이 나탈리를 특정하는 근거 미흡 |
| SP01 | 커티스 레인(소송 상대방) 파티 알리바이 배제 단서 없음 |
| SP02 | 프란체스카 아내, 11:45 이후 소재 불명 — 완전 배제 불가 |
| SP02 | 재킷 물증(현장 카드)이 단서 흐름에서 끊김 |
| SP03 | 알베르토(신랑) 배제 근거가 "전날 밤 호텔" — 당일 낮 알리바이 미커버 |
| SP03 | 루치아노 배제가 케이크 구역만 커버, 에피펜 은닉 행위는 불배제 |

위 이슈는 새 단서 카드 추가 또는 기존 단서 내용 보강으로 해결 가능. `db.js`의 `clueCards` 배열에 단서를 추가하거나 기존 단서 텍스트를 수정한다.

---

## 케이스·단서 추가 방법

### 기존 단서 수정

`server/db.js`의 해당 케이스 `clueCards` 배열에서 `description` 텍스트를 수정한다.
`label`은 카드 제목, `description`은 카드 본문이다.

### 새 단서 카드 추가

단서 인덱스는 `1`~`10`이 기본. 11번째가 필요하면 인덱스 번호만 늘리면 된다.
이미지 파일(`clue_11.jpg` 등)은 `client/public/cases/{caseId}/`에 추가한다.

```js
// db.js clueCards 배열 예시
clue('s1e01', 11, '카드 제목', '카드 설명 텍스트'),
```

`clue(caseId, index, label, description)` 함수가 id·image 경로를 자동 생성한다.

### 새 케이스 추가

1. **`server/db.js`** — `SEASON_1` 또는 `SPECIALS` 배열에 케이스 객체 추가:
   ```js
   {
     id: 's1e08',            // 고유 ID (소문자)
     season: 1, episode: 8,
     title: 'English Title', titleKo: '한글 제목',
     synopsis: '...',
     sceneImage: '/cases/s1e08/scene.jpg',
     thumbnail: '/cases/s1e08/thumb.jpg',
     clueCards: [
       clue('s1e08', 1, '단서 제목', '단서 설명'),
       // ... 최대 10장
     ],
     warningCard: { id: 'warning', label: '경고 카드', hint: '힌트 텍스트', image: '/cases/s1e08/warning.jpg' },
     answer: {
       suspect: { text: '정답 용의자 텍스트', keywords: ['키워드'] },
       weapon:  { text: '정답 수단 텍스트',   keywords: ['키워드'] },
       motive:  { text: '정답 동기 텍스트',   keywords: ['키워드'] },
     },
   }
   ```

2. **`server/choices.js`** — 동일 ID 키로 선택지 추가 (`correct: true`는 정답 하나만):
   ```js
   s1e08: {
     suspect: [
       { id: 'a', text: '...' },
       { id: 'b', text: '...', correct: true },
       { id: 'c', text: '...' },
       { id: 'd', text: '...' },
     ],
     weapon:  [ /* 동일 구조 */ ],
     motive:  [ /* 동일 구조 */ ],
   },
   ```
   `correct: true` 항목의 `text`는 `db.js` `answer.{question}.text`와 **정확히 일치**해야 한다.

3. **이미지** — `client/public/cases/s1e08/`에 `scene.jpg`, `thumb.jpg`, `warning.jpg`, `clue_01.jpg`~`clue_10.jpg` 추가.

---

## 개발 메모

- **재연결**: Socket.IO 재연결 시 새 socket.id가 발급됨. `rooms.js`의 `joinRoom`이 이름 기반으로 disconnected 플레이어를 찾아 socket.id를 갱신하고 방장 권한도 복원한다. 게임 중 재연결도 허용(신규 입장만 로비 제한).
- **정답 보안**: `choices.js`의 `correct:true`는 클라이언트에 전달하지 않는다 (`casesForClient()`에서 제거). 정답은 서버 채점 시에만 사용.
- **SPA fallback**: Express 프로덕션 모드에서 `app.use()` + `req.path.startsWith('/api')` 체크로 처리 (Express 5는 regex route 미지원).
- **JWT decode**: `atob()`는 base64url 미지원. `AuthContext.jsx`에서 `-`→`+`, `_`→`/` 치환 후 TextDecoder로 디코딩.
- **choices.js text 동기화**: `choices.js`의 `correct:true` 항목 text는 `db.js` `answer.text`와 반드시 동일해야 한다. 어긋나면 항상 오답 처리.
