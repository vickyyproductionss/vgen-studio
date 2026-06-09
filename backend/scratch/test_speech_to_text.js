import speech from '@google-cloud/speech';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

const audioPath = "/Volumes/1TB/WebProjects/VideoGenerator/backend/uploads/generated/voiceover_13653f8d-d8b7-4518-9732-066c942dec12.mp3";
const tempWavPath = "/Volumes/1TB/WebProjects/VideoGenerator/backend/scratch/temp_test.wav";

async function convertToMonoPcmWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-ac', '1',
      '-ar', '16000',
      '-acodec', 'pcm_s16le',
      outputPath
    ]);

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg conversion failed with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}

async function main() {
  try {
    console.log("Checking if audio file exists:", fs.existsSync(audioPath));
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Test audio file not found at ${audioPath}`);
    }

    console.log("Converting to mono WAV...");
    await convertToMonoPcmWav(audioPath, tempWavPath);
    console.log("WAV created at:", tempWavPath);

    const client = new speech.SpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    const fileBuffer = fs.readFileSync(tempWavPath);
    const audioBytes = fileBuffer.toString('base64');

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        alternativeLanguageCodes: ['hi-IN', 'en-IN'],
        enableWordTimeOffsets: true,
      }
    };

    console.log("Sending recognize request to GCP Speech-to-Text...");
    const [response] = await client.recognize(request);
    
    console.log("Response results:");
    if (response.results) {
      for (const result of response.results) {
        const alternative = result.alternatives[0];
        console.log(`Transcript: "${alternative.transcript}"`);
        console.log("Words:");
        for (const wordInfo of alternative.words || []) {
          const start = parseInt(wordInfo.startTime.seconds || 0, 10) + (wordInfo.startTime.nanos || 0) / 1000000000;
          const end = parseInt(wordInfo.endTime.seconds || 0, 10) + (wordInfo.endTime.nanos || 0) / 1000000000;
          console.log(`  - ${wordInfo.word}: ${start.toFixed(3)}s to ${end.toFixed(3)}s`);
        }
      }
    } else {
      console.log("No results found.");
    }
  } catch (err) {
    console.error("Error running test:", err);
  } finally {
    if (fs.existsSync(tempWavPath)) {
      fs.unlinkSync(tempWavPath);
    }
  }
}

main();
