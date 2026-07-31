const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'history.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function save(records) {
  fs.writeFileSync(FILE, JSON.stringify(records, null, 2));
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
