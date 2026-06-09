import speech from '@google-cloud/speech';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';

/**
 * Converts any audio/video file to 16kHz mono WAV PCM format required by GCP Speech-to-Text.
 */
export async function convertToMonoPcmWav(inputPath, outputPath) {
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

/**
 * Request word-level timestamps from GCP Speech-to-Text synchronous API.
 * Supports audio files under 1 minute.
 */
export async function getGcpWordTimings(audioPath) {
  const client = new speech.SpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });

  const tempWavPath = audioPath + '.mono.wav';
  try {
    console.log(`[GCP STT] Converting ${audioPath} to mono WAV...`);
    await convertToMonoPcmWav(audioPath, tempWavPath);

    if (!fs.existsSync(tempWavPath)) {
      throw new Error(`Temp wav file was not created at ${tempWavPath}`);
    }

    const fileBuffer = fs.readFileSync(tempWavPath);
    const audioBytes = fileBuffer.toString('base64');

    const audio = { content: audioBytes };
    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      alternativeLanguageCodes: ['hi-IN', 'en-IN'],
      enableWordTimeOffsets: true,
    };

    const request = { audio, config };
    console.log(`[GCP STT] Sending recognize request to GCP Speech-to-Text...`);
    const [response] = await client.recognize(request);

    const words = [];
    if (response.results) {
      for (const result of response.results) {
        const alternative = result.alternatives[0];
        if (alternative && alternative.words) {
          for (const wordInfo of alternative.words) {
            const startSecs = parseInt(wordInfo.startTime.seconds || 0, 10) + 
                              (wordInfo.startTime.nanos || 0) / 1000000000;
            const endSecs = parseInt(wordInfo.endTime.seconds || 0, 10) + 
                            (wordInfo.endTime.nanos || 0) / 1000000000;
            words.push({
              word: wordInfo.word,
              start_time: Number(startSecs.toFixed(3)),
              end_time: Number(endSecs.toFixed(3))
            });
          }
        }
      }
    }

    console.log(`[GCP STT] Successfully recognized ${words.length} words.`);
    return words;
  } finally {
    try {
      if (fs.existsSync(tempWavPath)) {
        fs.unlinkSync(tempWavPath);
      }
    } catch (err) {
      console.warn(`[GCP STT] Failed to delete temp wav file: ${err.message}`);
    }
  }
}

/**
 * Computes optimal alignment of script words with GCP STT transcription words
 * using the Needleman-Wunsch / Levenshtein sequence alignment dynamic programming algorithm.
 */
export function alignWordSequences(scriptWords, gcpWords) {
  const M = scriptWords.length;
  const N = gcpWords.length;

  const dp = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0));

  for (let i = 0; i <= M; i++) dp[i][0] = i * 1.5; // delete script word cost
  for (let j = 0; j <= N; j++) dp[0][j] = j * 1.0; // insert extra spoken word cost

  const getMatchCost = (w1, w2) => {
    const s1 = w1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = w2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (s1 === s2) return 0;

    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const d = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
    for (let x = 0; x <= len1; x++) d[x][0] = x;
    for (let y = 0; y <= len2; y++) d[0][y] = y;

    for (let x = 1; x <= len1; x++) {
      for (let y = 1; y <= len2; y++) {
        const cost = s1[x - 1] === s2[y - 1] ? 0 : 1;
        d[x][y] = Math.min(
          d[x - 1][y] + 1,
          d[x][y - 1] + 1,
          d[x - 1][y - 1] + cost
        );
      }
    }
    const distance = d[len1][len2];
    const maxLen = Math.max(len1, len2);
    return distance / maxLen;
  };

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      const matchCost = getMatchCost(scriptWords[i - 1], gcpWords[j - 1].word);
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1.5,
        dp[i][j - 1] + 1.0,
        dp[i - 1][j - 1] + matchCost
      );
    }
  }

  let i = M, j = N;
  const alignment = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const matchCost = getMatchCost(scriptWords[i - 1], gcpWords[j - 1].word);
      const scoreDiag = dp[i - 1][j - 1] + matchCost;
      const scoreUp = dp[i - 1][j] + 1.5;
      const scoreLeft = dp[i][j - 1] + 1.0;

      const minScore = Math.min(scoreDiag, scoreUp, scoreLeft);
      if (minScore === scoreDiag) {
        alignment.push({ scriptIdx: i - 1, gcpIdx: j - 1 });
        i--;
        j--;
      } else if (minScore === scoreUp) {
        alignment.push({ scriptIdx: i - 1, gcpIdx: null });
        i--;
      } else {
        j--;
      }
    } else if (i > 0) {
      alignment.push({ scriptIdx: i - 1, gcpIdx: null });
      i--;
    } else {
      j--;
    }
  }

  alignment.reverse();
  return alignment;
}

