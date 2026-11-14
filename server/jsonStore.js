const fs = require('fs');
const path = require('path');

// JSON 파일 저장소 공용 처리.
// - 파일 없음(ENOENT) → fallback (최초 기동·새 배포 환경)
// - 파일 손상(파싱 실패) → 에러. 빈 목록으로 대체하면 다음 쓰기가 기존 데이터를 통째로 덮어쓰므로 절대 대체하지 않는다.
// - 쓰기는 임시 파일 → rename (원자적 교체, 쓰기 도중 종료돼도 기존 파일 유지). 디렉터리는 자동 생성.

function readJson(file, fallback) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[store] corrupt JSON, refusing to overwrite: ${file} (${e.message})`);
    const err = new Error('STORE_CORRUPT');
    err.status = 500;
    throw err;
  }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

module.exports = { readJson, writeJsonAtomic };
