const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const proj = data.projects.find(p => p.id === '8a3a2f11-a42f-4e9f-896f-4ac791e2941a');

if (!proj) {
  console.error('Project not found');
  process.exit(1);
}

console.log('Project ID:', proj.id);
console.log('Voiceover Path:', proj.state.voiceoverPath);
console.log('Voiceover URL:', proj.state.voiceoverUrl);
console.log('Script Text length:', proj.state.scriptText?.length);
const fullVoiceoverPath = path.resolve(__dirname, '..', 'backend', proj.state.voiceoverPath.replace(/^\//, ''));
console.log('Full Voiceover Path resolved:', fullVoiceoverPath);
console.log('File exists:', fs.existsSync(fullVoiceoverPath));
