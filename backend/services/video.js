import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.resolve(__dirname, '..', 'fonts').replace(/\\/g, '/');

function shapeDevanagari(text) {
  if (!text) return text;
  // Regex matches a consonant cluster followed by the choti ee matra (ि)
  const regex = /((?:[\u0915-\u0939\u0958-\u095F]\u094d)*[\u0915-\u0939\u0958-\u095F])\u093f/g;
  return text.replace(regex, '\u093f$1');
}

/**
 * Ensures a Google Font TTF file exists in the fonts directory.
 * If missing, it downloads it dynamically from Google Webfonts Helper.
 */
export async function ensureFontExists(fontName) {
  if (!fontName || fontName.toLowerCase() === 'arial' || fontName.toLowerCase() === 'sans-serif') {
    return true;
  }
  
  // Format Kalam Bold to Kalam
  let searchName = fontName;
  if (fontName === 'Kalam Bold' || fontName === 'Kalam Light' || fontName === 'Kalam Regular') {
    searchName = 'Kalam';
  }
  
  const fontFileName = `${searchName}-Regular.ttf`;
  const destPath = path.join(fontsDir, fontFileName);

  // If the file already exists, return true immediately
  if (existsSync(destPath)) {
    return true;
  }

  const fontId = searchName.toLowerCase().replace(/\s+/g, '-');
  console.log(`Font ${searchName} not found locally. Attempting to download from Google Webfonts Helper...`);

  try {
    const apiUrl = `https://gwfh.mranftl.com/api/fonts/${fontId}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      throw new Error(`Font "${searchName}" not found on Google Fonts API`);
    }

    const fontData = await res.json();
    
    // Find regular or 400 variant
    const regularVariant = fontData.variants.find(v => v.id === 'regular' || v.id === '400') || fontData.variants[0];

    if (!regularVariant || !regularVariant.ttf) {
      throw new Error(`No TTF format found for Google Font: ${searchName}`);
    }

    const downloadUrl = regularVariant.ttf;
    console.log(`Downloading ${searchName} TTF from: ${downloadUrl}`);
    
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to download TTF file: ${fileRes.statusText}`);
    }

    const buffer = await fileRes.arrayBuffer();
    
    // Ensure fonts directory exists
    await fs.mkdir(fontsDir, { recursive: true });
    await fs.writeFile(destPath, Buffer.from(buffer));
    console.log(`Successfully downloaded and saved Google Font ${searchName} to: ${destPath}`);
    return true;
  } catch (err) {
    console.error(`Failed to automatically download Google Font ${searchName}:`, err.message);
    throw err;
  }
}

/**
 * Executes an FFmpeg command and returns a promise
 */
function runFFmpeg(args, options = {}) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = ['-nostdin', ...args];
    console.log(`Running FFmpeg: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
    
    const spawnOptions = {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    };

    const proc = spawn(ffmpegPath, ffmpegArgs, spawnOptions);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}\nStderr: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parses video duration using ffmpeg -i
 */
export async function getVideoDuration(filePath) {
  try {
    // We run ffmpeg with no output files to get the file info in stderr
    const { stderr } = await runFFmpeg(['-i', filePath]).catch(err => {
      // ffmpeg exits with code 1 when no output file is specified, which is expected
      if (err.message.includes('Stderr:')) {
        return { stderr: err.message };
      }
      throw err;
    });

    const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const centiseconds = parseInt(match[4], 10);
      return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }
    
    // Fallback if not found
    return 10.0;
  } catch (error) {
    console.error(`Error getting duration for ${filePath}:`, error);
    return 10.0;
  }
}

/**
 * Extracts a thumbnail at 1s mark
 */
export async function generateThumbnail(videoPath, thumbnailPath) {
  const args = [
    '-ss', '00:00:00.500', // Take frame at 0.5s
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2', // High quality JPEG
    '-y',
    thumbnailPath
  ];
  await runFFmpeg(args);
  return thumbnailPath;
}

/**
 * Helper to convert standard hex color (e.g. #FF5733) to ASS format (&H00BBGGRR)
 */
function hexToAssColor(hex, alphaHex = '00') {
  if (!hex) return `&H${alphaHex}FFFFFF`;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    return `&H${alphaHex}FFFFFF`;
  }
  const r = cleanHex.substring(0, 2);
  const g = cleanHex.substring(2, 4);
  const b = cleanHex.substring(4, 6);
  // ASS format is Alpha-Blue-Green-Red in hex
  return `&H${alphaHex}${b}${g}${r}`;
}

/**
 * Generates an ASS subtitle file content
 */
/**
 * Generates an ASS vector shape for a centered rounded rectangle
 */
function drawCenteredRoundedRect(w, h, r) {
  const x1 = 0;
  const x2 = w;
  const y1 = 0;
  const y2 = h;
  r = Math.min(r, w / 2, h / 2);
  
  if (r <= 0) {
    return `m ${x1} ${y1} l ${x2} ${y1} l ${x2} ${y2} l ${x1} ${y2}`;
  }
  
  return `m ${x1 + r} ${y1} ` +
         `l ${x2 - r} ${y1} ` +
         `b ${x2} ${y1} ${x2} ${y1} ${x2} ${y1 + r} ` +
         `l ${x2} ${y2 - r} ` +
         `b ${x2} ${y2} ${x2} ${y2} ${x2 - r} ${y2} ` +
         `l ${x1 + r} ${y2} ` +
         `b ${x1} ${y2} ${x1} ${y2} ${x1} ${y2 - r} ` +
         `l ${x1} ${y1 + r} ` +
         `b ${x1} ${y1} ${x1} ${y1} ${x1 + r} ${y1}`;
}

const emojiMap = {
  // Original & Fitness
  'gym': '🏋️‍♂️', 'workout': '🏋️‍♂️', 'fitness': '💪', 'strong': '💪', 'training': '🏋️‍♂️', 'athlete': '🏃‍♂️', 'exercise': '🏋️‍♂️',
  'run': '🏃‍♂️', 'walk': '🏃‍♂️', 'jump': '🦘', 'swim': '🏊‍♂️', 'climb': '🧗‍♂️', 'wrestling': '🤼‍♂️', 'martial': '🥋', 'karate': '🥋', 'judo': '🥋', 'gymnastics': '🤸‍♂️', 'boxing': '🥊', 'punch': '🥊', 'fight': '🥊',

  // Money & Wealth
  'money': '💰', 'rich': '💰', 'million': '💵', 'billion': '💵', 'cash': '💵', 'dollar': '💵', 'wealth': '💰', 'broke': '💸', 'poor': '💸', 'bank': '🏦', 'card': '💳', 'credit': '💳', 'pay': '💵', 'buy': '🛒', 'sell': '📈', 'price': '🏷️', 'cost': '🏷️', 'bill': '💵', 'tax': '💸', 'gold': '🪙', 'coin': '🪙', 'diamond': '💎', 'gem': '💎', 'ring': '💍',

  // Power, Speed, Danger, Stop/Go
  'fire': '🔥', 'hot': '🔥', 'burn': '🔥', 'flame': '🔥',
  'danger': '⚠️', 'warn': '⚠️', 'warning': '⚠️', 'alert': '⚠️', 'stop': '🛑', 'go': '🟢', 'power': '⚡', 'energy': '⚡', 'speed': '⚡', 'fast': '⚡', 'lightning': '⚡', 'thunder': '⛈️', 'storm': '⛈️', 'bomb': '💣', 'explode': '💥', 'explosion': '💥', 'destroy': '💥', 'crash': '💥',

  // Mind & Brain
  'mind': '🧠', 'brain': '🧠', 'think': '🧠', 'smart': '🧠', 'idea': '💡', 'thought': '🤔', 'secret': '🤫', 'quiet': '🤫', 'genius': '🧠', 'truth': '🗣️', 'speak': '🗣️', 'talk': '🗣️', 'listen': '👂', 'hear': '👂',

  // Time & Goals
  'time': '⏱️', 'clock': '⏰', 'watch': '⌚', 'target': '🎯', 'goal': '🎯', 'success': '🏆', 'win': '🏆', 'winner': '🏆', 'victory': '🏆', 'trophy': '🏆', 'medal': '🏅', 'first': '🥇', 'crown': '👑', 'king': '👑', 'queen': '👑',

  // Emotions & Expressive
  'love': '❤️', 'heart': '❤️', 'broken': '💔', 'hate': '💔', 'scream': '😱', 'scared': '😱', 'shock': '😱', 'fear': '😨', 'ghost': '👻', 'monster': '👹', 'alien': '👽', 'happy': '😊', 'smile': '😊', 'excited': '🤩', 'wow': '😮', 'shocked': '😲', 'surprised': '😲', 'confused': '😕', 'laugh': '😂', 'funny': '😂', 'joke': '😂', 'cry': '😭', 'sad': '😭', 'crap': '💩', 'shit': '💩',

  // Technology & Objects
  'phone': '📱', 'mobile': '📱', 'computer': '💻', 'laptop': '💻', 'code': '💻', 'software': '💻', 'program': '💻', 'gift': '🎁', 'party': '🎉', 'celebrate': '🎉', 'key': '🔑', 'lock': '🔒', 'unlock': '🔓', 'door': '🚪', 'bed': '🛏️', 'tv': '📺', 'camera': '📷', 'photo': '📷', 'video': '🎥', 'movie': '🎬', 'film': '🎬', 'music': '🎵', 'song': '🎶', 'sing': '🎤', 'dance': '💃', 'book': '📖', 'read': '📖', 'write': '✍️',

  // Travel & Vehicles
  'car': '🏎️', 'bus': '🚌', 'truck': '🚚', 'bike': '🚲', 'travel': '✈️', 'trip': '✈️', 'plane': '✈️', 'train': '🚆', 'rocket': '🚀', 'fly': '🚀', 'moon': '🚀',

  // Nature & World
  'earth': '🌍', 'world': '🌎', 'nature': '🌿', 'sun': '☀️', 'moon': '🌙', 'star': '⭐', 'sky': '🌌', 'cloud': '☁️', 'rain': '🌧️', 'snow': '❄️', 'wind': '💨', 'ice': '❄️', 'water': '💧', 'ocean': '🌊', 'sea': '🌊', 'mountain': '⛰️', 'forest': '🌲', 'flower': '🌸', 'rose': '🌹', 'tree': '🌳',

  // Animals
  'dog': '🐶', 'cat': '🐱', 'bird': '🐦', 'fish': '🐟', 'shark': '🦈', 'lion': '🦁', 'tiger': '🐯', 'bear': '🐻', 'wolf': '🐺', 'fox': '🦊',

  // Food
  'food': '🍔', 'pizza': '🍕', 'burger': '🍔', 'fries': '🍟', 'coffee': '☕', 'drink': '🍹', 'water': '💧'
};

function getWordEmoji(word) {
  if (!word) return '';
  const clean = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  return emojiMap[clean] || '';
}

/**
 * Ensures a high-resolution Apple Color Emoji PNG exists locally.
 * It first attempts to download from Ben Borgers' Apple Emojicdn.
 * If that fails, it falls back to OpenMoji and Noto Color Emoji via jsdelivr.
 */
async function ensureEmojiPngExists(emoji) {
  if (!emoji) return null;
  
  // Format local filename based on the full emoji codepoints
  const codePointsName = Array.from(emoji)
    .map(c => c.codePointAt(0).toString(16).toUpperCase())
    .join('_');
  const appleCacheDir = path.join(fontsDir, 'emojis', 'apple');
  const emojiPath = path.join(appleCacheDir, `${codePointsName}.png`);

  if (existsSync(emojiPath)) {
    return emojiPath;
  }

  console.log(`Apple color emoji ${emoji} (${codePointsName}) not found locally. Attempting to download...`);
  await fs.mkdir(appleCacheDir, { recursive: true });

  // Source 1: Ben Borgers' Emojicdn (Apple Style - 160x160 PNG)
  const appleUrl = `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}`;
  try {
    const res = await fetch(appleUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      await fs.writeFile(emojiPath, Buffer.from(buffer));
      console.log(`Successfully downloaded Apple color emoji from Emojicdn: ${emojiPath}`);
      return emojiPath;
    }
    console.warn(`Apple Emojicdn returned status ${res.status} for emoji ${codePointsName}. Trying OpenMoji fallback...`);
  } catch (err) {
    console.warn(`Failed to fetch emoji from Apple Emojicdn: ${err.message}. Trying OpenMoji fallback...`);
  }

  // Fallback Source 2: OpenMoji (618x618 color PNG using first codepoint)
  const firstCodePoint = emoji.codePointAt(0).toString(16).toUpperCase();
  const openMojiUrl = `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@latest/color/618x618/${firstCodePoint}.png`;
  try {
    const res = await fetch(openMojiUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      await fs.writeFile(emojiPath, Buffer.from(buffer));
      console.log(`Successfully downloaded color emoji from OpenMoji: ${emojiPath}`);
      return emojiPath;
    }
    console.warn(`OpenMoji returned status ${res.status} for emoji ${firstCodePoint}. Trying Noto Color Emoji fallback...`);
  } catch (err) {
    console.warn(`Failed to fetch emoji from OpenMoji: ${err.message}. Trying Noto Color Emoji fallback...`);
  }

  // Fallback Source 3: Noto Color Emoji (128x128 PNG)
  const notoUrl = `https://cdn.jsdelivr.net/npm/asturur-noto-emoji@latest/png/128/emoji_u${firstCodePoint.toLowerCase()}.png`;
  try {
    const res = await fetch(notoUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      await fs.writeFile(emojiPath, Buffer.from(buffer));
      console.log(`Successfully downloaded color emoji from Noto Emoji: ${emojiPath}`);
      return emojiPath;
    }
    console.warn(`Noto Color Emoji returned status ${res.status} for emoji ${firstCodePoint}`);
  } catch (err) {
    console.warn(`Failed to fetch emoji from Noto Color Emoji: ${err.message}`);
  }

  return null;
}

