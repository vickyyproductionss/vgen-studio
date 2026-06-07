import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, appendFileSync, statSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';

// Import services
import { analyzeVideo, alignScriptAndAudio, matchClipsToScenes } from './services/gemini.js';
import { getVoices, generateSpeech } from './services/elevenlabs.js';
import { getVideoDuration, generateThumbnail, assembleVideo, ensureFontExists, extractAudioFromVideo } from './services/video.js';
import { detectBeats } from './services/beats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.use(cors());
app.use(express.json());

// Ensure required directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CLIPS_DIR = path.join(UPLOADS_DIR, 'clips');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');
const GENERATED_DIR = path.join(UPLOADS_DIR, 'generated');
const MUSIC_DIR = path.join(UPLOADS_DIR, 'music');

await fs.mkdir(CLIPS_DIR, { recursive: true });
await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
await fs.mkdir(GENERATED_DIR, { recursive: true });
await fs.mkdir(MUSIC_DIR, { recursive: true });

// Serve uploads folder as static
app.use('/uploads', express.static(UPLOADS_DIR));

// Database Helpers (Synchronous read/write for simplicity)
const DB_PATH = path.join(__dirname, 'db.json');

function getDb() {
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ settings: { geminiApiKey: '', elevenLabsApiKey: '', defaultOutputDir: GENERATED_DIR, lastActiveProjectId: '' }, clips: [], bgms: [], projects: [], users: [] }, null, 2));
  }
  const db = JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  let updated = false;
  if (!db.bgms) {
    db.bgms = [];
    updated = true;
  }
  if (!db.projects) {
    db.projects = [];
    updated = true;
  }
  if (!db.users) {
    db.users = [];
    updated = true;
  }
  if (updated) {
    saveDb(db);
  }
  return db;
}

function saveDb(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

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
const upload = multer({ storage });

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

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const db = getDb();
  const exists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
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
  db.users.push(newUser);
  saveDb(db);
  res.json({ success: true, user: { email: newUser.email, plan: newUser.plan, credits: newUser.credits } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const db = getDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json({ success: true, user: { email: user.email, plan: user.plan, credits: user.credits } });
});

app.get('/api/auth/me', (req, res) => {
  const userId = getUserId(req);
  if (userId === 'local-user') {
    return res.json({ email: 'local-user', plan: 'local', credits: 999999 });
  }
  const db = getDb();
  const user = db.users.find(u => u.uid === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ email: user.email, plan: user.plan, credits: user.credits });
});

app.post('/api/billing/upgrade', (req, res) => {
  const userId = getUserId(req);
  if (userId === 'local-user') {
    return res.status(400).json({ error: 'Cannot upgrade local user account.' });
  }
  const { plan } = req.body;
  if (!['free', 'pro', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan selected.' });
  }
  const db = getDb();
  const userIdx = db.users.findIndex(u => u.uid === userId);
  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const user = db.users[userIdx];
  user.plan = plan;
  if (plan === 'pro') {
    user.credits += 1000;
  } else if (plan === 'business') {
    user.credits += 5000;
  } else if (plan === 'free') {
    user.credits = 100;
  }
  saveDb(db);
  res.json({ success: true, user: { email: user.email, plan: user.plan, credits: user.credits } });
});

app.post('/api/billing/add-credits', (req, res) => {
  const userId = getUserId(req);
  if (userId === 'local-user') {
    return res.status(400).json({ error: 'Cannot buy credits for local account.' });
  }
  const { amount } = req.body;
  const creditsToAdd = parseInt(amount, 10);
  if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
    return res.status(400).json({ error: 'Invalid credit amount.' });
  }
  const db = getDb();
  const userIdx = db.users.findIndex(u => u.uid === userId);
  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const user = db.users[userIdx];
  user.credits += creditsToAdd;
  saveDb(db);
  res.json({ success: true, user: { email: user.email, plan: user.plan, credits: user.credits } });
});

