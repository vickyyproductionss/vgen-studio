import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';

// Initialize Google Gen AI client for Google Cloud Vertex AI (Agent Platform)
const ai = new GoogleGenAI({
  enterprise: true,
  project: 'flowsocial-498207',
  location: 'us-central1'
});

// Helper to dynamically obtain client (forced to global Vertex AI per instructions)
function getAiClient(apiKey) {
  console.log('[Gemini Client] Using global Vertex AI (enterprise)...');
  return ai;
}


// Helper to get audio duration using ffmpeg
async function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';
    proc.stderr.on('data', (d) => stderr += d.toString());
    proc.on('close', () => {
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const centiseconds = parseInt(match[4], 10);
        resolve(hours * 3600 + minutes * 60 + seconds + centiseconds / 100);
      } else {
        resolve(0);
      }
    });
  });
}

// Helper to poll file status until it is ACTIVE
async function waitForFileActive(ai, fileMeta) {
  let file = await ai.files.get({ name: fileMeta.name });
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  
  while (file.state === 'PROCESSING' && attempts < maxAttempts) {
    console.log(`File ${file.name} is processing... waiting 5s`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    file = await ai.files.get({ name: fileMeta.name });
    attempts++;
  }

  if (file.state !== 'ACTIVE') {
    throw new Error(`File processing failed or timed out. State is: ${file.state}`);
  }
  
  console.log(`File ${file.name} is ACTIVE!`);
  return file;
}

/**
 * Helper to call generateContent with model rotation and retry logic for transient errors.
 */
async function generateContentWithFallback(ai, requestConfig) {
  const defaultModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const models = requestConfig.models || defaultModels;
  
  const cleanConfig = { ...requestConfig };
  delete cleanConfig.models;

  let lastError;

  for (const model of models) {
    const configWithModel = { ...cleanConfig, model };
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[Gemini API] Requesting ${model} (attempt ${attempt}/${maxAttempts})...`);
        const response = await ai.models.generateContent(configWithModel);
        return response;
      } catch (err) {
        lastError = err;
        
        const code = err.code || err.statusCode || (err.error && err.error.code);
        const status = err.status || (err.error && err.error.status);
        const msg = err.message || '';

        const isTransient = 
          status === 'UNAVAILABLE' ||
          status === 'RESOURCE_EXHAUSTED' ||
          code === 503 ||
          code === 429 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.toLowerCase().includes('unavailable') ||
          msg.toLowerCase().includes('exhausted') ||
          msg.toLowerCase().includes('demand') ||
          msg.toLowerCase().includes('limit') ||
          msg.toLowerCase().includes('timeout') ||
          msg.toLowerCase().includes('network') ||
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ENOTFOUND' ||
          err.code === 'EAI_AGAIN';

        if (isTransient) {
          console.warn(`[Gemini API Warning] Model ${model} failed with transient error: ${msg}. Status: ${status}, Code: ${code}.`);
          if (model !== models[models.length - 1] || attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`[Gemini API] Waiting ${delay}ms before next attempt/model...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          // If it's a credentials error (401), fail immediately since no models will work.
          if (code === 401 || status === 'UNAUTHENTICATED' || msg.includes('default credentials') || msg.includes('401')) {
            throw err;
          }
          
          // Otherwise, if we have other models left to try, log a warning and proceed to the next model.
          if (model !== models[models.length - 1]) {
            console.warn(`[Gemini API Warning] Model ${model} failed with error: ${msg}. Status: ${status}, Code: ${code}. Rotating to the next model...`);
            break; // Break the attempt loop to move to the next model in the outer loop
          } else {
            throw err; // Out of models, throw the error
          }
        }
      }
    }
  }

  throw lastError;
}

/**
 * Helper to get video MIME type based on file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4': return 'video/mp4';
    case '.mkv': return 'video/x-matroska';
    case '.webm': return 'video/webm';
    case '.mov': return 'video/quicktime';
    case '.m4v': return 'video/x-m4v';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    default: return 'video/mp4';
  }
}

/**
 * Uploads a video clip and analyzes its visual context using Gemini
 */