const emphasisWords = [
  'million', 'billion', 'secret', 'crash', 'danger', 'free', 'money', 'easy', 'growth', 'extreme', 
  'never', 'always', 'stop', 'go', 'die', 'live', 'win', 'lose', 'rich', 'poor', 'destroy', 'build', 
  'hack', 'hidden', 'viral', 'massive', 'insane', 'growthful', 'perfect', 'success', 'love', 'fast', 
  'gym', 'workout', 'fitness', 'strong', 'fire', 'broke', 'king', 'queen', 'power', 'energy', 'warning',
  'doctor', 'pizza', 'excited', 'wow', 'shocked', 'surprised', 'confused', 'truth', 'wild', 'beast'
];

function isEmphasisWord(word) {
  if (!word) return false;
  const clean = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  return emphasisWords.includes(clean);
}

function applyNeonGlowToEvents(eventsStr, style, primaryColor, outlineColor) {
  const lines = eventsStr.split('\n');
  const result = [];
  const glowCol = hexToAssColor(style.glowColor || '#00FFFF');
  const coreCol = '&H00FFFFFF&'; // pure white core

  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) {
      if (line.trim()) result.push(line);
      continue;
    }

    const parts = line.split(',');
    if (parts.length < 10) {
      result.push(line);
      continue;
    }

    const metaParts = parts.slice(0, 9);
    const textPart = parts.slice(9).join(',');

    if (textPart.includes('\\p1') || textPart.includes('{\\p1}')) {
      result.push(line);
      continue;
    }

    // Parse layer from metaParts[0]
    const layerMatch = metaParts[0].match(/Dialogue:\s*(\d+)/);
    const layer = layerMatch ? parseInt(layerMatch[1], 10) : 0;

    // Create Glow Line (Layer 0, underneath)
    const glowMetaParts = [...metaParts];
    glowMetaParts[0] = `Dialogue: ${layer}`;
    const glowMeta = glowMetaParts.join(',');

    let glowText = textPart;
    if (glowText.startsWith('{')) {
      const closingBraceIdx = glowText.indexOf('}');
      if (closingBraceIdx !== -1) {
        const tags = glowText.substring(1, closingBraceIdx);
        const rest = glowText.substring(closingBraceIdx + 1);
        let cleanTags = tags
          .replace(/\\c&H[0-9A-Fa-f]+&/g, '')
          .replace(/\\3c&H[0-9A-Fa-f]+&/g, '')
          .replace(/\\4c&H[0-9A-Fa-f]+&/g, '')
          .replace(/\\bord\d+/g, '');
        const borderSize = (style.outlineSize || 3) + 3;
        const glowTags = `\\blur6\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\bord${borderSize}${cleanTags}`;
        glowText = `{${glowTags}}${rest}`;
      }
    } else {
      const borderSize = (style.outlineSize || 3) + 3;
      glowText = `{\\blur6\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\bord${borderSize}}${glowText}`;
    }
    result.push(`${glowMeta},${glowText}`);

    // Create Core Line (Layer 1, on top)
    const coreMetaParts = [...metaParts];
    coreMetaParts[0] = `Dialogue: ${layer + 1}`;
    const coreMeta = coreMetaParts.join(',');

    let coreText = textPart;
    if (coreText.startsWith('{')) {
      const closingBraceIdx = coreText.indexOf('}');
      if (closingBraceIdx !== -1) {
        const tags = coreText.substring(1, closingBraceIdx);
        const rest = coreText.substring(closingBraceIdx + 1);
        let cleanTags = tags
          .replace(/\\c&H[0-9A-Fa-f]+&/g, '')
          .replace(/\\3c&H[0-9A-Fa-f]+&/g, '');
        const coreTags = `\\c${coreCol}\\3c${outlineColor}${cleanTags}`;
        coreText = `{${coreTags}}${rest}`;
      }
    } else {
      coreText = `{\\c${coreCol}\\3c${outlineColor}}${coreText}`;
    }
    result.push(`${coreMeta},${coreText}`);
  }

  return result.join('\n');
}

/**
 * Generates an ASS subtitle file content
 */
