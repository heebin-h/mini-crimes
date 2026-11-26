# 시도별 결과표 — 2차 실행 (추가 25회)

> 원본: [run-2.log](run-2.log). 1차 25회는 [results.md](results.md). 두 실행은 같은 스크립트(`idhijack.mjs`)로 각각 새 id를 사용했다.

| # | 시작(UTC) | 테스트 id | ① 피해자 등록 | ② 접속 중 공격자 등록(대조) | ③ 종료 후 공격자 등록 | ③ 소요(ms) |
|---|---|---|---|---|---|---|
| 1 | 2026-11-20T15:42:05.304Z | `mctheoryycmy2m19zm9ld8n7` | OPEN | ID-TAKEN | OPEN | 564 |
| 2 | 2026-11-20T15:42:07.930Z | `mctheoryanbgo5su1zt95pds` | OPEN | ID-TAKEN | OPEN | 649 |
| 3 | 2026-11-20T15:42:10.519Z | `mctheorympj31ghr8x4y0zzz` | OPEN | ID-TAKEN | OPEN | 656 |
| 4 | 2026-11-20T15:42:13.171Z | `mctheorytooi3l75pj2qkt32` | OPEN | ID-TAKEN | OPEN | 650 |
| 5 | 2026-11-20T15:42:15.774Z | `mctheoryl7tn0k9onra89kjb` | OPEN | ID-TAKEN | OPEN | 659 |
| 6 | 2026-11-20T15:42:18.403Z | `mctheorykfvryk9ftu7ed3rd` | OPEN | ID-TAKEN | OPEN | 550 |
| 7 | 2026-11-20T15:42:20.877Z | `mctheorygy0ofewyzcyl4z2f` | OPEN | ID-TAKEN | OPEN | 536 |
| 8 | 2026-11-20T15:42:23.450Z | `mctheoryjpd5ely7x6odhljs` | OPEN | ID-TAKEN | OPEN | 567 |
| 9 | 2026-11-20T15:42:26.057Z | `mctheory56xvqgdxpmtk0e81` | OPEN | ID-TAKEN | OPEN | 568 |
| 10 | 2026-11-20T15:42:28.659Z | `mctheorytf6noiud6fz1kuh1` | OPEN | ID-TAKEN | OPEN | 565 |
| 11 | 2026-11-20T15:42:31.210Z | `mctheoryv50rc75uo01jbtv3` | OPEN | ID-TAKEN | OPEN | 538 |
| 12 | 2026-11-20T15:42:33.669Z | `mctheoryj39h1433n9nmtg9z` | OPEN | ID-TAKEN | OPEN | 567 |
| 13 | 2026-11-20T15:42:36.246Z | `mctheorytxxh59kn2e0o6yst` | OPEN | ID-TAKEN | OPEN | 645 |
| 14 | 2026-11-20T15:42:38.818Z | `mctheorykav8x1b3jnqi7xkw` | OPEN | ID-TAKEN | OPEN | 663 |
| 15 | 2026-11-20T15:42:41.439Z | `mctheoryes5gsiqersba0cu6` | OPEN | ID-TAKEN | OPEN | 658 |
| 16 | 2026-11-20T15:42:44.091Z | `mctheoryynofwc6mo1cs8w5w` | OPEN | ID-TAKEN | OPEN | 660 |
| 17 | 2026-11-20T15:42:46.725Z | `mctheoryaeetmvrkk9860ry4` | OPEN | ID-TAKEN | OPEN | 550 |
| 18 | 2026-11-20T15:42:49.292Z | `mctheorygseqaks7i0thqs09` | OPEN | ID-TAKEN | OPEN | 566 |
| 19 | 2026-11-20T15:42:51.812Z | `mctheory8kv2nrgq9rbt2avw` | OPEN | ID-TAKEN | OPEN | 560 |
| 20 | 2026-11-20T15:42:54.360Z | `mctheoryqai6qu8egie5i9od` | OPEN | ID-TAKEN | OPEN | 560 |
| 21 | 2026-11-20T15:42:56.964Z | `mctheoryw0ar6fnu2qbs5koi` | OPEN | ID-TAKEN | OPEN | 555 |
| 22 | 2026-11-20T15:42:59.550Z | `mctheoryya6st0o9s33buppe` | OPEN | ID-TAKEN | OPEN | 570 |
| 23 | 2026-11-20T15:43:02.051Z | `mctheory8f1hkmxrjidvccgg` | OPEN | ID-TAKEN | OPEN | 534 |
| 24 | 2026-11-20T15:43:04.553Z | `mctheory1s1g4kzq3l0xl9lu` | OPEN | ID-TAKEN | OPEN | 590 |
| 25 | 2026-11-20T15:43:07.196Z | `mctheory1xf4106mbxn6aw26` | OPEN | ID-TAKEN | OPEN | 622 |

## 집계

- 시도: 25회
- ① 피해자 등록 `OPEN`: 25/25
- ② 접속 중 공격자 `ID-TAKEN`: 25/25, `OPEN`: 0/25
- ③ 종료 후 공격자 `OPEN`(탈취 성공): 25/25, 기타: 0/25
- ③ 소요: 최소 534ms · 중앙값 567ms · 최대 663ms
- 실행 구간 2026-11-20T15:42:05.304Z → 2026-11-20T15:43:09.442Z
