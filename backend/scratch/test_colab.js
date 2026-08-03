import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getCustomAgent } from '../services/customAgent.js';

dotenv.config({ path: '/Volumes/1TB/WebProjects/VideoGenerator/backend/.env' });

const AVATAR_API_URL = process.env.AVATAR_API_URL || 'https://forever-hat-too-bases.trycloudflare.com';
const agent = getCustomAgent(AVATAR_API_URL);
const AVATAR_PATH = '/Volumes/1TB/WebProjects/VideoGenerator/backend/presets/avatars/avatar_fitness.png';
const AUDIO_PATH = '/Volumes/1TB/WebProjects/VideoGenerator/backend/uploads/generated/voiceover_trimmed_10s.wav';
const OUTPUT_PATH = '/Volumes/1TB/WebProjects/VideoGenerator/backend/uploads/generated/test_colab_result.mp4';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFile(localPath, type) {
  const endpoint = `${AVATAR_API_URL}/upload/${type}`;
  console.log(`Uploading ${type} file: ${localPath} to ${endpoint}...`);
  
  const form = new FormData();
  form.append('file', fs.createReadStream(localPath), {
    filename: path.basename(localPath),
    contentType: type === 'avatar' ? 'image/png' : 'audio/wav',
  });

  const res = await fetch(endpoint, { method: 'POST', body: form, agent });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log(`Uploaded! GCS URI: ${data.gcsUri}`);
  return data.gcsUri;
}

async function startJob(avatarUri, audioUri) {
  const endpoint = `${AVATAR_API_URL}/generate`;
  console.log(`Starting lip-sync job at ${endpoint}...`);
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarGcsUri: avatarUri,
      audioGcsUri: audioUri,
      options: {
        bbox_shift: -7,
        use_float16: true
      }
    }),
    agent
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to start job (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log(`Job started! Job ID: ${data.jobId}`);
  return data.jobId;
}

async function pollStatus(jobId) {
  const endpoint = `${AVATAR_API_URL}/status/${jobId}`;
  console.log(`Polling job status for ${jobId}...`);
  
  while (true) {
    const res = await fetch(endpoint, { agent });
    if (!res.ok) {
      console.warn(`Status poll returned status: ${res.status}`);
      await sleep(3000);
      continue;
    }

    const data = await res.json();
    console.log(`[Status] status: ${data.status} | stage: ${data.stage} | progress: ${data.progress}%`);
    
    if (data.status === 'done') {
      return;
    }
    if (data.status === 'error') {
      throw new Error(`Job failed: ${data.error}`);
    }

    await sleep(3000);
  }
}

async function getResult(jobId) {
  const endpoint = `${AVATAR_API_URL}/result/${jobId}`;
  console.log(`Fetching result video URL for ${jobId}...`);
  
  const res = await fetch(endpoint, { agent });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get result (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log(`Result Video URL: ${data.videoUrl}`);
  return data.videoUrl;
}

async function downloadVideo(url, outputPath) {
  console.log(`Downloading video from ${url} to ${outputPath}...`);
  const res = await fetch(url, { agent });
  if (!res.ok) {
    throw new Error(`Failed to download video (${res.status})`);
  }

  const fileStream = fs.createWriteStream(outputPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  console.log('Video downloaded and saved successfully!');
}

async function run() {
  try {
    const avatarUri = await uploadFile(AVATAR_PATH, 'avatar');
    const audioUri = await uploadFile(AUDIO_PATH, 'audio');
    const jobId = await startJob(avatarUri, audioUri);
    await pollStatus(jobId);
    const videoUrl = await getResult(jobId);
    await downloadVideo(videoUrl, OUTPUT_PATH);
    console.log('--- TEST COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    console.error('--- TEST FAILED ---');
    console.error(error);
  }
}

run();