function createAssFileContent(originalScene, duration, style, width, height) {
  const scene = {
    ...originalScene,
    text: shapeDevanagari(originalScene.text),
    words: originalScene.words ? originalScene.words.map(w => ({
      ...w,
      word: shapeDevanagari(w.word)
    })) : []
  };
  let fontName = style.fontName || 'Arial';
  let forceBold = false;
  // Handle Kalam Bold: internal font family is "Kalam" with bold weight
  if (fontName === 'Kalam Bold') {
    fontName = 'Kalam';
    forceBold = true;
  }
  const isBold = forceBold || !!style.bold;
  const fontSize = Math.round((style.fontSize || 24) * (height / 640)); // Scale font size relative to resolution
  const primaryColor = hexToAssColor(style.fontColor);
  const outlineColor = hexToAssColor(style.outlineColor || '#000000');
  const shadowColor = style.pop3d
    ? hexToAssColor(style.pop3dColor || '#000000', '00')
    : hexToAssColor(style.shadowColor || '#000000', '80');
  const outlineSize = style.pop3d
    ? Math.max(style.outlineSize || 3, 4)
    : (style.outlineSize || 3);
  const shadowDepth = style.pop3d
    ? Math.max(style.shadowSize || 2, 6)
    : (style.shadow ? (style.shadowSize || 2) : 0);
  
  // Alignment: 5 = Center-Center (anchors the text block perfectly around the coordinate)
  const alignment = 5;

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const c = Math.round((secs % 1) * 100);
    const pad = (n, l) => String(n).padStart(l, '0');
    return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(c, 2)}`;
  };

  const createDialogueLines = (layer, start, end, X, Y, text, col, extraTags = '') => {
    const duration = end - start;
    const transition = style.textTransition || 'none';
    const motion = style.textMotion || 'none';

    // If duration is too short (< 0.15s) or transition is none, fallback to simple pos/move with optional fade
    if (transition === 'none' || duration < 0.15) {
      let moveTag = `\\pos(${X},${Y})`;
      if (motion === 'float') {
        moveTag = `\\move(${X},${Y + 4},${X},${Y - 4})`;
      }
      
      let fadeTag = '';
      if (style.textFade !== false) {
        fadeTag = '\\fad(150,150)';
      }
      return `Dialogue: ${layer},${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}${extraTags}\\c${col}}${text}\n`;
    }

    // Proportional transition time calculation: 
    // If duration >= 0.45s, animTime is 150ms.
    // If duration < 0.45s, animTime is 33% of the duration.
    const animTime = (duration >= 0.45) ? 0.15 : duration * 0.33;
    const animMs = Math.round(animTime * 1000);
    const t1 = start + animTime;
    const t2 = end - animTime;

    const Y_in = (motion === 'float') ? Y + 4 : Y;
    const Y_out = (motion === 'float') ? Y - 4 : Y;

    let inMove = '';
    let inAnim = '';
    let outMove = '';
    let outAnim = '';

    switch (transition) {
      case 'slide-up':
      case 'slide-up-fade':
        inMove = `\\move(${X},${Y_in + 40},${X},${Y_in},0,${animMs})`;
        outMove = `\\move(${X},${Y_out},${X},${Y_out - 40},0,${animMs})`;
        break;
      case 'slide-down':
      case 'slide-down-fade':
        inMove = `\\move(${X},${Y_in - 40},${X},${Y_in},0,${animMs})`;
        outMove = `\\move(${X},${Y_out},${X},${Y_out + 40},0,${animMs})`;
        break;
      case 'slide-left':
      case 'slide-left-fade':
        inMove = `\\move(${X + 50},${Y_in},${X},${Y_in},0,${animMs})`;
        outMove = `\\move(${X},${Y_out},${X - 50},${Y_out},0,${animMs})`;
        break;
      case 'slide-right':
      case 'slide-right-fade':
        inMove = `\\move(${X - 50},${Y_in},${X},${Y_in},0,${animMs})`;
        outMove = `\\move(${X},${Y_out},${X + 50},${Y_out},0,${animMs})`;
        break;
      case 'slide-up-blur':
      case 'slide-up-blur-fade':
        inMove = `\\move(${X},${Y_in + 40},${X},${Y_in},0,${animMs})`;
        inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
        outMove = `\\move(${X},${Y_out},${X},${Y_out - 40},0,${animMs})`;
        outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
        break;
      case 'slide-down-blur':
      case 'slide-down-blur-fade':
        inMove = `\\move(${X},${Y_in - 40},${X},${Y_in},0,${animMs})`;
        inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
        outMove = `\\move(${X},${Y_out},${X},${Y_out + 40},0,${animMs})`;
        outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
        break;
      case 'slide-left-blur':
      case 'slide-left-blur-fade':
        inMove = `\\move(${X + 50},${Y_in},${X},${Y_in},0,${animMs})`;
        inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
        outMove = `\\move(${X},${Y_out},${X - 50},${Y_out},0,${animMs})`;
        outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
        break;
      case 'slide-right-blur':
      case 'slide-right-blur-fade':
        inMove = `\\move(${X - 50},${Y_in},${X},${Y_in},0,${animMs})`;
        inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
        outMove = `\\move(${X},${Y_out},${X + 50},${Y_out},0,${animMs})`;
        outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
        break;
      case 'zoom-in-out':
      case 'zoom-in-out-fade':
        inMove = `\\pos(${X},${Y_in})`;
        inAnim = `\\fscx0\\fscy0\\t(0,${animMs},\\fscx100\\fscy100)`;
        outMove = `\\pos(${X},${Y_out})`;
        outAnim = `\\fscx100\\fscy100\\t(0,${animMs},\\fscx0\\fscy0)`;
        break;
      case 'zoom-in-out-blur':
      case 'zoom-in-out-blur-fade':
        inMove = `\\pos(${X},${Y_in})`;
        inAnim = `\\fscx0\\fscy0\\blur6\\t(0,${animMs},\\fscx100\\fscy100\\blur0)`;
        outMove = `\\pos(${X},${Y_out})`;
        outAnim = `\\fscx100\\fscy100\\blur0\\t(0,${animMs},\\fscx0\\fscy0\\blur6)`;
        break;
      default:
        inMove = `\\pos(${X},${Y_in})`;
        outMove = `\\pos(${X},${Y_out})`;
        break;
    }

    let midMove = `\\pos(${X},${Y})`;
    if (motion === 'float') {
      midMove = `\\move(${X},${Y_in},${X},${Y_out})`;
    }

    const hasFade = (style.textFade !== false) || transition.endsWith('-fade');
    let fadeTag = '';
    if (hasFade) {
      fadeTag = `\\fad(${animMs},0)`;
    }
    let fadeTagOut = '';
    if (hasFade) {
      fadeTagOut = `\\fad(0,${animMs})`;
    }

    let result = `Dialogue: ${layer},${formatTime(start)},${formatTime(t1)},Default,,0,0,0,,{\\an5${inMove}${inAnim}${fadeTag}${extraTags}\\c${col}}${text}\n`;
    result += `Dialogue: ${layer},${formatTime(t1)},${formatTime(t2)},Default,,0,0,0,,{\\an5${midMove}${extraTags}\\c${col}}${text}\n`;
    result += `Dialogue: ${layer},${formatTime(t2)},${formatTime(end)},Default,,0,0,0,,{\\an5${outMove}${outAnim}${fadeTagOut}${extraTags}\\c${col}}${text}\n`;
    return result;
  };

  const marginV = 20;

  // Custom positioning coordinates: X/Y range from -100 to 100 where (0,0) is center
  const textPositionX = style.textPositionX !== undefined ? parseInt(style.textPositionX, 10) : 0;
  let textPositionY = -70; // default to bottom placement
  if (style.textPositionY !== undefined) {
    textPositionY = parseInt(style.textPositionY, 10);
  } else if (style.verticalAlignment === 'middle') {
    textPositionY = 0;
  } else if (style.verticalAlignment === 'top') {
    textPositionY = 75;
  }

  const X_pos = Math.round((width / 2) + (textPositionX / 100) * (width * 0.42));
  const Y_pos = Math.round((height / 2) - (textPositionY / 100) * (height * 0.42));

  const header = `[Script Info]
