const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const proj = data.projects.find(p => p.id === '8a3a2f11-a42f-4e9f-896f-4ac791e2941a');

if (!proj) {
  console.error('Project not found');
  process.exit(1);
}

console.log('Project state keys:', Object.keys(proj.state));
console.log('Project state values:');
for (const key of Object.keys(proj.state)) {
  if (typeof proj.state[key] === 'string') {
    console.log(`- ${key}: "${proj.state[key].substring(0, 100)}..."`);
  } else if (Array.isArray(proj.state[key])) {
    console.log(`- ${key}: [Array of length ${proj.state[key].length}]`);
  } else {
    console.log(`- ${key}:`, proj.state[key]);
  }
}
const wavExists = fs.existsSync(proj.state.voiceoverPath);
console.log('Wav exists at absolute path:', wavExists);
