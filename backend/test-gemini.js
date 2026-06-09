import dotenv from 'dotenv';
import { analyzeVideo } from './services/gemini.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });


async function testGemini() {
  console.log('=== GEMINI API DIAGNOSTIC TEST ===');
  
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
    const apiKey = db.settings.geminiApiKey;
    const hasGcpCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    console.log(`Configured Gemini API Key: "${apiKey}"`);
    console.log(`Configured GOOGLE_APPLICATION_CREDENTIALS: "${hasGcpCreds || ''}"`);
    
    if (!apiKey && !hasGcpCreds) {
      console.error('Error: Neither Gemini API key in db.json nor GOOGLE_APPLICATION_CREDENTIALS in environment is configured!');
      return;
    }
    
    if (apiKey && !apiKey.startsWith('AIzaSy') && !hasGcpCreds) {
      console.warn('WARNING: Your Gemini API Key does not start with "AIzaSy". Standard Google Gemini keys always start with "AIzaSy".');
    }
    
    if (db.clips.length === 0) {
      console.error('Error: No clips found in db.json to test with!');
      return;
    }
    
    const testClip = db.clips[0];
    console.log(`Testing with clip: ${testClip.name}`);
    console.log(`Path: ${testClip.path}`);
    
    console.log('Sending upload and analysis request to Gemini...');
    const result = await analyzeVideo(testClip.path, apiKey);
    console.log('==================================');
    console.log('SUCCESS!');
    console.log('Analysis Result:', JSON.stringify(result, null, 2));
    console.log('==================================');
    
  } catch (error) {
    console.error('==================================');
    console.error('✗ GEMINI API CALL FAILED!');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('==================================');
  }
}

testGemini();
