# perf/fix: 케이스 이미지 WebP 전환 + 서브경로 배포 이미지 404 수정

## 요약
- 케이스 이미지 130장 JPEG → WebP(q75): **5.8MB → 4.2MB (−28%)**, 해상도 유지
- GitHub Pages(`/mini-crimes/`) 배포 시 이미지 404 수정: `assetUrl()`로 `BASE_URL` 적용

## 변경 사항
- `client/public/cases/*`: jpg 130장 → webp 130장
- `server/db.js`, `README.md`, `docs/`: 이미지 파일명 `.jpg` → `.webp`
- `client/src/assetUrl.js` 추가 → SceneViewer·CluePanel(타일·모달)·CaseSelectPage 적용

## 검증
- `VITE_BASE=/mini-crimes/` build + preview: 썸네일 7/7, 현장 1280px, 단서 640px 로드, 404 0건
- 10케이스 × 13장 경로-파일 존재 확인, lint 신규 경고 없음
- GitHub Pages 실배포는 미확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
