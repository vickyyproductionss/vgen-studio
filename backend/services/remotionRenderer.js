import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

let cachedBundleLocation = null;

/**
 * Creates/retrieves the cached webpack bundle location for the Remotion Root.
 */
async function getBundle() {
  if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    return cachedBundleLocation;
  }
  
  let entryPoint = path.resolve(process.cwd(), '../src/remotion/Root.tsx');
  if (!fs.existsSync(entryPoint)) {
    entryPoint = path.resolve(process.cwd(), './src/remotion/Root.tsx');
  }
  console.log(`[Remotion Renderer] Bundling entry point: ${entryPoint}`);
  
  cachedBundleLocation = await bundle({
    entryPoint,
    enableAutoplay: false,
  });
  
  console.log(`[Remotion Renderer] Bundle created at: ${cachedBundleLocation}`);
  return cachedBundleLocation;
}

/**
 * Resolves width/height from projectState aspect ratio and export resolution.
 */
function getDimensions(projectState) {
  const resLabel = (projectState.exportResolution || '1080p').toLowerCase();
  let width = 1080;
  let height = 1920;
  if (projectState.aspectRatio === '16:9') {
    if (resLabel === '4k')      { width = 3840; height = 2160; }
    else if (resLabel === '2k') { width = 2560; height = 1440; }
    else                        { width = 1920; height = 1080; }
  } else if (projectState.aspectRatio === '1:1') {
    if (resLabel === '4k')      { width = 2160; height = 2160; }
    else if (resLabel === '2k') { width = 1440; height = 1440; }
    else                        { width = 1080; height = 1080; }
  } else {
    if (resLabel === '4k')      { width = 2160; height = 3840; }
    else if (resLabel === '2k') { width = 1440; height = 2560; }
    else                        { width = 1080; height = 1920; }
  }
  return { width, height };
}

/**
 * Shared renderMedia options to ensure consistent quality and stability.
 */
function sharedRenderOptions(composition, bundleLocation, projectState) {
  return {
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    crf: 18,
    jpegQuality: 90,
    pixelFormat: 'yuv420p',
    // Limit to 1 Chrome tab to prevent OOM on Cloud Run (10 GiB limit)
    concurrency: 1,
    inputProps: {
      ...projectState,
      isRendering: true,
      baseUrl: 'http://localhost:8000',
    },
    // 2-minute timeout per frame-fetch for large/slow clips
    timeoutInMilliseconds: 120000,
    chromiumOptions: {
      disableWebSecurity: true,
    },
  };
}

/**
 * Headlessly renders a React-based video composition to an MP4 output file.
 * Single-pass render (legacy fallback, use renderRemotionVideoChunked for long videos).
 */
export async function renderRemotionVideo(projectState, outputFilePath, progressCallback) {
  try {
    const bundleLocation = await getBundle();
    
    const scenes = projectState.scenes || [];
    const lastScene = scenes[scenes.length - 1];
    const totalDuration = lastScene ? lastScene.end_time : 30;
    const fps = 30;
    const durationInFrames = Math.max(1, Math.round(totalDuration * fps));

    console.log(`[Remotion Renderer] Rendering VideoReel composition: duration=${totalDuration.toFixed(2)}s (${durationInFrames} frames)`);

    const { width, height } = getDimensions(projectState);

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'VideoReel',
      inputProps: {
        ...projectState,
        isRendering: true,
        baseUrl: 'http://localhost:8000',
      },
    });

    composition.durationInFrames = durationInFrames;
    composition.fps = fps;
    composition.width = width;
    composition.height = height;

    console.log(`[Remotion Renderer] Starting media render: ${outputFilePath}`);

    await renderMedia({
      ...sharedRenderOptions(composition, bundleLocation, projectState),
      outputLocation: outputFilePath,
      onProgress: ({ progress }) => {
        if (progressCallback) progressCallback(progress);
      },
    });

    console.log(`[Remotion Renderer] Render completed successfully: ${outputFilePath}`);
    return true;

  } catch (err) {
    console.error('[Remotion Renderer] Headless render failed:', err);
    throw err;
  }
}

