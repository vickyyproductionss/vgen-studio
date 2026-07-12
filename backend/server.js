import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, appendFileSync, statSync, unlinkSync, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

// Import services
import { 
  analyzeVideo, 
  alignScriptAndAudio, 
  matchClipsToScenes, 
  enhanceScriptWithTags,
  analyzeRecreatedReel,
  matchRecreatedScenes,
  analyzeSubjectPhoto,
  generateSubjectSummary,
  generateAiAsset,
  generateYoutubeScriptAndStoryboard,
  generateYoutubeShortScript,
  enrichScenesMetadata,
  extractStoryGraph,
  suggestStorytellerAndAssetsForScenes,
  generateViralVideoIdeaFromClips
} from './services/gemini.js';
import { getVoices, generateSpeech } from './services/elevenlabs.js';
import { getVideoDuration, generateThumbnail, assembleVideo, ensureFontExists, extractAudioFromVideo, getLocalWordTimings, runFFmpeg } from './services/video.js';
import { detectBeats } from './services/beats.js';
import { getGcpWordTimings, assignTimestampsToWords, mapTimestamps } from './services/speech.js';
import { dbService } from './services/firestore.js';
import { gcsService } from './services/gcs.js';
import { Storage } from '@google-cloud/storage';
import { searchStockVideo, downloadStockVideo } from './services/stock.js';
import { startGcpLipsyncJob, getGcpJobStatus } from './services/gcpAvatar.js';
import { renderRemotionVideo } from './services/remotionRenderer.js';
// Local SadTalker kept as fallback (used if AVATAR_API_URL is not set)
import { startLipsyncJob, lipsyncJobs } from './services/sadtalker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const strongVerbs = /\b(clash|clashed|clashing|sever|severed|severing|boom|boomed|booming|fuse|fused|fusing|shatter|shattered|shattering|explode|exploded|exploding|burst|bursts|smash|smashed|smashing|strike|strikes|striking|struck|impact|impacted|shake|shook|shaking|glitch|glitched|glitching)\b/i;

function autoEnrichSceneVerbs(scenes) {
  if (!scenes || !Array.isArray(scenes)) return scenes;
  return scenes.map(scene => {
    const text = (scene.text || '').toLowerCase();

    // Default Storyteller Engine Fallbacks
    if (scene.layout === undefined) {
      scene.layout = 'graph';
    }
    if (scene.layoutProps === undefined) {
      scene.layoutProps = {};
    }
    if (scene.ambientSoundscape === undefined) {
      scene.ambientSoundscape = 'none';
    }
    if (scene.postProcessingPreset === undefined) {
      scene.postProcessingPreset = 'none';
    }

    if (strongVerbs.test(text)) {
      if (scene.shake === undefined) {
        scene.shake = true;
        scene.shakeIntensity = scene.shakeIntensity || 20;
        scene.shakeSpeed = scene.shakeSpeed || 18;
      }
      if (!scene.sfx || scene.sfx === 'none') {
        if (text.includes('glitch') || text.includes('fuse') || text.includes('sever')) {
          scene.sfx = 'trans_glitch_digital';
        } else if (text.includes('boom') || text.includes('explode') || text.includes('impact') || text.includes('clash')) {
          scene.sfx = 'trans_swoosh_deep';
        } else {
          scene.sfx = 'trans_swoosh_fast';
        }
      }
    } else {
      if (scene.shake === undefined) {
        scene.shake = false;
      }
    }
    return scene;
  });
}

function resolvePath(filePath) {
  if (!filePath) return filePath;
  
  // Try resolving as absolute path first
  if (path.isAbsolute(filePath) && existsSync(filePath)) {
    return filePath;
  }
  
  // Try resolving relative to backend directory (__dirname)
  const resolvedDir = path.resolve(__dirname, filePath);
  if (existsSync(resolvedDir)) {
    return resolvedDir;
  }
  
  // Try resolving relative to project root
  const resolvedRoot = path.resolve(__dirname, '..', filePath);
  if (existsSync(resolvedRoot)) {
    return resolvedRoot;
  }

  // If path contains "uploads/", resolve relative to __dirname
  if (filePath.includes('uploads/')) {
    const relativePart = filePath.substring(filePath.indexOf('uploads/'));
    return path.join(__dirname, relativePart);
  }

  return filePath;
}

function logErrorToFile(context, error) {
  try {
    appendFileSync(path.join(__dirname, 'error.log'), `${new Date().toISOString()} - [${context}] Error: ${error.message}\n${error.stack}\n\n`);
  } catch (err) {
    console.error('Failed to write to error.log:', err);
  }
}

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: '*',
  exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length', 'Content-Type']
}));
app.use(express.json({ limit: '50mb' }));

// Ensure required directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CLIPS_DIR = path.join(UPLOADS_DIR, 'clips');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');
const GENERATED_DIR = path.join(UPLOADS_DIR, 'generated');
const MUSIC_DIR = path.join(UPLOADS_DIR, 'music');
const RECREATE_DIR = path.join(UPLOADS_DIR, 'recreate');
const SUBJECT_DIR = path.join(UPLOADS_DIR, 'subject');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');

await fs.mkdir(CLIPS_DIR, { recursive: true });
await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
await fs.mkdir(GENERATED_DIR, { recursive: true });
await fs.mkdir(MUSIC_DIR, { recursive: true });
await fs.mkdir(RECREATE_DIR, { recursive: true });
await fs.mkdir(SUBJECT_DIR, { recursive: true });
await fs.mkdir(AVATARS_DIR, { recursive: true });

// Serve uploads folder as static
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Content-Type');
    res.setHeader('Connection', 'close');
  }
}));
// Serve presets (avatar images etc.) as static
app.use('/uploads/presets', express.static(path.join(__dirname, 'presets')));

// Serve React frontend static files in production
app.use(express.static(path.join(__dirname, '../dist')));

// Database Helpers (Obsolete: Firestore/dbService is used instead)

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CLIPS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB per file
});

const musicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MUSIC_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadMusic = multer({ storage: musicStorage });

const subjectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SUBJECT_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadSubject = multer({ storage: subjectStorage });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${uuidv4()}${ext}`);
  }
});
const uploadAvatar = multer({ storage: avatarStorage });

// Active jobs tracking
const activeJobs = new Map();

// ==========================================
// SaaS Auth & Billing Mock APIs
// ==========================================
function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // token is email
  }
  return 'local-user';
}

const isProduction = !!process.env.K_SERVICE;

// Authentication wall middleware for production (GCP Cloud Run)
app.use('/api', (req, res, next) => {
  const publicPaths = ['/health', '/auth/login', '/auth/register', '/auth/me'];
  
  const requestPath = req.path;
  if (publicPaths.includes(requestPath)) {
    return next();
  }

  // Allow Remotion server-side renderer to fetch clip videos and job progress
  // without auth headers (these are server-to-server calls inside the container)
  if (/^\/clips\/[^/]+\/video$/.test(requestPath)) return next();
  if (/^\/jobs\/[^/]+\/progress$/.test(requestPath)) return next();
  
  const userId = getUserId(req);
  if (isProduction && userId === 'local-user') {
    console.warn(`[Auth Warning] Blocked unauthenticated request to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
});

