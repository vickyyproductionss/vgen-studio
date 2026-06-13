import 'dotenv/config';
import { analyzeRecreatedReel, matchRecreatedScenes } from './services/gemini.js';
import { extractAudioFromVideo } from './services/video.js';
import { dbService } from './services/firestore.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECREATE_DIR = path.join(__dirname, 'uploads', 'recreate');
mkdirSync(RECREATE_DIR, { recursive: true });

function runDownloadReel(url, outDir, filename, ffmpegPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'services', 'download_reel.py');
    const args = [scriptPath, url, outDir, filename];
    if (ffmpegPath) {
      args.push(ffmpegPath);
    }
    
    console.log(`Running downloader script: python3 ${args.join(' ')}`);
    const proc = spawn('python3', args);
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (d) => stdout += d.toString());
    proc.stderr.on('data', (d) => stderr += d.toString());
    
    proc.on('close', (code) => {
      console.log(`Downloader stdout:\n${stdout}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Reel download failed with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}

async function runTest() {
  const url = 'https://www.youtube.com/shorts/pVRefGmQDJM'; // Simple public test YouTube Short
  const filename = 'test_reel.mp4';
  const videoPath = path.join(RECREATE_DIR, filename);
  const audioPath = path.join(RECREATE_DIR, 'test_audio.mp3');
  
  // Load API Key from db.json
  const dbPath = path.join(__dirname, 'db.json');
  const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
  const apiKey = db.settings?.geminiApiKey || process.env.GEMINI_API_KEY;
  console.log(`Using API Key: ${apiKey ? 'Found' : 'Not Found'}`);

  console.log('--- TEST DOWNLOAD ---');
  await runDownloadReel(url, RECREATE_DIR, filename, ffmpegPath);
  
  if (existsSync(videoPath)) {
    console.log('Video downloaded successfully at:', videoPath);
    
    console.log('--- TEST AUDIO EXTRACTION ---');
    await extractAudioFromVideo(videoPath, audioPath);
    console.log('Audio extracted successfully at:', audioPath);
    
    console.log('--- TEST GEMINI REEL ANALYSIS ---');
    const analysis = await analyzeRecreatedReel(videoPath, apiKey);
    console.log('Gemini Reel Analysis output:', JSON.stringify(analysis, null, 2));
    
    console.log('--- TEST CLIP MATCHING ---');
    const clips = await dbService.getClips('local-user');
    console.log(`Found ${clips.length} library clips.`);
    if (clips.length > 0) {
      const matches = await matchRecreatedScenes(analysis.scenes, clips, apiKey);
      console.log('Matches output:', JSON.stringify(matches, null, 2));
    } else {
      console.log('No clips found in database. Skipping clip matching test.');
    }
  } else {
    console.error('Download failed, video file not found.');
  }
}

runTest().catch(console.error);