/**
 * Chunked renderer — splits the video into 3-second segments (90 frames each),
 * renders each chunk independently, then returns the array of chunk file paths
 * for the caller to concatenate via FFmpeg.
 *
 * Benefits:
 * - Each chunk uses ~25% of the memory of a full render → prevents OOM crashes
 * - Progress is granular (chunk 1/5, chunk 2/5...)
 * - onChunkDone callback lets caller upload chunks to GCS immediately
 *
 * @param {object}   projectState       - Remotion inputProps
 * @param {string}   chunkDir           - Directory to write chunk_N.mp4 files into
 * @param {string}   jobId              - Used to name chunk files uniquely
 * @param {function} progressCallback   - Called with 0.0–1.0 overall progress
 * @param {function} onChunkDone        - async (chunkIndex, totalChunks, chunkPath) called after each chunk
 * @returns {string[]} Array of chunk file paths in order
 */
export async function renderRemotionVideoChunked(projectState, chunkDir, jobId, progressCallback, onChunkDone) {
  const CHUNK_FRAMES = 90; // 3 seconds at 30fps

  const bundleLocation = await getBundle();

  const scenes = projectState.scenes || [];
  const lastScene = scenes[scenes.length - 1];
  const totalDuration = lastScene ? lastScene.end_time : 30;
  const fps = 30;
  const durationInFrames = Math.max(1, Math.round(totalDuration * fps));

  const { width, height } = getDimensions(projectState);

  console.log(`[Remotion Renderer] Chunked render: duration=${totalDuration.toFixed(2)}s (${durationInFrames} frames), chunk size=${CHUNK_FRAMES} frames`);

  // Select composition once — reused across all chunks
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'VideoReel',
    inputProps: {
      ...projectState,
      isRendering: true,
      baseUrl: 'http://localhost:8000',
    },
  });
  composition.durationInFrames = durationInFrames;
  composition.fps = fps;
  composition.width = width;
  composition.height = height;

  const numChunks = Math.ceil(durationInFrames / CHUNK_FRAMES);
  const chunkPaths = [];

  fs.mkdirSync(chunkDir, { recursive: true });

  for (let i = 0; i < numChunks; i++) {
    const startFrame = i * CHUNK_FRAMES;
    const endFrame = Math.min((i + 1) * CHUNK_FRAMES - 1, durationInFrames - 1);
    const chunkPath = path.join(chunkDir, `chunk_${jobId}_${i}.mp4`);

    // Resume: skip if chunk file already exists (from a previous crashed run in same instance)
    if (fs.existsSync(chunkPath)) {
      console.log(`[Remotion Renderer] Chunk ${i + 1}/${numChunks} already exists — skipping (resume)`);
      chunkPaths.push(chunkPath);
      if (progressCallback) progressCallback((i + 1) / numChunks);
      if (onChunkDone) await onChunkDone(i, numChunks, chunkPath, true /* skipped */);
      continue;
    }

    console.log(`[Remotion Renderer] Rendering chunk ${i + 1}/${numChunks} (frames ${startFrame}–${endFrame})...`);

    await renderMedia({
      ...sharedRenderOptions(composition, bundleLocation, projectState),
      outputLocation: chunkPath,
      frameRange: [startFrame, endFrame],
      onProgress: ({ progress }) => {
        if (progressCallback) {
          const overall = (i + progress) / numChunks;
          progressCallback(overall);
        }
      },
    });

    console.log(`[Remotion Renderer] Chunk ${i + 1}/${numChunks} complete: ${chunkPath}`);
    chunkPaths.push(chunkPath);

    if (onChunkDone) await onChunkDone(i, numChunks, chunkPath, false /* newly rendered */);
  }

  console.log(`[Remotion Renderer] All ${numChunks} chunks rendered.`);
  return chunkPaths;
}
