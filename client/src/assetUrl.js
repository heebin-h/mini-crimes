// public/ 정적 자산 경로를 Vite base(import.meta.env.BASE_URL)에 맞게 해석.
// db.js 이미지 경로는 '/cases/...' 절대경로라 서브경로 배포(GitHub Pages '/mini-crimes/')에서 404가 난다.
// 외부 URL·data URI는 그대로 둔다.
export function assetUrl(path) {
  if (!path || /^(https?:|data:|blob:)/.test(path)) return path;
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
