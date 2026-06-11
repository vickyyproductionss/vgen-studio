import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { dbService } from '../services/firestore.js';
import { gcsService } from '../services/gcs.js';

// Setup local environment variables for the credentials file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const credsPath = path.join(rootDir, 'flowsocial-498207-4dfe693ebf66.json');

// Set GCP credentials explicitly if they exist
if (existsSync(credsPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
  console.log(`[Test] Setting GOOGLE_APPLICATION_CREDENTIALS to: ${credsPath}`);
} else {
  console.warn(`[Test Warning] Credentials file not found at ${credsPath}. Test will run in local fallback mode if env variables are not set.`);
}

async function runTests() {
  console.log('==================================================');
  console.log(' Starting GCP Integration Verification Test ');
  console.log('==================================================');

  // Verify Services Mode
  console.log(`GCS Enabled: ${gcsService.isGcsEnabled()}`);
  console.log(`GCS Bucket: ${gcsService.getBucketName()}`);
  
  // ----------------------------------------------------
  // Test 1: Firestore Read/Write
  // ----------------------------------------------------
  console.log('\n--- Test 1: Firestore CRUD Operations ---');
  try {
    const testSettings = {
      geminiApiKey: 'test-api-key-' + Date.now(),
      elevenLabsApiKey: 'test-eleven-labs-' + Date.now(),
      defaultOutputDir: '/tmp/test'
    };

    console.log('Saving global settings...');
    const saved = await dbService.saveSettings(testSettings);
    console.log('Saved settings successfully:', saved);

    console.log('Retrieving settings...');
    const retrieved = await dbService.getSettings();
    console.log('Retrieved settings successfully:', retrieved);

    if (retrieved.geminiApiKey === testSettings.geminiApiKey) {
      console.log('✅ Firestore Settings CRUD Test Passed!');
    } else {
      console.error('❌ Firestore Settings CRUD Test Failed: Mismatched API keys.');
    }

    // Clip CRUD Test
    const testClip = {
      id: 'test-clip-' + Date.now(),
      userId: 'test-user',
      path: 'http://example.com/video.mp4',
      name: 'test.mp4',
      thumbnail: 'http://example.com/thumb.jpg',
      duration: 15.5,
      description: 'Testing firestore',
      tags: ['test', 'integration'],
      status: 'analyzing'
    };

    console.log('Saving test clip...');
    await dbService.saveClip(testClip);
    console.log('Clip saved.');

    console.log('Fetching clip by status "analyzing"...');
    const clips = await dbService.getClipsByStatus('analyzing');
    const found = clips.find(c => c.id === testClip.id);
    if (found) {
      console.log('✅ Firestore Clips Status Check Passed!');
    } else {
      console.error('❌ Firestore Clips Status Check Failed: Clip not found in results.');
    }

    console.log('Deleting test clip...');
    await dbService.deleteClip(testClip.id);
    console.log('✅ Firestore Clips Delete Passed!');

  } catch (err) {
    console.error('❌ Firestore Test Failed with error:', err);
  }

  // ----------------------------------------------------
  // Test 2: GCS Upload/Download/Delete
  // ----------------------------------------------------
  console.log('\n--- Test 2: GCS File Storage Operations ---');
  const tempTestFile = path.join(__dirname, 'test_sample.txt');
  const tempDownloadFile = path.join(__dirname, 'test_sample_downloaded.txt');
  
  try {
    // Create a local sample file
    const sampleContent = `VGEN-STUDIO GCP INTEGRATION TEST FILE\nTimestamp: ${new Date().toISOString()}`;
    await fs.writeFile(tempTestFile, sampleContent, 'utf-8');
    console.log(`Created local sample file: ${tempTestFile}`);

    // Upload to GCS
    const destination = `tests/test_${Date.now()}.txt`;
    console.log(`Uploading file to GCS destination: ${destination}`);
    const gcsUrl = await gcsService.uploadFile(tempTestFile, destination);
    console.log(`✅ Upload Succeeded. File URL: ${gcsUrl}`);

    // Download from GCS
    console.log(`Downloading file back to local path: ${tempDownloadFile}`);
    await gcsService.downloadFile(gcsUrl, tempDownloadFile);
    
    const downloadedContent = await fs.readFile(tempDownloadFile, 'utf-8');
    if (downloadedContent === sampleContent) {
      console.log('✅ GCS Download Content Matches Original File!');
    } else {
      console.error('❌ GCS Download Content Mismatch!');
    }

    // Delete from GCS
    console.log(`Deleting file from GCS...`);
    await gcsService.deleteFile(gcsUrl);
    console.log('✅ GCS Delete Operation Succeeded!');

  } catch (err) {
    console.error('❌ GCS Operations Failed with error:', err);
  } finally {
    // Clean up local test files
    try {
      if (existsSync(tempTestFile)) await fs.unlink(tempTestFile);
      if (existsSync(tempDownloadFile)) await fs.unlink(tempDownloadFile);
      console.log('\nCleaned up local temporary test files.');
    } catch (_) {}
  }

  console.log('\n==================================================');
  console.log(' Verification Test Complete ');
  console.log('==================================================');
}

runTests().catch(console.error);