export async function analyzeVideo(filePath, apiKey) {
  const client = getAiClient(apiKey);

  console.log(`Reading video file: ${filePath}`);
  const mimeType = getMimeType(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  console.log('Sending video for visual analysis...');
  const prompt = `Analyze this video clip. Provide:
1. A short, detailed description of the action and visual content (1-2 sentences).
2. A list of 4-6 relevant keyword tags.
3. A chronological breakdown of the specific action segments in the video with start and end times in actual elapsed seconds (e.g. start_time: 0.0, end_time: 1.5 for the first action; start_time: 1.5, end_time: 3.3 for the next). Ensure the times correspond to the actual elapsed duration of the video. Keep descriptions short (3-8 words, e.g. "unracking barbell", "lowering barbell").

Return the result as a JSON object matching the requested schema.`;

  const response = await generateContentWithFallback(client, {
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      prompt
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          tags: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          segments: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                start_time: { type: 'NUMBER' },
                end_time: { type: 'NUMBER' },
                description: { type: 'STRING' }
              },
              required: ['start_time', 'end_time', 'description']
            }
          }
        },
        required: ['description', 'tags', 'segments']
      }
    }
  });

  const resultText = response.text;
  console.log('Gemini Analysis Result:', resultText);
  return JSON.parse(resultText);
}

/**
 * Transcribes audio and aligns the words/sentences with start and end times using Gemini
 */
