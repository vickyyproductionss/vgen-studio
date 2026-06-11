import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

import { assembleVideo } from '../services/video.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');
const MOCK_CLIP_PATH = path.join(UPLOADS_DIR, 'mock_clip.mp4');
const MOCK_60FPS_PATH = path.join(UPLOADS_DIR, 'mock_60fps.mp4');
const MOCK_AUDIO_PATH = path.join(UPLOADS_DIR, 'mock_audio.mp3');

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (d) => stderr += d.toString());
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed: ${stderr}`));
    });
  });
}

async function runTest() {
  console.log('=== STARTING YUV TO RGBA COMPILATION TEST ===');
  console.log(`Using static FFmpeg path: ${ffmpegPath}`);

  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'generated'), { recursive: true });

    // 1. Generate standard 30fps B-roll mock clip
    if (!existsSync(MOCK_CLIP_PATH)) {
      console.log('Generating 30fps mock video...');
      await runFFmpeg([
        '-f', 'lavfi',
        '-i', 'testsrc=duration=5:size=1080x1920:rate=30',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        MOCK_CLIP_PATH
      ]);
    }

    // 2. Generate 60fps talking head mock clip (vertical 720x1280 to match user video)
    if (!existsSync(MOCK_60FPS_PATH)) {
      console.log('Generating 60fps mock video (720x1280)...');
      await runFFmpeg([
        '-f', 'lavfi',
        '-i', 'testsrc=duration=5:size=720x1280:rate=60',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        MOCK_60FPS_PATH
      ]);
    }

    // 3. Generate mock audio
    if (!existsSync(MOCK_AUDIO_PATH)) {
      console.log('Generating audio...');
      await runFFmpeg([
        '-f', 'lavfi',
        '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '5',
        '-c:a', 'libmp3lame',
        '-y',
        MOCK_AUDIO_PATH
      ]);
    }

    // 4. Set up mock data
    const clips = [
      {
        id: 'mock-clip-30fps',
        path: MOCK_CLIP_PATH,
        name: 'mock_clip.mp4',
        duration: 5.0
      }
    ];

    const scenes = [
      {
        text: 'Chroma outline and scale test!',
        start_time: 0.0,
        end_time: 5.0,
        clipId: 'mock-clip-30fps',
        clipStart: 0.0,
        words: [
          { word: 'Chroma', start_time: 0.0, end_time: 2.0 },
          { word: 'outline', start_time: 2.0, end_time: 3.5 },
          { word: 'and scale test!', start_time: 3.5, end_time: 5.0 }
        ]
      }
    ];

    const subtitleStyle = {
      subtitleMode: 'centered-word',
      fontName: 'Montserrat',
      fontSize: 24,
      fontColor: '#FFFFFF',
      outlineColor: '#000000',
      bold: true,
      shadow: true
    };

    console.log('Compiling...');
    const resultPath = await assembleVideo({
      scenes,
      clips,
      voiceoverPath: MOCK_AUDIO_PATH,
      originalVideoPath: MOCK_60FPS_PATH, // 60fps talking head input
      aspectRatio: '9:16',
      fillMode: 'crop',
      subtitleStyle,
      clipTransition: 'none',
      zoomAnimation: false,
      outputDir: path.join(UPLOADS_DIR, 'generated'),
      exportFps: 30, // target fps
      
      // Layers settings
      backgroundType: 'none',
      backgroundColor: '#111122',
      talkingHeadEnabled: true,
      talkingHeadChromaColor: '#00ff00',
      talkingHeadChromaSimilarity: 0.15,
      talkingHeadChromaBlend: 0.10,
      talkingHeadSize: 50,
      talkingHeadPosition: 'bottom-right',
      talkingHeadOutlineEnabled: true,
      talkingHeadOutlineColor: '#ff00ff',
      talkingHeadOutlineThickness: 3
    }, (progress, status) => {
      console.log(`[Progress ${progress}%] Status: ${status}`);
    });

    console.log('============================================');
    console.log('✓ TEST COMPLETED SUCCESSFULLY!');
    console.log(`Result path: ${resultPath}`);
    console.log('============================================');

  } catch (error) {
    console.error('✗ TEST FAILED:', error);
    process.exit(1);
  }
}

runTest();
