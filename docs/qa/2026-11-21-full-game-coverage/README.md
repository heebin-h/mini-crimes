# QA: 게임 전체 경우의 수 커버리지 점검 (2026-11-21)

> **정정(2026-11-22):** 이 문서의 "모바일 320 가로 스크롤 없음"은 틀렸고, Chromium 1종만 돌렸다는 한계는 이후 Firefox·WebKit으로 보완했다. 정정 내용·재검증은 [2026-11-22-cross-browser-and-hijack](../2026-11-22-cross-browser-and-hijack/README.md).

## 요약 (먼저 읽기)

- **요청:** "전체 모든 게임 진행 시 모든 진행 방식·변수까지 고려해 테스트하는 게 맞는지 확인하고, 이 게임에서 나올 수 있는 모든 걸 확인하라."
- **먼저 한 것 (감사):** 기존 테스트(단위 31 + E2E 9)가 무엇을 덮는지 대조해 보니, 케이스 10개·팀 1~8명·제출 패턴·결과 도장 같은 **조합**, URL 직접 접근·뒤로가기·XSS·모바일·배포 base 경로가 비어 있었다. 그래서 변수 축을 코드에서 뽑아 [coverage-matrix.md](coverage-matrix.md)로 정리하고, 빈 축마다 테스트를 새로 만들었다.
- **새로 만든 것:**
  - `client/test/exhaustive.test.js` — 채점 640조합 전수, 데이터 유일성, 게임 시뮬레이션(10케이스 × 1~8명 × 진행 방식), 프로토콜 퍼저 3000열·129,792 이벤트
  - `client/e2e/full.e2e.mjs` — 브라우저 E2E 89개 시나리오(솔로 60판, 이미지 130장, 라우팅·프로필·모바일 3종·팀 16)
- **결과:** 단위 40/40, 브라우저 E2E는 개발 서버 88/89(1건 일시 실패, 재현 불가) · GitHub Pages 서브경로(`/mini-crimes/`) 빌드 89/89. 테스트가 버그를 실제로 잡는지 확인하려고 심은 변이 18종은 **18/18**을 잡았다.
- **발견한 실제 동작 2건 + 정책 영향 1건:** [findings.md](findings.md) — ① 노트 입력 후 300ms 안에 새로고침하면 유실, ② 방 코드 앞에 공백이 붙으면(붙여넣기) 6자 제한에 잘려 참가 실패, ③ 새 탭 재참가는 20초 동안 "같은 이름" 거부(참가 토큰 정책의 결과).
- **결론 (정직하게):** 이 게임의 **코드로 도달 가능한 로직·화면·진행 경로**는 전수 또는 조합 단위로 검증했고 결함은 위 3건뿐이다. 그러나 **"나올 수 있는 모든 것"을 증명할 수는 없다.** 실기기, Chromium 외 브라우저, 실제 네트워크(NAT·TURN·침묵 단절), 시나리오의 추리 품질은 이 환경에서 검증하지 못했고, 미검증 목록을 [coverage-matrix.md](coverage-matrix.md) 맨 아래에 따로 적었다.

## 이 폴더의 파일

| 파일 | 내용 |
|---|---|
| `README.md` | 이 문서 |
| [coverage-matrix.md](coverage-matrix.md) | 변수 축별 값 범위 · 검증 수단 · 결과 · 상태(전수/조합/표본/관찰/미검증) |
| [findings.md](findings.md) | 발견 사항, 테스트 오류 정정 이력, 미재현 일시 실패 |
| `logs/` | 실행 원본 로그 전부(아래 표) |
| `mutation/mutate.py` | 변이 테스트 스크립트(사본 디렉터리에 버그를 심어 테스트가 잡는지 확인) |
| `diag/` | 원인 확인에 쓴 진단 스크립트 2개 |

## 로그와 무결성 (SHA-256)

| 로그 | 내용 | SHA-256 |
|---|---|---|
| `logs/unit-test.log` | `npm test` 단위 40건 | `4b8b6315ae9a65033b6911165a83be744fcba12c853c4dcf2c373dad53da88a5` |
| `logs/exhaustive-test.log` | 전수·시뮬레이션·퍼저 9건 단독 실행 | `5778ee833d0478e8d1885ed11cdf92e0b6b5d6caf41f2fc7ab64043e7b90ac67` |
| `logs/mutation-run.log` | 변이 18종 결과(신규 테스트만으로 18/18) | `1c1b6d007a0d3b7789f6b236c5cd11dfee65f3331cf64ee3c1b02ddeac3bf6a7` |
| `logs/e2e-dev-full.log` | 개발 서버 전체 89개(88 통과, 1건 일시 실패) | `ae6f28019cef029194ac57700ca6f0ce946fd193c8ceebf09fd8b2022a3b933e` |
| `logs/e2e-base-path-full.log` | `VITE_BASE=/mini-crimes/` 빌드 전체 89개 **89/89** | `4a174fd72710a7c30a9e05fd38ede0e7c79f7576b6223ebb1ef83f1c657f1f4d` |
| `logs/e2e-solo-repeat-{1,2,3}.log` | 일시 실패 재현 시도: 솔로 60판 × 3회 **각 60/60** | `90a13f04…` / `be3f5a57…` / `10cde91b…` |
| `logs/e2e-misc-first-run-with-test-bugs.log` | 첫 실행(테스트 코드 오류 3건 포함, 정정 전) | `8d54d4c7…` |
| `logs/e2e-team-first-run-with-test-bugs.log` | 팀 첫 실행(테스트 코드 오류 포함, 정정 전) | `e9a89b10…` |

첫 실행 로그 2개는 일부러 남겼다. 실패 원인이 제품이 아니라 **내 테스트 코드의 오류**였음을 숨기지 않기 위해서다([findings.md](findings.md)의 정정 이력).

## 실행 환경과 재현

- 환경: macOS(Darwin 25.5), Node v26.4.0, Playwright(Chromium 1종), 공용 PeerJS 시그널링 `0.peerjs.com` 실제 접속(팀 시나리오).
- 단위·시뮬레이션·퍼저: `cd /Users/heebiny/diyProj/mini-crimes/client && npm test`
- 브라우저 E2E(개발 서버): `npx vite --port 5173` 후 `PLAYWRIGHT_MODULE=<playwright 경로> BASE_URL=http://localhost:5173 node e2e/full.e2e.mjs`
- 배포 경로 검증: `VITE_BASE=/mini-crimes/ npx vite build --outDir <임시폴더>` → `VITE_BASE=/mini-crimes/ npx vite preview --outDir <임시폴더> --port 4173` → `BASE_URL=http://localhost:4173/mini-crimes node e2e/full.e2e.mjs`
- 일부만: `SUITE=solo,img,route,profile,mobile,team` 중 선택, `ONLY=<시나리오 이름 일부>`, `SKIP_TEAM=1`
- `mutation/mutate.py`의 경로는 이 세션의 임시 폴더가 하드코딩돼 있다. 다시 쓰려면 사본 디렉터리 경로(`R`)를 바꿔야 한다.

## 관련 QA

- 공용 시그널링에서 끊긴 피어 id를 다른 사람이 재등록할 수 있는지: [2026-11-20-peerjs-id-reuse](../2026-11-20-peerjs-id-reuse/README.md) — 50/50회 탈취 성공 확인(시그널링 수준).
