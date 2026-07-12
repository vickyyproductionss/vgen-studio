/**
 * gcpAvatar.js
 * Connects the VideoGenerator backend to the GCP Avatar Pipeline (Cloud Run API).
 * Replaces sadtalker.js for cloud-based lip sync generation.
 *
 * Flow:
 *   1. Upload avatar image + audio to GCS via Cloud Run /upload endpoints
 *   2. POST /generate to start the job
 *   3. Poll /status/:jobId every 3s
 *   4. Return final video URL from /result/:jobId
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { EventEmitter } from 'events';
import { getCustomAgent } from './customAgent.js';

// ─── Config ────────────────────────────────────────────────────────────────────
const AVATAR_API_URL = process.env.AVATAR_API_URL || 'https://avatar-api-xxxx-el.a.run.app';
const agent = getCustomAgent(AVATAR_API_URL);
const POLL_INTERVAL_MS = 3000;   // Poll every 3 seconds
const MAX_WAIT_MS = 30 * 60 * 1000; // 30 minutes max

// ─── In-memory job tracker (mirrors GCS status for fast polling) ────────────
const gcpJobs = new Map(); // jobId → { status, stage, progress, videoUrl, error, emitter }

/**
 * Start a GCP lip-sync job asynchronously.
 * Returns a local jobId immediately. Progress is tracked in gcpJobs map.
 *
 * @param {string} avatarImagePath - Local filesystem path to avatar image
 * @param {string} audioFilePath   - Local filesystem path to audio file
 * @param {object} options         - { projectId }
 * @returns {string} localJobId
 */
export function startGcpLipsyncJob(avatarImagePath, audioFilePath, options = {}) {
  const localJobId = `gcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const emitter = new EventEmitter();

  gcpJobs.set(localJobId, {
    status:   'queued',
    stage:    'uploading_files',
    progress: 0,
    videoUrl: null,
    error:    null,
    emitter,
    startedAt: Date.now(),
  });

  // Start async pipeline (don't await)
  _runGcpPipeline(localJobId, avatarImagePath, audioFilePath, options).catch(err => {
    const job = gcpJobs.get(localJobId);
    if (job) {
      job.status   = 'error';
      job.stage    = 'error';
      job.progress = 0;
      job.error    = err.message;
      console.error(`[GCP Avatar ${localJobId}] Pipeline failed:`, err.message);
    }
  });

  return localJobId;
}

/**
 * Get current status of a GCP job.
 * @param {string} localJobId
 * @returns {{ status, stage, progress, videoUrl, error, elapsedMs }}
 */
export function getGcpJobStatus(localJobId) {
  const job = gcpJobs.get(localJobId);
  if (!job) return null;
  return {
    status:    job.status,
    stage:     job.stage,
    progress:  job.progress,
    videoUrl:  job.videoUrl,
    error:     job.error,
    elapsedMs: Date.now() - job.startedAt,
  };
}

// ─── Internal pipeline ────────────────────────────────────────────────────────
async function _runGcpPipeline(localJobId, avatarImagePath, audioFilePath, options) {
  const job = gcpJobs.get(localJobId);
  console.log(`[GCP Avatar ${localJobId}] Starting pipeline...`);
  console.log(`[GCP Avatar ${localJobId}] Avatar: ${avatarImagePath}`);
  console.log(`[GCP Avatar ${localJobId}] Audio:  ${audioFilePath}`);
  console.log(`[GCP Avatar ${localJobId}] API:    ${AVATAR_API_URL}`);

  // ── Step 1: Upload avatar image ────────────────────────────────────────────
  _updateJob(localJobId, { stage: 'uploading_avatar', progress: 5 });
  const avatarGcsUri = await _uploadFile(avatarImagePath, 'avatar');
  console.log(`[GCP Avatar ${localJobId}] Avatar uploaded: ${avatarGcsUri}`);

  // ── Step 2: Upload audio ───────────────────────────────────────────────────
  _updateJob(localJobId, { stage: 'uploading_audio', progress: 10 });
  const audioGcsUri = await _uploadFile(audioFilePath, 'audio');
  console.log(`[GCP Avatar ${localJobId}] Audio uploaded: ${audioGcsUri}`);

  // ── Step 3: Start GCP job ──────────────────────────────────────────────────
  _updateJob(localJobId, { stage: 'queued_on_gcp', progress: 15 });
  const gcpJobId = await _startJob(avatarGcsUri, audioGcsUri, options);
  console.log(`[GCP Avatar ${localJobId}] GCP job started: ${gcpJobId}`);

  // ── Step 4: Poll for completion ────────────────────────────────────────────
  const videoUrl = await _pollUntilDone(localJobId, gcpJobId);

  // ── Step 5: Done ───────────────────────────────────────────────────────────
  _updateJob(localJobId, { status: 'done', stage: 'done', progress: 100, videoUrl });
  console.log(`[GCP Avatar ${localJobId}] ✅ Complete! Video: ${videoUrl}`);
}

async function _uploadFile(localPath, type) {
  const endpoint = type === 'avatar'
    ? `${AVATAR_API_URL}/upload/avatar`
    : `${AVATAR_API_URL}/upload/audio`;

  const form = new FormData();
  form.append('file', fs.createReadStream(localPath), {
    filename: localPath.split('/').pop(),
    contentType: type === 'avatar' ? 'image/png' : 'audio/wav',
  });

  const res = await fetch(endpoint, { method: 'POST', body: form, agent });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.gcsUri;
}

async function _startJob(avatarGcsUri, audioGcsUri, options) {
  const res = await fetch(`${AVATAR_API_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarGcsUri,
      audioGcsUri,
      options: {
        resolution: options.resolution || '1080p',
        fps: options.fps || 30,
        enhance: false, // Phase 2
      },
    }),
    agent,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to start GCP job (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.jobId;
}

