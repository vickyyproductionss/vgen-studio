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

// Helper to dynamically obtain client.
// In GCP production or when Service Account credentials are present, always use Vertex AI enterprise client — no API key required.
function getAiClient(apiKey) {
  const hasGcpAuth = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT_ID || process.env.K_SERVICE);
  if (hasGcpAuth) {
    console.log('[Gemini Client] GCP Service Account detected — using Vertex AI enterprise client...');
    return ai;
  }
  if (apiKey) {
    console.log('[Gemini Client] Using provided API Key (local dev fallback)...');
    return new GoogleGenAI({ apiKey });
  }
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
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const fractionStr = match[4] || '0';
        const fraction = parseFloat(`0.${fractionStr}`);
        resolve(hours * 3600 + minutes * 60 + seconds + fraction);
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
export async function alignScriptAndAudio(scriptText, audioPath, apiKey, language = 'original') {
  const maxAttempts = 3;
  let delay = 1500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await alignScriptAndAudioInternal(scriptText, audioPath, apiKey, language);
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

async function alignScriptAndAudioInternal(scriptText, audioPath, apiKey, language = 'original') {
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

  // Auto-detect if script is Hindi/Hinglish.
  // Devanagari test OR if the script explicitly looks like Hinglish or language is set to hindi/hinglish.
  const isHindiOrHinglish = /[\u0900-\u097F]/.test(scriptText) || 
                            language === 'hindi' || 
                            language === 'hinglish';

  let prompt = '';
  if (isHindiOrHinglish) {
    prompt = hasScript 
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
  } else {
    // Retain original language (e.g. English, Spanish, etc.)
    prompt = hasScript 
      ? `You are a script timing generator. You are given a reference script in its original language (e.g. English):
"${scriptText}"

And the uploaded audio file which is a reading of this script. The total duration of this audio file is exactly ${audioDuration.toFixed(2)} seconds.
Analyze the audio, match it to the script, and segment the script into logical clips/sentences. 
CRITICAL: Segment the script naturally at sentence boundaries or major phrase boundaries. Do NOT force a minimum duration for the segments. Keep the segments as natural, individual sentences/phrases (even if they are short, e.g., 1.0 to 2.0 seconds long).

For each segment, you MUST generate and provide the transcripts in the original language of the script:
1. text: The transcribed spoken dialogue in its original language (e.g., English), exactly matching the reference script words.
2. text_hinglish: A copy of the "text" field.
3. text_hindi: A copy of the "text" field.
4. start_time in seconds (relative to the beginning of the audio, starting at 0.0).
5. end_time in seconds.
6. words: An array of words inside the "text" transcript, with their individual start_time and end_time timings.
7. words_hinglish: A copy of the "words" array.
8. words_hindi: A copy of the "words" array.

Ensure that the segments cover the whole audio timeline, and the start/end times are highly accurate based on the audio recording of ${audioDuration.toFixed(2)} seconds.`
      : `You are an audio transcriber and timing generator. 
Analyze the uploaded audio file, transcribe it in its original language (e.g., English), and segment the transcribed text into logical clips/phrases. The total duration of this audio file is exactly ${audioDuration.toFixed(2)} seconds.
CRITICAL: Segment the speech naturally at logical pauses, sentence boundaries, or major phrase boundaries. Do NOT force a minimum duration for the segments. Keep the segments as natural, individual spoken phrases/sentences.

For each segment, you MUST generate and provide the transcripts:
1. text: The transcribed spoken dialogue in its original language.
2. text_hinglish: A copy of the "text" field.
3. text_hindi: A copy of the "text" field.
4. start_time in seconds (relative to the beginning of the audio, starting at 0.0).
5. end_time in seconds.
6. words: An array of words inside the "text" transcript, with their individual start_time and end_time timings.
7. words_hinglish: A copy of the "words" array.
8. words_hindi: A copy of the "words" array.

Ensure that the segments cover the whole audio timeline, and the start/end times are highly accurate based on the audio recording of ${audioDuration.toFixed(2)} seconds.`;
  }

  // Append storyteller instruction block to whatever prompt was constructed
  prompt += `\n\nADDITIONAL STORIES LAYOUT CUES:
For each segmented phrase/clip, you MUST also analyze the meaning/context of the narration text and determine the following storytelling visual properties:
1. "layout": The visual layout mode for this scene (choose from: "graph", "versus", "quote", "stat_callout", "timeline_checkpoint", "danger_callout", "progress_ratio", "pro_tip", "versus_meter", "tier_list_ranker", "full_broll"). Use "versus" for confrontations/rivalries, "quote" when direct statements or thoughts are narrated, "stat_callout" for historical years/dates, currency values, or percentages, "timeline_checkpoint" to mark historical milestones, "graph" to show relationships/connections, "danger_callout" for caution/warnings/mistakes, "progress_ratio" for percentage progress bars, "pro_tip" for actionable tips, "versus_meter" for comparison balance sliders, "tier_list_ranker" for rank grades (S/A/B/C/F), and "full_broll" for descriptive narration.
2. "layoutProps": An object containing specific properties for the chosen layout (leave empty if not applicable):
    - "quoteText": The quote content (string, if layout is "quote").
    - "quoteAuthor": The author of the quote (string, if layout is "quote").
    - "statValue": The large number/year/stat to display (string, if layout is "stat_callout").
    - "statLabel": The description of the statistic (string, if layout is "stat_callout").
    - "versusLeft": The name of the left-side rival (string, if layout is "versus").
    - "versusRight": The name of the right-side rival (string, if layout is "versus").
    - "versusLabel": Subtitle for the versus battle (string, if layout is "versus").
    - "versusLeftFeatures": A list of 2-3 key characteristics or specifications of the left rival (array of strings, if layout is "versus").
    - "versusRightFeatures": A list of 2-3 key characteristics or specifications of the right rival (array of strings, if layout is "versus").
    - "timelineDate": The key date/year for this milestone (string, if layout is "timeline_checkpoint").
    - "timelineLabel": The title of the milestone (string, if layout is "timeline_checkpoint").
    - "dangerTitle": Title of caution (string, if layout is "danger_callout").
    - "dangerText": Description of caution (string, if layout is "danger_callout").
    - "progressValue": Numeric percentage or completion value (string/number, if layout is "progress_ratio").
    - "progressLabel": Progress label (string, if layout is "progress_ratio").
    - "tipTitle": Tip title e.g. PRO TIP (string, if layout is "pro_tip").
    - "tipText": Tip advice text (string, if layout is "pro_tip").
    - "meterLeft": Left contender (string, if layout is "versus_meter").
    - "meterRight": Right contender (string, if layout is "versus_meter").
    - "meterValue": Percentage of left contender (0-100 number, if layout is "versus_meter").
    - "meterLabel": Meter description (string, if layout is "versus_meter").
    - "tierRank": Letter grade S/A/B/C/D/F (string, if layout is "tier_list_ranker").
    - "tierItem": Item being ranked (string, if layout is "tier_list_ranker").
    - "tierLabel": Tier label (string, if layout is "tier_list_ranker").
3. "ambientSoundscape": Background ambient soundscape loop (choose from: "none", "vintage_projector", "cyberpunk_hum", "nature_ambience", "tense_drone", "office_chatter", "war_rumblings").
4. "postProcessingPreset": Cinematic color grading filter (choose from: "none", "vintage_sepia", "cyber_neon", "noir_monochrome", "cinematic_warm").`;

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
            },
            layout: { type: 'STRING' },
            layoutProps: {
              type: 'OBJECT',
              properties: {
                quoteText: { type: 'STRING' },
                quoteAuthor: { type: 'STRING' },
                statValue: { type: 'STRING' },
                statLabel: { type: 'STRING' },
                versusLeft: { type: 'STRING' },
                versusRight: { type: 'STRING' },
                versusLabel: { type: 'STRING' },
                versusLeftFeatures: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                },
                versusRightFeatures: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                },
                timelineDate: { type: 'STRING' },
                timelineLabel: { type: 'STRING' },
                dangerTitle: { type: 'STRING' },
                dangerText: { type: 'STRING' },
                progressValue: { type: 'STRING' },
                progressLabel: { type: 'STRING' },
                tipTitle: { type: 'STRING' },
                tipText: { type: 'STRING' },
                meterLeft: { type: 'STRING' },
                meterRight: { type: 'STRING' },
                meterValue: { type: 'STRING' },
                meterLabel: { type: 'STRING' },
                tierRank: { type: 'STRING' },
                tierItem: { type: 'STRING' },
                tierLabel: { type: 'STRING' }
              }
            },
            ambientSoundscape: { type: 'STRING' },
            postProcessingPreset: { type: 'STRING' }
          },
          required: ['text', 'text_hindi', 'text_hinglish', 'start_time', 'end_time', 'words', 'words_hindi', 'words_hinglish', 'layout', 'ambientSoundscape', 'postProcessingPreset']
        }
      }
    }
  });


  const resultText = response.text;
  console.log('Gemini Alignment Result:', resultText);
  const parsed = JSON.parse(resultText);

  if (!isHindiOrHinglish && Array.isArray(parsed)) {
    console.log('[Gemini Aligner] Non-Hindi/Hinglish script detected. Programmatically overriding text_hindi and text_hinglish to retain original language.');
    for (const item of parsed) {
      if (item) {
        // Enforce the original language text
        item.text_hindi = item.text;
        item.text_hinglish = item.text;
        
        // Also map the words
        if (item.words) {
          item.words_hindi = JSON.parse(JSON.stringify(item.words));
          item.words_hinglish = JSON.parse(JSON.stringify(item.words));
        }
      }
    }
  }

  return parsed;
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
    // 1. Get original video duration
    let duration = await getAudioDuration(filePath);
    if (!duration || duration <= 0) {
      console.warn(`[Gemini Recreate] Failed to parse video duration. Falling back to 15.0s.`);
      duration = 15.0;
    }
    console.log(`[Gemini Recreate] Original video duration: ${duration.toFixed(2)}s`);

    // 2. Compress the video to keep base64 payload under limits
    await compressVideo(filePath, lowresPath);
    
    // 3. Read the low-res compressed video
    const mimeType = getMimeType(lowresPath);
    const fileBuffer = fs.readFileSync(lowresPath);
    const base64Data = fileBuffer.toString('base64');
    
    // Clean up low-res file
    try {
      fs.unlinkSync(lowresPath);
    } catch (_) {}

    console.log('[Gemini Recreate] Sending video for Reel analysis...');
    const prompt = `Analyze this video reel. It consists of multiple video clips merged together, and on-screen text overlays.
The video's total duration is exactly ${duration.toFixed(2)} seconds. All scene start_time and end_time values, and textOverlay start_time and end_time values, must be specified in absolute seconds relative to the start of the video (from 0 to ${duration.toFixed(2)} seconds).
Do NOT normalize the timestamps (e.g. do NOT output them in the range 0 to 1). The absolute timestamps must span the entire ${duration.toFixed(2)} seconds.

Provide a structured JSON breakdown containing:
1. "description": A short summary of the overall reel (1-2 sentences).
2. "scenes": A list of video scenes/clips. Detect where the clips change (scene cuts). For each scene, provide:
   - "start_time": Start time of the scene in seconds (absolute time, e.g. 0 or 4.5).
   - "end_time": End time of the scene in seconds (absolute time, e.g. 4.5 or 9.2).
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
    let result = JSON.parse(resultText);

    // Smart Post-processing and scaling
    if (result && typeof result === 'object' && duration > 0) {
      let maxTime = 0;
      if (result.scenes && Array.isArray(result.scenes)) {
        for (const s of result.scenes) {
          if (s.start_time > maxTime) maxTime = s.start_time;
          if (s.end_time > maxTime) maxTime = s.end_time;
        }
      }
      if (result.textOverlays && Array.isArray(result.textOverlays)) {
        for (const t of result.textOverlays) {
          if (t.start_time > maxTime) maxTime = t.start_time;
          if (t.end_time > maxTime) maxTime = t.end_time;
        }
      }

      // If maximum timestamp is normalized (<= 1.05, or <= 1.5 when the video is significantly longer), scale up
      const isNormalized = maxTime > 0 && (maxTime <= 1.05 || (maxTime <= 1.5 && duration > 3.0 * maxTime));
      if (duration > 2.0 && isNormalized) {
        console.log(`[Gemini Recreate] Detected normalized timestamps (maxTime=${maxTime}). Scaling all times by duration=${duration}s.`);
        const scaleFactor = duration;
        if (result.scenes && Array.isArray(result.scenes)) {
          for (const s of result.scenes) {
            s.start_time = Number((s.start_time * scaleFactor).toFixed(3));
            s.end_time = Number((s.end_time * scaleFactor).toFixed(3));
          }
        }
        if (result.textOverlays && Array.isArray(result.textOverlays)) {
          for (const t of result.textOverlays) {
            t.start_time = Number((t.start_time * scaleFactor).toFixed(3));
            t.end_time = Number((t.end_time * scaleFactor).toFixed(3));
          }
        }
      } else {
        // Just make sure the final scene ends exactly at duration if close
        if (result.scenes && Array.isArray(result.scenes) && result.scenes.length > 0) {
          const lastScene = result.scenes[result.scenes.length - 1];
          if (lastScene.end_time < duration && (duration - lastScene.end_time < 2.0)) {
            console.log(`[Gemini Recreate] Adjusting last scene end_time from ${lastScene.end_time}s to ${duration}s.`);
            lastScene.end_time = Number(duration.toFixed(3));
          }
        }
      }
    }

    return result;
    
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

/**
 * Generates a full YouTube long-form script (1200+ words) and structured storyboard scenes
 */
export async function generateYoutubeScriptAndStoryboard(topic, niche, apiKey) {
  const aiClient = getAiClient(apiKey);
  console.log(`[Gemini] Generating long-form YouTube script for topic: "${topic}" under niche: "${niche}"...`);

  const prompt = `You are the chief copywriter and editor for a premium YouTube channel brand family named "${niche}".