// ==========================================
// Health Check (Cloud Run)
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const exists = await dbService.checkUserExists(email);
    if (exists) {
      return res.status(400).json({ error: 'User already exists.' });
    }
    const newUser = {
      uid: email,
      email,
      password, // stored plain for mock simulation
      plan: 'free',
      credits: 100,
      createdAt: new Date().toISOString()
    };
    await dbService.saveUser(newUser);
    res.json({ success: true, user: { email: newUser.email, plan: newUser.plan, credits: newUser.credits } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const user = await dbService.getUserByEmailAndPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    res.json({ success: true, user: { email: user.email, plan: user.plan, credits: user.credits } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const userId = getUserId(req);
  if (userId === 'local-user') {
    if (isProduction) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    return res.json({ email: 'local-user', plan: 'local', credits: 999999 });
  }
  try {
    const user = await dbService.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ email: user.email, plan: user.plan, credits: user.credits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing/upgrade', async (req, res) => {
  const userId = getUserId(req);
  if (userId === 'local-user') {
    return res.status(400).json({ error: 'Cannot upgrade local user account.' });
  }
  const { plan } = req.body;
  if (!['free', 'pro', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan selected.' });
  }
  try {
    const user = await dbService.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    user.plan = plan;
    if (plan === 'pro') {
      user.credits += 1000;
    } else if (plan === 'business') {
      user.credits += 5000;
    } else if (plan === 'free') {
      user.credits = 100;
    }
    await dbService.saveUser(user);
    res.json({ success: true, user: { email: user.email, plan: user.plan, credits: user.credits } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing/add-credits', async (req, res) => {
  const userId = getUserId(req);
  if (userId === 'local-user') {
    return res.status(400).json({ error: 'Cannot buy credits for local account.' });
  }
  const { amount } = req.body;
  const creditsToAdd = parseInt(amount, 10);
  if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
    return res.status(400).json({ error: 'Invalid credit amount.' });
  }
  try {
    const user = await dbService.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    user.credits += creditsToAdd;
    await dbService.saveUser(user);
    res.json({ success: true, user: { email: user.email, plan: user.plan, credits: user.credits } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Settings API
// ==========================================
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await dbService.getSettings();
    const cleanSettings = { ...settings };
    if (process.env.GEMINI_API_KEY) {
      cleanSettings.geminiApiKey = cleanSettings.geminiApiKey || '•••••••• (Set by Environment)';
    }
    if (process.env.ELEVENLABS_API_KEY) {
      cleanSettings.elevenLabsApiKey = cleanSettings.elevenLabsApiKey || '•••••••• (Set by Environment)';
    }
    if (process.env.PEXELS_API_KEY) {
      cleanSettings.pexelsApiKey = cleanSettings.pexelsApiKey || '•••••••• (Set by Environment)';
    }
    if (process.env.PIXABAY_API_KEY) {
      cleanSettings.pixabayApiKey = cleanSettings.pixabayApiKey || '•••••••• (Set by Environment)';
    }
    res.json(cleanSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const settings = await dbService.saveSettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Subject Profile API
// ==========================================
app.get('/api/subject', async (req, res) => {
  const userId = getUserId(req);
  try {
    const profile = await dbService.getSubjectProfile(userId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subject/upload', uploadSubject.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo file provided.' });
  }
  const angle = req.body.angle || 'Front';
  const userId = getUserId(req);
  const absolutePath = req.file.path;
  const relativePath = `/uploads/subject/${req.file.filename}`;

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    // 1. Analyze single photo with Gemini
    console.log(`[Subject API] Analyzing uploaded photo for angle: ${angle}...`);
    const analysis = await analyzeSubjectPhoto(absolutePath, angle, apiKey);

    // 2. Load current profile
    const profile = await dbService.getSubjectProfile(userId);
    profile.photos = profile.photos || [];

    const photoId = uuidv4();
    const newPhoto = {
      id: photoId,
      path: relativePath,
      angle,
      analysis
    };
    profile.photos.push(newPhoto);

    // 3. Automatically regenerate physical summary & traits list
    console.log(`[Subject API] Regenerating overall subject summary...`);
    const summaryData = await generateSubjectSummary(
      profile.photos.map(p => ({ angle: p.angle, ...p.analysis })),
      apiKey
    );
    profile.summary = summaryData.summary;
    profile.traitsList = summaryData.traitsList;

    await dbService.saveSubjectProfile(userId, profile);
    res.json({ success: true, photo: newPhoto, profile });
  } catch (error) {
    console.error('[Subject API Error] Upload/Analysis failed:', error);
    // clean up uploaded file if analysis fails
    try {
      await fs.unlink(absolutePath);
    } catch (_) {}
    res.status(500).json({ error: `Upload analysis failed: ${error.message}` });
  }
});

app.delete('/api/subject/photo/:photoId', async (req, res) => {
  const userId = getUserId(req);
  const { photoId } = req.params;

  try {
    const profile = await dbService.getSubjectProfile(userId);
    profile.photos = profile.photos || [];
    
    const photoIdx = profile.photos.findIndex(p => p.id === photoId);
    if (photoIdx === -1) {
      return res.status(404).json({ error: 'Photo not found in profile.' });
    }

    const photo = profile.photos[photoIdx];
    profile.photos.splice(photoIdx, 1);

    // Clean up physical file on disk
    try {
      const absPath = resolvePath(photo.path.replace(/^\//, ''));
      if (existsSync(absPath)) {
        await fs.unlink(absPath);
      }
    } catch (err) {
      console.warn('[Subject API] Failed to delete physical photo file:', err.message);
    }

    // Regenerate summary if photos remain, otherwise clear it
    if (profile.photos.length > 0) {
      const settings = await dbService.getSettings();
      const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
      const summaryData = await generateSubjectSummary(
        profile.photos.map(p => ({ angle: p.angle, ...p.analysis })),
        apiKey
      );
      profile.summary = summaryData.summary;
      profile.traitsList = summaryData.traitsList;
    } else {
      profile.summary = '';
      profile.traitsList = [];
    }

    await dbService.saveSubjectProfile(userId, profile);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/subject', async (req, res) => {
  const userId = getUserId(req);
  try {
    const profile = await dbService.getSubjectProfile(userId);
    profile.photos = profile.photos || [];

    // Delete all files from disk
    for (const photo of profile.photos) {
      try {
        const absPath = resolvePath(photo.path.replace(/^\//, ''));
        if (existsSync(absPath)) {
          await fs.unlink(absPath);
        }
      } catch (_) {}
    }

    await dbService.deleteSubjectProfile(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subject/summarize', async (req, res) => {
  const userId = getUserId(req);
  try {
    const profile = await dbService.getSubjectProfile(userId);
    profile.photos = profile.photos || [];

    if (profile.photos.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded to summarize.' });
    }

    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    const summaryData = await generateSubjectSummary(
      profile.photos.map(p => ({ angle: p.angle, ...p.analysis })),
      apiKey
    );
    profile.summary = summaryData.summary;
    profile.traitsList = summaryData.traitsList;

    await dbService.saveSubjectProfile(userId, profile);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AI Generation API
// ==========================================
app.post('/api/generate-ai-clip', async (req, res) => {
  const { prompt, type, duration } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required for generation.' });
  }

  const userId = getUserId(req);
  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    // Check if there is an uploaded subject profile photo to use as visual identity reference
    let subjectPhotoPath = null;
    try {
      const profile = await dbService.getSubjectProfile(userId);
      if (profile && profile.photos && profile.photos.length > 0) {
        // Prefer Front photo, fallback to first photo
        const frontPhoto = profile.photos.find(p => p.angle.toLowerCase() === 'front') || profile.photos[0];
        const relativePath = frontPhoto.path.replace(/^\//, ''); // remove leading slash
        subjectPhotoPath = resolvePath(relativePath);
        console.log(`[AI Clip API] Using subject photo reference: ${subjectPhotoPath}`);
      }
    } catch (_) {}

    // Generate clip via Vertex AI Imagen 3 + FFmpeg animate
    console.log(`[AI Clip API] Generating asset... prompt="${prompt}" type=${type} dur=${duration}`);
    const result = await generateAiAsset(prompt, type || 'video', duration || 5, apiKey, subjectPhotoPath);

    // Save clip to DB
    const newClip = {
      id: result.id,
      userId,
      path: result.path,
      name: `AI - ${prompt.substring(0, 25)}`,
      thumbnail: result.thumbnail,
      duration: result.duration,
      description: 'AI Generated clip for prompt: ' + prompt,
      tags: ['ai_generated', type || 'video'],
      status: 'analyzing'
    };
    await dbService.saveClip(newClip);

    // Run standard Gemini visual analysis in background to describe the clip in detail and generate tags
    const absoluteVideoPath = resolvePath(result.path);
    analyzeVideoInBackground(result.id, absoluteVideoPath, apiKey);

    res.json({ success: true, clip: newClip });
  } catch (error) {
    console.error('[AI Clip API Error]', error);
    res.status(500).json({ error: `AI Clip generation failed: ${error.message}` });
  }
});

// ==========================================
// Project State API
// ==========================================
app.get('/api/project', async (req, res) => {
  try {
    const project = await dbService.getLegacyProject();
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/project', async (req, res) => {
  try {
    const result = await dbService.saveLegacyProject(req.body);
    res.json({ success: true, project: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/project', async (req, res) => {
  try {
    const result = await dbService.deleteLegacyProject();
    res.json({ success: true, project: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Multi-Project History APIs
// ==========================================
function getProjectDiskSize(project) {
  let totalSize = 0;
  const paths = [];
  
  if (project.state) {
    if (project.state.voiceoverPath) paths.push(project.state.voiceoverPath);
    if (project.state.audioPath) paths.push(project.state.audioPath);
    if (project.state.lastRenderedVideoPath) paths.push(project.state.lastRenderedVideoPath);
  }
  
  for (const filePath of paths) {
    const resolved = resolvePath(filePath);
    if (resolved && existsSync(resolved)) {
      try {
        const stats = statSync(resolved);
        totalSize += stats.size;
      } catch (err) {
        // Ignore stats errors
      }
    }
  }
  return totalSize;
}

app.get('/api/projects', async (req, res) => {
  const userId = getUserId(req);
  try {
    const projects = await dbService.getProjects(userId);
    const projectsWithSize = projects.map(p => {
      return {
        ...p,
        diskSize: getProjectDiskSize(p)
      };
    });
    res.json(projectsWithSize);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const userId = getUserId(req);
  try {
    const project = await dbService.getProject(req.params.id);
    if (!project || (project.userId || 'local-user') !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({
      ...project,
      diskSize: getProjectDiskSize(project)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name, type } = req.body;
  if (!type || !['create', 'beatsync', 'talkinghead', 'subtitles', 'youtube'].includes(type)) {
    return res.status(400).json({ error: 'Valid project type is required (create, beatsync, talkinghead, subtitles, or youtube).' });
  }
  
  const userId = getUserId(req);
  try {
    const settings = await dbService.getSettings();
    let defaultName = `Untitled Voiceover Project`;
    if (type === 'beatsync') defaultName = `Untitled Beat Sync Project`;
    else if (type === 'talkinghead') defaultName = `Untitled Talking Head Project`;
    else if (type === 'subtitles') defaultName = `Untitled Add Subtitles Project`;
    else if (type === 'youtube') defaultName = `Untitled YouTube Empire Project`;

    const newProject = {
      id: uuidv4(),
      userId,
      name: name || defaultName,
      type,
      updatedAt: new Date().toISOString(),
      state: type === 'beatsync' ? {
        audioSource: "upload",
        audioPath: "",
        audioUrl: "",
        audioName: "",
        audioDuration: 0,
        syncMode: "beats",
        threshold: 1.4,
        boundaries: [],
        scenes: [],
        aspectRatio: "9:16",
        fillMode: "crop",
        clipTransition: "none",
        zoomAnimation: true,
        exportResolution: "1080p",
        exportFps: 30,
        miniBeats: [],
        miniBeatEffect: "none",
        selectedVideoClipId: "",
        subtitleMode: "smart-highlight",
        highlightTrigger: "all",
        textCase: "default",
        autoEmphasis: false,
        fontName: "Bangers",
        fontSize: 48,
        fontColor: "#FFFFFF",
        outlineColor: "#000000",
        bold: false,
        italic: false,
        shadow: true,
        highlightColor: "#FACC15",
        showHighlightBox: false,
        boxColor: "#8A4BF3",
        boxRounding: 8,
        textFade: true,
        textTransition: "none",
        textMotion: "none",
        activeWordScale: 1.15,
        wordDisplayTime: 1.0,
        textPositionX: 0,
        textPositionY: -65
      } : (type === 'talkinghead' || type === 'subtitles') ? {
        originalVideoPath: "",
        originalVideoUrl: "",
        voiceoverPath: "",
        voiceoverUrl: "",
        scenes: [],
        aspectRatio: "9:16",
        fillMode: "crop",
        bgMusicPath: "",
        bgMusicVolume: 0.15,
        bgMusicStartOffset: 0,
        voiceoverVolume: 1.0,
        clipTransition: "none",
        transitionDuration: 0.3,
        zoomAnimation: false, 
        exportResolution: "1080p",
        exportFps: 30,
        subtitleMode: "classic",
        highlightTrigger: "all",
        textCase: "default",
        autoEmphasis: false,
        fontName: "Bangers",
        fontSize: 48,
        fontColor: "#FFFFFF",
        outlineColor: "#000000",
        bold: false,
        italic: false,
        shadow: true,
        highlightColor: "#FACC15",
        showHighlightBox: false,
        boxColor: "#8A4BF3",
        boxRounding: 8,
        textFade: true,
        textTransition: "none",
        textMotion: "none",
        activeWordScale: 1.0, 
        wordDisplayTime: 1.0,
        textPositionX: 0,
        textPositionY: -65
      } : type === 'youtube' ? {
        topic: "",
        niche: "The Wisdom Blueprint",
        scriptText: "",
        shortScriptText: "",
        selectedVoice: settings.lastSelectedVoice || "",
        audioSource: "generate",
        voiceoverPath: "",
        voiceoverUrl: "",
        scenes: [],
        aspectRatio: "16:9",
        fillMode: "crop",
        bgMusicPath: "",
        bgMusicVolume: 0.15,
        fontName: "Bangers",
        fontSize: 48,
        fontColor: "#FFFFFF",
        outlineColor: "#000000",
        bold: false,
        italic: false,
        shadow: true,
        textFade: true,
        textTransition: "none",
        textMotion: "none",
        activeWordScale: 1.15,
        exportResolution: "1080p",
        exportFps: 30,
        status: "idle",
        shortProjectId: ""
      } : {
        scriptText: "",
        selectedVoice: settings.lastSelectedVoice || "",
        audioSource: "generate",
        voiceoverPath: "",
        voiceoverUrl: "",
        scenes: [],
        aspectRatio: "9:16",
        fillMode: "crop",
        bgMusicPath: "",
        bgMusicVolume: 0.15,
        fontName: "Bangers",
        fontSize: 48,
        fontColor: "#FFFFFF",
        outlineColor: "#000000",
        bold: false,
        italic: false,
        shadow: true,
        textFade: true,
        textTransition: "none",
        textMotion: "none",
        activeWordScale: 1.15,
        exportResolution: "1080p",
        exportFps: 30
      }
    };
    
    await dbService.saveProject(newProject);
    await dbService.saveSettings({ lastActiveProjectId: newProject.id });
    res.json(newProject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  const userId = getUserId(req);
  const { name, state } = req.body;
  try {
    const project = await dbService.getProject(req.params.id);
    if (!project || (project.userId || 'local-user') !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (name !== undefined) project.name = name;
    if (state !== undefined) {
      const updatedState = { ...state };
      if (updatedState.scenes) {
        updatedState.scenes = autoEnrichSceneVerbs(updatedState.scenes);
      }
      project.state = { ...project.state, ...updatedState };
    }
    project.updatedAt = new Date().toISOString();
    
    await dbService.saveProject(project);
    await dbService.saveSettings({ lastActiveProjectId: project.id });
    
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  const userId = getUserId(req);
  try {
    const project = await dbService.getProject(req.params.id);
    if (!project || (project.userId || 'local-user') !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Clean up associated files on GCS/disk
    const filesToDelete = [];
    if (project.state) {
      if (project.state.voiceoverPath) filesToDelete.push(project.state.voiceoverPath);
      if (project.state.audioPath) filesToDelete.push(project.state.audioPath);
      if (project.state.lastRenderedVideoPath) filesToDelete.push(project.state.lastRenderedVideoPath);
    }
    
    for (const filePath of filesToDelete) {
      try {
        await gcsService.deleteFile(filePath);
      } catch (err) {
        console.error(`Failed to delete project file: ${filePath}`, err.message);
      }
    }
    
    await dbService.deleteProject(req.params.id);
    
    const settings = await dbService.getSettings();
    if (settings.lastActiveProjectId === req.params.id) {
      const remainingProjects = await dbService.getProjects(userId);
      await dbService.saveSettings({
        lastActiveProjectId: remainingProjects.length > 0 ? remainingProjects[remainingProjects.length - 1].id : ''
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ElevenLabs Voices API
// ==========================================
app.get('/api/voices', async (req, res) => {
  try {
    const settings = await dbService.getSettings();
    const apiKey = req.query.apiKey || process.env.ELEVENLABS_API_KEY || settings.elevenLabsApiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'ElevenLabs API key is missing. Please configure it in Settings.' });
    }
    const voices = await getVoices(apiKey);
    res.json(voices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Clips Library API
// ==========================================
app.get('/api/clips', async (req, res) => {
  const userId = getUserId(req);
  try {
    const clips = await dbService.getClips(userId);
    const clipsWithStatus = clips.map(clip => {
      const isGcs = gcsService.isGcsEnabled();
      const exists = isGcs ? !!clip.path : existsSync(resolvePath(clip.path));
      return {
        ...clip,
        exists
      };
    });
    res.json(clipsWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add clip via absolute local path (extremely fast for local workflows)
app.post('/api/clips/add-path', async (req, res) => {
  const { absolutePath } = req.body;
  if (!absolutePath || !existsSync(absolutePath)) {
    return res.status(400).json({ error: 'Valid absolute file path is required.' });
  }

  const userId = getUserId(req);
  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    // Vertex AI client fallback

    const clipId = uuidv4();
    const filename = path.basename(absolutePath);
    const thumbnailFilename = `${clipId}.jpg`;
    const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

    // 1. Get Video Duration
    const duration = await getVideoDuration(absolutePath);

    // 2. Generate Thumbnail
    await generateThumbnail(absolutePath, thumbnailPath);

    let finalVideoPath = absolutePath;
    let finalThumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;

    if (gcsService.isGcsEnabled()) {
      finalVideoPath = await gcsService.uploadFile(absolutePath, `clips/${clipId}${path.extname(filename)}`);
      finalThumbnailUrl = await gcsService.uploadFile(thumbnailPath, `thumbnails/${thumbnailFilename}`);
      try {
        await fs.unlink(thumbnailPath);
      } catch (_) {}
    }

    // 3. Create clip record in DB with analyzing status
    const newClip = {
      id: clipId,
      userId,
      path: finalVideoPath,
      name: filename,
      thumbnail: finalThumbnailUrl,
      duration,
      description: 'Analyzing clip content...',
      tags: [],
      status: 'analyzing'
    };

    await dbService.saveClip(newClip);

    // 4. Trigger Gemini analysis in background
    analyzeVideoInBackground(clipId, absolutePath, apiKey);

    res.json(newClip);
  } catch (error) {
    res.status(500).json({ error: `Failed to import clip: ${error.message}` });
  }
});

// Upload multiple clips via browser
app.post('/api/clips/upload', upload.array('videos', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No video files provided.' });
  }

  const userId = getUserId(req);
  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    // Vertex AI client fallback

    const importedClips = [];

    for (const file of req.files) {
      let absolutePath = file.path;
      const ext = path.extname(file.originalname).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

      if (imageExtensions.includes(ext)) {
        const videoFilename = `${path.basename(file.filename, path.extname(file.filename))}_conv.mp4`;
        const videoPath = path.join(CLIPS_DIR, videoFilename);
        
        try {
          await runFFmpeg([
            '-loop', '1',
            '-i', absolutePath,
            '-c:v', 'libx264',
            '-t', '10',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=truncate(iw/2)*2:truncate(ih/2)*2',
            '-y',
            videoPath
          ]);

          // Clean up the original uploaded image file
          await fs.unlink(absolutePath).catch(() => {});
          
          absolutePath = videoPath;
          file.path = videoPath;
          file.filename = videoFilename;
        } catch (convErr) {
          console.error(`Failed to convert image ${file.originalname} to video:`, convErr);
        }
      }

      const clipId = path.basename(file.filename, path.extname(file.filename));
      
      // Transcode video to 30 fps CFR H.264 to prevent seeking/jitter issues
      const transcodedFilename = `${clipId}_cfr.mp4`;
      const transcodedPath = path.join(CLIPS_DIR, transcodedFilename);
      try {
        console.log(`[Upload] Transcoding uploaded file ${absolutePath} to CFR 30fps H.264...`);
        await runFFmpeg([
          '-i', absolutePath,
          '-vf', "fps=30,scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2",
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-y',
          transcodedPath
        ]);
        if (absolutePath !== transcodedPath) {
          await fs.unlink(absolutePath).catch(() => {});
        }
        absolutePath = transcodedPath;
        file.path = transcodedPath;
        file.filename = transcodedFilename;
      } catch (transcodeErr) {
        console.error(`Failed to transcode uploaded file ${file.originalname} to CFR:`, transcodeErr);
      }

      const thumbnailFilename = `${clipId}.jpg`;
      const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

      const duration = await getVideoDuration(absolutePath);
      await generateThumbnail(absolutePath, thumbnailPath);

      let finalVideoPath = absolutePath;
      let finalThumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;

      if (gcsService.isGcsEnabled()) {
        finalVideoPath = await gcsService.uploadFile(absolutePath, `clips/${clipId}${path.extname(file.originalname)}`);
        finalThumbnailUrl = await gcsService.uploadFile(thumbnailPath, `thumbnails/${thumbnailFilename}`);
        try {
          await fs.unlink(thumbnailPath);
        } catch (_) {}
      }

      const newClip = {
        id: clipId,
        userId,
        path: finalVideoPath,
        name: file.originalname,
        thumbnail: finalThumbnailUrl,
        duration,
        description: 'Analyzing clip content...',
        tags: [],
        status: 'analyzing'
      };

      await dbService.saveClip(newClip);
      importedClips.push(newClip);

      analyzeVideoInBackground(clipId, absolutePath, apiKey);
    }

    res.json(importedClips);
  } catch (error) {
    res.status(500).json({ error: `Failed to upload files: ${error.message}` });
  }
});

// ── Chunked Upload (bypasses Cloud Run 32MB body limit) ──
// Files are split into small chunks by the client. Each chunk is sent as a
// separate HTTP request (well under the 32MB limit). The server writes chunks
// to a temp file, then uploads the complete file to GCS when done.

const activeUploads = new Map(); // sessionId -> { filePath, fileName, receivedBytes }

// Step 1: Client requests an upload session
app.post('/api/clips/init-upload', async (req, res) => {
  const { fileName, contentType, fileSize } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required.' });
  }

  try {
    const clipId = uuidv4();
    const ext = path.extname(fileName) || '.mp4';
    const tempFilePath = path.join(CLIPS_DIR, `${clipId}${ext}`);

    // Create empty file
    await fs.writeFile(tempFilePath, Buffer.alloc(0));

    // Track upload session
    activeUploads.set(clipId, {
      filePath: tempFilePath,
      fileName,
      ext,
      receivedBytes: 0,
      totalSize: fileSize || 0
    });

    // Auto-cleanup after 30 minutes if upload stalls
    setTimeout(() => {
      if (activeUploads.has(clipId)) {
        activeUploads.delete(clipId);
        fs.unlink(tempFilePath).catch(() => {});
      }
    }, 30 * 60 * 1000);

    res.json({ clipId, ext });
  } catch (error) {
    console.error('[Upload Init Error]', error.message);
    res.status(500).json({ error: `Failed to initialize upload: ${error.message}` });
  }
});

// Step 2: Client sends file chunks (each under 8MB)
const chunkUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/clips/upload-chunk/:clipId', chunkUpload.single('chunk'), async (req, res) => {
  const { clipId } = req.params;
  const session = activeUploads.get(clipId);

  if (!session) {
    return res.status(404).json({ error: 'Upload session not found or expired.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No chunk data provided.' });
  }

  try {
    // Append chunk to file
    await fs.appendFile(session.filePath, req.file.buffer);
    session.receivedBytes += req.file.buffer.length;

    res.json({
      received: session.receivedBytes,
      total: session.totalSize
    });
  } catch (error) {
    console.error('[Chunk Upload Error]', error.message);
    res.status(500).json({ error: `Failed to write chunk: ${error.message}` });
  }
});

// Step 3: Client signals upload is complete — server processes the file
app.post('/api/clips/finalize-upload', async (req, res) => {
  const { clipId, fileName } = req.body;
  if (!clipId) {
    return res.status(400).json({ error: 'clipId is required.' });
  }

  const session = activeUploads.get(clipId);
  if (!session) {
    return res.status(404).json({ error: 'Upload session not found or expired.' });
  }

  activeUploads.delete(clipId);

  const userId = getUserId(req);
  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    let localTempPath = session.filePath;

    // Transcode video to 30 fps CFR H.264 to prevent seeking/jitter issues
    const transcodedFilename = `${clipId}_cfr.mp4`;
    const transcodedPath = path.join(CLIPS_DIR, transcodedFilename);
    try {
      console.log(`[Finalize Upload] Transcoding chunked file ${localTempPath} to CFR 30fps H.264...`);
      await runFFmpeg([
        '-i', localTempPath,
        '-vf', "fps=30,scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2",
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        transcodedPath
      ]);
      if (localTempPath !== transcodedPath) {
        await fs.unlink(localTempPath).catch(() => {});
      }
      localTempPath = transcodedPath;
    } catch (transcodeErr) {
      console.error(`Failed to transcode chunked file to CFR:`, transcodeErr);
    }

    // Generate thumbnail
    const thumbnailFilename = `${clipId}.jpg`;
    const thumbnailLocalPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
    const duration = await getVideoDuration(localTempPath);
    await generateThumbnail(localTempPath, thumbnailLocalPath);

    let finalVideoPath = localTempPath;
    let finalThumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;

    // Upload to GCS if enabled
    if (gcsService.isGcsEnabled()) {
      const gcsVideoPath = `clips/${clipId}_cfr.mp4`;
      finalVideoPath = await gcsService.uploadFile(localTempPath, gcsVideoPath);
      finalThumbnailUrl = await gcsService.uploadFile(thumbnailLocalPath, `thumbnails/${thumbnailFilename}`);
      try { await fs.unlink(thumbnailLocalPath); } catch (_) {}
    }

    const newClip = {
      id: clipId,
      userId,
      path: finalVideoPath,
      name: fileName || session.fileName,
      thumbnail: finalThumbnailUrl,
      duration,
      description: 'Analyzing clip content...',
      tags: [],
      status: 'analyzing'
    };

    await dbService.saveClip(newClip);

    // Start AI analysis in background
    analyzeVideoInBackground(clipId, localTempPath, apiKey);

    res.json(newClip);
  } catch (error) {
    console.error('[Finalize Upload Error]', error.message);
    res.status(500).json({ error: `Failed to finalize upload: ${error.message}` });
  }
});

// Add clips from a local directory folder (scans and imports multiple files)
app.post('/api/clips/add-folder', async (req, res) => {
  const { absolutePath } = req.body;
  if (!absolutePath || !existsSync(absolutePath)) {
    return res.status(400).json({ error: 'Valid absolute folder path is required.' });
  }

  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Specified path is not a directory.' });
    }

    const userId = getUserId(req);
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    // Vertex AI client fallback

    const files = await fs.readdir(absolutePath);
    const videoExtensions = ['.mp4', '.mkv', '.mov', '.m4v', '.webm'];
    
    // Filter matching video files
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return videoExtensions.includes(ext);
    });

    if (videoFiles.length === 0) {
      return res.json({ success: true, count: 0, message: 'No matching video files found in directory.' });
    }

    const importedClips = [];
    const existingClips = await dbService.getClips(userId);
    
    for (const filename of videoFiles) {
      const fileFullPath = path.join(absolutePath, filename);
      
      // Prevent importing duplicates
      const exists = existingClips.some(c => c.path === fileFullPath || c.name === filename);
      if (exists) continue;

      const clipId = uuidv4();
      const thumbnailFilename = `${clipId}.jpg`;
      const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

      try {
        const duration = await getVideoDuration(fileFullPath);
        await generateThumbnail(fileFullPath, thumbnailPath);

        let finalVideoPath = fileFullPath;
        let finalThumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;

        if (gcsService.isGcsEnabled()) {
          finalVideoPath = await gcsService.uploadFile(fileFullPath, `clips/${clipId}${path.extname(filename)}`);
          finalThumbnailUrl = await gcsService.uploadFile(thumbnailPath, `thumbnails/${thumbnailFilename}`);
          try {
            await fs.unlink(thumbnailPath);
          } catch (_) {}
        }

        const newClip = {
          id: clipId,
          userId,
          path: finalVideoPath,
          name: filename,
          thumbnail: finalThumbnailUrl,
          duration,
          description: 'Analyzing clip content...',
          tags: [],
          status: 'analyzing'
        };

        await dbService.saveClip(newClip);
        importedClips.push(newClip);
        
        // Trigger background analysis
        analyzeVideoInBackground(clipId, fileFullPath, apiKey);
      } catch (clipErr) {
        console.error(`Failed to process clip ${filename} in folder import:`, clipErr);
      }
    }

    res.json({
      success: true,
      count: importedClips.length,
      clips: importedClips
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to import folder: ${error.message}` });
  }
});

// Serve arbitrary local file (for local development assets outside project dir)
app.get('/api/serve-local-file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }
  
  // Security check: only allow absolute paths on the local machine
  if (!filePath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Content-Type');

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    if (start >= fileSize || end >= fileSize) {
      res.status(416)
        .set("Content-Range", `bytes */${fileSize}`)
        .set("Connection", "close")
        .send();
      return;
    }
    
    const chunksize = (end - start) + 1;
    const file = createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': filePath.endsWith('.wav') ? 'audio/wav' : (filePath.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4'),
      'Connection': 'close'
    };
    
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': filePath.endsWith('.wav') ? 'audio/wav' : (filePath.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4'),
      'Accept-Ranges': 'bytes',
      'Connection': 'close'
    };
    res.writeHead(200, head);
    createReadStream(filePath).pipe(res);
  }
});

// Endpoint for client-side logging
app.post('/api/log-client-error', (req, res) => {
  const { error, message, stack, component } = req.body;
  console.error(`\n[Client Log - ${component || 'General'}] ${message || error}`);
  if (stack) {
    console.error(stack);
  }
  
  try {
    logErrorToFile(`Client - ${component || 'General'}`, {
      message: message || error || 'Unknown client error',
      stack: stack || 'No client stack trace'
    });
  } catch (err) {
    console.error('Failed to log client error to file:', err);
  }
  res.json({ success: true });
});

// Stream clip video file directly
app.get('/api/clips/:id/video', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  try {
    const clip = await dbService.getClip(id);
    // In production, server-side Remotion renderer calls this without auth headers.
    // Allow access if clip exists; userId check only applies to authenticated browser requests.
    const isServerSideRender = isProduction && userId === 'local-user';
    if (!clip || (!isServerSideRender && (clip.userId || 'local-user') !== userId)) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    if (gcsService.isGcsEnabled() && clip.path.startsWith('http')) {
      // Redirect browser to GCS signed URL
      return res.redirect(clip.path);
    }

    const resolved = resolvePath(clip.path);
    if (!resolved || !existsSync(resolved)) {
      return res.status(404).json({ error: 'Clip video file does not exist on disk' });
    }

    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Content-Type');

    const stat = statSync(resolved);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      if (start >= fileSize || end >= fileSize) {
        res.status(416)
          .set("Content-Range", `bytes */${fileSize}`)
          .set("Connection", "close")
          .send();
        return;
      }
      
      const chunksize = (end - start) + 1;
      const file = createReadStream(resolved, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': resolved.endsWith('.wav') ? 'audio/wav' : (resolved.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4'),
        'Connection': 'close'
      };
      
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': resolved.endsWith('.wav') ? 'audio/wav' : (resolved.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4'),
        'Accept-Ranges': 'bytes',
        'Connection': 'close'
      };
      res.writeHead(200, head);
      createReadStream(resolved).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete clip
app.delete('/api/clips/:id', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  try {
    const clip = await dbService.getClip(id);
    if (!clip || (clip.userId || 'local-user') !== userId) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    // Attempt to delete files from GCS/local
    await gcsService.deleteFile(clip.path);
    await gcsService.deleteFile(clip.thumbnail);

    // Delete thumbnail from local cache just in case
    const thumbPath = path.join(THUMBNAILS_DIR, `${id}.jpg`);
    try {
      await fs.unlink(thumbPath);
    } catch (_) {}

    await dbService.deleteClip(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force re-analyze all clips in the library (runs the new segment-based analysis)
app.post('/api/clips/reanalyze-all', async (req, res) => {
  const userId = getUserId(req);
  try {
    const settings = await dbService.getSettings();
    const apiKey = settings.geminiApiKey;
    // Vertex AI client fallback

    const clips = await dbService.getClips(userId);
    const clipsToAnalyze = clips.filter(clip => !clip.segments || clip.segments.length === 0);

    if (clipsToAnalyze.length === 0) {
      return res.json({ success: true, count: 0, message: 'All clips already have segment analysis.' });
    }

    for (const clip of clipsToAnalyze) {
      clip.status = 'analyzing';
      clip.description = 'Re-analyzing clip content with timelines...';
      clip.tags = [];
      clip.segments = [];
      await dbService.saveClip(clip);

      let localPath = clip.path;
      if (gcsService.isGcsEnabled() && clip.path.startsWith('http')) {
        localPath = path.join(CLIPS_DIR, `${clip.id}.mp4`);
        await gcsService.downloadFile(clip.path, localPath);
      }

      analyzeVideoInBackground(clip.id, localPath, apiKey);
    }

    res.json({ success: true, count: clipsToAnalyze.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Background Analysis Worker
async function analyzeVideoInBackground(clipId, filePath, apiKey) {
  let localPath = filePath;
  let isTempDownloaded = false;
  try {
    if (gcsService.isGcsEnabled() && (filePath.startsWith('http') || filePath.startsWith('gs://'))) {
      const ext = path.extname(filePath.split('?')[0]) || '.mp4';
      localPath = path.join(CLIPS_DIR, `${clipId}${ext}`);
      console.log(`[Background Worker] Clip file is remote. Downloading from GCS to local path for analysis: ${localPath}`);
      await gcsService.downloadFile(filePath, localPath);
      isTempDownloaded = true;
    }
    const analysis = await analyzeVideo(localPath, apiKey);
    const clip = await dbService.getClip(clipId);
    if (clip) {
      clip.description = analysis.description;
      // Preserve special system tags so stock and AI videos aren't mistakenly categorized as user uploads
      const systemTags = (clip.tags || []).filter(tag => 
        tag === 'stock_downloaded' || 
        tag === 'ai_generated' || 
        tag === 'fallback' || 
        tag === 'recreate_fallback'
      );
      clip.tags = Array.from(new Set([...systemTags, ...(analysis.tags || [])]));
      clip.segments = analysis.segments || [];
      clip.status = 'ready';
      await dbService.saveClip(clip);
    }
  } catch (error) {
    console.error(`Error analyzing clip ${clipId}:`, error);
    try {
      const clip = await dbService.getClip(clipId);
      if (clip) {
        clip.description = `Analysis failed: ${error.message}`;
        clip.status = 'failed';
        await dbService.saveClip(clip);
      }
    } catch (_) {}
  } finally {
    // If running in GCS mode, delete the local temp upload video file to free up container space
    if (gcsService.isGcsEnabled()) {
      if (isTempDownloaded || (localPath.includes('uploads/clips') && existsSync(localPath))) {
        try {
          await fs.unlink(localPath);
          console.log(`[Background Worker] Cleaned up temporary local clip file: ${localPath}`);
        } catch (_) {}
      }
    }
  }
}

// ==========================================
// SFX Library API
// ==========================================
app.get('/api/sfx', async (req, res) => {
  try {
    const sfxDir = path.join(UPLOADS_DIR, 'sfx');
    if (!existsSync(sfxDir)) {
      return res.json([]);
    }
    const files = await fs.readdir(sfxDir);
    const sfxList = files
      .filter(f => f.endsWith('.mp3'))
      .map(f => {
        const id = path.basename(f, '.mp3');
        const name = id
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        return {
          id,
          name,
          filename: f,
          url: `/uploads/sfx/${f}`
        };
      });
    res.json(sfxList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Music Library API (No Analysis)
// ==========================================
app.get('/api/bgms', async (req, res) => {
  const userId = getUserId(req);
  try {
    const bgms = await dbService.getBgms(userId);
    res.json(bgms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bgms/duration', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) {
    return res.status(400).json({ error: 'path parameter is required.' });
  }
  try {
    // If it's a GCS URL, download to temp path first to read duration
    let tempPath = filePath;
    if (gcsService.isGcsEnabled() && filePath.startsWith('http')) {
      tempPath = path.join(MUSIC_DIR, `temp_dur_${uuidv4()}.mp3`);
      await gcsService.downloadFile(filePath, tempPath);
    }

    const duration = await getVideoDuration(tempPath);

    if (tempPath !== filePath) {
      try {
        await fs.unlink(tempPath);
      } catch (_) {}
    }

    res.json({ duration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add BGM via absolute local path
app.post('/api/bgms/add-path', async (req, res) => {
  const { absolutePath } = req.body;
  if (!absolutePath || !existsSync(absolutePath)) {
    return res.status(400).json({ error: 'Valid absolute file path is required.' });
  }

  const userId = getUserId(req);
  const bgmId = uuidv4();
  const filename = path.basename(absolutePath);

  try {
    const duration = await getVideoDuration(absolutePath);
    let finalPath = absolutePath;

    if (gcsService.isGcsEnabled()) {
      finalPath = await gcsService.uploadFile(absolutePath, `music/${bgmId}${path.extname(filename)}`);
    }

    const newBgm = {
      id: bgmId,
      userId,
      path: finalPath,
      name: filename,
      duration
    };

    await dbService.saveBgm(newBgm);
    res.json(newBgm);
  } catch (error) {
    res.status(500).json({ error: `Failed to import BGM: ${error.message}` });
  }
});

// Scan folder for BGM files
app.post('/api/bgms/add-folder', async (req, res) => {
  const { absolutePath } = req.body;
  if (!absolutePath || !existsSync(absolutePath)) {
    return res.status(400).json({ error: 'Valid absolute folder path is required.' });
  }

  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Provided path is not a directory.' });
    }

    const files = await fs.readdir(absolutePath);
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    const userId = getUserId(req);
    const existingBgms = await dbService.getBgms(userId);

    const imported = [];
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (audioExtensions.includes(ext)) {
        const fileFullPath = path.join(absolutePath, file);
        const exists = existingBgms.some(b => b.path === fileFullPath || b.name === file);
        if (!exists) {
          const bgmId = uuidv4();
          const duration = await getVideoDuration(fileFullPath);
          
          let finalPath = fileFullPath;
          if (gcsService.isGcsEnabled()) {
            finalPath = await gcsService.uploadFile(fileFullPath, `music/${bgmId}${ext}`);
          }

          const newBgm = {
            id: bgmId,
            userId,
            path: finalPath,
            name: file,
            duration
          };
          await dbService.saveBgm(newBgm);
          imported.push(newBgm);
        }
      }
    }

    res.json({ success: true, count: imported.length, bgms: imported });
  } catch (error) {
    res.status(500).json({ error: `Failed to scan BGM folder: ${error.message}` });
  }
});

// Upload BGM via browser
app.post('/api/bgms/upload', uploadMusic.array('bgms', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No audio files provided.' });
  }

  const userId = getUserId(req);
  const importedBgms = [];

  try {
    for (const file of req.files) {
      const bgmId = uuidv4();
      const duration = await getVideoDuration(file.path);
      
      let finalPath = file.path;
      if (gcsService.isGcsEnabled()) {
        finalPath = await gcsService.uploadFile(file.path, `music/${bgmId}${path.extname(file.originalname)}`);
        try {
          await fs.unlink(file.path);
        } catch (_) {}
      }

      const newBgm = {
        id: bgmId,
        userId,
        path: finalPath,
        name: file.originalname,
        duration
      };
      await dbService.saveBgm(newBgm);
      importedBgms.push(newBgm);
    }
    res.json(importedBgms);
  } catch (error) {
    res.status(500).json({ error: `Failed to import uploaded BGMs: ${error.message}` });
  }
});

// Delete BGM from library
app.delete('/api/bgms/:id', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  try {
    const bgms = await dbService.getBgms(userId);
    const bgm = bgms.find(b => b.id === id);
    if (!bgm) {
      return res.status(404).json({ error: 'BGM not found.' });
    }

    // Clean up file via GCS service
    await gcsService.deleteFile(bgm.path);
    await dbService.deleteBgm(id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Generation APIs
// ==========================================

// 1. Voiceover endpoint (Generate via ElevenLabs)
app.post('/api/generate-voiceover', async (req, res) => {
  const { text, voiceId, modelId, enhanceSpeech } = req.body;
  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Script text and Voice ID are required.' });
  }

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.ELEVENLABS_API_KEY || settings.elevenLabsApiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'ElevenLabs API key is missing. Please configure it in Settings.' });
    }

    const userId = getUserId(req);
    let user = null;
    if (userId !== 'local-user') {
      user = await dbService.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      const estimatedSeconds = Math.max(1, Math.ceil(text.length / 15));
      if (user.credits < estimatedSeconds) {
        return res.status(403).json({ error: `Insufficient credits. Need ${estimatedSeconds} credits, but you only have ${user.credits} remaining.` });
      }
    }

    // Save last selected voice in settings
    await dbService.saveSettings({ lastSelectedVoice: voiceId });

    const audioId = uuidv4();
    const audioFilename = `voiceover_${audioId}.mp3`;
    const localAudioPath = path.join(GENERATED_DIR, audioFilename);

    const finalModelId = modelId || 'eleven_multilingual_v2';
    let ttsText = text;
    if (finalModelId === 'eleven_v3' && enhanceSpeech) {
      ttsText = `[thoughtful] ${text}`;
    }

    await generateSpeech(ttsText, voiceId, apiKey, localAudioPath, finalModelId);
    
    let finalAudioPath = localAudioPath;
    let finalAudioUrl = `/uploads/generated/${audioFilename}`;

    if (gcsService.isGcsEnabled()) {
      finalAudioPath = await gcsService.uploadFile(localAudioPath, `generated/${audioFilename}`);
      finalAudioUrl = finalAudioPath; // Return signed GCS URL
      try {
        await fs.unlink(localAudioPath);
      } catch (_) {}
    }

    // Deduct credits if applicable
    if (user) {
      try {
        let tempPathForDur = finalAudioPath;
        if (gcsService.isGcsEnabled() && finalAudioPath.startsWith('http')) {
          tempPathForDur = path.join(GENERATED_DIR, `temp_dur_${audioId}.mp3`);
          await gcsService.downloadFile(finalAudioPath, tempPathForDur);
        }

        const duration = await getVideoDuration(tempPathForDur);
        const creditsToDeduct = Math.max(1, Math.ceil(duration));
        user.credits = Math.max(0, user.credits - creditsToDeduct);
        await dbService.saveUser(user);

        if (tempPathForDur !== finalAudioPath) {
          try {
            await fs.unlink(tempPathForDur);
          } catch (_) {}
        }
      } catch (durErr) {
        console.warn('[Billing] Failed to get voiceover duration for credit deduction:', durErr);
      }
    }

    res.json({
      success: true,
      audioPath: finalAudioPath,
      audioUrl: finalAudioUrl
    });
  } catch (error) {
    console.error('Error in /api/generate-voiceover:', error);
    logErrorToFile('/api/generate-voiceover', error);
    res.status(500).json({ error: error.message });
  }
});

// Multer configuration for direct audio upload
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: GENERATED_DIR,
    filename: (req, file, cb) => {
      cb(null, `voiceover_${uuidv4()}${path.extname(file.originalname)}`);
    }
  })
});

// 2. Audio/Video upload endpoint (auto-extracts audio if video uploaded)
app.post('/api/upload-audio', audioUpload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided.' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];

  try {
    let absolutePath = req.file.path;
    let finalFilename = req.file.filename;

    if (videoExtensions.includes(ext)) {
      const audioOutputFilename = `voiceover_${uuidv4()}.mp3`;
      const audioOutputPath = path.join(GENERATED_DIR, audioOutputFilename);

      const finalAudioPath = await extractAudioFromVideo(req.file.path, audioOutputPath);
      absolutePath = finalAudioPath;
      finalFilename = path.basename(finalAudioPath);
      
      // Cleanup uploaded video to save disk space
      await fs.unlink(req.file.path).catch(() => {});
    }

    let finalAudioPath = absolutePath;
    let finalAudioUrl = `/uploads/generated/${finalFilename}`;

    if (gcsService.isGcsEnabled()) {
      finalAudioPath = await gcsService.uploadFile(absolutePath, `generated/${finalFilename}`);
      finalAudioUrl = finalAudioPath;
      try {
        await fs.unlink(absolutePath);
      } catch (_) {}
    }

    res.json({
      success: true,
      audioPath: finalAudioPath,
      audioUrl: finalAudioUrl
    });
  } catch (err) {
    logErrorToFile('/api/upload-audio', err);
    return res.status(500).json({ error: `Failed to process uploaded file: ${err.message}` });
  }
});

// Multer configuration for background image upload
const bgImageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      cb(null, `bg_${uuidv4()}${path.extname(file.originalname)}`);
    }
  })
});

// Upload background image endpoint
app.post('/api/upload-bg', bgImageUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }
  try {
    let finalPath = req.file.path;
    let finalUrl = `/uploads/${req.file.filename}`;

    if (gcsService.isGcsEnabled()) {
      finalPath = await gcsService.uploadFile(req.file.path, `bg/${req.file.filename}`);
      finalUrl = finalPath;
      try {
        await fs.unlink(req.file.path);
      } catch (_) {}
    }

    res.json({
      success: true,
      url: finalUrl
    });
  } catch (err) {
    logErrorToFile('/api/upload-bg', err);
    return res.status(500).json({ error: `Failed to upload background: ${err.message}` });
  }
});

// Multer configuration for talking head video upload
const talkingHeadVideoUpload = multer({
  storage: multer.diskStorage({
    destination: GENERATED_DIR,
    filename: (req, file, cb) => {
      cb(null, `talkinghead_${uuidv4()}${path.extname(file.originalname)}`);
    }
  })
});

// 2c. Talking Head Video upload endpoint (extracts audio, keeps original video)
app.post('/api/upload-talkinghead', talkingHeadVideoUpload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided.' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];

  if (!videoExtensions.includes(ext)) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'Uploaded file must be a valid video format.' });
  }

  const audioOutputFilename = `voiceover_${uuidv4()}.mp3`;
  const audioOutputPath = path.join(GENERATED_DIR, audioOutputFilename);

  try {
    const finalAudioPath = await extractAudioFromVideo(req.file.path, audioOutputPath);
    const finalFilename = path.basename(finalAudioPath);
    
    let finalVideoPath = req.file.path;
    let finalVideoUrl = `/uploads/generated/${req.file.filename}`;
    let finalAudioGcsPath = finalAudioPath;
    let finalAudioGcsUrl = `/uploads/generated/${finalFilename}`;

    if (gcsService.isGcsEnabled()) {
      finalVideoPath = await gcsService.uploadFile(req.file.path, `generated/${req.file.filename}`);
      finalVideoUrl = finalVideoPath;
      finalAudioGcsPath = await gcsService.uploadFile(finalAudioPath, `generated/${finalFilename}`);
      finalAudioGcsUrl = finalAudioGcsPath;
      try {
        await fs.unlink(req.file.path);
        await fs.unlink(finalAudioPath);
      } catch (_) {}
    }

    res.json({
      success: true,
      originalVideoPath: finalVideoPath,
      originalVideoUrl: finalVideoUrl,
      audioPath: finalAudioGcsPath,
      audioUrl: finalAudioGcsUrl
    });
  } catch (err) {
    logErrorToFile('/api/upload-talkinghead [Video Extraction]', err);
    return res.status(500).json({ error: `Failed to extract audio from video: ${err.message}` });
  }
});

// 2ca. Generate AI Lipsync Avatar (SadTalker) — async job, returns jobId immediately
app.post('/api/youtube/generate-avatar', async (req, res) => {
  const { projectId, avatarPath, enhancer } = req.body;
  if (!projectId || !avatarPath) {
    return res.status(400).json({ error: 'projectId and avatarPath are required.' });
  }

  try {
    const project = await dbService.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const voiceoverPath = project.state?.voiceoverPath;
    if (!voiceoverPath) return res.status(400).json({ error: 'No voiceover audio found. Generate audio first.' });

    const resolvedAudioPath = resolvePath(voiceoverPath);
    if (!resolvedAudioPath || !existsSync(resolvedAudioPath)) {
      return res.status(404).json({ error: `Voiceover file not found on disk: ${resolvedAudioPath}` });
    }

    // Resolve avatar — preset or custom upload
    let resolvedAvatarPath = '';
    const presetBaseName = path.basename(avatarPath);
    const presetPath = path.join(__dirname, 'presets', 'avatars', presetBaseName);
    resolvedAvatarPath = existsSync(presetPath) ? presetPath : resolvePath(avatarPath);
    if (!resolvedAvatarPath || !existsSync(resolvedAvatarPath)) {
      return res.status(404).json({ error: `Avatar image not found: ${avatarPath}` });
    }

    // ── Use GCP Avatar Pipeline if configured, fallback to local SadTalker ────
    const useGcp = !!process.env.AVATAR_API_URL;
    let jobId;

    if (useGcp) {
      // Cloud path — fast, GPU-powered, no local VRAM constraints
      console.log(`[API generate-avatar] Using GCP Avatar Pipeline (${process.env.AVATAR_API_URL})`);
      jobId = startGcpLipsyncJob(resolvedAvatarPath, resolvedAudioPath, { projectId });
    } else {
      // Local fallback — SadTalker on Mac (requires conda env)
      const sadtalkerDir = path.join(__dirname, 'sadtalker');
      if (!existsSync(path.join(sadtalkerDir, 'inference.py'))) {
        return res.status(500).json({
          error: 'No avatar pipeline configured. Set AVATAR_API_URL in .env to use GCP, or install SadTalker locally.'
        });
      }
      console.log(`[API generate-avatar] Using local SadTalker (fallback)`);
      jobId = startLipsyncJob(resolvedAvatarPath, resolvedAudioPath, {
        still: true,
        enhancer: false,
        preprocess: 'crop',
        size: 256,
        projectId
      });
    }

    // Store jobId on project for later state save
    project.state = project.state || {};
    project.state.lipsyncJobId = jobId;
    project.state.lipsyncMode = useGcp ? 'gcp' : 'local';
    await dbService.saveProject(project);

    console.log(`[API generate-avatar] Started job ${jobId} (mode: ${useGcp ? 'gcp' : 'local'})`);
    return res.json({ success: true, jobId, mode: useGcp ? 'gcp' : 'local', message: 'Lipsync job started. Poll /api/youtube/avatar-progress/:jobId for updates.' });

  } catch (error) {
    console.error('Error starting avatar job:', error);
    logErrorToFile('/api/youtube/generate-avatar', error);
    return res.status(500).json({ error: `Failed to start lipsync job: ${error.message}` });
  }
});

// 2ca-poll. Poll lipsync job progress (supports both GCP and local SadTalker jobs)
app.get('/api/youtube/avatar-progress/:jobId', async (req, res) => {
  const { jobId } = req.params;

  // Check GCP job map first (GCP job IDs start with 'gcp_')
  const isGcpJob = jobId.startsWith('gcp_');
  let job = isGcpJob ? getGcpJobStatus(jobId) : lipsyncJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.' });

  const elapsedSec = isGcpJob
    ? Math.floor((job.elapsedMs || 0) / 1000)
    : Math.floor((Date.now() - job.startedAt) / 1000);

  const response = {
    jobId,
    mode:       isGcpJob ? 'gcp' : 'local',
    status:     job.status,
    stage:      job.stage,
    stageLabel: job.stageLabel || job.stage,
    percent:    isGcpJob ? job.progress : job.percent,
    elapsedSec,
    error:      job.error || null,
  };

  // If done, attach result and save to project
  const isDone = job.status === 'done';
  if (isDone) {
    // GCP jobs return a public HTTPS video URL
    const videoUrl = isGcpJob ? job.videoUrl : job.result?.originalVideoUrl;
    const videoPath = isGcpJob ? job.videoUrl : job.result?.originalVideoPath;
    if (videoUrl) {
      response.originalVideoPath = videoPath;
      response.originalVideoUrl  = videoUrl;
    }

    // Persist to project state
    try {
      const { projectId } = req.query;
      if (projectId && videoUrl) {
        const project = await dbService.getProject(projectId);
        if (project) {
          project.state = project.state || {};
          project.state.originalVideoPath = videoPath;
          project.state.originalVideoUrl  = videoUrl;
          project.state.talkingHeadEnabled = true;
          await dbService.saveProject(project);
        }
      }
    } catch (_) {}

    // Clean up local job from memory after delivering result
    if (!isGcpJob) setTimeout(() => lipsyncJobs.delete(jobId), 60_000);
  }

  return res.json(response);
});

// 2cb. Upload custom avatar image
app.post('/api/youtube/upload-avatar', uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No avatar file uploaded.' });
  }
  const ext = path.extname(req.file.originalname).toLowerCase();
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  if (!allowed.includes(ext)) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'Invalid image format. Allowed formats: PNG, JPG, JPEG, WEBP.' });
  }

  const relativeUrl = `/uploads/avatars/${req.file.filename}`;
  const absolutePath = req.file.path;

  res.json({
    success: true,
    url: relativeUrl,
    path: absolutePath
  });
});

// 2cc. Avatar pipeline status check (GCP or local SadTalker)
app.get('/api/youtube/sadtalker-status', (req, res) => {
  const gcpConfigured = !!process.env.AVATAR_API_URL;

  if (gcpConfigured) {
    // GCP mode — just check the env var is set
    return res.json({
      installed: true,
      hasCheckpoints: true,
      mode: 'gcp',
      apiUrl: process.env.AVATAR_API_URL,
      message: `GCP Avatar Pipeline is configured and ready. (${process.env.AVATAR_API_URL})`
    });
  }

  // Local SadTalker fallback check
  const sadtalkerDir = path.join(__dirname, 'sadtalker');
  const inferenceScript = path.join(sadtalkerDir, 'inference.py');
  const checkpointsDir = path.join(sadtalkerDir, 'checkpoints');
  const isInstalled = existsSync(sadtalkerDir) && existsSync(inferenceScript);
  const hasCheckpoints = isInstalled && existsSync(checkpointsDir);
  res.json({
    installed: isInstalled,
    hasCheckpoints,
    mode: 'local',
    sadtalkerDir,
    message: isInstalled
      ? (hasCheckpoints ? 'SadTalker is installed and ready.' : 'SadTalker cloned but missing checkpoints. Run bash scripts/download_models_mac.sh inside backend/sadtalker/.')
      : 'No avatar pipeline configured. Set AVATAR_API_URL in backend/.env to use GCP, or install SadTalker locally.'
  });
});

// 2b. Extract audio from Library Video Clip endpoint
app.post('/api/clips/extract-audio', async (req, res) => {
  const { clipId } = req.body;
  if (!clipId) {
    return res.status(400).json({ error: 'clipId is required.' });
  }

  try {
    const clip = await dbService.getClip(clipId);
    if (!clip) {
      return res.status(404).json({ error: 'Clip not found.' });
    }

    let tempVideoPath = clip.path;
    if (gcsService.isGcsEnabled() && clip.path.startsWith('http')) {
      tempVideoPath = path.join(CLIPS_DIR, `temp_extract_${uuidv4()}.mp4`);
      await gcsService.downloadFile(clip.path, tempVideoPath);
    }

    const resolved = resolvePath(tempVideoPath);
    if (!resolved || !existsSync(resolved)) {
      return res.status(404).json({ error: 'Clip source file does not exist on disk.' });
    }

    const audioOutputFilename = `extracted_${clipId}.mp3`;
    const audioOutputPath = path.join(GENERATED_DIR, audioOutputFilename);

    const finalAudioPath = await extractAudioFromVideo(resolved, audioOutputPath);
    const finalFilename = path.basename(finalAudioPath);
    
    let finalAudioGcsPath = finalAudioPath;
    let finalAudioGcsUrl = `/uploads/generated/${finalFilename}`;

    if (gcsService.isGcsEnabled()) {
      finalAudioGcsPath = await gcsService.uploadFile(finalAudioPath, `generated/${finalFilename}`);
      finalAudioGcsUrl = finalAudioGcsPath;
      try {
        await fs.unlink(finalAudioPath);
      } catch (_) {}
    }

    if (tempVideoPath !== clip.path) {
      try {
        await fs.unlink(tempVideoPath);
      } catch (_) {}
    }

    res.json({
      success: true,
      audioPath: finalAudioGcsPath,
      audioUrl: finalAudioGcsUrl
    });
  } catch (err) {
    logErrorToFile('/api/clips/extract-audio', err);
    res.status(500).json({ error: `Failed to extract audio from clip: ${err.message}` });
  }
});

app.post('/api/enhance-script', async (req, res) => {
  const { scriptText } = req.body;
  if (!scriptText) {
    return res.status(400).json({ error: 'Script text is required.' });
  }

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    // Vertex AI client fallback

    const enhancedText = await enhanceScriptWithTags(scriptText, apiKey);
    res.json({ success: true, enhancedText });
  } catch (error) {
    console.error('Error in /api/enhance-script:', error);
    logErrorToFile('/api/enhance-script', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Script segmentation and time alignment (via Gemini)
app.post('/api/align-script', async (req, res) => {
  const { scriptText, audioPath, mergeShortScenes, language } = req.body;
  if (!audioPath) {
    return res.status(400).json({ error: 'Audio file path is required.' });
  }

  let tempLocalAudioPath = null;
  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    // Vertex AI client fallback

    let resolved = null;
    if (gcsService.isGcsEnabled() && audioPath.startsWith('http')) {
      tempLocalAudioPath = path.join(GENERATED_DIR, `temp_align_${uuidv4()}.mp3`);
      await gcsService.downloadFile(audioPath, tempLocalAudioPath);
      resolved = tempLocalAudioPath;
    } else {
      resolved = resolvePath(audioPath);
    }

    const rawSegments = await alignScriptAndAudio(scriptText || '', resolved, apiKey, language);
    
    // Try using Google Cloud Speech-to-Text for near-perfect 99% word timings (with automatic fallback to Gemini)
    let gcpWords = null;
    let useGcpTimings = false;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        console.log(`[GCP STT Aligner] Attempting GCP Speech-to-Text forced alignment...`);
        gcpWords = await getGcpWordTimings(resolved);
        if (gcpWords && gcpWords.length > 0) {
          useGcpTimings = true;
          console.log(`[GCP STT Aligner] Successfully retrieved ${gcpWords.length} precise word timings from GCP.`);
        }
      } catch (sttErr) {
        console.warn(`[GCP STT Aligner] GCP STT failed or is disabled. Falling back to Gemini timings. Reason:`, sttErr.message);
      }
    }

    if (useGcpTimings) {
      // Detect if gcpWords is in Devanagari (Hindi) script
      const isDevanagari = gcpWords.some(w => /[\u0900-\u097F]/.test(w.word));
      console.log(`[GCP STT Aligner] Detected transcription script: ${isDevanagari ? 'Devanagari (Hindi)' : 'Latin (Hinglish/English)'}`);
      
      // 1. Gather reference words in order
      const allHinglishWords = [];
      const allHindiWords = [];
      const segmentWordIndices = []; // Maps segment index to its slice of words
      
      for (let sIdx = 0; sIdx < rawSegments.length; sIdx++) {
        const seg = rawSegments[sIdx];
        if (seg.isBeatSyncOnly) continue;
        
        const textHinglish = seg.text_hinglish || seg.text || '';
        const hinglishList = textHinglish.trim().split(/\s+/).filter(w => w.length > 0);
        
        const textHindi = seg.text_hindi || '';
        const hindiList = textHindi.trim().split(/\s+/).filter(w => w.length > 0);
        
        segmentWordIndices.push({
          sIdx,
          hinglishCount: hinglishList.length,
          hindiCount: hindiList.length,
          hindiWordsText: hindiList,
          hinglishWordsText: hinglishList
        });
        
        allHinglishWords.push(...hinglishList);
        allHindiWords.push(...hindiList);
      }
      
      // 2. Perform optimal alignment based on transcription script
      let alignedHinglish = [];
      let alignedHindi = [];
      
      if (isDevanagari) {
        console.log(`[GCP STT Aligner] Aligning ${allHindiWords.length} Hindi script words to ${gcpWords.length} GCP STT words...`);
        alignedHindi = assignTimestampsToWords(allHindiWords, gcpWords);
        console.log(`[GCP STT Aligner] Mapping aligned Hindi word timings back to ${allHinglishWords.length} Hinglish script words...`);
        alignedHinglish = mapTimestamps(alignedHindi, allHinglishWords);
      } else {
        console.log(`[GCP STT Aligner] Aligning ${allHinglishWords.length} Hinglish script words to ${gcpWords.length} GCP STT words...`);
        alignedHinglish = assignTimestampsToWords(allHinglishWords, gcpWords);
        console.log(`[GCP STT Aligner] Mapping aligned Hinglish word timings back to ${allHindiWords.length} Hindi script words...`);
        alignedHindi = mapTimestamps(alignedHinglish, allHindiWords);
      }
      
      // 3. Re-distribute aligned words back to segments and update segment start/end bounds
      let hinglishPtr = 0;
      let hindiPtr = 0;
      
      for (const info of segmentWordIndices) {
        const seg = rawSegments[info.sIdx];
        const hinglishSlice = alignedHinglish.slice(hinglishPtr, hinglishPtr + info.hinglishCount);
        const hindiSlice = alignedHindi.slice(hindiPtr, hindiPtr + info.hindiCount);
        
        hinglishPtr += info.hinglishCount;
        hindiPtr += info.hindiCount;
        
        seg.words_hinglish = hinglishSlice;
        seg.words = hinglishSlice;
        seg.words_hindi = hindiSlice;
        
        // Update segment start/end times based on the precise first/last word timings
        if (hinglishSlice.length > 0) {
          const firstWord = hinglishSlice[0];
          const lastWord = hinglishSlice[hinglishSlice.length - 1];
          if (firstWord && lastWord) {
            seg.start_time = firstWord.start_time;
            seg.end_time = lastWord.end_time;
          }
        }
      }
      
      // 4. Ensure no gaps or negative durations on the timeline
      for (let i = 0; i < rawSegments.length; i++) {
        const current = rawSegments[i];
        if (i === 0) {
          current.start_time = 0.0;
        } else {
          current.start_time = rawSegments[i - 1].end_time;
        }
        
        if (current.end_time <= current.start_time) {
          current.end_time = current.start_time + 2.0; // minimum duration fallback
        }
      }
      console.log(`[GCP STT Aligner] Segment boundaries successfully adjusted to fit STT word timings.`);
    } else {
      console.log(`[Gemini Aligner] Adjusting segment boundaries to fit Gemini word timings...`);
      for (const seg of rawSegments) {
        if (seg.isBeatSyncOnly) continue;
        const wordsList = seg.words_hinglish || seg.words || [];
        if (wordsList.length > 0) {
          const firstWord = wordsList[0];
          const lastWord = wordsList[wordsList.length - 1];
          if (firstWord && lastWord) {
            seg.start_time = firstWord.start_time;
            seg.end_time = lastWord.end_time;
          }
        }
      }
      
      // Ensure no gaps or negative durations on the timeline
      for (let i = 0; i < rawSegments.length; i++) {
        const current = rawSegments[i];
        if (i === 0) {
          current.start_time = 0.0;
        } else {
          current.start_time = rawSegments[i - 1].end_time;
        }
        
        if (current.end_time <= current.start_time) {
          current.end_time = current.start_time + 2.0; // minimum duration fallback
        }
      }
      console.log(`[Gemini Aligner] Segment boundaries successfully adjusted to fit Gemini word timings.`);
    }
    
    // Check audio duration and fallback to beat sync at the end of dialogue
    let audioDuration = 0;
    try {
      audioDuration = await getVideoDuration(resolved);
    } catch (err) {
      console.warn('[Aligner] Failed to get audio duration:', err.message);
    }

    if (audioDuration > 0 && rawSegments && rawSegments.length > 0) {
      const lastSpeechEndTime = Math.max(...rawSegments.map(s => s.end_time));
      const hasScript = scriptText && scriptText.trim().length > 0;

      if (hasScript) {
        const lastSeg = rawSegments[rawSegments.length - 1];
        if (lastSeg) {
          console.log(`[Aligner] Adjusting last scene end_time from ${lastSeg.end_time}s to ${audioDuration}s to match audio duration.`);
          lastSeg.end_time = Number(audioDuration.toFixed(3));
        }
      } else if (audioDuration - lastSpeechEndTime > 2.0) {
        console.log(`[Aligner] Dialogue ends at ${lastSpeechEndTime}s, but audio runs until ${audioDuration}s. Appending beat-sync segments.`);
        try {
          // Detect beats for the remaining duration
          const beats = await detectBeats(resolved, 1.4, 0.4);
          
          // Filter beats that occur after the last speech segment ends
          const postBeats = beats.filter(b => b > lastSpeechEndTime + 0.2 && b < audioDuration - 0.2);
          postBeats.sort((a, b) => a - b);

          let currentStart = lastSpeechEndTime;
          const additionalSegments = [];
          
          for (const beat of postBeats) {
            additionalSegments.push({
              text: '',
              text_hindi: '',
              text_hinglish: '',
              start_time: Number(currentStart.toFixed(3)),
              end_time: Number(beat.toFixed(3)),
              words: [],
              words_hindi: [],
              words_hinglish: [],
              isBeatSyncOnly: true
            });
            currentStart = beat;
          }
          
          if (audioDuration - currentStart > 0.1) {
            additionalSegments.push({
              text: '',
              text_hindi: '',
              text_hinglish: '',
              start_time: Number(currentStart.toFixed(3)),
              end_time: Number(audioDuration.toFixed(3)),
              words: [],
              words_hindi: [],
              words_hinglish: [],
              isBeatSyncOnly: true
            });
          }

          rawSegments.push(...additionalSegments);
        } catch (beatErr) {
          console.error('[Aligner] Beat detection fallback failed:', beatErr);
        }
      } else {
        // Dialogue ends close to the audio end, adjust last segment to cover it exactly
        const lastSeg = rawSegments[rawSegments.length - 1];
        if (lastSeg) {
          console.log(`[Aligner] Adjusting last scene end_time from ${lastSeg.end_time}s to ${audioDuration}s to cover audio outro.`);
          lastSeg.end_time = Number(audioDuration.toFixed(3));
        }
      }
    }

    // Helper to interpolate timings for a text string and return a words array
    const interpolateWords = (text, start, end) => {
      const wordsText = (text || '').trim().split(/\s+/).filter(w => w.length > 0);
      if (wordsText.length === 0) return [];
      
      const segmentDuration = end - start;
      const totalChars = wordsText.reduce((sum, w) => sum + w.length, 0);
      
      let currentStart = start;
      const words = wordsText.map((word) => {
        const wordWeight = word.length / totalChars;
        const wordDuration = segmentDuration * wordWeight;
        const start_time = currentStart;
        const end_time = currentStart + wordDuration;
        currentStart = end_time;
        return {
          word,
          start_time: Number(start_time.toFixed(3)),
          end_time: Number(end_time.toFixed(3))
        };
      });
      
      if (words.length > 0) {
        words[words.length - 1].end_time = end;
      }
      return words;
    };
    
    // Helper to clamp and adjust word timings strictly within segment start/end times
    const clampWordTimings = (words, start_time, end_time) => {
      if (!words || words.length === 0) return [];
      const duration = end_time - start_time;
      const adjustedLocal = getLocalWordTimings(words, start_time, duration);
      return words.map((w, idx) => ({
        ...w,
        start_time: Number((start_time + adjustedLocal[idx].start).toFixed(3)),
        end_time: Number((start_time + adjustedLocal[idx].end).toFixed(3))
      }));
    };

    // Helper to merge segments shorter than 2.0s to ensure a minimum scene length
    const enforceMinimumSegmentDuration = (segs) => {
      if (!segs || segs.length <= 1) return segs;
      
      const minDuration = 2.0;
      const result = [];
      const segsCopy = segs.map(s => ({ ...s }));
      
      // First pass: merge short segments
      for (let i = 0; i < segsCopy.length; i++) {
        const current = segsCopy[i];
        const dur = current.end_time - current.start_time;
        
        if (dur < minDuration) {
          if (result.length > 0) {
            const prev = result[result.length - 1];
            console.log(`[Post-processing Aligner] Merging short segment ${i} (${dur.toFixed(2)}s) into previous segment (${(prev.end_time - prev.start_time).toFixed(2)}s)`);
            
            prev.end_time = Number(current.end_time.toFixed(3));
            prev.text = ((prev.text || '') + ' ' + (current.text || '')).trim();
            prev.text_hindi = ((prev.text_hindi || '') + ' ' + (current.text_hindi || '')).trim();
            prev.text_hinglish = ((prev.text_hinglish || '') + ' ' + (current.text_hinglish || '')).trim();
            
            prev.words = [...(prev.words || []), ...(current.words || [])];
            prev.words_hindi = [...(prev.words_hindi || []), ...(current.words_hindi || [])];
            prev.words_hinglish = [...(prev.words_hinglish || []), ...(current.words_hinglish || [])];
            
            if (current.isBeatSyncOnly && prev.isBeatSyncOnly) {
              prev.isBeatSyncOnly = true;
            } else {
              delete prev.isBeatSyncOnly;
            }
          } else if (i + 1 < segsCopy.length) {
            const next = segsCopy[i + 1];
            console.log(`[Post-processing Aligner] Merging short segment ${i} (${dur.toFixed(2)}s) forward into next segment (${(next.end_time - next.start_time).toFixed(2)}s)`);
            
            next.start_time = Number(current.start_time.toFixed(3));
            next.text = ((current.text || '') + ' ' + (next.text || '')).trim();
            next.text_hindi = ((current.text_hindi || '') + ' ' + (next.text_hindi || '')).trim();
            next.text_hinglish = ((current.text_hinglish || '') + ' ' + (next.text_hinglish || '')).trim();
            
            next.words = [...(current.words || []), ...(next.words || [])];
            next.words_hindi = [...(current.words_hindi || []), ...(next.words_hindi || [])];
            next.words_hinglish = [...(current.words_hinglish || []), ...(next.words_hinglish || [])];
            
            if (current.isBeatSyncOnly && next.isBeatSyncOnly) {
              next.isBeatSyncOnly = true;
            } else {
              delete next.isBeatSyncOnly;
            }
          } else {
            result.push(current);
          }
        } else {
          result.push(current);
        }
      }
      
      // Clean up pass: check if the last segment is too short and merge it back
      if (result.length > 1) {
        const lastIdx = result.length - 1;
        const last = result[lastIdx];
        const lastDur = last.end_time - last.start_time;
        if (lastDur < minDuration) {
          const prev = result[lastIdx - 1];
          console.log(`[Post-processing Aligner] Clean up merge: Merging last segment (${lastDur.toFixed(2)}s) into previous segment`);
          
          prev.end_time = Number(last.end_time.toFixed(3));
          prev.text = ((prev.text || '') + ' ' + (last.text || '')).trim();
          prev.text_hindi = ((prev.text_hindi || '') + ' ' + (last.text_hindi || '')).trim();
          prev.text_hinglish = ((prev.text_hinglish || '') + ' ' + (last.text_hinglish || '')).trim();
          
          prev.words = [...(prev.words || []), ...(last.words || [])];
          prev.words_hindi = [...(prev.words_hindi || []), ...(last.words_hindi || [])];
          prev.words_hinglish = [...(prev.words_hinglish || []), ...(last.words_hinglish || [])];
          
          if (last.isBeatSyncOnly && prev.isBeatSyncOnly) {
            prev.isBeatSyncOnly = true;
          } else {
            delete prev.isBeatSyncOnly;
          }
          result.pop();
        }
      }
      
      return result;
    };

    const mergedSegments = mergeShortScenes !== false
      ? enforceMinimumSegmentDuration(rawSegments)
      : rawSegments;

    // Process and interpolate word timings if they are missing
    const segments = mergedSegments.map(seg => {
      if (seg.isBeatSyncOnly) {
        return seg;
      }

      // Always prioritize Hinglish text and words for standard display
      if (seg.text_hinglish && seg.text_hinglish.trim() !== '') {
        seg.text = seg.text_hinglish;
      } else if (!seg.text && seg.text_hindi) {
        seg.text = seg.text_hindi;
      }

      // 1. Process words_hinglish if missing
      if (!seg.words_hinglish || !Array.isArray(seg.words_hinglish) || seg.words_hinglish.length === 0) {
        seg.words_hinglish = interpolateWords(seg.text_hinglish || '', seg.start_time, seg.end_time);
      } else {
        seg.words_hinglish = clampWordTimings(seg.words_hinglish, seg.start_time, seg.end_time);
      }

      // 2. Process words_hindi if missing
      if (!seg.words_hindi || !Array.isArray(seg.words_hindi) || seg.words_hindi.length === 0) {
        seg.words_hindi = interpolateWords(seg.text_hindi || '', seg.start_time, seg.end_time);
      } else {
        seg.words_hindi = clampWordTimings(seg.words_hindi, seg.start_time, seg.end_time);
      }

      // 3. Process standard words (always map to Hinglish)
      if (seg.words_hinglish && seg.words_hinglish.length > 0) {
        seg.words = seg.words_hinglish;
      } else if (!seg.words || !Array.isArray(seg.words) || seg.words.length === 0) {
        seg.words = interpolateWords(seg.text || '', seg.start_time, seg.end_time);
      } else {
        seg.words = clampWordTimings(seg.words, seg.start_time, seg.end_time);
      }
      
      return seg;
    });

    res.json({ success: true, segments });
  } catch (error) {
    console.error('Error in /api/align-script:', error);
    logErrorToFile('/api/align-script', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (tempLocalAudioPath && existsSync(tempLocalAudioPath)) {
      try {
        await fs.unlink(tempLocalAudioPath);
        console.log(`[Align Script] Cleaned up temporary align file: ${tempLocalAudioPath}`);
      } catch (_) {}
    }
  }
});

app.post('/api/beat-sync/analyze', async (req, res) => {
  const { audioPath, threshold } = req.body;
  if (!audioPath) {
    return res.status(400).json({ error: 'Audio file path is required.' });
  }

  let tempLocalAudioPath = null;
  try {
    let resolved = null;
    if (gcsService.isGcsEnabled() && audioPath.startsWith('http')) {
      tempLocalAudioPath = path.join(MUSIC_DIR, `temp_beat_${uuidv4()}.mp3`);
      await gcsService.downloadFile(audioPath, tempLocalAudioPath);
      resolved = tempLocalAudioPath;
    } else {
      resolved = resolvePath(audioPath);
    }

    const thresh = threshold !== undefined ? Number(threshold) : 1.4;
    // Detect Major Beats (default minDistance = 0.4s)
    const beats = await detectBeats(resolved, thresh, 0.4);

    // Detect Minor sub-beats (lower threshold, e.g. thresh - 0.20, and smaller minDistance = 0.15s)
    const minorThresh = Math.max(0.6, thresh - 0.20);
    const allPeaks = await detectBeats(resolved, minorThresh, 0.15);

    // Filter out minor peaks that are too close to major beats (within 0.18s) to avoid overlaps
    const miniBeats = allPeaks.filter(p => {
      return !beats.some(b => Math.abs(b - p) < 0.18);
    });

    res.json({ success: true, beats, miniBeats });
  } catch (error) {
    console.error('Error in /api/beat-sync/analyze:', error);
    logErrorToFile('/api/beat-sync/analyze', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (tempLocalAudioPath && existsSync(tempLocalAudioPath)) {
      try {
        await fs.unlink(tempLocalAudioPath);
      } catch (_) {}
    }
  }
});

// 4. Storyboard clip matching (via Gemini)
app.post('/api/match-clips', async (req, res) => {
  const { scenes, talkingHead, useAiFallback, excludeBroll } = req.body;
  if (!scenes || !Array.isArray(scenes)) {
    return res.status(400).json({ error: 'Storyboard scenes list is required.' });
  }

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    const userId = getUserId(req);

    // Retrieve subject profile references if available
    let subjectPhotoPath = null;
    let profileSummary = '';
    try {
      const profile = await dbService.getSubjectProfile(userId);
      if (profile && profile.photos && profile.photos.length > 0) {
        const frontPhoto = profile.photos.find(p => p.angle.toLowerCase() === 'front') || profile.photos[0];
        const relativePath = frontPhoto.path.replace(/^\//, '');
        subjectPhotoPath = resolvePath(relativePath);
        profileSummary = profile.summary || '';
      }
    } catch (_) {}

    const clips = await dbService.getClips(userId);

    // Only match against "ready" status clips
    let filteredClips = clips.filter(c => c.status === 'ready');
    if (excludeBroll) {
      filteredClips = filteredClips.filter(clip => {
        const nameLower = (clip.name || '').toLowerCase();
        const pathLower = (clip.path || '').toLowerCase();
        const tags = clip.tags || [];
        const hasSystemTag = tags.some(t => 
          t === 'stock_downloaded' || 
          t === 'ai_generated' || 
          t === 'fallback' || 
          t === 'recreate_fallback'
        );
        if (hasSystemTag) return false;
        if (nameLower.startsWith('stock') || nameLower.startsWith('ai -') || nameLower.startsWith('ai_')) return false;
        if (clip.id && (clip.id.startsWith('pexels_') || clip.id.startsWith('pixabay_') || clip.id.startsWith('ai_clip_'))) return false;
        const filename = pathLower.split('/').pop() || '';
        if (filename.startsWith('stock_') || filename.startsWith('ai_clip_')) return false;
        return true;
      });
    }

    const readyClips = filteredClips.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      tags: c.tags,
      duration: c.duration,
      segments: c.segments || []
    }));

    let matches = [];
    if (readyClips.length > 0) {
      matches = await matchClipsToScenes(scenes, readyClips, apiKey, !!talkingHead);
    } else {
      // If no library clips exist, initialize empty matches
      matches = scenes.map((s, idx) => ({
        sceneIndex: idx,
        clipId: '',
        clipStart: 0,
        reason: 'No library clips available.'
      }));
    }

    // Process AI Fallback for unmatched scenes
    if (useAiFallback) {
      console.log('[Match Clips] AI Fallback is active. Checking for unmatched scenes...');
      for (const match of matches) {
        const scene = scenes[match.sceneIndex];
        const isMatched = match.clipId && match.clipId !== 'original' && readyClips.some(c => c.id === match.clipId);
        
        if (!isMatched) {
          console.log(`[Match Clips] Scene ${match.sceneIndex} is unmatched. Generating AI Fallback clip...`);
          try {
            const scenePrompt = scene.visual_description || scene.text || 'abstract cinematic slow motion';
            
            // Build the detailed prompt incorporating subject summary if available
            let fullPrompt = scenePrompt;
            if (profileSummary) {
              fullPrompt = `High quality, 8k, photorealistic. Subject appearance details: ${profileSummary}. Scene action: ${scenePrompt}`;
            }

            const sceneDuration = scene.duration || (scene.end_time - scene.start_time) || 5;
            
            // Generate the clip (defaulting to video motion)
            const result = await generateAiAsset(fullPrompt, 'video', sceneDuration, apiKey, subjectPhotoPath);
            
            // Create a new clip in the library
            const newClip = {
              id: result.id,
              userId,
              path: result.path,
              name: `AI - ${scenePrompt.substring(0, 25)}`,
              thumbnail: result.thumbnail,
              duration: result.duration,
              description: 'AI Generated fallback: ' + fullPrompt,
              tags: ['ai_generated', 'fallback'],
              status: 'analyzing'
            };
            await dbService.saveClip(newClip);

            // Trigger background visual analysis
            const absoluteVideoPath = resolvePath(result.path);
            analyzeVideoInBackground(result.id, absoluteVideoPath, apiKey);

            // Assign the AI generated clip to this scene match!
            match.clipId = result.id;
            match.clipStart = 0;
            match.reason = `AI generated fallback clip for: "${scenePrompt.substring(0, 30)}..."`;
            
          } catch (err) {
            console.error(`[Match Clips] Failed to generate AI fallback for scene ${match.sceneIndex}:`, err);
          }
        }
      }
    } else {
      // If AI fallback is false and no clips are ready, throw error
      if (readyClips.length === 0) {
        return res.status(400).json({ error: 'No analyzed clips found in the library. Please import and analyze video clips first, or toggle AI Generated Fallback.' });
      }
    }

    res.json({ success: true, matches });
  } catch (error) {
    console.error('Error in /api/match-clips:', error);
    logErrorToFile('/api/match-clips', error);
    res.status(500).json({ error: error.message });
  }
});

// Font Verification/Downloader Endpoint
app.post('/api/fonts/ensure', async (req, res) => {
  const { fontName } = req.body;
  if (!fontName) {
    return res.status(400).json({ error: 'fontName is required' });
  }

  try {
    await ensureFontExists(fontName);
    res.json({ success: true, message: `Font ${fontName} is ready for rendering.` });
  } catch (error) {
    console.error(`Error in /api/fonts/ensure for ${fontName}:`, error);
    logErrorToFile('/api/fonts/ensure', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-video', async (req, res) => {
  const {
    projectId,
    scenes,
    voiceoverPath,
    originalVideoPath,
    bgMusicPath,
    bgMusicVolume,
    bgMusicStartOffset,
    voiceoverVolume,
    aspectRatio,
    fillMode,
    subtitleStyle,
    clipTransition,
    transitionDuration,
    zoomAnimation,
    exportResolution,
    exportFps,
    miniBeats,
    miniBeatEffect,
    beatEffects,
    backgroundType,
    backgroundColor,
    backgroundPattern,
    backgroundImageUrl,
    brandPrimaryColor,
    brandSecondaryColor,
    cardPositionY,
    cardScale,
    cardFontName,
    showLayoutCards,
    backgroundClipId,
    talkingHeadEnabled,
    talkingHeadChromaColor,
    talkingHeadChromaSimilarity,
    talkingHeadChromaBlend,
    talkingHeadSize,
    talkingHeadPosition,
    talkingHeadPositionX,
    talkingHeadPositionY,
    talkingHeadOutlineEnabled,
    talkingHeadOutlineColor,
    talkingHeadOutlineThickness,
    talkingHeadMode,
    subtitlesOnly,
    videoVolume,
    sfxVolume,
    entities,
    graphEvents,
    graphSettings
  } = req.body;

  if (!scenes || !voiceoverPath) {
    return res.status(400).json({ error: 'Scenes and voiceover file path are required.' });
  }

  const userId = getUserId(req);
  let user = null;
  let estimatedCredits = 0;
  const jobId = uuidv4();

  let tempLocalVoiceoverPath = null;
  let resolvedVoiceoverPath = voiceoverPath;

  try {
    if (gcsService.isGcsEnabled() && voiceoverPath.startsWith('http')) {
      tempLocalVoiceoverPath = path.join(GENERATED_DIR, `temp_dur_gen_${jobId}.mp3`);
      await gcsService.downloadFile(voiceoverPath, tempLocalVoiceoverPath);
      resolvedVoiceoverPath = tempLocalVoiceoverPath;
    } else {
      resolvedVoiceoverPath = resolvePath(voiceoverPath);
    }

    const resolvedBgMusicPath = bgMusicPath ? resolvePath(bgMusicPath) : null;

    if (userId !== 'local-user') {
      user = await dbService.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      
      try {
        if (resolvedVoiceoverPath && existsSync(resolvedVoiceoverPath)) {
          const duration = await getVideoDuration(resolvedVoiceoverPath);
          estimatedCredits = Math.max(1, Math.ceil(duration));
        } else {
          return res.status(400).json({ error: `Voiceover audio file does not exist: ${voiceoverPath}` });
        }
      } catch (err) {
        return res.status(500).json({ error: `Failed to determine audio duration: ${err.message}` });
      }

      if (user.credits < estimatedCredits) {
        return res.status(403).json({ error: `Insufficient credits. Need ${estimatedCredits} credits, but you only have ${user.credits} remaining.` });
      }

      // Deduct credits upfront
      user.credits = Math.max(0, user.credits - estimatedCredits);
      await dbService.saveUser(user);
    }

    // Clean up temporary voiceover file used for duration check
    if (tempLocalVoiceoverPath && existsSync(tempLocalVoiceoverPath)) {
      try {
        await fs.unlink(tempLocalVoiceoverPath);
      } catch (_) {}
    }

    const jobState = {
      id: jobId,
      projectId: projectId || null,
      progress: 0,
      status: 'Queued',
      resultUrl: null,
      error: null
    };

    activeJobs.set(jobId, jobState);

    // Persist job to Firestore so user can track it after tab close
    const jobTitle = projectId ? `Video Render` : `Quick Render`;
    dbService.saveRenderJob({
      jobId,
      userId,
      type: 'voiceover',
      title: jobTitle,
      status: 'rendering',
      progress: 0,
      resultUrl: null,
      error: null,
      createdAt: new Date().toISOString()
    }).catch(e => console.error('[Render History] Failed to save job:', e.message));

    const clips = await dbService.getClips(userId);

    // Trigger video compilation in background
    runVideoCompilation(jobId, {
      projectId,
      userId,
      estimatedCredits,
      scenes,
      clips: clips.map(c => ({
        ...c,
        path: gcsService.isGcsEnabled() ? c.path : resolvePath(c.path)
      })),
      voiceoverPath: gcsService.isGcsEnabled() ? voiceoverPath : resolvePath(voiceoverPath),
      originalVideoPath: originalVideoPath ? (gcsService.isGcsEnabled() ? originalVideoPath : resolvePath(originalVideoPath)) : null,
      bgMusicPath: bgMusicPath ? (gcsService.isGcsEnabled() ? bgMusicPath : resolvePath(bgMusicPath)) : null,
      bgMusicVolume,
      bgMusicStartOffset,
      voiceoverVolume,
      aspectRatio,
      fillMode,
      subtitleStyle,
      clipTransition,
      transitionDuration,
      zoomAnimation,
      exportResolution,
      exportFps,
      miniBeats,
      miniBeatEffect,
      beatEffects,
      backgroundType,
      backgroundColor,
      backgroundPattern,
      backgroundImageUrl,
      brandPrimaryColor,
      brandSecondaryColor,
      cardPositionY,
      cardScale,
      cardFontName,
      showLayoutCards,
      backgroundClipId,
      talkingHeadEnabled,
      talkingHeadChromaColor,
      talkingHeadChromaSimilarity,
      talkingHeadChromaBlend,
      talkingHeadSize,
      talkingHeadPosition,
      talkingHeadPositionX,
      talkingHeadPositionY,
      talkingHeadOutlineEnabled,
      talkingHeadOutlineColor,
      talkingHeadOutlineThickness,
      talkingHeadMode,
      subtitlesOnly,
      videoVolume,
      sfxVolume,
      entities,
      graphEvents,
      graphSettings,
      outputDir: GENERATED_DIR
    });

    res.json({ success: true, jobId });
  } catch (error) {
    if (tempLocalVoiceoverPath && existsSync(tempLocalVoiceoverPath)) {
      try {
        await fs.unlink(tempLocalVoiceoverPath);
      } catch (_) {}
    }
    res.status(500).json({ error: error.message });
  }
});

// Background Video Assembler
async function runVideoCompilation(jobId, options) {
  const job = activeJobs.get(jobId);
  const { userId, estimatedCredits } = options;
  try {
    job.status = 'Starting compilation...';
    job.progress = 5;

    const outputFilename = `render_${jobId}.mp4`;
    const localOutputPath = path.join(options.outputDir, outputFilename);

    // Ensure all clips are 30 fps CFR H.264 before rendering
    const processedClips = [];
    for (const c of options.clips || []) {
      if (!c.path || c.path.startsWith('http')) {
        processedClips.push(c);
        continue;
      }
      
      const originalPath = c.path;
      const isCfrAlready = originalPath.endsWith('_cfr.mp4');
      
      if (isCfrAlready) {
        processedClips.push(c);
        continue;
      }
      
      const ext = path.extname(originalPath);
      const dir = path.dirname(originalPath);
      const baseName = path.basename(originalPath, ext);
      const cfrPath = path.join(dir, `${baseName}_cfr.mp4`);
      
      if (existsSync(cfrPath)) {
        console.log(`[Recreation Render] Using cached CFR version for clip ${c.id}: ${cfrPath}`);
        processedClips.push({ ...c, path: cfrPath });
      } else {
        console.log(`[Recreation Render] Transcoding clip ${c.id} to 30 fps CFR H.264...`);
        try {
          await runFFmpeg([
            '-i', originalPath,
            '-vf', "fps=30,scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2",
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-y',
            cfrPath
          ]);
          console.log(`[Recreation Render] Transcoded successfully: ${cfrPath}`);
          processedClips.push({ ...c, path: cfrPath });
        } catch (err) {
          console.error(`[Recreation Render] Failed to transcode clip ${c.id} to CFR:`, err);
          processedClips.push(c);
        }
      }
    }
    options.clips = processedClips;

    // Transcode originalVideoPath if needed
    if (options.originalVideoPath && !options.originalVideoPath.startsWith('http')) {
      const originalPath = options.originalVideoPath;
      if (!originalPath.endsWith('_cfr.mp4')) {
        const ext = path.extname(originalPath);
        const dir = path.dirname(originalPath);
        const baseName = path.basename(originalPath, ext);
        const cfrPath = path.join(dir, `${baseName}_cfr.mp4`);
        
        if (existsSync(cfrPath)) {
          console.log(`[Recreation Render] Using cached CFR version for original video: ${cfrPath}`);
          options.originalVideoPath = cfrPath;
        } else {
          console.log(`[Recreation Render] Transcoding original video to 30 fps CFR H.264...`);
          try {
            await runFFmpeg([
              '-i', originalPath,
              '-vf', "fps=30,scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2",
              '-c:v', 'libx264',
              '-pix_fmt', 'yuv420p',
              '-c:a', 'aac',
              '-b:a', '128k',
              '-y',
              cfrPath
            ]);
            console.log(`[Recreation Render] Transcoded original video successfully: ${cfrPath}`);
            options.originalVideoPath = cfrPath;
          } catch (err) {
            console.error(`[Recreation Render] Failed to transcode original video to CFR:`, err);
          }
        }
      }
    }

    // Map clips list for lookup
    const clipsMap = new Map((options.clips || []).map(c => [c.id, c.path]));

    // Construct the project state for Remotion inputProps
    const remotionProps = {
      scenes: options.scenes.map(s => ({
        ...s,
        clipUrl: s.clipId === 'original' 
          ? options.originalVideoPath 
          : (clipsMap.get(s.clipId) || null)
      })),
      voiceoverUrl: options.voiceoverPath,
      voiceoverVolume: options.voiceoverVolume !== undefined ? options.voiceoverVolume : 1.0,
      bgMusicUrl: options.bgMusicPath,
      bgMusicVolume: options.bgMusicVolume !== undefined ? options.bgMusicVolume : 0.15,
      videoVolume: options.videoVolume !== undefined ? options.videoVolume : 0.0,
      sfxVolume: options.sfxVolume !== undefined ? options.sfxVolume : 1.0,
      subtitleMode: options.subtitleStyle?.subtitleMode || 'classic',
      highlightTrigger: options.subtitleStyle?.highlightTrigger || 'all',
      textCase: options.subtitleStyle?.textCase || 'default',
      autoEmphasis: !!options.subtitleStyle?.autoEmphasis,
      fontName: options.subtitleStyle?.fontName || 'Montserrat ExtraBold',
      fontSize: options.subtitleStyle?.fontSize || 26,
      bold: options.subtitleStyle?.bold !== undefined ? options.subtitleStyle.bold : true,
      italic: options.subtitleStyle?.italic !== undefined ? options.subtitleStyle.italic : false,
      shadow: options.subtitleStyle?.shadow !== undefined ? options.subtitleStyle.shadow : false,
      activeWordScale: options.subtitleStyle?.activeWordScale !== undefined ? options.subtitleStyle.activeWordScale : 1.15,
      normalStyle: options.subtitleStyle?.normalStyle,
      highlightStyle: options.subtitleStyle?.highlightStyle,
      emojiStyle: options.subtitleStyle?.emojiStyle,
      outlineColor: options.subtitleStyle?.outlineColor || '#000000',
      outlineThickness: options.subtitleStyle?.outlineThickness !== undefined ? options.subtitleStyle.outlineThickness : 1.5,
      shadowColor: options.subtitleStyle?.shadowColor || '#000000',
      shadowBlur: options.subtitleStyle?.shadowBlur !== undefined ? options.subtitleStyle.shadowBlur : 4,
      shadowDistance: options.subtitleStyle?.shadowDistance !== undefined ? options.subtitleStyle.shadowDistance : 2,
      shadowAngle: options.subtitleStyle?.shadowAngle !== undefined ? options.subtitleStyle.shadowAngle : 45,
      shadowOpacity: options.subtitleStyle?.shadowOpacity !== undefined ? options.subtitleStyle.shadowOpacity : 0.6,
      neonGlow: !!options.subtitleStyle?.neonGlow,
      glowColor: options.subtitleStyle?.glowColor || '#FFFFFF',
      glowBlur: options.subtitleStyle?.glowBlur !== undefined ? options.subtitleStyle.glowBlur : 8,
      glowDistance: options.subtitleStyle?.glowDistance !== undefined ? options.subtitleStyle.glowDistance : 4,
      aspectRatio: options.aspectRatio || '9:16',
      fillMode: options.fillMode || 'crop',
      textPositionX: options.subtitleStyle?.textPositionX || 0,
      textPositionY: options.subtitleStyle?.textPositionY || -70,
      maxWordsPerLine: options.subtitleStyle?.maxWordsPerLine || 3,
      letterSpacing: options.subtitleStyle?.letterSpacing !== undefined ? options.subtitleStyle.letterSpacing : 0,
      wordSpacing: options.subtitleStyle?.wordSpacing !== undefined ? options.subtitleStyle.wordSpacing : 0,
      entities: options.entities || [],
      graphEvents: options.graphEvents || [],
      graphSettings: options.graphSettings || null,
      backgroundColor: options.backgroundColor || '#080c18',
      backgroundPattern: options.backgroundPattern || 'grid',
      backgroundImageUrl: options.backgroundImageUrl || null,
      brandPrimaryColor: options.brandPrimaryColor || '#d4af37',
      brandSecondaryColor: options.brandSecondaryColor || '#f5e6a3',
      cardPositionY: options.cardPositionY !== undefined ? options.cardPositionY : 0,
      cardScale: options.cardScale !== undefined ? options.cardScale : 1.0,
      cardFontName: options.cardFontName || 'Montserrat',
      showLayoutCards: options.showLayoutCards !== undefined ? options.showLayoutCards : true,
      subtitlesOnly: !!options.subtitlesOnly,
      isRendering: true
    };

    console.log(`[Recreation Render] Triggering Remotion render...`);

    await renderRemotionVideo(remotionProps, localOutputPath, (progress) => {
      const progressPercent = Math.round(5 + progress * 90);
      job.progress = progressPercent;
      job.status = `Rendering frames: ${progressPercent}%`;
    });

    let outputPath = localOutputPath;
    if (gcsService.isGcsEnabled()) {
      job.status = 'Uploading to Cloud Storage...';
      const gcsUrl = await gcsService.uploadFile(localOutputPath, `generated/render_${jobId}.mp4`);
      outputPath = gcsUrl;
      try {
        await fs.unlink(localOutputPath);
      } catch (_) {}
    }

    job.progress = 100;
    job.status = 'Completed';
    job.resultUrl = outputPath.startsWith('http') ? outputPath : `/uploads/generated/${path.basename(outputPath)}`;

    // Persist completion to Firestore
    dbService.updateRenderJob(jobId, {
      status: 'completed',
      progress: 100,
      resultUrl: job.resultUrl,
      completedAt: new Date().toISOString()
    }).catch(e => console.error('[Render History] Failed to update completed job:', e.message));

    // Associate rendered video path with project
    if (options.projectId) {
      const proj = await dbService.getProject(options.projectId);
      if (proj) {
        proj.state = proj.state || {};
        proj.state.lastRenderedVideoPath = outputPath;
        proj.updatedAt = new Date().toISOString();
        await dbService.saveProject(proj);
      }
    }
  } catch (error) {
    console.error(`Rendering job ${jobId} failed:`, error);
    logErrorToFile(`runVideoCompilation - Job ${jobId}`, error);
    job.progress = 100;
    job.status = 'Failed';
    job.error = error.message;

    // Persist failure to Firestore
    dbService.updateRenderJob(jobId, {
      status: 'failed',
      progress: 100,
      error: error.message,
      completedAt: new Date().toISOString()
    }).catch(e => console.error('[Render History] Failed to update failed job:', e.message));

    // Refund credits on failure
    if (userId && userId !== 'local-user' && estimatedCredits > 0) {
      try {
        const user = await dbService.getUser(userId);
        if (user) {
          user.credits += estimatedCredits;
          await dbService.saveUser(user);
          console.log(`[Billing] Refunded ${estimatedCredits} credits to user ${userId} due to compilation failure.`);
        }
      } catch (refundErr) {
        console.error('[Billing] Failed to refund credits on failure:', refundErr);
      }
    }
  }
}

// GET /api/renders - Render history for current user (persisted in Firestore)
app.get('/api/renders', async (req, res) => {
  const userId = getUserId(req);
  try {
    // Merge in-memory active jobs with persisted history
    const persisted = await dbService.listRenderJobs(userId);
    // Update status of any persisted jobs that are still actively running
    const merged = persisted.map(job => {
      const live = activeJobs.get(job.jobId);
      if (live && (live.status !== 'Completed' && live.status !== 'Failed')) {
        return { ...job, status: 'rendering', progress: live.progress };
      }
      return job;
    });
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expose all currently active rendering jobs
app.get('/api/jobs/active', (req, res) => {
  const activeList = [];
  for (const [jobId, job] of activeJobs.entries()) {
    activeList.push(job);
  }
  res.json(activeList);
});

// 6. Server-Sent Events (SSE) connection for progress reporting
app.get('/api/jobs/:id/progress', (req, res) => {
  const { id } = req.params;
  const job = activeJobs.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = () => {
    const updatedJob = activeJobs.get(id);
    if (!updatedJob) return;

    res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);

    if (updatedJob.progress >= 100 || updatedJob.status === 'Failed' || updatedJob.status === 'Completed') {
      clearInterval(intervalId);
      res.end();
      // Keep completed job data in memory for a short time (e.g. 5 minutes) before cleaning
      setTimeout(() => {
        activeJobs.delete(id);
      }, 5 * 60 * 1000);
    }
  };

  // Send initial progress
  sendProgress();

  // Send progress every 1s
  const intervalId = setInterval(sendProgress, 1000);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Helper to run python script for downloading reels
function runDownloadReel(url, outDir, filename, ffmpegPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'services', 'download_reel.py');
    const args = [scriptPath, url, outDir, filename];
    if (ffmpegPath) {
      args.push(ffmpegPath);
    }
    
    console.log(`[Recreate] Running downloader script: python3 ${args.join(' ')}`);
    const proc = spawn('python3', args);
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (d) => stdout += d.toString());
    proc.stderr.on('data', (d) => stderr += d.toString());
    
    proc.on('close', (code) => {
      console.log(`[Recreate] Downloader stdout: ${stdout}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Reel download failed with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}

// POST endpoint to download and analyze Reel
app.post('/api/recreate/analyze', async (req, res) => {
  const { url, projectName, recreateId, useAiFallback } = req.body;
  const userId = getUserId(req);

  let videoFilename;
  let videoPath;
  let audioFilename;
  let audioPath;
  let analysis;
  let originalUrl = url;

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    if (recreateId) {
      console.log(`[Recreate] Reusing saved recreation: ${recreateId}`);
      const recreate = await dbService.getRecreate(recreateId);
      if (!recreate) {
        return res.status(404).json({ error: 'Saved recreation not found.' });
      }

      if (recreate.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized to use this recreation.' });
      }

      videoFilename = path.basename(recreate.videoUrl);
      videoPath = path.join(RECREATE_DIR, videoFilename);
      audioFilename = path.basename(recreate.audioUrl);
      audioPath = path.join(RECREATE_DIR, audioFilename);
      analysis = recreate.analysis;
      originalUrl = recreate.url;

      // Verify files exist on disk
      if (!existsSync(videoPath) || !existsSync(audioPath)) {
        return res.status(400).json({
          error: 'The cached video or audio files for this recreation were not found on disk. Please recreate from URL.'
        });
      }
    } else {
      if (!url) {
        return res.status(400).json({ error: 'Reel URL is required.' });
      }

      const newRecreateId = uuidv4();
      videoFilename = `reel_${newRecreateId}.mp4`;
      videoPath = path.join(RECREATE_DIR, videoFilename);
      audioFilename = `audio_${newRecreateId}.mp3`;
      audioPath = path.join(RECREATE_DIR, audioFilename);

      // 1. Download Video
      console.log(`[Recreate] Starting download for: ${url}`);
      await runDownloadReel(url, RECREATE_DIR, videoFilename, ffmpegPath);

      if (!existsSync(videoPath)) {
        throw new Error('Downloaded video file not found.');
      }

      // 2. Extract Audio
      console.log(`[Recreate] Extracting audio from video: ${videoPath} -> ${audioPath}`);
      await extractAudioFromVideo(videoPath, audioPath);

      if (!existsSync(audioPath)) {
        throw new Error('Extracted audio file not found.');
      }

      // 3. Analyze Video with Gemini
      console.log(`[Recreate] Running Gemini analysis on Reel...`);
      analysis = await analyzeRecreatedReel(videoPath, apiKey);

      // Save to database
      console.log(`[Recreate] Saving download and analysis progress...`);
      await dbService.saveRecreate({
        id: newRecreateId,
        userId,
        url,
        projectName: projectName || `Recreated Reel (${new Date().toLocaleDateString()})`,
        videoUrl: `/uploads/recreate/${videoFilename}`,
        audioUrl: `/uploads/recreate/${audioFilename}`,
        analysis,
        createdAt: new Date().toISOString()
      });
    }

    // 4. Retrieve Clips and Match them semantically (only matching existing clips, excluding stock B-roll)
    console.log(`[Recreate] Fetching library clips...`);
    const allClips = await dbService.getClips(userId);
    const clips = allClips.filter(clip => {
      const isGcs = gcsService.isGcsEnabled();
      const fileExists = isGcs ? !!clip.path : existsSync(resolvePath(clip.path));
      if (!fileExists) return false;

      // Filter out stock B-roll/AI fallback clips
      const nameLower = (clip.name || '').toLowerCase();
      const pathLower = (clip.path || '').toLowerCase();
      const tags = clip.tags || [];
      const hasSystemTag = tags.some(t => 
        t === 'stock_downloaded' || 
        t === 'ai_generated' || 
        t === 'fallback' || 
        t === 'recreate_fallback'
      );
      if (hasSystemTag) return false;
      if (nameLower.startsWith('stock') || nameLower.startsWith('ai -') || nameLower.startsWith('ai_')) return false;
      if (clip.id && (clip.id.startsWith('pexels_') || clip.id.startsWith('pixabay_') || clip.id.startsWith('ai_clip_'))) return false;
      const filename = pathLower.split('/').pop() || '';
      if (filename.startsWith('stock_') || filename.startsWith('ai_clip_')) return false;

      return true;
    });

    // Retrieve subject profile references if available
    let subjectPhotoPath = null;
    let profileSummary = '';
    try {
      const profile = await dbService.getSubjectProfile(userId);
      if (profile && profile.photos && profile.photos.length > 0) {
        const frontPhoto = profile.photos.find(p => p.angle.toLowerCase() === 'front') || profile.photos[0];
        const relativePath = frontPhoto.path.replace(/^\//, '');
        subjectPhotoPath = resolvePath(relativePath);
        profileSummary = profile.summary || '';
      }
    } catch (_) {}
    
    let matches = [];
    if (clips.length > 0 && analysis.scenes && analysis.scenes.length > 0) {
      console.log(`[Recreate] Matching library clips to analyzed scenes...`);
      matches = await matchRecreatedScenes(analysis.scenes, clips, apiKey);
    }
    
    const matchedScenes = [];
    if (analysis.scenes && analysis.scenes.length > 0) {
      for (let idx = 0; idx < analysis.scenes.length; idx++) {
        const scene = analysis.scenes[idx];
        const match = matches.find(m => m.sceneIndex === idx);
        
        let finalClipId = match ? match.clipId : "";
        let finalClipStart = match ? match.clipStart : 0;

        // If no library clip was matched, and AI fallback is enabled
        if (!finalClipId && useAiFallback) {
          console.log(`[Recreate] Scene ${idx} has no matching clip. Generating AI fallback...`);
          try {
            const scenePrompt = scene.visual_description || 'abstract cinematic b-roll';
            
            // Incorporate subject profile summary
            let fullPrompt = scenePrompt;
            if (profileSummary) {
              fullPrompt = `High quality, 8k, photorealistic. Subject appearance: ${profileSummary}. Scene details: ${scenePrompt}`;
            }

            const sceneDuration = scene.end_time - scene.start_time || 5;
            const assetType = scene.is_static ? 'image' : 'video';
            
            const result = await generateAiAsset(fullPrompt, assetType, sceneDuration, apiKey, subjectPhotoPath);
            
            // Create a new clip in the library
            const newClip = {
              id: result.id,
              userId,
              path: result.path,
              name: `AI - ${scenePrompt.substring(0, 25)}`,
              thumbnail: result.thumbnail,
              duration: result.duration,
              description: 'AI Generated replicate fallback: ' + fullPrompt,
              tags: ['ai_generated', 'recreate_fallback', assetType],
              status: 'analyzing'
            };
            await dbService.saveClip(newClip);

            // Trigger background visual analysis
            const absoluteVideoPath = resolvePath(result.path);
            analyzeVideoInBackground(result.id, absoluteVideoPath, apiKey);

            finalClipId = result.id;
            finalClipStart = 0;
          } catch (err) {
            console.error(`[Recreate] Failed to generate AI fallback for scene ${idx}:`, err);
          }
        }

        // Find overlays that overlap this scene
        const sceneOverlays = (analysis.textOverlays || []).filter(o => 
          o.start_time >= scene.start_time && o.start_time < scene.end_time
        );
        
        let sceneText = "";
        let sceneWords = [];
        for (const overlay of sceneOverlays) {
          const wordsList = overlay.text.split(/\s+/).filter(Boolean);
          if (wordsList.length > 0) {
            if (sceneText) sceneText += " ";
            sceneText += overlay.text;
            
            const overlayDuration = overlay.end_time - overlay.start_time;
            const wordDur = overlayDuration / wordsList.length;
            for (let i = 0; i < wordsList.length; i++) {
              sceneWords.push({
                word: wordsList[i],
                start_time: Number((overlay.start_time + i * wordDur).toFixed(3)),
                end_time: Number((overlay.start_time + (i + 1) * wordDur).toFixed(3))
              });
            }
          }
        }

        matchedScenes.push({
          text: sceneText,
          start_time: scene.start_time,
          end_time: scene.end_time,
          clipId: finalClipId,
          clipStart: finalClipStart,
          words: sceneWords
        });
      }
    }

    // 5. Get video audio duration to verify
    const audioDuration = await getVideoDuration(audioPath);

    // 6. Create Project
    const projectId = uuidv4();
    const newProject = {
      id: projectId,
      userId,
      name: projectName || `Recreated Reel (${new Date().toLocaleDateString()})`,
      type: 'create',
      updatedAt: new Date().toISOString(),
      state: {
        scriptText: analysis.description || "",
        selectedVoice: settings.lastSelectedVoice || "",
        audioSource: "upload",
        voiceoverPath: `/uploads/recreate/${audioFilename}`,
        voiceoverUrl: `/uploads/recreate/${audioFilename}`,
        originalVideoPath: `/uploads/recreate/${videoFilename}`,
        originalVideoUrl: `/uploads/recreate/${videoFilename}`,
        scenes: matchedScenes,
        aspectRatio: "9:16",
        fillMode: "crop",
        bgMusicPath: "",
        bgMusicVolume: 0.15,
        fontName: "Bangers",
        fontSize: 48,
        fontColor: "#FFFFFF",
        outlineColor: "#000000",
        bold: false,
        italic: false,
        shadow: true,
        neonGlow: true,
        glowColor: "#FFFFFF",
        glowBlur: 1,
        glowDistance: 20,
        textFade: true,
        textTransition: "none",
        textMotion: "none",
        activeWordScale: 1.15,
        textPositionY: -65,
        exportResolution: "1080p",
        exportFps: 30,
        normalStyle: {
          fontColor: "#FFFFFF",
          activeWordScale: 1.0,
          neonGlow: true,
          glowColor: "#FFFFFF",
          glowBlur: 1,
          glowDistance: 20
        },
        highlightStyle: {
          fontColor: "#FACC15",
          activeWordScale: 1.15,
          neonGlow: true,
          glowColor: "#FACC15",
          glowBlur: 1,
          glowDistance: 20
        },
        emojiStyle: {
          fontColor: "#FACC15",
          activeWordScale: 1.15,
          neonGlow: true,
          glowColor: "#FACC15",
          glowBlur: 1,
          glowDistance: 20
        }
      }
    };

    await dbService.saveProject(newProject);
    await dbService.saveSettings({ lastActiveProjectId: newProject.id });

    // Associate the new projectId with the recreation history record
    const targetRecreateId = recreateId || (typeof newRecreateId !== 'undefined' ? newRecreateId : null);
    if (targetRecreateId) {
      try {
        const recreate = await dbService.getRecreate(targetRecreateId);
        if (recreate) {
          recreate.projectId = newProject.id;
          await dbService.saveRecreate(recreate);
          console.log(`[Recreate] Associated projectId ${newProject.id} with recreate item ${targetRecreateId}`);
        }
      } catch (err) {
        console.error('[Recreate] Failed to associate projectId with recreate history:', err);
      }
    }

    res.json({
      success: true,
      project: newProject,
      analysis,
      videoUrl: `/uploads/recreate/${videoFilename}`,
      audioUrl: `/uploads/recreate/${audioFilename}`
    });

  } catch (error) {
    console.error('[Recreate Error] Analysis/Creation failed:', error);
    logErrorToFile('recreateAnalyze', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to automatically generate a viral video from library clips or from mimicking a Reel URL
// POST endpoint to automatically generate a viral video from library clips or from mimicking a Reel URL
app.post('/api/generate-viral-video', async (req, res) => {
  const { 
    url, 
    voiceoverPath, 
    scriptText, 
    voiceId: voiceIdParam, 
    bgMusicPath: bgMusicPathParam, 
    bgMusicVolume, 
    useAiFallback = true, 
    brollStyle 
  } = req.body;
  const userId = getUserId(req);

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    if (url) {
      // ==========================================
      // Case 1: Recreate / Mimic Reel URL provided
      // ==========================================
      const newRecreateId = uuidv4();
      const videoFilename = `reel_${newRecreateId}.mp4`;
      const videoPath = path.join(RECREATE_DIR, videoFilename);
      const audioFilename = `audio_${newRecreateId}.mp3`;
      const audioPath = path.join(RECREATE_DIR, audioFilename);

      console.log(`[Viral Generator] Starting mimic download for: ${url}`);
      await runDownloadReel(url, RECREATE_DIR, videoFilename, ffmpegPath);

      if (!existsSync(videoPath)) {
        throw new Error('Downloaded video file not found.');
      }

      console.log(`[Viral Generator] Extracting audio from video: ${videoPath} -> ${audioPath}`);
      await extractAudioFromVideo(videoPath, audioPath);

      if (!existsSync(audioPath)) {
        throw new Error('Extracted audio file not found.');
      }

      console.log(`[Viral Generator] Running Gemini analysis on Reel...`);
      const analysis = await analyzeRecreatedReel(videoPath, apiKey);

      console.log(`[Viral Generator] Saving mimic progress...`);
      await dbService.saveRecreate({
        id: newRecreateId,
        userId,
        url,
        projectName: `Mimic Reel (${new Date().toLocaleDateString()})`,
        videoUrl: `/uploads/recreate/${videoFilename}`,
        audioUrl: `/uploads/recreate/${audioFilename}`,
        analysis,
        createdAt: new Date().toISOString()
      });

      console.log(`[Viral Generator] Fetching library clips...`);
      const allClips = await dbService.getClips(userId);
      const clips = allClips.filter(clip => {
        const isGcs = gcsService.isGcsEnabled();
        const fileExists = isGcs ? !!clip.path : existsSync(resolvePath(clip.path));
        if (!fileExists) return false;

        const nameLower = (clip.name || '').toLowerCase();
        const pathLower = (clip.path || '').toLowerCase();
        const tags = clip.tags || [];
        const hasSystemTag = tags.some(t => 
          t === 'stock_downloaded' || 
          t === 'ai_generated' || 
          t === 'fallback' || 
          t === 'recreate_fallback'
        );
        if (hasSystemTag) return false;
        if (nameLower.startsWith('stock') || nameLower.startsWith('ai -') || nameLower.startsWith('ai_')) return false;
        if (clip.id && (clip.id.startsWith('pexels_') || clip.id.startsWith('pixabay_') || clip.id.startsWith('ai_clip_'))) return false;
        const filename = pathLower.split('/').pop() || '';
        if (filename.startsWith('stock_') || filename.startsWith('ai_clip_')) return false;

        return true;
      });

      let subjectPhotoPath = null;
      let profileSummary = '';
      try {
        const profile = await dbService.getSubjectProfile(userId);
        if (profile && profile.photos && profile.photos.length > 0) {
          const frontPhoto = profile.photos.find(p => p.angle.toLowerCase() === 'front') || profile.photos[0];
          const relativePath = frontPhoto.path.replace(/^\//, '');
          subjectPhotoPath = resolvePath(relativePath);
          profileSummary = profile.summary || '';
        }
      } catch (_) {}

      // Match recreated scenes strictly enforcing variety
      let matches = [];
      if (clips.length > 0 && analysis.scenes && analysis.scenes.length > 0) {
        matches = await matchRecreatedScenes(analysis.scenes, clips, apiKey);
      }

      const matchedScenes = [];
      if (analysis.scenes && analysis.scenes.length > 0) {
        for (let idx = 0; idx < analysis.scenes.length; idx++) {
          const scene = analysis.scenes[idx];
          const match = matches.find(m => m.sceneIndex === idx);
          
          let finalClipId = match ? match.clipId : "";
          let finalClipStart = match ? match.clipStart : 0;

          if (!finalClipId && useAiFallback) {
            try {
              const scenePrompt = scene.visual_description || 'abstract cinematic b-roll';
              let fullPrompt = scenePrompt;
              if (profileSummary) {
                fullPrompt = `High quality, 8k, photorealistic. Subject appearance: ${profileSummary}. Scene details: ${scenePrompt}`;
              }
              const sceneDuration = scene.end_time - scene.start_time || 5;
              const assetType = scene.is_static ? 'image' : 'video';
              const result = await generateAiAsset(fullPrompt, assetType, sceneDuration, apiKey, subjectPhotoPath);
              
              const newClip = {
                id: result.id,
                userId,
                path: result.path,
                name: `AI - ${scenePrompt.substring(0, 25)}`,
                thumbnail: result.thumbnail,
                duration: result.duration,
                description: 'AI Generated replicate fallback: ' + fullPrompt,
                tags: ['ai_generated', 'recreate_fallback', assetType],
                status: 'analyzing'
              };
              await dbService.saveClip(newClip);
              analyzeVideoInBackground(result.id, resolvePath(result.path), apiKey);
              
              finalClipId = result.id;
              finalClipStart = 0;
            } catch (err) {
              console.error(`Failed to generate AI fallback for scene ${idx}:`, err);
            }
          }

          const sceneOverlays = (analysis.textOverlays || []).filter(o => 
            o.start_time >= scene.start_time && o.start_time < scene.end_time
          );
          
          let sceneText = "";
          let sceneWords = [];
          for (const overlay of sceneOverlays) {
            const wordsList = overlay.text.split(/\s+/).filter(Boolean);
            if (wordsList.length > 0) {
              if (sceneText) sceneText += " ";
              sceneText += overlay.text;
              
              const overlayDuration = overlay.end_time - overlay.start_time;
              const wordDur = overlayDuration / wordsList.length;
              for (let i = 0; i < wordsList.length; i++) {
                sceneWords.push({
                  word: wordsList[i],
                  start_time: Number((overlay.start_time + i * wordDur).toFixed(3)),
                  end_time: Number((overlay.start_time + (i + 1) * wordDur).toFixed(3))
                });
              }
            }
          }

          matchedScenes.push({
            text: sceneText,
            start_time: scene.start_time,
            end_time: scene.end_time,
            clipId: finalClipId,
            clipStart: finalClipStart,
            words: sceneWords
          });
        }
      }

      const audioDuration = await getVideoDuration(audioPath);
      const projectId = uuidv4();
      const newProject = {
        id: projectId,
        userId,
        name: `Mimic Reel (${new Date().toLocaleDateString()})`,
        type: 'create',
        updatedAt: new Date().toISOString(),
        state: {
          scriptText: analysis.description || "",
          selectedVoice: voiceIdParam || settings.lastSelectedVoice || "",
          audioSource: "upload",
          voiceoverPath: `/uploads/recreate/${audioFilename}`,
          voiceoverUrl: `/uploads/recreate/${audioFilename}`,
          originalVideoPath: `/uploads/recreate/${videoFilename}`,
          originalVideoUrl: `/uploads/recreate/${videoFilename}`,
          scenes: matchedScenes,
          aspectRatio: "9:16",
          fillMode: "crop",
          bgMusicPath: bgMusicPathParam || "",
          bgMusicVolume: bgMusicVolume !== undefined ? bgMusicVolume : 0.15,
          fontName: "Bangers",
          fontSize: 48,
          fontColor: "#FFFFFF",
          outlineColor: "#000000",
          bold: false,
          italic: false,
          shadow: true,
          neonGlow: true,
          glowColor: "#FFFFFF",
          glowBlur: 1,
          glowDistance: 20,
          textFade: true,
          textTransition: "none",
          textMotion: "none",
          activeWordScale: 1.15,
          textPositionY: -65,
          exportResolution: "4k",
          exportFps: 30,
          normalStyle: { fontColor: "#FFFFFF", activeWordScale: 1.0, neonGlow: true, glowColor: "#FFFFFF", glowBlur: 1, glowDistance: 20 },
          highlightStyle: { fontColor: "#FACC15", activeWordScale: 1.15, neonGlow: true, glowColor: "#FACC15", glowBlur: 1, glowDistance: 20 },
          emojiStyle: { fontColor: "#FACC15", activeWordScale: 1.15, neonGlow: true, glowColor: "#FACC15", glowBlur: 1, glowDistance: 20 }
        }
      };

      await dbService.saveProject(newProject);
      await dbService.saveSettings({ lastActiveProjectId: newProject.id });

      try {
        const recreate = await dbService.getRecreate(newRecreateId);
        if (recreate) {
          recreate.projectId = newProject.id;
          await dbService.saveRecreate(recreate);
        }
      } catch (err) {
        console.error('[Recreate] Failed to associate projectId:', err);
      }

      const jobId = uuidv4();
      const jobState = {
        id: jobId,
        projectId: newProject.id,
        progress: 0,
        status: 'Queued',
        resultUrl: null,
        error: null
      };
      activeJobs.set(jobId, jobState);

      const dbClips = await dbService.getClips(userId);
      runVideoCompilation(jobId, {
        projectId: newProject.id,
        userId,
        estimatedCredits: Math.max(1, Math.ceil(audioDuration)),
        scenes: matchedScenes,
        clips: dbClips.map(c => ({ ...c, path: gcsService.isGcsEnabled() ? c.path : resolvePath(c.path) })),
        voiceoverPath: newProject.state.voiceoverPath,
        originalVideoPath: newProject.state.originalVideoPath,
        bgMusicPath: newProject.state.bgMusicPath ? resolvePath(newProject.state.bgMusicPath) : null,
        bgMusicVolume: newProject.state.bgMusicVolume,
        aspectRatio: newProject.state.aspectRatio,
        fillMode: newProject.state.fillMode,
        subtitleStyle: {
          fontName: newProject.state.fontName,
          fontSize: newProject.state.fontSize,
          fontColor: newProject.state.fontColor,
          outlineColor: newProject.state.outlineColor,
          bold: newProject.state.bold,
          italic: newProject.state.italic,
          shadow: newProject.state.shadow,
          neonGlow: newProject.state.neonGlow,
          glowColor: newProject.state.glowColor,
          glowBlur: newProject.state.glowBlur,
          glowDistance: newProject.state.glowDistance,
          textFade: newProject.state.textFade,
          textTransition: newProject.state.textTransition,
          textMotion: newProject.state.textMotion,
          activeWordScale: newProject.state.activeWordScale,
          textPositionY: newProject.state.textPositionY,
          normalStyle: newProject.state.normalStyle,
          highlightStyle: newProject.state.highlightStyle,
          emojiStyle: newProject.state.emojiStyle
        },
        exportResolution: "4k",
        exportFps: 30,
        outputDir: GENERATED_DIR
      });

      return res.json({ success: true, jobId, projectId: newProject.id });

    } else if (voiceoverPath) {
      // ==========================================
      // Case 2: Voiceover/audio provided in call
      // ==========================================
      console.log(`[Viral Generator] Voiceover provided: ${voiceoverPath}`);
      
      const allClips = await dbService.getClips(userId);
      const readyClips = allClips.filter(c => c.status === 'ready');
      if (readyClips.length === 0) {
        return res.status(400).json({ error: 'No clips are ready in your library. Please upload and analyze some video clips first.' });
      }

      let resolvedVoiceoverPath = voiceoverPath;
      let tempLocalVoiceoverPath = null;
      if (gcsService.isGcsEnabled() && voiceoverPath.startsWith('http')) {
        tempLocalVoiceoverPath = path.join(GENERATED_DIR, `temp_align_${uuidv4()}.mp3`);
        await gcsService.downloadFile(voiceoverPath, tempLocalVoiceoverPath);
        resolvedVoiceoverPath = tempLocalVoiceoverPath;
      } else {
        resolvedVoiceoverPath = resolvePath(voiceoverPath);
      }

      if (!existsSync(resolvedVoiceoverPath)) {
        return res.status(400).json({ error: `Voiceover audio file does not exist on disk: ${voiceoverPath}` });
      }

      // Time align to transcribe or align existing scriptText
      console.log(`[Viral Generator] Aligning script and audio...`);
      const alignedSegments = await alignScriptAndAudio(scriptText || '', resolvedVoiceoverPath, apiKey);

      if (tempLocalVoiceoverPath && existsSync(tempLocalVoiceoverPath)) {
        try {
          await fs.unlink(tempLocalVoiceoverPath);
        } catch (_) {}
      }

      // Match library clips semantically to these scenes using standard matchClipsToScenes (which shuffles/filters for variety)
      console.log(`[Viral Generator] Matching library clips for ${alignedSegments.length} scenes...`);
      const matches = await matchClipsToScenes(alignedSegments, readyClips, apiKey);

      const finalScenes = alignedSegments.map((seg, idx) => {
        const match = matches.find(m => m.sceneIndex === idx);
        
        return {
          text: seg.text || '',
          start_time: seg.start_time,
          end_time: seg.end_time,
          clipId: match ? match.clipId : (readyClips[idx % readyClips.length]?.id || ''),
          clipStart: match ? match.clipStart : 0,
          clipDuration: seg.end_time - seg.start_time,
          visualDescription: match ? match.reason : '',
          transition: 'none',
          sfx: 'none',
          shake: false,
          layout: 'full_broll',
          layoutProps: {},
          ambientSoundscape: 'none',
          postProcessingPreset: 'none',
          words: seg.words || [],
          words_hindi: seg.words_hindi || [],
          words_hinglish: seg.words_hinglish || []
        };
      });

      const projectId = uuidv4();
      const newProject = {
        id: projectId,
        userId,
        name: `Audio Voiceover Reel (${new Date().toLocaleDateString()})`,
        type: 'create',
        updatedAt: new Date().toISOString(),
        state: {
          scriptText: scriptText || alignedSegments.map(s => s.text).join(' '),
          selectedVoice: voiceIdParam || settings.lastSelectedVoice || "",
          audioSource: "upload",
          voiceoverPath: voiceoverPath,
          voiceoverUrl: voiceoverPath,
          scenes: finalScenes,
          aspectRatio: "9:16",
          fillMode: "crop",
          bgMusicPath: bgMusicPathParam || "",
          bgMusicVolume: bgMusicVolume !== undefined ? bgMusicVolume : 0.15,
          fontName: "Bangers",
          fontSize: 48,
          fontColor: "#FFFFFF",
          outlineColor: "#000000",
          bold: false,
          italic: false,
          shadow: true,
          neonGlow: true,
          glowColor: "#FFFFFF",
          glowBlur: 1,
          glowDistance: 20,
          textFade: true,
          textTransition: "none",
          textMotion: "none",
          activeWordScale: 1.15,
          textPositionY: -65,
          exportResolution: "4k",
          exportFps: 30,
          normalStyle: { fontColor: "#FFFFFF", activeWordScale: 1.0, neonGlow: true, glowColor: "#FFFFFF", glowBlur: 1, glowDistance: 20 },
          highlightStyle: { fontColor: "#FACC15", activeWordScale: 1.15, neonGlow: true, glowColor: "#FACC15", glowBlur: 1, glowDistance: 20 },
          emojiStyle: { fontColor: "#FACC15", activeWordScale: 1.15, neonGlow: true, glowColor: "#FACC15", glowBlur: 1, glowDistance: 20 }
        }
      };

      await dbService.saveProject(newProject);
      await dbService.saveSettings({ lastActiveProjectId: newProject.id });

      const audioDuration = await getVideoDuration(resolvedVoiceoverPath);
      const jobId = uuidv4();
      const jobState = {
        id: jobId,
        projectId: newProject.id,
        progress: 0,
        status: 'Queued',
        resultUrl: null,
        error: null
      };
      activeJobs.set(jobId, jobState);

      const dbClips = await dbService.getClips(userId);
      runVideoCompilation(jobId, {
        projectId: newProject.id,
        userId,
        estimatedCredits: Math.max(1, Math.ceil(audioDuration)),
        scenes: finalScenes,
        clips: dbClips.map(c => ({ ...c, path: gcsService.isGcsEnabled() ? c.path : resolvePath(c.path) })),
        voiceoverPath: voiceoverPath,
        bgMusicPath: bgMusicPathParam ? resolvePath(bgMusicPathParam) : null,
        bgMusicVolume: newProject.state.bgMusicVolume,
        aspectRatio: newProject.state.aspectRatio,
        fillMode: newProject.state.fillMode,
        subtitleStyle: {
          fontName: newProject.state.fontName,
          fontSize: newProject.state.fontSize,
          fontColor: newProject.state.fontColor,
          outlineColor: newProject.state.outlineColor,
          bold: newProject.state.bold,
          italic: newProject.state.italic,
          shadow: newProject.state.shadow,
          neonGlow: newProject.state.neonGlow,
          glowColor: newProject.state.glowColor,
          glowBlur: newProject.state.glowBlur,
          glowDistance: newProject.state.glowDistance,
          textFade: newProject.state.textFade,
          textTransition: newProject.state.textTransition,
          textMotion: newProject.state.textMotion,
          activeWordScale: newProject.state.activeWordScale,
          textPositionY: newProject.state.textPositionY,
          normalStyle: newProject.state.normalStyle,
          highlightStyle: newProject.state.highlightStyle,
          emojiStyle: newProject.state.emojiStyle
        },
        exportResolution: "4k",
        exportFps: 30,
        outputDir: GENERATED_DIR
      });

      return res.json({ success: true, jobId, projectId: newProject.id });

    } else {
      // ==========================================
      // Case 3: Fast-Paced compilation (No audio/voiceover provided)
      // ==========================================
      console.log(`[Viral Generator] No audio/voiceover provided. Generating fast-paced edit...`);
      
      const allClips = await dbService.getClips(userId);
      const readyClips = allClips.filter(c => c.status === 'ready');
      if (readyClips.length === 0) {
        return res.status(400).json({ error: 'No clips are ready in your library. Please upload and analyze some video clips first.' });
      }

      // Shuffle and take up to 12 distinct library clips for variety
      const shuffledClips = [...readyClips].sort(() => Math.random() - 0.5);
      const selectedClips = shuffledClips.slice(0, Math.min(shuffledClips.length, 12));

      // Resolve background music
      let bgmPath = bgMusicPathParam || "";
      if (!bgmPath) {
        const bgms = await dbService.getBgms(userId);
        if (bgms && bgms.length > 0) {
          bgmPath = bgms[Math.floor(Math.random() * bgms.length)].path;
          console.log(`[Viral Generator] Selected random background music: ${bgmPath}`);
        }
      }

      if (!bgmPath) {
        return res.status(400).json({ error: 'Background music is required for fast-paced compilation. Please upload a music file first.' });
      }

      const resolvedBgm = resolvePath(bgmPath);
      const musicDuration = await getVideoDuration(resolvedBgm);
      console.log(`[Viral Generator] Background music duration: ${musicDuration}s`);

      // Construct fast-paced scenes
      const sceneDuration = 2.0; // Fast pacing: 2.0 seconds per clip
      const maxDuration = Math.min(musicDuration, 30.0); // limit to music length or 30s max
      const sceneCount = Math.floor(maxDuration / sceneDuration);

      const finalScenes = [];
      let currentTime = 0.0;
      
      for (let i = 0; i < sceneCount; i++) {
        const clip = selectedClips[i % selectedClips.length];
        
        // Random offset in clip that has enough duration
        const maxOffset = Math.max(0, clip.duration - sceneDuration);
        const clipStart = Number((Math.random() * maxOffset).toFixed(2));

        const transitions = ['none', 'fade', 'slide-up', 'slide-down', 'zoom-in'];
        const transition = transitions[Math.floor(Math.random() * transitions.length)];

        finalScenes.push({
          text: '', // No subtitles/narration text
          start_time: currentTime,
          end_time: Number((currentTime + sceneDuration).toFixed(2)),
          clipId: clip.id,
          clipStart: clipStart,
          clipDuration: sceneDuration,
          visualDescription: `Fast-paced clip match: ${clip.name}`,
          transition: transition,
          sfx: 'none',
          shake: false,
          layout: 'full_broll',
          layoutProps: {},
          ambientSoundscape: 'none',
          postProcessingPreset: 'none',
          words: []
        });

        currentTime = Number((currentTime + sceneDuration).toFixed(2));
      }

      const projectId = uuidv4();
      const newProject = {
        id: projectId,
        userId,
        name: `Fast Paced Compilation (${new Date().toLocaleDateString()})`,
        type: 'create',
        updatedAt: new Date().toISOString(),
        state: {
          scriptText: "",
          selectedVoice: "",
          audioSource: "upload",
          voiceoverPath: bgmPath, // Set BGM as the voiceover path to compile correctly
          voiceoverUrl: bgmPath,
          scenes: finalScenes,
          aspectRatio: "9:16",
          fillMode: "crop",
          bgMusicPath: "", // Set to blank since BGM acts as voiceover
          bgMusicVolume: 0.0,
          fontName: "Bangers",
          fontSize: 48,
          fontColor: "#FFFFFF",
          outlineColor: "#000000",
          bold: false,
          italic: false,
          shadow: true,
          neonGlow: true,
          exportResolution: "4k",
          exportFps: 30
        }
      };

      await dbService.saveProject(newProject);

      const jobId = uuidv4();
      const jobState = {
        id: jobId,
        projectId: newProject.id,
        progress: 0,
        status: 'Queued',
        resultUrl: null,
        error: null
      };
      activeJobs.set(jobId, jobState);

      const dbClips = await dbService.getClips(userId);
      runVideoCompilation(jobId, {
        projectId: newProject.id,
        userId,
        estimatedCredits: Math.max(1, Math.ceil(currentTime)),
        scenes: finalScenes,
        clips: dbClips.map(c => ({ ...c, path: gcsService.isGcsEnabled() ? c.path : resolvePath(c.path) })),
        voiceoverPath: bgmPath, // Serves as main audio track
        bgMusicPath: null,
        bgMusicVolume: 0.0,
        voiceoverVolume: 1.0, // Music volume
        aspectRatio: newProject.state.aspectRatio,
        fillMode: newProject.state.fillMode,
        subtitleStyle: {
          fontName: newProject.state.fontName,
          fontSize: newProject.state.fontSize,
          fontColor: newProject.state.fontColor,
          outlineColor: newProject.state.outlineColor,
          bold: newProject.state.bold,
          italic: newProject.state.italic,
          shadow: newProject.state.shadow,
          neonGlow: newProject.state.neonGlow
        },
        exportResolution: "4k",
        exportFps: 30,
        outputDir: GENERATED_DIR
      });

      return res.json({ success: true, jobId, projectId: newProject.id });
    }
  } catch (error) {
    console.error('[Viral Generator Error] Failed to generate viral video:', error);
    logErrorToFile('generateViralVideo', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to check viral video compilation job status
app.get('/api/viral-video/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  res.json({
    id: job.id,
    projectId: job.projectId,
    status: job.status,
    progress: job.progress,
    resultUrl: job.resultUrl,
    error: job.error
  });
});

// GET endpoint to retrieve recreation history
app.get('/api/recreates', async (req, res) => {
  try {
    const userId = getUserId(req);
    const recreates = await dbService.getRecreates(userId);
    const sorted = recreates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
  } catch (error) {
    console.error('[Recreates Get Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE endpoint to delete a recreation item and its media files
app.delete('/api/recreates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const recreate = await dbService.getRecreate(id);
    if (!recreate) {
      return res.status(404).json({ error: 'Recreation not found.' });
    }

    if (recreate.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this recreation.' });
    }

    // Delete database entry first
    await dbService.deleteRecreate(id);

    // Clean up files on disk
    if (recreate.videoUrl) {
      const videoFilename = path.basename(recreate.videoUrl);
      const videoPath = path.join(RECREATE_DIR, videoFilename);
      if (existsSync(videoPath)) {
        unlinkSync(videoPath);
      }
    }
    if (recreate.audioUrl) {
      const audioFilename = path.basename(recreate.audioUrl);
      const audioPath = path.join(RECREATE_DIR, audioFilename);
      if (existsSync(audioPath)) {
        unlinkSync(audioPath);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Recreates Delete Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve SPA route fallback for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

async function seedDefaultUser() {
  const defaultEmail = 'vicky@vgen.productions';
  const defaultPassword = 'vgenpassword123';
  
  try {
    console.log(`[Database Startup] Checking default user: ${defaultEmail}`);
    const exists = await dbService.checkUserExists(defaultEmail);
    if (!exists) {
      console.log(`[Database Startup] Seeding default user: ${defaultEmail}`);
      await dbService.saveUser({
        uid: defaultEmail,
        email: defaultEmail,
        password: defaultPassword,
        plan: 'pro',
        credits: 5000,
        createdAt: new Date().toISOString()
      });
      console.log(`[Database Startup] Default user seeded successfully.`);
    } else {
      console.log(`[Database Startup] Default user already exists.`);
    }
    
    // We only perform the migration of local-user data in GCP Cloud Run production environment
    // to preserve clean local workspace development on localhost.
    if (isProduction) {
      console.log(`[Database Migration] Running production migration: reassigning 'local-user' data to default user...`);
      
      // 1. Migrate Projects
      const projects = await dbService.getProjects('local-user');
      if (projects.length > 0) {
        console.log(`[Database Migration] Found ${projects.length} legacy projects for 'local-user'. Migrating to ${defaultEmail}...`);
        for (const p of projects) {
          p.userId = defaultEmail;
          await dbService.saveProject(p);
        }
      }
      
      // 2. Migrate Clips
      const clips = await dbService.getClips('local-user');
      if (clips.length > 0) {
        console.log(`[Database Migration] Found ${clips.length} legacy clips for 'local-user'. Migrating to ${defaultEmail}...`);
        for (const c of clips) {
          c.userId = defaultEmail;
          await dbService.saveClip(c);
        }
      }
      
      // 3. Migrate BGMs
      const bgms = await dbService.getBgms('local-user');
      if (bgms.length > 0) {
        console.log(`[Database Migration] Found ${bgms.length} legacy bgms for 'local-user'. Migrating to ${defaultEmail}...`);
        for (const b of bgms) {
          b.userId = defaultEmail;
          await dbService.saveBgm(b);
        }
      }
      
      console.log(`[Database Migration] Migration checks and processing finished.`);
    } else {
      console.log(`[Database Startup] Local mode: Bypassing automatic local-user data migration.`);
    }
  } catch (err) {
    console.error('[Database Startup Error] Seeding/Migration failed:', err.message);
  }
}

// ==========================================
// YouTube Empire API Endpoints
// ==========================================

app.post('/api/youtube/generate-script', async (req, res) => {
  const { projectId, topic, niche } = req.body;
  if (!projectId || !topic || !niche) {
    return res.status(400).json({ error: 'Project ID, topic, and niche are required.' });
  }

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    
    // Generate Long Script and Storyboard
    const data = await generateYoutubeScriptAndStoryboard(topic, niche, apiKey);
    
    // Generate corresponding short/reel script based on long script
    const shortData = await generateYoutubeShortScript(data.scriptText, apiKey);

    // Save to project
    const project = await dbService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    project.state.topic = topic;
    project.state.niche = niche;
    project.state.scriptText = data.scriptText;
    project.state.shortScriptText = shortData.scriptText;
    project.name = data.title || project.name;
    project.state.scenes = autoEnrichSceneVerbs(data.scenes);
    project.state.status = 'script_generated';
    project.updatedAt = new Date().toISOString();

    await dbService.saveProject(project);
    res.json(project);
  } catch (error) {
    console.error('Error generating YouTube script:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/youtube/extract-graph', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  try {
    const project = await dbService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const scenes = project.state.scenes || [];
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'Project does not have storyboard scenes. Please generate a script or align one first.' });
    }

    let scriptText = project.state.scriptText || '';
    if (!scriptText) {
      scriptText = scenes.map(s => s.text).join(' ');
    }

    if (!scriptText.trim()) {
      return res.status(400).json({ error: 'Project script is empty. Please ensure your scenes have narration text.' });
    }

    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

     const graphData = await extractStoryGraph(scriptText, scenes, apiKey);
 
     // Save to project state
     project.state.entities = graphData.entities;
     project.state.graphEvents = graphData.graphEvents;
     
     // Map contexts back to scenes
     if (graphData.sceneContexts && Array.isArray(graphData.sceneContexts)) {
       graphData.sceneContexts.forEach(c => {
         const idx = c.sceneIndex;
         if (project.state.scenes[idx]) {
           project.state.scenes[idx].graphContext = c.context;
         }
       });
     }
     
     project.updatedAt = new Date().toISOString();
     await dbService.saveProject(project);
 
     res.json({
       success: true,
       entities: graphData.entities,
       graphEvents: graphData.graphEvents,
       scenes: project.state.scenes
     });
  } catch (error) {
    console.error('Error extracting story graph:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/save-graph', async (req, res) => {
  const { id } = req.params;
  const { entities, graphEvents, graphSettings } = req.body;

  try {
    const project = await dbService.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    project.state.entities = entities;
    project.state.graphEvents = graphEvents;
    if (graphSettings) {
      project.state.graphSettings = graphSettings;
    }
    project.updatedAt = new Date().toISOString();
    await dbService.saveProject(project);

    res.json({ success: true, project });
  } catch (error) {
    console.error('Error saving story graph:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/youtube/auto-match', async (req, res) => {
  const { projectId, brollStyle } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  try {
    const project = await dbService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const userId = getUserId(req);
    const settings = await dbService.getSettings();
    const pexelsKey = process.env.PEXELS_API_KEY || settings.pexelsApiKey;
    const pixabayKey = process.env.PIXABAY_API_KEY || settings.pixabayApiKey;
    const userClips = await dbService.getClips(userId);
    const geminiApiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    const scenes = project.state.scenes || [];
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'No scenes to match. Please align the voiceover first.' });
    }

    console.log(`[YouTube Auto-Match] Starting stock B-roll matching for project ${projectId}...`);

    // Bulk-enrich scenes that have generic or missing B-roll metadata before matching
    const scenesToEnrich = [];
    const enrichIndices = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const kw = (scene.sfxKeywords || '').trim().toLowerCase();
      const desc = (scene.visualDescription || '').trim().toLowerCase();
      
      const isGenericKeywords = !kw || kw === 'cinematic, abstract' || kw === 'abstract, cinematic' || kw === 'cinematic' || kw === 'abstract';
      const isGenericDesc = !desc || desc === 'abstract cinematic background' || desc === 'abstract cinematic';

      if ((isGenericKeywords || isGenericDesc) && scene.text) {
        scenesToEnrich.push(scene);
        enrichIndices.push(i);
      }
    }

    if (scenesToEnrich.length > 0) {
      console.log(`[YouTube Auto-Match] Found ${scenesToEnrich.length} scenes with generic/missing B-roll metadata. Bulk enriching with Gemini...`);
      try {
        const enrichedResults = await enrichScenesMetadata(scenesToEnrich, geminiApiKey);
        if (enrichedResults && enrichedResults.length > 0) {
          for (const resItem of enrichedResults) {
            const originalIdx = enrichIndices[resItem.index];
            if (originalIdx !== undefined && scenes[originalIdx]) {
              scenes[originalIdx].visualDescription = resItem.visualDescription;
              scenes[originalIdx].sfxKeywords = resItem.sfxKeywords;
              console.log(`[YouTube Auto-Match] Enriched Scene ${originalIdx} narration: "${scenes[originalIdx].text}" -> Visual: "${resItem.visualDescription}", Keywords: "${resItem.sfxKeywords}"`);
            }
          }
          project.state.scenes = scenes;
          project.updatedAt = new Date().toISOString();
          await dbService.saveProject(project);
        }
      } catch (enrichErr) {
        console.error('[YouTube Auto-Match] Scene metadata enrichment failed:', enrichErr.message);
      }
    }

    // Track last used end_time for each clip ID to enforce 90s reuse gap
    const lastUsedMap = new Map();

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneStart = scene.start_time || 0;
      const sceneEnd = scene.end_time || (sceneStart + 5);
      
      let matchedClipId = null;

      // Extract search keywords from scene
      const keywordsString = scene.sfxKeywords || '';
      const keywords = keywordsString.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);

      if (keywords.length > 0) {
        // Find existing clip in user's library that matches keywords and respects the 90s reuse rule
        const candidateClips = userClips.filter(c => {
          if (c.status !== 'ready') return false;

          // Check last used end_time
          if (lastUsedMap.has(c.id)) {
            const lastEnd = lastUsedMap.get(c.id);
            if (sceneStart - lastEnd < 90) {
              return false; // too close, skip to avoid quick repeats
            }
          }

          const clipText = `${c.name} ${c.description} ${(c.tags || []).join(' ')}`.toLowerCase();
          return keywords.some(k => clipText.includes(k));
        });

        if (candidateClips.length > 0) {
          matchedClipId = candidateClips[0].id;
          console.log(`[YouTube Auto-Match] Reusing existing clip ${matchedClipId} for scene ${i}`);
        }
      }

      // If no suitable library clip, query Pexels/Pixabay
      if (!matchedClipId) {
        const styleModifier = brollStyle || project.state.brollStyle || 'clean minimal';
        
        // Clean search query to exclude generic keywords and abstract patterns
        const banned = ['cinematic', 'abstract', 'background', 'bg', 'video', 'clip', 'footage', 'scene', 'visual', 'loop', 'pattern', 'motion', 'animation', 'effect', 'overlay', 'clean', 'minimal', 'placeholder'];
        let cleanKeywords = keywords.filter(k => {
          return !banned.some(b => k.includes(b));
        });

        let queryBase = cleanKeywords.slice(0, 3).join(' ');

        if (!queryBase && scene.visualDescription) {
          const descWords = scene.visualDescription.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
          const cleanDescWords = descWords.filter(w => !banned.includes(w) && w.length > 2);
          queryBase = cleanDescWords.slice(0, 4).join(' ');
        }

        if (!queryBase && scene.text) {
          const stopwords = ['the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'but', 'not'];
          const textWords = scene.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
          const cleanTextWords = textWords.filter(w => !stopwords.includes(w) && w.length > 3);
          queryBase = cleanTextWords.slice(0, 3).join(' ');
        }

        if (!queryBase) {
          queryBase = 'vintage historical'; // concrete fallback
        }

        let searchQuery = queryBase;
        if (styleModifier && styleModifier !== 'none') {
          searchQuery = `${searchQuery} ${styleModifier}`;
        }
        const orientation = project.state.aspectRatio === '9:16' ? 'portrait' : 'landscape';

        try {
          const stockResults = await searchStockVideo(searchQuery, pexelsKey, pixabayKey, orientation);
          if (stockResults.length > 0) {
            let selectedStock = null;

            // Find first result that respects the reuse rule (if it was previously downloaded)
            for (const stock of stockResults) {
              const existingClip = userClips.find(c => c.description.includes(stock.id) || c.name.includes(stock.id));
              if (existingClip) {
                if (lastUsedMap.has(existingClip.id)) {
                  const lastEnd = lastUsedMap.get(existingClip.id);
                  if (sceneStart - lastEnd < 90) {
                    continue; // skip, too close
                  }
                }
                selectedStock = { ...stock, existingClipId: existingClip.id };
                break;
              } else {
                selectedStock = stock;
                break;
              }
            }

            if (!selectedStock) {
              selectedStock = stockResults[0];
            }

            if (selectedStock.existingClipId) {
              matchedClipId = selectedStock.existingClipId;
              console.log(`[YouTube Auto-Match] Reusing stock clip ${matchedClipId} for scene ${i}`);
            } else {
              // Download stock video
              const downloadId = uuidv4();
              const newClip = await downloadStockVideo(
                selectedStock.url,
                downloadId,
                userId,
                `Stock ${selectedStock.source} ID ${selectedStock.id}: ${scene.visualDescription}`
              );

              // Analyze video in background so it gets tagged/described
              analyzeVideoInBackground(newClip.id, resolvePath(newClip.path), geminiApiKey);

              matchedClipId = newClip.id;
              userClips.push(newClip);
            }
          }
        } catch (searchErr) {
          console.error(`[YouTube Auto-Match] Search/download failed for scene ${i}:`, searchErr.message);
        }
      }

      if (matchedClipId) {
        scene.clipId = matchedClipId;
        scene.clipStart = 0;
        lastUsedMap.set(matchedClipId, sceneEnd);
      } else {
        scene.clipId = '';
        scene.clipStart = 0;
      }
    }

    project.state.scenes = autoEnrichSceneVerbs(scenes);
    project.state.status = 'matched';
    project.updatedAt = new Date().toISOString();

    await dbService.saveProject(project);
    res.json(project);
  } catch (error) {
    console.error('Error in YouTube auto-match:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/youtube/auto-suggest-assets', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  try {
    const project = await dbService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const scenes = project.state.scenes || [];
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'No scenes in project to suggest assets.' });
    }

    console.log(`[YouTube Auto-Suggest] Automatically suggesting layouts, transitions, and SFX for ${scenes.length} scenes using Gemini...`);

    const settings = await dbService.getSettings();
    const geminiApiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    
    // Call Gemini to get suggested properties
    const suggestions = await suggestStorytellerAndAssetsForScenes(scenes, project.state.scriptText || '', geminiApiKey);

    // Map suggestions back to scenes
    for (const sug of suggestions) {
      const idx = sug.index;
      if (idx !== undefined && idx >= 0 && idx < scenes.length) {
        const scene = scenes[idx];
        scene.layout = sug.layout || scene.layout || 'graph';
        scene.layoutProps = sug.layoutProps || scene.layoutProps || {};
        scene.ambientSoundscape = sug.ambientSoundscape || scene.ambientSoundscape || 'none';
        scene.postProcessingPreset = sug.postProcessingPreset || scene.postProcessingPreset || 'none';
        scene.transition = sug.transition || scene.transition || 'fade';
        scene.sfx = sug.sfx || scene.sfx || 'none';
        scene.shake = sug.shake !== undefined ? sug.shake : scene.shake;
        if (sug.shakeIntensity !== undefined) scene.shakeIntensity = sug.shakeIntensity;
        if (sug.shakeSpeed !== undefined) scene.shakeSpeed = sug.shakeSpeed;
      }
    }

    project.state.scenes = autoEnrichSceneVerbs(scenes);
    project.updatedAt = new Date().toISOString();
    await dbService.saveProject(project);

    res.json(project);
  } catch (error) {
    console.error('Error suggesting transitions/SFX:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/youtube/regenerate-hud', async (req, res) => {
  const { projectId, sceneIndex } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  try {
    const project = await dbService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const scenes = project.state.scenes || [];
    if (scenes.length === 0) {
      return res.status(400).json({ error: 'No scenes in project to regenerate HUD.' });
    }

    const settings = await dbService.getSettings();
    const geminiApiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;

    if (sceneIndex !== undefined && sceneIndex !== null) {
      const idx = parseInt(sceneIndex);
      if (idx < 0 || idx >= scenes.length) {
        return res.status(400).json({ error: 'Invalid scene index.' });
      }

      console.log(`[YouTube HUD Redo] Regenerating HUD for single scene ${idx} in project ${projectId}...`);
      const singleScene = { ...scenes[idx] };
      // Assign custom index so suggestions match correctly
      singleScene.index = idx;
      const suggestion = await suggestStorytellerAndAssetsForScenes([singleScene], project.state.scriptText || '', geminiApiKey);
      if (suggestion && suggestion.length > 0) {
        const sug = suggestion[0];
        scenes[idx].layout = sug.layout || scenes[idx].layout || 'graph';
        scenes[idx].layoutProps = sug.layoutProps || {};
      }
    } else {
      console.log(`[YouTube HUD Redo] Regenerating full HUD layouts for all ${scenes.length} scenes in project ${projectId}...`);
      const suggestions = await suggestStorytellerAndAssetsForScenes(scenes, project.state.scriptText || '', geminiApiKey);
      for (const sug of suggestions) {
        const idx = sug.index;
        if (idx !== undefined && idx >= 0 && idx < scenes.length) {
          scenes[idx].layout = sug.layout || scenes[idx].layout || 'graph';
          scenes[idx].layoutProps = sug.layoutProps || {};
        }
      }
    }

    project.state.scenes = scenes;
    project.updatedAt = new Date().toISOString();
    await dbService.saveProject(project);

    res.json(project);
  } catch (error) {
    console.error('Error regenerating HUD layouts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/youtube/create-short-reel', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  try {
    const longProject = await dbService.getProject(projectId);
    if (!longProject) {
      return res.status(404).json({ error: 'Long-form project not found.' });
    }

    const userId = getUserId(req);
    const settings = await dbService.getSettings();

    // Create a new separate project for the vertical Short
    const shortProjectId = uuidv4();
    const shortProject = {
      id: shortProjectId,
      userId,
      name: `${longProject.name} (Suspense Short)`,
      type: 'create', // Standard voiceover type so we can render it
      updatedAt: new Date().toISOString(),
      state: {
        topic: longProject.state.topic,
        niche: longProject.state.niche,
        scriptText: longProject.state.shortScriptText || "A suspense short based on the long video.",
        selectedVoice: longProject.state.selectedVoice || settings.lastSelectedVoice || "",
        audioSource: "generate",
        voiceoverPath: "",
        voiceoverUrl: "",
        scenes: [], // Will be aligned and matched inside this project
        aspectRatio: "9:16", // Vertical reels
        fillMode: "crop",
        bgMusicPath: longProject.state.bgMusicPath || "",
        bgMusicVolume: longProject.state.bgMusicVolume || 0.15,
        fontName: longProject.state.fontName || "Arial",
        fontSize: longProject.state.fontSize || 24,
        fontColor: longProject.state.fontColor || "#FFFFFF",
        outlineColor: longProject.state.outlineColor || "#000000",
        bold: true,
        italic: false,
        shadow: true,
        textFade: true,
        textTransition: "none",
        textMotion: "none",
        activeWordScale: 1.15,
        exportResolution: "1080p",
        exportFps: 30
      }
    };

    // Save short project
    await dbService.saveProject(shortProject);

    // Link short project ID to long project
    longProject.state.shortProjectId = shortProjectId;
    await dbService.saveProject(longProject);

    res.json({ shortProjectId });
  } catch (error) {
    console.error('Error creating short reel project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` Video Generator Backend running on port ${PORT} `);
  console.log(` Static uploads served at http://localhost:${PORT}/uploads`);
  console.log(`=================================================`);

  // Run database seeding and migration
  seedDefaultUser();

  // Auto-resume any interrupted clip analysis tasks on boot
  (async () => {
    try {
      const settings = await dbService.getSettings();
      const interruptedClips = await dbService.getClipsByStatus('analyzing');
      const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
      if (interruptedClips.length > 0 && (apiKey || process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        console.log(`[Startup Recovery] Found ${interruptedClips.length} interrupted analysis tasks. Resuming background analysis...`);
        interruptedClips.forEach(clip => {
          analyzeVideoInBackground(clip.id, clip.path, apiKey);
        });
      }
    } catch (err) {
      console.error('[Startup Recovery] Failed to check for interrupted tasks:', err.message);
    }
  })();
});
