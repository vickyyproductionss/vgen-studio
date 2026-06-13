import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { gcsService } from './gcs.js';

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
    return 0;
  } catch (err) {
    console.warn(`Failed to parse duration for ${filePath}:`, err.message);
    return 0;
  }
}

/**
 * Parses video width and height using ffmpeg -i
 */
export async function getVideoDimensions(filePath) {
  try {
    const { stderr } = await runFFmpeg(['-i', filePath]).catch(err => {
      if (err.message.includes('Stderr:')) {
        return { stderr: err.message };
      }
      throw err;
    });

    const match = stderr.match(/Video:.*?, (\d+)x(\d+)/);
    if (match) {
      return {
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10)
      };
    }
    return { width: 1080, height: 1920 }; // fallback
  } catch (error) {
    console.error(`Error getting dimensions for ${filePath}:`, error);
    return { width: 1080, height: 1920 };
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

function pctToAssAlpha(pct) {
  if (pct === undefined || pct === null) return '00';
  const opacity = Math.max(0, Math.min(100, parseFloat(pct)));
  const alphaVal = Math.round((1 - opacity / 100) * 255);
  return alphaVal.toString(16).toUpperCase().padStart(2, '0');
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
 * Helper to ensure a color string has a trailing '&' for ASS override tags (e.g. \c&HBBGGRR&)
 */
function toTagColor(colorStr) {
  if (!colorStr) return '';
  return colorStr.endsWith('&') ? colorStr : `${colorStr}&`;
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
  
  // 1. Check if there is a literal Unicode emoji in the word
  const match = word.match(/\p{Extended_Pictographic}/u);
  if (match) {
    return match[0];
  }
  
  // 2. Fallback to keyword-based lookup
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

function getWordCategory(word) {
  if (getWordEmoji(word)) return 'emoji';
  if (isEmphasisWord(word)) return 'highlight';
  return 'normal';
}

function resolveStyleObj(style) {
  const baseGlowColor = style.glowColor || '#00FFFF';
  const baseGlowBlur = style.glowBlur !== undefined ? style.glowBlur : 6;
  const baseGlowDistance = style.glowDistance !== undefined ? style.glowDistance : 3;
  const baseNeonGlow = !!style.neonGlow;

  const normalStyle = {
    fontColor: style.normalStyle?.fontColor || style.fontColor || '#FFFFFF',
    activeWordScale: style.normalStyle?.activeWordScale !== undefined ? style.normalStyle.activeWordScale : 1.0,
    neonGlow: style.normalStyle?.neonGlow !== undefined ? style.normalStyle.neonGlow : baseNeonGlow,
    glowColor: style.normalStyle?.glowColor || baseGlowColor,
    glowBlur: style.normalStyle?.glowBlur !== undefined ? style.normalStyle.glowBlur : baseGlowBlur,
    glowDistance: style.normalStyle?.glowDistance !== undefined ? style.normalStyle.glowDistance : baseGlowDistance,
    outlineSize: style.outlineSize
  };

  const highlightStyle = {
    fontColor: style.highlightStyle?.fontColor || style.highlightColor || '#FFFF00',
    activeWordScale: style.highlightStyle?.activeWordScale !== undefined ? style.highlightStyle.activeWordScale : (style.activeWordScale !== undefined ? style.activeWordScale : 1.15),
    neonGlow: style.highlightStyle?.neonGlow !== undefined ? style.highlightStyle.neonGlow : baseNeonGlow,
    glowColor: style.highlightStyle?.glowColor || baseGlowColor,
    glowBlur: style.highlightStyle?.glowBlur !== undefined ? style.highlightStyle.glowBlur : baseGlowBlur,
    glowDistance: style.highlightStyle?.glowDistance !== undefined ? style.highlightStyle.glowDistance : baseGlowDistance,
    outlineSize: style.outlineSize
  };

  const emojiStyle = {
    fontColor: style.emojiStyle?.fontColor || style.highlightColor || '#FFFF00',
    activeWordScale: style.emojiStyle?.activeWordScale !== undefined ? style.emojiStyle.activeWordScale : (style.activeWordScale !== undefined ? style.activeWordScale : 1.15),
    neonGlow: style.emojiStyle?.neonGlow !== undefined ? style.emojiStyle.neonGlow : baseNeonGlow,
    glowColor: style.emojiStyle?.glowColor || baseGlowColor,
    glowBlur: style.emojiStyle?.glowBlur !== undefined ? style.emojiStyle.glowBlur : baseGlowBlur,
    glowDistance: style.emojiStyle?.glowDistance !== undefined ? style.emojiStyle.glowDistance : baseGlowDistance,
    outlineSize: style.outlineSize
  };

  return { normalStyle, highlightStyle, emojiStyle };
}

function getWordTags(wordStyle, isActive, layerType, baseOutlineColor, baseOutlineSize, baseFontSize, style, category) {
  const outlineSize = style.pop3d ? Math.max(style.outlineSize || 3, 4) : (style.outlineSize || 3);
  const fontCol = toTagColor(hexToAssColor(wordStyle.fontColor));
  const outlineCol = toTagColor(baseOutlineColor);

  if (isActive) {
    if (layerType === 'core') {
      // Core Layer: Keep it sharp. If neonGlow is active, fill with white.
      const fillCol = wordStyle.neonGlow ? '&H00FFFFFF&' : fontCol;
      return `\\c${fillCol}\\3c${outlineCol}\\bord${outlineSize}\\blur0`;
    } else {
      // Glow Layers
      if (wordStyle.neonGlow) {
        const glowCol = toTagColor(hexToAssColor(wordStyle.glowColor || '#00FFFF'));
        const glowBlur = wordStyle.glowBlur !== undefined ? wordStyle.glowBlur : 6;
        const glowDistance = wordStyle.glowDistance !== undefined ? wordStyle.glowDistance : 3;
        
        // Street Light Glow Logic:
        // We scale the border size using glowDistance, and use large, staggered blurs
        // to create a smooth, wide gradient falloff decay into the background.
        if (layerType === 'glowOuter' || layerType === 'outerGlow') {
          const borderSize = Math.round(outlineSize + glowDistance * 6.0);
          const blurVal = Math.round(glowBlur * 5.0 + glowDistance * 3.0);
          return `\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\blur${blurVal}\\bord${borderSize}\\alpha&HBB&`;
        } else if (layerType === 'glowMedium') {
          const borderSize = Math.round(outlineSize + glowDistance * 3.0);
          const blurVal = Math.round(glowBlur * 3.0 + glowDistance * 1.5);
          return `\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\blur${blurVal}\\bord${borderSize}\\alpha&H77&`;
        } else {
          // glowInner / innerGlow
          const borderSize = Math.round(outlineSize + glowDistance * 1.0);
          const blurVal = Math.round(glowBlur * 1.5 + glowDistance * 0.5);
          return `\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\blur${blurVal}\\bord${borderSize}\\alpha&H22&`;
        }
      } else {
        // Transparent
        return `\\alpha&HFF&`;
      }
    }
  } else {
    // Inactive word
    let inactiveColorHex = style.normalStyle?.fontColor || style.fontColor || '#FFFFFF';
    if (style.autoEmphasis) {
      if (category === 'highlight') {
        inactiveColorHex = style.highlightStyle?.fontColor || style.highlightColor || '#FFFF00';
      } else if (category === 'emoji') {
        inactiveColorHex = style.emojiStyle?.fontColor || style.highlightColor || '#FFFF00';
      }
    }
    const inactiveFontCol = toTagColor(hexToAssColor(inactiveColorHex));
    
    if (layerType === 'core') {
      // Inactive core is sharp, no glow
      return `\\c${inactiveFontCol}\\3c${outlineCol}\\bord${outlineSize}\\blur0`;
    } else {
      // Inactive glow layer is fully transparent
      return `\\alpha&HFF&`;
    }
  }
}

function applyNeonGlowToEvents(eventsStr, style, primaryColor, outlineColor) {
  const lines = eventsStr.split('\n');
  const result = [];
  const glowCol = toTagColor(hexToAssColor(style.glowColor || '#00FFFF'));
  const coreCol = '&H00FFFFFF&'; // pure white core
  const blurVal = style.glowBlur !== undefined ? style.glowBlur : 6;
  const distanceVal = style.glowDistance !== undefined ? style.glowDistance : 3;

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

    let cleanTags = '';
    let restText = textPart;
    if (textPart.startsWith('{')) {
      const closingBraceIdx = textPart.indexOf('}');
      if (closingBraceIdx !== -1) {
        const tags = textPart.substring(1, closingBraceIdx);
        restText = textPart.substring(closingBraceIdx + 1);
        cleanTags = tags
          .replace(/\\c&H[0-9A-Fa-f]+&/g, '')
          .replace(/\\3c&H[0-9A-Fa-f]+&/g, '')
          .replace(/\\4c&H[0-9A-Fa-f]+&/g, '')
          .replace(/\\bord\d+/g, '');
      }
    }

    const baseOutlineSize = style.outlineSize || 3;

    // 1. Outer Glow (Wide, faint)
    const glowMetaPartsOuter = [...metaParts];
    glowMetaPartsOuter[0] = `Dialogue: ${layer}`;
    const glowMetaOuter = glowMetaPartsOuter.join(',');
    const outerBorderSize = Math.round(baseOutlineSize + distanceVal * 6.0);
    const outerBlur = Math.round(blurVal * 5.0 + distanceVal * 3.0);
    const outerGlowText = `{\\blur${outerBlur}\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\bord${outerBorderSize}\\alpha&HBB&${cleanTags}}${restText}`;
    result.push(`${glowMetaOuter},${outerGlowText}`);

    // 2. Medium Glow
    const glowMetaPartsMed = [...metaParts];
    glowMetaPartsMed[0] = `Dialogue: ${layer + 1}`;
    const glowMetaMed = glowMetaPartsMed.join(',');
    const medBorderSize = Math.round(baseOutlineSize + distanceVal * 3.0);
    const medBlur = Math.round(blurVal * 3.0 + distanceVal * 1.5);
    const medGlowText = `{\\blur${medBlur}\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\bord${medBorderSize}\\alpha&H77&${cleanTags}}${restText}`;
    result.push(`${glowMetaMed},${medGlowText}`);

    // 3. Inner Glow (Brighter, closer)
    const glowMetaPartsInner = [...metaParts];
    glowMetaPartsInner[0] = `Dialogue: ${layer + 2}`;
    const glowMetaInner = glowMetaPartsInner.join(',');
    const innerBorderSize = Math.round(baseOutlineSize + distanceVal * 1.0);
    const innerBlur = Math.round(blurVal * 1.5 + distanceVal * 0.5);
    const innerGlowText = `{\\blur${innerBlur}\\c${glowCol}\\3c${glowCol}\\4c${glowCol}\\bord${innerBorderSize}\\alpha&H22&${cleanTags}}${restText}`;
    result.push(`${glowMetaInner},${innerGlowText}`);

    // 4. Core Line (Layer + 3, on top)
    const coreMetaParts = [...metaParts];
    coreMetaParts[0] = `Dialogue: ${layer + 3}`;
    const coreMeta = coreMetaParts.join(',');
    const coreTags = `\\c${coreCol}\\3c${toTagColor(outlineColor)}${cleanTags}`;
    const coreText = `{${coreTags}}${restText}`;
    result.push(`${coreMeta},${coreText}`);
  }

  return result.join('\n');
}

/**
 * Helper to localize and adjust word timings relative to a scene start.
 * Ensures word timings are sequential, non-overlapping, and fit strictly within [0, duration].
 */
export function getLocalWordTimings(words, sceneStartTime, duration) {
  if (!words || words.length === 0) return [];
  
  // 1. Initial localization relative to sceneStartTime
  const localWords = words.map(w => ({
    word: w.word,
    start: w.start_time - sceneStartTime,
    end: w.end_time - sceneStartTime
  }));

  const N = localWords.length;
  const safeDuration = Math.max(0.01, duration);
  // Calculate minimum word duration (e.g. 0.08s, but at most duration / N)
  const W = Math.max(0.001, Math.min(0.08, safeDuration / N));

  // 2. Adjust starts to fit in [0, duration] with minimum spacing W
  const starts = [];
  for (let i = 0; i < N; i++) {
    const idealStart = localWords[i].start;
    const minStart = i * W;
    const maxStart = safeDuration - (N - i) * W;
    const clampedStart = Math.max(minStart, Math.min(maxStart, idealStart));
    starts.push(clampedStart);
  }

  // 3. Compute ends ensuring they are >= start + W, <= duration, and <= next start
  const adjustedWords = [];
  for (let i = 0; i < N; i++) {
    const originalDur = Math.max(W, localWords[i].end - localWords[i].start);
    const start = starts[i];
    const nextStart = (i < N - 1) ? starts[i + 1] : safeDuration;
    const end = Math.min(nextStart, start + originalDur);
    adjustedWords.push({
      word: localWords[i].word,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3))
    });
  }

  return adjustedWords;
}