Your goal is to write a comprehensive, highly educational, storytelling-focused script of approximately 1200-1500 words about the topic: "${topic}".
The target audience wants to listen to this video and feel they gained massive value, so make the script intellectually rich, engaging, and detailed. DO NOT use generic summaries, abbreviations, or placeholders like "[Insert story here]". Write the complete spoken words.

You must structure the script into consecutive, short storyboard scenes.
Each scene must represent between 4 to 8 seconds of speech (about 10 to 20 words per scene).
For each scene, you must provide:
1. "text": The narration text for the scene.
2. "visualDescription": A description of the ideal stock footage B-roll to display.
3. "sfxKeywords": 2-3 search query keywords to find this footage on Pexels/Pixabay (e.g. "rainy window", "ancient marble statue", "meditation silhouette").
4. "transition": Recommended video transition (choose from: "none", "fade", "slide-left", "slide-right", "zoom-in", "zoom-out").
5. "sfx": Suggested cut sound effect (choose from: "none", "cinematic-swoosh", "trans_paper_slide", "trans_glitch_digital", "reveal_ding_bell", "reveal_pop_bubble").
6. "shake": Boolean, set to true if the narration text of this scene contains strong action verbs or high impact keywords (e.g., "clashed", "severed", "boomed", "fused", "shattered", "exploded"). Otherwise false.
7. "shakeIntensity": Integer between 10 and 45 representing the pixel shake offset if shake is true (default 20).
8. "shakeSpeed": Integer between 10 and 30 representing the frequency of the shake in Hz if shake is true (default 18).
9. "layout": The visual layout mode for this scene (choose from: "graph", "versus", "quote", "stat_callout", "timeline_checkpoint", "danger_callout", "progress_ratio", "pro_tip", "versus_meter", "tier_list_ranker", "full_broll"). Use "versus" for confrontations/rivalries, "quote" when direct statements or thoughts are narrated, "stat_callout" for historical years/dates, currency values, or percentages, "timeline_checkpoint" to mark historical milestones, "graph" to show relationships/connections, "danger_callout" for warnings/caution/mistakes, "progress_ratio" for percentage progress bars, "pro_tip" for actionable tips, "versus_meter" for comparison balance sliders, "tier_list_ranker" for rank grades (S/A/B/C/F), and "full_broll" for descriptive narration.
10. "layoutProps": An object containing specific properties for the chosen layout (leave empty if not applicable):
    - "quoteText": The quote content (string, if layout is "quote").
    - "quoteAuthor": The author of the quote (string, if layout is "quote").
    - "statValue": The large number/year/stat to display (string, if layout is "stat_callout").
    - "statLabel": The description of the statistic (string, if layout is "stat_callout").
    - "versusLeft": The name of the left-side rival (string, if layout is "versus").
    - "versusRight": The name of the right-side rival (string, if layout is "versus").
    - "versusLabel": Subtitle for the versus battle (string, if layout is "versus").
    - "versusLeftFeatures": A list of 2-3 key characteristics or specifications of the left rival (array of strings, if layout is "versus").
    - "versusRightFeatures": A list of 2-3 key characteristics or specifications of the right rival (array of strings, if layout is "versus").
    - "timelineDate": The key date/year for this milestone (string, if layout is "timeline_checkpoint").
    - "timelineLabel": The title of the milestone (string, if layout is "timeline_checkpoint").
    - "dangerTitle": Title of caution (string, if layout is "danger_callout").
    - "dangerText": Description of caution (string, if layout is "danger_callout").
    - "progressValue": Numeric percentage value (string/number, if layout is "progress_ratio").
    - "progressLabel": Progress description label (string, if layout is "progress_ratio").
    - "tipTitle": Tip title e.g. PRO TIP (string, if layout is "pro_tip").
    - "tipText": Tip advice text (string, if layout is "pro_tip").
    - "meterLeft": Left contender (string, if layout is "versus_meter").
    - "meterRight": Right contender (string, if layout is "versus_meter").
    - "meterValue": Percentage of left contender (0-100, if layout is "versus_meter").
    - "meterLabel": Meter description (string, if layout is "versus_meter").
    - "tierRank": Letter grade S/A/B/C/D/F (string, if layout is "tier_list_ranker").
    - "tierItem": Item being ranked (string, if layout is "tier_list_ranker").
    - "tierLabel": Tier label (string, if layout is "tier_list_ranker").
