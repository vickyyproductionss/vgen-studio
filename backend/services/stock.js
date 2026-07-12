import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from './firestore.js';
import { getVideoDuration, generateThumbnail } from './video.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIPS_DIR = path.resolve(__dirname, '..', 'uploads', 'clips');
const THUMBNAILS_DIR = path.resolve(__dirname, '..', 'uploads', 'thumbnails');

// Ensure directories exist
if (!fs.existsSync(CLIPS_DIR)) {
  fs.mkdirSync(CLIPS_DIR, { recursive: true });
}
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

/**
 * Searches Pexels Video API
 */
async function searchPexels(query, apiKey, orientation = 'landscape') {
  if (!apiKey) {
    console.warn('[Stock Service] Pexels API Key is missing.');
    return [];
  }

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=${orientation}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: apiKey }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pexels API error: ${res.statusText} (${text})`);
    }
    const data = await res.json();
    return (data.videos || []).map(video => {
      // Find the best quality video file (highest resolution MP4 preferred)
      const files = video.video_files || [];
      const mp4Files = files.filter(f => f.file_type === 'video/mp4');
      const sortedFiles = mp4Files.length > 0 ? mp4Files : files;
      sortedFiles.sort((a, b) => {
        const areaA = (a.width || 0) * (a.height || 0);
        const areaB = (b.width || 0) * (b.height || 0);
        return areaB - areaA;
      });
      const bestFile = sortedFiles[0];

      return {
        id: `pexels_${video.id}`,
        source: 'pexels',
        url: bestFile?.link,
        duration: video.duration,
        width: video.width,
        height: video.height,
        tags: video.tags || [],
        description: `Pexels video by ${video.user?.name || 'Unknown'}`
      };
    }).filter(v => v.url);
  } catch (err) {
    console.error('[Stock Service] Pexels search failed:', err.message);
    return [];
  }
}

/**
 * Searches Pixabay Video API
 */
async function searchPixabay(query, apiKey, orientation = 'landscape') {
  if (!apiKey) {
    console.warn('[Stock Service] Pixabay API Key is missing.');
    return [];
  }

  const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=10`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Pixabay API error: ${res.statusText}`);
    }
    const data = await res.json();
    return (data.hits || []).map(hit => {
      // Find the best quality mp4
      const videosObj = hit.videos || {};
      const videoDetail = videosObj.large || videosObj.medium || videosObj.small || videosObj.tiny;

      return {
        id: `pixabay_${hit.id}`,
        source: 'pixabay',
        url: videoDetail?.url,
        duration: hit.duration,
        width: hit.width,
        height: hit.height,
        tags: (hit.tags || '').split(',').map(t => t.trim()),
        description: `Pixabay video by ${hit.user || 'Unknown'}`
      };
    }).filter(v => {
      if (!v.url) return false;
      // Filter by orientation manually since Pixabay doesn't support orientation query param for videos
      const isPortrait = v.width < v.height;
      if (orientation === 'portrait') return isPortrait;
      return !isPortrait; // landscape or square
    });
  } catch (err) {
    console.error('[Stock Service] Pixabay search failed:', err.message);
    return [];
  }
}

/**
 * Main Search Endpoint (Pexels with Pixabay fallback)
 */
export async function searchStockVideo(query, pexelsKey, pixabayKey, orientation = 'landscape') {
  console.log(`[Stock Service] Searching stock video for: "${query}" (orientation: ${orientation})...`);
  
  // Try Pexels first
  if (pexelsKey) {
    const pexelsResults = await searchPexels(query, pexelsKey, orientation);
    if (pexelsResults.length > 0) {
      console.log(`[Stock Service] Found ${pexelsResults.length} videos on Pexels.`);
      return pexelsResults;
    }
  }

  // Fallback to Pixabay
  if (pixabayKey) {
    const pixabayResults = await searchPixabay(query, pixabayKey, orientation);
    if (pixabayResults.length > 0) {
      console.log(`[Stock Service] Found ${pixabayResults.length} videos on Pixabay.`);
      return pixabayResults;
    }
  }

  console.log('[Stock Service] No stock videos found from Pexels or Pixabay.');
  return [];
}

/**
 * Downloads stock video, creates thumbnail, extracts metadata, saves to database
 */
export async function downloadStockVideo(videoUrl, clipId, userId, description = 'Stock clip') {
  const fileId = clipId || uuidv4();
  const destPath = path.join(CLIPS_DIR, `stock_${fileId}.mp4`);
  const thumbnailFilename = `stock_${fileId}.jpg`;
  const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

  console.log(`[Stock Service] Downloading video from ${videoUrl} to ${destPath}...`);

  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to download stock video: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(destPath, buffer);

  console.log('[Stock Service] Download completed. Extracting metadata...');
  
  const duration = await getVideoDuration(destPath);
  await generateThumbnail(destPath, thumbnailPath);

  const clip = {
    id: fileId,
    userId,
    path: destPath,
    name: `Stock - ${description.substring(0, 20)}`,
    thumbnail: `/uploads/thumbnails/${thumbnailFilename}`,
    duration,
    description: description || 'Downloaded stock clip',
    tags: ['stock_downloaded'],
    status: 'ready'
  };

  await dbService.saveClip(clip);
  console.log(`[Stock Service] Successfully saved stock clip to database. ID: ${fileId}`);
  return clip;
}
