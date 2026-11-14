const fs = require('fs');
const path = require('path');

// JSON 파일 저장소 공용 처리.
// - 파일 없음(ENOENT) → fallback (최초 기동·새 배포 환경)
// - 파일 손상(파싱 실패·형식 불일치) → 에러. 빈 목록으로 대체하면 다음 쓰기가 기존 데이터를 통째로 덮어쓰므로 절대 대체하지 않는다.
// - 쓰기는 임시 파일(0600) → fsync → rename (원자적 교체). 실패 시 임시 파일 정리. 디렉터리는 자동 생성.

// DATA_DIR: 배포 시 영속 디스크 경로로 지정. 상대경로는 process.cwd() 기준이므로 절대경로 권장. 미지정 시 server/data
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));

function corrupt(file, reason) {
  console.error(`[store] corrupt JSON, refusing to overwrite: ${file} (${reason})`);
  const err = new Error('STORE_CORRUPT');
  err.status = 500;
  return err;
}

function readJson(file, fallback) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw corrupt(file, e.message);
  }
  // 문법은 맞아도 형식이 다르면({}·null 등) 손상으로 취급 — 호출부의 배열 연산 TypeError 방지
  if (Array.isArray(fallback) && !Array.isArray(parsed)) throw corrupt(file, 'expected array');
  return parsed;
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  // 0600: bcrypt 해시 포함 파일. rename은 새 inode로 교체하므로 기존 파일 권한이 유지되지 않는다
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);
  } catch (e) {
    fs.closeSync(fd);
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  fs.closeSync(fd);
  fs.renameSync(tmp, file);
}

module.exports = { DATA_DIR, readJson, writeJsonAtomic };