11. "ambientSoundscape": Background ambient soundscape loop (choose from: "none", "vintage_projector", "cyberpunk_hum", "nature_ambience", "tense_drone", "office_chatter", "war_rumblings").
12. "postProcessingPreset": Cinematic color grading filter (choose from: "none", "vintage_sepia", "cyber_neon", "noir_monochrome", "cinematic_warm").

Generate a title for the video and output the result in structured JSON.`;

  const requestConfig = {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          scriptText: { type: 'STRING' },
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                visualDescription: { type: 'STRING' },
                sfxKeywords: { type: 'STRING' },
                transition: { type: 'STRING' },
                sfx: { type: 'STRING' },
                shake: { type: 'BOOLEAN' },
                shakeIntensity: { type: 'INTEGER' },
                shakeSpeed: { type: 'INTEGER' },
                layout: { type: 'STRING' },
                layoutProps: {
                  type: 'OBJECT',
                  properties: {
                    quoteText: { type: 'STRING' },
                    quoteAuthor: { type: 'STRING' },
                    statValue: { type: 'STRING' },
                    statLabel: { type: 'STRING' },
                    versusLeft: { type: 'STRING' },
                    versusRight: { type: 'STRING' },
                    versusLabel: { type: 'STRING' },
                    versusLeftFeatures: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    versusRightFeatures: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    timelineDate: { type: 'STRING' },
                    timelineLabel: { type: 'STRING' },
                    dangerTitle: { type: 'STRING' },
                    dangerText: { type: 'STRING' },
                    progressValue: { type: 'STRING' },
                    progressLabel: { type: 'STRING' },
                    tipTitle: { type: 'STRING' },
                    tipText: { type: 'STRING' },
                    meterLeft: { type: 'STRING' },
                    meterRight: { type: 'STRING' },
                    meterValue: { type: 'STRING' },
                    meterLabel: { type: 'STRING' },
                    tierRank: { type: 'STRING' },
                    tierItem: { type: 'STRING' },
                    tierLabel: { type: 'STRING' }
                  }
                },
                ambientSoundscape: { type: 'STRING' },
                postProcessingPreset: { type: 'STRING' }
              },
              required: ['text', 'visualDescription', 'sfxKeywords', 'transition', 'sfx', 'layout', 'ambientSoundscape', 'postProcessingPreset']
            }
          }
        },
        required: ['title', 'scriptText', 'scenes']
      }
    }
  };

  const response = await generateContentWithFallback(aiClient, requestConfig);
  return JSON.parse(response.text);
}

/**
 * Generates a short promo Reel script (30-50s) ending in suspense from the long script
 */
export async function generateYoutubeShortScript(longScriptText, apiKey) {
  const aiClient = getAiClient(apiKey);
  console.log('[Gemini] Generating promotional suspense Short script from long-form script...');

  const prompt = `You are a viral YouTube Shorts and Instagram Reels marketing expert.
