const fs = require('fs');
const path = require('path');

async function run() {
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

  console.log(`Aligning project ${proj.id}...`);
  try {
    // Call alignScriptAndAudio to generate segments with words
    const rawSegments = await alignScriptAndAudio(proj.state.scriptText, proj.state.voiceoverPath, apiKey, 'original');
    console.log(`Alignment success, returned ${rawSegments.length} segments.`);

    // Map segments back to project scenes
    const alignedScenes = rawSegments.map((seg, idx) => {
      const oldScene = proj.state.scenes[idx] || {};
      return {
        ...oldScene,
        text: seg.text || oldScene.text || '',
        visualDescription: oldScene.visualDescription || 'Abstract cinematic background',
        sfxKeywords: oldScene.sfxKeywords || 'cinematic, abstract',
        transition: oldScene.transition || 'fade',
        sfx: oldScene.sfx || 'none',
        start_time: seg.start_time,
        end_time: seg.end_time,
        words: seg.words,
        words_hindi: seg.words_hindi,
        words_hinglish: seg.words_hinglish
      };
    });

    proj.state.scenes = alignedScenes;
    proj.state.status = 'aligned';
    proj.updatedAt = new Date().toISOString();

    // Write back to db.json
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('Project successfully updated in db.json with aligned scenes containing word timings!');
  } catch (err) {
    console.error('Alignment failed:', err);
  }
}

run();
