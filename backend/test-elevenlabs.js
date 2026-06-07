import { generateSpeech } from './services/elevenlabs.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testElevenLabs() {
  console.log('=== ELEVENLABS DIAGNOSTIC TEST (EXACT USER SCRIPT) ===');
  
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
    const apiKey = db.settings.elevenLabsApiKey;
    
    const vickyVoiceId = '7GpRXu1g6xcVlDMoklH3';
    
    const scriptText = `India mein powerlifting start karne ki soch rahe ho? Platform par step karne se pehle ye 5 cheezein aapko zaroor pata honi chahiye.
Number One: Ye Olympic weightlifting nahi hai. Powerlifting strictly teen specific lifts par focus karti hai—the Squat, the Bench Press, aur the Deadlift.
Number Two: Apne federations ko jaano. "Powerlifting India" official IPF affiliate hai, but country mein aur bhi kai tested aur untested leagues hain, toh kisi bhi meet ke liye sign up karne se pehle apni research zaroor karein.
Number Three: Gear matter karta hai. Wo squishy running shoes chhoro aur ek solid flat-soled shoe, ek sturdy 10 ya 13-millimeter ka leather belt, aur supportive knee sleeves mein early on invest karo.
Number Four: Ego lifting se sirf injury hogi. Bar par heavy numbers chase karne se pehle apni technique, breathing, aur setups ko master karne par focus karo.`;

    const outputFilePath = path.join(__dirname, 'uploads', 'generated', 'test_vicky_exact_script.mp3');
    
    console.log(`Generating speech with voice: ${vickyVoiceId}`);
    console.log(`Script length: ${scriptText.length} characters.`);
    
    await generateSpeech(scriptText, vickyVoiceId, apiKey, outputFilePath);
    console.log('SUCCESS! Generated exact script.');
    
  } catch (error) {
    console.error('==================================');
    console.error('✗ ELEVENLABS CALL FAILED!');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('==================================');
  }
}

testElevenLabs();
