import fs from 'fs';
import { pipeline } from 'stream/promises';

/**
 * Fetches available voices from ElevenLabs API
 */
export async function getVoices(apiKey) {
  if (!apiKey) {
    throw new Error('ElevenLabs API Key is required');
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
      'accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  // Return simplified voice list
  return data.voices.map(voice => ({
    id: voice.voice_id,
    name: voice.name,
    category: voice.category,
    previewUrl: voice.preview_url,
    description: voice.description || voice.labels?.description || ''
  }));
}

export async function generateSpeech(text, voiceId, apiKey, outputFilePath) {
  if (!apiKey) {
    throw new Error('ElevenLabs API Key is required');
  }
  if (!voiceId) {
    throw new Error('Voice ID is required');
  }

  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Generating ElevenLabs speech with voice ${voiceId} (attempt ${attempt}/${maxAttempts})...`);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.8,
            similarity_boost: 0.95,
            style: 0.95,
            use_speaker_boost: false,
            speed: 1.1
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS failed (${response.status}): ${errorText}`);
      }

      // Use pipeline to stream response directly to disk
      const fileStream = fs.createWriteStream(outputFilePath);
      await pipeline(response.body, fileStream);
      
      console.log(`ElevenLabs audio saved successfully to: ${outputFilePath}`);
      return outputFilePath;

    } catch (error) {
      lastError = error;
      console.warn(`ElevenLabs generation attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      if (attempt < maxAttempts) {
        const delay = attempt * 1500;
        console.log(`Waiting ${delay}ms before retrying ElevenLabs...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
