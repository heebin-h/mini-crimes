const path = require('path');
const { readJson, writeJsonAtomic } = require('./jsonStore');

// DATA_DIR: 배포 시 영속 디스크 경로로 지정 (미지정 시 server/data)
const FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'history.json');

function load() {
  return readJson(FILE, []);
}

function save(records) {
  writeJsonAtomic(FILE, records);
}

// record: { userId, caseId, caseTitle, mode, correct, total, efficiencyScore, stamp, playedAt }
function add(record) {
  const all = load();
  all.unshift({ id: Date.now().toString(36), ...record });
  // 유저당 최대 100건 유지
  const trimmed = all.filter(r => r.userId !== record.userId).concat(
    all.filter(r => r.userId === record.userId).slice(0, 100)
  );
  save(trimmed);
}

function getByUser(userId) {
  return load().filter(r => r.userId === userId);
}

module.exports = { add, getByUser };