export async function alignScriptAndAudio(scriptText, audioPath, apiKey) {
  const maxAttempts = 3;
  let delay = 1500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await alignScriptAndAudioInternal(scriptText, audioPath, apiKey);
    } catch (err) {
      console.warn(`[Gemini Aligner] Attempt ${attempt} failed with error: ${err.message}`);
      if (attempt === maxAttempts) {
        throw new Error(`Dialogue boundary alignment failed after ${maxAttempts} attempts. Last error: ${err.message}`);
      }
      console.log(`[Gemini Aligner] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // exponential backoff
    }
  }
}

async function alignScriptAndAudioInternal(scriptText, audioPath, apiKey) {
  const client = getAiClient(apiKey);


  let audioDuration = 0;
  try {
    audioDuration = await getAudioDuration(audioPath);
    console.log(`[Gemini Aligner] Calculated audio duration: ${audioDuration}s`);
  } catch (err) {
    console.warn('[Gemini Aligner] Failed to get audio duration:', err.message);
  }

  console.log(`Reading audio file: ${audioPath}`);
  const fileBuffer = fs.readFileSync(audioPath);
  const base64Data = fileBuffer.toString('base64');

  const hasScript = scriptText && scriptText.trim().length > 0;
  console.log('Aligning script and audio...');
  
  const prompt = hasScript 
    ? `You are a script timing generator. You are given a reference script:
"${scriptText}"

And the uploaded audio file which is a reading of this script. The total duration of this audio file is exactly ${audioDuration.toFixed(2)} seconds.
Analyze the audio, match it to the script, and segment the script into logical clips/sentences. 
CRITICAL: Segment the script naturally at sentence boundaries or major phrase boundaries. Do NOT force a minimum duration for the segments. Keep the segments as natural, individual sentences/phrases (even if they are short, e.g., 1.0 to 2.0 seconds long). Do not group sentences together unless they naturally flow as a single spoken phrase in the audio.

For each segment, you MUST generate and provide the transcripts in both Hindi and Hinglish:
1. text_hindi: The transcribed spoken dialogue in Devanagari Hindi script.
2. text_hinglish: The transcribed spoken dialogue in Hinglish (Hindi written using the Latin/English alphabet).
3. start_time in seconds (relative to the beginning of the audio, starting at 0.0).
4. end_time in seconds.
5. words_hindi: An array of words inside the text_hindi transcript, with their individual start_time and end_time timings.
6. words_hinglish: An array of words inside the text_hinglish transcript, with their individual start_time and end_time timings.
7. text: A copy of the text_hinglish transcript.
8. words: A copy of the words_hinglish array.

Ensure that the segments cover the whole audio timeline, and the start/end times are highly accurate based on the audio recording of ${audioDuration.toFixed(2)} seconds.`
    : `You are an audio transcriber and timing generator. 
Analyze the uploaded audio file, transcribe it, and segment the transcribed text into logical clips/phrases. The total duration of this audio file is exactly ${audioDuration.toFixed(2)} seconds.
CRITICAL: Segment the speech naturally at logical pauses, sentence boundaries, or major phrase boundaries. Do NOT force a minimum duration for the segments. Keep the segments as natural, individual spoken phrases/sentences (even if they are short, e.g., 1.0 to 2.0 seconds long). Do not group spoken phrases together unless they naturally flow as a single spoken statement in the audio.

For each segment, you MUST generate and provide the transcripts in both Hindi and Hinglish:
1. text_hindi: The transcribed spoken dialogue in Devanagari Hindi script.
2. text_hinglish: The transcribed spoken dialogue in Hinglish (Hindi written using the Latin/English alphabet).
3. start_time in seconds (relative to the beginning of the audio, starting at 0.0).
4. end_time in seconds.
5. words_hindi: An array of words inside the text_hindi transcript, with their individual start_time and end_time timings.
6. words_hinglish: An array of words inside the text_hinglish transcript, with their individual start_time and end_time timings.
7. text: A copy of the text_hinglish transcript.
8. words: A copy of the words_hinglish array.

Ensure that the segments cover the whole audio timeline, and the start/end times are highly accurate based on the audio recording of ${audioDuration.toFixed(2)} seconds.`;

  const response = await generateContentWithFallback(client, {
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType: 'audio/mpeg'
        }
      },
      prompt
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            text: { type: 'STRING' },
            text_hindi: { type: 'STRING' },
            text_hinglish: { type: 'STRING' },
            start_time: { type: 'NUMBER' },
            end_time: { type: 'NUMBER' },
            words: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  word: { type: 'STRING' },
                  start_time: { type: 'NUMBER' },
                  end_time: { type: 'NUMBER' }
                },
                required: ['word', 'start_time', 'end_time']
              }
            },
            words_hindi: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  word: { type: 'STRING' },
                  start_time: { type: 'NUMBER' },
                  end_time: { type: 'NUMBER' }
                },
                required: ['word', 'start_time', 'end_time']
              }
            },
            words_hinglish: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  word: { type: 'STRING' },
                  start_time: { type: 'NUMBER' },
                  end_time: { type: 'NUMBER' }
                },
                required: ['word', 'start_time', 'end_time']
              }
            }
          },
          required: ['text', 'text_hindi', 'text_hinglish', 'start_time', 'end_time', 'words', 'words_hindi', 'words_hinglish']
        }
      }
    }
  });


  const resultText = response.text;
  console.log('Gemini Alignment Result:', resultText);
  return JSON.parse(resultText);
}

/**
 * Matches video clips to storyboard scenes semantically
 */
export async function matchClipsToScenes(scenes, clips, apiKey, isTalkingHead = false) {
  const client = getAiClient(apiKey);


  // Map clips to simplify information but preserve segment timelines
  const clipsWithSegments = clips.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    tags: c.tags,
    duration: c.duration,
    segments: c.segments || [{ start_time: 0, end_time: c.duration, description: c.description }]
  }));

  // Shuffle the Clip Library list before passing it to Gemini to prevent order bias (always picking the first one in list)
  const randomizedClips = [...clipsWithSegments].sort(() => Math.random() - 0.5);

  console.log('Matching clips to storyboard scenes...');
  const prompt = `You are a professional video editor. 
Your task is to match each of the storyboard scenes to the most relevant video clip from the clip library.

Here is the Clip Library (JSON format, containing clip ID, name, description, tags, duration, and segment timelines describing what happens second-by-second within the clip):
${JSON.stringify(randomizedClips)}

Here are the Storyboard Scenes (JSON format, containing scene index, text, and scene duration in seconds):
${JSON.stringify(scenes.map((s, idx) => ({
  index: idx,
  text: s.text,
  duration: s.end_time - s.start_time
})))}

Rules:
1. For each scene, pick the SINGLE best video clip that visually matches the scene's context. If multiple clips match the scene's context equally well, select one of them at random to ensure variety across generations.
${isTalkingHead ? `
2. SPECIAL RULE FOR TALKING HEAD VIDEO: You are editing a video of a person talking, and you want to insert library B-roll clips only when there is a strong visual keyword or concept matching a library B-roll clip.
   - If a scene contains a clear visual action, object, or concept that can be illustrated by one of the B-roll clips in the library, match it to that clip.
   - If a scene is general dialogue, introductory, or has no clear visual match in the B-roll library, set "clipId" to "original". Do NOT force a B-roll clip if it does not fit the dialogue context.
` : ''}
3. Review the clip's "segments" array. You MUST use the segment-based data to precisely match the moments described in the clip's segments to the scene's text context. Set "clipStart" to match the "start_time" of the specific matching segment inside that clip. Do not just match the general clip context or default to 0 if a more specific segment is available.
4. IMPORTANT (Clip Reuse Limit): Try to maximize the variety of clips used. Avoid using more than one segment from the same clip in the video, unless you run out of unique clips. If you must reuse a clip, you can use different/distinct segments of that clip.
5. IMPORTANT (Exact Segment Limit): Never repeat or reuse the EXACT SAME piece/segment (i.e. same clipId and same clipStart range) more than once in the entire output array of scene matches (each segment must be used at most once). Only repeat if you absolutely run out of clips and segments.
6. IMPORTANT (No Back-to-Back): Never assign the same clip+segment (same clipId AND same clipStart) to two consecutive scenes in a row. Adjacent scenes must always use different clips or at least a different segment of the same clip.
7. Explain your matching decision briefly in "reason" (e.g. "Matched scene text with segment X of clip Y starting at Zs"${isTalkingHead ? `, or "Keep original talking head video"` : ''}).

Return a JSON array of matches matching the requested schema.`;

  const response = await generateContentWithFallback(client, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            sceneIndex: { type: 'NUMBER' },
            clipId: { type: 'STRING' },
            clipStart: { type: 'NUMBER' },
            reason: { type: 'STRING' }
          },
          required: ['sceneIndex', 'clipId', 'clipStart', 'reason']
        }
      }
    }
  });

  const resultText = response.text;
  console.log('Gemini Matching Result:', resultText);
  const matches = JSON.parse(resultText);

  // Programmatic enforcement of the 3-times segment limit rule
  try {
    enforceSegmentLimit(matches, clips, scenes);
  } catch (err) {
    console.error('[Post-processing] Error enforcing segment limit:', err);
  }

  return matches;
}

/**
 * Programmatically enforces that the exact same piece of a clip (same clipId & clipStart)
 * is not repeated more than 3 times AND is never used in two consecutive scenes back-to-back.
 * If either rule is violated, reassigns to other segments of the same clip or other clips.
 */
function enforceSegmentLimit(matches, clips, scenes) {
  const maxRepetitions = 1;
  const segmentUsage = {};

  const getSegKey = (clipId, start) => `${clipId}_${Number(start).toFixed(1)}`;

  for (const match of matches) {
    if (match.clipId === 'original') continue; // Ignore original talking head clips
    const key = getSegKey(match.clipId, match.clipStart);
    segmentUsage[key] = (segmentUsage[key] || 0) + 1;
  }

  console.log('[Post-processing] Initial segment usage counts:', segmentUsage);

  let changed = false;

  // --- Pass 1: Enforce max repetitions ---
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (match.clipId === 'original') continue; // Ignore original talking head clips
    const key = getSegKey(match.clipId, match.clipStart);

    if (segmentUsage[key] > maxRepetitions) {
      console.log(`[Post-processing] Scene index ${match.sceneIndex} uses segment ${key} which exceeds the ${maxRepetitions} limit. Reassigning...`);
      const reassigned = reassignMatch(i, matches, clips, scenes, segmentUsage, maxRepetitions, getSegKey);
      if (reassigned) changed = true;
    }
  }

  // --- Pass 2: Enforce no back-to-back consecutive duplicates ---
  // Sort matches by sceneIndex to process in order
  const sortedMatches = [...matches].sort((a, b) => a.sceneIndex - b.sceneIndex);
  for (let i = 1; i < sortedMatches.length; i++) {
    const prev = sortedMatches[i - 1];
    const curr = sortedMatches[i];
    if (prev.clipId === 'original' || curr.clipId === 'original') continue; // Ignore original talking head clips
    const prevKey = getSegKey(prev.clipId, prev.clipStart);
    const currKey = getSegKey(curr.clipId, curr.clipStart);

    if (prevKey === currKey) {
      console.log(`[Post-processing] Back-to-back duplicate detected: scenes ${prev.sceneIndex} & ${curr.sceneIndex} both use ${currKey}. Reassigning scene ${curr.sceneIndex}...`);
      // Find the actual index in the original matches array
      const origIdx = matches.findIndex(m => m === curr);
      if (origIdx !== -1) {
        const reassigned = reassignMatch(origIdx, matches, clips, scenes, segmentUsage, maxRepetitions, getSegKey, prevKey);
        if (reassigned) changed = true;
      }
    }
  }

  if (changed) {
    console.log('[Post-processing] Final segment usage counts:', segmentUsage);
  }
}

/**
 * Reassign a single match to an alternative segment/clip.
 * @param {string} [excludeKey] - If provided, the reassigned segment must NOT match this key (used for back-to-back prevention).
 */
function reassignMatch(matchIdx, matches, clips, scenes, segmentUsage, maxRepetitions, getSegKey, excludeKey) {
  const match = matches[matchIdx];
  if (match.clipId === 'original') return false; // Do not reassign original clips
  const oldKey = getSegKey(match.clipId, match.clipStart);
  const scene = scenes[match.sceneIndex];
  const sceneText = (scene?.text || '').toLowerCase();

  // 1. Look for other segments in the same clip first
  const currentClip = clips.find(c => c.id === match.clipId);
  if (currentClip && currentClip.segments && currentClip.segments.length > 1) {
    for (const seg of currentClip.segments) {
      const altKey = getSegKey(currentClip.id, seg.start_time);
      if (altKey === oldKey) continue;
      if (excludeKey && altKey === excludeKey) continue;
      const altUsage = segmentUsage[altKey] || 0;
      if (altUsage < maxRepetitions) {
        console.log(`[Post-processing] Reassigned scene ${match.sceneIndex} to alt segment of same clip (${currentClip.name}) at ${seg.start_time}s`);
        segmentUsage[oldKey]--;
        segmentUsage[altKey] = altUsage + 1;
        match.clipStart = seg.start_time;
        match.reason = `[Auto-Reassigned] Same clip, alt segment at ${seg.start_time}s (avoid repetition/back-to-back)`;
        return true;
      }
    }
  }

  // 2. Look for alternative clips
  const sortedClips = [...clips]
    .filter(c => c.id !== match.clipId)
    .map(c => {
      let score = 0;
      const desc = (c.description || '').toLowerCase();
      const tags = (c.tags || []).map(t => t.toLowerCase());
      const words = sceneText.split(/\s+/);
      for (const w of words) {
        if (w.length > 3) {
          if (desc.includes(w)) score += 2;
          if (tags.some(t => t.includes(w))) score += 3;
        }
      }
      return { clip: c, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return Math.random() - 0.5;
    });

  for (const item of sortedClips) {
    const altClip = item.clip;
    const altSegments = altClip.segments || [{ start_time: 0 }];
    for (const seg of altSegments) {
      const altKey = getSegKey(altClip.id, seg.start_time);
      if (excludeKey && altKey === excludeKey) continue;
      const altUsage = segmentUsage[altKey] || 0;
      if (altUsage < maxRepetitions) {
        console.log(`[Post-processing] Reassigned scene ${match.sceneIndex} to alt clip (${altClip.name}) at ${seg.start_time}s`);
        segmentUsage[oldKey]--;
        segmentUsage[altKey] = altUsage + 1;
        match.clipId = altClip.id;
        match.clipStart = seg.start_time;
        match.reason = `[Auto-Reassigned] Alt clip ${altClip.name} at ${seg.start_time}s (avoid repetition/back-to-back)`;
        return true;
      }
    }
  }

  console.warn(`[Post-processing] Could not find alternative for scene ${match.sceneIndex}`);
  return false;
}

/**
 * Enhances a script by automatically inserting ElevenLabs V3 expression tags using Gemini.
 */
export async function enhanceScriptWithTags(text, apiKey) {
  const client = getAiClient(apiKey);


  const prompt = `You are a script formatting assistant for a Text-to-Speech system.
Your job is to read this voiceover script and insert ElevenLabs v3 expression tags: [thoughtful], [sigh], [gasp], [laughs], [whisper], [cry].

Rules:
1. ONLY insert these tags in bracketed format: [thoughtful], [sigh], [gasp], [laughs], [whisper], [cry].
2. Insert them at natural pauses, punctuation boundaries, or transitions where they fit the emotional tone of the narration.
3. DO NOT change, rewrite, delete, or translate any of the words in the script. Keep all the original text completely identical, only adding the expression tags.
4. Do not over-use the tags. Use them sparingly (e.g. 1-3 tags total in a short paragraph) to keep the voice sounding natural and professional.
5. Return the resulting script text. Do not wrap the output in quotes or code block markers.

Script to enhance:
"${text}"`;

  const response = await generateContentWithFallback(client, {
    contents: prompt,
    model: 'gemini-2.5-flash',
  });

  return response.text.trim();
}

/**
 * Helper to compress video to low-resolution proxy for Gemini analysis
 */
function compressVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // scale to max width 360, remove audio, use x264 codec, CRF 30 for high compression
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', "scale='min(360,iw)':-2",
      '-an',
      '-vcodec', 'libx264',
      '-crf', '30',
      outputPath
    ];
    
    console.log(`[FFmpeg Compression] Scaling video: ${inputPath} -> ${outputPath}`);
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    
    proc.stderr.on('data', (d) => stderr += d.toString());
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg compression failed with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}

/**
 * Compresses the downloaded Reel video and analyzes its scenes/text overlays using Gemini.
 */
export async function analyzeRecreatedReel(filePath, apiKey) {
  const client = getAiClient(apiKey);
  const fileDir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const lowresPath = path.join(fileDir, `${baseName}_lowres_${Date.now()}${ext}`);

  try {
    // 1. Compress the video to keep base64 payload under limits
    await compressVideo(filePath, lowresPath);
    
    // 2. Read the low-res compressed video
    const mimeType = getMimeType(lowresPath);
    const fileBuffer = fs.readFileSync(lowresPath);
    const base64Data = fileBuffer.toString('base64');
    
    // Clean up low-res file
    try {
      fs.unlinkSync(lowresPath);
    } catch (_) {}

    console.log('[Gemini Recreate] Sending video for Reel analysis...');
    const prompt = `Analyze this video reel. It consists of multiple video clips merged together, and on-screen text overlays.
Provide a structured JSON breakdown containing:
1. "description": A short summary of the overall reel (1-2 sentences).
2. "scenes": A list of video scenes/clips. Detect where the clips change (scene cuts). For each scene, provide:
   - "start_time": Start time of the scene in seconds.
   - "end_time": End time of the scene in seconds.
   - "visual_description": Detailed description of the visual scene (what is happening, who is in it, actions, setting).
   - "is_static": Boolean. True if the scene is a static image or a photo with absolutely no video motion, false if the scene is a moving video clip.
3. "textOverlays": A list of on-screen text overlays detected in the video. For each text overlay, provide:
   - "text": The exact text content shown on screen.
   - "start_time": Start time when the text appears on screen.
   - "end_time": End time when the text disappears.
   - "position": The location of the text on screen ('top', 'center', 'bottom').

Return the result as a JSON object matching the requested schema.`;

    const response = await generateContentWithFallback(client, {
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            description: { type: 'STRING' },
            scenes: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  start_time: { type: 'NUMBER' },
                  end_time: { type: 'NUMBER' },
                  visual_description: { type: 'STRING' },
                  is_static: { type: 'BOOLEAN' }
                },
                required: ['start_time', 'end_time', 'visual_description', 'is_static']
              }
            },
            textOverlays: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  start_time: { type: 'NUMBER' },
                  end_time: { type: 'NUMBER' },
                  position: { type: 'STRING' }
                },
                required: ['text', 'start_time', 'end_time', 'position']
              }
            }
          },
          required: ['description', 'scenes', 'textOverlays']
        }
      }
    });

    const resultText = response.text;
    console.log('[Gemini Recreate] Reel Analysis Result:', resultText);
    return JSON.parse(resultText);
    
  } catch (error) {
    // Clean up low-res file if still exists
    if (fs.existsSync(lowresPath)) {
      try {
        fs.unlinkSync(lowresPath);
      } catch (_) {}
    }
    throw error;
  }
}

/**
 * Matches target scenes analyzed from the Reel to user's library clips semantically.
 */
export async function matchRecreatedScenes(analyzedScenes, libraryClips, apiKey) {
  const client = getAiClient(apiKey);
  // Map clips to simplify information
  const clipsWithSegments = libraryClips.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    tags: c.tags,
    duration: c.duration,
    segments: c.segments || [{ start_time: 0, end_time: c.duration, description: c.description }]
  }));

  console.log('[Gemini Recreate] Matching clips to analyzed reel scenes...');
  const prompt = `You are a professional video editor. 
Your task is to match each of the recreated video scenes (target scenes) to the most visually relevant video clip from the library.

Target Scenes (JSON format, containing scene index, visual description of the scene, and duration in seconds):
${JSON.stringify(analyzedScenes.map((s, idx) => ({
  index: idx,
  description: s.visual_description,
  duration: s.end_time - s.start_time
})))}

Clip Library (JSON format, containing clip ID, name, description, tags, duration, and segment timelines describing what happens second-by-second within the clip):
${JSON.stringify(clipsWithSegments)}

Rules:
1. For each target scene, pick the SINGLE best library clip that visually matches the scene's description. If multiple clips match equally well, select one to ensure variety.
2. Review the library clip's "segments" array. You MUST use the segment-based data to match the specific moments described in the clip's segments to the target scene's description. Set "clipStart" to match the "start_time" of the specific matching segment inside that clip. Default to 0 if no specific segment matches better.
3. Try to maximize the variety of clips used. Avoid reusing the same clip too many times if other options are available.
4. Explain your matching decision briefly in "reason" (e.g. "Matched scene description with segment X of clip Y").

Return a JSON array of matches matching the requested schema.`;

  const response = await generateContentWithFallback(client, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            sceneIndex: { type: 'NUMBER' },
            clipId: { type: 'STRING' },
            clipStart: { type: 'NUMBER' },
            reason: { type: 'STRING' }
          },
          required: ['sceneIndex', 'clipId', 'clipStart', 'reason']
        }
      }
    }
  });

  const resultText = response.text;
  console.log('[Gemini Recreate] Clip Matching Result:', resultText);
  return JSON.parse(resultText);
}

/**
 * Analyzes a subject photo from a specific angle
 */
export async function analyzeSubjectPhoto(filePath, angle, apiKey) {
  const client = getAiClient(apiKey);
  console.log(`[Gemini Subject] Analyzing photo: ${filePath} at angle: ${angle}`);
  
  const mimeType = getMimeType(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  const prompt = `Analyze this photo of a subject's face/body taken from the angle: "${angle}".
Describe the subject's key visual characteristics in detail:
1. Gender and approximate age.
2. Hair color, style, and length.
3. Facial features (eyes, nose, jawline, facial hair, expression).
4. Skin tone/complexion.
5. Key clothing items, colors, and accessories visible in the photo.

Provide a JSON response matching the requested schema.`;

  const response = await generateContentWithFallback(client, {
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      prompt
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          traits: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          }
        },
        required: ['description', 'traits']
      }
    }
  });

  const resultText = response.text;
  console.log(`[Gemini Subject] Photo analysis result:`, resultText);
  return JSON.parse(resultText);
}

/**
 * Combines multiple photo analyses into a single cohesive physical summary
 */
export async function generateSubjectSummary(photosAnalysis, apiKey) {
  const client = getAiClient(apiKey);
  console.log(`[Gemini Subject] Generating unified physical summary for subject...`);

  const prompt = `You are an expert visual description compiler.
We have multiple analyzed photos of the same subject from various angles. Here are their detailed descriptions and traits:
${JSON.stringify(photosAnalysis, null, 2)}

Compile these descriptions into a single, highly detailed physical summary of the subject.
Your summary must describe:
1. Gender, age range, ethnicity/heritage if visible.
2. Exact hair details (style, color, cut, facial hair).
3. Eye shape and color, facial structure, expression.
4. Skin complexion.
5. Standard style/clothing/theme.

This summary will be used as a prompt reference for image generation to maintain character consistency. Make it descriptive, clear, and focused on physical appearance traits.

Return the result as a JSON object:
{
  "summary": "A detailed 2-3 sentence visual description...",
  "traitsList": ["trait 1", "trait 2", ...]
}`;

  const response = await generateContentWithFallback(client, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          traitsList: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          }
        },
        required: ['summary', 'traitsList']
      }
    }
  });

  const resultText = response.text;
  console.log(`[Gemini Subject] Cohesive summary result:`, resultText);
  return JSON.parse(resultText);
}



/**
 * Generates an AI asset using Imagen 3 and optional Ken Burns effect
 */
export async function generateAiAsset(prompt, type, duration, apiKey, subjectPhotoPath) {
  const client = getAiClient(apiKey);
  const uniqueId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const clipId = `ai_clip_${uniqueId}`;
  const filename = `${clipId}.mp4`;
  const tempImgPath = path.join(process.cwd(), 'uploads', `temp_${uniqueId}.jpg`);
  const finalVideoPath = path.join(process.cwd(), 'uploads', 'clips', filename);
  const finalThumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', `${clipId}.jpg`);

  // Create directories if they don't exist
  fs.mkdirSync(path.dirname(finalVideoPath), { recursive: true });
  fs.mkdirSync(path.dirname(finalThumbnailPath), { recursive: true });

  console.log(`[AI Gen] Model request: prompt="${prompt}" type=${type} duration=${duration}`);

  let base64Image = null;
  if (subjectPhotoPath && fs.existsSync(subjectPhotoPath)) {
    base64Image = fs.readFileSync(subjectPhotoPath).toString('base64');
    console.log(`[AI Gen] Using subject photo as image-to-image reference: ${subjectPhotoPath}`);
  }

  // Request Imagen 3
  const genParams = {
    model: 'imagen-3.0-generate-002',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '9:16'
    }
  };

  if (base64Image) {
    genParams.image = {
      imageBytes: base64Image,
      mimeType: getMimeType(subjectPhotoPath)
    };
  }

  const response = await client.models.generateImages(genParams);
  if (!response.generatedImages || response.generatedImages.length === 0) {
    throw new Error('Vertex AI Imagen 3 returned empty generated images.');
  }

  const imgBytes = response.generatedImages[0].image.imageBytes;
  const imgBuffer = Buffer.from(imgBytes, 'base64');
  
  // Write to temporary image path and thumbnail path
  fs.writeFileSync(tempImgPath, imgBuffer);
  fs.writeFileSync(finalThumbnailPath, imgBuffer);

  const sceneDuration = Number(duration) || 5;

  // Convert image to video using FFmpeg
  return new Promise((resolve, reject) => {
    let filter = '';
    if (type === 'video') {
      // Ken Burns vertical pan filter
      filter = `scale=1296:2304,crop=1080:1920:(in_w-out_w)/2:(in_h-out_h)/2-120+240*t/${sceneDuration}`;
    } else {
      // Static image loop scaled to vertical Reels aspect ratio
      filter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black';
    }

    const args = [
      '-y',
      '-loop', '1',
      '-i', tempImgPath,
      '-c:v', 'libx264',
      '-t', String(sceneDuration),
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-vf', filter,
      finalVideoPath
    ];

    console.log(`[AI Gen] Executing FFmpeg: ${ffmpegPath} ${args.join(' ')}`);
    const proc = spawn(ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (data) => stderr += data.toString());
    proc.on('close', (code) => {
      // Clean up temp image
      try {
        fs.unlinkSync(tempImgPath);
      } catch (_) {}

      if (code === 0) {
        console.log(`[AI Gen] FFmpeg video compilation successful: ${finalVideoPath}`);
        resolve({
          id: clipId,
          path: `uploads/clips/${filename}`,
          thumbnail: `/uploads/thumbnails/${clipId}.jpg`,
          duration: sceneDuration
        });
      } else {
        console.error(`[AI Gen] FFmpeg failed with exit code ${code}. Stderr: ${stderr}`);
        reject(new Error(`FFmpeg failed to convert generated image to video: ${stderr}`));
      }
    });
  });
}


