# QA: 미검증 항목 재검증 (2026-11-22)

## 요약 (먼저 읽기)

- **요청:** 전 단계(2026-11-21)에서 "검증하지 못한 것"으로 남긴 항목을 제대로 다시 하라.
- **한 것:** 미검증 목록 8개 중 **이 환경에서 할 수 있는 6개를 실행**했다. 실기기와 실제 NAT/TURN 네트워크는 여전히 못 한다(아래 표).
- **새로 확인된 제품 결함·동작 5건**(제품 코드는 수정하지 않음) — [action-items.md](action-items.md) 참조:
  - **F4** 목록 화면이 너비 ≤320px에서 가로로 넘친다(시즌 탭 331px). Chromium·Firefox·WebKit 모두. **전 단계의 "모바일 320 넘침 0" 보고는 틀렸다**(테스트가 못 잡았음, 정정).
  - **F8** 방장이 사라지면 같은 방 id를 선점한 공격자에게 **정상 게스트가 실제로 접속해 이름·참가 토큰을 보낸다**(10/10).
  - **F3b** 게임 진행 중 탭을 닫으면 같은 이름으로 새 탭에서 **영구히** 복귀 불가("이미 진행 중인 게임입니다"). 같은 탭 새로고침만 복귀.
  - **F6** 모달이 Escape로 닫히지 않는다. **F7** `<html lang="en">`인데 UI는 한국어.
- **정정:** 전 단계의 "미재현 일시 실패" 2건(Chromium `s1e04`, 이번 WebKit `sp02`)은 둘 다 *결과 텍스트 전부 false·전적은 정상*이라는 같은 증상이다. 결과 화면 렌더 전에 읽은 **테스트 경쟁 조건**일 가능성이 높아 렌더 대기를 넣었다. 원인을 증명하지는 못했고, 이후 Pages 모사 서버 3엔진 × 솔로 60판(180판)에서 솔로 실패는 0건이었다.

## 미검증 항목별 결과

| 전 단계 미검증 | 이번에 한 것 | 결과 | 아직 못 한 것 |
|---|---|---|---|
| Chromium 외 브라우저 | Firefox·WebKit에서 **전체 89시나리오**(솔로 60·이미지·라우팅·프로필·모바일·팀 16)를 Pages 모사 서버로 실행. 엔진 혼합 팀(Chromium 방장 + WebKit·Firefox 게스트) 14단계 | 3엔진 **각 88/89**(실패 1건은 F4). 혼합 팀 **14/14**(방 생성·참가·노트·단서 동기화·전원 제출·결과) | 실제 Safari 앱, Firefox 데스크톱 실브라우저 |
| 실기기 | Playwright 기기 프로필 8종(터치·UA·DPR·뷰포트) 솔로 한 판 | **6/8**. 실패 2건은 너비 320(iPhone SE, Galaxy S9+) = F4 | 실제 iOS/Android 기기 |
| 침묵 단절 감지 시간 | 게스트의 `RTCDataChannel.send`를 버려 ping이 방장에 도달하지 않게 함 | 방장은 **약 20초**에 게스트를 끊김 처리, 게스트는 재연결 창을 소진하고 **약 54초**에 "방장과의 연결이 끊겨 방이 종료되었습니다". 설계대로 | 실제 망 단절(NAT 타임아웃·모바일 핸드오버). 처음 시도한 CDP `frozen`은 타이머가 안 멈춰 **무효**(로그 `…freeze-invalid.log`) |
| 방장 id 탈취의 앱 수준 영향 | 실제 앱 방장 + 공격자(PeerJS 라이브러리만) + 정상 게스트, 10회 | 방장 접속 중 선점 `unavailable-id` 10/10, 방장 소멸 후 선점 성공 **10/10(약 0.6초)**, 정상 게스트가 공격자에 접속 **10/10**, 공격자가 받은 것: `room:join {roomId, playerName, token}`. 게스트 화면은 9초간 홈에서 오류 없이 대기 | 공격자가 가짜 승인으로 방을 속이는 시나리오, 방장 새로고침 재호스팅과의 경쟁 |
| 장시간·누적 | 방장+게스트 100초 유휴(로비 50 + 게임 50) 후 노트 동기화·제출·결과 | 통과, 오탐 끊김 없음, 오류 0 | 수 시간, 자정·TZ, 메모리 증가 |
| 시나리오 추리 품질 | 휴리스틱: 정답 키워드가 단서 10장 중 몇 장에 나오는가, 오답 핵심어와 비교 | 30문항 **모두 정답 근거 ≥1장**. 오답이 더 많이 언급된 3문항(`s1e03/weapon`, `s1e04/weapon`, `s1e05/motive`)은 미끼 의도인지 사람이 봐야 함 | **사람 플레이테스트**(풀이 가능성·난이도·재미)는 자동화 불가 |
| 실제 GitHub Pages 배포본 | 라이브 사이트 점검 + Pages 동작 모사 서버(404 상태 + `index.html` 본문) | 라이브 사이트는 **구버전**(수정일 2026-11-09, 번들에 `socket.io`만 있고 `peerjs` 없음) — 새 P2P 코드는 배포되지 않음. 모사 서버에서 딥링크·새로고침 정상 | 새 코드의 실제 Pages 동작(배포·push 필요) |
| (F3 미실행 경로) 진행 중 새 탭 재참가 | 같은 탭 새로고침 / 새 탭 즉시 / 새 탭 25초 뒤 | A 복귀 성공, B·C 모두 "⚠ 이미 진행 중인 게임입니다"로 **영구 거부** | — |
| (추가) 동시 방 2개 격리 | 서로 다른 케이스 2방 동시 진행 | 노트·점수 섞임 없음 | 3방 이상 |
| (추가) 접근성 기초 | 키보드·시맨틱 자동 점검 | 키보드만으로 솔로 한 판 완주 가능(3/3). 클릭 전용 비시맨틱 요소 0, alt 누락 0, 이름 없는 버튼 0. 결함: F6(Escape), F7(lang) | 대비·스크린리더 낭독·포커스 순서 적절성 |

