import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, appendFileSync, statSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';

// Import services
import { analyzeVideo, alignScriptAndAudio, matchClipsToScenes, enhanceScriptWithTags } from './services/gemini.js';
import { getVoices, generateSpeech } from './services/elevenlabs.js';
import { getVideoDuration, generateThumbnail, assembleVideo, ensureFontExists, extractAudioFromVideo, getLocalWordTimings } from './services/video.js';
import { detectBeats } from './services/beats.js';
import { getGcpWordTimings, assignTimestampsToWords, mapTimestamps } from './services/speech.js';
import { dbService } from './services/firestore.js';
import { gcsService } from './services/gcs.js';
import { Storage } from '@google-cloud/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
  if (!type || !['create', 'beatsync', 'talkinghead'].includes(type)) {
    return res.status(400).json({ error: 'Valid project type is required (create, beatsync, or talkinghead).' });
  }
  
  const userId = getUserId(req);
  try {
    const settings = await dbService.getSettings();
    let defaultName = `Untitled Voiceover Project`;
    if (type === 'beatsync') defaultName = `Untitled Beat Sync Project`;
    else if (type === 'talkinghead') defaultName = `Untitled Talking Head Project`;

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
      } : type === 'talkinghead' ? {
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
        activeWordScale: 1.0, 
        wordDisplayTime: 1.0,
        textPositionX: 0,
        textPositionY: -70
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
    if (state !== undefined) project.state = { ...project.state, ...state };
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
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
      return res.status(400).json({ error: 'Gemini API key or Vertex AI credentials are required.' });
    }

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
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
      return res.status(400).json({ error: 'Gemini API key or Vertex AI credentials are required.' });
    }

    const importedClips = [];

    for (const file of req.files) {
      const absolutePath = file.path;
      const clipId = path.basename(file.filename, path.extname(file.filename));
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

    const localTempPath = session.filePath;

    // Generate thumbnail
    const thumbnailFilename = `${clipId}.jpg`;
    const thumbnailLocalPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
    const duration = await getVideoDuration(localTempPath);
    await generateThumbnail(localTempPath, thumbnailLocalPath);

    let finalVideoPath = localTempPath;
    let finalThumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;

    // Upload to GCS if enabled
    if (gcsService.isGcsEnabled()) {
      const gcsVideoPath = `clips/${clipId}${session.ext}`;
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
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
      return res.status(400).json({ error: 'Gemini API key or Vertex AI credentials are required.' });
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

// Stream clip video file directly
app.get('/api/clips/:id/video', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  try {
    const clip = await dbService.getClip(id);
    if (!clip || (clip.userId || 'local-user') !== userId) {
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

    res.sendFile(resolved);
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
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
      return res.status(400).json({ error: 'Gemini API key or Vertex AI credentials are required.' });
    }

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
      clip.tags = analysis.tags;
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
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
      return res.status(400).json({ error: 'Gemini API key or Vertex AI credentials are required.' });
    }

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
  const { scriptText, audioPath, mergeShortScenes } = req.body;
  if (!audioPath) {
    return res.status(400).json({ error: 'Audio file path is required.' });
  }

  let tempLocalAudioPath = null;
  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
      return res.status(400).json({ error: 'Gemini API key or Vertex AI credentials are required.' });
    }

    let resolved = null;
    if (gcsService.isGcsEnabled() && audioPath.startsWith('http')) {
      tempLocalAudioPath = path.join(GENERATED_DIR, `temp_align_${uuidv4()}.mp3`);
      await gcsService.downloadFile(audioPath, tempLocalAudioPath);
      resolved = tempLocalAudioPath;
    } else {
      resolved = resolvePath(audioPath);
    }

    const rawSegments = await alignScriptAndAudio(scriptText || '', resolved, apiKey);
    
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
        if (lastSeg && audioDuration > lastSeg.end_time) {
          console.log(`[Aligner] Extending last scene end_time from ${lastSeg.end_time}s to ${audioDuration}s to cover audio outro.`);
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
    const minorThresh = Math.max(1.1, thresh - 0.20);
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
  const { scenes, talkingHead } = req.body;
  if (!scenes || !Array.isArray(scenes)) {
    return res.status(400).json({ error: 'Storyboard scenes list is required.' });
  }

  try {
    const settings = await dbService.getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.K_SERVICE) {
      return res.status(400).json({ error: 'Gemini API key or Vertex AI credentials are required.' });
    }

    const userId = getUserId(req);
    const clips = await dbService.getClips(userId);

    // Only match against "ready" status clips
    const readyClips = clips
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

    const matches = await matchClipsToScenes(scenes, readyClips, apiKey, !!talkingHead);
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
    talkingHeadOutlineThickness
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

    const outputPath = await assembleVideo(options, (progressPercent, statusText) => {
      job.progress = progressPercent;
      job.status = statusText;
    });

    job.progress = 100;
    job.status = 'Completed';
    job.resultUrl = outputPath.startsWith('http') ? outputPath : `/uploads/generated/${path.basename(outputPath)}`;

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