Read the following long-form script and write a highly engaging 30-50 second promotional Short script (about 70-110 words total).
The Short MUST:
1. Start with a powerful hook.
2. Tell a fascinating story or share a bizarre fact from the long script.
3. Stop abruptly in intense suspense / cliffhanger.
4. Direct the viewer to watch the full video to find out the resolution (e.g., "But what Marcus Aurelius did next shocked his enemies. To see the full story, watch the linked video below").

Structure the Short into 4-6 consecutive scenes (each 4-8 seconds).
For each scene, provide:
1. "text": The spoken narration.
2. "visualDescription": A description of the ideal stock B-roll.
3. "sfxKeywords": 2-3 search query keywords for Pexels/Pixabay (should be vertical portrait videos).
4. "transition": Video transition (choose from: "none", "fade", "slide-up", "slide-down", "zoom-in").
5. "sfx": Sound effect (choose from: "none", "cinematic-swoosh", "hook_bass_drop", "hook_vinyl_scratch", "reveal_swoosh_zip").
6. "shake": Boolean, set to true if the narration text of this scene contains strong action verbs or high impact keywords (e.g., "clashed", "severed", "boomed", "fused", "shattered", "exploded"). Otherwise false.
7. "shakeIntensity": Integer between 10 and 45 representing the pixel shake offset if shake is true (default 20).
8. "shakeSpeed": Integer between 10 and 30 representing the frequency of the shake in Hz if shake is true (default 18).
9. "layout": The visual layout mode for this scene (choose from: "graph", "versus", "quote", "stat_callout", "timeline_checkpoint", "danger_callout", "progress_ratio", "pro_tip", "versus_meter", "tier_list_ranker", "full_broll"). Use "versus" for confrontations/rivalries, "quote" when direct statements or thoughts are narrated, "stat_callout" for historical years/dates, currency values, or percentages, "timeline_checkpoint" to mark historical milestones, "graph" to show relationships/connections, "danger_callout" for warnings/caution/mistakes, "progress_ratio" for percentage progress bars, "pro_tip" for actionable tips, "versus_meter" for comparison balance sliders, "tier_list_ranker" for rank grades (S/A/B/C/F), and "full_broll" for descriptive narration.
10. "layoutProps": An object containing specific properties for the chosen layout (leave empty if not applicable):
    - "quoteText": The quote content (string, if layout is "quote").
    - "quoteAuthor": The author of the quote (string, if layout is "quote").
    - "statValue": The large number/year/stat to display (string, if layout is "stat_callout").
    - "statLabel": The description of the statistic (string, if layout is "stat_callout").
    - "versusLeft": The name of the left-side rival (string, if layout is "versus").
    - "versusRight": The name of the right-side rival (string, if layout is "versus").
    - "versusLabel": Subtitle for the versus battle (string, if layout is "versus").
    - "versusLeftFeatures": A list of 2-3 key characteristics or specifications of the left rival (array of strings, if layout is "versus").
    - "versusRightFeatures": A list of 2-3 key characteristics or specifications of the right rival (array of strings, if layout is "versus").
    - "timelineDate": The key date/year for this milestone (string, if layout is "timeline_checkpoint").
    - "timelineLabel": The title of the milestone (string, if layout is "timeline_checkpoint").
    - "dangerTitle": Title of caution (string, if layout is "danger_callout").
    - "dangerText": Description of caution (string, if layout is "danger_callout").
    - "progressValue": Numeric percentage value (string/number, if layout is "progress_ratio").
    - "progressLabel": Progress description label (string, if layout is "progress_ratio").
    - "tipTitle": Tip title e.g. PRO TIP (string, if layout is "pro_tip").
    - "tipText": Tip advice text (string, if layout is "pro_tip").
    - "meterLeft": Left contender (string, if layout is "versus_meter").
    - "meterRight": Right contender (string, if layout is "versus_meter").
    - "meterValue": Percentage of left contender (0-100, if layout is "versus_meter").
    - "meterLabel": Meter description (string, if layout is "versus_meter").
    - "tierRank": Letter grade S/A/B/C/D/F (string, if layout is "tier_list_ranker").
    - "tierItem": Item being ranked (string, if layout is "tier_list_ranker").
    - "tierLabel": Tier label (string, if layout is "tier_list_ranker").
