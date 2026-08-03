const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const proj = data.projects.find(p => p.id === '8a3a2f11-a42f-4e9f-896f-4ac791e2941a');

if (!proj) {
  console.error('Project not found');
  process.exit(1);
}

proj.state.scenes.forEach((s, idx) => {
  console.log(`Scene ${idx}: text: "${s.text.substring(0, 30)}...", start: ${s.start_time}, end: ${s.end_time}, clipId: "${s.clipId}"`);
});