async function _pollUntilDone(localJobId, gcpJobId) {
  const deadline = Date.now() + MAX_WAIT_MS;

  // Stage → progress mapping for smooth UI updates
  const STAGE_PROGRESS = {
    queued:          15,
    downloading:     20,
    downloaded:      25,
    lip_sync:        40,
    lip_sync_done:   75,
    rendering:       85,
    uploading:       92,
    done:            100,
    error:           0,
  };

  while (Date.now() < deadline) {
    await _sleep(POLL_INTERVAL_MS);

    let statusData;
    try {
      const res = await fetch(`${AVATAR_API_URL}/status/${gcpJobId}`, { agent });
      if (!res.ok) {
        console.warn(`[GCP Avatar ${localJobId}] Status poll returned ${res.status}`);
        continue;
      }
      statusData = await res.json();
    } catch (err) {
      console.warn(`[GCP Avatar ${localJobId}] Status poll error: ${err.message}`);
      continue;
    }

    const { status, stage, progress, error } = statusData;
    const mappedProgress = STAGE_PROGRESS[stage] ?? progress ?? 50;

    _updateJob(localJobId, {
      status:   status === 'done' ? 'done' : status === 'error' ? 'error' : 'processing',
      stage,
      progress: mappedProgress,
      error:    error || null,
    });

    console.log(`[GCP Avatar ${localJobId}] Poll → status:${status} stage:${stage} progress:${mappedProgress}%`);

    if (status === 'done') {
      // Fetch result URL
      const resultRes = await fetch(`${AVATAR_API_URL}/result/${gcpJobId}`, { agent });
      if (!resultRes.ok) throw new Error('Job done but result fetch failed');
      const resultData = await resultRes.json();
      return resultData.videoUrl;
    }

    if (status === 'error') {
      throw new Error(`GCP job failed: ${error || 'unknown error'}`);
    }
  }

  throw new Error(`Job timed out after ${MAX_WAIT_MS / 60000} minutes`);
}

function _updateJob(localJobId, updates) {
  const job = gcpJobs.get(localJobId);
  if (job) {
    Object.assign(job, updates);
  }
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
