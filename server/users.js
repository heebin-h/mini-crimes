const path = require('path');
const { DATA_DIR, readJson, writeJsonAtomic } = require('./jsonStore');

const FILE = path.join(DATA_DIR, 'users.json');

function load() {
  return readJson(FILE, []);
}

function save(users) {
  writeJsonAtomic(FILE, users);
}

function findByEmail(email) {
  return load().find(u => u.email === email.toLowerCase()) ?? null;
}

function findById(id) {
  return load().find(u => u.id === id) ?? null;
}

function create({ email, passwordHash, name }) {
  const all = load();
  // re-check inside sync critical section to guard against bcrypt async race
  if (all.some(u => u.email === email.toLowerCase())) return null;
  const user = { id: require('crypto').randomUUID(), email: email.toLowerCase(), passwordHash, name };
  all.push(user);
  save(all);
  return user;
}

module.exports = { findByEmail, findById, create };
