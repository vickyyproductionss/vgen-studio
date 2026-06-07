import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process failed with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}

/**
 * Detect beats in an audio file using PCM energy envelope thresholding.
 * @param {string} audioPath Absolute path to the source audio file.
 * @param {number} threshold Multiplier threshold above local moving average (default 1.4).
 * @returns {Promise<number[]>} Array of timestamps (in seconds) where beats occur.
 */
export async function detectBeats(audioPath, threshold = 1.4, minDistance = 0.4) {
  const tempPcmPath = audioPath + '.temp.pcm';
  
  try {
    console.log(`Decoding audio ${audioPath} to raw PCM...`);
    // 1. Convert audio to raw 16-bit little-endian mono PCM at 22050Hz
    await runFFmpeg([
      '-y',
      '-i', audioPath,
      '-f', 's16le',
      '-ac', '1',
      '-ar', '22050',
      tempPcmPath
    ]);

    // 2. Read the raw PCM data
    const pcmData = await fs.readFile(tempPcmPath);
    
    // Each sample is 16-bit signed integer (2 bytes)
    const samplesCount = Math.floor(pcmData.length / 2);
    // Align buffer to 16-bit boundary if needed by copying to a new TypedArray
    const ab = new ArrayBuffer(pcmData.length);
    const view = new DataView(ab);
    for (let i = 0; i < pcmData.length; i++) {
      view.setUint8(i, pcmData[i]);
    }
    const samples = new Int16Array(ab);

    const sampleRate = 22050;
    // 50ms window size in samples
    const windowSize = Math.floor(sampleRate * 0.05); // 1102 samples
    const stepSize = windowSize; // non-overlapping windows

    // Calculate energy (average absolute amplitude) for each window
    const energies = [];
    const times = [];

    for (let i = 0; i < samples.length; i += stepSize) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < windowSize && (i + j) < samples.length; j++) {
        sum += Math.abs(samples[i + j]);
        count++;
      }
      const energy = count > 0 ? sum / count : 0;
      energies.push(energy);
      // Time in seconds at the center of the window
      const time = (i + count / 2) / sampleRate;
      times.push(time);
    }

    console.log(`Analyzing energy envelope of ${energies.length} windows...`);

    // 3. Peak Detection with Sliding Window Average
    const beats = [];
    // 1.5 seconds sliding window in terms of energies index (1.5 / 0.05 = 30 windows)
    const slideSize = 30; 
    const minDistanceBetweenBeats = minDistance; // seconds (max 150 BPM)
    let lastBeatTime = -minDistanceBetweenBeats;

    for (let i = 0; i < energies.length; i++) {
      const currentEnergy = energies[i];
      const time = times[i];

      // Calculate sliding average energy
      let startIdx = Math.max(0, i - Math.floor(slideSize / 2));
      let endIdx = Math.min(energies.length - 1, i + Math.floor(slideSize / 2));
      let localSum = 0;
      let localCount = 0;
      for (let k = startIdx; k <= endIdx; k++) {
        localSum += energies[k];
        localCount++;
      }
      const localAverage = localCount > 0 ? localSum / localCount : 1.0;

      // Check threshold and peak condition
      if (currentEnergy > localAverage * threshold) {
        // Enforce peak condition (must be a local maximum in a 3-window range)
        const prevEnergy = i > 0 ? energies[i - 1] : 0;
        const nextEnergy = i < energies.length - 1 ? energies[i + 1] : 0;

        if (currentEnergy >= prevEnergy && currentEnergy >= nextEnergy) {
          // Enforce minimum time distance
          if (time - lastBeatTime >= minDistanceBetweenBeats) {
            beats.push(parseFloat(time.toFixed(2)));
            lastBeatTime = time;
          }
        }
      }
    }

    console.log(`Detected ${beats.length} beats.`);
    return beats;
  } catch (err) {
    console.error('Failed to run beat detection:', err);
    throw err;
  } finally {
    // 4. Cleanup temp PCM file
    try {
      await fs.unlink(tempPcmPath);
    } catch {}
  }
}
