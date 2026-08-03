const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/db.json');
if (!fs.existsSync(dbPath)) {
  console.error('db.json not found at', dbPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const projects = data.projects || [];
console.log(`Found ${projects.length} projects in db.json`);

projects.forEach(proj => {
  const scenes = proj.state?.scenes || [];
  let totalWords = 0;
  scenes.forEach(scene => {
    if (scene.words) {
      totalWords += scene.words.length;
    }
  });
  console.log(`- Project ID: ${proj.id}, Name: "${proj.name}", Type: "${proj.type}", Status: "${proj.state?.status || 'N/A'}", Total Scenes: ${scenes.length}, Total Words: ${totalWords}`);
});