// ==========================================
// Settings API
// ==========================================
app.get('/api/settings', (req, res) => {
  const db = getDb();
  res.json(db.settings);
});

app.post('/api/settings', (req, res) => {
  const db = getDb();
  db.settings = { ...db.settings, ...req.body };
  saveDb(db);
  res.json(db.settings);
});

// ==========================================
// Project State API
// ==========================================
app.get('/api/project', (req, res) => {
  const db = getDb();
  res.json(db.project || {});
});

app.post('/api/project', (req, res) => {
  const db = getDb();
  db.project = { ...db.project, ...req.body };
  saveDb(db);
  res.json({ success: true, project: db.project });
});

app.delete('/api/project', (req, res) => {
  const db = getDb();
  db.project = {
    scriptText: "",
    selectedVoice: db.settings.lastSelectedVoice || "",
    audioSource: "generate",
    voiceoverPath: "",
    voiceoverUrl: "",
    scenes: [],
    aspectRatio: "9:16",
    fillMode: "crop",
    bgMusicPath: "",
    bgMusicVolume: 0.15,
    fontName: "Arial",
    fontSize: 24,
    fontColor: "#FFFFFF",
    outlineColor: "#000000",
    bold: true,
    italic: false,
    shadow: true,
    textFade: true,
    textTransition: "none",
    textMotion: "none",
    activeWordScale: 1.15
  };
  saveDb(db);
  res.json({ success: true, project: db.project });
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
    if (filePath && existsSync(filePath)) {
      try {
        const stats = statSync(filePath);
        totalSize += stats.size;
      } catch (err) {
        // Ignore stats errors
      }
    }
  }
  return totalSize;
}

