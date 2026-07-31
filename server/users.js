const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'users.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function save(users) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
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
