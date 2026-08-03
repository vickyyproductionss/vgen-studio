const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const proj = data.projects.find(p => p.id === '8a3a2f11-a42f-4e9f-896f-4ac791e2941a');

if (!proj) {
  console.error('Project not found');
  process.exit(1);
}

console.log('Project state scenes keys:');
proj.state.scenes.forEach((s, idx) => {
  console.log(`Scene ${idx}: text: "${s.text.substring(0, 30)}...", words present: ${!!s.words}, words length: ${s.words ? s.words.length : 'N/A'}, clipId: "${s.clipId}"`);
  if (s.words) {
    console.log('Words sample:', s.words.slice(0, 3));
  }
});
