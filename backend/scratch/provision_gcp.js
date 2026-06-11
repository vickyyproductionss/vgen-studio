import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Storage } from '@google-cloud/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const credsPath = path.join(rootDir, 'flowsocial-498207-4dfe693ebf66.json');

if (existsSync(credsPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
}

const PROJECT_ID = 'flowsocial-498207';
const BUCKET_NAME = 'flowsocial-vgen-studio-assets';

async function main() {
  console.log(`[Provisioning] Connecting to GCP Project: ${PROJECT_ID}`);
  const storage = new Storage({ projectId: PROJECT_ID });

  try {
    console.log(`[Provisioning] Checking if bucket "${BUCKET_NAME}" exists...`);
    const [exists] = await storage.bucket(BUCKET_NAME).exists();
    if (exists) {
      console.log(`[Provisioning] ✅ Bucket "${BUCKET_NAME}" already exists!`);
    } else {
      console.log(`[Provisioning] Bucket does not exist. Attempting to create "${BUCKET_NAME}" in region "us-central1"...`);
      await storage.createBucket(BUCKET_NAME, {
        location: 'us-central1',
        storageClass: 'STANDARD',
      });
      console.log(`[Provisioning] ✅ Bucket "${BUCKET_NAME}" created successfully!`);
    }
  } catch (err) {
    console.error(`[Provisioning Error] Failed to ensure GCS Bucket exists:`, err.message);
    console.log(`\n👉 MANUAL ACTION REQUIRED:`);
    console.log(`1. Visit the Google Cloud Console: https://console.cloud.google.com/storage/browser?project=${PROJECT_ID}`);
    console.log(`2. Click "CREATE BUCKET"`);
    console.log(`3. Name the bucket: "${BUCKET_NAME}"`);
    console.log(`4. Set Location Type: Region, and Location: "us-central1"`);
    console.log(`5. Choose Standard Storage Class and click Create.`);
  }

  console.log('\n--------------------------------------------------');
  console.log('👉 FIRESTORE MANUAL SETUP INSTRUCTIONS:');
  console.log('--------------------------------------------------');
  console.log(`1. Visit: https://console.cloud.google.com/firestore/databases?project=${PROJECT_ID}`);
  console.log('2. Click "CREATE DATABASE"');
  console.log('3. Select "Firestore Native Mode" (Recommended)');
  console.log('4. Choose region "us-central" (or your preferred region) and click Create.');
  console.log('--------------------------------------------------');
}

main().catch(console.error);
