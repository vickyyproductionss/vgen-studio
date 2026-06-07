import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

import { assembleVideo } from './services/video.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const MOCK_CLIP_PATH = path.join(UPLOADS_DIR, 'mock_clip.mp4');
const MOCK_AUDIO_PATH = path.join(UPLOADS_DIR, 'mock_audio.mp3');

// Helper to run ffmpeg
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
  console.log('=== STARTING VIDEO GENERATOR PIPELINE TEST ===');
  console.log(`Using static FFmpeg path: ${ffmpegPath}`);

  try {
    // 1. Ensure uploads directories exist
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'thumbnails'), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'generated'), { recursive: true });

    // 2. Generate mock 5-second video clip if not present
    if (!existsSync(MOCK_CLIP_PATH)) {
      console.log('Generating 5-second mock testsrc video...');
      const videoArgs = [
        '-f', 'lavfi',
        '-i', 'testsrc=duration=5:size=1920x1080:rate=30',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        MOCK_CLIP_PATH
      ];
      await runFFmpeg(videoArgs);
      console.log(`Mock video generated at: ${MOCK_CLIP_PATH}`);
    }

    // 3. Generate mock 5-second silent audio clip if not present
    if (!existsSync(MOCK_AUDIO_PATH)) {
      console.log('Generating 5-second silent audio...');
      const audioArgs = [
        '-f', 'lavfi',
        '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '5',
        '-c:a', 'libmp3lame',
        '-y',
        MOCK_AUDIO_PATH
      ];
      await runFFmpeg(audioArgs);
      console.log(`Mock audio generated at: ${MOCK_AUDIO_PATH}`);
    }

    // 4. Assemble mock data for video generator
    const clips = [
      {
        id: 'mock-clip-id',
        path: MOCK_CLIP_PATH,
        name: 'mock_clip.mp4',
        duration: 5.0
      }
    ];

    const scenes = [
      {
        text: 'Hello, this is a test caption! Video Generator is working.',
        start_time: 0.0,
        end_time: 5.0,
        clipId: 'mock-clip-id',
        clipStart: 0.0,
        words: [
          { word: 'Hello,', start_time: 0.0, end_time: 1.0 },
          { word: 'this', start_time: 1.0, end_time: 1.8 },
          { word: 'is', start_time: 1.8, end_time: 2.3 },
          { word: 'a', start_time: 2.3, end_time: 2.8 },
          { word: 'test', start_time: 2.8, end_time: 3.5 },
          { word: 'caption!', start_time: 3.5, end_time: 4.2 },
          { word: 'Video', start_time: 4.2, end_time: 5.0 }
        ]
      }
    ];

    const subtitleStyle = {
      subtitleMode: 'centered-word',
      fontName: 'Anton', // local custom font
      fontSize: 32,
      fontColor: '#FFFFFF',
      outlineColor: '#000000',
      bold: true,
      shadow: true,
      verticalAlignment: 'bottom',
      highlightColor: '#FFFF00', // Yellow highlighted word
      showHighlightBox: true,
      boxColor: '#8A4BF3',       // Purple background box
      boxRounding: 12
    };

    console.log('Triggering assembleVideo...');
    const resultPath = await assembleVideo({
      scenes,
      clips,
      voiceoverPath: MOCK_AUDIO_PATH,
      aspectRatio: '9:16', // vertical format
      fillMode: 'crop',    // crop center
      subtitleStyle,
      clipTransition: 'fade',
      zoomAnimation: true,
      outputDir: path.join(UPLOADS_DIR, 'generated')
    }, (progress, status) => {
      console.log(`[Progress ${progress}%] Status: ${status}`);
    });

    console.log('============================================');
    console.log('✓ TEST SUCCESSFUL!');
    console.log(`Final output video rendered at: ${resultPath}`);
    console.log('============================================');

  } catch (error) {
    console.error('✗ TEST FAILED:', error);
    process.exit(1);
  }
}

runTest();
