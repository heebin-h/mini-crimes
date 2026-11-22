# feat: GitHub Pages 정적 전환 — P2P 팀 수사 + 로컬 프로필 + 모바일 + 콘텐츠 보강

## 요약
서버 없이 **GitHub Pages만으로 동작**하도록 전환한다.
- 팀 수사: WebRTC P2P(PeerJS, 공용 시그널링). 방장 브라우저가 방 로직을 실행한다.
- 계정: 기기별 로컬 프로필(비밀번호 없음). 전적은 브라우저에 저장한다.
- 모바일 반응형, CI lint·test, SP01~03 단서 보강, 문서 정합성을 함께 반영했다.

> 기준 브랜치 메모: 이 브랜치는 `fix/room-state-sync`·`fix/server-authority-data-safety` 위에 쌓여 있다. origin/main(PR #2)도 이미 병합했다. 서버를 삭제하므로 앞선 두 PR의 서버 쪽 수정은 결과에 남지 않는다. 클라이언트 쪽 수정(room:get 동기화 등)은 이어진다.

## 변경 사항
- **데이터·채점** (`client/src/data/`, `game/grading.js`): 서버 데이터를 이전했다(원본과 10케이스 동일성 확인). 정답은 채점할 때만 불러오는 별도 청크로 분리했다.
- **P2P** (`net/socket.js`, `net/hostRoom.js`)
  - socket.io 호환 API라 화면의 이벤트 규약은 그대로다.
  - 방장 쪽 검증: phase, payload 정리·예외 격리, id·길이 검증, 빈도 제한, 같은 이름 거부.
  - 새로고침 복구: 게스트 재접속, 방장 재호스팅.
  - 끊김 유예 20초, 페이지 이탈 시 bye 신호, 방장 이탈 시 안내.
- **프로필** (`profile/store.js`, `ProfilePage`): 로그인·회원가입을 제거했다. 손상된 저장값은 백업해 보존한다.
- **모바일**: 768px 이하 세로 배치.
- **CI**: lint·단위 테스트가 실패하면 배포하지 않는다. Node 22. `VITE_SERVER_URL`을 제거했다.
- **삭제**: `server/`(마지막 서버 버전 `b2ddb49`), `AuthContext`·`AuthPage`·`api.js`, socket.io-client.
- **콘텐츠**
  - SP01~03 배제 단서 10건 보강(정답 불변).
  - 시나리오 V3를 4지선다 판정으로 교체.
  - 오타, 119→118, 원→유로/달러 정리.

## 검증 (로컬)
- 단위 테스트 21건 PASS: 방 로직 15, 데이터·채점·프로필 6.
- P2P E2E 9/9 PASS (공용 PeerJS 경유)
  - 프로필 생성
  - 2인 전체 흐름
  - 1인 팀 수사
  - 잘못된 코드·같은 이름 거부
  - 게스트 새로고침 복귀
  - 방장 새로고침 재호스팅(약 0.8초)
  - 방장 5초 이탈 후 복귀 → 게스트 재연결
  - 방장 이탈 안내(약 22초)
  - 솔로 채점·전적
- 모바일(iPhone 13 뷰포트) 7화면: 화면 밖 컨트롤 0개, 가로 스크롤 없음.
- `VITE_BASE=/mini-crimes/` 빌드 성공.
- 독립 리뷰 1회: 조건부 판정. 높음 2(peer 오류 시 파기, 게스트 `room:create` 방장 탈취)·중간 3·낮음 다수 반영(`1dc8656`). 높음 1은 신규 E2E에서 수정 전 FAIL → 수정 후 PASS로 확인.

## 미검증 / 배포 후 확인
- GitHub Actions 실제 실행, Pages 실배포 동작.
- 서로 다른 네트워크·모바일 데이터 환경의 P2P 연결(TURN 없음).
- 실기기 iOS Safari·Android Chrome.
- 외부 플레이테스트(케이스 해결 가능성).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
