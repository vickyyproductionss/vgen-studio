import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { assembleVideo } from './services/video.js';

const UPLOADS_DIR = '/Volumes/1TB/WebProjects/VideoGenerator/backend/uploads';
const MOCK_CLIP_PATH = path.join(UPLOADS_DIR, 'mock_clip.mp4');
const MOCK_AUDIO_PATH = path.join(UPLOADS_DIR, 'mock_audio.mp3');
const MOCK_BGM_PATH = path.join(UPLOADS_DIR, 'mock_bgm.mp3');
const MOCK_SFX_PATH = path.join(UPLOADS_DIR, 'sfx', 'cinematic-swoosh.mp3');

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
  console.log('=== STARTING AUDIO MIXING SUITE TEST ===');
  console.log(`Using static FFmpeg path: ${ffmpegPath}`);

  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'thumbnails'), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'generated'), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_DIR, 'sfx'), { recursive: true });

    if (!existsSync(MOCK_CLIP_PATH)) {
      console.log('Generating mock video...');
      const videoArgs = [
        '-f', 'lavfi',
        '-i', 'testsrc=duration=10:size=1920x1080:rate=30',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        MOCK_CLIP_PATH
      ];
      await runFFmpeg(videoArgs);
    }

    if (!existsSync(MOCK_AUDIO_PATH)) {
      console.log('Generating voiceover audio...');
      const audioArgs = [
        '-f', 'lavfi',
        '-i', 'sine=frequency=1000:duration=10',
        '-c:a', 'libmp3lame',
        '-y',
        MOCK_AUDIO_PATH
      ];
      await runFFmpeg(audioArgs);
    }

    if (!existsSync(MOCK_BGM_PATH)) {
      console.log('Generating background music audio...');
      const bgmArgs = [
        '-f', 'lavfi',
        '-i', 'sine=frequency=200:duration=10',
        '-c:a', 'libmp3lame',
        '-y',
        MOCK_BGM_PATH
      ];
      await runFFmpeg(bgmArgs);
    }

    if (!existsSync(MOCK_SFX_PATH)) {
      console.log('Generating swoosh SFX...');
      const sfxArgs = [
        '-f', 'lavfi',
        '-i', 'sine=frequency=3000:duration=1',
        '-c:a', 'libmp3lame',
        '-y',
        MOCK_SFX_PATH
      ];
      await runFFmpeg(sfxArgs);
    }

    const clips = [
      {
        id: 'mock-clip-id',
        path: MOCK_CLIP_PATH,
        name: 'mock_clip.mp4',
        duration: 10.0
      }
    ];

    // We'll test with a 3 scene layout and active SFX
    const scenes = [
      {
        text: 'Scene 1',
        start_time: 0.0,
        end_time: 3.0,
        clipId: 'mock-clip-id',
        clipStart: 0.0,
        sfx: 'cinematic-swoosh'
      },
      {
        text: 'Scene 2',
        start_time: 3.0,
        end_time: 6.0,
        clipId: 'mock-clip-id',
        clipStart: 3.0,
        sfx: 'cinematic-swoosh'
      },
      {
        text: 'Scene 3',
        start_time: 6.0,
        end_time: 10.0,
        clipId: 'mock-clip-id',
        clipStart: 6.0,
        sfx: 'none'
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

    console.log('Running render with mixed voiceover, BGM and SFXs...');
    const resultPath = await assembleVideo({
      scenes,
      clips,
      voiceoverPath: MOCK_AUDIO_PATH,
      bgMusicPath: MOCK_BGM_PATH,
      bgMusicVolume: 0.15,
      voiceoverVolume: 1.5,
      aspectRatio: '9:16',
      fillMode: 'crop',
      subtitleStyle,
      clipTransition: 'none',
      zoomAnimation: false,
      exportResolution: '1080p',
      exportFps: 30,
      outputDir: path.join(UPLOADS_DIR, 'generated')
    }, (progress, status) => {
      console.log(`[Progress ${progress}%] Status: ${status}`);
    });

    console.log('============================================');
    console.log('✓ AUDIO MIXING SUITE TEST RENDER SUCCESSFUL!');
    console.log(`Rendered at: ${resultPath}`);
    console.log('============================================');

  } catch (error) {
    console.error('✗ TEST RENDER FAILED:', error);
    process.exit(1);
  }
}

runTest();