11. "ambientSoundscape": Background ambient soundscape loop (choose from: "none", "vintage_projector", "cyberpunk_hum", "nature_ambience", "tense_drone", "office_chatter", "war_rumblings").
12. "postProcessingPreset": Cinematic color grading filter (choose from: "none", "vintage_sepia", "cyber_neon", "noir_monochrome", "cinematic_warm").

Long-form Script:
"""
${longScriptText}
"""

Output the result in structured JSON.`;

  const requestConfig = {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          scriptText: { type: 'STRING' },
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                visualDescription: { type: 'STRING' },
                sfxKeywords: { type: 'STRING' },
                transition: { type: 'STRING' },
                sfx: { type: 'STRING' },
                shake: { type: 'BOOLEAN' },
                shakeIntensity: { type: 'INTEGER' },
                shakeSpeed: { type: 'INTEGER' },
                layout: { type: 'STRING' },
                 layoutProps: {
                  type: 'OBJECT',
                  properties: {
                    quoteText: { type: 'STRING' },
                    quoteAuthor: { type: 'STRING' },
                    statValue: { type: 'STRING' },
                    statLabel: { type: 'STRING' },
                    versusLeft: { type: 'STRING' },
                    versusRight: { type: 'STRING' },
                    versusLabel: { type: 'STRING' },
                    versusLeftFeatures: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    versusRightFeatures: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    timelineDate: { type: 'STRING' },
                    timelineLabel: { type: 'STRING' },
                    dangerTitle: { type: 'STRING' },
                    dangerText: { type: 'STRING' },
                    progressValue: { type: 'STRING' },
                    progressLabel: { type: 'STRING' },
                    tipTitle: { type: 'STRING' },
                    tipText: { type: 'STRING' },
                    meterLeft: { type: 'STRING' },
                    meterRight: { type: 'STRING' },
                    meterValue: { type: 'STRING' },
                    meterLabel: { type: 'STRING' },
                    tierRank: { type: 'STRING' },
                    tierItem: { type: 'STRING' },
                    tierLabel: { type: 'STRING' }
                  }
                },
                ambientSoundscape: { type: 'STRING' },
                postProcessingPreset: { type: 'STRING' }
              },
              required: ['text', 'visualDescription', 'sfxKeywords', 'transition', 'sfx', 'layout', 'ambientSoundscape', 'postProcessingPreset']
            }
          }
        },
        required: ['title', 'scriptText', 'scenes']
      }
    }
  };

  const response = await generateContentWithFallback(aiClient, requestConfig);
  return JSON.parse(response.text);
}

/**
 * Bulk enriches B-roll keywords and visual descriptions for scenes using Gemini
 */
export async function enrichScenesMetadata(scenesToEnrich, apiKey) {
  if (!scenesToEnrich || scenesToEnrich.length === 0) return [];
  const aiClient = getAiClient(apiKey);
  console.log(`[Gemini] Bulk-enriching B-roll keywords and descriptions for ${scenesToEnrich.length} scenes...`);

  // Map each scene to an index and its text so the model knows how to reply
  const sceneItems = scenesToEnrich.map((s, idx) => ({
    index: idx,
    text: s.text
  }));

  const prompt = `You are a video production director. You are given a list of narration sentences from a video script.
For each sentence, analyze the words being spoken and generate:
1. "visualDescription": A description of a highly relevant B-roll stock footage video clip that visually represents the actions, objects, or themes described in the sentence. Avoid generic "abstract" descriptions unless the sentence itself is purely abstract.
2. "sfxKeywords": 2-3 specific search keywords to fetch this clip on stock video platforms like Pexels or Pixabay (e.g., if the sentence is "you are looking at your phone", the keywords should be "using smartphone, typing phone"). DO NOT use generic words like "cinematic", "abstract", "whoosh", "swoosh", or the transition names.

Input scenes:
${JSON.stringify(sceneItems, null, 2)}

Output the result in structured JSON as an array of objects matching the input index order.`;

  const requestConfig = {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          enrichedScenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                index: { type: 'INTEGER' },
                visualDescription: { type: 'STRING' },
                sfxKeywords: { type: 'STRING' }
              },
              required: ['index', 'visualDescription', 'sfxKeywords']
            }
          }
        },
        required: ['enrichedScenes']
      }
    }
  };

  const response = await generateContentWithFallback(aiClient, requestConfig);
  const data = JSON.parse(response.text);
  return data.enrichedScenes || [];
}

/**
 * Auto-suggests layouts, properties, soundscapes, color presets, transitions, and SFX for scenes using Gemini
 */
export async function suggestStorytellerAndAssetsForScenes(scenes, scriptText, apiKey) {
  const aiClient = getAiClient(apiKey);
  console.log(`[Gemini] Auto-suggesting storyteller layouts and transitions for ${scenes.length} scenes...`);

  const sceneItems = scenes.map((s, idx) => ({
    index: idx,
    text: s.text,
    visualDescription: s.visualDescription || ''
  }));

  const prompt = `You are a professional video editor and director. 
