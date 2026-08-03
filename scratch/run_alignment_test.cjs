const fs = require('fs');
const path = require('path');

async function test() {
  const { alignScriptAndAudio } = await import('../backend/services/gemini.js');
  
  const dbPath = path.join(__dirname, '../backend/db.json');
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const proj = data.projects.find(p => p.id === '8a3a2f11-a42f-4e9f-896f-4ac791e2941a');
  const settings = data.settings || {};
  const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

  if (!proj) {
    console.error('Project not found');
    return;
  }

  console.log('Voiceover Path:', proj.state.voiceoverPath);
  console.log('Script Text:', proj.state.scriptText);
  console.log('API Key configured:', !!apiKey);

  try {
    const segments = await alignScriptAndAudio(proj.state.scriptText, proj.state.voiceoverPath, apiKey, 'original');
    console.log('Alignment completed successfully!');
    console.log('Segments returned:', segments.length);
    if (segments.length > 0) {
      console.log('First segment sample:', JSON.stringify(segments[0], null, 2));
    }
  } catch (err) {
    console.error('Alignment failed:', err);
  }
}

test();
