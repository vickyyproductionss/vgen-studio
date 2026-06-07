import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkQuota() {
  console.log('=== ELEVENLABS QUOTA CHECK ===');
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
    const apiKey = db.settings.elevenLabsApiKey;
    
    if (!apiKey) {
      console.log('No ElevenLabs API Key found in settings.');
      return;
    }
    
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.log(`Failed to fetch subscription: ${res.status} - ${text}`);
      return;
    }
    
    const data = await res.json();
    console.log('Character Limit:', data.character_limit);
    console.log('Character Count:', data.character_count);
    console.log('Remaining Characters:', data.character_limit - data.character_count);
    console.log('Tier:', data.tier);
    console.log('Status:', data.status);
  } catch (error) {
    console.error('Error checking quota:', error);
  }
}

checkQuota();
