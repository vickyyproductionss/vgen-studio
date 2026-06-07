import { analyzeVideo } from './services/gemini.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testGemini() {
  console.log('=== GEMINI API DIAGNOSTIC TEST ===');
  
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
    const apiKey = db.settings.geminiApiKey;
    
    console.log(`Configured Gemini API Key: "${apiKey}"`);
    if (!apiKey) {
      console.error('Error: Gemini API key is empty in db.json!');
      return;
    }
    
    if (!apiKey.startsWith('AIzaSy')) {
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
