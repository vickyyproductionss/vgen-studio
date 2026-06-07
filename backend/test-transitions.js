import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { assembleVideo } from './services/video.js';

const UPLOADS_DIR = '/Volumes/1TB/WebProjects/VideoGenerator/backend/uploads';
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
  console.log('=== STARTING TRANSITIONS SUITE TEST ===');
  console.log(`Using static FFmpeg path: ${ffmpegPath}`);

  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'thumbnails'), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'generated'), { recursive: true });

    if (!existsSync(MOCK_CLIP_PATH)) {
      console.log('Generating mock video...');
      const videoArgs = [
        '-f', 'lavfi',
        '-i', 'testsrc=duration=5:size=1920x1080:rate=30',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        MOCK_CLIP_PATH
      ];
      await runFFmpeg(videoArgs);
    }

    if (!existsSync(MOCK_AUDIO_PATH)) {
      console.log('Generating silent audio...');
      const audioArgs = [
        '-f', 'lavfi',
        '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '5',
        '-c:a', 'libmp3lame',
        '-y',
        MOCK_AUDIO_PATH
      ];
      await runFFmpeg(audioArgs);
    }

    const clips = [
      {
        id: 'mock-clip-id',
        path: MOCK_CLIP_PATH,
        name: 'mock_clip.mp4',
        duration: 5.0
      }
    ];

    // We'll test with a 3.0s scene (long enough for slide/blur)
    const scenes = [
      {
        text: 'Transition Test',
        start_time: 0.0,
        end_time: 3.0,
        clipId: 'mock-clip-id',
        clipStart: 0.0
      }
    ];

    const subtitleStyle = {
      subtitleMode: 'classic',
      fontName: 'Arial',
      fontSize: 24,
      fontColor: '#FFFFFF',
      outlineColor: '#000000',
      bold: true,
      shadow: true
    };

    console.log('Testing "blur-slide-left" transition...');
    const resultPath = await assembleVideo({
      scenes,
      clips,
      voiceoverPath: MOCK_AUDIO_PATH,
      aspectRatio: '9:16',
      fillMode: 'crop',
      subtitleStyle,
      clipTransition: 'slide-left-fade', // Test our new slide-left-fade transition combination!
      zoomAnimation: false,
      exportResolution: '1080p',
      exportFps: 30,
      outputDir: path.join(UPLOADS_DIR, 'generated')
    }, (progress, status) => {
      console.log(`[Progress ${progress}%] Status: ${status}`);
    });

    console.log('============================================');
    console.log('✓ TRANSITIONS PIPELINE TEST RENDER SUCCESSFUL!');
    console.log(`Rendered at: ${resultPath}`);
    console.log('============================================');

  } catch (error) {
    console.error('✗ TEST RENDER FAILED:', error);
    process.exit(1);
  }
}

runTest();
