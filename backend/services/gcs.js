import 'dotenv/config';
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
  const isCloudStorageExplicit = process.env.ENABLE_CLOUD_STORAGE === 'true' || process.env.USE_GCS === 'true';
  if (process.env.K_SERVICE || isCloudStorageExplicit) {
    const storageOptions = { projectId: PROJECT_ID };
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    storage = new Storage(storageOptions);
    useLocalFiles = false;
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
   * Generates a signed URL for direct browser uploads to GCS
   */
  async getSignedUrl(destinationName, contentType) {
    if (useLocalFiles) {
      return null;
    }
    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const destination = destinationName.replace(/\\/g, '/'); // Normalize slashes for GCS
      const [url] = await bucket.file(destination).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: contentType || 'video/mp4'
      });
      return url;
    } catch (err) {
      console.error('[Storage Error] Failed to generate signed URL:', err.message);
      throw err;
    }
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
      const { bucketName, objectName } = this.parseBucketAndObject(gcsUrlOrPath);
      await fs.mkdir(path.dirname(localDestPath), { recursive: true });

      const bucket = storage.bucket(bucketName);
      console.log(`[Storage] Downloading GCS object "${objectName}" from bucket "${bucketName}" to local path: ${localDestPath}`);
      
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
      const { bucketName, objectName } = this.parseBucketAndObject(gcsUrlOrPath);
      const bucket = storage.bucket(bucketName);
      console.log(`[Storage] Deleting object "${objectName}" from GCS bucket "${bucketName}"...`);
      await bucket.file(objectName).delete();
      console.log(`[Storage] Object deleted.`);
      return true;
    } catch (err) {
      if (err.code === 404) {
        console.warn(`[Storage Warning] Object to delete not found in GCS: ${gcsUrlOrPath}`);
        return true;
      }
      console.error(`[Storage Error] Failed to delete file ${gcsUrlOrPath}:`, err.message);
      throw err;
    }
  },

  createReadStream(gcsUrlOrPath, options) {
    if (useLocalFiles) {
      return null;
    }
    const { bucketName, objectName } = this.parseBucketAndObject(gcsUrlOrPath);
    return storage.bucket(bucketName).file(objectName).createReadStream(options);
  },

  async getMetadata(gcsUrlOrPath) {
    if (useLocalFiles) {
      return null;
    }
    const { bucketName, objectName } = this.parseBucketAndObject(gcsUrlOrPath);
    const [metadata] = await storage.bucket(bucketName).file(objectName).getMetadata();
    return metadata;
  },

  parseBucketAndObject(gcsUrlOrPath) {
    if (!gcsUrlOrPath || typeof gcsUrlOrPath !== 'string') {
      return { bucketName: BUCKET_NAME, objectName: gcsUrlOrPath };
    }
    if (gcsUrlOrPath.startsWith('gs://')) {
      const withoutGs = gcsUrlOrPath.substring(5);
      const slashIdx = withoutGs.indexOf('/');
      if (slashIdx !== -1) {
        return {
          bucketName: withoutGs.substring(0, slashIdx),
          objectName: withoutGs.substring(slashIdx + 1)
        };
      }
    }
    if (gcsUrlOrPath.startsWith('http')) {
      try {
        const urlObj = new URL(gcsUrlOrPath);
        const pathDecoded = decodeURIComponent(urlObj.pathname).replace(/^\//, '');
        const slashIdx = pathDecoded.indexOf('/');
        if (slashIdx !== -1) {
          return {
            bucketName: pathDecoded.substring(0, slashIdx),
            objectName: pathDecoded.substring(slashIdx + 1)
          };
        }
      } catch (_) {}
    }
    return { bucketName: BUCKET_NAME, objectName: gcsUrlOrPath };
  },

  parseObjectName(gcsUrlOrPath) {
    return this.parseBucketAndObject(gcsUrlOrPath).objectName;
  },

  /**
   * Background upload of a local file to GCS without blocking local editing
   */
  async uploadInBackground(localFilePath, destinationName) {
    if (useLocalFiles || !storage) return null;
    setTimeout(async () => {
      try {
        console.log(`[Storage Hybrid Sync] Uploading ${localFilePath} to cloud storage in background as "${destinationName}"...`);
        await this.uploadFile(localFilePath, destinationName);
        console.log(`[Storage Hybrid Sync] Background cloud upload complete: ${destinationName}`);
      } catch (err) {
        console.warn(`[Storage Hybrid Sync Warning] Background cloud upload failed for ${destinationName}:`, err.message);
      }
    }, 100);
  },

  /**
   * Syncs a remote GCS clip to local Mac disk if missing locally
   */
  async ensureLocalCopy(gcsUrlOrPath, localDestPath) {
    if (existsSync(localDestPath)) {
      try {
        const stat = await fs.stat(localDestPath);
        if (stat.size > 0) {
          return localDestPath;
        }
      } catch (_) {}
    }

    if (useLocalFiles || !storage) {
      return localDestPath;
    }

    try {
      // Check if file already exists with same size locally before downloading
      const { bucketName, objectName } = this.parseBucketAndObject(gcsUrlOrPath);
      try {
        const metadata = await this.getMetadata(gcsUrlOrPath);
        if (metadata && metadata.size && existsSync(localDestPath)) {
          const localStat = await fs.stat(localDestPath);
          if (parseInt(metadata.size, 10) === localStat.size) {
            console.log(`[Storage Hybrid Sync] File "${path.basename(localDestPath)}" already exists on Mac disk with identical size (${localStat.size} bytes). Skipping download!`);
            return localDestPath;
          }
        }
      } catch (_) {}

      console.log(`[Storage Hybrid Sync] Downloading "${objectName}" from GCS to Mac disk cache: ${localDestPath}...`);
      await this.downloadFile(gcsUrlOrPath, localDestPath);
      console.log(`[Storage Hybrid Sync] Successfully cached ${path.basename(localDestPath)} on Mac disk!`);
      return localDestPath;
    } catch (err) {
      console.warn(`[Storage Hybrid Sync Warning] Failed to cache ${gcsUrlOrPath} locally:`, err.message);
      return null;
    }
  }
};