Title: Styled Subtitles
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${shadowColor},${isBold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,1,${outlineSize},${shadowDepth},${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const mode = style.subtitleMode || 'classic';
  if (mode === 'classic') {
    // Classic Mode: standard subtitle lines with optional fade
    let text = scene.text;
    if (style.autoEmphasis) {
      const words = scene.words || [];
      if (words.length > 0) {
        text = words.map(w => {
          const rawWord = w.word;
          if (isEmphasisWord(w.word)) {
            const empCol = hexToAssColor(style.emphasisColor || '#FFFF00');
            return `{\\fscx125\\fscy125\\c${empCol}}${rawWord}{\\fscx100\\fscy100\\c${primaryColor}}`;
          }
          return rawWord;
        }).join(' ');
      }
    }
    const events = createDialogueLines(0, 0.0, duration, X_pos, Y_pos, text, hexToAssColor(style.fontColor || '#FFFFFF'));
    const processedEvents = style.neonGlow ? applyNeonGlowToEvents(events, style, primaryColor, outlineColor) : events;
    return header + processedEvents;
  }

  const words = scene.words || [];
  if (words.length === 0) {
    const events = createDialogueLines(0, 0.0, duration, X_pos, Y_pos, scene.text, hexToAssColor(style.fontColor || '#FFFFFF'));
    const processedEvents = style.neonGlow ? applyNeonGlowToEvents(events, style, primaryColor, outlineColor) : events;
    return header + processedEvents;
  }

  // Localize word timings relative to scene start
  const localWords = words.map(w => ({
    word: w.word,
    start: Math.max(0, w.start_time - scene.start_time),
    end: Math.min(duration, w.end_time - scene.start_time)
  }));

  const primaryAssColor = hexToAssColor(style.fontColor || '#FFFFFF');
  const highlightAssColor = hexToAssColor(style.highlightColor || '#FFFF00');
  const boxAssColor = hexToAssColor(style.boxColor || '#8A4BF3');
  const showBox = style.showHighlightBox !== false;
  const boxRounding = parseInt(style.boxRounding, 10) || 8;
  const activeWordScale = style.activeWordScale || 1.15;

  let events = '';

  // Estimate char width for box sizing
  let charWidthFactor = 0.52;
  if (fontName === 'Anton') charWidthFactor = 0.42;
  else if (fontName === 'Bangers') charWidthFactor = 0.48;
  else if (fontName === 'Impact') charWidthFactor = 0.52;
  else if (fontName === 'Kalam') charWidthFactor = 0.50;

  const padX = fontSize * 0.3;
  const boxHeight = fontSize * 1.3;

  if (mode === 'centered-word') {
    // Snappy centered single word mode (Hormozi / Snappy style)
    for (let i = 0; i < localWords.length; i++) {
      const w = localWords[i];
      const rx = X_pos;
      const ry = Y_pos;
      
      // Snappy pop-in scale animation if zoom bump is enabled (> 1.0)
      let scaleTag = '';
      if (activeWordScale > 1.0) {
        const scaleStart = Math.round(90 * activeWordScale);
        const scaleEnd = Math.round(100 * activeWordScale);
        scaleTag = `\\fscx${scaleStart}\\fscy${scaleStart}\\t(0,60,\\fscx${scaleEnd}\\fscy${scaleEnd})`;
      }

      const wordText = w.word;

      let currentWordCol = highlightAssColor;
      if (style.autoEmphasis && isEmphasisWord(w.word)) {
        currentWordCol = hexToAssColor(style.emphasisColor || '#FFFF00');
      }

      // Background Box for single word
      if (showBox) {
        const wordW = wordText.length * charWidthFactor * fontSize;
        const boxW = wordW + padX * 2;
        
        let boxScaleTag = '';
        if (activeWordScale > 1.0) {
          const bScaleStart = Math.round(90 * activeWordScale);
          const bScaleEnd = Math.round(100 * activeWordScale);
          boxScaleTag = `\\fscx${bScaleStart}\\fscy${bScaleStart}\\t(0,60,\\fscx${bScaleEnd}\\fscy${bScaleEnd})`;
        }
        
        events += createDialogueLines(0, w.start, w.end, rx, ry, `{\\p1}${drawCenteredRoundedRect(boxW, boxHeight, boxRounding)}{\\p0}`, boxAssColor, boxScaleTag);
      }
      
      events += createDialogueLines(1, w.start, w.end, rx, ry, wordText, currentWordCol, scaleTag);
    }
  } else if (mode === 'smart-highlight') {
    // Smart TikTok/Instagram Reels style: centered text phrase, active word highlighted in highlightColor
    // Force single line by chunking localWords (max 3 words or 20 characters)
    const chunks = [];
    let currentChunk = [];
    let currentLen = 0;
    
    for (let i = 0; i < localWords.length; i++) {
      const w = localWords[i];
      if (currentChunk.length >= 3 || (currentChunk.length > 0 && currentLen + w.word.length > 20)) {
        chunks.push(currentChunk);
        currentChunk = [w];
        currentLen = w.word.length;
      } else {
        currentChunk.push(w);
        currentLen += (currentChunk.length > 1 ? 1 : 0) + w.word.length;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    const totalStart = localWords[0].start;
    const totalEnd = Math.max(localWords[localWords.length - 1].end, duration);
    
    // Helper to render chunk text with highlight and auto-emphasis
    const renderChunkText = (chunk, activeIdx) => {
      return chunk.map((item, idx) => {
        const rawWord = item.word;

        if (idx === activeIdx) {
          let col = highlightAssColor;
          if (style.autoEmphasis && isEmphasisWord(item.word)) {
            col = hexToAssColor(style.emphasisColor || '#FFFF00');
          }
          let tag = `{\\c${col}}`;
          if (activeWordScale > 1.0) {
            const activeSize = Math.round(fontSize * activeWordScale);
            tag += `{\\fs${activeSize}}`;
          }
          const restoreTag = activeWordScale > 1.0 ? `{\\fs${fontSize}}` : '';
          return `${tag}${rawWord}${restoreTag}{\\c${primaryAssColor}}`;
        } else if (style.autoEmphasis && isEmphasisWord(item.word)) {
          const empCol = hexToAssColor(style.emphasisColor || '#FFFF00');
          return `{\\fscx125\\fscy125\\c${empCol}}${rawWord}{\\fscx100\\fscy100\\c${primaryAssColor}}`;
        } else {
          return rawWord;
        }
      }).join(' ');
    };

    // 1. Pre-speech segment
    if (totalStart > 0 && chunks.length > 0) {
      events += createDialogueLines(0, 0.0, totalStart, X_pos, Y_pos, renderChunkText(chunks[0], -1), primaryAssColor);
    }
    
    // 2. Word highlight transitions per chunk
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      const chunkStart = chunk[0].start;
      const chunkEnd = cIdx < chunks.length - 1 ? chunks[cIdx + 1][0].start : totalEnd;
      
      for (let wIdx = 0; wIdx < chunk.length; wIdx++) {
        const w = chunk[wIdx];
        const start = w.start;
        const nextStart = wIdx < chunk.length - 1 ? chunk[wIdx + 1].start : chunkEnd;
        const end = Math.max(w.start + 0.05, nextStart);
        
        const isFirst = (wIdx === 0);
        const isLast = (wIdx === chunk.length - 1);
        const text = renderChunkText(chunk, wIdx);

        const transition = style.textTransition || 'none';
        const motion = style.textMotion || 'none';

        const chunkDuration = chunkEnd - chunkStart;
        const segmentDuration = end - start;

        const getYForTime = (t) => {
          if (motion !== 'float') return Y_pos;
          const progress = chunkDuration > 0 ? (t - chunkStart) / chunkDuration : 0;
          return Y_pos + 4 - progress * 8;
        };

        if (transition === 'none' || chunkDuration < 0.15 || segmentDuration < 0.10) {
          const yStart = Math.round(getYForTime(start));
          const yEnd = Math.round(getYForTime(end));
          let moveTag = `\\pos(${X_pos},${Y_pos})`;
          if (motion === 'float') {
            moveTag = `\\move(${X_pos},${yStart},${X_pos},${yEnd})`;
          }
          
          let fadeTag = '';
          if (style.textFade !== false) {
            if (isFirst && isLast) fadeTag = '\\fad(150,150)';
            else if (isFirst) fadeTag = '\\fad(150,0)';
            else if (isLast) fadeTag = '\\fad(0,150)';
          }
          events += `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}\\c${primaryAssColor}}${text}\n`;
        } else {
          // Complex slide/zoom transitions
          let animTime = 0.15;
          if (isFirst && isLast) {
            animTime = (segmentDuration >= 0.45) ? 0.15 : Math.max(0.05, segmentDuration * 0.33);
          } else if (isFirst || isLast) {
            animTime = (segmentDuration >= 0.30) ? 0.15 : Math.max(0.05, segmentDuration * 0.50);
          }
          const animMs = Math.round(animTime * 1000);

          let inMove = '';
          let inAnim = '';
          let outMove = '';
          let outAnim = '';

          const Y_in = Math.round(getYForTime(chunkStart));
          const Y_out = Math.round(getYForTime(chunkEnd));

          switch (transition) {
            case 'slide-up':
            case 'slide-up-fade':
              inMove = `\\move(${X_pos},${Y_in + 40},${X_pos},${Y_in},0,${animMs})`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos},${Y_out - 40},0,${animMs})`;
              break;
            case 'slide-down':
            case 'slide-down-fade':
              inMove = `\\move(${X_pos},${Y_in - 40},${X_pos},${Y_in},0,${animMs})`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos},${Y_out + 40},0,${animMs})`;
              break;
            case 'slide-left':
            case 'slide-left-fade':
              inMove = `\\move(${X_pos + 50},${Y_in},${X_pos},${Y_in},0,${animMs})`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos - 50},${Y_out},0,${animMs})`;
              break;
            case 'slide-right':
            case 'slide-right-fade':
              inMove = `\\move(${X_pos - 50},${Y_in},${X_pos},${Y_in},0,${animMs})`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos + 50},${Y_out},0,${animMs})`;
              break;
            case 'slide-up-blur':
            case 'slide-up-blur-fade':
              inMove = `\\move(${X_pos},${Y_in + 40},${X_pos},${Y_in},0,${animMs})`;
              inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos},${Y_out - 40},0,${animMs})`;
              outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
              break;
            case 'slide-down-blur':
            case 'slide-down-blur-fade':
              inMove = `\\move(${X_pos},${Y_in - 40},${X_pos},${Y_in},0,${animMs})`;
              inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos},${Y_out + 40},0,${animMs})`;
              outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
              break;
            case 'slide-left-blur':
            case 'slide-left-blur-fade':
              inMove = `\\move(${X_pos + 50},${Y_in},${X_pos},${Y_in},0,${animMs})`;
              inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos - 50},${Y_out},0,${animMs})`;
              outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
              break;
            case 'slide-right-blur':
            case 'slide-right-blur-fade':
              inMove = `\\move(${X_pos - 50},${Y_in},${X_pos},${Y_in},0,${animMs})`;
              inAnim = `\\blur6\\t(0,${animMs},\\blur0)`;
              outMove = `\\move(${X_pos},${Y_out},${X_pos + 50},${Y_out},0,${animMs})`;
              outAnim = `\\blur0\\t(0,${animMs},\\blur6)`;
              break;
            case 'zoom-in-out':
            case 'zoom-in-out-fade':
              inMove = `\\pos(${X_pos},${Y_in})`;
              inAnim = `\\fscx0\\fscy0\\t(0,${animMs},\\fscx100\\fscy100)`;
              outMove = `\\pos(${X_pos},${Y_out})`;
              outAnim = `\\fscx100\\fscy100\\t(0,${animMs},\\fscx0\\fscy0)`;
              break;
            case 'zoom-in-out-blur':
            case 'zoom-in-out-blur-fade':
              inMove = `\\pos(${X_pos},${Y_in})`;
              inAnim = `\\fscx0\\fscy0\\blur6\\t(0,${animMs},\\fscx100\\fscy100\\blur0)`;
              outMove = `\\pos(${X_pos},${Y_out})`;
              outAnim = `\\fscx100\\fscy100\\blur0\\t(0,${animMs},\\fscx0\\fscy0\\blur6)`;
              break;
            default:
              inMove = `\\pos(${X_pos},${Y_in})`;
              outMove = `\\pos(${X_pos},${Y_out})`;
              break;
          }

          const hasFade = (style.textFade !== false) || transition.endsWith('-fade');
          let fadeTagIn = hasFade ? `\\fad(${animMs},0)` : '';
          let fadeTagOut = hasFade ? `\\fad(0,${animMs})` : '';

          if (isFirst && isLast) {
            const mid1 = start + animTime;
            const mid2 = end - animTime;
            const y1 = Math.round(getYForTime(mid1));
            const y2 = Math.round(getYForTime(mid2));
            let midMove = `\\pos(${X_pos},${Y_pos})`;
            if (motion === 'float') {
              midMove = `\\move(${X_pos},${y1},${X_pos},${y2})`;
            }

            events += `Dialogue: 0,${formatTime(start)},${formatTime(mid1)},Default,,0,0,0,,{\\an5${inMove}${inAnim}${fadeTagIn}\\c${primaryAssColor}}${text}\n`;
            events += `Dialogue: 0,${formatTime(mid1)},${formatTime(mid2)},Default,,0,0,0,,{\\an5${midMove}\\c${primaryAssColor}}${text}\n`;
            events += `Dialogue: 0,${formatTime(mid2)},${formatTime(end)},Default,,0,0,0,,{\\an5${outMove}${outAnim}${fadeTagOut}\\c${primaryAssColor}}${text}\n`;
          } else if (isFirst) {
            const mid = start + animTime;
            const y1 = Math.round(getYForTime(mid));
            const y2 = Math.round(getYForTime(end));
            let midMove = `\\pos(${X_pos},${Y_pos})`;
            if (motion === 'float') {
              midMove = `\\move(${X_pos},${y1},${X_pos},${y2})`;
            }

            events += `Dialogue: 0,${formatTime(start)},${formatTime(mid)},Default,,0,0,0,,{\\an5${inMove}${inAnim}${fadeTagIn}\\c${primaryAssColor}}${text}\n`;
            events += `Dialogue: 0,${formatTime(mid)},${formatTime(end)},Default,,0,0,0,,{\\an5${midMove}\\c${primaryAssColor}}${text}\n`;
          } else if (isLast) {
            const mid = end - animTime;
            const y1 = Math.round(getYForTime(start));
            const y2 = Math.round(getYForTime(mid));
            let midMove = `\\pos(${X_pos},${Y_pos})`;
            if (motion === 'float') {
              midMove = `\\move(${X_pos},${y1},${X_pos},${y2})`;
            }

            events += `Dialogue: 0,${formatTime(start)},${formatTime(mid)},Default,,0,0,0,,{\\an5${midMove}\\c${primaryAssColor}}${text}\n`;
            events += `Dialogue: 0,${formatTime(mid)},${formatTime(end)},Default,,0,0,0,,{\\an5${outMove}${outAnim}${fadeTagOut}\\c${primaryAssColor}}${text}\n`;
          } else {
            const y1 = Math.round(getYForTime(start));
            const y2 = Math.round(getYForTime(end));
            let midMove = `\\pos(${X_pos},${Y_pos})`;
            if (motion === 'float') {
              midMove = `\\move(${X_pos},${y1},${X_pos},${y2})`;
            }
            events += `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5${midMove}\\c${primaryAssColor}}${text}\n`;
          }
        }
      }
    }
    
    // 3. Post-speech segment
    if (totalEnd < duration && chunks.length > 0) {
      const startStr = formatTime(totalEnd);
      const endStr = formatTime(duration);
      const moveTag = style.textMotion === 'float'
        ? `\\move(${X_pos},${Y_pos + 4},${X_pos},${Y_pos - 4})`
        : `\\pos(${X_pos},${Y_pos})`;
      const fadeTag = style.textFade !== false ? '\\fad(150,150)' : '';
      const text = renderChunkText(chunks[chunks.length - 1], -1);
      events += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}\\c${primaryAssColor}}${text}\n`;
    }
  } else {
    // Current "pop" mode: word linger with random positions and pop-burst
    const hash = (seed) => {
      let h = seed * 2654435761;
      h = ((h >>> 16) ^ h) * 0x45d9f3b;
      h = ((h >>> 16) ^ h) * 0x45d9f3b;
      h = (h >>> 16) ^ h;
      return Math.abs(h);
    };

    const marginX = Math.round(width * 0.15);
    const marginY = Math.round(height * 0.15);
    const safeW = width - 2 * marginX;
    const safeH = height - 2 * marginY;

    const minDisplaySec = parseFloat(style.wordDisplayTime) || 1.0;

    for (let i = 0; i < localWords.length; i++) {
      const w = localWords[i];
      const displayEnd = Math.min(duration, w.start + Math.max(w.end - w.start, minDisplaySec));
      const startStr = formatTime(w.start);
      const endStr = formatTime(displayEnd);
      const durMs = Math.max(300, Math.round((displayEnd - w.start) * 1000));

      const hx = hash(i * 7 + 13);
      const hy = hash(i * 11 + 37);
      const rx = marginX + (hx % safeW);
      const ry = marginY + (hy % safeH);

      const moveTag = `\\move(${rx},${ry + 4},${rx},${ry - 4})`;

      const popInMs = 100;
      const settleMs = 150;
      const burstMs = 120;
      const burstStart = Math.max(settleMs + 10, durMs - burstMs);

      const wordText = w.word;

      let currentWordCol = highlightAssColor;
      if (style.autoEmphasis && isEmphasisWord(w.word)) {
        currentWordCol = hexToAssColor(style.emphasisColor || '#FFFF00');
      }

      if (showBox) {
        const wordW = wordText.length * charWidthFactor * fontSize;
        const boxW = wordW + padX * 2;
        const bAnim = `\\fscx10\\fscy10` +
          `\\t(0,${popInMs},\\fscx115\\fscy115)` +
          `\\t(${popInMs},${settleMs},\\fscx100\\fscy100)` +
          `\\t(${burstStart},${durMs},\\fscx300\\fscy300\\alpha&HFF&)`;
        events += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${bAnim}\\c${boxAssColor}}{\\p1}${drawCenteredRoundedRect(boxW, boxHeight, boxRounding)}{\\p0}\n`;
      }

      const wordAnim = `\\fscx10\\fscy10` +
        `\\t(0,${popInMs},\\fscx120\\fscy120)` +
        `\\t(${popInMs},${settleMs},\\fscx100\\fscy100)` +
        `\\t(${burstStart},${durMs},\\fscx300\\fscy300\\alpha&HFF&)`;
      events += `Dialogue: 1,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}\\c${currentWordCol}${wordAnim}}${wordText}\n`;
    }
  }

  const finalEvents = style.neonGlow ? applyNeonGlowToEvents(events, style, primaryColor, outlineColor) : events;
  return header + finalEvents;
}

/**
 * Main Video Generator Engine
 */
export async function assembleVideo(options, onProgress) {
  const {
    scenes,         // array of { text, start_time, end_time, clipId, clipStart, words }
    clips,          // list of all clips from database
    voiceoverPath,  // path to the voiceover audio file
    bgMusicPath,    // path to background music
    bgMusicVolume = 0.15,
    bgMusicStartOffset = 0,
    voiceoverVolume = 1.0,
    aspectRatio = '9:16', // '9:16', '16:9', '1:1'
    fillMode = 'crop',    // 'crop', 'fit'
    subtitleStyle = {},
    clipTransition = 'none', // 'none', 'fade'
    transitionDuration = 0.3, // seconds (0.1 – 1.0)
    zoomAnimation = true,   // true, false
    exportResolution = '1080p',
    exportFps = 30,
    outputDir,
    miniBeats,
    miniBeatEffect = 'none',
    beatEffects = {}
  } = options;

  console.log(`Starting video assembly with ${scenes.length} scenes...`);

  // --- Viral Beat Effects defaults ---
  const bfx = {
    whiteFlash: false, whiteFlashIntensity: 0.6,
    rgbSplit: false, rgbSplitPixels: 6,
    bassBounce: false, bassBounceScale: 1.06,
    speedRamp: false, speedRampHold: 0.1,
    whipPan: false, whipPanStrength: 30,
    spinTransition: false, spinDegrees: 90,
    colorFlash: false, colorFlashTint: '#FF6B00',
    glitchTear: false, glitchTearPixels: 20,
    filmGrain: false, filmGrainAmount: 12,
    letterbox: false, letterboxSize: 50,
    vignettePulse: false,
    negativeFlash: false,
    ...beatEffects
  };

  // Ensure custom font is downloaded and available locally
  if (subtitleStyle.fontName) {
    try {
      await ensureFontExists(subtitleStyle.fontName);
    } catch (fontErr) {
      console.warn(`Could not verify/download font ${subtitleStyle.fontName}:`, fontErr.message);
    }
  }

  // Deep copy/clone scenes to avoid mutating original objects in the database
  const adjustedScenes = scenes.map(s => ({
    ...s,
    words: s.words ? s.words.map(w => ({ ...w })) : []
  }));

  // Resolve voiceover duration to adjust timings
  let voiceoverDuration = 0;
  try {
    voiceoverDuration = await getVideoDuration(voiceoverPath);
    console.log(`Voiceover audio duration: ${voiceoverDuration}s`);
  } catch (err) {
    console.warn('Failed to calculate voiceover duration:', err.message);
  }

  // Adjust scene timings to completely cover intermediate gaps/silences.
  // This eliminates accumulated timing drift between video and audio tracks!
  if (adjustedScenes.length > 0) {
    adjustedScenes[0].start_time = 0.0; // Extend first scene to start of video

    // Filter out scenes that start beyond the actual audio track duration
    if (voiceoverDuration > 0) {
      // Keep scenes starting before voiceover ends (with a tiny 50ms buffer)
      // but always keep at least the first scene.
      const validScenes = adjustedScenes.filter((s, idx) => idx === 0 || s.start_time < voiceoverDuration - 0.05);
      
      // Update the adjustedScenes array in-place
      adjustedScenes.length = 0;
      adjustedScenes.push(...validScenes);
    }

    for (let i = 0; i < adjustedScenes.length; i++) {
      if (i < adjustedScenes.length - 1) {
        // Enforce a minimum scene duration of 0.1s.
        // If the next scene starts too early, push its start time out.
        if (adjustedScenes[i + 1].start_time < adjustedScenes[i].start_time + 0.1) {
          adjustedScenes[i + 1].start_time = adjustedScenes[i].start_time + 0.1;
        }
        adjustedScenes[i].end_time = adjustedScenes[i + 1].start_time;
      } else if (voiceoverDuration > 0) {
        // For the last scene, make sure it ends at voiceoverDuration but is at least 0.1s long
        adjustedScenes[i].end_time = Math.max(adjustedScenes[i].start_time + 0.1, voiceoverDuration);
      } else {
        // Fallback if voiceoverDuration isn't available
        if (adjustedScenes[i].end_time < adjustedScenes[i].start_time + 0.1) {
          adjustedScenes[i].end_time = adjustedScenes[i].start_time + 0.1;
        }
      }
    }
  }
  
  // Create unique folders for this rendering job
  const jobId = path.basename(voiceoverPath, path.extname(voiceoverPath));
  const tempDir = path.join(outputDir, 'temp', jobId);
  await fs.mkdir(tempDir, { recursive: true });

  // Resolve resolutions
  const resLabel = (exportResolution || '1080p').toLowerCase();
  let targetWidth = 1080;
  let targetHeight = 1920;

  if (aspectRatio === '16:9') {
    if (resLabel === '2k') {
      targetWidth = 2560;
      targetHeight = 1440;
    } else if (resLabel === '4k') {
      targetWidth = 3840;
      targetHeight = 2160;
    } else { // 1080p
      targetWidth = 1920;
      targetHeight = 1080;
    }
  } else if (aspectRatio === '1:1') {
    if (resLabel === '2k') {
      targetWidth = 1440;
      targetHeight = 1440;
    } else if (resLabel === '4k') {
      targetWidth = 2160;
      targetHeight = 2160;
    } else { // 1080p
      targetWidth = 1080;
      targetHeight = 1080;
    }
  } else { // 9:16
    if (resLabel === '2k') {
      targetWidth = 1440;
      targetHeight = 2560;
    } else if (resLabel === '4k') {
      targetWidth = 2160;
      targetHeight = 3840;
    } else { // 1080p
      targetWidth = 1080;
      targetHeight = 1920;
    }
  }

  const clipsMap = new Map(clips.map(c => [c.id, c]));
  const processedSceneClips = [];

  // Step 1: Format and burn subtitles on each clip separately
  for (let i = 0; i < adjustedScenes.length; i++) {
    const scene = adjustedScenes[i];
    const clip = clipsMap.get(scene.clipId);
    
    if (!clip) {
      throw new Error(`Clip ID ${scene.clipId} used in scene ${i} not found in clip library`);
    }

    const sceneDuration = scene.end_time - scene.start_time;
    const tempSceneClipPath = path.join(tempDir, `scene_${i}.mp4`);
    const tempAssPath = path.join(tempDir, `sub_${i}.ass`);

    onProgress(Math.round((i / adjustedScenes.length) * 75), `Formatting & subtitle burning for scene ${i + 1}/${adjustedScenes.length}...`);

    // Write temporary ASS file
    const assContent = createAssFileContent(scene, sceneDuration, subtitleStyle, targetWidth, targetHeight);
    await fs.writeFile(tempAssPath, assContent, 'utf-8');

    const targetFps = Number(exportFps) || 30;

    const effectiveSceneDuration = scene.pingPong ? sceneDuration / 2 : sceneDuration;

    let v0 = 1.0, v1 = 1.0, v2 = 1.0;
    let s1 = effectiveSceneDuration, s2 = effectiveSceneDuration, s3 = effectiveSceneDuration;
    let a1 = 0, a2 = 0;
    let isSpeedRamped = false;

    if (scene.speedRamp && scene.speedRamp.enabled) {
      isSpeedRamped = true;
      v0 = Number(scene.speedRamp.v0) || 1.0;
      v1 = Number(scene.speedRamp.v1) || 1.0;
      v2 = Number(scene.speedRamp.v2) || 1.0;

      // Perturb identical adjacent speeds to avoid division-by-zero in setpts
      if (v1 === v0) v1 += 0.00001;
      if (v2 === v1) v2 += 0.00001;

      a1 = (v1 - v0) / effectiveSceneDuration;
      a2 = (v2 - v1) / effectiveSceneDuration;
      s1 = ((v0 + v1) / 8) * effectiveSceneDuration;
      s2 = ((v0 + 5 * v1) / 8) * effectiveSceneDuration;
      s3 = ((v0 + 6 * v1 + v2) / 8) * effectiveSceneDuration;
    }

    const sourceDuration = isSpeedRamped ? s3 : effectiveSceneDuration;

    // 2. Filter: Trim video to sourceDuration, reset PTS, pad if ends early, scale & crop/fit, then burn subtitles
    let videoFilter = `setpts=PTS-STARTPTS,trim=duration=${sourceDuration}`;
    const remainingClipDur = clip.duration - (scene.clipStart || 0);
    const missingDur = sourceDuration - remainingClipDur;
    if (missingDur > 0) {
      const padFrames = Math.ceil(missingDur * targetFps);
      videoFilter += `,tpad=stop_mode=clone:stop=${padFrames}`;
    }

    // Append speed ramping setpts filter if enabled
    if (isSpeedRamped) {
      const setptsExpr = `(if(lt(T, ${s1}), (-${v0} + sqrt(max(0, ${v0}*${v0} + 8*${a1}*T))) / (4*${a1}), if(lt(T, ${s2}), 0.25*${effectiveSceneDuration} + (T - ${s1}) / ${v1}, 0.75*${effectiveSceneDuration} + (-${v1} + sqrt(max(0, ${v1}*${v1} + 8*${a2}*(T - ${s2})))) / (4*${a2}))))/TB`;
      videoFilter += `,setpts='${setptsExpr}'`;

      // Apply fast frame blending if the speed drops below 1.0x (slow motion) to avoid buggy and slow optical flow motion estimation
      const hasSlowMotion = v0 < 1.0 || v1 < 1.0 || v2 < 1.0;
      if (hasSlowMotion) {
        videoFilter += `,minterpolate=fps=${targetFps}:mi_mode=blend`;
      }
    }

    if (fillMode === 'crop') {
      // Crop to fill (using -2 instead of -1 to ensure proportional scale is always even-dimensioned, and centering crop coordinates to even boundaries)
      const scaleAndCrop = `scale=w='if(gte(iw/ih,${targetWidth}/${targetHeight}),-2,${targetWidth})':h='if(gte(iw/ih,${targetWidth}/${targetHeight}),${targetHeight},-2)',crop=${targetWidth}:${targetHeight}:2*trunc((iw-ow)/4):2*trunc((ih-oh)/4)`;
      videoFilter += `,${scaleAndCrop}`;
    } else {
      // Fit with letterbox (black bars)
      const scaleAndPad = `scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`;
      videoFilter += `,${scaleAndPad}`;
    }

    // Ping-pong (Beat Bounce) split-reverse-concat (fixing PTS on reversed segment using targetFps to ensure monotonic increasing timestamps)
    if (scene.pingPong) {
      videoFilter += `[std];[std]split=2[fwd][rev_in];[rev_in]reverse,setpts=N/(${targetFps}*TB)[rev];[fwd][rev]concat=n=2:v=1:a=0`;
    }

    // Apply Ken Burns zoom animation if enabled (forcing even dimensions and centered even crop coordinates to prevent green borders)
    if (zoomAnimation) {
      videoFilter += `,scale=w='2*trunc(((1+0.06*t/${sceneDuration})*${targetWidth})/2)':h='2*trunc(((1+0.06*t/${sceneDuration})*${targetHeight})/2)':eval=frame,crop=${targetWidth}:${targetHeight}:2*trunc((iw-ow)/4):2*trunc((ih-oh)/4)`;
    }

    // Resolve active transition for this scene (handles 'random')
    let activeTransition = clipTransition || 'none';
    if (activeTransition === 'random') {
      const transitionsList = [
        'fade',
        'slide-left', 'slide-right', 'slide-up', 'slide-down',
        'slide-left-fade', 'slide-right-fade', 'slide-up-fade', 'slide-down-fade',
        'blur-slide-left', 'blur-slide-right', 'blur-slide-up', 'blur-slide-down',
        'blur-slide-left-fade', 'blur-slide-right-fade', 'blur-slide-up-fade', 'blur-slide-down-fade',
        'pan-left', 'pan-right', 'pan-up', 'pan-down',
        'pan-left-fade', 'pan-right-fade', 'pan-up-fade', 'pan-down-fade',
        'blur-pan-left', 'blur-pan-right', 'blur-pan-up', 'blur-pan-down',
        'blur-pan-left-fade', 'blur-pan-right-fade', 'blur-pan-up-fade', 'blur-pan-down-fade',
        'zoom-in', 'zoom-out',
        'zoom-in-fade', 'zoom-out-fade',
        'blur-zoom-in', 'blur-zoom-out',
        'blur-zoom-in-fade', 'blur-zoom-out-fade'
      ];
      // Deterministic index-based selection
      activeTransition = transitionsList[i % transitionsList.length];
    }

    const td = Number(transitionDuration) || 0.3; // resolved transition duration
    const fadeDur = Math.min(td, sceneDuration / 2);
    const hasFade = activeTransition === 'fade' || activeTransition.endsWith('-fade');

    if (hasFade) {
      videoFilter += `,fade=t=in:st=0:d=${fadeDur.toFixed(3)},fade=t=out:st=${(sceneDuration - fadeDur).toFixed(3)}:d=${fadeDur.toFixed(3)}`;
    }

    if (activeTransition !== 'none' && activeTransition !== 'fade' && sceneDuration > td * 2) {
      const isSlide = activeTransition.includes('slide');
      const isPan = activeTransition.includes('pan');
      const isZoom = activeTransition.includes('zoom');
      const isBlur = activeTransition.includes('blur');
      
      if (isSlide || isPan) {
        const amp = isPan ? 0.2 : 1.0;
        let xExpr = String(targetWidth);
        let yExpr = String(targetHeight);
        
        if (activeTransition.includes('left')) {
          xExpr = `${targetWidth} * (1 + ${amp} * if(lt(t, ${td}), -pow(1 - (t/${td}), 3), if(gt(t, ${sceneDuration} - ${td}), pow((t - (${sceneDuration} - ${td}))/${td}, 3), 0)))`;
        } else if (activeTransition.includes('right')) {
          xExpr = `${targetWidth} * (1 + ${amp} * if(lt(t, ${td}), pow(1 - (t/${td}), 3), if(gt(t, ${sceneDuration} - ${td}), -pow((t - (${sceneDuration} - ${td}))/${td}, 3), 0)))`;
        } else if (activeTransition.includes('up')) {
          yExpr = `${targetHeight} * (1 + ${amp} * if(lt(t, ${td}), -pow(1 - (t/${td}), 3), if(gt(t, ${sceneDuration} - ${td}), pow((t - (${sceneDuration} - ${td}))/${td}, 3), 0)))`;
        } else if (activeTransition.includes('down')) {
          yExpr = `${targetHeight} * (1 + ${amp} * if(lt(t, ${td}), pow(1 - (t/${td}), 3), if(gt(t, ${sceneDuration} - ${td}), -pow((t - (${sceneDuration} - ${td}))/${td}, 3), 0)))`;
        }
        
        // Pad video to 3x dimensions (canvas is centered around original video at W, H)
        videoFilter += `,pad=w=3*${targetWidth}:h=3*${targetHeight}:x=${targetWidth}:y=${targetHeight}:color=black`;
        videoFilter += `,crop=w=${targetWidth}:h=${targetHeight}:x='${xExpr}':y='${yExpr}'`;
      } else if (isZoom) {
        const factor = activeTransition.includes('zoom-in') ? 0.3 : -0.3;
        const sExpr = `if(lt(t, ${td}), 1.0 + ${factor} * pow(1 - (t/${td}), 3), if(gt(t, ${sceneDuration} - ${td}), 1.0 + ${factor} * pow((t - (${sceneDuration} - ${td}))/${td}, 3), 1.0))`;
        
        // Scale to dynamic S factor (forcing even dimensions to avoid YUV colorspace green borders)
        videoFilter += `,scale=w='2*trunc(((${sExpr})*${targetWidth})/2)':h='2*trunc(((${sExpr})*${targetHeight})/2)':eval=frame`;
        // Pad to 3x centered, then crop center (forcing even dimensions and eval=frame to prevent green borders)
        videoFilter += `,pad=w=3*${targetWidth}:h=3*${targetHeight}:x='2*trunc((3*${targetWidth}-iw)/4)':y='2*trunc((3*${targetHeight}-ih)/4)':color=black:eval=frame`;
        videoFilter += `,crop=w=${targetWidth}:h=${targetHeight}:x=${targetWidth}:y=${targetHeight}`;
      }
      
      if (isBlur) {
        // Stepped blur-in (decelerating blur radius) — 3 equal thirds of td
        const bs1 = (td / 3).toFixed(3);
        const bs2 = (2 * td / 3).toFixed(3);
        const bs3 = td.toFixed(3);
        videoFilter += `,boxblur=lr=16:lp=1:enable='lt(t,${bs1})'`;
        videoFilter += `,boxblur=lr=8:lp=1:enable='between(t,${bs1},${bs2})'`;
        videoFilter += `,boxblur=lr=3:lp=1:enable='between(t,${bs2},${bs3})'`;
        
        // Stepped blur-out (accelerating blur radius)
        const t1 = (sceneDuration - td).toFixed(3);
        const t2 = (sceneDuration - 2 * td / 3).toFixed(3);
        const t3 = (sceneDuration - td / 3).toFixed(3);
        videoFilter += `,boxblur=lr=3:lp=1:enable='between(t,${t1},${t2})'`;
        videoFilter += `,boxblur=lr=8:lp=1:enable='between(t,${t2},${t3})'`;
        videoFilter += `,boxblur=lr=16:lp=1:enable='gt(t,${t3})'`;
      }
    }
 
    // Apply mini-beat visual effects (strobe/blink or camera shake)
    const activeMiniBeats = [];
    if (miniBeats && Array.isArray(miniBeats) && miniBeatEffect && miniBeatEffect !== 'none') {
      miniBeats.forEach(b => {
        if (b >= scene.start_time && b < scene.end_time) {
          activeMiniBeats.push(Number((b - scene.start_time).toFixed(3)));
        }
      });
    }
 
    if (activeMiniBeats.length > 0) {
      if (miniBeatEffect === 'blink' || miniBeatEffect === 'both') {
        const blinkEnable = activeMiniBeats.map(tm => `between(t,${tm},${(tm + 0.06).toFixed(3)})`).join('+');
        videoFilter += `,eq=brightness='0-0.45*(${blinkEnable})':eval=frame`;
      }
      if (miniBeatEffect === 'shake' || miniBeatEffect === 'both') {
        const shakeEnable = activeMiniBeats.map(tm => `between(t,${tm},${(tm + 0.12).toFixed(3)})`).join('+');
        // Scale up slightly to cushion edges (forcing even dimensions)
        videoFilter += `,scale=w='2*trunc((1.06*${targetWidth})/2)':h='2*trunc((1.06*${targetHeight})/2)'`;
        // Shake crop centered (forcing even coordinates to prevent green lines/borders)
        const xShake = `'2*trunc(((iw-ow)/2+15*sin(2*PI*t*25)*(${shakeEnable}))/2)'`;
        const yShake = `'2*trunc(((ih-oh)/2+15*cos(2*PI*t*30)*(${shakeEnable}))/2)'`;
        videoFilter += `,crop=${targetWidth}:${targetHeight}:x=${xShake}:y=${yShake}`;
      }
    }

    // ======== VIRAL BEAT EFFECTS ========
    
    // Speed Ramp — freeze first frame briefly for dramatic beat-hit pause
    if (bfx.speedRamp && sceneDuration > 0.3) {
      const hold = Math.min(Number(bfx.speedRampHold) || 0.1, sceneDuration * 0.3);
      const holdPts = hold.toFixed(4);
      const comp = (sceneDuration / (sceneDuration - hold)).toFixed(4);
      // Freeze: output PTS=0 while input T < hold, then resume with speed compensation
      videoFilter += `,setpts='if(lt(T,${holdPts}),0,${holdPts}/TB+(PTS-STARTPTS-${holdPts}/TB)/${comp})'`;
    }
    
    // Bass Bounce — scale pulse on beat entry with elastic decay
    if (bfx.bassBounce && sceneDuration > 0.2) {
      const bScale = Number(bfx.bassBounceScale) || 1.06;
      const bounceExpr = `if(lt(t,0.15),1.0+(${bScale}-1.0)*pow(1-t/0.15,2),1.0)`;
      videoFilter += `,scale=w='trunc((${bounceExpr})*${targetWidth}/2)*2':h='trunc((${bounceExpr})*${targetHeight}/2)*2':eval=frame`;
      videoFilter += `,crop=${targetWidth}:${targetHeight}:2*trunc((iw-${targetWidth})/4):2*trunc((ih-${targetHeight})/4)`;
    }
    
    // Spin Transition — quick rotation on beat entry
    if (bfx.spinTransition && sceneDuration > 0.3) {
      const deg = Number(bfx.spinDegrees) || 90;
      const rad = (deg * Math.PI / 180).toFixed(4);
      // Rotate in from angle, ease-out cubic to 0
      videoFilter += `,rotate=a='if(lt(t,0.25),${rad}*pow(1-t/0.25,3),0)':ow=${targetWidth}:oh=${targetHeight}:c=black`;
    }
    
    // White Flash — bright flash on beat entry
    if (bfx.whiteFlash && sceneDuration > 0.1) {
      const intensity = Number(bfx.whiteFlashIntensity) || 0.6;
      videoFilter += `,eq=brightness='${intensity}*if(lt(t,0.08),pow(1-t/0.08,2),0)':eval=frame`;
    }
    
    // RGB Split / Chromatic Aberration on beat entry — stepped static values (rgbashift rh/bh are int-only)
    if (bfx.rgbSplit && sceneDuration > 0.12) {
      const px = Math.round(Number(bfx.rgbSplitPixels) || 6);
      // Decaying chromatic shift: full → 2/3 → 1/3 → none over 0.1s
      videoFilter += `,rgbashift=rh=${-px}:bh=${px}:edge=smear:enable='lt(t,0.033)'`;
      videoFilter += `,rgbashift=rh=${-Math.round(px*0.66)}:bh=${Math.round(px*0.66)}:edge=smear:enable='between(t,0.033,0.066)'`;
      videoFilter += `,rgbashift=rh=${-Math.round(px*0.33)}:bh=${Math.round(px*0.33)}:edge=smear:enable='between(t,0.066,0.1)'`;
    }
    
    // Color Flash / Tint Pulse on beat entry
    if (bfx.colorFlash && sceneDuration > 0.12) {
      // Parse hex to RGB ratios for colorbalance
      const hex = bfx.colorFlashTint || '#FF6B00';
      const r = parseInt(hex.slice(1,3), 16) / 255;
      const g = parseInt(hex.slice(3,5), 16) / 255;
      const b = parseInt(hex.slice(5,7), 16) / 255;
      // Shift highlights toward the tint color, decaying over 0.12s
      const rShift = ((r - 0.5) * 0.8).toFixed(3);
      const gShift = ((g - 0.5) * 0.8).toFixed(3);
      const bShift = ((b - 0.5) * 0.8).toFixed(3);
      videoFilter += `,colorbalance=rh=${rShift}:gh=${gShift}:bh=${bShift}:enable='lt(t,0.12)'`;
    }
    
    // Negative / Invert Flash — brief color inversion on beat
    if (bfx.negativeFlash && sceneDuration > 0.08) {
      videoFilter += `,negate=enable='lt(t,0.06)'`;
    }
    
    // Whip Pan — extreme blur on entry and exit for whip-camera feel
    if (bfx.whipPan && sceneDuration > 0.2) {
      const str = Math.round(Number(bfx.whipPanStrength) || 30);
      // Entry blur (decaying)
      videoFilter += `,boxblur=lr=${str}:lp=1:enable='lt(t,0.08)'`;
      videoFilter += `,boxblur=lr=${Math.round(str*0.5)}:lp=1:enable='between(t,0.08,0.14)'`;
      // Exit blur (accelerating)
      const e1 = (sceneDuration - 0.14).toFixed(3);
      const e2 = (sceneDuration - 0.08).toFixed(3);
      videoFilter += `,boxblur=lr=${Math.round(str*0.5)}:lp=1:enable='between(t,${e1},${e2})'`;
      videoFilter += `,boxblur=lr=${str}:lp=1:enable='gt(t,${e2})'`;
    }
    
    // Glitch Tear — horizontal displacement on beat entry (stepped)
    if (bfx.glitchTear && sceneDuration > 0.1) {
      const gpx = 2 * Math.round((Number(bfx.glitchTearPixels) || 20) / 2); // Make sure gpx is always even for chroma alignment
      // Phase 1: shift left for 0.04s, Phase 2: shift right for 0.04s
      videoFilter += `,pad=w=${targetWidth + gpx * 2}:h=${targetHeight}:x=${gpx}:y=0:color=black`;
      videoFilter += `,crop=${targetWidth}:${targetHeight}:x='${gpx}-${gpx}*if(lt(t,0.04),1,0)+${gpx}*if(between(t,0.04,0.08),1,0)':y=0`;
    }
    
    // Film Grain — always-on subtle noise overlay
    if (bfx.filmGrain) {
      const amt = Math.round(Number(bfx.filmGrainAmount) || 12);
      videoFilter += `,noise=alls=${amt}:allf=t`;
    }
    
    // Vignette Pulse — dark corners that intensify on beat entry
    if (bfx.vignettePulse) {
      const vigExpr = sceneDuration > 0.2
        ? `PI/4+0.4*if(lt(t,0.15),pow(1-t/0.15,2),0)`
        : 'PI/4';
      videoFilter += `,vignette=a='${vigExpr}':eval=frame`;
    }
    
    // Letterbox — cinematic bars (always-on)
    if (bfx.letterbox) {
      const barH = Math.round(Number(bfx.letterboxSize) || 50);
      videoFilter += `,drawbox=x=0:y=0:w=${targetWidth}:h=${barH}:color=black:t=fill`;
      videoFilter += `,drawbox=x=0:y=${targetHeight - barH}:w=${targetWidth}:h=${barH}:color=black:t=fill`;
    }

    // Add subtitles filter using absolute fontsdir path to ensure custom fonts are loaded correctly
    videoFilter += `,subtitles=sub_${i}.ass:fontsdir='${fontsDir}'`;

    // Render color emojis centered above the active spoken keywords using movie + overlay filters
    const emojisToDraw = [];
    if (subtitleStyle.showEmojis && scene.words && scene.words.length > 0) {
      const fontSize = Math.round((subtitleStyle.fontSize || 24) * (targetHeight / 640));
      const emojiSize = Math.round(fontSize * 1.25);

      const textPositionX = subtitleStyle.textPositionX !== undefined ? parseInt(subtitleStyle.textPositionX, 10) : 0;
      let textPositionY = -70; // default to bottom placement
      if (subtitleStyle.textPositionY !== undefined) {
        textPositionY = parseInt(subtitleStyle.textPositionY, 10);
      } else if (subtitleStyle.verticalAlignment === 'middle') {
        textPositionY = 0;
      } else if (subtitleStyle.verticalAlignment === 'top') {
        textPositionY = 75;
      }

      const X_pos = Math.round((targetWidth / 2) + (textPositionX / 100) * (targetWidth * 0.42));
      const Y_pos = Math.round((targetHeight / 2) - (textPositionY / 100) * (targetHeight * 0.42));

      const mode = subtitleStyle.subtitleMode || 'classic';

      for (let j = 0; j < scene.words.length; j++) {
        const w = scene.words[j];
        const rawEmoji = getWordEmoji(w.word);
        if (rawEmoji) {
          const cleanEmoji = rawEmoji; // Use full emoji string (including gender/joiners) for high-res Apple Color Emoji mapping
          if (cleanEmoji) {
            try {
              const emojiPngPath = await ensureEmojiPngExists(cleanEmoji);
              if (emojiPngPath) {
                const start = Math.max(0, w.start_time - scene.start_time).toFixed(3);
                
                let activeChunk = null;
                let activeWordIdxInChunk = -1;

                if (mode === 'smart-highlight') {
                  // Re-create the chunks inside assembleVideo to align exactly
                  const localWords = scene.words.map(item => ({
                    word: item.word,
                    start: Math.max(0, item.start_time - scene.start_time),
                    end: Math.min(sceneDuration, item.end_time - scene.start_time)
                  }));
                  
                  const chunks = [];
                  let currentChunk = [];
                  let currentLen = 0;
                  for (let i = 0; i < localWords.length; i++) {
                    const item = localWords[i];
                    if (currentChunk.length >= 3 || (currentChunk.length > 0 && currentLen + item.word.length > 20)) {
                      chunks.push(currentChunk);
                      currentChunk = [item];
                      currentLen = item.word.length;
                    } else {
                      currentChunk.push(item);
                      currentLen += (currentChunk.length > 1 ? 1 : 0) + item.word.length;
                    }
                  }
                  if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                  }

                  // Find which chunk the active word belongs to
                  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
                    const chunk = chunks[cIdx];
                    const idx = chunk.findIndex(item => item.word === w.word && Math.abs(item.start - (w.start_time - scene.start_time)) < 0.01);
                    if (idx !== -1) {
                      activeChunk = chunk;
                      activeWordIdxInChunk = idx;
                      break;
                    }
                  }
                }

                // Align emoji duration exactly with highlight duration
                let endVal = w.end_time - scene.start_time;
                if (mode === 'smart-highlight' && activeChunk && activeWordIdxInChunk !== -1) {
                  const isLast = (activeWordIdxInChunk === activeChunk.length - 1);
                  if (!isLast) {
                    const nextWord = activeChunk[activeWordIdxInChunk + 1];
                    endVal = nextWord.start;
                  }
                }
                const end = Math.min(sceneDuration, endVal).toFixed(3);
                
                let emojiX = X_pos;
                let emojiY = Y_pos;

                if (mode === 'classic') {
                  emojiY = Math.round(Y_pos - fontSize * 0.65);
                } else if (mode === 'smart-highlight') {
                  emojiY = Math.round(Y_pos - fontSize * 0.80);
                  
                  if (activeChunk) {
                    let charWidthFactor = 0.52;
                    const fontName = subtitleStyle.fontName || 'Poppins';
                    if (fontName === 'Anton') charWidthFactor = 0.42;
                    else if (fontName === 'Bangers') charWidthFactor = 0.48;
                    else if (fontName === 'Impact') charWidthFactor = 0.52;
                    else if (fontName === 'Kalam') charWidthFactor = 0.50;

                    const spaceWidth = 0.25 * fontSize;
                    const wordWidths = activeChunk.map(item => item.word.length * charWidthFactor * fontSize);
                    const totalChunkWidth = wordWidths.reduce((sum, val) => sum + val, 0) + (activeChunk.length - 1) * spaceWidth;
                    
                    const lineLeft = X_pos - totalChunkWidth / 2;
                    let wordLeft = lineLeft;
                    for (let i = 0; i < activeWordIdxInChunk; i++) {
                      wordLeft += wordWidths[i] + spaceWidth;
                    }
                    const wordCenter = wordLeft + wordWidths[activeWordIdxInChunk] / 2;
                    emojiX = Math.round(wordCenter);
                  }
                } else if (mode === 'centered-word') {
                  emojiY = Math.round(Y_pos - fontSize * 0.75);
                } else { // pop mode (random positions)
                  const hash = (seed) => {
                    let h = seed * 2654435761;
                    h = ((h >>> 16) ^ h) * 0x45d9f3b;
                    h = ((h >>> 16) ^ h) * 0x45d9f3b;
                    h = (h >>> 16) ^ h;
                    return Math.abs(h);
                  };
                  const marginX = Math.round(targetWidth * 0.15);
                  const marginY = Math.round(targetHeight * 0.15);
                  const safeW = targetWidth - 2 * marginX;
                  const safeH = targetHeight - 2 * marginY;

                  const hx = hash(j * 7 + 13);
                  const hy = hash(j * 11 + 37);
                  const rx = marginX + (hx % safeW);
                  const ry = marginY + (hy % safeH);

                  emojiX = rx;
                  emojiY = Math.round(ry - fontSize * 0.75);
                }

                emojisToDraw.push({
                  path: emojiPngPath.replace(/\\/g, '/').replace(/'/g, "'\\\\''"),
                  size: emojiSize,
                  x: emojiX,
                  y: emojiY,
                  start,
                  end
                });
              }
            } catch (err) {
              console.warn(`Could not ensure color emoji PNG for ${cleanEmoji}:`, err.message);
            }
          }
        }
      }
    }

    if (emojisToDraw.length > 0) {
      videoFilter += '[vbase]';
      let currentStream = 'vbase';
      for (let j = 0; j < emojisToDraw.length; j++) {
        const em = emojisToDraw[j];
        const nextStream = `v_em${j}`;
        videoFilter += `;movie='${em.path}',scale=${em.size}:-1[e${j}];[${currentStream}][e${j}]overlay=x='${em.x}-w/2':y='${em.y}-h':enable='between(t,${em.start},${em.end})'[${nextStream}]`;
        currentStream = nextStream;
      }
      videoFilter += `;[${currentStream}]fps=fps=${targetFps}`;
    } else {
      videoFilter += `,fps=fps=${targetFps}`;
    }

    const args = [
      '-ss', String(scene.clipStart || 0),
      '-i', clip.path,
      '-t', String(sceneDuration), // Limit the output of this scene to its target duration
      '-vf', videoFilter,
      '-c:v', 'libx264',
      '-profile:v', 'main',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',
      '-r', String(targetFps), // Standardize framerate
      '-video_track_timescale', '90000', // Force identical timescale for concat demuxer compatibility
      '-an', // Strip original audio
      '-y',
      `scene_${i}.mp4`
    ];

    console.log(`Processing sub-clip for scene ${i}: ${args.join(' ')}`);
    
    // Execute FFmpeg in the context of the tempDir
    await runFFmpeg(args, { cwd: tempDir });
    processedSceneClips.push(tempSceneClipPath);
  }

  onProgress(75, 'Merging clips together...');

  // Step 2: Concatenate all sub-clips using the concat demuxer
  // Write concat file list
  const concatFilePath = path.join(tempDir, 'concat_list.txt');
  const concatFileContent = processedSceneClips
    .map(p => `file '${path.basename(p)}'`)
    .join('\n');
  await fs.writeFile(concatFilePath, concatFileContent, 'utf-8');

  const concatVideoOnlyPath = path.join(tempDir, 'concatenated_video.mp4');
  
  // Concatenate videos together (very fast, no re-encoding required as they are standardized)
  const concatArgs = [
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat_list.txt',
    '-c', 'copy',
    '-y',
    'concatenated_video.mp4'
  ];
  await runFFmpeg(concatArgs, { cwd: tempDir });

  onProgress(85, 'Mixing voiceover, music, and rendering final video...');

  // Step 3: Mix Audio and compile final render
  const finalOutputPath = path.join(outputDir, `render_${jobId}.mp4`);
  const renderArgs = [
    '-i', concatVideoOnlyPath,
    '-i', voiceoverPath
  ];

  if (bgMusicPath && existsSync(bgMusicPath)) {
    // Apply start offset (seek) before the BGM input if specified
    const bgOffset = Number(bgMusicStartOffset) || 0;
    if (bgOffset > 0) {
      renderArgs.push('-ss', String(bgOffset));
    }
    renderArgs.push('-i', bgMusicPath);
    // Mix voiceover (input 1, with volume control) and bg music (input 2, with volume control)
    // Cap duration to voiceover (first audio input)
    const voVol = Number(voiceoverVolume) || 1.0;
    renderArgs.push('-filter_complex', `[1:a]volume=${voVol}[vo];[2:a]volume=${bgMusicVolume}[bg];[vo][bg]amix=inputs=2:duration=first[a]`);
    renderArgs.push('-map', '0:v', '-map', '[a]');
  } else {
    // Just map the voiceover directly (with optional volume adjustment)
    const voVol = Number(voiceoverVolume) || 1.0;
    if (voVol !== 1.0) {
      renderArgs.push('-filter_complex', `[1:a]volume=${voVol}[a]`);
      renderArgs.push('-map', '0:v', '-map', '[a]');
    } else {
      renderArgs.push('-map', '0:v', '-map', '1:a');
    }
  }

  renderArgs.push(
    '-c:v', 'copy', // Copy video (zero encoding overhead, instant)
    '-video_track_timescale', '90000', // Standardize final output timescale
    '-c:a', 'aac',  // Encode mixed audio
    '-y',
    finalOutputPath
  );

  await runFFmpeg(renderArgs, { cwd: tempDir });

  // Cleanup temp files
  onProgress(95, 'Cleaning up temporary render files (skipped for debugging)...');
  /*
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.unlink(path.join(tempDir, file));
    }
    await fs.rmdir(tempDir);
  } catch (cleanupErr) {
    console.warn('Temporary directory cleanup failed:', cleanupErr.message);
  }
  */

  onProgress(100, 'Video generation successfully complete!');
  return finalOutputPath;
}

/**
 * Extracts audio from a video file using FFmpeg
 */
export async function extractAudioFromVideo(videoPath, audioOutputPath) {
  try {
    console.log(`Extracting audio from video: ${videoPath} to ${audioOutputPath}...`);
    await runFFmpeg([
      '-y',
      '-i', videoPath,
      '-vn',
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      audioOutputPath
    ]);
    return audioOutputPath;
  } catch (err) {
    console.warn('LAME encoder failed, trying native AAC encoding fallback...', err.message);
    const fallbackPath = audioOutputPath.replace(/\.mp3$/, '.m4a');
    await runFFmpeg([
      '-y',
      '-i', videoPath,
      '-vn',
      '-c:a', 'aac',
      fallbackPath
    ]);
    return fallbackPath;
  }
}

