import 'dotenv/config';
import { Firestore } from '@google-cloud/firestore';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'db.json');
const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'flowsocial-498207';

let firestore = null;
let useLocalDb = false;
const isProduction = !!process.env.K_SERVICE;

// Initialize Firestore if running in GCP Cloud Run environment or explicitly requested via USE_FIRESTORE=true
try {
  const isFirestoreExplicit = process.env.USE_FIRESTORE === 'true' || process.env.ENABLE_FIRESTORE === 'true';
  if (process.env.K_SERVICE || isFirestoreExplicit) {
    const firestoreConfig = { projectId: PROJECT_ID };
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      firestoreConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    firestore = new Firestore(firestoreConfig);
    useLocalDb = false;
    console.log(`[Database] Initialized GCP Cloud Firestore in project "${PROJECT_ID}".`);
  } else {
    console.log('[Database] Running in local fallback mode (db.json) because K_SERVICE is not defined.');
    useLocalDb = true;
  }
} catch (err) {
  console.warn('[Database] Failed to initialize Firestore client:', err.message);
  console.log('[Database] Falling back to local db.json.');
  useLocalDb = true;
}

// ==========================================
// Local db.json Fallback Helpers
// ==========================================
function getLocalDb() {
  if (!existsSync(DB_PATH)) {
    const defaultData = {
      settings: {
        geminiApiKey: '',
        elevenLabsApiKey: '',
        pexelsApiKey: '',
        pixabayApiKey: '',
        defaultOutputDir: path.resolve(__dirname, '..', 'uploads', 'generated'),
        lastActiveProjectId: '',
        lastSelectedVoice: ''
      },
      project: {}, // singular legacy project
      clips: [],
      bgms: [],
      projects: [],
      users: [],
      recreates: []
    };
    writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
  return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
}

function saveLocalDb(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ==========================================
// Unified DB Service Interface
// ==========================================
export const dbService = {
  // --- Settings APIs ---
  async getSettings() {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.settings || {};
    }
    try {
      const doc = await firestore.collection('settings').doc('global').get();
      if (!doc.exists) {
        return {};
      }
      return doc.data();
    } catch (err) {
      console.error('[Database Error] Failed to get settings:', err.message);
      return {};
    }
  },

  async saveSettings(settings) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.settings = { ...db.settings, ...settings };
      saveLocalDb(db);
      return db.settings;
    }
    try {
      const docRef = firestore.collection('settings').doc('global');
      await docRef.set(settings, { merge: true });
      const updated = await docRef.get();
      return updated.data();
    } catch (err) {
      console.error('[Database Error] Failed to save settings:', err.message);
      throw err;
    }
  },

  // --- Singular/Legacy Project state ---
  async getLegacyProject() {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.project || {};
    }
    try {
      const doc = await firestore.collection('settings').doc('projectState').get();
      if (!doc.exists) {
        return {};
      }
      return doc.data();
    } catch (err) {
      console.error('[Database Error] Failed to get legacy project:', err.message);
      return {};
    }
  },

  async saveLegacyProject(projectState) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.project = { ...db.project, ...projectState };
      saveLocalDb(db);
      return db.project;
    }
    try {
      await firestore.collection('settings').doc('projectState').set(projectState, { merge: true });
      return projectState;
    } catch (err) {
      console.error('[Database Error] Failed to save legacy project:', err.message);
      throw err;
    }
  },

  async deleteLegacyProject() {
    const emptyProject = {
      scriptText: "",
      selectedVoice: "",
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
    if (useLocalDb) {
      const db = getLocalDb();
      db.project = emptyProject;
      saveLocalDb(db);
      return emptyProject;
    }
    try {
      await firestore.collection('settings').doc('projectState').set(emptyProject);
      return emptyProject;
    } catch (err) {
      console.error('[Database Error] Failed to delete legacy project:', err.message);
      throw err;
    }
  },

  // --- Multi-Project History APIs ---
  async getProjects(userId = 'local-user') {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.projects || [];
    }
    try {
      const snapshot = await firestore.collection('projects').get();
      const projects = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!isProduction || !data.userId || data.userId === userId || userId === 'local-user') {
          projects.push({ id: doc.id, ...data });
        }
      });
      return projects.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    } catch (err) {
      console.error('[Database Error] Failed to get projects:', err.message);
      return [];
    }
  },

  async getProject(projectId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.projects.find(p => p.id === projectId);
    }
    try {
      const doc = await firestore.collection('projects').doc(projectId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (err) {
      console.error('[Database Error] Failed to get project:', err.message);
      return null;
    }
  },

  async saveProject(project) {
    if (!project.id) {
      throw new Error('Project must have an id.');
    }
    project.updatedAt = new Date().toISOString();
    project.createdAt = project.createdAt || project.updatedAt;
    
    if (useLocalDb) {
      const db = getLocalDb();
      db.projects = db.projects || [];
      const idx = db.projects.findIndex(p => p.id === project.id);
      if (idx !== -1) {
        db.projects[idx] = { ...db.projects[idx], ...project };
      } else {
        db.projects.push(project);
      }
      saveLocalDb(db);
      return project;
    }
    try {
      const docRef = firestore.collection('projects').doc(project.id);
      await docRef.set(project, { merge: true });
      return project;
    } catch (err) {
      console.error('[Database Error] Failed to save project:', err.message);
      throw err;
    }
  },

  async deleteProject(projectId) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.projects = db.projects || [];
      const idx = db.projects.findIndex(p => p.id === projectId);
      if (idx !== -1) {
        db.projects.splice(idx, 1);
        saveLocalDb(db);
        return true;
      }
      return false;
    }
    try {
      await firestore.collection('projects').doc(projectId).delete();
      return true;
    } catch (err) {
      console.error('[Database Error] Failed to delete project:', err.message);
      return false;
    }
  },

  // --- Clips Library APIs ---
  async getClips(userId = 'local-user') {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.clips || [];
    }
    try {
      const snapshot = await firestore.collection('clips').get();
      const clips = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!isProduction || !data.userId || data.userId === userId || userId === 'local-user') {
          clips.push({ id: doc.id, ...data });
        }
      });
      return clips;
    } catch (err) {
      console.error('[Database Error] Failed to get clips:', err.message);
      return [];
    }
  },

  async getClipsByStatus(status) {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.clips || []).filter(c => c.status === status);
    }
    try {
      const snapshot = await firestore.collection('clips')
        .where('status', '==', status)
        .get();
      const clips = [];
      snapshot.forEach(doc => {
        clips.push({ id: doc.id, ...doc.data() });
      });
      return clips;
    } catch (err) {
      console.error('[Database Error] Failed to get clips by status:', err.message);
      return [];
    }
  },

  async getClip(clipId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.clips.find(c => c.id === clipId);
    }
    try {
      const doc = await firestore.collection('clips').doc(clipId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (err) {
      console.error('[Database Error] Failed to get clip:', err.message);
      return null;
    }
  },

  async saveClip(clip) {
    if (!clip.id) {
      throw new Error('Clip must have a unique ID.');
    }
    clip.createdAt = clip.createdAt || new Date().toISOString();
    if (useLocalDb) {
      const db = getLocalDb();
      db.clips = db.clips || [];
      const idx = db.clips.findIndex(c => c.id === clip.id);
      if (idx !== -1) {
        db.clips[idx] = { ...db.clips[idx], ...clip };
      } else {
        db.clips.push(clip);
      }
      saveLocalDb(db);
      return clip;
    }
    try {
      await firestore.collection('clips').doc(clip.id).set(clip, { merge: true });
      return clip;
    } catch (err) {
      console.error('[Database Error] Failed to save clip:', err.message);
      throw err;
    }
  },

  async deleteClip(clipId) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.clips = db.clips || [];
      const idx = db.clips.findIndex(c => c.id === clipId);
      if (idx !== -1) {
        db.clips.splice(idx, 1);
        saveLocalDb(db);
        return true;
      }
      return false;
    }
    try {
      await firestore.collection('clips').doc(clipId).delete();
      return true;
    } catch (err) {
      console.error('[Database Error] Failed to delete clip:', err.message);
      throw err;
    }
  },

  // --- Upload Session APIs ---
  async saveUploadSession(clipId, session) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.uploadSessions = db.uploadSessions || {};
      db.uploadSessions[clipId] = session;
      saveLocalDb(db);
      return session;
    }
    try {
      await firestore.collection('uploadSessions').doc(clipId).set(session);
      return session;
    } catch (err) {
      console.error('[Database Error] Failed to save upload session:', err.message);
      throw err;
    }
  },

  async getUploadSession(clipId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.uploadSessions && db.uploadSessions[clipId]) || null;
    }
    try {
      const doc = await firestore.collection('uploadSessions').doc(clipId).get();
      if (!doc.exists) return null;
      return doc.data();
    } catch (err) {
      console.error('[Database Error] Failed to get upload session:', err.message);
      return null;
    }
  },

  async deleteUploadSession(clipId) {
    if (useLocalDb) {
      const db = getLocalDb();
      if (db.uploadSessions) {
        delete db.uploadSessions[clipId];
        saveLocalDb(db);
      }
      return true;
    }
    try {
      await firestore.collection('uploadSessions').doc(clipId).delete();
      return true;
    } catch (err) {
      console.error('[Database Error] Failed to delete upload session:', err.message);
      return false;
    }
  },

  // --- Background Music (BGM) APIs ---
  async getBgms(userId = 'local-user') {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.bgms || []).filter(b => (b.userId || 'local-user') === userId);
    }
    try {
      const snapshot = await firestore.collection('bgms')
        .where('userId', '==', userId)
        .get();
      const bgms = [];
      snapshot.forEach(doc => {
        bgms.push({ id: doc.id, ...doc.data() });
      });
      return bgms;
    } catch (err) {
      console.error('[Database Error] Failed to get bgms:', err.message);
      return [];
    }
  },

  async saveBgm(bgm) {
    if (!bgm.id) {
      throw new Error('Bgm must have a unique ID.');
    }
    bgm.createdAt = bgm.createdAt || new Date().toISOString();
    
    if (useLocalDb) {
      const db = getLocalDb();
      db.bgms = db.bgms || [];
      const idx = db.bgms.findIndex(b => b.id === bgm.id);
      if (idx !== -1) {
        db.bgms[idx] = { ...db.bgms[idx], ...bgm };
      } else {
        db.bgms.push(bgm);
      }
      saveLocalDb(db);
      return bgm;
    }
    try {
      await firestore.collection('bgms').doc(bgm.id).set(bgm, { merge: true });
      return bgm;
    } catch (err) {
      console.error('[Database Error] Failed to save bgm:', err.message);
      throw err;
    }
  },

  async deleteBgm(bgmId) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.bgms = db.bgms || [];
      const idx = db.bgms.findIndex(b => b.id === bgmId);
      if (idx !== -1) {
        db.bgms.splice(idx, 1);
        saveLocalDb(db);
        return true;
      }
      return false;
    }
    try {
      await firestore.collection('bgms').doc(bgmId).delete();
      return true;
    } catch (err) {
      console.error('[Database Error] Failed to delete bgm:', err.message);
      throw err;
    }
  },

  // --- SaaS Users & Billing APIs ---
  async getUser(userId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.users.find(u => u.uid === userId || u.email === userId);
    }
    try {
      const doc = await firestore.collection('users').doc(userId).get();
      if (!doc.exists) return null;
      return { uid: doc.id, ...doc.data() };
    } catch (err) {
      console.error('[Database Error] Failed to get user:', err.message);
      return null;
    }
  },

  async saveUser(user) {
    if (!user.uid) {
      throw new Error('User must have a uid.');
    }
    user.createdAt = user.createdAt || new Date().toISOString();
    
    if (useLocalDb) {
      const db = getLocalDb();
      db.users = db.users || [];
      const idx = db.users.findIndex(u => u.uid === user.uid);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], ...user };
      } else {
        db.users.push(user);
      }
      saveLocalDb(db);
      return user;
    }
    try {
      await firestore.collection('users').doc(user.uid).set(user, { merge: true });
      return user;
    } catch (err) {
      console.error('[Database Error] Failed to save user:', err.message);
      throw err;
    }
  },

  async getUserByEmailAndPassword(email, password) {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    }
    try {
      const snapshot = await firestore.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      const data = doc.data();
      if (data.password && data.password !== password) {
        return null;
      }
      return { uid: doc.id, ...data };
    } catch (err) {
      console.error('[Database Error] Failed to get user by email and password:', err.message);
      return null;
    }
  },

  async checkUserExists(email) {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
    }
    try {
      const snapshot = await firestore.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      return !snapshot.empty;
    } catch (err) {
      console.error('[Database Error] Failed to check user existence:', err.message);
      return false;
    }
  },

  // --- Recreates APIs ---
  async getRecreate(recreateId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.recreates || []).find(r => r.id === recreateId);
    }
    try {
      const doc = await firestore.collection('recreates').doc(recreateId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (err) {
      console.error('[Database Error] Failed to get recreate:', err.message);
      return null;
    }
  },

  async getRecreates(userId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.recreates || []).filter(r => (r.userId || 'local-user') === userId);
    }
    try {
      const snapshot = await firestore.collection('recreates')
        .where('userId', '==', userId)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error('[Database Error] Failed to get recreates:', err.message);
      return [];
    }
  },

  async saveRecreate(recreate) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.recreates = db.recreates || [];
      const idx = db.recreates.findIndex(r => r.id === recreate.id);
      if (idx !== -1) {
        db.recreates[idx] = { ...db.recreates[idx], ...recreate };
      } else {
        db.recreates.push(recreate);
      }
      saveLocalDb(db);
      return recreate;
    }
    try {
      await firestore.collection('recreates').doc(recreate.id).set(recreate, { merge: true });
      return recreate;
    } catch (err) {
      console.error('[Database Error] Failed to save recreate:', err.message);
      throw err;
    }
  },

  async deleteRecreate(recreateId) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.recreates = db.recreates || [];
      db.recreates = db.recreates.filter(r => r.id !== recreateId);
      saveLocalDb(db);
      return { success: true };
    }
    try {
      await firestore.collection('recreates').doc(recreateId).delete();
      return { success: true };
    } catch (err) {
      console.error('[Database Error] Failed to delete recreate:', err.message);
      throw err;
    }
  },

  // --- Subject Profile APIs ---
  async getSubjectProfile(userId = 'local-user') {
    if (useLocalDb) {
      const db = getLocalDb();
      return db.subjectProfile || { photos: [], summary: '' };
    }
    try {
      const doc = await firestore.collection('subject_profiles').doc(userId).get();
      if (!doc.exists) return { photos: [], summary: '' };
      return doc.data();
    } catch (err) {
      console.error('[Database Error] Failed to get subject profile:', err.message);
      return { photos: [], summary: '' };
    }
  },

  async saveSubjectProfile(userId = 'local-user', profile) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.subjectProfile = profile;
      saveLocalDb(db);
      return db.subjectProfile;
    }
    try {
      await firestore.collection('subject_profiles').doc(userId).set(profile, { merge: true });
      return profile;
    } catch (err) {
      console.error('[Database Error] Failed to save subject profile:', err.message);
      throw err;
    }
  },

  async deleteSubjectProfile(userId = 'local-user') {
    if (useLocalDb) {
      const db = getLocalDb();
      delete db.subjectProfile;
      saveLocalDb(db);
      return { success: true };
    }
    try {
      await firestore.collection('subject_profiles').doc(userId).delete();
      return { success: true };
    } catch (err) {
      console.error('[Database Error] Failed to delete subject profile:', err.message);
      throw err;
    }
  },

  // --- Render Jobs (background rendering persistence) ---

  async saveRenderJob(job) {
    // job: { jobId, userId, type, status, progress, createdAt, title }
    if (useLocalDb) {
      const db = getLocalDb();
      db.renderJobs = db.renderJobs || [];
      const idx = db.renderJobs.findIndex(j => j.jobId === job.jobId);
      if (idx !== -1) db.renderJobs[idx] = { ...db.renderJobs[idx], ...job };
      else db.renderJobs.push(job);
      saveLocalDb(db);
      return job;
    }
    try {
      await firestore.collection('render_jobs').doc(job.jobId).set(job, { merge: true });
      return job;
    } catch (err) {
      console.error('[Database Error] Failed to save render job:', err.message);
    }
  },

  async updateRenderJob(jobId, updates) {
    if (useLocalDb) {
      const db = getLocalDb();
      db.renderJobs = db.renderJobs || [];
      const idx = db.renderJobs.findIndex(j => j.jobId === jobId);
      if (idx !== -1) db.renderJobs[idx] = { ...db.renderJobs[idx], ...updates };
      saveLocalDb(db);
      return;
    }
    try {
      await firestore.collection('render_jobs').doc(jobId).set(updates, { merge: true });
    } catch (err) {
      console.error('[Database Error] Failed to update render job:', err.message);
    }
  },

  async getRenderJob(jobId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.renderJobs || []).find(j => j.jobId === jobId) || null;
    }
    try {
      const doc = await firestore.collection('render_jobs').doc(jobId).get();
      if (!doc.exists) return null;
      return { ...doc.data() };
    } catch (err) {
      console.error('[Database Error] Failed to get render job:', err.message);
      return null;
    }
  },

  async listRenderJobs(userId) {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.renderJobs || [])
        .filter(j => j.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    try {
      const snap = await firestore.collection('render_jobs')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      return snap.docs.map(d => ({ ...d.data() }));
    } catch (err) {
      console.error('[Database Error] Failed to list render jobs:', err.message);
      return [];
    }
  },

  /**
   * Returns all render jobs currently stuck in 'rendering' state (across all users).
   * Used on server startup to mark crashed jobs as failed.
   */
  async listStaleRenderJobs() {
    if (useLocalDb) {
      const db = getLocalDb();
      return (db.renderJobs || []).filter(j => j.status === 'rendering');
    }
    try {
      const snap = await firestore.collection('render_jobs')
        .where('status', '==', 'rendering')
        .get();
      return snap.docs.map(d => ({ ...d.data() }));
    } catch (err) {
      console.error('[Database Error] Failed to list stale render jobs:', err.message);
      return [];
    }
  },
};