## 환경 주의 (결과 해석에 필요)

- **Vite 서버로 서빙한 페이지에서는 Playwright Firefox의 ICE 수집이 시작되지 않았다**(후보 0개, 상태 `new`). 같은 빌드를 Python 정적 서버로 서빙하면 정상(host·srflx 후보 4개). 앱 JS를 차단해도 재현되므로 **앱 코드 탓이 아니다**. Vite 서버 응답의 어떤 차이 때문인지는 **원인 미확정**이다. 그래서 Firefox·WebKit 팀 테스트는 정적/Pages 모사 서버에서 실행했다. 개발 서버 Firefox 로그는 증거로 남겼다(`logs/…vite-ice-failure.log`).
- 이 때문에 "Firefox 사용자가 실제 Pages에서 팀 플레이가 된다"는 **직접 확인은 아니다**(Pages 모사 서버 + Playwright Firefox).
- 모든 실행은 같은 PC 루프백 + 공용 `0.peerjs.com` 시그널링이다.

## 이 폴더의 파일

| 파일 | 내용 |
|---|---|
| [action-items.md](action-items.md) | **커밋할 것·수정할 것 전부 취합** (이 문서의 핵심 산출물) |
| `logs/` | 실행 원본 로그(아래 SHA-256). 실패·무효 로그도 일부러 남김 |
| `pages_like_server.py` | GitHub Pages 모사 정적 서버(없는 경로 → 404 상태 + index 본문) |
| `hijack-app-level.mjs` / `.log` | 앱 수준 id 탈취 10회 |
| `device-emulation.mjs` / `.log` | 기기 프로필 8종 |
| `rejoin-new-tab.mjs` / `.log` | 진행 중 재참가 3경로 |
| `a11y-audit.mjs` / `.log`, `a11y-kbd-flow.mjs` / `.log` | 접근성·키보드 |
| `clue-coverage-heuristic.mjs` / `.log` | 추리 근거 휴리스틱 |
| 테스트 코드 | `client/e2e/cross-browser.e2e.mjs`(혼합 엔진), `client/e2e/soak-edge.e2e.mjs`(유휴·침묵·동시 방), `client/e2e/full.e2e.mjs`(BROWSER·ALLOW_404·정정 반영) |
| 진단 | `../2026-11-21-full-game-coverage/diag/` 의 `overflow-diag.mjs`, `width-sweep.mjs`, `firefox-join-diag.mjs`, `firefox-rtc-prefs.mjs`, `firefox-bisect.mjs` |

## 재현

```bash
# 정적/Pages 모사 서버 (빌드 후)
cd /Users/heebiny/diyProj/mini-crimes/client && npx vite build --outDir /private/tmp/mc-dist --emptyOutDir
python3 /Users/heebiny/diyProj/mini-crimes/docs/qa/2026-11-22-cross-browser-and-hijack/pages_like_server.py /private/tmp/mc-dist 5197 &
# 3엔진 전체
for B in chromium firefox webkit; do BROWSER=$B ALLOW_404=1 PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5197 node e2e/full.e2e.mjs; done
# 혼합 엔진 팀 / 유휴·침묵·동시 방
PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5197 node e2e/cross-browser.e2e.mjs
PLAYWRIGHT_MODULE=<경로> BASE_URL=http://localhost:5197 node e2e/soak-edge.e2e.mjs
```

## 정직한 한계

"전부 확인"은 여전히 주장할 수 없다. 실기기, 실제 NAT/TURN 경유 연결, 수 시간 세션, 사람 플레이테스트, 새 코드의 실제 Pages 배포는 이 환경에서 불가능했고, 그 목록은 [action-items.md](action-items.md) 마지막 절에 사용자가 직접 할 수 있는 방법과 함께 적었다.