We have a video script divided into consecutive storyboard scenes. 
For each scene, you must analyze its narration text and visual description, and determine the optimal cinematic storyteller properties (layout, layoutProps, ambientSoundscape, postProcessingPreset) and asset transition/sound effect settings to make the video highly engaging, professional, and visually stunning.

Here is the list of scenes (JSON format, containing scene index, text, and visual description):
${JSON.stringify(sceneItems, null, 2)}

Rules for Storyteller visual properties:
1. "layout": Choose from: "graph", "versus", "quote", "stat_callout", "timeline_checkpoint", "danger_callout", "progress_ratio", "pro_tip", "versus_meter", "tier_list_ranker", "full_broll"). Use "versus" for confrontations/rivalries, "quote" when direct statements or thoughts are narrated, "stat_callout" for historical years/dates, currency values, or percentages, "timeline_checkpoint" to mark historical milestones, "graph" to show relationships/connections, "danger_callout" for warnings/caution/mistakes, "progress_ratio" for percentage progress bars, "pro_tip" for actionable tips, "versus_meter" for comparison balance sliders, "tier_list_ranker" for rank grades (S/A/B/C/F), and "full_broll" for descriptive narration.
2. "layoutProps": An object containing specific properties for the chosen layout (leave empty/null if layout is "graph" or "full_broll"):
    - "quoteText": The quote content (string, if layout is "quote").
    - "quoteAuthor": The author of the quote (string, if layout is "quote").
    - "statValue": The large number/year/stat to display (string, if layout is "stat_callout").
    - "statLabel": The description of the statistic (string, if layout is "stat_callout").
    - "versusLeft": The name of the left-side rival (string, if layout is "versus").
    - "versusRight": The name of the right-side rival (string, if layout is "versus").
    - "versusLabel": Subtitle for the versus battle (string, if layout is "versus").
    - "versusLeftFeatures": A list of 2-3 key characteristics or specifications of the left rival (array of strings, if layout is "versus").
    - "versusRightFeatures": A list of 2-3 key characteristics or specifications of the right rival (array of strings, if layout is "versus").
    - "timelineDate": The key date/year for this milestone (string, if layout is "timeline_checkpoint").
    - "timelineLabel": The title of the milestone (string, if layout is "timeline_checkpoint").
    - "dangerTitle": Title of caution (string, if layout is "danger_callout").
    - "dangerText": Description of caution (string, if layout is "danger_callout").
    - "progressValue": Numeric percentage value (string/number, if layout is "progress_ratio").
    - "progressLabel": Progress description label (string, if layout is "progress_ratio").
    - "tipTitle": Tip title e.g. PRO TIP (string, if layout is "pro_tip").
    - "tipText": Tip advice text (string, if layout is "pro_tip").
    - "meterLeft": Left contender (string, if layout is "versus_meter").
    - "meterRight": Right contender (string, if layout is "versus_meter").
    - "meterValue": Percentage of left contender (0-100, if layout is "versus_meter").
    - "meterLabel": Meter description (string, if layout is "versus_meter").
    - "tierRank": Letter grade S/A/B/C/D/F (string, if layout is "tier_list_ranker").
    - "tierItem": Item being ranked (string, if layout is "tier_list_ranker").
    - "tierLabel": Tier label (string, if layout is "tier_list_ranker").
3. "ambientSoundscape": Background ambient soundscape loop (choose from: "none", "vintage_projector", "cyberpunk_hum", "nature_ambience", "tense_drone", "office_chatter", "war_rumblings"). Choose what best matches the mood of the scene.
4. "postProcessingPreset": Cinematic color grading filter (choose from: "none", "vintage_sepia", "cyber_neon", "noir_monochrome", "cinematic_warm"). Choose what best matches the scene's emotional tone.

Rules for Transitions, SFX, and Shake settings:
5. "transition": Video transition (choose from: "none", "fade", "slide-left", "slide-right", "zoom-in", "zoom-out").
6. "sfx": Cut sound effect (choose from: "none", "cinematic-swoosh", "trans_paper_slide", "trans_glitch_digital", "reveal_ding_bell", "reveal_pop_bubble").
7. "shake": Boolean, set to true if the narration text of this scene contains strong action verbs or high impact keywords (e.g., "clashed", "severed", "boomed", "fused", "shattered", "exploded"). Otherwise false.
8. "shakeIntensity": Integer between 10 and 45 representing the pixel shake offset if shake is true (default 20).
9. "shakeSpeed": Integer between 10 and 30 representing the frequency of the shake in Hz if shake is true (default 18).

Output the result in structured JSON.`;

  const requestConfig = {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                index: { type: 'INTEGER' },
                layout: { type: 'STRING' },
                layoutProps: {
                  type: 'OBJECT',
                  properties: {
                    quoteText: { type: 'STRING' },
                    quoteAuthor: { type: 'STRING' },
                    statValue: { type: 'STRING' },
                    statLabel: { type: 'STRING' },
                    versusLeft: { type: 'STRING' },
                    versusRight: { type: 'STRING' },
                    versusLabel: { type: 'STRING' },
                    versusLeftFeatures: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    versusRightFeatures: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    timelineDate: { type: 'STRING' },
                    timelineLabel: { type: 'STRING' },
                    dangerTitle: { type: 'STRING' },
                    dangerText: { type: 'STRING' },
                    progressValue: { type: 'STRING' },
                    progressLabel: { type: 'STRING' },
                    tipTitle: { type: 'STRING' },
                    tipText: { type: 'STRING' },
                    meterLeft: { type: 'STRING' },
                    meterRight: { type: 'STRING' },
                    meterValue: { type: 'STRING' },
                    meterLabel: { type: 'STRING' },
                    tierRank: { type: 'STRING' },
                    tierItem: { type: 'STRING' },
                    tierLabel: { type: 'STRING' }
                  }
                },
                ambientSoundscape: { type: 'STRING' },
                postProcessingPreset: { type: 'STRING' },
                transition: { type: 'STRING' },
                sfx: { type: 'STRING' },
                shake: { type: 'BOOLEAN' },
                shakeIntensity: { type: 'INTEGER' },
                shakeSpeed: { type: 'INTEGER' }
              },
              required: ['index', 'layout', 'ambientSoundscape', 'postProcessingPreset', 'transition', 'sfx', 'shake']
            }
          }
        },
        required: ['scenes']
      }
    }
  };

  const response = await generateContentWithFallback(aiClient, requestConfig);
  const data = JSON.parse(response.text);
  return data.scenes || [];
}


export async function extractStoryGraph(scriptText, scenes, apiKey) {
  const aiClient = getAiClient(apiKey);
  console.log(`[Gemini] Extracting story graph for script (${scenes.length} scenes)...`);
  
  const sceneItems = scenes.map((s, idx) => ({
    index: idx,
    text: s.text
  }));

  const prompt = `You are a script visualizer and graphic editor. Your goal is to convert a storyboard script into a "Living Scene Graph" visual experience.
