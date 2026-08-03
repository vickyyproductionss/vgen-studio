const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const proj = data.projects.find(p => p.id === '8a3a2f11-a42f-4e9f-896f-4ac791e2941a');

if (!proj) {
  console.error('Project not found');
  process.exit(1);
}

console.log('scriptText length:', proj.state.scriptText ? proj.state.scriptText.length : 'N/A');
console.log('scriptText content:', JSON.stringify(proj.state.scriptText));
console.log('shortScriptText length:', proj.state.shortScriptText ? proj.state.shortScriptText.length : 'N/A');
console.log('shortScriptText content:', JSON.stringify(proj.state.shortScriptText));
console.log('scenes length:', proj.state.scenes ? proj.state.scenes.length : 'N/A');
if (proj.state.scenes && proj.state.scenes.length > 0) {
  console.log('Scene 0:', JSON.stringify(proj.state.scenes[0], null, 2));
}