/**
 * Generates an ASS subtitle file content
 */
export function createAssFileContent(originalScene, duration, style, width, height, totalDuration = 0) {
  const scene = {
    ...originalScene,
    text: shapeDevanagari(originalScene.text),
    words: originalScene.words ? originalScene.words.map(w => ({
      ...w,
      word: shapeDevanagari(w.word)
    })) : []
  };
  let fontName = style.fontName || 'Arial';
  const stripEmojis = (text) => {
    if (!text) return '';
    return text.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}\u{2640}\u{2642}]+/gu, '');
  };

  let forceBold = false;
  // Handle Kalam Bold: internal font family is "Kalam" with bold weight
  if (fontName === 'Kalam Bold') {
    fontName = 'Kalam';
    forceBold = true;
  }
  const isBold = forceBold || !!style.bold;
  const fontSize = Math.round((style.fontSize || 24) * (height / 640)); // Scale font size relative to resolution
  
  const { normalStyle, highlightStyle, emojiStyle } = resolveStyleObj(style);
  const anyNeonGlow = normalStyle.neonGlow || highlightStyle.neonGlow || emojiStyle.neonGlow;

  const primaryColor = hexToAssColor(normalStyle.fontColor);
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
    // Always strip literal Unicode emojis from subtitle text to prevent broken box rendering
    const cleanText = text ? stripEmojis(text) : '';
    const duration = end - start;
    const transition = style.textTransition || 'none';
    const motion = style.textMotion || 'none';
    const tagCol = col ? toTagColor(col) : '';

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
      return `Dialogue: ${layer},${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}${extraTags}${tagCol ? `\\c${tagCol}` : ''}}${cleanText}\n`;
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

    let result = `Dialogue: ${layer},${formatTime(start)},${formatTime(t1)},Default,,0,0,0,,{\\an5${inMove}${inAnim}${fadeTag}${extraTags}${tagCol ? `\\c${tagCol}` : ''}}${cleanText}\n`;
    result += `Dialogue: ${layer},${formatTime(t1)},${formatTime(t2)},Default,,0,0,0,,{\\an5${midMove}${extraTags}${tagCol ? `\\c${tagCol}` : ''}}${cleanText}\n`;
    result += `Dialogue: ${layer},${formatTime(t2)},${formatTime(end)},Default,,0,0,0,,{\\an5${outMove}${outAnim}${fadeTagOut}${extraTags}${tagCol ? `\\c${tagCol}` : ''}}${cleanText}\n`;
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

  let headingStyleLine = '';
  let headingEvents = '';
  const headingTopPct = style.headingTopOffset !== undefined ? parseFloat(style.headingTopOffset) : 5;
  const headingLeftPct = style.headingLeftOffset !== undefined ? parseFloat(style.headingLeftOffset) : 5;

  if (style.headingTitle && style.headingTitle.trim().length > 0 && style.brandingTheme !== 'fitness-in-chunks') {
    const headingFont = style.headingFontName || 'Montserrat';
    const headingFontSize = Math.round((style.headingFontSize || 18) * (height / 640));
    
    const boxOpacity = style.headingBoxOpacity !== undefined ? style.headingBoxOpacity : 85;
    const textOpacity = style.headingTextOpacity !== undefined ? style.headingTextOpacity : 100;
    const boxAlpha = pctToAssAlpha(boxOpacity);
    const textAlpha = pctToAssAlpha(textOpacity);
    
    const headingFontColor = hexToAssColor(style.headingFontColor || '#FFFFFF', textAlpha);
    const headingBoxColor = hexToAssColor(style.headingBoxColor || '#1A1A1A', boxAlpha);
    const headingOutline = Math.max(4, Math.round((style.headingPadding || 6) * (height / 640)));
    const marginL = Math.round(width * (headingLeftPct / 100));
    const marginR = Math.round(width * 0.5);
    const marginV_heading = Math.round(height * (headingTopPct / 100));
    
    headingStyleLine = `Style: Heading,${headingFont},${headingFontSize},${headingFontColor},&H000000FF,&H00000000,${headingBoxColor},-1,0,0,0,100,100,0,0,3,${headingOutline},0,7,${marginL},${marginR},${marginV_heading},1\n`;
    
    const globalStart = scene.start_time || 0.0;
    const globalEnd = scene.end_time || (globalStart + duration);
    const headingStartGlobal = 0.0;
    const headingEndGlobal = 3.0;
    
    const overlapStartGlobal = Math.max(globalStart, headingStartGlobal);
    const overlapEndGlobal = Math.min(globalEnd, headingEndGlobal);
    
    if (overlapStartGlobal < overlapEndGlobal) {
      const localStart = overlapStartGlobal - globalStart;
      const localEnd = overlapEndGlobal - globalStart;
      
      const X_heading = Math.round(width * (headingLeftPct / 100));
      const Y_heading = Math.round(height * (headingTopPct / 100));
      const text = stripEmojis(shapeDevanagari(style.headingTitle.trim()));
      
      // Case 1: Both entry and exit inside this scene
      if (globalStart === 0.0 && globalEnd >= 3.0) {
        headingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(0.4)},Heading,,0,0,0,,{\\an7\\move(${-300},${Y_heading},${X_heading},${Y_heading},0,400)\\fad(400,0)}${text}\n`;
        headingEvents += `Dialogue: 10,${formatTime(0.4)},${formatTime(2.7)},Heading,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
        headingEvents += `Dialogue: 10,${formatTime(2.7)},${formatTime(3.0)},Heading,,0,0,0,,{\\an7\\move(${X_heading},${Y_heading},${-300},${Y_heading},0,300)\\fad(0,300)}${text}\n`;
      }
      // Case 2: Entry inside this scene, exit is not
      else if (globalStart === 0.0 && globalEnd < 3.0) {
        if (localEnd <= 0.4) {
          const ms = Math.round(localEnd * 1000);
          headingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(localEnd)},Heading,,0,0,0,,{\\an7\\move(${-300},${Y_heading},${X_heading},${Y_heading},0,${ms})\\fad(${ms},0)}${text}\n`;
        } else {
          headingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(0.4)},Heading,,0,0,0,,{\\an7\\move(${-300},${Y_heading},${X_heading},${Y_heading},0,400)\\fad(400,0)}${text}\n`;
          headingEvents += `Dialogue: 10,${formatTime(0.4)},${formatTime(localEnd)},Heading,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
        }
      }
      // Case 3: Exit inside this scene, entry is not
      else if (globalStart > 0.0 && globalEnd >= 3.0) {
        if (localEnd <= 0.3) {
          const ms = Math.round(localEnd * 1000);
          headingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(localEnd)},Heading,,0,0,0,,{\\an7\\move(${X_heading},${Y_heading},${-300},${Y_heading},0,${ms})\\fad(0,${ms})}${text}\n`;
        } else {
          headingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(localEnd - 0.3)},Heading,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
          headingEvents += `Dialogue: 10,${formatTime(localEnd - 0.3)},${formatTime(localEnd)},Heading,,0,0,0,,{\\an7\\move(${X_heading},${Y_heading},${-300},${Y_heading},0,300)\\fad(0,300)}${text}\n`;
        }
      }
      // Case 4: Sustained throughout scene
      else {
        headingEvents += `Dialogue: 10,${formatTime(localStart)},${formatTime(localEnd)},Heading,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
      }
    }
  }

  let timerStyleLine = '';
  let timerEvents = '';
  if (style.showTimer && totalDuration > 0) {
    let timerFont, timerFontSize, timerFontColor, timerBoxColor, timerBoxOutlineColor, timerOutline, marginL, marginR, marginV_timer, X_timer, Y_timer, borderStyle = 3;
    if (style.brandingTheme === 'fitness-in-chunks') {
      timerFont = style.headingFontName || 'Montserrat';
      timerFontSize = Math.round((style.headingFontSize || 24) * (height / 640) * 0.8 * 1.3);
      timerFontColor = hexToAssColor(style.headingFontColor || '#FFFFFF', '00');
      timerBoxColor = '&H00000000'; // transparent back color
      timerBoxOutlineColor = hexToAssColor('#000000', '00'); // black outline
      timerOutline = Math.max(1, Math.round(1 * (height / 640)));
      marginL = Math.round(width * 0.5);
      marginR = Math.round(width * (headingLeftPct / 100));
      marginV_timer = Math.round(height * (headingTopPct / 100));
      X_timer = width - marginR;
      Y_timer = marginV_timer;
      borderStyle = 1;
    } else {
      timerFont = style.headingFontName || 'Montserrat';
      timerFontSize = Math.round((style.headingFontSize || 18) * (height / 640) * 0.9 * 1.3);
      timerFontColor = hexToAssColor(style.headingFontColor || '#FFFFFF', '00');
      timerBoxColor = hexToAssColor(style.headingBoxColor || '#1A1A1A', 'B0');
      timerBoxOutlineColor = '&H00000000';
      timerOutline = Math.max(4, Math.round((style.headingPadding || 6) * (height / 640)));
      marginL = Math.round(width * 0.5);
      marginR = Math.round(width * (headingLeftPct / 100));
      marginV_timer = Math.round(height * (headingTopPct / 100));
      X_timer = width - Math.round(width * (headingLeftPct / 100));
      Y_timer = Math.round(height * (headingTopPct / 100));
    }
    
    timerStyleLine = `Style: Timer,${timerFont},${timerFontSize},${timerFontColor},&H000000FF,${timerBoxOutlineColor},${timerBoxColor},-1,0,0,0,100,100,0,0,${borderStyle},${timerOutline},0,9,${marginL},${marginR},${marginV_timer},1\n`;
    
    const globalStart = scene.start_time || 0.0;
    const globalEnd = scene.end_time || (globalStart + duration);
    
    const totalSecs = Math.floor(totalDuration);
    for (let sec = 0; sec <= totalSecs; sec++) {
      const secStart = sec;
      const secEnd = (sec === totalSecs) ? totalDuration : sec + 1.0;
      
      const overlapStartGlobal = Math.max(globalStart, secStart);
      const overlapEndGlobal = Math.min(globalEnd, secEnd);
      
      if (overlapStartGlobal < overlapEndGlobal) {
        const localStart = overlapStartGlobal - globalStart;
        const localEnd = overlapEndGlobal - globalStart;
        const remainingSecs = Math.max(0, Math.ceil(totalDuration - sec));
        let text = `${remainingSecs}s`;
        
        if (style.brandingTheme === 'fitness-in-chunks') {
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          const labelFontSize = Math.round(timerFontSize * 0.55);
          text = `${timeStr}\\N{\\fs${labelFontSize}\\alpha&H55&}REMAINING`;
        }
        
        if (sec === 0 && globalStart === 0.0) {
          timerEvents += `Dialogue: 10,${formatTime(localStart)},${formatTime(localEnd)},Timer,,0,0,0,,{\\an9\\move(${width + 100},${Y_timer},${X_timer},${Y_timer},0,400)\\fad(400,0)}${text}\n`;
        }
        else if (overlapEndGlobal >= totalDuration - 0.01) {
          const lineDur = localEnd - localStart;
          const startMs = Math.round(Math.max(0, lineDur - 0.3) * 1000);
          const endMs = Math.round(lineDur * 1000);
          timerEvents += `Dialogue: 10,${formatTime(localStart)},${formatTime(localEnd)},Timer,,0,0,0,,{\\an9\\move(${X_timer},${Y_timer},${width + 100},${Y_timer},${startMs},${endMs})\\fad(0,300)}${text}\n`;
        }
        else {
          timerEvents += `Dialogue: 10,${formatTime(localStart)},${formatTime(localEnd)},Timer,,0,0,0,,{\\an9\\pos(${X_timer},${Y_timer})}${text}\n`;
        }
      }
    }
  }

  let brandingStyleLine = '';
  let brandingEvents = '';
  if (style.brandingTheme === 'fitness-in-chunks') {
    const headingFont = style.headingFontName || 'Montserrat';
    const headingFontSize = Math.round((style.headingFontSize || 24) * (height / 640));
    
    const boxOpacity = style.headingBoxOpacity !== undefined ? style.headingBoxOpacity : 85;
    const textOpacity = style.headingTextOpacity !== undefined ? style.headingTextOpacity : 100;
    const boxAlpha = pctToAssAlpha(boxOpacity);
    const textAlpha = pctToAssAlpha(textOpacity);

    const headingFontColor = hexToAssColor(style.headingFontColor || '#FFFFFF', textAlpha);
    const headingBoxColor = hexToAssColor(style.headingBoxColor || '#000000', boxAlpha);
    const headingOutline = Math.max(6, Math.round((style.headingPadding || 8) * (height / 640)));
    
    const ficLeftPct = style.headingLeftOffset !== undefined ? parseFloat(style.headingLeftOffset) : 6;
    
    const marginL = Math.round(width * (ficLeftPct / 100));
    const marginR = Math.round(width * 0.4);
    const marginV_heading = Math.round(height * (headingTopPct / 100));

    brandingStyleLine += `Style: FIC_Topic,${headingFont},${headingFontSize},${headingFontColor},&H000000FF,${headingBoxColor},${headingBoxColor},-1,0,0,0,100,100,0,0,3,${headingOutline},0,7,${marginL},${marginR},${marginV_heading},1\n`;

    const epFontSize = Math.round(18 * (height / 640));
    const seriesFontSize = Math.round(12 * (height / 640));
    const blockMarginL = Math.round(width * 0.06) + 15;
    const blockMarginV = height - Math.round(1100 * (height / 1280));
    const spacingOffset = Math.round(9 * (height / 640));

    brandingStyleLine += `Style: FIC_Episode,${headingFont},${epFontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,1,${blockMarginL},20,${blockMarginV + spacingOffset},1\n`;
    brandingStyleLine += `Style: FIC_Series,${headingFont},${seriesFontSize},&H66FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,1,${blockMarginL},20,${blockMarginV},1\n`;
    brandingStyleLine += `Style: FIC_Line,${headingFont},10,&H33FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n`;
    brandingStyleLine += `Style: FIC_Progress,${headingFont},10,&HA6FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n`;

    const globalStart = scene.start_time || 0.0;
    const globalEnd = scene.end_time || (globalStart + duration);

    // Topic Card: Display for first 2s of playback
    const headingStartGlobal = 0.0;
    const headingEndGlobal = 2.0;
    const overlapStartGlobal_topic = Math.max(globalStart, headingStartGlobal);
    const overlapEndGlobal_topic = Math.min(globalEnd, headingEndGlobal);
    
    if (overlapStartGlobal_topic < overlapEndGlobal_topic && style.headingTitle && style.headingTitle.trim().length > 0) {
      const localStart = overlapStartGlobal_topic - globalStart;
      const localEnd = overlapEndGlobal_topic - globalStart;
      const X_heading = Math.round(width * (ficLeftPct / 100));
      const Y_heading = Math.round(height * (headingTopPct / 100));
      const text = stripEmojis(shapeDevanagari(style.headingTitle.trim().toUpperCase()));

      if (globalStart === 0.0 && globalEnd >= 2.0) {
        brandingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(0.4)},FIC_Topic,,0,0,0,,{\\an7\\move(${-500},${Y_heading},${X_heading},${Y_heading},0,400)\\fad(400,0)}${text}\n`;
        brandingEvents += `Dialogue: 10,${formatTime(0.4)},${formatTime(1.7)},FIC_Topic,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
        brandingEvents += `Dialogue: 10,${formatTime(1.7)},${formatTime(2.0)},FIC_Topic,,0,0,0,,{\\an7\\move(${X_heading},${Y_heading},${-500},${Y_heading},0,300)\\fad(0,300)}${text}\n`;
      } else if (globalStart === 0.0 && globalEnd < 2.0) {
        if (localEnd <= 0.4) {
          const ms = Math.round(localEnd * 1000);
          brandingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(localEnd)},FIC_Topic,,0,0,0,,{\\an7\\move(${-500},${Y_heading},${X_heading},${Y_heading},0,${ms})\\fad(${ms},0)}${text}\n`;
        } else {
          brandingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(0.4)},FIC_Topic,,0,0,0,,{\\an7\\move(${-500},${Y_heading},${X_heading},${Y_heading},0,400)\\fad(400,0)}${text}\n`;
          brandingEvents += `Dialogue: 10,${formatTime(0.4)},${formatTime(localEnd)},FIC_Topic,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
        }
      } else if (globalStart > 0.0 && globalEnd >= 2.0) {
        if (localEnd <= 0.3) {
          const ms = Math.round(localEnd * 1000);
          brandingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(localEnd)},FIC_Topic,,0,0,0,,{\\an7\\move(${X_heading},${Y_heading},${-500},${Y_heading},0,${ms})\\fad(0,${ms})}${text}\n`;
        } else {
          brandingEvents += `Dialogue: 10,${formatTime(0.0)},${formatTime(localEnd - 0.3)},FIC_Topic,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
          brandingEvents += `Dialogue: 10,${formatTime(localEnd - 0.3)},${formatTime(localEnd)},FIC_Topic,,0,0,0,,{\\an7\\move(${X_heading},${Y_heading},${-500},${Y_heading},0,300)\\fad(0,300)}${text}\n`;
        }
      } else {
        brandingEvents += `Dialogue: 10,${formatTime(localStart)},${formatTime(localEnd)},FIC_Topic,,0,0,0,,{\\an7\\pos(${X_heading},${Y_heading})}${text}\n`;
      }
    }

    // Episode + Series signature block (persistent)
    const overlapStartGlobal_block = Math.max(globalStart, 0.0);
    const overlapEndGlobal_block = Math.min(globalEnd, totalDuration);
    
    if (overlapStartGlobal_block < overlapEndGlobal_block) {
      const epText = stripEmojis((style.episodeNumber || 'EP 01').trim());
      const seriesText = stripEmojis((style.seriesName || 'FITNESSINCHUNKS').trim().toUpperCase());
      
      const endScreenThreshold = Math.max(0, totalDuration - 2.0);
      const segments = [];
      if (overlapStartGlobal_block < endScreenThreshold && overlapEndGlobal_block <= endScreenThreshold) {
        segments.push({ start: overlapStartGlobal_block, end: overlapEndGlobal_block, isEndScreen: false });
      } else if (overlapStartGlobal_block >= endScreenThreshold) {
        segments.push({ start: overlapStartGlobal_block, end: overlapEndGlobal_block, isEndScreen: true });
      } else {
        segments.push({ start: overlapStartGlobal_block, end: endScreenThreshold, isEndScreen: false });
        segments.push({ start: endScreenThreshold, end: overlapEndGlobal_block, isEndScreen: true });
      }
      
      for (const seg of segments) {
        const segLocalStart = seg.start - globalStart;
        const segLocalEnd = seg.end - globalStart;
        
        const lineX = Math.round(width * 0.06);
        const lineOffset = Math.round(5 * (height / 640)); // 10px scaled at 1280
        const lineExtraOffset = Math.round(25 * (height / 1280)); // shift line 25px up independently of texts
        const lineY = height - blockMarginV - spacingOffset - Math.round(epFontSize * 0.75) - lineOffset - lineExtraOffset;
        const lineHeight = spacingOffset + Math.round(epFontSize * 0.75) + 2 * lineOffset;
        
        const opacityTag = seg.isEndScreen ? '{\\alpha&H00&}' : '';
        const isEntry = (globalStart === 0.0 && seg.start === 0.0);
        const animTag = isEntry ? '{\\fad(400,0)}' : '';
        
        brandingEvents += `Dialogue: 11,${formatTime(segLocalStart)},${formatTime(segLocalEnd)},FIC_Episode,,0,0,0,,${animTag}${epText}\n`;
        brandingEvents += `Dialogue: 11,${formatTime(segLocalStart)},${formatTime(segLocalEnd)},FIC_Series,,0,0,0,,${animTag}${opacityTag}${seriesText}\n`;
        brandingEvents += `Dialogue: 11,${formatTime(segLocalStart)},${formatTime(segLocalEnd)},FIC_Line,,0,0,0,,${animTag}{\\pos(${lineX},${lineY})\\p1}m 0 0 l 2 0 l 2 ${lineHeight} l 0 ${lineHeight}{\\p0}\n`;
        
        if (seg.isEndScreen && style.nextEpisode && style.nextEpisode.trim().length > 0) {
          const X_center = Math.round(width / 2);
          const Y_center = Math.round(height * 0.55);
          brandingEvents += `Dialogue: 12,${formatTime(segLocalStart)},${formatTime(segLocalEnd)},FIC_Episode,,0,0,0,,{\\an5\\pos(${X_center},${Y_center})\\fad(300,300)}Follow for ${style.nextEpisode.trim()}\n`;
        }
      }
    }

    // Progress Bar: aligned horizontally with the timer to prevent overlapping Instagram UIs
    const X_progress = Math.round(width * (700 / 720));
    const Y_start = Math.round(height * (headingTopPct / 100));
    const maxHeight = Math.round(height * 0.5);
    const step = 0.2;
    
    for (let t = globalStart; t < globalEnd; t += step) {
      const t_start = t;
      const t_end = Math.min(globalEnd, t + step);
      const segLocalStart = t_start - globalStart;
      const segLocalEnd = t_end - globalStart;
      
      const t_mid = (t_start + t_end) / 2;
      const pctRemaining = Math.max(0, 1 - (t_mid / totalDuration));
      const currentHeight = Math.round(maxHeight * pctRemaining);
      
      if (currentHeight > 0) {
        brandingEvents += `Dialogue: 15,${formatTime(segLocalStart)},${formatTime(segLocalEnd)},FIC_Progress,,0,0,0,,{\\pos(${X_progress},${Y_start})\\p1}m 0 0 l 3 0 l 3 ${currentHeight} l 0 ${currentHeight}{\\p0}\n`;
      }
    }
  }

  const header = `[Script Info]
Title: Styled Subtitles
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${shadowColor},${isBold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,1,${outlineSize},${shadowDepth},${alignment},20,20,${marginV},1
${headingStyleLine}${timerStyleLine}${brandingStyleLine}
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
          const category = getWordCategory(w.word);
          if (category === 'highlight') {
            const empCol = toTagColor(hexToAssColor(highlightStyle.fontColor || '#FFFF00'));
            const scale = Math.round(100 * (highlightStyle.activeWordScale || 1.15));
            return `{\\fscx${scale}\\fscy${scale}\\c${empCol}}${rawWord}{\\fscx100\\fscy100\\c${toTagColor(primaryColor)}}`;
          } else if (category === 'emoji') {
            const empCol = toTagColor(hexToAssColor(emojiStyle.fontColor || '#FFFF00'));
            const scale = Math.round(100 * (emojiStyle.activeWordScale || 1.15));
            return `{\\fscx${scale}\\fscy${scale}\\c${empCol}}${rawWord}{\\fscx100\\fscy100\\c${toTagColor(primaryColor)}}`;
          }
          return rawWord;
        }).join(' ');
      }
    }
    const events = createDialogueLines(0, 0.0, duration, X_pos, Y_pos, text, hexToAssColor(normalStyle.fontColor || '#FFFFFF'));
    const processedEvents = normalStyle.neonGlow ? applyNeonGlowToEvents(events, normalStyle, primaryColor, outlineColor) : events;
    return header + headingEvents + timerEvents + brandingEvents + processedEvents;
  }

  const words = scene.words || [];
  if (words.length === 0) {
    const events = createDialogueLines(0, 0.0, duration, X_pos, Y_pos, scene.text, hexToAssColor(normalStyle.fontColor || '#FFFFFF'));
    const processedEvents = normalStyle.neonGlow ? applyNeonGlowToEvents(events, normalStyle, primaryColor, outlineColor) : events;
    return header + headingEvents + timerEvents + brandingEvents + processedEvents;
  }

  // Localize word timings relative to scene start
  const localWords = words.map(w => ({
    word: w.word,
    start: Math.max(0, w.start_time - scene.start_time),
    end: Math.min(duration, w.end_time - scene.start_time)
  }));

  const boxAssColor = hexToAssColor(style.boxColor || '#8A4BF3');
  const showBox = style.showHighlightBox !== false;
  const boxRounding = parseInt(style.boxRounding, 10) || 8;

  let events = '';

  // Estimate char width for box sizing
  let charWidthFactor = 0.52;
  if (fontName === 'Anton') charWidthFactor = 0.42;
  else if (fontName === 'Bangers') charWidthFactor = 0.48;
  else if (fontName === 'Impact') charWidthFactor = 0.52;
  else if (fontName === 'Kalam') charWidthFactor = 0.50;

  const padX = fontSize * 0.3;
  const boxHeight = fontSize * 1.3;

  const startLayer = showBox ? 1 : 0;

  if (mode === 'centered-word') {
    // Snappy centered single word mode (Hormozi / Snappy style)
    for (let i = 0; i < localWords.length; i++) {
      const w = localWords[i];
      const rx = X_pos;
      const ry = Y_pos;
      
      const category = getWordCategory(w.word);
      let wordStyle = highlightStyle; // Always highlight the active centered word!
      if (category === 'emoji') {
        wordStyle = emojiStyle;
      }

      // Snappy pop-in scale animation if zoom bump is enabled (> 1.0)
      const activeWordScale = wordStyle.activeWordScale || 1.0;
      let scaleTag = '';
      if (activeWordScale > 1.0) {
        const scaleStart = Math.round(90 * activeWordScale);
        const scaleEnd = Math.round(100 * activeWordScale);
        scaleTag = `\\fscx${scaleStart}\\fscy${scaleStart}\\t(0,60,\\fscx${scaleEnd}\\fscy${scaleEnd})`;
      } else {
        scaleTag = `\\fscx100\\fscy100`;
      }

      const wordText = w.word;

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
      
      const glowTagsOuter = getWordTags(wordStyle, true, 'glowOuter', outlineColor, outlineSize, fontSize, style, category);
      const glowTagsMedium = getWordTags(wordStyle, true, 'glowMedium', outlineColor, outlineSize, fontSize, style, category);
      const glowTagsInner = getWordTags(wordStyle, true, 'glowInner', outlineColor, outlineSize, fontSize, style, category);
      const coreTags = getWordTags(wordStyle, true, 'core', outlineColor, outlineSize, fontSize, style, category);

      const glowTextOuter = `{\\an5${glowTagsOuter}}${wordText}`;
      const glowTextMedium = `{\\an5${glowTagsMedium}}${wordText}`;
      const glowTextInner = `{\\an5${glowTagsInner}}${wordText}`;
      const coreText = `{\\an5${coreTags}}${wordText}`;

      const glowLayerOuter = startLayer;
      const glowLayerMedium = startLayer + 1;
      const glowLayerInner = startLayer + 2;
      const coreLayer = anyNeonGlow ? startLayer + 3 : startLayer;

      if (anyNeonGlow) {
        events += createDialogueLines(glowLayerOuter, w.start, w.end, rx, ry, glowTextOuter, "", scaleTag);
        events += createDialogueLines(glowLayerMedium, w.start, w.end, rx, ry, glowTextMedium, "", scaleTag);
        events += createDialogueLines(glowLayerInner, w.start, w.end, rx, ry, glowTextInner, "", scaleTag);
        events += createDialogueLines(coreLayer, w.start, w.end, rx, ry, coreText, "", scaleTag);
      } else {
        events += createDialogueLines(coreLayer, w.start, w.end, rx, ry, coreText, "", scaleTag);
      }
    }
  } else if (mode === 'smart-highlight') {
    // Smart TikTok/Instagram Reels style: centered text phrase, active word highlighted
    const maxWords = parseInt(style.maxWordsPerLine, 10) || 3;
    const chunks = [];
    let currentChunk = [];
    let currentLen = 0;
    
    for (let i = 0; i < localWords.length; i++) {
      const w = localWords[i];
      if (currentChunk.length >= maxWords || (currentChunk.length > 0 && currentLen + w.word.length > 20)) {
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
    
    const renderChunkTextForLayer = (chunk, activeIdx, layerType) => {
      return chunk.map((item, idx) => {
        let rawWord = item.word;
        if (rawWord) {
          rawWord = stripEmojis(rawWord);
        }
        const category = getWordCategory(item.word);
        const isActive = (idx === activeIdx);
        
        let wordStyle = isActive ? highlightStyle : normalStyle;
        if (category === 'emoji') {
          wordStyle = emojiStyle;
        } else if (category === 'highlight' && (isActive || style.autoEmphasis)) {
          wordStyle = highlightStyle;
        }

        const tags = getWordTags(wordStyle, isActive, layerType, outlineColor, outlineSize, fontSize, style, category);

        let scaleTag = '';
        if (isActive) {
          const activeWordScale = wordStyle.activeWordScale || 1.0;
          if (activeWordScale !== 1.0) {
            const scaleVal = Math.round(100 * activeWordScale);
            scaleTag = `\\fscx${scaleVal}\\fscy${scaleVal}`;
          }
        }

        const restoreTag = isActive && (wordStyle.activeWordScale || 1.0) !== 1.0 ? `{\\fscx100\\fscy100}` : '';
        return `{\\rDefault\\an5${tags}${scaleTag}}${rawWord}${restoreTag}`;
      }).join(' ');
    };

    // 1. Pre-speech segment
    if (totalStart > 0 && chunks.length > 0) {
      const glowTextOuter = renderChunkTextForLayer(chunks[0], -1, 'glowOuter');
      const glowTextMedium = renderChunkTextForLayer(chunks[0], -1, 'glowMedium');
      const glowTextInner = renderChunkTextForLayer(chunks[0], -1, 'glowInner');
      const coreText = renderChunkTextForLayer(chunks[0], -1, 'core');
      if (anyNeonGlow) {
        events += createDialogueLines(0, 0.0, totalStart, X_pos, Y_pos, glowTextOuter, "");
        events += createDialogueLines(1, 0.0, totalStart, X_pos, Y_pos, glowTextMedium, "");
        events += createDialogueLines(2, 0.0, totalStart, X_pos, Y_pos, glowTextInner, "");
        events += createDialogueLines(3, 0.0, totalStart, X_pos, Y_pos, coreText, "");
      } else {
        events += createDialogueLines(0, 0.0, totalStart, X_pos, Y_pos, coreText, "");
      }
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
        
        const glowTextOuter = renderChunkTextForLayer(chunk, wIdx, 'glowOuter');
        const glowTextMedium = renderChunkTextForLayer(chunk, wIdx, 'glowMedium');
        const glowTextInner = renderChunkTextForLayer(chunk, wIdx, 'glowInner');
        const coreText = renderChunkTextForLayer(chunk, wIdx, 'core');

        const transition = style.textTransition || 'none';
        const motion = style.textMotion || 'none';

        const chunkDuration = chunkEnd - chunkStart;
        const segmentDuration = end - start;

        const getYForTime = (t) => {
          if (motion !== 'float') return Y_pos;
          const progress = chunkDuration > 0 ? (t - chunkStart) / chunkDuration : 0;
          return Y_pos + 4 - progress * 8;
        };

        const writeChunkDialogueLines = (layer, text) => {
          let chunkEvents = '';
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
            chunkEvents += `Dialogue: ${layer},${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}}${text}\n`;
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

              chunkEvents += `Dialogue: ${layer},${formatTime(start)},${formatTime(mid1)},Default,,0,0,0,,{\\an5${inMove}${inAnim}${fadeTagIn}}${text}\n`;
              chunkEvents += `Dialogue: ${layer},${formatTime(mid1)},${formatTime(mid2)},Default,,0,0,0,,{\\an5${midMove}}${text}\n`;
              chunkEvents += `Dialogue: ${layer},${formatTime(mid2)},${formatTime(end)},Default,,0,0,0,,{\\an5${outMove}${outAnim}${fadeTagOut}}${text}\n`;
            } else if (isFirst) {
              const mid = start + animTime;
              const y1 = Math.round(getYForTime(mid));
              const y2 = Math.round(getYForTime(end));
              let midMove = `\\pos(${X_pos},${Y_pos})`;
              if (motion === 'float') {
                midMove = `\\move(${X_pos},${y1},${X_pos},${y2})`;
              }

              chunkEvents += `Dialogue: ${layer},${formatTime(start)},${formatTime(mid)},Default,,0,0,0,,{\\an5${inMove}${inAnim}${fadeTagIn}}${text}\n`;
              chunkEvents += `Dialogue: ${layer},${formatTime(mid)},${formatTime(end)},Default,,0,0,0,,{\\an5${midMove}}${text}\n`;
            } else if (isLast) {
              const mid = end - animTime;
              const y1 = Math.round(getYForTime(start));
              const y2 = Math.round(getYForTime(mid));
              let midMove = `\\pos(${X_pos},${Y_pos})`;
              if (motion === 'float') {
                midMove = `\\move(${X_pos},${y1},${X_pos},${y2})`;
              }

              chunkEvents += `Dialogue: ${layer},${formatTime(start)},${formatTime(mid)},Default,,0,0,0,,{\\an5${midMove}}${text}\n`;
              chunkEvents += `Dialogue: ${layer},${formatTime(mid)},${formatTime(end)},Default,,0,0,0,,{\\an5${outMove}${outAnim}${fadeTagOut}}${text}\n`;
            } else {
              const y1 = Math.round(getYForTime(start));
              const y2 = Math.round(getYForTime(end));
              let midMove = `\\pos(${X_pos},${Y_pos})`;
              if (motion === 'float') {
                midMove = `\\move(${X_pos},${y1},${X_pos},${y2})`;
              }
              chunkEvents += `Dialogue: ${layer},${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5${midMove}}${text}\n`;
            }
          }
          return chunkEvents;
        };

        if (anyNeonGlow) {
          events += writeChunkDialogueLines(0, glowTextOuter);
          events += writeChunkDialogueLines(1, glowTextMedium);
          events += writeChunkDialogueLines(2, glowTextInner);
          events += writeChunkDialogueLines(3, coreText);
        } else {
          events += writeChunkDialogueLines(0, coreText);
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
      
      const glowTextOuter = renderChunkTextForLayer(chunks[chunks.length - 1], -1, 'glowOuter');
      const glowTextMedium = renderChunkTextForLayer(chunks[chunks.length - 1], -1, 'glowMedium');
      const glowTextInner = renderChunkTextForLayer(chunks[chunks.length - 1], -1, 'glowInner');
      const coreText = renderChunkTextForLayer(chunks[chunks.length - 1], -1, 'core');
      
      if (anyNeonGlow) {
        events += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}}${glowTextOuter}\n`;
        events += `Dialogue: 1,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}}${glowTextMedium}\n`;
        events += `Dialogue: 2,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}}${glowTextInner}\n`;
        events += `Dialogue: 3,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}}${coreText}\n`;
      } else {
        events += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${fadeTag}}${coreText}\n`;
      }
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

      const category = getWordCategory(w.word);
      let wordStyle = normalStyle;
      if (category === 'emoji') {
        wordStyle = emojiStyle;
      } else if (category === 'highlight') {
        wordStyle = highlightStyle;
      }

      const activeWordScale = wordStyle.activeWordScale || 1.0;
      const wordAnim = `\\fscx${Math.round(10 * activeWordScale)}\\fscy${Math.round(10 * activeWordScale)}` +
        `\\t(0,${popInMs},\\fscx${Math.round(120 * activeWordScale)}\\fscy${Math.round(120 * activeWordScale)})` +
        `\\t(${popInMs},${settleMs},\\fscx${Math.round(100 * activeWordScale)}\\fscy${Math.round(100 * activeWordScale)})` +
        `\\t(${burstStart},${durMs},\\fscx${Math.round(300 * activeWordScale)}\\fscy${Math.round(300 * activeWordScale)}\\alpha&HFF&)`;

      if (showBox) {
        const wordW = wordText.length * charWidthFactor * fontSize;
        const boxW = wordW + padX * 2;
        const bAnim = `\\fscx10\\fscy10` +
          `\\t(0,${popInMs},\\fscx115\\fscy115)` +
          `\\t(${popInMs},${settleMs},\\fscx100\\fscy100)` +
          `\\t(${burstStart},${durMs},\\fscx300\\fscy300\\alpha&HFF&)`;
        events += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${bAnim}\\c${toTagColor(boxAssColor)}}{\\p1}${drawCenteredRoundedRect(boxW, boxHeight, boxRounding)}{\\p0}\n`;
      }

      const glowTagsOuter = getWordTags(wordStyle, true, 'glowOuter', outlineColor, outlineSize, fontSize, style, category);
      const glowTagsMedium = getWordTags(wordStyle, true, 'glowMedium', outlineColor, outlineSize, fontSize, style, category);
      const glowTagsInner = getWordTags(wordStyle, true, 'glowInner', outlineColor, outlineSize, fontSize, style, category);
      const coreTags = getWordTags(wordStyle, true, 'core', outlineColor, outlineSize, fontSize, style, category);

      const glowTextOuter = `{\\an5${glowTagsOuter}}${wordText}`;
      const glowTextMedium = `{\\an5${glowTagsMedium}}${wordText}`;
      const glowTextInner = `{\\an5${glowTagsInner}}${wordText}`;
      const coreText = `{\\an5${coreTags}}${wordText}`;

      const glowLayerOuter = startLayer;
      const glowLayerMedium = startLayer + 1;
      const glowLayerInner = startLayer + 2;
      const coreLayer = anyNeonGlow ? startLayer + 3 : startLayer;

      if (anyNeonGlow) {
        events += `Dialogue: ${glowLayerOuter},${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${wordAnim}}${glowTextOuter}\n`;
        events += `Dialogue: ${glowLayerMedium},${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${wordAnim}}${glowTextMedium}\n`;
        events += `Dialogue: ${glowLayerInner},${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${wordAnim}}${glowTextInner}\n`;
        events += `Dialogue: ${coreLayer},${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${wordAnim}}${coreText}\n`;
      } else {
        events += `Dialogue: ${coreLayer},${startStr},${endStr},Default,,0,0,0,,{\\an5${moveTag}${wordAnim}}${coreText}\n`;
      }
    }
  }

  const finalEvents = (mode === 'classic')
    ? (normalStyle.neonGlow ? applyNeonGlowToEvents(events, normalStyle, primaryColor, outlineColor) : events)
    : events;
  return header + headingEvents + timerEvents + brandingEvents + finalEvents;
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
    beatEffects = {},
    originalVideoPath,
    backgroundType = 'none',
    backgroundColor = '#000000',
    backgroundClipId = '',
    talkingHeadEnabled = false,
    talkingHeadChromaColor = '#00ff00',
    talkingHeadChromaSimilarity = 0.15,
    talkingHeadChromaBlend = 0.10,
    talkingHeadSize = 40,
    talkingHeadPosition = 'bottom-right',
    talkingHeadPositionX = 10,
    talkingHeadPositionY = 10,
    talkingHeadOutlineEnabled = false,
    talkingHeadOutlineColor = '#ffffff',
    talkingHeadOutlineThickness = 2
  } = options;

  console.log(`Starting video assembly with ${scenes.length} scenes...`);

  // Strip query parameters from voiceoverPath to get a clean basename/jobId
  const cleanPathForBasename = voiceoverPath.split('?')[0];
  const jobId = path.basename(cleanPathForBasename, path.extname(cleanPathForBasename));
  const tempDir = path.join(outputDir, 'temp', jobId);

  // Pre-download remote GCS assets if GCS is enabled
  let localVoiceoverPath = voiceoverPath;
  let localBgMusicPath = bgMusicPath;
  let localOriginalVideoPath = originalVideoPath;
  const localClipsPaths = new Map();
  let localBackgroundClipPath = null;
  const gcsAssetsTempDir = path.join('/tmp', 'vgen-gcs-assets-' + jobId);

  const clipsMap = new Map(clips.map(c => [c.id, c]));
  const backgroundClip = backgroundClipId ? clipsMap.get(backgroundClipId) : null;
  const backgroundPath = backgroundClip ? backgroundClip.path : null;
  const backgroundDuration = backgroundClip ? backgroundClip.duration : 10.0;

  // Helper to resolve paths relative to backend/
  const resolvePath = (filePath) => {
    if (!filePath) return filePath;
    if (path.isAbsolute(filePath) && existsSync(filePath)) {
      return filePath;
    }
    const resolvedDir = path.resolve(__dirname, filePath);
    if (existsSync(resolvedDir)) {
      return resolvedDir;
    }
    const resolvedRoot = path.resolve(__dirname, '..', filePath);
    if (existsSync(resolvedRoot)) {
      return resolvedRoot;
    }
    if (filePath.includes('uploads/')) {
      const relativePart = filePath.substring(filePath.indexOf('uploads/'));
      return path.join(__dirname, '..', relativePart);
    }
    return filePath;
  };

  try {
    await fs.mkdir(tempDir, { recursive: true });

    if (gcsService.isGcsEnabled()) {
      console.log(`[Video Engine] GCS mode is active. Pre-downloading remote assets for job ${jobId}...`);
      await fs.mkdir(gcsAssetsTempDir, { recursive: true });

      // 1. Download voiceover
      if (voiceoverPath && (voiceoverPath.startsWith('http') || voiceoverPath.startsWith('gs://'))) {
        const dest = path.join(gcsAssetsTempDir, 'voiceover' + path.extname(cleanPathForBasename));
        onProgress(8, 'Downloading voiceover audio from storage...');
        await gcsService.downloadFile(voiceoverPath, dest);
        localVoiceoverPath = dest;
      }

      // 2. Download background music
      if (bgMusicPath && (bgMusicPath.startsWith('http') || bgMusicPath.startsWith('gs://'))) {
        const cleanBgPath = bgMusicPath.split('?')[0];
        const dest = path.join(gcsAssetsTempDir, 'bgmusic' + path.extname(cleanBgPath));
        onProgress(10, 'Downloading background music from storage...');
        await gcsService.downloadFile(bgMusicPath, dest);
        localBgMusicPath = dest;
      }

      // 3. Download talking head original video
      if (originalVideoPath && (originalVideoPath.startsWith('http') || originalVideoPath.startsWith('gs://'))) {
        const cleanOriginalPath = originalVideoPath.split('?')[0];
        const dest = path.join(gcsAssetsTempDir, 'originalVideo' + path.extname(cleanOriginalPath));
        onProgress(12, 'Downloading talking head video from storage...');
        await gcsService.downloadFile(originalVideoPath, dest);
        localOriginalVideoPath = dest;
      }

      // 4. Download background clip if any
      if (backgroundClip && backgroundPath && (backgroundPath.startsWith('http') || backgroundPath.startsWith('gs://'))) {
        const cleanBgClipPath = backgroundPath.split('?')[0];
        const dest = path.join(gcsAssetsTempDir, 'bgclip_' + backgroundClipId + path.extname(cleanBgClipPath));
        onProgress(14, 'Downloading background clip from storage...');
        await gcsService.downloadFile(backgroundPath, dest);
        localBackgroundClipPath = dest;
      }

      // 5. Download referenced scene clips
      const uniqueClipIdsToDownload = new Set();
      for (const scene of scenes) {
        if (scene.clipId && scene.clipId !== 'original') {
          uniqueClipIdsToDownload.add(scene.clipId);
        }
      }

      let downloadIdx = 0;
      const totalClips = uniqueClipIdsToDownload.size;
      for (const clipId of uniqueClipIdsToDownload) {
        const clip = clipsMap.get(clipId);
        if (clip && clip.path) {
          downloadIdx++;
          if (clip.path.startsWith('http') || clip.path.startsWith('gs://')) {
            const cleanClipPath = clip.path.split('?')[0];
            const dest = path.join(gcsAssetsTempDir, 'clip_' + clipId + path.extname(cleanClipPath));
            onProgress(
              15 + Math.round((downloadIdx / totalClips) * 15),
              `Downloading B-roll clip ${downloadIdx}/${totalClips} from storage...`
            );
            await gcsService.downloadFile(clip.path, dest);
            localClipsPaths.set(clipId, dest);
          } else {
            localClipsPaths.set(clipId, resolvePath(clip.path));
          }
        }
      }
    } else {
      // Local fallbacks if GCS is disabled
      localVoiceoverPath = resolvePath(voiceoverPath);
      localBgMusicPath = bgMusicPath ? resolvePath(bgMusicPath) : null;
      localOriginalVideoPath = originalVideoPath ? resolvePath(originalVideoPath) : null;
      localBackgroundClipPath = backgroundPath ? resolvePath(backgroundPath) : null;
    }

    // --- Viral Beat Effects defaults ---
    const bfx = {
      whiteFlash: false, whiteFlashIntensity: 0.6,
      rgbSplit: false, rgbSplitPixels: 6,
      bassBounce: false, bassBounceScale: 1.06,
      speedRamp: false, speedRampHold: 0.1,
      speedRampPreset: 'hero',
      speedRampV0: 2.0,
      speedRampV1: 0.5,
      speedRampV2: 2.0,
      whipPan: false, whipPanStrength: 30,
      spinTransition: false, spinDegrees: 90,
      colorFlash: false, colorFlashTint: '#FF6B00',
      glitchTear: false, glitchTearPixels: 20,
      filmGrain: false, filmGrainAmount: 12,
      letterbox: false, letterboxSize: 50,
      vignettePulse: false,
      negativeFlash: false,
      gymGlow: false,
      gymGlowThreshold: 180,
      gymGlowRadius: 20,
      gymGlowOpacity: 0.6,
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
    if (subtitleStyle.brandingTheme === 'fitness-in-chunks') {
      try {
        await ensureFontExists('Montserrat');
      } catch (fontErr) {
        console.warn(`Could not verify/download Montserrat font for branding theme:`, fontErr.message);
      }
    }
    if (subtitleStyle.headingTitle && subtitleStyle.headingTitle.trim().length > 0) {
      const headingFont = subtitleStyle.headingFontName || 'Montserrat';
      try {
        await ensureFontExists(headingFont);
      } catch (fontErr) {
        console.warn(`Could not verify/download heading font ${headingFont}:`, fontErr.message);
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
      voiceoverDuration = await getVideoDuration(localVoiceoverPath);
      console.log(`Voiceover audio duration: ${voiceoverDuration}s`);
    } catch (err) {
      console.warn('Failed to calculate voiceover duration:', err.message);
    }

    // Dynamically scale scene timings if their total duration exceeds the actual voiceover duration
    if (adjustedScenes.length > 0 && voiceoverDuration > 0) {
      const maxSceneEndTime = Math.max(...adjustedScenes.map(s => s.end_time || s.start_time));
      if (maxSceneEndTime > voiceoverDuration + 0.05) {
        const scaleFactor = voiceoverDuration / maxSceneEndTime;
        console.log(`[Video Generator] Scenes end time (${maxSceneEndTime.toFixed(3)}s) exceeds voiceover duration (${voiceoverDuration.toFixed(3)}s). Scaling scenes by ${scaleFactor.toFixed(4)} to fit perfectly.`);
        for (const scene of adjustedScenes) {
          scene.start_time = Number((scene.start_time * scaleFactor).toFixed(3));
          scene.end_time = Number((scene.end_time * scaleFactor).toFixed(3));
          if (scene.words && Array.isArray(scene.words)) {
            for (const w of scene.words) {
              w.start_time = Number((w.start_time * scaleFactor).toFixed(3));
              w.end_time = Number((w.end_time * scaleFactor).toFixed(3));
            }
          }
        }
      }
    }

    // Adjust scene timings to completely cover intermediate gaps/silences.
    // This eliminates accumulated timing drift between video and audio tracks!
    if (adjustedScenes.length > 0) {
      adjustedScenes[0].start_time = 0.0; // Extend first scene to start of video

      // Filter out scenes that start beyond the actual audio track duration
      if (voiceoverDuration > 0) {
        // Keep scenes starting before voiceover ends (with a safety buffer)
        const validScenes = adjustedScenes.filter((s, idx) => idx === 0 || s.start_time < voiceoverDuration + 0.1);
        
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

      // Adjust word timings in-place to fit strictly within their respective adjusted scenes
      for (const scene of adjustedScenes) {
        const duration = scene.end_time - scene.start_time;
        if (scene.words && scene.words.length > 0) {
          const adjustedLocal = getLocalWordTimings(scene.words, scene.start_time, duration);
          for (let j = 0; j < scene.words.length; j++) {
            scene.words[j].start_time = Number((scene.start_time + adjustedLocal[j].start).toFixed(3));
            scene.words[j].end_time = Number((scene.start_time + adjustedLocal[j].end).toFixed(3));
          }
        }
        if (scene.words_hindi && scene.words_hindi.length > 0) {
          const adjustedLocalHindi = getLocalWordTimings(scene.words_hindi, scene.start_time, duration);
          for (let j = 0; j < scene.words_hindi.length; j++) {
            scene.words_hindi[j].start_time = Number((scene.start_time + adjustedLocalHindi[j].start).toFixed(3));
            scene.words_hindi[j].end_time = Number((scene.start_time + adjustedLocalHindi[j].end).toFixed(3));
          }
        }
        if (scene.words_hinglish && scene.words_hinglish.length > 0) {
          const adjustedLocalHinglish = getLocalWordTimings(scene.words_hinglish, scene.start_time, duration);
          for (let j = 0; j < scene.words_hinglish.length; j++) {
            scene.words_hinglish[j].start_time = Number((scene.start_time + adjustedLocalHinglish[j].start).toFixed(3));
            scene.words_hinglish[j].end_time = Number((scene.start_time + adjustedLocalHinglish[j].end).toFixed(3));
          }
        }
      }
    }

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
      } else {
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
      } else {
        targetWidth = 1080;
        targetHeight = 1080;
      }
    } else {
      if (resLabel === '2k') {
        targetWidth = 1440;
        targetHeight = 2560;
      } else if (resLabel === '4k') {
        targetWidth = 2160;
        targetHeight = 3840;
      } else {
        targetWidth = 1080;
        targetHeight = 1920;
      }
    }

    const processedSceneClips = [];

    // Resolve talking head dimensions once
    let talkingHeadWidth = 1080;
    let talkingHeadHeight = 1920;
    const hasTalkingHeadGlobal = talkingHeadEnabled && localOriginalVideoPath && existsSync(localOriginalVideoPath);
    if (hasTalkingHeadGlobal) {
      try {
        const dims = await getVideoDimensions(localOriginalVideoPath);
        talkingHeadWidth = dims.width;
        talkingHeadHeight = dims.height;
        console.log(`Original talking head dimensions: ${talkingHeadWidth}x${talkingHeadHeight}`);
      } catch (err) {
        console.warn('Failed to get talking head video dimensions:', err.message);
      }
    }

    // Step 1: Format and burn subtitles on each clip separately
    for (let i = 0; i < adjustedScenes.length; i++) {
      const scene = adjustedScenes[i];
      
      // Check if the scene has B-roll assigned
      const hasBroll = scene.clipId && scene.clipId !== 'original';
      
      let clipPath = null;
      let clipStartOffset = 0;
      let clipDuration = 0;
      
      if (hasBroll) {
        const clip = clipsMap.get(scene.clipId);
        if (!clip) {
          throw new Error(`Clip ID ${scene.clipId} used in scene ${i} not found in clip library`);
        }
        clipPath = gcsService.isGcsEnabled() ? localClipsPaths.get(scene.clipId) : clip.path;
        clipStartOffset = scene.clipStart || 0;
        clipDuration = clip.duration;
      } else if (!talkingHeadEnabled) {
        // Fallback to backward compatibility: if talking head is disabled, show original video full screen
        if (localOriginalVideoPath) {
          clipPath = localOriginalVideoPath;
          clipStartOffset = scene.start_time;
          clipDuration = voiceoverDuration || 999999;
        }
      }

    const sceneDuration = scene.end_time - scene.start_time;
    const tempSceneClipPath = path.join(tempDir, `scene_${i}.mp4`);
    const tempAssPath = path.join(tempDir, `sub_${i}.ass`);

    onProgress(Math.round((i / adjustedScenes.length) * 75), `Formatting & subtitle burning for scene ${i + 1}/${adjustedScenes.length}...`);

    // Write temporary ASS file
    const totalVideoDuration = voiceoverDuration || Math.max(...adjustedScenes.map(s => s.end_time || s.start_time));
    const assContent = createAssFileContent(scene, sceneDuration, subtitleStyle, targetWidth, targetHeight, totalVideoDuration);
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
    } else if (bfx.speedRamp) {
      isSpeedRamped = true;
      v0 = bfx.speedRampV0 !== undefined ? Number(bfx.speedRampV0) : 2.0;
      v1 = bfx.speedRampV1 !== undefined ? Number(bfx.speedRampV1) : 0.5;
      v2 = bfx.speedRampV2 !== undefined ? Number(bfx.speedRampV2) : 2.0;
    }

    if (isSpeedRamped) {
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

    let applyMinterpolate = false;
    let brollFilterString = '';
    if (clipPath) {
      let brollFilter = `setpts=PTS-STARTPTS,trim=duration=${sourceDuration}`;
      const remainingClipDur = clipDuration - clipStartOffset;
      const missingDur = sourceDuration - remainingClipDur;
      if (missingDur > 0) {
        const padFrames = Math.ceil(missingDur * targetFps);
        brollFilter += `,tpad=stop_mode=clone:stop=${padFrames}`;
      }

      // Append speed ramping setpts filter if enabled
      if (isSpeedRamped) {
        const setptsExpr = `(if(lt(T, ${s1}), (-${v0} + sqrt(max(0, ${v0}*${v0} + 8*${a1}*T))) / (4*${a1}), if(lt(T, ${s2}), 0.25*${effectiveSceneDuration} + (T - ${s1}) / ${v1}, 0.75*${effectiveSceneDuration} + (-${v1} + sqrt(max(0, ${v1}*${v1} + 8*${a2}*(T - ${s2})))) / (4*${a2}))))/TB`;
        brollFilter += `,setpts='${setptsExpr}'`;

        const hasSlowMotion = v0 < 1.0 || v1 < 1.0 || v2 < 1.0;
        if (hasSlowMotion) {
          applyMinterpolate = true;
        }
      }

      if (fillMode === 'crop') {
        const scaleAndCrop = `scale=w='if(gte(iw/ih,${targetWidth}/${targetHeight}),-2,${targetWidth})':h='if(gte(iw/ih,${targetWidth}/${targetHeight}),${targetHeight},-2)',crop=${targetWidth}:${targetHeight}:2*trunc((iw-ow)/4):2*trunc((ih-oh)/4)`;
        brollFilter += `,${scaleAndCrop}`;
      } else {
        const scaleAndPad = `scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`;
        brollFilter += `,${scaleAndPad}`;
      }

      // Apply optical flow slow motion interpolation after scaling to reduce resolution workload (highly optimized)
      if (applyMinterpolate) {
        brollFilter += `,minterpolate=fps=${targetFps}:mi_mode=mci:me_mode=bidir:me=ds:scd=none`;
      }

      // Ping-pong (Beat Bounce)
      if (scene.pingPong) {
        brollFilter += `[std];[std]split=2[fwd][rev_in];[rev_in]reverse,setpts=N/(${targetFps}*TB)[rev];[fwd][rev]concat=n=2:v=1:a=0`;
      }

      // Apply Ken Burns zoom animation
      if (zoomAnimation) {
        brollFilter += `,scale=w='2*trunc(((1+0.06*t/${sceneDuration})*${targetWidth})/2)':h='2*trunc(((1+0.06*t/${sceneDuration})*${targetHeight})/2)':eval=frame,crop=${targetWidth}:${targetHeight}:2*trunc((iw-ow)/4):2*trunc((ih-oh)/4)`;
      }
      
      brollFilterString = brollFilter;
    }

    // Resolve active transitions for this scene (governed by boundary definitions)
    const getTransition = (type, idx) => {
      if (!type || type === 'none') return 'none';
      if (type === 'random') {
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
        return transitionsList[idx % transitionsList.length];
      }
      return type;
    };

    const incomingTransition = (i > 0) ? getTransition(adjustedScenes[i - 1].transition || clipTransition, i - 1) : 'none';
    const incomingTdTrans = (i > 0) ? (Number(adjustedScenes[i - 1].transitionDuration) || Number(transitionDuration) || 0.3) : 0.3;

    const outgoingTransition = (i < adjustedScenes.length - 1) ? getTransition(adjustedScenes[i].transition || clipTransition, i) : 'none';
    const outgoingTdTrans = (i < adjustedScenes.length - 1) ? (Number(adjustedScenes[i].transitionDuration) || Number(transitionDuration) || 0.3) : 0.3;

    let sceneEffectsFilter = '';

    // 1. Fade Transitions
    const incomingFadeDur = (incomingTransition === 'fade' || incomingTransition.endsWith('-fade')) ? Math.min(incomingTdTrans, sceneDuration / 2) : 0;
    const outgoingFadeDur = (outgoingTransition === 'fade' || outgoingTransition.endsWith('-fade')) ? Math.min(outgoingTdTrans, sceneDuration / 2) : 0;

    if (incomingFadeDur > 0) {
      sceneEffectsFilter += `,fade=t=in:st=0:d=${incomingFadeDur.toFixed(3)}`;
    }
    if (outgoingFadeDur > 0) {
      sceneEffectsFilter += `,fade=t=out:st=${(sceneDuration - outgoingFadeDur).toFixed(3)}:d=${outgoingFadeDur.toFixed(3)}`;
    }

    // 2. Motion Transitions (Slide/Pan)
    const incomingIsSlidePan = incomingTransition.includes('slide') || incomingTransition.includes('pan');
    const outgoingIsSlidePan = outgoingTransition.includes('slide') || outgoingTransition.includes('pan');

    if ((incomingIsSlidePan || outgoingIsSlidePan) && sceneDuration > (incomingTdTrans + outgoingTdTrans)) {
      const isPan = incomingTransition.includes('pan') || outgoingTransition.includes('pan');
      const amp = isPan ? 0.2 : 1.0;
      let xExpr = String(targetWidth);
      let yExpr = String(targetHeight);

      let xIn = '0';
      if (incomingIsSlidePan) {
        const inAmp = incomingTransition.includes('pan') ? 0.2 : 1.0;
        if (incomingTransition.includes('left')) {
          xIn = `-${inAmp} * pow(1 - (t/${incomingTdTrans}), 3)`;
        } else if (incomingTransition.includes('right')) {
          xIn = `${inAmp} * pow(1 - (t/${incomingTdTrans}), 3)`;
        }
      }

      let xOut = '0';
      if (outgoingIsSlidePan) {
        const outAmp = outgoingTransition.includes('pan') ? 0.2 : 1.0;
        if (outgoingTransition.includes('left')) {
          xOut = `${outAmp} * pow((t - (${sceneDuration} - ${outgoingTdTrans}))/${outgoingTdTrans}, 3)`;
        } else if (outgoingTransition.includes('right')) {
          xOut = `-${outAmp} * pow((t - (${sceneDuration} - ${outgoingTdTrans}))/${outgoingTdTrans}, 3)`;
        }
      }

      let yIn = '0';
      if (incomingIsSlidePan) {
        const inAmp = incomingTransition.includes('pan') ? 0.2 : 1.0;
        if (incomingTransition.includes('up')) {
          yIn = `-${inAmp} * pow(1 - (t/${incomingTdTrans}), 3)`;
        } else if (incomingTransition.includes('down')) {
          yIn = `${inAmp} * pow(1 - (t/${incomingTdTrans}), 3)`;
        }
      }

      let yOut = '0';
      if (outgoingIsSlidePan) {
        const outAmp = outgoingTransition.includes('pan') ? 0.2 : 1.0;
        if (outgoingTransition.includes('up')) {
          yOut = `${outAmp} * pow((t - (${sceneDuration} - ${outgoingTdTrans}))/${outgoingTdTrans}, 3)`;
        } else if (outgoingTransition.includes('down')) {
          yOut = `-${outAmp} * pow((t - (${sceneDuration} - ${outgoingTdTrans}))/${outgoingTdTrans}, 3)`;
        }
      }

      xExpr = `${targetWidth} * (1 + if(lt(t, ${incomingTdTrans}), ${xIn}, if(gt(t, ${sceneDuration} - ${outgoingTdTrans}), ${xOut}, 0)))`;
      yExpr = `${targetHeight} * (1 + if(lt(t, ${incomingTdTrans}), ${yIn}, if(gt(t, ${sceneDuration} - ${outgoingTdTrans}), ${yOut}, 0)))`;

      sceneEffectsFilter += `,pad=w=3*${targetWidth}:h=3*${targetHeight}:x=${targetWidth}:y=${targetHeight}:color=black`;
      sceneEffectsFilter += `,crop=w=${targetWidth}:h=${targetHeight}:x='${xExpr}':y='${yExpr}'`;
    }

    // 3. Zoom Transitions
    const incomingIsZoom = incomingTransition.includes('zoom');
    const outgoingIsZoom = outgoingTransition.includes('zoom');

    if ((incomingIsZoom || outgoingIsZoom) && sceneDuration > (incomingTdTrans + outgoingTdTrans)) {
      let sIn = '1.0';
      if (incomingIsZoom) {
        const inFactor = incomingTransition.includes('zoom-in') ? 0.3 : -0.3;
        sIn = `1.0 + ${inFactor} * pow(1 - (t/${incomingTdTrans}), 3)`;
      }

      let sOut = '1.0';
      if (outgoingIsZoom) {
        const outFactor = outgoingTransition.includes('zoom-in') ? 0.3 : -0.3;
        sOut = `1.0 + ${outFactor} * pow((t - (${sceneDuration} - ${outgoingTdTrans}))/${outgoingTdTrans}, 3)`;
      }

      const sExpr = `if(lt(t, ${incomingTdTrans}), ${sIn}, if(gt(t, ${sceneDuration} - ${outgoingTdTrans}), ${sOut}, 1.0))`;

      sceneEffectsFilter += `,scale=w='2*trunc(((${sExpr})*${targetWidth})/2)':h='2*trunc(((${sExpr})*${targetHeight})/2)':eval=frame`;
      sceneEffectsFilter += `,pad=w=3*${targetWidth}:h=3*${targetHeight}:x='2*trunc((3*${targetWidth}-iw)/4)':y='2*trunc((3*${targetHeight}-ih)/4)':color=black:eval=frame`;
      sceneEffectsFilter += `,crop=w=${targetWidth}:h=${targetHeight}:x=${targetWidth}:y=${targetHeight}`;
    }

    // 4. Blur Transitions
    const incomingIsBlur = incomingTransition.includes('blur');
    const outgoingIsBlur = outgoingTransition.includes('blur');

    if (incomingIsBlur && sceneDuration > (incomingTdTrans + outgoingTdTrans)) {
      const bs1 = (incomingTdTrans / 3).toFixed(3);
      const bs2 = (2 * incomingTdTrans / 3).toFixed(3);
      const bs3 = incomingTdTrans.toFixed(3);
      sceneEffectsFilter += `,boxblur=lr=16:lp=1:enable='lt(t,${bs1})'`;
      sceneEffectsFilter += `,boxblur=lr=8:lp=1:enable='between(t,${bs1},${bs2})'`;
      sceneEffectsFilter += `,boxblur=lr=3:lp=1:enable='between(t,${bs2},${bs3})'`;
    }
    if (outgoingIsBlur && sceneDuration > (incomingTdTrans + outgoingTdTrans)) {
      const t1 = (sceneDuration - outgoingTdTrans).toFixed(3);
      const t2 = (sceneDuration - 2 * outgoingTdTrans / 3).toFixed(3);
      const t3 = (sceneDuration - outgoingTdTrans / 3).toFixed(3);
      sceneEffectsFilter += `,boxblur=lr=3:lp=1:enable='between(t,${t1},${t2})'`;
      sceneEffectsFilter += `,boxblur=lr=8:lp=1:enable='between(t,${t2},${t3})'`;
      sceneEffectsFilter += `,boxblur=lr=16:lp=1:enable='gt(t,${t3})'`;
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
        sceneEffectsFilter += `,eq=brightness='0-0.45*(${blinkEnable})':eval=frame`;
      }
      if (miniBeatEffect === 'shake' || miniBeatEffect === 'both') {
        const shakeEnable = activeMiniBeats.map(tm => `between(t,${tm},${(tm + 0.12).toFixed(3)})`).join('+');
        sceneEffectsFilter += `,scale=w='2*trunc((1.06*${targetWidth})/2)':h='2*trunc((1.06*${targetHeight})/2)'`;
        const xShake = `'2*trunc(((iw-ow)/2+15*sin(2*PI*t*25)*(${shakeEnable}))/2)'`;
        const yShake = `'2*trunc(((ih-oh)/2+15*cos(2*PI*t*30)*(${shakeEnable}))/2)'`;
        sceneEffectsFilter += `,crop=${targetWidth}:${targetHeight}:x=${xShake}:y=${yShake}`;
      }
    }

    // ======== VIRAL BEAT EFFECTS ========
    
    // Speed Ramp - handled smoothly at B-roll/input stage
    
    // Bass Bounce — scale pulse on beat entry
    if (bfx.bassBounce && sceneDuration > 0.2) {
      const bScale = Number(bfx.bassBounceScale) || 1.06;
      const bounceExpr = `if(lt(t,0.15),1.0+(${bScale}-1.0)*pow(1-t/0.15,2),1.0)`;
      sceneEffectsFilter += `,scale=w='trunc((${bounceExpr})*${targetWidth}/2)*2':h='trunc((${bounceExpr})*${targetHeight}/2)*2':eval=frame`;
      sceneEffectsFilter += `,crop=${targetWidth}:${targetHeight}:2*trunc((iw-${targetWidth})/4):2*trunc((ih-${targetHeight})/4)`;
    }
    
    // Spin Transition — quick rotation
    if (bfx.spinTransition && sceneDuration > 0.3) {
      const deg = Number(bfx.spinDegrees) || 90;
      const rad = (deg * Math.PI / 180).toFixed(4);
      sceneEffectsFilter += `,rotate=a='if(lt(t,0.25),${rad}*pow(1-t/0.25,3),0)':ow=${targetWidth}:oh=${targetHeight}:c=black`;
    }
    
    // White Flash
    if (bfx.whiteFlash && sceneDuration > 0.1) {
      const intensity = Number(bfx.whiteFlashIntensity) || 0.6;
      sceneEffectsFilter += `,eq=brightness='${intensity}*if(lt(t,0.08),pow(1-t/0.08,2),0)':eval=frame`;
    }
    
    // RGB Split / Chromatic Aberration
    if (bfx.rgbSplit && sceneDuration > 0.12) {
      const px = Math.round(Number(bfx.rgbSplitPixels) || 6);
      sceneEffectsFilter += `,rgbashift=rh=${-px}:bh=${px}:edge=smear:enable='lt(t,0.033)'`;
      sceneEffectsFilter += `,rgbashift=rh=${-Math.round(px*0.66)}:bh=${Math.round(px*0.66)}:edge=smear:enable='between(t,0.033,0.066)'`;
      sceneEffectsFilter += `,rgbashift=rh=${-Math.round(px*0.33)}:bh=${Math.round(px*0.33)}:edge=smear:enable='between(t,0.066,0.1)'`;
    }
    
    // Color Flash / Tint Pulse
    if (bfx.colorFlash && sceneDuration > 0.12) {
      const hex = bfx.colorFlashTint || '#FF6B00';
      const r = parseInt(hex.slice(1,3), 16) / 255;
      const g = parseInt(hex.slice(3,5), 16) / 255;
      const b = parseInt(hex.slice(5,7), 16) / 255;
      const rShift = ((r - 0.5) * 0.8).toFixed(3);
      const gShift = ((g - 0.5) * 0.8).toFixed(3);
      const bShift = ((b - 0.5) * 0.8).toFixed(3);
      sceneEffectsFilter += `,colorbalance=rh=${rShift}:gh=${gShift}:bh=${bShift}:enable='lt(t,0.12)'`;
    }
    
    // Negative / Invert Flash
    if (bfx.negativeFlash && sceneDuration > 0.08) {
      sceneEffectsFilter += `,negate=enable='lt(t,0.06)'`;
    }
    
    // Whip Pan
    if (bfx.whipPan && sceneDuration > 0.2) {
      const str = Math.round(Number(bfx.whipPanStrength) || 30);
      sceneEffectsFilter += `,boxblur=lr=${str}:lp=1:enable='lt(t,0.08)'`;
      sceneEffectsFilter += `,boxblur=lr=${Math.round(str*0.5)}:lp=1:enable='between(t,0.08,0.14)'`;
      const e1 = (sceneDuration - 0.14).toFixed(3);
      const e2 = (sceneDuration - 0.08).toFixed(3);
      sceneEffectsFilter += `,boxblur=lr=${Math.round(str*0.5)}:lp=1:enable='between(t,${e1},${e2})'`;
      sceneEffectsFilter += `,boxblur=lr=${str}:lp=1:enable='gt(t,${e2})'`;
    }
    
    // Glitch Tear
    if (bfx.glitchTear && sceneDuration > 0.1) {
      const gpx = 2 * Math.round((Number(bfx.glitchTearPixels) || 20) / 2);
      sceneEffectsFilter += `,pad=w=${targetWidth + gpx * 2}:h=${targetHeight}:x=${gpx}:y=0:color=black`;
      sceneEffectsFilter += `,crop=${targetWidth}:${targetHeight}:x='${gpx}-${gpx}*if(lt(t,0.04),1,0)+${gpx}*if(between(t,0.04,0.08),1,0)':y=0`;
    }
    
    // Film Grain
    if (bfx.filmGrain) {
      const amt = Math.round(Number(bfx.filmGrainAmount) || 12);
      sceneEffectsFilter += `,noise=alls=${amt}:allf=t`;
    }
    
    // Vignette Pulse
    if (bfx.vignettePulse) {
      const vigExpr = sceneDuration > 0.2
        ? `PI/4+0.4*if(lt(t,0.15),pow(1-t/0.15,2),0)`
        : 'PI/4';
      sceneEffectsFilter += `,vignette=a='${vigExpr}':eval=frame`;
    }
    
    // Letterbox
    if (bfx.letterbox) {
      const barH = Math.round(Number(bfx.letterboxSize) || 50);
      sceneEffectsFilter += `,drawbox=x=0:y=0:w=${targetWidth}:h=${barH}:color=black:t=fill`;
      sceneEffectsFilter += `,drawbox=x=0:y=${targetHeight - barH}:w=${targetWidth}:h=${barH}:color=black:t=fill`;
    }

    // Add subtitles filter using absolute fontsdir path to ensure custom fonts are loaded correctly
    sceneEffectsFilter += `,subtitles=sub_${i}.ass:fontsdir='${fontsDir}'`;

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
          const cleanEmoji = rawEmoji;
          if (cleanEmoji) {
            try {
              const emojiPngPath = await ensureEmojiPngExists(cleanEmoji);
              if (emojiPngPath) {
                const start = Math.max(0, w.start_time - scene.start_time).toFixed(3);
                
                let activeChunk = null;
                let activeWordIdxInChunk = -1;

                if (mode === 'smart-highlight') {
                  const maxWords = parseInt(subtitleStyle.maxWordsPerLine, 10) || 3;
                  const localWords = scene.words.map(item => ({
                    word: item.word,
                    start: Math.max(0, item.start_time - scene.start_time),
                    end: Math.min(sceneDuration, item.end_time - scene.start_time)
                  }));
                  
                  const chunks = [];
                  let currentChunk = [];
                  let currentLen = 0;
                  for (let idx = 0; idx < localWords.length; idx++) {
                    const item = localWords[idx];
                    if (currentChunk.length >= maxWords || (currentChunk.length > 0 && currentLen + item.word.length > 20)) {
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
                    for (let idx = 0; idx < activeWordIdxInChunk; idx++) {
                      wordLeft += wordWidths[idx] + spaceWidth;
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

    // Build the dynamic input files list for this scene
    const inputs = [];
    let brollInputIdx = -1;
    let talkingHeadInputIdx = -1;
    let bgInputIdx = -1;

    // B-Roll Layer Input
    if (clipPath) {
      brollInputIdx = inputs.length;
      inputs.push({
        args: ['-ss', String(clipStartOffset), '-i', clipPath]
      });
    }

    // Talking Head Layer Input
    const hasTalkingHead = talkingHeadEnabled && localOriginalVideoPath && existsSync(localOriginalVideoPath);
    if (hasTalkingHead) {
      talkingHeadInputIdx = inputs.length;
      inputs.push({
        args: ['-ss', String(scene.start_time), '-i', localOriginalVideoPath]
      });
    }

    // Background Layer Input
    const resolvedBackgroundPath = gcsService.isGcsEnabled() ? localBackgroundClipPath : (backgroundPath ? resolvePath(backgroundPath) : null);
    if (backgroundType === 'image' && resolvedBackgroundPath && existsSync(resolvedBackgroundPath)) {
      bgInputIdx = inputs.length;
      inputs.push({
        args: ['-loop', '1', '-t', String(sceneDuration), '-i', resolvedBackgroundPath]
      });
    } else if (backgroundType === 'video' && resolvedBackgroundPath && existsSync(resolvedBackgroundPath)) {
      bgInputIdx = inputs.length;
      const bgStartOffset = scene.start_time % backgroundDuration;
      inputs.push({
        args: ['-ss', String(bgStartOffset), '-i', resolvedBackgroundPath]
      });
    }

    // Build filter complex
    let filterComplex = '';

    // 1. Render Background
    if (bgInputIdx !== -1) {
      filterComplex += `[${bgInputIdx}:v]scale=w='if(gte(iw/ih,${targetWidth}/${targetHeight}),-2,${targetWidth})':h='if(gte(iw/ih,${targetWidth}/${targetHeight}),${targetHeight},-2)',crop=${targetWidth}:${targetHeight}:2*trunc((iw-ow)/4):2*trunc((ih-oh)/4)[bg_scaled_${i}]`;
    } else {
      const bgHexColor = backgroundColor.replace('#', '0x');
      filterComplex += `color=c=${bgHexColor}:s=${targetWidth}x${targetHeight}:d=${sceneDuration}[bg_scaled_${i}]`;
    }

    // 2. Render B-roll layer and overlay on background
    if (brollInputIdx !== -1) {
      filterComplex += `;[${brollInputIdx}:v]${brollFilterString}[broll_processed_${i}]`;
      filterComplex += `;[bg_scaled_${i}][broll_processed_${i}]overlay=0:0[composed_v_${i}]`;
    } else {
      filterComplex += `;[bg_scaled_${i}]split=1[composed_v_${i}]`;
    }

    // 3. Render scene transitions/effects and burn subtitles
    const cleanEffects = sceneEffectsFilter.startsWith(',') ? sceneEffectsFilter.substring(1) : 'null';
    filterComplex += `;[composed_v_${i}]${cleanEffects}[base_v_effects_${i}]`;

    // 4. Render color emojis
    let emojiStream = `base_v_effects_${i}`;
    if (emojisToDraw.length > 0) {
      for (let j = 0; j < emojisToDraw.length; j++) {
        const em = emojisToDraw[j];
        const nextStream = `v_em_${i}_${j}`;
        filterComplex += `;movie='${em.path}',scale=${em.size}:-1[e_${i}_${j}];[${emojiStream}][e_${i}_${j}]overlay=x='${em.x}-w/2':y='${em.y}-h':enable='between(t,${em.start},${em.end})'[${nextStream}]`;
        emojiStream = nextStream;
      }
    }

    // 5. Render talking head on top of everything
    let finalComposedLabel = emojiStream;
    if (hasTalkingHead) {
      const chromaColor = talkingHeadChromaColor.replace('#', '0x');
      const outlineHex = talkingHeadOutlineColor || '#ffffff';
      const rVal = parseInt(outlineHex.slice(1, 3), 16);
      const gVal = parseInt(outlineHex.slice(3, 5), 16);
      const bVal = parseInt(outlineHex.slice(5, 7), 16);
      
      const td = 0.4;
      const sd = sceneDuration;
      const hasPrevBroll = (i > 0) && (adjustedScenes[i - 1].clipId !== 'original' && !!adjustedScenes[i - 1].clipId);
      const hasNextBroll = (i < adjustedScenes.length - 1) && (adjustedScenes[i + 1].clipId !== 'original' && !!adjustedScenes[i + 1].clipId);
      const isOverlayFullFrame = !hasBroll;

      let sizeExpr = '';
      let fExpr = '';
      if (isOverlayFullFrame && talkingHeadSize < 100) {
        if (hasPrevBroll && hasNextBroll) {
          fExpr = `if(lt(t, ${td}), (t/${td})*(t/${td})*(3 - 2*(t/${td})), if(gt(t, ${sd} - ${td}), ((${sd}-t)/${td})*((${sd}-t)/${td})*(3 - 2*((${sd}-t)/${td})), 1))`;
        } else if (hasPrevBroll) {
          fExpr = `if(lt(t, ${td}), (t/${td})*(t/${td})*(3 - 2*(t/${td})), 1)`;
        } else if (hasNextBroll) {
          fExpr = `if(gt(t, ${sd} - ${td}), ((${sd}-t)/${td})*((${sd}-t)/${td})*(3 - 2*((${sd}-t)/${td})), 1)`;
        } else {
          fExpr = '1';
        }
        sizeExpr = `(${talkingHeadSize} + (100 - ${talkingHeadSize}) * ${fExpr})`;
      } else if (isOverlayFullFrame) {
        sizeExpr = '100';
        fExpr = '1';
      } else {
        sizeExpr = String(talkingHeadSize);
        fExpr = '0';
      }

      const wScaleExpr = `2*trunc((${targetWidth} * ${sizeExpr}) / 200)`;
      const hScaleExpr = `2*trunc((${targetWidth} * ${sizeExpr} * ${talkingHeadHeight}) / (200 * ${talkingHeadWidth}))`;

      let X_small = 'W-w-20';
      let Y_small = 'H-h-20';
      switch (talkingHeadPosition) {
        case 'center':
          X_small = '(W-w)/2';
          Y_small = '(H-h)/2';
          break;
        case 'top-left':
          X_small = '20';
          Y_small = '20';
          break;
        case 'top-right':
          X_small = 'W-w-20';
          Y_small = '20';
          break;
        case 'bottom-left':
          X_small = '20';
          Y_small = 'H-h-20';
          break;
        case 'bottom-right':
          X_small = 'W-w-20';
          Y_small = 'H-h-20';
          break;
        case 'custom':
          X_small = `(W-w)*${talkingHeadPositionX}/100`;
          Y_small = `(H-h)*${talkingHeadPositionY}/100`;
          break;
      }

      const X_large = '(W-w)/2';
      const Y_large = '(H-h)/2';
      const overlayXExpr = `(${X_small}) + ((${X_large}) - (${X_small})) * ${fExpr}`;
      const overlayYExpr = `(${Y_small}) + ((${Y_large}) - (${Y_small})) * ${fExpr}`;

      // 1. First, apply chroma keying and format to RGBA on the talking head stream (running at fixed/original input resolution)
      filterComplex += `;[${talkingHeadInputIdx}:v]fps=fps=${targetFps},chromakey=color=${chromaColor}:similarity=${talkingHeadChromaSimilarity}:blend=${talkingHeadChromaBlend},format=rgba[th_keyed_${i}]`;
      
      let thOutlineLabel = `[th_keyed_${i}]`;
      if (talkingHeadOutlineEnabled && talkingHeadOutlineThickness > 0) {
        const dilations = ',dilation'.repeat(talkingHeadOutlineThickness);
        const outlineColorFF = talkingHeadOutlineColor.replace('#', '0x');
        // Apply outline chain on the fixed-resolution stream
        filterComplex += `;[th_keyed_${i}]split=3[th_sc1_${i}][th_sc2_${i}][th_sc3_${i}]`;
        filterComplex += `;[th_sc1_${i}]alphaextract${dilations}[th_alpha_${i}]`;
        filterComplex += `;[th_sc2_${i}]drawbox=x=0:y=0:w=iw:h=ih:color=${outlineColorFF}:t=fill[th_solid_${i}]`;
        filterComplex += `;[th_solid_${i}][th_alpha_${i}]alphamerge[th_outline_${i}]`;
        filterComplex += `;[th_outline_${i}][th_sc3_${i}]overlay=0:0[th_outlined_${i}]`;
        thOutlineLabel = `[th_outlined_${i}]`;
      }

      // 2. Apply the dynamic scale filter AFTER the outline is merged, so scaling is the final step before overlaying
      filterComplex += `;${thOutlineLabel}scale=w='${wScaleExpr}':h='${hScaleExpr}':eval=frame[th_final_${i}]`;
      const talkingHeadOverlayInput = `[th_final_${i}]`;

      // 3. Overlay the dynamically scaled, outlined talking head onto the main background canvas
      filterComplex += `;[${emojiStream}]format=rgba[emoji_rgba_${i}]`;
      filterComplex += `;[emoji_rgba_${i}]${talkingHeadOverlayInput}overlay=x='${overlayXExpr}':y='${overlayYExpr}':eval=frame,format=yuv420p[scene_final_${i}]`;
      finalComposedLabel = `scene_final_${i}`;
    }

    // ======== 💪 GYM GLOW (LUMA BLOOM) EFFECT ========
    let gymGlowEnabled = false;
    let threshold = 180;
    let radius = 20;
    let opacity = 0.6;

    if (scene.gymGlow && scene.gymGlow.enabled) {
      gymGlowEnabled = true;
      threshold = Number(scene.gymGlow.threshold) || 180;
      radius = Number(scene.gymGlow.radius) || 20;
      opacity = Number(scene.gymGlow.opacity) || 0.6;
    } else if (bfx.gymGlow) {
      gymGlowEnabled = true;
      threshold = Number(bfx.gymGlowThreshold) || 180;
      radius = Number(bfx.gymGlowRadius) || 20;
      opacity = Number(bfx.gymGlowOpacity) || 0.6;
    }

    if (gymGlowEnabled) {
      const inputLabel = finalComposedLabel;
      const blurredLabel = `v_glow_blur_${i}`;
      const outputLabel = `v_glow_out_${i}`;
      
      // Extract highlights and blur, then screen blend back
      filterComplex += `;[${inputLabel}]split=2[glow_orig_${i}][glow_src_${i}]`;
      filterComplex += `;[glow_src_${i}]lutyuv=y='if(gt(val,${threshold}),(val-${threshold})*255/(255-${threshold}),0)':u=128:v=128,boxblur=lr=${radius}:lp=2[${blurredLabel}]`;
      filterComplex += `;[glow_orig_${i}][${blurredLabel}]blend=c0_mode=screen:c0_opacity=${opacity}[${outputLabel}]`;
      
      finalComposedLabel = outputLabel;
    }

    // Standardize fps
    filterComplex += `;[${finalComposedLabel}]fps=fps=${targetFps}`;

    const args = [];
    
    // Push dynamic input files
    for (const input of inputs) {
      args.push(...input.args);
    }

    // Output settings
    args.push(
      '-t', String(sceneDuration), // Limit the output of this scene to its target duration
      '-filter_complex', filterComplex,
      '-c:v', 'libx264',
      '-profile:v', 'main',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',
      '-r', String(targetFps), // Standardize framerate
      '-video_track_timescale', '90000', // Force identical timescale for concat demuxer compatibility
      '-an', // Strip original audio
      '-y',
      `scene_${i}.mp4`
    );

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

  onProgress(85, 'Mixing voiceover, music, SFXs and rendering final video...');

  // Resolve active SFX assets for scene boundaries
  const activeSfxs = [];
  for (let i = 0; i < adjustedScenes.length - 1; i++) {
    const scene = adjustedScenes[i];
    if (scene.sfx && scene.sfx !== 'none') {
      const cleanSfx = scene.sfx.endsWith('.mp3') ? scene.sfx : `${scene.sfx}.mp3`;
      let sfxPath = path.join(outputDir, 'sfx', cleanSfx);
      if (!existsSync(sfxPath)) {
        sfxPath = path.join(__dirname, '..', 'uploads', 'sfx', cleanSfx);
      }
      
      if (existsSync(sfxPath)) {
        // Play SFX 150ms before the cut so the whoosh peak aligns with the cut
        const playTime = Math.max(0, scene.end_time - 0.15);
        activeSfxs.push({
          path: sfxPath,
          playTime
        });
      }
    }
  }

  // Word-level SFXs!
  for (let i = 0; i < adjustedScenes.length; i++) {
    const scene = adjustedScenes[i];
    if (scene.words && scene.words.length > 0) {
      for (const word of scene.words) {
        if (word.sfx && word.sfx !== 'none') {
          const cleanSfx = word.sfx.endsWith('.mp3') ? word.sfx : `${word.sfx}.mp3`;
          let sfxPath = path.join(outputDir, 'sfx', cleanSfx);
          if (!existsSync(sfxPath)) {
            sfxPath = path.join(__dirname, '..', 'uploads', 'sfx', cleanSfx);
          }
          if (existsSync(sfxPath)) {
            activeSfxs.push({
              path: sfxPath,
              playTime: word.start_time
            });
          }
        }
      }
    }
  }

    // Step 3: Mix Audio and compile final render
    const finalOutputPath = path.join(outputDir, `render_${jobId}.mp4`);
    
    let currentInputIndex = 0;
    const renderArgs = [];
    
    renderArgs.push('-i', concatVideoOnlyPath); // input 0
    currentInputIndex++;
    
    renderArgs.push('-i', localVoiceoverPath);  // input 1
    currentInputIndex++;

    let bgIndex = -1;
    if (localBgMusicPath && existsSync(localBgMusicPath)) {
      const bgOffset = Number(bgMusicStartOffset) || 0;
      if (bgOffset > 0) {
        renderArgs.push('-ss', String(bgOffset));
      }
      renderArgs.push('-i', localBgMusicPath);  // input 2
      bgIndex = currentInputIndex;
      currentInputIndex++;
    }

    const sfxStartInputIndex = currentInputIndex;
    for (let idx = 0; idx < activeSfxs.length; idx++) {
      renderArgs.push('-i', activeSfxs[idx].path);
      currentInputIndex++;
    }

    const voVol = Number(voiceoverVolume) || 1.0;
    
    // Construct filter complex if we have BGM or SFX inputs
    if (bgIndex !== -1 || activeSfxs.length > 0) {
      let filterComplex = `[1:a]volume=${voVol}[vo]`;
      const amixInputs = ['[vo]'];

      if (bgIndex !== -1) {
        filterComplex += `;[${bgIndex}:a]volume=${bgMusicVolume}[bg]`;
        amixInputs.push('[bg]');
      }

      for (let idx = 0; idx < activeSfxs.length; idx++) {
        const delayMs = Math.round(activeSfxs[idx].playTime * 1000);
        filterComplex += `;[${sfxStartInputIndex + idx}:a]volume=0.20,adelay=${delayMs}|${delayMs}[sfx_${idx}]`;
        amixInputs.push(`[sfx_${idx}]`);
      }

      filterComplex += `;${amixInputs.join('')}amix=inputs=${amixInputs.length}:duration=first:normalize=0[a]`;
      renderArgs.push('-filter_complex', filterComplex);
      renderArgs.push('-map', '0:v', '-map', '[a]');
    } else {
      // Just map the voiceover directly (with optional volume adjustment)
      if (voVol !== 1.0) {
        renderArgs.push('-filter_complex', `[1:a]volume=${voVol}[a]`);
        renderArgs.push('-map', '0:v', '-map', '[a]');
      } else {
        renderArgs.push('-map', '0:v', '-map', '1:a');
      }
    }

    let actualVideoDuration = 0;
    try {
      actualVideoDuration = await getVideoDuration(concatVideoOnlyPath);
      console.log(`[Video Engine] Concatenated video duration: ${actualVideoDuration}s`);
    } catch (err) {
      console.warn('Failed to calculate concatenated video duration:', err.message);
    }

    renderArgs.push(
      '-c:v', 'copy', // Copy video (zero encoding overhead, instant)
      '-video_track_timescale', '90000', // Standardize final output timescale
      '-c:a', 'aac'  // Encode mixed audio
    );

    if (actualVideoDuration > 0) {
      renderArgs.push('-t', String(actualVideoDuration));
    }

    renderArgs.push(
      '-y',
      finalOutputPath
    );

    await runFFmpeg(renderArgs, { cwd: tempDir });

    onProgress(98, 'Uploading final video to Google Cloud Storage...');
    let resultVideoPath = finalOutputPath;
    if (gcsService.isGcsEnabled()) {
      resultVideoPath = await gcsService.uploadFile(finalOutputPath, `generated/render_${jobId}.mp4`);
      // Delete the local compiled file from the disk to free up space
      try {
        if (existsSync(finalOutputPath)) {
          await fs.unlink(finalOutputPath);
        }
      } catch (_) {}
    }

    onProgress(100, 'Video generation successfully complete!');
    return resultVideoPath;
  } finally {
    // Clean up temporary GCS downloaded assets and local compilation files
    if (gcsService.isGcsEnabled()) {
      console.log(`[Video Engine] Cleaning up temporary local GCS assets for job ${jobId}...`);
      try {
        if (existsSync(gcsAssetsTempDir)) {
          const files = await fs.readdir(gcsAssetsTempDir);
          for (const file of files) {
            await fs.unlink(path.join(gcsAssetsTempDir, file));
          }
          await fs.rmdir(gcsAssetsTempDir);
          console.log(`[Video Engine] Cleaned up GCS asset temp directory: ${gcsAssetsTempDir}`);
        }
      } catch (err) {
        console.warn(`[Video Engine Warning] Failed to clean up GCS asset temp dir:`, err.message);
      }
    }

    try {
      if (existsSync(tempDir)) {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file));
        }
        await fs.rmdir(tempDir);
        console.log(`[Video Engine] Cleaned up FFmpeg temp directory: ${tempDir}`);
      }
    } catch (err) {
      console.warn(`[Video Engine Warning] Failed to clean up FFmpeg temp dir:`, err.message);
    }
  }
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