A Living Scene Graph shows key subjects (people, organizations, concepts, objects) as nodes and their relationships as connecting lines, dynamically appearing and changing scene-by-scene.

Analyze the script and scenes, and extract:
1. "entities": A flat list of unique entities that appear in the script. Assign a clean string id to each (e.g. "steve_jobs", "iphone", "apple_inc").
   For each entity:
   - "id": Unique string identifier (snake_case, no spaces).
   - "name": Nice display name (e.g. "Steve Jobs").
   - "type": Choose exactly from: "character", "object", "concept", "organization", "location".

2. "graphEvents": A timeline of visual events mapped to scene indices (0-indexed matching the input scenes).
   Events should represent:
   - "introduce": Bring an entity onto the screen. Specify "sceneIndex", "entityId", and optionally "x" (0-100) and "y" (0-100) positions (e.g., center-left, center-right, or spread out so they do not overlap).
   - "remove": Fade out/remove an entity. Specify "sceneIndex" and "entityId".
   - "connect": Draw an animated line between two active entities. Specify "sceneIndex", "fromEntityId", "toEntityId", a brief "label" describing the connection (e.g., "created", "founded", "owns", "competed"), and a "sentiment" characterising the relationship (exactly one of: "positive" for collaboration/ally/merger, "conflict" for rivalry/fight/competition, or "neutral" for standard association).
   - "disconnect": Remove a connection. Specify "sceneIndex", "fromEntityId", "toEntityId".
   - "highlight": Pulse/highlight an entity when it is actively being discussed in that scene. Specify "sceneIndex" and "entityId".

3. "sceneContexts": A summary context for each scene. An array of objects:
   - "sceneIndex": Integer index of the scene.
   - "context": A brief (3-6 words) on-screen caption summarizing the primary action/relationship of the graph in this scene (e.g., "Steve Jobs introduces iPhone" or "Jobs and Wozniak found Apple"). Keep it concise.

CRITICAL VISUAL COMPACTION RULES:
- Keep the graph simple, clean, and local to each scene. Do not let nodes accumulate indefinitely across scenes.
- When the script transitions to new characters/objects or a new topic, make sure to explicitly emit "remove" events at that sceneIndex for older entities that are no longer actively mentioned.
- Typically, try to keep at most 3-4 active nodes on screen at any time to avoid clutter and confusion.

Input script:
"${scriptText}"

Input scenes:
${JSON.stringify(sceneItems, null, 2)}

Provide clean positions (x: 10-90, y: 15-85) for introduced entities so they spread out nicely on a 100x100 canvas.
Output the result in structured JSON.`;

  const requestConfig = {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          entities: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                name: { type: 'STRING' },
                type: { type: 'STRING', enum: ['character', 'object', 'concept', 'organization', 'location'] }
              },
              required: ['id', 'name', 'type']
            }
          },
          graphEvents: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                sceneIndex: { type: 'INTEGER' },
                action: { type: 'STRING', enum: ['introduce', 'remove', 'connect', 'disconnect', 'highlight'] },
                entityId: { type: 'STRING' },
                fromEntityId: { type: 'STRING' },
                toEntityId: { type: 'STRING' },
                label: { type: 'STRING' },
                sentiment: { type: 'STRING', enum: ['positive', 'conflict', 'neutral'] },
                x: { type: 'NUMBER' },
                y: { type: 'NUMBER' }
              },
              required: ['sceneIndex', 'action']
            }
          },
          sceneContexts: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                sceneIndex: { type: 'INTEGER' },
                context: { type: 'STRING' }
              },
              required: ['sceneIndex', 'context']
            }
          }
        },
        required: ['entities', 'graphEvents', 'sceneContexts']
      }
    }
  };

  const response = await generateContentWithFallback(aiClient, requestConfig);
  return JSON.parse(response.text);
}

/**
 * Uses Gemini to generate a viral video script and idea utilizing a list of library clips
 */
export async function generateViralVideoIdeaFromClips(libraryClips, apiKey) {
  const aiClient = getAiClient(apiKey);
  console.log('[Gemini] Pitching viral video idea from library clips...');

  const clipsDescriptionList = libraryClips.map((clip) => {
    return `- Clip ID: "${clip.id}"
  Filename: "${clip.name}"
  Duration: ${clip.duration}s
  Description: "${clip.description || 'No description available'}"
  Tags: [${(clip.tags || []).join(', ')}]`;
  }).join('\n\n');

  const prompt = `You are a viral YouTube Shorts and Instagram Reels marketing expert.
We have a library of local videos. Here is the list of available video clips with their descriptions and tags:
${clipsDescriptionList}

