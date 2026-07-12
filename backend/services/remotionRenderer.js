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
    // Disable telemetry warnings during headless bundling
    enableAutoplay: false,
  });
  
  console.log(`[Remotion Renderer] Bundle created at: ${cachedBundleLocation}`);
  return cachedBundleLocation;
}

/**
 * Headlessly renders a React-based video composition to an MP4 output file.
 */
export async function renderRemotionVideo(projectState, outputFilePath, progressCallback) {
  try {
    const bundleLocation = await getBundle();
    
    // Calculate total frames based on the last scene's end time
    const scenes = projectState.scenes || [];
    const lastScene = scenes[scenes.length - 1];
    const totalDuration = lastScene ? lastScene.end_time : 30; // fallback to 30s
    const fps = 30;
    const durationInFrames = Math.max(1, Math.round(totalDuration * fps));

    console.log(`[Remotion Renderer] Rendering VideoReel composition: duration=${totalDuration.toFixed(2)}s (${durationInFrames} frames)`);

    // Determine width and height based on aspect ratio and resolution
    const resLabel = (projectState.exportResolution || '1080p').toLowerCase();
    let width = 1080;
    let height = 1920;
    if (projectState.aspectRatio === '16:9') {
      if (resLabel === '4k') {
        width = 3840;
        height = 2160;
      } else if (resLabel === '2k') {
        width = 2560;
        height = 1440;
      } else {
        width = 1920;
        height = 1080;
      }
    } else if (projectState.aspectRatio === '1:1') {
      if (resLabel === '4k') {
        width = 2160;
        height = 2160;
      } else if (resLabel === '2k') {
        width = 1440;
        height = 1440;
      } else {
        width = 1080;
        height = 1080;
      }
    } else {
      if (resLabel === '4k') {
        width = 2160;
        height = 3840;
      } else if (resLabel === '2k') {
        width = 1440;
        height = 2560;
      } else {
        width = 1080;
        height = 1920;
      }
    }

    // Select the VideoReel composition in the bundle
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'VideoReel',
      inputProps: {
        ...projectState,
        isRendering: true,
        baseUrl: 'http://localhost:8000', // ensure assets resolve to local express backend during headless render
      },
    });

    // Overwrite default composition parameters dynamically
    composition.durationInFrames = durationInFrames;
    composition.fps = fps;
    composition.width = width;
    composition.height = height;

    console.log(`[Remotion Renderer] Starting media render: ${outputFilePath}`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      outputLocation: outputFilePath,
      codec: 'h264',
      crf: 18,
      jpegQuality: 90,
      pixelFormat: 'yuv420p',
      // Limit to 1 concurrent Chrome tab to prevent OOM on Cloud Run (8GB limit).
      // Remotion defaults to CPU count (4), which causes 4 parallel tabs to exceed memory.
      concurrency: 1,
      inputProps: {
        ...projectState,
        isRendering: true,
        baseUrl: 'http://localhost:8000',
      },
      // Give each frame-fetch up to 2 minutes before timing out (default is 30s,
      // which is too short when seeking through large or slow-loading clips)
      timeoutInMilliseconds: 120000,
      // Allow the headless Chromium renderer to make cross-origin requests
      // to the local Express backend at localhost:8000
      chromiumOptions: {
        disableWebSecurity: true,
      },
      onProgress: ({ progress }) => {
        // progress is 0.0 to 1.0
        if (progressCallback) {
          progressCallback(progress);
        }
      },
    });

    console.log(`[Remotion Renderer] Render completed successfully: ${outputFilePath}`);
    return true;

  } catch (err) {
    console.error('[Remotion Renderer] Headless render failed:', err);
    throw err;
  }
}