/**
 * Align script words to GCP words, then fill/interpolate missing timestamps.
 */
export function assignTimestampsToWords(scriptWords, gcpWords) {
  if (!scriptWords || scriptWords.length === 0) return [];
  if (!gcpWords || gcpWords.length === 0) {
    // Return empty placeholders if GCP returned no words
    return scriptWords.map(w => ({ word: w, start_time: 0, end_time: 0 }));
  }

  const alignment = alignWordSequences(scriptWords, gcpWords);
  const resultWords = scriptWords.map(word => ({
    word,
    start_time: null,
    end_time: null
  }));

  // First pass: Assign direct matches
  for (const link of alignment) {
    if (link.gcpIdx !== null) {
      const gcpW = gcpWords[link.gcpIdx];
      resultWords[link.scriptIdx].start_time = gcpW.start_time;
      resultWords[link.scriptIdx].end_time = gcpW.end_time;
    }
  }

  // Second pass: Interpolate missing times
  let lastTime = 0;
  for (let k = 0; k < resultWords.length; k++) {
    if (resultWords[k].start_time === null) {
      let nextIdx = k + 1;
      while (nextIdx < resultWords.length && resultWords[nextIdx].start_time === null) {
        nextIdx++;
      }

      const prevTime = lastTime;
      const nextTime = nextIdx < resultWords.length ? resultWords[nextIdx].start_time : prevTime + 1.0;

      const gapCount = nextIdx - k;
      const timeStep = (nextTime - prevTime) / (gapCount + 1);

      for (let m = k; m < nextIdx; m++) {
        resultWords[m].start_time = Number((prevTime + (m - k + 1) * timeStep - timeStep * 0.5).toFixed(3));
        resultWords[m].end_time = Number((prevTime + (m - k + 1) * timeStep + timeStep * 0.5).toFixed(3));
      }
      k = nextIdx - 1;
    } else {
      lastTime = resultWords[k].end_time;
    }
  }

  return resultWords;
}

/**
 * Maps word timings from a source array to target text array.
 * Useful for copying aligned Hinglish word timings to Hindi Devanagari words.
 */
export function mapTimestamps(sourceWords, targetWordsText) {
  if (!targetWordsText || targetWordsText.length === 0) return [];
  if (!sourceWords || sourceWords.length === 0) {
    return targetWordsText.map(w => ({ word: w, start_time: 0, end_time: 0 }));
  }

  if (sourceWords.length === targetWordsText.length) {
    return targetWordsText.map((word, idx) => ({
      word,
      start_time: sourceWords[idx].start_time,
      end_time: sourceWords[idx].end_time
    }));
  }

  return targetWordsText.map((word, idx) => {
    const pct = idx / (targetWordsText.length - 1 || 1);
    const srcIdx = Math.min(sourceWords.length - 1, Math.round(pct * (sourceWords.length - 1)));
    return {
      word,
      start_time: sourceWords[srcIdx].start_time,
      end_time: sourceWords[srcIdx].end_time
    };
  });
}