Your task is to:
1. Look into all the uploaded videos and their context/descriptions.
2. Generate a cohesive, highly engaging viral video idea (30-50 seconds, about 70-110 words total) that can be constructed by combining a sequence of these library clips.
3. You MUST map each part of the script to a specific clip from the library. Do NOT invent clip IDs. Only use clip IDs from the list above.
4. Structure the script into 4-6 consecutive scenes (each scene should play for 4 to 8 seconds).
5. For each scene, specify which library clip to use by providing its "clipId", and specify the "clipStart" offset (in seconds) within that clip.
   Ensure that "clipStart" + the scene's duration does not exceed the library clip's total duration! (If a library clip's duration is 10s, and the scene is 5s, clipStart must be between 0 and 5).
6. Provide a descriptive spoken narration text in Hinglish/English for each scene.

CRITICAL Rules for Clip Selection:
- You MUST maximize the variety of clips used. Avoid reusing the same clip ID multiple times if there are other matching clips available in the library.
- You MUST NOT use the same clip ID in two consecutive scenes.
- Every scene must use a unique clip ID from the library, unless you have fewer library clips than scenes.

For each scene, output:
- "text": The spoken narration.
- "clipId": The ID of the matching clip from the library (MUST be from the list).
- "clipStart": Start time in seconds (relative to the beginning of the library clip).
- "clipDuration": The duration of this scene in seconds (4-8 seconds).
- "visualDescription": Why this clip is a good visual match for the narration.
- "transition": Recommended video transition (choose from: "none", "fade", "slide-up", "slide-down", "zoom-in").
- "sfx": Sound effect (choose from: "none", "cinematic-swoosh", "hook_bass_drop", "hook_vinyl_scratch", "reveal_swoosh_zip").
- "shake": Boolean, set to true if the narration text contains strong action/impact words.
- "layout": Visual layout mode (choose from: "graph", "versus", "quote", "stat_callout", "timeline_checkpoint", "danger_callout", "progress_ratio", "pro_tip", "versus_meter", "tier_list_ranker", "full_broll").
- "layoutProps": An object containing specific properties for the chosen layout (leave empty if not applicable):
    - "quoteText": The quote content (string, if layout is "quote").
    - "quoteAuthor": The author of the quote (string, if layout is "quote").
    - "statValue": The large number/year/stat to display (string, if layout is "stat_callout").
    - "statLabel": The description of the statistic (string, if layout is "stat_callout").
    - "versusLeft": The name of the left-side rival (string, if layout is "versus").
    - "versusRight": The name of the right-side rival (string, if layout is "versus").
    - "versusLabel": Subtitle for the versus battle (string, if layout is "versus").
    - "versusLeftFeatures": A list of 2-3 key characteristics or specifications of the left rival (array of strings, if layout is "versus").
    - "versusRightFeatures": A list of 2-3 key characteristics or specifications of the right rival (array of strings, if layout is "versus").
    - "timelineDate": The key date/year for this milestone (string, if layout is "timeline_checkpoint").
    - "timelineLabel": The title of the milestone (string, if layout is "timeline_checkpoint").
    - "dangerTitle": Title of caution (string, if layout is "danger_callout").
    - "dangerText": Description of caution (string, if layout is "danger_callout").
    - "progressValue": Numeric percentage value (string/number, if layout is "progress_ratio").
    - "progressLabel": Progress description label (string, if layout is "progress_ratio").
    - "tipTitle": Tip title e.g. PRO TIP (string, if layout is "pro_tip").
    - "tipText": Tip advice text (string, if layout is "pro_tip").
    - "meterLeft": Left contender (string, if layout is "versus_meter").
    - "meterRight": Right contender (string, if layout is "versus_meter").
    - "meterValue": Percentage of left contender (0-100, if layout is "versus_meter").
    - "meterLabel": Meter description (string, if layout is "versus_meter").
    - "tierRank": Letter grade S/A/B/C/D/F (string, if layout is "tier_list_ranker").
    - "tierItem": Item being ranked (string, if layout is "tier_list_ranker").
    - "tierLabel": Tier label (string, if layout is "tier_list_ranker").
- "ambientSoundscape": Background ambient soundscape loop (choose from: "none", "vintage_projector", "cyberpunk_hum", "nature_ambience", "tense_drone", "office_chatter", "war_rumblings").
- "postProcessingPreset": Cinematic color grading filter (choose from: "none", "vintage_sepia", "cyber_neon", "noir_monochrome", "cinematic_warm").

Output the result in structured JSON.`;

  const requestConfig = {
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          scriptText: { type: 'STRING' },
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                clipId: { type: 'STRING' },
                clipStart: { type: 'NUMBER' },
                clipDuration: { type: 'NUMBER' },
                visualDescription: { type: 'STRING' },
                transition: { type: 'STRING' },
                sfx: { type: 'STRING' },
                shake: { type: 'BOOLEAN' },
                shakeIntensity: { type: 'INTEGER' },
                shakeSpeed: { type: 'INTEGER' },
                layout: { type: 'STRING' },
                layoutProps: {
                  type: 'OBJECT',
                  properties: {
                    quoteText: { type: 'STRING' },
                    quoteAuthor: { type: 'STRING' },
                    statValue: { type: 'STRING' },
                    statLabel: { type: 'STRING' },
                    versusLeft: { type: 'STRING' },
                    versusRight: { type: 'STRING' },
                    versusLabel: { type: 'STRING' },
                    versusLeftFeatures: { type: 'ARRAY', items: { type: 'STRING' } },
                    versusRightFeatures: { type: 'ARRAY', items: { type: 'STRING' } },
                    timelineDate: { type: 'STRING' },
                    timelineLabel: { type: 'STRING' },
                    dangerTitle: { type: 'STRING' },
                    dangerText: { type: 'STRING' },
                    progressValue: { type: 'NUMBER' },
                    progressLabel: { type: 'STRING' },
                    tipTitle: { type: 'STRING' },
                    tipText: { type: 'STRING' },
                    meterLeft: { type: 'STRING' },
                    meterRight: { type: 'STRING' },
                    meterValue: { type: 'NUMBER' },
                    meterLabel: { type: 'STRING' },
                    tierRank: { type: 'STRING' },
                    tierItem: { type: 'STRING' },
                    tierLabel: { type: 'STRING' }
                  }
                },
                ambientSoundscape: { type: 'STRING' },
                postProcessingPreset: { type: 'STRING' }
              },
              required: ['text', 'clipId', 'clipStart', 'clipDuration']
            }
          }
        },
        required: ['title', 'scriptText', 'scenes']
      }
    }
  };

  const response = await generateContentWithFallback(aiClient, requestConfig);
  return JSON.parse(response.text);
}