app.get('/api/projects', (req, res) => {
  const userId = getUserId(req);
  const db = getDb();
  const userProjects = (db.projects || []).filter(p => (p.userId || 'local-user') === userId);
  const projects = userProjects.map(p => {
    return {
      ...p,
      diskSize: getProjectDiskSize(p)
    };
  });
  res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
  const userId = getUserId(req);
  const db = getDb();
  const project = db.projects.find(p => p.id === req.params.id && (p.userId || 'local-user') === userId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json({
    ...project,
    diskSize: getProjectDiskSize(project)
  });
});

app.post('/api/projects', (req, res) => {
  const { name, type } = req.body;
  if (!type || !['create', 'beatsync'].includes(type)) {
    return res.status(400).json({ error: 'Valid project type is required (create or beatsync).' });
  }
  
  const userId = getUserId(req);
  const db = getDb();
  const newProject = {
    id: uuidv4(),
    userId,
    name: name || `Untitled ${type === 'beatsync' ? 'Beat Sync' : 'Voiceover'} Project`,
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
      fontName: "Arial",
      fontSize: 24,
      fontColor: "#FFFFFF",
      outlineColor: "#000000",
      bold: true,
      italic: false,
      shadow: true,
      highlightColor: "#FFFF00",
      showHighlightBox: false,
      boxColor: "#8A4BF3",
      boxRounding: 8,
      textFade: true,
      textTransition: "none",
      textMotion: "none",
      activeWordScale: 1.15,
      wordDisplayTime: 1.0,
      textPositionX: 0,
      textPositionY: -70
    } : {
      scriptText: "",
      selectedVoice: db.settings.lastSelectedVoice || "",
      audioSource: "generate",
      voiceoverPath: "",
      voiceoverUrl: "",
      scenes: [],
      aspectRatio: "9:16",
      fillMode: "crop",
      bgMusicPath: "",
      bgMusicVolume: 0.15,
      fontName: "Arial",
      fontSize: 24,
      fontColor: "#FFFFFF",
      outlineColor: "#000000",
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
  
  db.projects = db.projects || [];
  db.projects.push(newProject);
  
  db.settings.lastActiveProjectId = newProject.id;
  saveDb(db);
  
  res.json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const userId = getUserId(req);
  const { name, state } = req.body;
  const db = getDb();
  const project = db.projects.find(p => p.id === req.params.id && (p.userId || 'local-user') === userId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  if (name !== undefined) project.name = name;
  if (state !== undefined) project.state = { ...project.state, ...state };
  project.updatedAt = new Date().toISOString();
  
  db.settings.lastActiveProjectId = project.id;
  saveDb(db);
  
  res.json({ success: true, project });
});

app.delete('/api/projects/:id', (req, res) => {
  const userId = getUserId(req);
  const db = getDb();
  const idx = db.projects.findIndex(p => p.id === req.params.id && (p.userId || 'local-user') === userId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const project = db.projects[idx];
  
  // Clean up associated files on disk
  const filesToDelete = [];
  if (project.state) {
    if (project.state.voiceoverPath) filesToDelete.push(project.state.voiceoverPath);
    if (project.state.audioPath) filesToDelete.push(project.state.audioPath);
    if (project.state.lastRenderedVideoPath) filesToDelete.push(project.state.lastRenderedVideoPath);
  }
  
  for (const filePath of filesToDelete) {
    if (filePath && existsSync(filePath)) {
      try {
        unlinkSync(filePath);
        console.log(`Deleted project file: ${filePath}`);
      } catch (err) {
        console.error(`Failed to delete project file: ${filePath}`, err);
      }
    }
  }
  
  db.projects.splice(idx, 1);
  
  if (db.settings.lastActiveProjectId === req.params.id) {
    db.settings.lastActiveProjectId = db.projects.length > 0 ? db.projects[db.projects.length - 1].id : '';
  }
  
  saveDb(db);
  res.json({ success: true });
});

// ==========================================
// ElevenLabs Voices API
// ==========================================
app.get('/api/voices', async (req, res) => {
  try {
    const db = getDb();
    const apiKey = req.query.apiKey || db.settings.elevenLabsApiKey;
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
app.get('/api/clips', (req, res) => {
  const userId = getUserId(req);
  const db = getDb();
  const userClips = (db.clips || []).filter(c => (c.userId || 'local-user') === userId);
  const clipsWithStatus = userClips.map(clip => ({
    ...clip,
    exists: clip.path ? existsSync(clip.path) : false
  }));
  res.json(clipsWithStatus);
});

// Add clip via absolute local path (extremely fast for local workflows)
app.post('/api/clips/add-path', async (req, res) => {
  const { absolutePath } = req.body;
  if (!absolutePath || !existsSync(absolutePath)) {
    return res.status(400).json({ error: 'Valid absolute file path is required.' });
  }

  const userId = getUserId(req);
  const db = getDb();
  const apiKey = db.settings.geminiApiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key is required to analyze clips. Please set it in Settings.' });
  }

  const clipId = uuidv4();
  const filename = path.basename(absolutePath);
  const thumbnailFilename = `${clipId}.jpg`;
  const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

  try {
    // 1. Get Video Duration
    const duration = await getVideoDuration(absolutePath);

    // 2. Generate Thumbnail
    await generateThumbnail(absolutePath, thumbnailPath);

    // 3. Create clip record in DB with analyzing status
    const newClip = {
      id: clipId,
      userId,
      path: absolutePath,
      name: filename,
      thumbnail: `/uploads/thumbnails/${thumbnailFilename}`,
      duration,
      description: 'Analyzing clip content...',
      tags: [],
      status: 'analyzing'
    };

    db.clips.push(newClip);
    saveDb(db);

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
  const db = getDb();
  const apiKey = db.settings.geminiApiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key is required to analyze clips. Please set it in Settings.' });
  }

  const importedClips = [];

  try {
    for (const file of req.files) {
      const absolutePath = file.path;
      const clipId = path.basename(file.filename, path.extname(file.filename));
      const thumbnailFilename = `${clipId}.jpg`;
      const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

      const duration = await getVideoDuration(absolutePath);
      await generateThumbnail(absolutePath, thumbnailPath);

      const newClip = {
        id: clipId,
        userId,
        path: absolutePath,
        name: file.originalname,
        thumbnail: `/uploads/thumbnails/${thumbnailFilename}`,
        duration,
        description: 'Analyzing clip content...',
        tags: [],
        status: 'analyzing'
      };

      db.clips.push(newClip);
      importedClips.push(newClip);

      analyzeVideoInBackground(clipId, absolutePath, apiKey);
    }

    saveDb(db);
    res.json(importedClips);
  } catch (error) {
    res.status(500).json({ error: `Failed to upload files: ${error.message}` });
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
    const db = getDb();
    const apiKey = db.settings.geminiApiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API key is required to analyze clips. Please set it in Settings.' });
    }

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
    
    for (const filename of videoFiles) {
      const fileFullPath = path.join(absolutePath, filename);
      
      // Prevent importing duplicates
      const exists = db.clips.some(c => c.path === fileFullPath && (c.userId || 'local-user') === userId);
      if (exists) continue;

      const clipId = uuidv4();
      const thumbnailFilename = `${clipId}.jpg`;
      const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

      try {
        const duration = await getVideoDuration(fileFullPath);
        await generateThumbnail(fileFullPath, thumbnailPath);

        const newClip = {
          id: clipId,
          userId,
          path: fileFullPath,
          name: filename,
          thumbnail: `/uploads/thumbnails/${thumbnailFilename}`,
          duration,
          description: 'Analyzing clip content...',
          tags: [],
          status: 'analyzing'
        };

        db.clips.push(newClip);
        importedClips.push(newClip);
        
        // Trigger background analysis
        analyzeVideoInBackground(clipId, fileFullPath, apiKey);
      } catch (clipErr) {
        console.error(`Failed to process clip ${filename} in folder import:`, clipErr);
      }
    }

    // Save database once after queueing all clips
    if (importedClips.length > 0) {
      saveDb(db);
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

// Stream clip video file directly
app.get('/api/clips/:id/video', (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  const db = getDb();
  const clip = db.clips.find(c => c.id === id && (c.userId || 'local-user') === userId);
  if (!clip) {
    return res.status(404).json({ error: 'Clip not found' });
  }

  if (!existsSync(clip.path)) {
    return res.status(404).json({ error: 'Clip video file does not exist on disk' });
  }

  res.sendFile(clip.path);
});

// Delete clip
app.delete('/api/clips/:id', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  const db = getDb();
  const clipIdx = db.clips.findIndex(c => c.id === id && (c.userId || 'local-user') === userId);
  if (clipIdx === -1) {
    return res.status(404).json({ error: 'Clip not found' });
  }

  const clip = db.clips[clipIdx];
  db.clips.splice(clipIdx, 1);
  saveDb(db);

  // Attempt to delete downloaded/uploaded file if it resides in our uploads folder
  if (clip.path.includes('uploads/clips')) {
    try {
      await fs.unlink(clip.path);
    } catch (_) {}
  }
  // Delete thumbnail
  const thumbPath = path.join(THUMBNAILS_DIR, `${id}.jpg`);
  try {
    await fs.unlink(thumbPath);
  } catch (_) {}

  res.json({ success: true });
});

// Force re-analyze all clips in the library (runs the new segment-based analysis)
app.post('/api/clips/reanalyze-all', (req, res) => {
  const userId = getUserId(req);
  const db = getDb();
  const apiKey = db.settings.geminiApiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key is required. Please set it in Settings.' });
  }

  // Only select clips that do NOT have segment analysis populated yet
  const clipsToAnalyze = db.clips.filter(clip => (clip.userId || 'local-user') === userId && (!clip.segments || clip.segments.length === 0));

  if (clipsToAnalyze.length === 0) {
    return res.json({ success: true, count: 0, message: 'All clips already have segment analysis.' });
  }

  // Set selected statuses to analyzing and trigger background job
  clipsToAnalyze.forEach(clip => {
    clip.status = 'analyzing';
    clip.description = 'Re-analyzing clip content with timelines...';
    clip.tags = [];
    clip.segments = [];
    analyzeVideoInBackground(clip.id, clip.path, apiKey);
  });

  saveDb(db);
  res.json({ success: true, count: clipsToAnalyze.length });
});

// Background Analysis Worker
async function analyzeVideoInBackground(clipId, filePath, apiKey) {
  try {
    const analysis = await analyzeVideo(filePath, apiKey);
    const db = getDb();
    const clip = db.clips.find(c => c.id === clipId);
    if (clip) {
      clip.description = analysis.description;
      clip.tags = analysis.tags;
      clip.segments = analysis.segments || [];
      clip.status = 'ready';
      saveDb(db);
    }
  } catch (error) {
    console.error(`Error analyzing clip ${clipId}:`, error);
    const db = getDb();
    const clip = db.clips.find(c => c.id === clipId);
    if (clip) {
      clip.description = `Analysis failed: ${error.message}`;
      clip.status = 'failed';
      saveDb(db);
    }
  }
}

// ==========================================
// Music Library API (No Analysis)
// ==========================================
app.get('/api/bgms', (req, res) => {
  const userId = getUserId(req);
  const db = getDb();
  const userBgms = (db.bgms || []).filter(b => (b.userId || 'local-user') === userId);
  res.json(userBgms);
});

app.get('/api/bgms/duration', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) {
    return res.status(400).json({ error: 'path parameter is required.' });
  }
  try {
    const duration = await getVideoDuration(filePath);
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
  const db = getDb();
  const bgmId = uuidv4();
  const filename = path.basename(absolutePath);

  try {
    const duration = await getVideoDuration(absolutePath);

    const newBgm = {
      id: bgmId,
      userId,
      path: absolutePath,
      name: filename,
      duration
    };

    db.bgms = db.bgms || [];
    db.bgms.push(newBgm);
    saveDb(db);

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
    const db = getDb();
    db.bgms = db.bgms || [];

    const imported = [];
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (audioExtensions.includes(ext)) {
        const fileFullPath = path.join(absolutePath, file);
        const exists = db.bgms.some(b => b.path === fileFullPath && (b.userId || 'local-user') === userId);
        if (!exists) {
          const bgmId = uuidv4();
          const duration = await getVideoDuration(fileFullPath);
          const newBgm = {
            id: bgmId,
            userId,
            path: fileFullPath,
            name: file,
            duration
          };
          db.bgms.push(newBgm);
          imported.push(newBgm);
        }
      }
    }

    saveDb(db);
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
  const db = getDb();
  db.bgms = db.bgms || [];
  const importedBgms = [];

  try {
    for (const file of req.files) {
      const bgmId = uuidv4();
      const duration = await getVideoDuration(file.path);
      const newBgm = {
        id: bgmId,
        userId,
        path: file.path,
        name: file.originalname,
        duration
      };
      db.bgms.push(newBgm);
      importedBgms.push(newBgm);
    }
    saveDb(db);
    res.json(importedBgms);
  } catch (error) {
    res.status(500).json({ error: `Failed to import uploaded BGMs: ${error.message}` });
  }
});

// Delete BGM from library
app.delete('/api/bgms/:id', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  const db = getDb();
  db.bgms = db.bgms || [];
  const bgmIdx = db.bgms.findIndex(b => b.id === id && (b.userId || 'local-user') === userId);

  if (bgmIdx === -1) {
    return res.status(404).json({ error: 'BGM not found.' });
  }

  const bgm = db.bgms[bgmIdx];
  db.bgms.splice(bgmIdx, 1);
  saveDb(db);

  // Clean up uploaded file if it resides in our uploads directory
  if (bgm.path.includes(path.join('uploads', 'music'))) {
    try {
      await fs.unlink(bgm.path);
    } catch (err) {
      console.warn(`Could not delete file on disk: ${bgm.path}`);
    }
  }

  res.json({ success: true });
});

// ==========================================
// Generation APIs
// ==========================================

// 1. Voiceover endpoint (Generate via ElevenLabs)
app.post('/api/generate-voiceover', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Script text and Voice ID are required.' });
  }

  const db = getDb();
  const apiKey = db.settings.elevenLabsApiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'ElevenLabs API key is missing. Please configure it in Settings.' });
  }

  const userId = getUserId(req);
  let user = null;
  if (userId !== 'local-user') {
    user = db.users.find(u => u.uid === userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    const estimatedSeconds = Math.max(1, Math.ceil(text.length / 15));
    if (user.credits < estimatedSeconds) {
      return res.status(403).json({ error: `Insufficient credits. Need ${estimatedSeconds} credits, but you only have ${user.credits} remaining.` });
    }
  }

  // Save last selected voice in settings
  db.settings.lastSelectedVoice = voiceId;
  saveDb(db);

  const audioId = uuidv4();
  const audioFilename = `voiceover_${audioId}.mp3`;
  const audioPath = path.join(GENERATED_DIR, audioFilename);

  try {
    await generateSpeech(text, voiceId, apiKey, audioPath);
    
    // Deduct credits if applicable
    if (user) {
      try {
        const duration = await getVideoDuration(audioPath);
        const creditsToDeduct = Math.max(1, Math.ceil(duration));
        user.credits = Math.max(0, user.credits - creditsToDeduct);
        saveDb(db);
      } catch (durErr) {
        console.warn('[Billing] Failed to get voiceover duration for credit deduction:', durErr);
      }
    }

    res.json({
      success: true,
      audioPath: audioPath,
      audioUrl: `/uploads/generated/${audioFilename}`
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

  if (videoExtensions.includes(ext)) {
    const audioOutputFilename = `voiceover_${uuidv4()}.mp3`;
    const audioOutputPath = path.join(GENERATED_DIR, audioOutputFilename);

    try {
      const finalAudioPath = await extractAudioFromVideo(req.file.path, audioOutputPath);
      const finalFilename = path.basename(finalAudioPath);
      
      // Cleanup uploaded video to save disk space
      await fs.unlink(req.file.path).catch(() => {});

      return res.json({
        success: true,
        audioPath: finalAudioPath,
        audioUrl: `/uploads/generated/${finalFilename}`
      });
    } catch (err) {
      logErrorToFile('/api/upload-audio [Video Extraction]', err);
      return res.status(500).json({ error: `Failed to extract audio from video: ${err.message}` });
    }
  }

  res.json({
    success: true,
    audioPath: req.file.path,
    audioUrl: `/uploads/generated/${req.file.filename}`
  });
});

// 2b. Extract audio from Library Video Clip endpoint
app.post('/api/clips/extract-audio', async (req, res) => {
  const { clipId } = req.body;
  if (!clipId) {
    return res.status(400).json({ error: 'clipId is required.' });
  }

  const db = getDb();
  const clip = db.clips.find(c => c.id === clipId);
  if (!clip) {
    return res.status(404).json({ error: 'Clip not found.' });
  }

  if (!existsSync(clip.path)) {
    return res.status(404).json({ error: 'Clip source file does not exist on disk.' });
  }

  const audioOutputFilename = `extracted_${clipId}.mp3`;
  const audioOutputPath = path.join(GENERATED_DIR, audioOutputFilename);

  try {
    const finalAudioPath = await extractAudioFromVideo(clip.path, audioOutputPath);
    const finalFilename = path.basename(finalAudioPath);
    
    res.json({
      success: true,
      audioPath: finalAudioPath,
      audioUrl: `/uploads/generated/${finalFilename}`
    });
  } catch (err) {
    logErrorToFile('/api/clips/extract-audio', err);
    res.status(500).json({ error: `Failed to extract audio from clip: ${err.message}` });
  }
});

// 3. Script segmentation and time alignment (via Gemini)
app.post('/api/align-script', async (req, res) => {
  const { scriptText, audioPath } = req.body;
  if (!audioPath) {
    return res.status(400).json({ error: 'Audio file path is required.' });
  }

  const db = getDb();
  const apiKey = db.settings.geminiApiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key is missing. Please configure it in Settings.' });
  }

  try {
    const rawSegments = await alignScriptAndAudio(scriptText || '', audioPath, apiKey);
    
    // Check audio duration and fallback to beat sync at the end of dialogue
    let audioDuration = 0;
    try {
      audioDuration = await getVideoDuration(audioPath);
    } catch (err) {
      console.warn('[Aligner] Failed to get audio duration:', err.message);
    }

    if (audioDuration > 0 && rawSegments && rawSegments.length > 0) {
      const lastSpeechEndTime = Math.max(...rawSegments.map(s => s.end_time));
      if (audioDuration - lastSpeechEndTime > 2.0) {
        console.log(`[Aligner] Dialogue ends at ${lastSpeechEndTime}s, but audio runs until ${audioDuration}s. Appending beat-sync segments.`);
        try {
          // Detect beats for the remaining duration
          const beats = await detectBeats(audioPath, 1.4, 0.4);
          
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
    
    // Process and interpolate word timings if they are missing
    const segments = rawSegments.map(seg => {
      if (seg.isBeatSyncOnly) {
        return seg;
      }

      // Populate text if missing (fallback)
      if (!seg.text && (seg.text_hinglish || seg.text_hindi)) {
        seg.text = seg.text_hinglish || seg.text_hindi;
      }

      // 1. Process standard words if missing
      if (!seg.words || !Array.isArray(seg.words) || seg.words.length === 0) {
        seg.words = interpolateWords(seg.text || '', seg.start_time, seg.end_time);
      }

      // 2. Process words_hindi if missing
      if (!seg.words_hindi || !Array.isArray(seg.words_hindi) || seg.words_hindi.length === 0) {
        seg.words_hindi = interpolateWords(seg.text_hindi || '', seg.start_time, seg.end_time);
      }

      // 3. Process words_hinglish if missing
      if (!seg.words_hinglish || !Array.isArray(seg.words_hinglish) || seg.words_hinglish.length === 0) {
        seg.words_hinglish = interpolateWords(seg.text_hinglish || '', seg.start_time, seg.end_time);
      }
      
      return seg;
    });

    res.json({ success: true, segments });
  } catch (error) {
    console.error('Error in /api/align-script:', error);
    logErrorToFile('/api/align-script', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/beat-sync/analyze', async (req, res) => {
  const { audioPath, threshold } = req.body;
  if (!audioPath) {
    return res.status(400).json({ error: 'Audio file path is required.' });
  }

  try {
    const thresh = threshold !== undefined ? Number(threshold) : 1.4;
    // Detect Major Beats (default minDistance = 0.4s)
    const beats = await detectBeats(audioPath, thresh, 0.4);

    // Detect Minor sub-beats (lower threshold, e.g. thresh - 0.20, and smaller minDistance = 0.15s)
    const minorThresh = Math.max(1.1, thresh - 0.20);
    const allPeaks = await detectBeats(audioPath, minorThresh, 0.15);

    // Filter out minor peaks that are too close to major beats (within 0.18s) to avoid overlaps
    const miniBeats = allPeaks.filter(p => {
      return !beats.some(b => Math.abs(b - p) < 0.18);
    });

    res.json({ success: true, beats, miniBeats });
  } catch (error) {
    console.error('Error in /api/beat-sync/analyze:', error);
    logErrorToFile('/api/beat-sync/analyze', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Storyboard clip matching (via Gemini)
app.post('/api/match-clips', async (req, res) => {
  const { scenes } = req.body;
  if (!scenes || !Array.isArray(scenes)) {
    return res.status(400).json({ error: 'Storyboard scenes list is required.' });
  }

  const db = getDb();
  const apiKey = db.settings.geminiApiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key is missing. Please configure it in Settings.' });
  }

  // Only match against "ready" status clips
  const readyClips = db.clips
    .filter(c => c.status === 'ready')
    .map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      tags: c.tags,
      duration: c.duration,
      segments: c.segments || []
    }));

  if (readyClips.length === 0) {
    return res.status(400).json({ error: 'No analyzed clips found in the library. Please import and analyze video clips first.' });
  }

  try {
    const matches = await matchClipsToScenes(scenes, readyClips, apiKey);
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
    beatEffects
  } = req.body;

  if (!scenes || !voiceoverPath) {
    return res.status(400).json({ error: 'Scenes and voiceover file path are required.' });
  }

  const db = getDb();
  const userId = getUserId(req);
  let user = null;
  let estimatedCredits = 0;

  if (userId !== 'local-user') {
    user = db.users.find(u => u.uid === userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    
    try {
      if (existsSync(voiceoverPath)) {
        const duration = await getVideoDuration(voiceoverPath);
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
    saveDb(db);
  }

  const jobId = uuidv4();

  // Create job structure
  const jobState = {
    id: jobId,
    progress: 0,
    status: 'Queued',
    resultUrl: null,
    error: null
  };

  activeJobs.set(jobId, jobState);

  // Trigger video compilation in background
  runVideoCompilation(jobId, {
    projectId,
    userId,
    estimatedCredits,
    scenes,
    clips: db.clips,
    voiceoverPath,
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
    outputDir: GENERATED_DIR
  });

  res.json({ success: true, jobId });
});

// Background Video Assembler
async function runVideoCompilation(jobId, options) {
  const job = activeJobs.get(jobId);
  const { userId, estimatedCredits } = options;
  try {
    job.status = 'Starting compilation...';
    job.progress = 5;

    const outputPath = await assembleVideo(options, (progressPercent, statusText) => {
      job.progress = progressPercent;
      job.status = statusText;
    });

    const outputFilename = path.basename(outputPath);
    job.progress = 100;
    job.status = 'Completed';
    job.resultUrl = `/uploads/generated/${outputFilename}`;

    // Associate rendered video path with project
    if (options.projectId) {
      const db = getDb();
      const proj = db.projects.find(p => p.id === options.projectId);
      if (proj) {
        proj.state = proj.state || {};
        proj.state.lastRenderedVideoPath = outputPath;
        proj.updatedAt = new Date().toISOString();
        saveDb(db);
      }
    }
  } catch (error) {
    console.error(`Rendering job ${jobId} failed:`, error);
    logErrorToFile(`runVideoCompilation - Job ${jobId}`, error);
    job.progress = 100;
    job.status = 'Failed';
    job.error = error.message;

    // Refund credits on failure
    if (userId && userId !== 'local-user' && estimatedCredits > 0) {
      try {
        const db = getDb();
        const user = db.users.find(u => u.uid === userId);
        if (user) {
          user.credits += estimatedCredits;
          saveDb(db);
          console.log(`[Billing] Refunded ${estimatedCredits} credits to user ${userId} due to compilation failure.`);
        }
      } catch (refundErr) {
        console.error('[Billing] Failed to refund credits on failure:', refundErr);
      }
    }
  }
}

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

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` Video Generator Backend running on port ${PORT} `);
  console.log(` Static uploads served at http://localhost:${PORT}/uploads`);
  console.log(`=================================================`);

  // Auto-resume any interrupted clip analysis tasks on boot
  try {
    const db = getDb();
    const interruptedClips = db.clips.filter(c => c.status === 'analyzing');
    if (interruptedClips.length > 0 && db.settings.geminiApiKey) {
      console.log(`[Startup Recovery] Found ${interruptedClips.length} interrupted analysis tasks. Resuming background analysis...`);
      interruptedClips.forEach(clip => {
        analyzeVideoInBackground(clip.id, clip.path, db.settings.geminiApiKey);
      });
    }
  } catch (err) {
    console.error('[Startup Recovery] Failed to check for interrupted tasks:', err.message);
  }
});
