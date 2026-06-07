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
  console.log('=== STARTING EMOJI RENDER TEST ===');
  try {
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
        text: 'This is a gym workout that is very strong and hot.',
        start_time: 0.0,
        end_time: 5.0,
        clipId: 'mock-clip-id',
        clipStart: 0.0,
        words: [
          { word: 'This', start_time: 0.0, end_time: 0.5 },
          { word: 'is', start_time: 0.5, end_time: 0.7 },  // 0.20s
          { word: 'a', start_time: 0.7, end_time: 1.0 },   // 0.30s
          { word: 'gym', start_time: 1.0, end_time: 1.8 },
          { word: 'workout', start_time: 1.8, end_time: 2.8 },
          { word: 'that', start_time: 2.8, end_time: 3.3 },
          { word: 'is', start_time: 3.3, end_time: 3.8 },
          { word: 'strong', start_time: 3.8, end_time: 5.0 }
        ]
      }
    ];

    const subtitleStyle = {
      subtitleMode: 'centered-word',
      fontName: 'Anton',
      fontSize: 32,
      fontColor: '#FFFFFF',
      outlineColor: '#000000',
      bold: true,
      shadow: true,
      verticalAlignment: 'bottom',
      highlightColor: '#FFFF00',
      showHighlightBox: true,
      boxColor: '#8A4BF3',
      boxRounding: 12,
      showEmojis: true, // Enable emojis
      textFade: true,
      textTransition: 'slide-up-blur',
      textMotion: 'float'
    };

    console.log('Triggering assembleVideo...');
    const resultPath = await assembleVideo({
      scenes,
      clips,
      voiceoverPath: MOCK_AUDIO_PATH,
      aspectRatio: '9:16',
      fillMode: 'crop',
      subtitleStyle,
      clipTransition: 'none',
      zoomAnimation: false,
      outputDir: path.join(UPLOADS_DIR, 'generated')
    }, (progress, status) => {
      console.log(`[Progress ${progress}%] Status: ${status}`);
    });

    console.log('============================================');
    console.log('✓ TEST SUCCESSFUL!');
    console.log(`Final output video rendered at: ${resultPath}`);
    console.log('============================================');

    // Extracting a frame where "workout" is active (around 2.5s) to visually verify
    console.log('Extracting frame at 2.5s for visual validation...');
    const framePath = path.join(UPLOADS_DIR, 'test_emoji_rendering_frame.png');
    const extractArgs = [
      '-ss', '2.5',
      '-i', resultPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      framePath
    ];
    await runFFmpeg(extractArgs);
    console.log(`Frame saved at: ${framePath}`);

  } catch (error) {
    console.error('✗ TEST FAILED:', error);
  }
}

runTest();
