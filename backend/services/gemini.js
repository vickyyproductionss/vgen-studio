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
  const defaultModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
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
    default: return 'video/mp4';
  }
}

/**
 * Uploads a video clip and analyzes its visual context using Gemini
 */
export async function analyzeVideo(filePath, apiKey) {
  // Using global Vertex AI 'ai' instance

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

  const response = await generateContentWithFallback(ai, {
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
  // Using global Vertex AI 'ai' instance


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
CRITICAL: Every segment MUST be between 2.0 and 4.0 seconds long (aim for 2.0 to 4.0 seconds per segment). If a sentence or phrase naturally takes less than 2.0 seconds to speak, you MUST group it with the adjacent sentence/phrase to create a combined segment that is at least 2.0 seconds long. Never output a segment shorter than 2.0 seconds, and never output a segment longer than 4.0 seconds (unless the total audio duration itself is less than 2.0 seconds, in which case output a single segment spanning the entire audio).

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
CRITICAL: Every segment MUST be between 2.0 and 4.0 seconds long (aim for 2.0 to 4.0 seconds per segment). If a spoken phrase naturally takes less than 2.0 seconds to speak, you MUST group it with the adjacent spoken phrase to create a combined segment that is at least 2.0 seconds long. Never output a segment shorter than 2.0 seconds, and never output a segment longer than 4.0 seconds (unless the total audio duration itself is less than 2.0 seconds, in which case output a single segment spanning the entire audio).

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

  const response = await generateContentWithFallback(ai, {
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
export async function matchClipsToScenes(scenes, clips, apiKey) {
  // Using global Vertex AI 'ai' instance


  // Map clips to simplify information but preserve segment timelines
  const clipsWithSegments = clips.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    tags: c.tags,
    duration: c.duration,
    segments: c.segments || [{ start_time: 0, end_time: c.duration, description: c.description }]
  }));

  console.log('Matching clips to storyboard scenes...');
  const prompt = `You are a professional video editor. 
Your task is to match each of the storyboard scenes to the most relevant video clip from the clip library.

Here is the Clip Library (JSON format, containing clip ID, name, description, tags, duration, and segment timelines describing what happens second-by-second within the clip):
${JSON.stringify(clipsWithSegments)}

Here are the Storyboard Scenes (JSON format, containing scene index, text, and scene duration in seconds):
${JSON.stringify(scenes.map((s, idx) => ({
  index: idx,
  text: s.text,
  duration: s.end_time - s.start_time
})))}

Rules:
1. For each scene, pick the SINGLE best video clip that visually matches the scene's context.
2. Review the clip's "segments" array. You MUST use the segment-based data to precisely match the moments described in the clip's segments to the scene's text context. Set "clipStart" to match the "start_time" of the specific matching segment inside that clip. Do not just match the general clip context or default to 0 if a more specific segment is available.
3. IMPORTANT (Clip Reuse Limit): Try to maximize the variety of clips used. Avoid using more than one segment from the same clip in the video, unless you run out of unique clips. If you must reuse a clip, you can use different/distinct segments of that clip.
4. IMPORTANT (Exact Segment Limit): Never repeat or reuse the EXACT SAME piece/segment (i.e. same clipId and same clipStart range) more than once in the entire output array of scene matches (each segment must be used at most once). Only repeat if you absolutely run out of clips and segments.
5. IMPORTANT (No Back-to-Back): Never assign the same clip+segment (same clipId AND same clipStart) to two consecutive scenes in a row. Adjacent scenes must always use different clips or at least a different segment of the same clip.
6. Explain your matching decision briefly in "reason" (e.g. "Matched scene text with segment X of clip Y starting at Zs").

Return a JSON array of matches matching the requested schema.`;

  const response = await generateContentWithFallback(ai, {
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
    const key = getSegKey(match.clipId, match.clipStart);
    segmentUsage[key] = (segmentUsage[key] || 0) + 1;
  }

  console.log('[Post-processing] Initial segment usage counts:', segmentUsage);

  let changed = false;

  // --- Pass 1: Enforce max repetitions ---
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
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
    .sort((a, b) => b.score - a.score);

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
  // Using global Vertex AI 'ai' instance


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

  const response = await generateContentWithFallback(ai, {
    contents: prompt,
    model: 'gemini-2.5-flash',
  });

  return response.text.trim();
}
