import { Storage } from '@google-cloud/storage';
import { existsSync, createWriteStream, createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'flowsocial-498207';
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'flowsocial-vgen-studio-assets';

let storage = null;
let useLocalFiles = false;

// Check if we should use GCP GCS
try {
  if (process.env.K_SERVICE) {
    storage = new Storage({ projectId: PROJECT_ID });
    console.log(`[Storage] Initialized Google Cloud Storage for bucket "${BUCKET_NAME}".`);
  } else {
    console.log('[Storage] Running in local fallback mode (local filesystem) because K_SERVICE is not defined.');
    useLocalFiles = true;
  }
} catch (err) {
  console.warn('[Storage] Failed to initialize Cloud Storage client:', err.message);
  console.log('[Storage] Falling back to local filesystem.');
  useLocalFiles = true;
}

/**
 * Normalizes absolute path in case GCS is disabled
 */
function getLocalUploadsPath(filePath) {
  if (!filePath) return filePath;
  const relativePart = filePath.includes('uploads/') ? filePath.substring(filePath.indexOf('uploads/')) : filePath;
  return path.resolve(__dirname, '..', relativePart);
}

export const gcsService = {
  isGcsEnabled() {
    return !useLocalFiles;
  },

  getBucketName() {
    return BUCKET_NAME;
  },

  /**
   * Uploads a file to Cloud Storage (or keeps it local if GCS is disabled)
   * @param {string} localFilePath - Path to the file on local disk
   * @param {string} destinationName - Folder/filename in the GCS bucket (e.g., 'clips/clip-1.mp4')
   * @returns {Promise<string>} Public or Signed URL of the uploaded file
   */
  async uploadFile(localFilePath, destinationName) {
    if (useLocalFiles) {
      console.log(`[Storage Mock] Keeping file local: ${localFilePath}`);
      // Return relative web path (e.g. /uploads/clips/xyz.mp4)
      const relativePart = localFilePath.includes('uploads/') 
        ? localFilePath.substring(localFilePath.indexOf('uploads/')) 
        : localFilePath;
      return `/${relativePart.replace(/\\/g, '/')}`;
    }

    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const destination = destinationName.replace(/\\/g, '/'); // Normalize slashes for GCS
      
      console.log(`[Storage] Uploading ${localFilePath} to GCS as ${destination}...`);
      await bucket.upload(localFilePath, {
        destination,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        }
      });
      
      // Use public URL (bucket has allUsers objectViewer access)
      const url = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;

      console.log(`[Storage] Upload completed. URL: ${url}`);
      return url;
    } catch (err) {
      console.error('[Storage Error] Failed to upload file to GCS:', err.message);
      throw err;
    }
  },

  /**
   * Downloads a file from GCS to local disk. Used to stage files in /tmp before running FFmpeg.
   * @param {string} gcsUrlOrPath - The GCS URI (gs://...) or Signed/Public URL or object path (e.g. 'clips/clip-1.mp4')
   * @param {string} localDestPath - Path on the container's disk to write the file
   */
  async downloadFile(gcsUrlOrPath, localDestPath) {
    // If running in local mode, we just copy or resolve the local file
    if (useLocalFiles) {
      const sourcePath = getLocalUploadsPath(gcsUrlOrPath);
      if (sourcePath !== localDestPath && existsSync(sourcePath)) {
        await fs.mkdir(path.dirname(localDestPath), { recursive: true });
        await fs.copyFile(sourcePath, localDestPath);
      }
      return localDestPath;
    }

    try {
      // Parse object name from URL or GS URI
      let objectName = gcsUrlOrPath;
      if (gcsUrlOrPath.startsWith('gs://')) {
        objectName = gcsUrlOrPath.replace(`gs://${BUCKET_NAME}/`, '');
      } else if (gcsUrlOrPath.includes('storage.googleapis.com')) {
        const parts = gcsUrlOrPath.split(`${BUCKET_NAME}/`);
        if (parts.length > 1) {
          objectName = parts[1].split('?')[0];
        }
      } else if (gcsUrlOrPath.startsWith('http')) {
        // Handle signed URLs by parsing the path between bucket name and query params
        const urlObj = new URL(gcsUrlOrPath);
        const pathDecoded = decodeURIComponent(urlObj.pathname);
        const bucketMatchIndex = pathDecoded.indexOf(`/${BUCKET_NAME}/`);
        if (bucketMatchIndex !== -1) {
          objectName = pathDecoded.substring(bucketMatchIndex + BUCKET_NAME.length + 2);
        }
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(localDestPath), { recursive: true });

      const bucket = storage.bucket(BUCKET_NAME);
      console.log(`[Storage] Downloading GCS object "${objectName}" to local path: ${localDestPath}`);
      
      await bucket.file(objectName).download({ destination: localDestPath });
      console.log(`[Storage] Download completed successfully.`);
      return localDestPath;
    } catch (err) {
      console.error(`[Storage Error] Failed to download GCS object "${gcsUrlOrPath}":`, err.message);
      throw err;
    }
  },

  /**
   * Deletes a file from GCS (or local file if GCS is disabled)
   */
  async deleteFile(gcsUrlOrPath) {
    if (useLocalFiles) {
      const localPath = getLocalUploadsPath(gcsUrlOrPath);
      if (existsSync(localPath)) {
        try {
          await fs.unlink(localPath);
          console.log(`[Storage Mock] Deleted local file: ${localPath}`);
        } catch (err) {
          console.error(`[Storage Mock Error] Failed to delete: ${localPath}`, err.message);
        }
      }
      return true;
    }

    try {
      let objectName = gcsUrlOrPath;
      if (gcsUrlOrPath.startsWith('gs://')) {
        objectName = gcsUrlOrPath.replace(`gs://${BUCKET_NAME}/`, '');
      } else if (gcsUrlOrPath.includes('storage.googleapis.com')) {
        const parts = gcsUrlOrPath.split(`${BUCKET_NAME}/`);
        if (parts.length > 1) {
          objectName = parts[1].split('?')[0];
        }
      } else if (gcsUrlOrPath.startsWith('http')) {
        const urlObj = new URL(gcsUrlOrPath);
        const pathDecoded = decodeURIComponent(urlObj.pathname);
        const bucketMatchIndex = pathDecoded.indexOf(`/${BUCKET_NAME}/`);
        if (bucketMatchIndex !== -1) {
          objectName = pathDecoded.substring(bucketMatchIndex + BUCKET_NAME.length + 2);
        }
      }

      const bucket = storage.bucket(BUCKET_NAME);
      console.log(`[Storage] Deleting object "${objectName}" from GCS bucket "${BUCKET_NAME}"...`);
      await bucket.file(objectName).delete();
      console.log(`[Storage] Object deleted.`);
      return true;
    } catch (err) {
      // If it's a 404 (file not found), ignore the error
      if (err.code === 404) {
        console.warn(`[Storage Warning] Object to delete not found in GCS: ${gcsUrlOrPath}`);
        return true;
      }
      console.error(`[Storage Error] Failed to delete file ${gcsUrlOrPath}:`, err.message);
      throw err;
    }
  }
};
