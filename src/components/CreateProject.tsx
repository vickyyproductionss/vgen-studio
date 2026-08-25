import { useState, useEffect, useRef } from 'react';
import { SubtitleStyleEditor } from './SubtitleStyleEditor';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Upload, Zap, Play, Pause, Video, Layers, Sparkle, Trash, Scissors, GitMerge, RotateCcw, Music } from 'lucide-react';
import RichClipSelector from './RichClipSelector';
import { Player } from '@remotion/player';
import { VideoReel } from '../remotion/VideoReel';
import { PlayerErrorBoundary } from './PlayerErrorBoundary';

interface Voice {
  id: string;
  name: string;
  category: string;
  previewUrl: string;
  description: string;
}

interface Clip {
  id: string;
  name: string;
  description: string;
  duration: number;
  thumbnail: string;
  exists?: boolean;
  tags?: string[];
}

interface WordTiming {
  word: string;
  start_time: number;
  end_time: number;
  sfx?: string;
}

interface Scene {
  text: string;
  text_hindi?: string;
  text_hinglish?: string;
  start_time: number;
  end_time: number;
  clipId?: string;
  clipStart?: number;
  reason?: string;
  visual_description?: string;
  words?: WordTiming[];
  words_hindi?: WordTiming[];
  words_hinglish?: WordTiming[];
  transition?: string;
  transitionDuration?: number;
  sfx?: string;
  speedRamp?: {
    enabled: boolean;
    v0: number;
    v1: number;
    v2: number;
    preset: string;
  };
  gymGlow?: {
    enabled: boolean;
    threshold: number;
    radius: number;
    opacity: number;
  };
  shake?: boolean;
  shakeIntensity?: number;
  shakeSpeed?: number;
}

interface WordStyle {
  fontColor: string;
  activeWordScale: number;
  neonGlow: boolean;
  glowColor: string;
  glowBlur: number;
  glowDistance: number;
}

const emojiMap: Record<string, string> = {
  // Fitness
  'gym': '🏋️‍♂️', 'workout': '🏋️‍♂️', 'fitness': '💪', 'strong': '💪', 'training': '🏋️‍♂️', 'athlete': '🏃‍♂️', 'exercise': '🏋️‍♂️',
  'run': '🏃‍♂️', 'walk': '🏃‍♂️', 'jump': '🦘', 'swim': '🏊‍♂️', 'climb': '🧗‍♂️', 'wrestling': '🤼‍♂️', 'martial': '🥋', 'karate': '🥋', 'judo': '🥋', 'gymnastics': '🤸‍♂️', 'boxing': '🥊', 'punch': '🥊', 'fight': '🥊',
  // Money
  'money': '💰', 'rich': '💰', 'million': '💵', 'billion': '💵', 'cash': '💵', 'dollar': '💵', 'wealth': '💰', 'broke': '💸', 'poor': '💸', 'bank': '🏦', 'card': '💳', 'credit': '💳', 'pay': '💵', 'buy': '🛒', 'sell': '📈', 'price': '🏷️', 'cost': '🏷️', 'bill': '💵', 'tax': '💸', 'gold': '🪙', 'coin': '🪙', 'diamond': '💎', 'gem': '💎', 'ring': '💍',
  // Power
  'fire': '🔥', 'hot': '🔥', 'burn': '🔥', 'flame': '🔥',
  'danger': '⚠️', 'warn': '⚠️', 'warning': '⚠️', 'alert': '⚠️', 'stop': '🛑', 'go': '🟢', 'power': '⚡', 'energy': '⚡', 'speed': '⚡', 'fast': '⚡', 'lightning': '⚡', 'thunder': '⛈️', 'storm': '⛈️', 'bomb': '💣', 'explode': '💥', 'explosion': '💥', 'destroy': '💥', 'crash': '💥',
  // Mind
  'mind': '🧠', 'brain': '🧠', 'think': '🧠', 'smart': '🧠', 'idea': '💡', 'thought': '🤔', 'secret': '🤫', 'quiet': '🤫', 'genius': '🧠', 'truth': '🗣️', 'speak': '🗣️', 'talk': '🗣️', 'listen': '👂', 'hear': '👂',
  // Goals
  'time': '⏱️', 'clock': '⏰', 'watch': '⌚', 'target': '🎯', 'goal': '🎯', 'success': '🏆', 'win': '🏆', 'winner': '🏆', 'victory': '🏆', 'trophy': '🏆', 'medal': '🏅', 'first': '🥇', 'crown': '👑', 'king': '👑', 'queen': '👑',
  // Emotions
  'love': '❤️', 'heart': '❤️', 'broken': '💔', 'hate': '💔', 'scream': '😱', 'scared': '😱', 'shock': '😱', 'fear': '😨', 'ghost': '👻', 'monster': '👹', 'alien': '👽', 'happy': '😊', 'smile': '😊', 'excited': '🤩', 'wow': '😮', 'shocked': '😲', 'surprised': '😲', 'confused': '😕', 'laugh': '😂', 'funny': '😂', 'joke': '😂', 'cry': '😭', 'sad': '😭', 'crap': '💩', 'shit': '💩',
  // Tech
  'phone': '📱', 'mobile': '📱', 'computer': '💻', 'laptop': '💻', 'code': '💻', 'software': '💻', 'program': '💻', 'gift': '🎁', 'party': '🎉', 'celebrate': '🎉', 'key': '🔑', 'lock': '🔒', 'unlock': '🔓', 'door': '🚪', 'bed': '🛏️', 'tv': '📺', 'camera': '📷', 'photo': '📷', 'video': '🎥', 'movie': '🎬', 'film': '🎬', 'music': '🎵', 'song': '🎶', 'sing': '🎤', 'dance': '💃', 'book': '📖', 'read': '📖', 'write': '✍️',
  // Travel
  'car': '🏎️', 'bus': '🚌', 'truck': '🚚', 'bike': '🚲', 'travel': '✈️', 'trip': '✈️', 'plane': '✈️', 'train': '🚆', 'rocket': '🚀', 'fly': '🚀',
  // Nature
  'earth': '🌍', 'world': '🌎', 'nature': '🌿', 'sun': '☀️', 'moon': '🌙', 'star': '⭐', 'sky': '🌌', 'cloud': '☁️', 'rain': '🌧️', 'snow': '❄️', 'wind': '💨', 'ice': '❄️', 'water': '💧', 'ocean': '🌊', 'sea': '🌊', 'mountain': '⛰️', 'forest': '🌲', 'flower': '🌸', 'rose': '🌹', 'tree': '🌳',
  // Animals
  'dog': '🐶', 'cat': '🐱', 'bird': '🐦', 'fish': '🐟', 'shark': '🦈', 'lion': '🦁', 'tiger': '🐯', 'bear': '🐻', 'wolf': '🐺', 'fox': '🦊',
  // Food
  'food': '🍔', 'pizza': '🍕', 'burger': '🍔', 'fries': '🍟', 'coffee': '☕', 'drink': '🍹'
};

function getWordEmoji(word: string) {
  if (!word) return '';
  const clean = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  return emojiMap[clean] || '';
}

interface VideoPreviewProps {
  clipId: string;
  thumbnail: string;
  clipStart: number;
  isActive: boolean;
  videoUrl?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ clipId, thumbnail, clipStart, isActive, videoUrl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = clipStart;
    }
  }, [clipStart, isActive]);

  if (!isActive) {
    return (
      <img
        src={thumbnail}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl || `/api/clips/${clipId}/video`}
      preload="auto"
      muted
      playsInline
      poster={thumbnail}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onLoadedMetadata={() => {
        if (videoRef.current) {
          videoRef.current.currentTime = clipStart;
        }
      }}
    />
  );
};

interface CreateProjectProps {
  projectId: string | null;
  onStartRender: (jobId: string) => void;
}

async function parseFetchError(res: Response, defaultMsg: string): Promise<Error> {
  let errMsg = '';
  try {
    const text = await res.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data && data.error) {
          errMsg = data.error;
        } else {
          errMsg = text.length > 200 ? text.substring(0, 200) + '...' : text;
        }
      } catch {
        errMsg = text.length > 200 ? text.substring(0, 200) + '...' : text;
      }
    }
  } catch {}

  if (!errMsg) {
    errMsg = `${defaultMsg} (HTTP ${res.status} ${res.statusText || 'Error'})`;
  }
  return new Error(errMsg);
}

const CURATED_FONTS = [
  'Arial', 'Anton', 'Bangers', 'Kalam', 'Kalam Light', 'Kalam Bold', 'Inter',
  'Poppins', 'Roboto', 'Montserrat', 'Oswald', 'Playfair Display', 'Lora',
  'Lilita One', 'Fredoka', 'Pacifico', 'Caveat', 'Rubik', 'Bebas Neue',
  'Righteous', 'Lobster', 'Cinzel', 'Titan One', 'Shadows Into Light',
  'Satisfy', 'Comfortaa', 'Bree Serif', 'Exo 2', 'Creepster', 'Impact',
  'Courier New', 'Times New Roman', 'Orbitron',
  'Rajdhani', 'Teko', 'Yatra One', 'Rozha One', 'Mukta', 'Martel',
  'Advercase', 'Strong', 'Deco', 'Bowlby', 'Tracklist', 'Sweetheart', 'Athiti Bold'
];

/*
const CAPTION_PRESETS = [
  {
    id: 'tiktok',
    name: 'TikTok Pop',
    icon: '🔥',
    style: {
      fontName: 'Impact',
      textCase: 'upper',
      activeWordScale: 1.25,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: true,
      showHighlightBox: false,
      neonGlow: false,
      textTransition: 'none',
      showEmojis: true,
      autoEmphasis: false,
      pop3d: false,
      fontColor: '#FFFF00',
      highlightColor: '#FFFFFF',
      outlineColor: '#000000',
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#FFFF00', activeWordScale: 1.25, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#FFFF00', activeWordScale: 1.25, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    icon: '💡',
    style: {
      fontName: 'Bebas Neue',
      textCase: 'upper',
      activeWordScale: 1.2,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: true,
      showHighlightBox: false,
      neonGlow: true,
      glowColor: '#FF00FF',
      glowBlur: 10,
      glowDistance: 4,
      textTransition: 'none',
      showEmojis: true,
      autoEmphasis: false,
      pop3d: false,
      fontColor: '#FFFFFF',
      highlightColor: '#FF00FF',
      outlineColor: '#000000',
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#FF00FF', glowBlur: 10, glowDistance: 4 },
      highlightStyle: { fontColor: '#FFFFFF', activeWordScale: 1.2, neonGlow: true, glowColor: '#FF00FF', glowBlur: 10, glowDistance: 4 },
      emojiStyle: { fontColor: '#FFFFFF', activeWordScale: 1.2, neonGlow: true, glowColor: '#FF00FF', glowBlur: 10, glowDistance: 4 }
    }
  },
  {
    id: 'karaoke',
    name: 'Karaoke Style',
    icon: '🎤',
    style: {
      fontName: 'Inter',
      textCase: 'default',
      activeWordScale: 1.1,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: true,
      showHighlightBox: false,
      neonGlow: false,
      textTransition: 'none',
      showEmojis: true,
      autoEmphasis: false,
      pop3d: false,
      fontColor: '#A0AEC0',
      highlightColor: '#3182CE',
      outlineColor: '#000000',
      normalStyle: { fontColor: '#A0AEC0', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#3182CE', activeWordScale: 1.1, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#3182CE', activeWordScale: 1.1, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  },
  {
    id: 'glitch',
    name: 'RGB Glitch',
    icon: '👾',
    style: {
      fontName: 'Bangers',
      textCase: 'upper',
      activeWordScale: 1.2,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: true,
      showHighlightBox: false,
      neonGlow: false,
      textTransition: 'none',
      showEmojis: true,
      autoEmphasis: false,
      pop3d: true,
      pop3dColor: '#FF00FF',
      fontColor: '#FFFFFF',
      highlightColor: '#00FFFF',
      outlineColor: '#000000',
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  }
];
*/

export default function CreateProject({ projectId, onStartRender }: CreateProjectProps) {
  const [projectType, setProjectType] = useState<'create' | 'talkinghead' | 'subtitles'>('create');
  const [originalVideoPath, setOriginalVideoPath] = useState('');
  const [originalVideoUrl, setOriginalVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'subtitles' | 'video' | 'audio' | 'layers'>('subtitles');
  
  // Background layer state variables
  const [backgroundType, setBackgroundType] = useState<'none' | 'image' | 'video'>('none');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [backgroundClipId, setBackgroundClipId] = useState('');

  // Talking Head state variables
  const [talkingHeadEnabled, setTalkingHeadEnabled] = useState(false);
  const [talkingHeadChromaColor, setTalkingHeadChromaColor] = useState('#00ff00');
  const [talkingHeadChromaSimilarity, setTalkingHeadChromaSimilarity] = useState(0.15);
  const [talkingHeadChromaBlend, setTalkingHeadChromaBlend] = useState(0.10);
  const [talkingHeadSize, setTalkingHeadSize] = useState(40);
  const [talkingHeadPosition, setTalkingHeadPosition] = useState<'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom'>('bottom-right');
  const [talkingHeadPositionX, setTalkingHeadPositionX] = useState(10);
  const [talkingHeadPositionY, setTalkingHeadPositionY] = useState(10);
  const [talkingHeadOutlineEnabled, setTalkingHeadOutlineEnabled] = useState(false);
  const [talkingHeadOutlineColor, setTalkingHeadOutlineColor] = useState('#ffffff');
  const [talkingHeadOutlineThickness, setTalkingHeadOutlineThickness] = useState(2);
  const [elevenLabsKeySet, setElevenLabsKeySet] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [audioSource, setAudioSource] = useState<'generate' | 'upload'>('generate');
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [voiceoverPath, setVoiceoverPath] = useState('');
  const [voiceoverUrl, setVoiceoverUrl] = useState('');
  const [aligning, setAligning] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeLang, setActiveLang] = useState<'hinglish' | 'hindi'>('hinglish');
  const [hoveredSceneIdx, setHoveredSceneIdx] = useState<number | null>(null);
  const [activeSliderIdx, setActiveSliderIdx] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [fillMode, setFillMode] = useState<'crop' | 'fit'>('crop');
  const [bgMusicPath, setBgMusicPath] = useState('');
  const [bgMusicVolume, setBgMusicVolume] = useState(0.07);
  const [muteBgMusic, setMuteBgMusic] = useState(false);
  const [bgMusicStartOffset, setBgMusicStartOffset] = useState(0);
  const [voiceoverVolume, setVoiceoverVolume] = useState(1.0);
  const [muteVoiceover, setMuteVoiceover] = useState(false);
  const [videoVolume, setVideoVolume] = useState(0.0);
  const [muteVideoAudio, setMuteVideoAudio] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(1.0);
  const [muteSfx, setMuteSfx] = useState(false);
  const [clipTransition, setClipTransition] = useState<string>('none');
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const [zoomAnimation, setZoomAnimation] = useState(true);
  const [exportResolution, setExportResolution] = useState<'1080p' | '2k' | '4k'>('1080p');
  const [exportFps, setExportFps] = useState<24 | 30 | 60>(30);
  const [bgms, setBgms] = useState<any[]>([]);
  const [bgmSource, setBgmSource] = useState<'library' | 'custom'>('library');
  const [subtitleMode, setSubtitleMode] = useState<'classic' | 'pop' | 'smart-highlight' | 'centered-word' | 'simple'>('classic');
  const [selectedWord, setSelectedWord] = useState<{ sceneIdx: number; wordIdx: number } | null>(null);

  const updateWordStyle = (sceneIdx: number, wordIdx: number, style: { color?: string; size?: number; bold?: boolean; italic?: boolean }) => {
    const updated = [...scenes];
    if (updated[sceneIdx] && updated[sceneIdx].words && updated[sceneIdx].words![wordIdx]) {
      updated[sceneIdx].words![wordIdx] = {
        ...updated[sceneIdx].words![wordIdx],
        ...style
      };
      
      // Update Hindi/Hinglish arrays as well to keep them in sync
      if (activeLang === 'hindi') {
        updated[sceneIdx].words_hindi = updated[sceneIdx].words;
      } else {
        updated[sceneIdx].words_hinglish = updated[sceneIdx].words;
      }
      
      setScenes(updated);
    }
  };
  // const [activeAccordion, setActiveAccordion] = useState<'layout' | 'typography' | 'words' | 'branding'>('layout');
  const [fontName, setFontName] = useState('Bangers');
  const [fontSelectorOpen, setFontSelectorOpen] = useState(false);
  // const [fontSearchQuery, setFontSearchQuery] = useState('');
  // const [fontLoading, setFontLoading] = useState(false);
  const [useAiFallback, setUseAiFallback] = useState(false);
  // AI generation modal states
  const [showAiGenModal, setShowAiGenModal] = useState(false);
  const [aiGenSceneIdx, setAiGenSceneIdx] = useState<number | null>(null);
  const [aiGenPrompt, setAiGenPrompt] = useState('');
  const [aiGenType, setAiGenType] = useState<'image' | 'video'>('video');
  const [aiGenDuration, setAiGenDuration] = useState(5);
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenError, setAiGenError] = useState('');
  // const [fontDownloadError, setFontDownloadError] = useState('');
  const [fontSize, setFontSize] = useState(48);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [outlineThickness, setOutlineThickness] = useState(1.5);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [shadow, setShadow] = useState(true);
  const [highlightColor, setHighlightColor] = useState('#FACC15');
  const [showHighlightBox, setShowHighlightBox] = useState(false);
  const [boxColor, setBoxColor] = useState('#8A4BF3');
  const [boxRounding, setBoxRounding] = useState(8);
  const [textBackgroundStyle, setTextBackgroundStyle] = useState<'none' | 'rounded-box' | 'outline-badge' | 'semi-transparent'>('none');
  const [textAnimation, setTextAnimation] = useState<'none' | 'typewriter' | 'bounce' | 'flicker' | 'slide' | 'wave' | 'glitch'>('none');
  const [previewText, setPreviewText] = useState('Creative');
  const [boxPadding, setBoxPadding] = useState('6px 12px');
  const [outlineSize, setOutlineSize] = useState(3);
  const [textFade, setTextFade] = useState(true);
  const [textMotion, setTextMotion] = useState<string>('none');
  const [textTransition, setTextTransition] = useState<string>('none');
  const [activeWordScale, setActiveWordScale] = useState(1.15);
  const [wordDisplayTime, setWordDisplayTime] = useState(1.0);
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(3);
  const [textPositionX, setTextPositionX] = useState(0);
  const [textPositionY, setTextPositionY] = useState(-65);
  const [showEmojis, setShowEmojis] = useState(false);
  const [autoEmphasis, setAutoEmphasis] = useState(false);
  const [emphasisColor, setEmphasisColor] = useState('#FFFFFF');
  const [neonGlow, setNeonGlow] = useState(true);
  const [glowColor, setGlowColor] = useState('#FFFFFF');
  const [glowBlur, setGlowBlur] = useState(1);
  const [glowDistance, setGlowDistance] = useState(20);
  const [showBulkTransitions, setShowBulkTransitions] = useState(false);
  const [bulkTransition, setBulkTransition] = useState('none');
  const [bulkSfx, setBulkSfx] = useState('none');

  // Split scene modal states
  const [splitModalSceneIdx, setSplitModalSceneIdx] = useState<number | null>(null);
  const [splitPointSeconds, setSplitPointSeconds] = useState<number>(1.5);

  const openSplitModal = (idx: number) => {
    const scene = scenes[idx];
    if (!scene) return;
    const dur = Number((scene.end_time - scene.start_time || 2.0).toFixed(2));
    setSplitPointSeconds(Number((dur / 2).toFixed(2)));
    setSplitModalSceneIdx(idx);
  };

  const confirmSplitSceneInProject = (idx: number, splitDurationSeconds: number) => {
    const scene = scenes[idx];
    if (!scene) return;

    const totalDuration = scene.end_time - scene.start_time;
    const firstDuration = Number(Math.max(0.1, Math.min(splitDurationSeconds, totalDuration - 0.1)).toFixed(2));
    const secondDuration = Number((totalDuration - firstDuration).toFixed(2));

    const midTime = Number((scene.start_time + firstDuration).toFixed(2));

    // Split subtitle text proportionally by words
    const words = (scene.text || '').trim().split(/\s+/);
    let text1 = scene.text || '';
    let text2 = '';

    if (words.length > 1) {
      const splitWordIdx = Math.round((firstDuration / totalDuration) * words.length);
      text1 = words.slice(0, Math.max(1, splitWordIdx)).join(' ');
      text2 = words.slice(Math.max(1, splitWordIdx)).join(' ');
    }

    const scene1 = {
      ...scene,
      end_time: midTime,
      text: text1
    };

    const scene2 = {
      ...scene,
      start_time: midTime,
      text: text2,
      clipStart: (scene.clipStart || 0) + firstDuration
    };

    const updated = [...scenes];
    updated.splice(idx, 1, scene1, scene2);
    setScenes(updated);
    setSplitModalSceneIdx(null);
    setSuccess(`Scene #${idx + 1} split into ${firstDuration}s and ${secondDuration}s scenes.`);
  };

  const [highlightTrigger, setHighlightTrigger] = useState<'all' | 'emphasis' | 'emoji' | 'none'>('all');
  const [textCase, setTextCase] = useState<'default' | 'upper' | 'first-word-larger'>('default');
  const [pop3d, setPop3d] = useState(false);
  const [pop3dColor, setPop3dColor] = useState('#000000');
  const [pop3dDepth, setPop3dDepth] = useState(6);
  const [letterSpacing, setLetterSpacing] = useState(3);
  const [wordSpacing, setWordSpacing] = useState(5);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(4);
  const [shadowDistance, setShadowDistance] = useState(2);
  const [shadowAngle, setShadowAngle] = useState(45);
  const [shadowOpacity, setShadowOpacity] = useState(0.6);
  // Heading / Hook state variables
/*
  const applyCaptionPreset = (preset: typeof CAPTION_PRESETS[0]) => {
    const s = preset.style;
    if (s.fontName !== undefined) setFontName(s.fontName);
    if (s.textCase !== undefined) setTextCase(s.textCase as any);
    if (s.activeWordScale !== undefined) setActiveWordScale(s.activeWordScale);
    if (s.highlightTrigger !== undefined) setHighlightTrigger(s.highlightTrigger as any);
    if (s.bold !== undefined) setBold(s.bold);
    if (s.italic !== undefined) setItalic(s.italic);
    if (s.shadow !== undefined) setShadow(s.shadow);
    if (s.showHighlightBox !== undefined) setShowHighlightBox(s.showHighlightBox);
    if (s.neonGlow !== undefined) setNeonGlow(s.neonGlow);
    if (s.textTransition !== undefined) setTextTransition(s.textTransition);
    if (s.showEmojis !== undefined) setShowEmojis(s.showEmojis);
    if (s.autoEmphasis !== undefined) setAutoEmphasis(s.autoEmphasis);
    if (s.pop3d !== undefined) setPop3d(s.pop3d);
    if (s.pop3dColor !== undefined) setPop3dColor(s.pop3dColor);
    if (s.fontColor !== undefined) setFontColor(s.fontColor);
    if (s.highlightColor !== undefined) setHighlightColor(s.highlightColor);
    if (s.outlineColor !== undefined) setOutlineColor(s.outlineColor);
    if (s.normalStyle !== undefined) setNormalStyle(s.normalStyle);
    if (s.highlightStyle !== undefined) setHighlightStyle(s.highlightStyle);
    if (s.emojiStyle !== undefined) setEmojiStyle(s.emojiStyle);
    const sAny = s as any;
    setLetterSpacing(sAny.letterSpacing !== undefined ? sAny.letterSpacing : 0);
    setWordSpacing(sAny.wordSpacing !== undefined ? sAny.wordSpacing : 0);
    setShadowColor(sAny.shadowColor !== undefined ? sAny.shadowColor : '#000000');
    setShadowBlur(sAny.shadowBlur !== undefined ? sAny.shadowBlur : 4);
    setShadowDistance(sAny.shadowDistance !== undefined ? sAny.shadowDistance : 2);
    setShadowAngle(sAny.shadowAngle !== undefined ? sAny.shadowAngle : 45);
    setShadowOpacity(sAny.shadowOpacity !== undefined ? sAny.shadowOpacity : 0.6);
    setPop3dDepth(sAny.pop3dDepth !== undefined ? sAny.pop3dDepth : 6);
    setTextAnimation(sAny.textAnimation !== undefined ? sAny.textAnimation : 'none');
  };
*/
  const [headingTitle, setHeadingTitle] = useState('');
  const [headingFontName, setHeadingFontName] = useState('Montserrat');
  const [headingFontSize, setHeadingFontSize] = useState(18);
  const [headingFontColor, setHeadingFontColor] = useState('#FFFFFF');
  const [headingBoxColor, setHeadingBoxColor] = useState('#1A1A1A');
  const [headingPadding, setHeadingPadding] = useState(6);
  const [showTimer, setShowTimer] = useState(false);
  const [headingTopOffset, setHeadingTopOffset] = useState(5);
  const [headingLeftOffset, setHeadingLeftOffset] = useState(5);
  const [headingBoxOpacity, setHeadingBoxOpacity] = useState(85);
  const [headingTextOpacity, setHeadingTextOpacity] = useState(100);
  const [brandingTheme, setBrandingTheme] = useState<'none' | 'fitness-in-chunks'>('none');
  const [seriesName, setSeriesName] = useState('FITNESSINCHUNKS');
  const [episodeNumber, setEpisodeNumber] = useState('EP 01');
  const [nextEpisode, setNextEpisode] = useState('EP 02');

  // Card & Brand Customization
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#d4af37');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#f5e6a3');
  const [cardPositionY, setCardPositionY] = useState(0);
  const [cardScale, setCardScale] = useState(1.0);
  const [cardFontName, setCardFontName] = useState('Montserrat');
  const [showLayoutCards, setShowLayoutCards] = useState(true);
  const [applyHUDToAll, setApplyHUDToAll] = useState(true);
  const [activeSceneIdx, setActiveSceneIdx] = useState<number>(0);
  
  const [normalStyle, setNormalStyle] = useState<WordStyle>({
    fontColor: '#FFFFFF',
    activeWordScale: 1.0,
    neonGlow: true,
    glowColor: '#FFFFFF',
    glowBlur: 1,
    glowDistance: 20
  });
  const [highlightStyle, setHighlightStyle] = useState<WordStyle>({
    fontColor: '#FACC15',
    activeWordScale: 1.15,
    neonGlow: true,
    glowColor: '#FACC15',
    glowBlur: 1,
    glowDistance: 20
  });
  const [emojiStyle, setEmojiStyle] = useState<WordStyle>({
    fontColor: '#FACC15',
    activeWordScale: 1.15,
    neonGlow: true,
    glowColor: '#FACC15',
    glowBlur: 1,
    glowDistance: 20
  });
  const [styleTab, setStyleTab] = useState<'normal' | 'highlight' | 'emoji'>('normal');
  const [sfxList, setSfxList] = useState<{ id: string; name: string }[]>([]);
  const [previewingSfx, setPreviewingSfx] = useState<string | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLoadedProject, setHasLoadedProject] = useState(false);
  const [elevenLabsModel, setElevenLabsModel] = useState('eleven_multilingual_v2');
  const [enhanceWithThoughtfulTags, setEnhanceWithThoughtfulTags] = useState(false);
  const [originalScriptText, setOriginalScriptText] = useState<string | null>(null);
  const [enhancingScript, setEnhancingScript] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    const fetchSfxs = async () => {
      try {
        const res = await fetch('/api/sfx');
        if (res.ok) {
          const data = await res.json();
          setSfxList(data);
        }
      } catch (err) {
        console.warn('Failed to fetch SFXs:', err);
      }
    };
    fetchSfxs();
  }, []);

  const handlePlaySfx = (sfxId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
      sfxAudioRef.current = null;
    }
    if (previewingSfx === sfxId) {
      setPreviewingSfx(null);
      return;
    }
    const cleanSfx = sfxId.endsWith('.mp3') ? sfxId : `${sfxId}.mp3`;
    const url = `/uploads/sfx/${cleanSfx}`;
    const audio = new Audio(url);
    sfxAudioRef.current = audio;
    setPreviewingSfx(sfxId);
    audio.play().catch(err => {
      console.warn('Failed to play SFX:', err);
      setPreviewingSfx(null);
    });
    audio.onended = () => {
      setPreviewingSfx(null);
    };
  };

  const toggleVoicePreview = (voice: Voice) => {
    if (!voice.previewUrl) return;
    
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoiceId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(voice.previewUrl);
      audioRef.current = audio;
      setPlayingVoiceId(voice.id);
      audio.play().catch(err => {
        console.error("Failed to play preview:", err);
        setPlayingVoiceId(null);
      });
      audio.onended = () => {
        setPlayingVoiceId(null);
      };
    }
  };

  const insertExpressionTag = (tag: string) => {
    const textarea = document.getElementById('script-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const textBefore = scriptText.substring(0, startPos);
    const textAfter = scriptText.substring(endPos, scriptText.length);

    // Insert tag with surrounding spaces if appropriate
    const spacerBefore = (startPos === 0 || textBefore.endsWith(' ') || textBefore.endsWith('\n')) ? '' : ' ';
    const spacerAfter = (endPos === scriptText.length || textAfter.startsWith(' ') || textAfter.startsWith('\n')) ? '' : ' ';
    const newText = textBefore + spacerBefore + tag + spacerAfter + textAfter;
    setScriptText(newText);

    // Refocus and set cursor position after the tag
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = startPos + spacerBefore.length + tag.length + spacerAfter.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const [projectName, setProjectName] = useState('Untitled Project');

  const handleRenameProject = async (newName: string) => {
    setProjectName(newName);
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
    } catch (err) {
      console.error('Failed to rename project:', err);
    }
  };

  const loadGoogleFont = (font: string) => {
    const systemFonts = ['Arial', 'Impact', 'Courier New', 'Times New Roman', 'Trebuchet MS'];
    if (systemFonts.includes(font)) return;

    let targetFont = font;
    if (font.startsWith('Kalam')) {
      targetFont = 'Kalam';
    } else if (font === 'Athiti Bold') {
      targetFont = 'Athiti';
    } else if (font === 'Bowlby') {
      targetFont = 'Bowlby One';
    }

    const id = `google-font-${targetFont.toLowerCase().replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(targetFont)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  };

  useEffect(() => {
    if (fontSelectorOpen) {
      CURATED_FONTS.forEach(font => {
        try { loadGoogleFont(font); } catch (err) { console.warn('Preload font error:', err); }
      });
    }
  }, [fontSelectorOpen]);

  useEffect(() => {
    if (fontName) {
      try { loadGoogleFont(fontName); } catch (err) { console.warn('Load active font error:', err); }
    }
  }, [fontName]);

  useEffect(() => {
    const presetFonts = ['Bangers', 'Inter', 'Orbitron', 'Titan One', 'Montserrat'];
    presetFonts.forEach(font => {
      try { loadGoogleFont(font); } catch (err) { console.warn('Preload preset font error:', err); }
    });
  }, []);

  useEffect(() => {
    if (!fontSelectorOpen) return;
    const handleClose = () => setFontSelectorOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [fontSelectorOpen]);

/*
  const handleAddCustomFont = async (customFont: string) => {
    setFontLoading(true);
    setFontDownloadError('');
    try {
      const res = await fetch('/api/fonts/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontName: customFont })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to download font.');
      }
      
      loadGoogleFont(customFont);
      setFontName(customFont);
      setFontSelectorOpen(false);
      setFontSearchQuery('');
    } catch (err: any) {
      console.error(err);
      setFontDownloadError(err.message || 'Font not found on Google Fonts.');
    } finally {
      setFontLoading(false);
    }
  };
*/



/*
  const filteredFonts = CURATED_FONTS.filter(font =>
    font.toLowerCase().includes(fontSearchQuery.toLowerCase())
  );
*/

  useEffect(() => {
    const init = async () => {
      setHasLoadedProject(false);
      await checkSettings();
      await fetchClips();
      await fetchBgms();
      await fetchProjectState();
    };
    init();
  }, [projectId]);

  const saveProjectState = async (overrides?: any) => {
    if (!hasLoadedProject) return;
    try {
      const endpoint = projectId ? `/api/projects/${projectId}` : '/api/project';
      const method = projectId ? 'PUT' : 'POST';
      const currentScenes = overrides?.scenes || scenes;

      // Prevent overwriting an existing project with empty scenes
      if (projectId && (!currentScenes || currentScenes.length === 0)) {
        console.warn('[saveProjectState] Guard triggered: refusing to overwrite project with 0 scenes.');
        return;
      }

      const stateObj = {
        scriptText, selectedVoice, audioSource, voiceoverPath, voiceoverUrl, scenes: currentScenes, activeLang,
        originalVideoPath, originalVideoUrl,
        aspectRatio, fillMode, bgMusicPath, bgMusicVolume, muteBgMusic, bgMusicStartOffset,
        voiceoverVolume, muteVoiceover, videoVolume, muteVideoAudio, sfxVolume, muteSfx,
        clipTransition, transitionDuration, zoomAnimation, subtitleMode,
        fontName, fontSize, fontColor, outlineColor, outlineThickness, bold, italic, shadow, highlightColor,
        showHighlightBox, boxColor, boxRounding, textFade, textTransition, textMotion,
        activeWordScale, wordDisplayTime, maxWordsPerLine, textPositionX, textPositionY, exportResolution,
        exportFps, showEmojis, autoEmphasis, emphasisColor, neonGlow, glowColor, glowBlur, glowDistance, highlightTrigger, textCase, pop3d, pop3dColor,
        pop3dDepth, letterSpacing, wordSpacing, shadowColor, shadowBlur, shadowDistance, shadowAngle, shadowOpacity,
        textBackgroundStyle, textAnimation, boxPadding, outlineSize,
        normalStyle, highlightStyle, emojiStyle, elevenLabsModel, enhanceWithThoughtfulTags, originalScriptText,
        headingTitle, headingFontName, headingFontSize, headingFontColor, headingBoxColor, headingPadding, showTimer, headingTopOffset, headingLeftOffset,
        headingBoxOpacity, headingTextOpacity,
        brandingTheme, seriesName, episodeNumber, nextEpisode,
        backgroundType, backgroundColor, backgroundClipId,
        talkingHeadEnabled, talkingHeadChromaColor, talkingHeadChromaSimilarity, talkingHeadChromaBlend,
        talkingHeadSize, talkingHeadPosition, talkingHeadPositionX, talkingHeadPositionY,
        talkingHeadOutlineEnabled, talkingHeadOutlineColor, talkingHeadOutlineThickness,
        brandPrimaryColor, brandSecondaryColor, cardPositionY, cardScale, cardFontName, showLayoutCards, applyHUDToAll
      };

      const payload = projectId ? { state: stateObj } : stateObj;

      await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to save project state:', err);
    }
  };

  useEffect(() => {
    if (!hasLoadedProject) return;

    const delayDebounce = setTimeout(() => {
      saveProjectState();
    }, 1000);

    return () => clearTimeout(delayDebounce);
  }, [
    scriptText, selectedVoice, audioSource, voiceoverPath, voiceoverUrl, scenes, activeLang, aspectRatio,
    originalVideoPath, originalVideoUrl,
    fillMode, bgMusicPath, bgMusicVolume, muteBgMusic, bgMusicStartOffset, voiceoverVolume, muteVoiceover,
    videoVolume, muteVideoAudio, sfxVolume, muteSfx, clipTransition,
    transitionDuration, zoomAnimation, subtitleMode, fontName, fontSize, fontColor, outlineColor, outlineThickness,
    bold, italic, shadow, highlightColor, showHighlightBox, boxColor, boxRounding, textFade,
    textTransition, textMotion, activeWordScale, wordDisplayTime, maxWordsPerLine, textPositionX, textPositionY,
    exportResolution, exportFps, showEmojis, autoEmphasis, emphasisColor, neonGlow, glowColor,
    glowBlur, glowDistance, highlightTrigger, textCase, pop3d, pop3dColor, pop3dDepth, letterSpacing, wordSpacing,
    shadowColor, shadowBlur, shadowDistance, shadowAngle, shadowOpacity, textAnimation,
    textBackgroundStyle, boxPadding, outlineSize,
    normalStyle, highlightStyle, emojiStyle,
    elevenLabsModel, enhanceWithThoughtfulTags, originalScriptText, hasLoadedProject, projectId,
    headingTitle, headingFontName, headingFontSize, headingFontColor, headingBoxColor, headingPadding, showTimer, headingTopOffset, headingLeftOffset,
    headingBoxOpacity, headingTextOpacity,
    brandingTheme, seriesName, episodeNumber, nextEpisode,
    backgroundType, backgroundColor, backgroundClipId,
    talkingHeadEnabled, talkingHeadChromaColor, talkingHeadChromaSimilarity, talkingHeadChromaBlend,
    talkingHeadSize, talkingHeadPosition, talkingHeadPositionX, talkingHeadPositionY,
    talkingHeadOutlineEnabled, talkingHeadOutlineColor, talkingHeadOutlineThickness,
    brandPrimaryColor, brandSecondaryColor, cardPositionY, cardScale, cardFontName, showLayoutCards
  ]);

  const fetchProjectState = async () => {
    try {
      const endpoint = projectId ? `/api/projects/${projectId}` : '/api/project';
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const project = projectId ? ({ ...data, ...(data.state || {}) }) : data;
        if (projectId) {
          if (data.name) setProjectName(data.name);
          if (data.type) setProjectType(data.type);
        }
        
        if (project.originalVideoPath !== undefined) setOriginalVideoPath(project.originalVideoPath);
        if (project.originalVideoUrl !== undefined) setOriginalVideoUrl(project.originalVideoUrl);
        if (project.scriptText !== undefined) setScriptText(project.scriptText);
        if (project.selectedVoice !== undefined) setSelectedVoice(project.selectedVoice);
        if (project.audioSource !== undefined) setAudioSource(project.audioSource);
        if (project.voiceoverPath !== undefined) {
          setVoiceoverPath(project.voiceoverPath);
          if (project.voiceoverPath) {
            setUploadedFileName(project.voiceoverPath.split('/').pop() || '');
          }
        }
        if (project.voiceoverUrl !== undefined) setVoiceoverUrl(project.voiceoverUrl);
        if (project.scenes !== undefined && Array.isArray(project.scenes) && project.scenes.length > 0) {
          setScenes(project.scenes);
        }
        if (project.activeLang !== undefined) setActiveLang(project.activeLang);
        if (project.aspectRatio !== undefined) setAspectRatio(project.aspectRatio);
        if (project.fillMode !== undefined) setFillMode(project.fillMode);
        if (project.bgMusicPath !== undefined) setBgMusicPath(project.bgMusicPath);
        if (project.bgMusicVolume !== undefined) setBgMusicVolume(project.bgMusicVolume);
        if (project.muteBgMusic !== undefined) setMuteBgMusic(project.muteBgMusic);
        if (project.bgMusicStartOffset !== undefined) setBgMusicStartOffset(project.bgMusicStartOffset);
        if (project.voiceoverVolume !== undefined) setVoiceoverVolume(project.voiceoverVolume);
        if (project.muteVoiceover !== undefined) setMuteVoiceover(project.muteVoiceover);
        if (project.videoVolume !== undefined) setVideoVolume(project.videoVolume);
        if (project.muteVideoAudio !== undefined) setMuteVideoAudio(project.muteVideoAudio);
        if (project.sfxVolume !== undefined) setSfxVolume(project.sfxVolume);
        if (project.muteSfx !== undefined) setMuteSfx(project.muteSfx);
        if (project.clipTransition !== undefined) setClipTransition(project.clipTransition);
        if (project.transitionDuration !== undefined) setTransitionDuration(project.transitionDuration);
        if (project.zoomAnimation !== undefined) setZoomAnimation(project.zoomAnimation);
        if (project.subtitleMode !== undefined) setSubtitleMode(project.subtitleMode);
        if (project.fontName !== undefined) setFontName(project.fontName);
        if (project.fontSize !== undefined) setFontSize(project.fontSize);
        if (project.fontColor !== undefined) setFontColor(project.fontColor);
        if (project.outlineColor !== undefined) setOutlineColor(project.outlineColor);
        if (project.outlineThickness !== undefined) setOutlineThickness(project.outlineThickness);
        if (project.bold !== undefined) setBold(project.bold);
        if (project.italic !== undefined) setItalic(project.italic);
        if (project.shadow !== undefined) setShadow(project.shadow);
        if (project.highlightColor !== undefined) setHighlightColor(project.highlightColor);
        if (project.showHighlightBox !== undefined) setShowHighlightBox(project.showHighlightBox);
        if (project.boxColor !== undefined) setBoxColor(project.boxColor);
        if (project.boxRounding !== undefined) setBoxRounding(project.boxRounding);
        if (project.textBackgroundStyle !== undefined) setTextBackgroundStyle(project.textBackgroundStyle);
        if (project.textAnimation !== undefined) setTextAnimation(project.textAnimation);
        if (project.boxPadding !== undefined) setBoxPadding(project.boxPadding);
        if (project.outlineSize !== undefined) setOutlineSize(project.outlineSize);
        if (project.textFade !== undefined) setTextFade(project.textFade);
        if (project.textTransition !== undefined) setTextTransition(project.textTransition);
        if (project.textMotion !== undefined) setTextMotion(project.textMotion);
        if (project.activeWordScale !== undefined) setActiveWordScale(project.activeWordScale);
        if (project.wordDisplayTime !== undefined) setWordDisplayTime(project.wordDisplayTime);
        if (project.maxWordsPerLine !== undefined) setMaxWordsPerLine(project.maxWordsPerLine);
        if (project.textPositionX !== undefined) setTextPositionX(project.textPositionX);
        if (project.textPositionY !== undefined) setTextPositionY(project.textPositionY);
        if (project.exportResolution !== undefined) setExportResolution(project.exportResolution);
        if (project.exportFps !== undefined) setExportFps(project.exportFps);
        if (project.showEmojis !== undefined) setShowEmojis(project.showEmojis);
        if (project.autoEmphasis !== undefined) setAutoEmphasis(project.autoEmphasis);
        if (project.emphasisColor !== undefined) setEmphasisColor(project.emphasisColor);
        if (project.neonGlow !== undefined) setNeonGlow(project.neonGlow);
        if (project.glowColor !== undefined) setGlowColor(project.glowColor);
        if (project.glowBlur !== undefined) setGlowBlur(project.glowBlur);
        if (project.glowDistance !== undefined) setGlowDistance(project.glowDistance);
        if (project.highlightTrigger !== undefined) setHighlightTrigger(project.highlightTrigger);
        if (project.textCase !== undefined) setTextCase(project.textCase);
        if (project.pop3d !== undefined) setPop3d(project.pop3d);
        if (project.pop3dColor !== undefined) setPop3dColor(project.pop3dColor);
        if (project.pop3dDepth !== undefined) setPop3dDepth(project.pop3dDepth);
        if (project.letterSpacing !== undefined) setLetterSpacing(project.letterSpacing);
        if (project.wordSpacing !== undefined) setWordSpacing(project.wordSpacing);
        if (project.shadowColor !== undefined) setShadowColor(project.shadowColor);
        if (project.shadowBlur !== undefined) setShadowBlur(project.shadowBlur);
        if (project.shadowDistance !== undefined) setShadowDistance(project.shadowDistance);
        if (project.shadowAngle !== undefined) setShadowAngle(project.shadowAngle);
        if (project.shadowOpacity !== undefined) setShadowOpacity(project.shadowOpacity);
        if (project.textAnimation !== undefined) setTextAnimation(project.textAnimation);

         const norm = project.normalStyle || {
          fontColor: project.fontColor || '#FFFFFF',
          activeWordScale: 1.0,
          neonGlow: project.neonGlow !== undefined ? !!project.neonGlow : true,
          glowColor: project.glowColor || '#FFFFFF',
          glowBlur: project.glowBlur !== undefined ? project.glowBlur : 1,
          glowDistance: project.glowDistance !== undefined ? project.glowDistance : 20
        };
        const high = project.highlightStyle || {
          fontColor: project.highlightColor || '#FACC15',
          activeWordScale: project.activeWordScale !== undefined ? project.activeWordScale : 1.15,
          neonGlow: project.neonGlow !== undefined ? !!project.neonGlow : true,
          glowColor: project.glowColor || '#FACC15',
          glowBlur: project.glowBlur !== undefined ? project.glowBlur : 1,
          glowDistance: project.glowDistance !== undefined ? project.glowDistance : 20
        };
        const emoj = project.emojiStyle || {
          fontColor: project.highlightColor || '#FACC15',
          activeWordScale: project.activeWordScale !== undefined ? project.activeWordScale : 1.15,
          neonGlow: project.neonGlow !== undefined ? !!project.neonGlow : true,
          glowColor: project.glowColor || '#FACC15',
          glowBlur: project.glowBlur !== undefined ? project.glowBlur : 1,
          glowDistance: project.glowDistance !== undefined ? project.glowDistance : 20
        };
        setNormalStyle(norm);
        setHighlightStyle(high);
        setEmojiStyle(emoj);

        if (project.elevenLabsModel !== undefined) setElevenLabsModel(project.elevenLabsModel);
        if (project.enhanceWithThoughtfulTags !== undefined) setEnhanceWithThoughtfulTags(project.enhanceWithThoughtfulTags);
        if (project.originalScriptText !== undefined) setOriginalScriptText(project.originalScriptText);
        if (project.headingTitle !== undefined) setHeadingTitle(project.headingTitle);
        if (project.headingFontName !== undefined) setHeadingFontName(project.headingFontName);
        if (project.headingFontSize !== undefined) setHeadingFontSize(project.headingFontSize);
        if (project.headingFontColor !== undefined) setHeadingFontColor(project.headingFontColor);
        if (project.headingBoxColor !== undefined) setHeadingBoxColor(project.headingBoxColor);
        if (project.headingPadding !== undefined) setHeadingPadding(project.headingPadding);
        if (project.showTimer !== undefined) setShowTimer(project.showTimer);
        if (project.headingTopOffset !== undefined) setHeadingTopOffset(project.headingTopOffset);
        if (project.headingLeftOffset !== undefined) setHeadingLeftOffset(project.headingLeftOffset);
        if (project.headingBoxOpacity !== undefined) setHeadingBoxOpacity(project.headingBoxOpacity);
        if (project.headingTextOpacity !== undefined) setHeadingTextOpacity(project.headingTextOpacity);
        if (project.episodeNumber !== undefined) setEpisodeNumber(project.episodeNumber);
        if (project.nextEpisode !== undefined) setNextEpisode(project.nextEpisode);
        
        if (project.backgroundType !== undefined) setBackgroundType(project.backgroundType);
        if (project.backgroundColor !== undefined) setBackgroundColor(project.backgroundColor);
        if (project.backgroundClipId !== undefined) setBackgroundClipId(project.backgroundClipId);
        
        if (project.talkingHeadEnabled !== undefined) setTalkingHeadEnabled(project.talkingHeadEnabled);
        if (project.talkingHeadChromaColor !== undefined) setTalkingHeadChromaColor(project.talkingHeadChromaColor);
        if (project.talkingHeadChromaSimilarity !== undefined) setTalkingHeadChromaSimilarity(project.talkingHeadChromaSimilarity);
        if (project.talkingHeadChromaBlend !== undefined) setTalkingHeadChromaBlend(project.talkingHeadChromaBlend);
        if (project.talkingHeadSize !== undefined) setTalkingHeadSize(project.talkingHeadSize);
        if (project.talkingHeadPosition !== undefined) setTalkingHeadPosition(project.talkingHeadPosition);
        if (project.talkingHeadPositionX !== undefined) setTalkingHeadPositionX(project.talkingHeadPositionX);
        if (project.talkingHeadPositionY !== undefined) setTalkingHeadPositionY(project.talkingHeadPositionY);
        if (project.talkingHeadOutlineEnabled !== undefined) setTalkingHeadOutlineEnabled(project.talkingHeadOutlineEnabled);
        if (project.talkingHeadOutlineColor !== undefined) setTalkingHeadOutlineColor(project.talkingHeadOutlineColor);
        if (project.talkingHeadOutlineThickness !== undefined) setTalkingHeadOutlineThickness(project.talkingHeadOutlineThickness);
        if (project.brandPrimaryColor !== undefined) setBrandPrimaryColor(project.brandPrimaryColor);
        if (project.brandSecondaryColor !== undefined) setBrandSecondaryColor(project.brandSecondaryColor);
        if (project.cardPositionY !== undefined) setCardPositionY(project.cardPositionY);
        if (project.cardScale !== undefined) setCardScale(project.cardScale);
        if (project.cardFontName !== undefined) setCardFontName(project.cardFontName);
        if (project.showLayoutCards !== undefined) setShowLayoutCards(project.showLayoutCards);
        if (project.applyHUDToAll !== undefined) setApplyHUDToAll(project.applyHUDToAll);
      }
    } catch (err) {
      console.error('Failed to load project state:', err);
    } finally {
      setHasLoadedProject(true);
    }
  };

  const checkSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        setElevenLabsKeySet(!!settings.elevenLabsApiKey);
        
        if (settings.elevenLabsApiKey) {
          await fetchVoices(settings.elevenLabsApiKey, settings.lastSelectedVoice);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchClips = async () => {
    try {
      const res = await fetch('/api/clips');
      if (res.ok) {
        const data = await res.json();
        setClips(data.filter((c: any) => c.status === 'ready'));
      }
    } catch (err) {
      console.error('Failed to fetch clips:', err);
    }
  };

  const fetchBgms = async () => {
    try {
      const res = await fetch('/api/bgms');
      if (res.ok) {
        const data = await res.json();
        setBgms(data);
      }
    } catch (err) {
      console.error('Failed to fetch BGMs:', err);
    }
  };

  const fetchVoices = async (apiKey: string, lastSelectedVoice?: string) => {
    try {
      const res = await fetch(`/api/voices?apiKey=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        setVoices(data);
        setSelectedVoice(prev => prev || lastSelectedVoice || (data.length > 0 ? data[0].id : ''));
      }
    } catch (err) {
      console.error('Failed to fetch voices:', err);
    }
  };

  const handleEnhanceScript = async () => {
    if (!scriptText) {
      setError('Please write a script first.');
      return;
    }
    setEnhancingScript(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/enhance-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText })
      });
      if (!res.ok) {
        throw new Error('Failed to enhance script. Please try again.');
      }
      const data = await res.json();
      setOriginalScriptText(scriptText);
      setScriptText(data.enhancedText);
      setSuccess('Script enhanced with voiceover expressions!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnhancingScript(false);
    }
  };

  const handleRevertScript = () => {
    if (originalScriptText !== null) {
      setScriptText(originalScriptText);
      setOriginalScriptText(null);
      setSuccess('Reverted script to original text.');
    }
  };

  const handleGenerateVoiceover = async () => {
    if (!scriptText) {
      setError('Please write a voiceover script first.');
      return;
    }
    if (!selectedVoice) {
      setError('Please select a voice.');
      return;
    }

    setGeneratingAudio(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scriptText,
          voiceId: selectedVoice,
          modelId: elevenLabsModel,
          enhanceSpeech: enhanceWithThoughtfulTags
        })
      });

      if (!res.ok) {
        throw await parseFetchError(res, 'TTS generation failed.');
      }

      const data = await res.json();
      setVoiceoverPath(data.audioPath);
      setVoiceoverUrl(data.audioUrl);
      setSuccess('Voiceover audio generated successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVideo(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('video', file);

    try {
      const res = await fetch('/api/upload-talkinghead', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw await parseFetchError(res, 'Video upload and extraction failed.');
      }

      const data = await res.json();
      setOriginalVideoPath(data.originalVideoPath);
      setOriginalVideoUrl(data.originalVideoUrl);
      setVoiceoverPath(data.audioPath);
      setVoiceoverUrl(data.audioUrl);
      setUploadedFileName(file.name);
      setSuccess('Talking-head video uploaded and audio extracted successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    setUploadingAudio(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw await parseFetchError(res, 'Audio upload failed.');
      }

      const data = await res.json();
      setVoiceoverPath(data.audioPath);
      setVoiceoverUrl(data.audioUrl);
      setSuccess('Voiceover audio file uploaded successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleAlignScript = async () => {
    if (!voiceoverPath) {
      setError(projectType === 'talkinghead' || projectType === 'subtitles' ? 'Original video is required. Please upload a video first.' : 'Voiceover audio is required. Please generate or upload audio first.');
      return;
    }
    if (projectType !== 'talkinghead' && projectType !== 'subtitles' && audioSource === 'generate' && !scriptText) {
      setError('Script text is required to generate and align a voiceover.');
      return;
    }

    if (projectType === 'talkinghead' || projectType === 'subtitles') {
      setTranscribing(true);
    } else {
      setAligning(true);
    }
    setError('');

    try {
      const res = await fetch('/api/align-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scriptText: projectType === 'talkinghead' ? '' : scriptText, 
          audioPath: voiceoverPath,
          language: 'hinglish'
        })
      });

      if (!res.ok) {
        throw await parseFetchError(res, projectType === 'talkinghead' ? 'Failed to transcribe and segment video.' : 'Failed to align script timings.');
      }

      const data = await res.json();
      const segments = data.segments || [];
      if (projectType === 'talkinghead' || projectType === 'subtitles') {
        const text = segments.map((s: any) => s.text).join(' ');
        setScriptText(text);
        
        const mapped = segments.map((seg: any) => ({
          ...seg,
          clipId: 'original',
          clipStart: seg.start_time,
          text: activeLang === 'hindi' ? (seg.text_hindi || seg.text || '') : (seg.text_hinglish || seg.text || ''),
          words: activeLang === 'hindi' ? (seg.words_hindi || seg.words || []) : (seg.words_hinglish || seg.words || [])
        }));
        setScenes(mapped);
        setSuccess(projectType === 'subtitles' ? 'Video transcribed successfully!' : 'Video transcribed and segmented successfully!');
      } else {
        const mapped = segments.map((seg: any) => ({
          ...seg,
          text: activeLang === 'hindi' ? (seg.text_hindi || seg.text || '') : (seg.text_hinglish || seg.text || ''),
          words: activeLang === 'hindi' ? (seg.words_hindi || seg.words || []) : (seg.words_hinglish || seg.words || [])
        }));
        setScenes(mapped);
        setSuccess('Script timeline aligned successfully!');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (projectType === 'talkinghead' || projectType === 'subtitles') {
        setTranscribing(false);
      } else {
        setAligning(false);
      }
    }
  };

  const handleMatchClips = async () => {
    if (scenes.length === 0) {
      setError('Create scenes and timestamps first.');
      return;
    }
    if (clips.length === 0 && !useAiFallback) {
      setError('No video clips available in library. Please import clips first, or enable AI Fallback.');
      return;
    }

    setMatching(true);
    setError('');

    try {
      const res = await fetch('/api/match-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, talkingHead: projectType === 'talkinghead', useAiFallback, excludeBroll: projectType !== 'youtube' })
      });

      if (!res.ok) {
        throw await parseFetchError(res, 'Semantic clip matching failed.');
      }

      const data = await res.json();
      
      const updatedScenes = [...scenes];
      data.matches.forEach((match: any) => {
        if (updatedScenes[match.sceneIndex]) {
          updatedScenes[match.sceneIndex].clipId = match.clipId;
          updatedScenes[match.sceneIndex].clipStart = match.clipStart;
          updatedScenes[match.sceneIndex].reason = match.reason;
        }
      });

      setScenes(updatedScenes);
      setSuccess(projectType === 'talkinghead' ? 'AI storyboarding match complete (B-roll & Talking Head)!' : 'AI storyboarding match complete!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMatching(false);
    }
  };

  const updateSceneClip = (idx: number, clipId: string) => {
    const updated = [...scenes];
    updated[idx].clipId = clipId;
    updated[idx].clipStart = clipId === 'original' ? (updated[idx].start_time || 0) : 0;
    setScenes(updated);
  };

  const openAiGenModal = (idx: number) => {
    const scene = scenes[idx];
    if (!scene) return;
    setAiGenSceneIdx(idx);
    setAiGenPrompt(scene.visual_description || scene.text || '');
    setAiGenDuration(Number((scene.end_time - scene.start_time).toFixed(1)) || 5);
    setAiGenType('video');
    setAiGenError('');
    setShowAiGenModal(true);
  };

  const handleGenerateAiClip = async () => {
    if (!aiGenPrompt.trim()) {
      setAiGenError('Prompt is required.');
      return;
    }
    if (aiGenSceneIdx === null) return;
    
    setAiGenLoading(true);
    setAiGenError('');

    try {
      const res = await fetch('/api/generate-ai-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiGenPrompt,
          type: aiGenType,
          duration: aiGenDuration
        })
      });

      if (!res.ok) {
        throw await parseFetchError(res, 'AI Clip Generation failed.');
      }

      const data = await res.json();
      const newClip = data.clip;

      // Add to clips list if it doesn't exist
      setClips(prev => [newClip, ...prev]);

      // Assign to scene
      updateSceneClip(aiGenSceneIdx, newClip.id);

      setShowAiGenModal(false);
      setSuccess('AI clip generated and assigned successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setAiGenError(err.message || 'An error occurred during clip generation.');
    } finally {
      setAiGenLoading(false);
    }
  };

  const removeScene = (idx: number) => {
    if (scenes.length <= 1) return;
    setScenes(scenes.filter((_, i) => i !== idx));
  };

  const mergeSceneWithPrevious = (idx: number) => {
    if (idx <= 0 || idx >= scenes.length) return;
    const prevIdx = idx - 1;
    const updated = [...scenes];
    const prevScene = updated[prevIdx];
    const currScene = updated[idx];

    // Combine text
    const combinedText = `${prevScene.text || ''} ${currScene.text || ''}`.trim();
    prevScene.text = combinedText;
    if (prevScene.text_hinglish || currScene.text_hinglish) {
      prevScene.text_hinglish = `${prevScene.text_hinglish || ''} ${currScene.text_hinglish || ''}`.trim();
    }

    // Combine end_time
    prevScene.end_time = currScene.end_time;

    // Combine words if available
    const prevWords = prevScene.words || [];
    const currWords = currScene.words || [];
    if (prevWords.length > 0 || currWords.length > 0) {
      prevScene.words = [...prevWords, ...currWords];
    } else if (combinedText) {
      const textWords = combinedText.split(/\s+/).filter(Boolean);
      const totalDur = prevScene.end_time - prevScene.start_time;
      const wordDur = totalDur / (textWords.length || 1);
      prevScene.words = textWords.map((w, wIdx) => ({
        word: w,
        start_time: prevScene.start_time + wIdx * wordDur,
        end_time: prevScene.start_time + (wIdx + 1) * wordDur
      }));
    }

    // Remove current scene
    updated.splice(idx, 1);
    setScenes(updated);
  };

  const mergeSceneWithNext = (idx: number) => {
    if (idx < 0 || idx >= scenes.length - 1) return;
    mergeSceneWithPrevious(idx + 1);
  };

  const playerRef = useRef<any>(null);

  const handleSelectSceneToPreview = (sceneStartTime: number) => {
    const targetFrame = Math.max(0, Math.round((sceneStartTime || 0) * 30));
    if (playerRef.current) {
      playerRef.current.seekTo(targetFrame);
      playerRef.current.play();
    }
  };

  const [openReverseMenuIdx, setOpenReverseMenuIdx] = useState<number | null>(null);

  const handleMatchCutReverse = (idx: number, target: 'prev' | 'next' | 'toggle') => {
    const updatedScenes = [...scenes];
    const currentScene = { ...updatedScenes[idx] };
    const currentDur = Math.max(0.5, (currentScene.end_time || 0) - (currentScene.start_time || 0));

    if (target === 'toggle') {
      currentScene.reverse = !currentScene.reverse;
      if (!currentScene.reverse) {
        currentScene.reverseTarget = undefined;
        currentScene.reverseStartTimestamp = undefined;
      } else {
        const rawStart = (currentScene.clipId === 'original' && (currentScene.clipStart === undefined || currentScene.clipStart === null)) ? (currentScene.start_time || 0) : (currentScene.clipStart || 0);
        currentScene.reverseStartTimestamp = Number((rawStart + currentDur).toFixed(3));
      }
    } else if (target === 'prev') {
      if (idx === 0) {
        alert('No previous scene available to match cut.');
        return;
      }
      const prevScene = updatedScenes[idx - 1];
      const prevDur = Math.max(0.5, (prevScene.end_time || 0) - (prevScene.start_time || 0));
      const prevClipStart = (prevScene.clipId === 'original' && (prevScene.clipStart === undefined || prevScene.clipStart === null)) ? (prevScene.start_time || 0) : (prevScene.clipStart || 0);

      const fps = 30;
      const prevStartFrame = Math.round(prevClipStart * fps);
      const prevDurFrames = Math.max(1, Math.round(prevDur * fps));

      const sliceStartInSec = prevStartFrame / fps;
      const prevEndInSec = (prevStartFrame + prevDurFrames) / fps;

      currentScene.clipId = prevScene.clipId || 'original';
      currentScene.clipUrl = prevScene.clipUrl || (prevScene.clipId && prevScene.clipId !== 'original' ? `/api/clips/${prevScene.clipId}/video` : undefined);
      currentScene.clipStart = Number(sliceStartInSec.toFixed(4));
      currentScene.reverse = true;
      currentScene.reverseTarget = 'prev';
      currentScene.reverseStartTimestamp = Number(prevEndInSec.toFixed(4));
    } else if (target === 'next') {
      if (idx >= updatedScenes.length - 1) {
        alert('No next scene available to match cut.');
        return;
      }
      const nextScene = updatedScenes[idx + 1];
      const nextClipStart = (nextScene.clipId === 'original' && (nextScene.clipStart === undefined || nextScene.clipStart === null)) ? (nextScene.start_time || 0) : (nextScene.clipStart || 0);

      currentScene.clipId = nextScene.clipId || 'original';
      currentScene.clipUrl = nextScene.clipUrl || (nextScene.clipId && nextScene.clipId !== 'original' ? `/api/clips/${nextScene.clipId}/video` : undefined);
      currentScene.clipStart = Number(nextClipStart.toFixed(3));
      currentScene.reverse = true;
      currentScene.reverseTarget = 'next';
      currentScene.reverseStartTimestamp = Number((nextClipStart + currentDur).toFixed(3));
    }

    updatedScenes[idx] = currentScene;
    setScenes(updatedScenes);
    saveProjectState({ scenes: updatedScenes });
  };

  const [showBeatSyncPanel, setShowBeatSyncPanel] = useState(false);
  const [beatThreshold, setBeatThreshold] = useState(1.4);
  const [minBeatDist, setMinBeatDist] = useState(0.8);
  const [isDetectingBeats, setIsDetectingBeats] = useState(false);

  const handleDetectBeatsInCreateProject = async () => {
    const audioUrl = voiceoverUrl || originalVideoUrl || bgMusicPath;
    if (!audioUrl) {
      alert('No audio track or video audio found for beat detection. Please upload a video or audio track.');
      return;
    }

    try {
      setIsDetectingBeats(true);
      const targetPort = 8000;
      const backendUrl = window.location.port 
        ? `${window.location.protocol}//${window.location.hostname}:${targetPort}`
        : window.location.origin;

      const res = await fetch(`${backendUrl}/api/recreate/detect-beats-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioPath: audioUrl,
          audioUrl,
          threshold: beatThreshold,
          minDistance: minBeatDist
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.scenes) && data.scenes.length > 0) {
        const newScenes = data.scenes.map((bs: any, idx: number) => {
          const oldScene = scenes[idx % scenes.length] || scenes[0] || {};
          return {
            ...oldScene,
            start_time: bs.start_time,
            end_time: bs.end_time,
            text: oldScene.text || bs.text || `Scene ${idx + 1}`,
            clipId: oldScene.clipId || 'original',
            clipStart: oldScene.clipStart || 0
          };
        });

        setScenes(newScenes);
        saveProjectState({ scenes: newScenes });
        alert(`✨ Beat Detection Complete! Created ${newScenes.length} beat-synced scenes.`);
      } else {
        alert('Failed to detect beats: ' + (data.error || 'No beats detected. Try adjusting sensitivity.'));
      }
    } catch (err: any) {
      console.error('Beat detection error:', err);
      alert('Error detecting beats: ' + err.message);
    } finally {
      setIsDetectingBeats(false);
    }
  };

  const updateSceneText = (idx: number, text: string) => {
    const updated = [...scenes];
    updated[idx].text = text;
    
    // Maintain language-specific texts
    if (activeLang === 'hindi') {
      updated[idx].text_hindi = text;
    } else {
      updated[idx].text_hinglish = text;
    }
    
    const lines = text.split('\n');
    let wordsList: { word: string; newline: boolean }[] = [];
    lines.forEach((line, lineIdx) => {
      const lineWords = line.split(/\s+/).filter(Boolean);
      lineWords.forEach((word, wordIdx) => {
        wordsList.push({
          word,
          newline: lineIdx > 0 && wordIdx === 0
        });
      });
    });

    const start = updated[idx].start_time;
    const end = updated[idx].end_time;
    const duration = end - start;
    
    let updatedWords = [];
    const existingWords = updated[idx].words || [];
    if (wordsList.length === existingWords.length) {
      updatedWords = existingWords.map((w, i) => ({
        ...w,
        word: wordsList[i].word,
        newline: wordsList[i].newline
      }));
    } else if (wordsList.length > 0 && duration > 0) {
      const wordDur = duration / wordsList.length;
      updatedWords = wordsList.map((wItem, i) => ({
        word: wItem.word,
        newline: wItem.newline,
        start_time: Number((start + i * wordDur).toFixed(3)),
        end_time: Number((start + (i + 1) * wordDur).toFixed(3))
      }));
    } else {
      updatedWords = [];
    }
    
    updated[idx].words = updatedWords;
    if (activeLang === 'hindi') {
      updated[idx].words_hindi = updatedWords;
    } else {
      updated[idx].words_hinglish = updatedWords;
    }
    
    setScenes(updated);
  };

  const handleToggleAllLanguage = (lang: 'hinglish' | 'hindi') => {
    setActiveLang(lang);
    const updated = scenes.map(scene => {
      if (lang === 'hindi') {
        return {
          ...scene,
          text: scene.text_hindi || scene.text || '',
          words: scene.words_hindi || scene.words || []
        };
      } else {
        return {
          ...scene,
          text: scene.text_hinglish || scene.text || '',
          words: scene.words_hinglish || scene.words || []
        };
      }
    });
    setScenes(updated);
    setSuccess(`Switched all subtitles to ${lang === 'hindi' ? 'Hindi' : 'Hinglish'}.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const updateSceneClipStart = (idx: number, val: number) => {
    const updated = [...scenes];
    updated[idx].clipStart = val;
    setScenes(updated);
  };

  const updateSceneTransition = (idx: number, transition: string) => {
    const updated = [...scenes];
    updated[idx].transition = transition;
    setScenes(updated);
  };

  const updateSceneTransitionDuration = (idx: number, duration: number) => {
    const updated = [...scenes];
    updated[idx].transitionDuration = duration;
    setScenes(updated);
  };

  const updateSceneSfx = (idx: number, sfx: string) => {
    const updated = [...scenes];
    updated[idx].sfx = sfx;
    setScenes(updated);
  };

  const handleUpdateScene = (idx: number, key: string, value: any) => {
    const updated = [...scenes];
    updated[idx] = {
      ...updated[idx],
      [key]: value
    };
    setScenes(updated);
    saveProjectState();
  };

  const handleRegenerateHUD = async (sceneIndex?: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/youtube/regenerate-hud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sceneIndex })
      });

      if (!res.ok) {
        throw new Error('Failed to regenerate HUD layouts.');
      }

      const data = await res.json();
      setScenes(data.state.scenes);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTransitionsToAll = () => {
    const updated = scenes.map(scene => ({
      ...scene,
      transition: clipTransition,
      transitionDuration: transitionDuration
    }));
    setScenes(updated);
    alert('Applied transition settings to all scenes!');
  };

  const handleRecommendTransitionsAndSfx = () => {
    const transitionSfxMap: { [key: string]: string } = {
      'fade': 'none',
      'slide-left': 'trans_swoosh_fast',
      'slide-right': 'trans_swoosh_fast',
      'slide-up': 'trans_swoosh_fast',
      'slide-down': 'trans_swoosh_fast',
      'zoom-in': 'trans_swoosh_deep',
      'zoom-out': 'trans_swoosh_deep',
      'random': 'trans_swoosh_fast'
    };

    const updated = scenes.map((scene, idx) => {
      if (idx === scenes.length - 1) {
        return { ...scene, transition: 'none', sfx: 'none' };
      }

      let transition: string;
      if (idx % 3 === 0) {
        transition = 'zoom-in';
      } else if (idx % 3 === 1) {
        transition = 'fade';
      } else {
        transition = 'zoom-out';
      }

      const sfx = transitionSfxMap[transition] || 'trans_swoosh_fast';
      return { ...scene, transition, sfx };
    });

    setScenes(updated);
    setSuccess('Transitions & SFXs recommended successfully!');
  };

  const handleApplyBulkTransition = () => {
    const updated = scenes.map((scene, idx) => {
      if (idx === scenes.length - 1) {
        return { ...scene, transition: 'none', sfx: 'none' };
      }
      return { ...scene, transition: bulkTransition, sfx: bulkSfx };
    });
    setScenes(updated);
    setSuccess('Applied transition and SFX to all scenes!');
  };



  const getRequiredSourceDuration = (scene: Scene) => {
    const targetDuration = scene.end_time - scene.start_time;
    if (!scene.speedRamp?.enabled) {
      return targetDuration;
    }
    const { v0, v1, v2 } = scene.speedRamp;
    return ((v0 + 6 * v1 + v2) / 8) * targetDuration;
  };

  const toggleSpeedRamp = (idx: number, enabled: boolean) => {
    const updated = [...scenes];
    if (enabled) {
      updated[idx].speedRamp = {
        enabled: true, v0: 2.0, v1: 0.5, v2: 2.0, preset: 'hero'
      };
    } else {
      updated[idx].speedRamp = {
        enabled: false, v0: 1.0, v1: 1.0, v2: 1.0, preset: 'none'
      };
    }
    
    const reqDur = getRequiredSourceDuration(updated[idx]);
    const clipId = updated[idx].clipId;
    if (clipId) {
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        const maxStart = Math.max(0, clip.duration - reqDur);
        if ((updated[idx].clipStart || 0) > maxStart) {
          updated[idx].clipStart = Math.min(updated[idx].clipStart || 0, maxStart);
        }
      }
    }
    setScenes(updated);
  };

  const toggleGymGlow = (idx: number, enabled: boolean) => {
    const updated = [...scenes];
    if (enabled) {
      updated[idx].gymGlow = {
        enabled: true, threshold: 180, radius: 20, opacity: 0.6
      };
    } else {
      updated[idx].gymGlow = {
        enabled: false, threshold: 180, radius: 20, opacity: 0.6
      };
    }
    setScenes(updated);
  };

  const updateGymGlowParam = (idx: number, key: 'threshold' | 'radius' | 'opacity', val: number) => {
    const updated = [...scenes];
    if (!updated[idx].gymGlow) return;
    updated[idx].gymGlow = {
      ...updated[idx].gymGlow!,
      [key]: val
    };
    setScenes(updated);
  };

  const toggleSceneShake = (idx: number, checked: boolean) => {
    const updated = [...scenes];
    updated[idx].shake = checked;
    if (checked) {
      updated[idx].shakeIntensity = updated[idx].shakeIntensity ?? 15;
      updated[idx].shakeSpeed = updated[idx].shakeSpeed ?? 20;
    }
    setScenes(updated);
  };

  const updateSceneShakeParam = (idx: number, key: 'shakeIntensity' | 'shakeSpeed', val: number) => {
    const updated = [...scenes];
    updated[idx][key] = val;
    setScenes(updated);
  };

  const applyShakeToAllScenes = (sourceIdx: number) => {
    const source = scenes[sourceIdx];
    const updated = scenes.map(scene => ({
      ...scene,
      shake: source.shake,
      shakeIntensity: source.shakeIntensity ?? 15,
      shakeSpeed: source.shakeSpeed ?? 20
    }));
    setScenes(updated);
    alert('Applied camera shake settings to all scenes!');
  };

  const updateSpeedRampPreset = (idx: number, preset: string) => {
    const updated = [...scenes];
    if (!updated[idx].speedRamp) return;
    const sr = { ...updated[idx].speedRamp! };
    sr.preset = preset;
    if (preset === 'hero') {
      sr.v0 = 2.0; sr.v1 = 0.5; sr.v2 = 2.0;
    } else if (preset === 'slow-in') {
      sr.v0 = 0.5; sr.v1 = 1.0; sr.v2 = 1.5;
    } else if (preset === 'fast-in') {
      sr.v0 = 2.0; sr.v1 = 1.0; sr.v2 = 0.5;
    } else if (preset === 'slow-fast-slow') {
      sr.v0 = 0.25; sr.v1 = 2.0; sr.v2 = 0.25;
    } else if (preset === 'fast-slow-fast') {
      sr.v0 = 2.0; sr.v1 = 0.25; sr.v2 = 2.0;
    }
    updated[idx].speedRamp = sr;

    const reqDur = getRequiredSourceDuration(updated[idx]);
    const clipId = updated[idx].clipId;
    if (clipId) {
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        const maxStart = Math.max(0, clip.duration - reqDur);
        if ((updated[idx].clipStart || 0) > maxStart) {
          updated[idx].clipStart = Math.min(updated[idx].clipStart || 0, maxStart);
        }
      }
    }
    setScenes(updated);
  };

  const updateCustomSpeed = (idx: number, key: 'v0' | 'v1' | 'v2', val: number) => {
    const updated = [...scenes];
    if (!updated[idx].speedRamp) return;
    const sr = { ...updated[idx].speedRamp! };
    sr[key] = val;
    sr.preset = 'custom';
    updated[idx].speedRamp = sr;

    const reqDur = getRequiredSourceDuration(updated[idx]);
    const clipId = updated[idx].clipId;
    if (clipId) {
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        const maxStart = Math.max(0, clip.duration - reqDur);
        if ((updated[idx].clipStart || 0) > maxStart) {
          updated[idx].clipStart = Math.min(updated[idx].clipStart || 0, maxStart);
        }
      }
    }
    setScenes(updated);
  };

  const applySpeedRampToAllClips = (idx: number) => {
    const sourceSr = scenes[idx].speedRamp || { enabled: false, v0: 1.0, v1: 1.0, v2: 1.0, preset: 'none' };
    const updated = scenes.map((scene) => {
      const newSr = { ...sourceSr };
      const newScene = { ...scene, speedRamp: newSr };

      const reqDur = getRequiredSourceDuration(newScene);
      const clipId = newScene.clipId;
      if (clipId) {
        const clip = clips.find(c => c.id === clipId);
        if (clip) {
          const maxStart = Math.max(0, clip.duration - reqDur);
          if ((newScene.clipStart || 0) > maxStart) {
            newScene.clipStart = Math.min(newScene.clipStart || 0, maxStart);
          }
        }
      }
      return newScene;
    });
    setScenes(updated);
  };

  const handleNewProject = async () => {
    if (!confirm('Are you sure you want to start a new project? This will reset all current inputs and storyboards.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/project', { method: 'DELETE' });
      if (res.ok) {
        setScriptText('');
        setVoiceoverPath('');
        setVoiceoverUrl('');
        setScenes([]);
        setAudioSource('generate');
        setBgMusicPath('');
        setBgMusicVolume(0.15);
        setClipTransition('none');
        setZoomAnimation(true);
        setSubtitleMode('classic');
        setFontName('Arial');
        setFontSize(24);
        setFontColor('#FFFFFF');
        setOutlineColor('#000000');
        setBold(true);
        setItalic(false);
        setShadow(true);
        setHighlightColor('#FFFF00');
        setShowHighlightBox(true);
        setBoxColor('#8A4BF3');
        setBoxRounding(8);
        setSuccess('New project created successfully! State cleared.');
        setError('');
      } else {
        throw new Error('Failed to clear project state on backend.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompileVideo = async () => {
    if (projectType !== 'subtitles' && scenes.some(s => !s.clipId)) {
      setError('All storyboard scenes must have an assigned video clip.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, scenes, voiceoverPath, bgMusicPath,
          bgMusicVolume: muteBgMusic ? 0.0 : bgMusicVolume,
          bgMusicStartOffset,
          voiceoverVolume: muteVoiceover ? 0.0 : voiceoverVolume,
          videoVolume: muteVideoAudio ? 0.0 : videoVolume,
          sfxVolume: muteSfx ? 0.0 : sfxVolume,
          aspectRatio, fillMode, clipTransition, transitionDuration, zoomAnimation,
          exportResolution, exportFps, originalVideoPath,
          backgroundType, backgroundColor, backgroundClipId,
          talkingHeadEnabled, talkingHeadChromaColor, talkingHeadChromaSimilarity, talkingHeadChromaBlend,
          talkingHeadSize, talkingHeadPosition, talkingHeadPositionX, talkingHeadPositionY,
          talkingHeadOutlineEnabled, talkingHeadOutlineColor, talkingHeadOutlineThickness,
          subtitlesOnly: projectType === 'subtitles',
          brandPrimaryColor, brandSecondaryColor,
          cardPositionY, cardScale, cardFontName, showLayoutCards,
          subtitleStyle: {
            subtitleMode, fontName, fontSize, fontColor, outlineColor, bold, italic, shadow,
            highlightColor, showHighlightBox, boxColor, boxRounding, textFade, textTransition,
            textMotion, activeWordScale, wordDisplayTime, maxWordsPerLine, textPositionX, textPositionY, showEmojis,
            autoEmphasis, emphasisColor, neonGlow, glowColor, glowBlur, glowDistance, highlightTrigger, textCase, pop3d, pop3dColor,
            pop3dDepth, letterSpacing, wordSpacing, shadowColor, shadowBlur, shadowDistance, shadowAngle, shadowOpacity,
            textBackgroundStyle, textAnimation, boxPadding, outlineSize,
            normalStyle, highlightStyle, emojiStyle,
            headingTitle, headingFontName, headingFontSize, headingFontColor, headingBoxColor, headingPadding,
            showTimer, headingTopOffset, headingLeftOffset,
            headingBoxOpacity, headingTextOpacity,
            brandingTheme, seriesName, episodeNumber, nextEpisode
          }
        })
      });

      if (!res.ok) {
        throw await parseFetchError(res, 'Failed to submit rendering job.');
      }

      const data = await res.json();
      onStartRender(data.jobId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasSplicingError = scenes.some(scene => {
    if (!scene.clipId) return false;
    const clip = clips.find(c => c.id === scene.clipId);
    if (!clip) return false;
    const reqDur = getRequiredSourceDuration(scene);
    return (scene.clipStart || 0) + reqDur > clip.duration + 0.001;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px max-content', gap: '24px' }}>
      {/* LEFT: Project Pipeline */}
      <div>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {projectId ? (
              <input
                type="text"
                value={projectName}
                onChange={(e) => handleRenameProject(e.target.value)}
                style={{
                  fontSize: '28px', fontWeight: 800, marginBottom: '8px', background: 'transparent',
                  border: 'none', outline: 'none', color: 'var(--text-white)', width: '100%', padding: 0,
                  borderBottom: '1px dashed transparent', cursor: 'text'
                }}
                onFocus={(e) => { e.target.style.borderBottomColor = 'var(--accent-purple)'; }}
                onBlur={(e) => { e.target.style.borderBottomColor = 'transparent'; }}
                placeholder="Project Name"
              />
            ) : (
              <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Create Project</h2>
            )}
            <p style={{ color: 'var(--text-gray)', fontSize: '14px' }}>
              Build your storyboard, align audio timeline, choose aesthetics, and compile.
            </p>
          </div>
          <button
            onClick={handleNewProject}
            className="btn-secondary"
            style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}
          >
            <RefreshCw size={14} />
            New Project
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#34d399', padding: '16px', borderRadius: '8px', marginBottom: '24px',
            fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {/* Step 1: Script & Voiceover */}
        <section className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', fontFamily: 'var(--font-headline)', fontWeight: 600 }}>
            <span style={{
              width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'var(--primary-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
              fontSize: '11px', fontFamily: 'var(--font-sans)', flexShrink: 0
            }}>1</span>
            {projectType === 'talkinghead' ? 'Upload Talking Head Video' : projectType === 'subtitles' ? 'Upload Video for Subtitles' : 'Script & Voiceover'}
          </h3>

          {projectType === 'talkinghead' || projectType === 'subtitles' ? (
            <div>
              <input
                id="talkinghead-video-upload-input"
                type="file"
                accept="video/mp4,video/quicktime,video/*"
                onChange={handleVideoUpload}
                disabled={uploadingVideo}
                style={{ display: 'none' }}
              />
              {originalVideoUrl ? (
                <div>
                  <video src={originalVideoUrl} controls style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '16px' }} />
                  <button
                    type="button"
                    onClick={() => document.getElementById('talkinghead-video-upload-input')?.click()}
                    className="btn-secondary"
                    disabled={uploadingVideo}
                    style={{ width: '100%', height: '40px' }}
                  >
                    Change Video
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => document.getElementById('talkinghead-video-upload-input')?.click()}
                  style={{
                    border: '1px dashed var(--border-light)', borderRadius: '8px', padding: '40px 24px',
                    textAlign: 'center', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.01)',
                    transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '12px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                  }}
                >
                  <Video size={32} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>
                    {uploadingVideo ? 'Uploading video & extracting audio...' : projectType === 'talkinghead' ? 'Select or drag Talking Head Video' : 'Select or drag Video'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Supports .mp4, .mov, and other common formats.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Script text</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleEnhanceScript}
                      disabled={enhancingScript || !scriptText}
                      className="btn-secondary"
                      style={{
                        fontSize: '12px',
                        padding: '4px 10.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderColor: 'var(--accent-purple)',
                        color: 'var(--accent-purple)',
                        height: '28px'
                      }}
                    >
                      <Sparkles size={12} />
                      {enhancingScript ? 'Enhancing...' : 'AI Enhance Script'}
                    </button>
                    {originalScriptText !== null && (
                      <button
                        type="button"
                        onClick={handleRevertScript}
                        className="btn-secondary"
                        style={{
                          fontSize: '12px',
                          padding: '4px 10.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderColor: '#ef4444',
                          color: '#ef4444',
                          height: '28px'
                        }}
                      >
                        Revert
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  id="script-textarea"
                  className="input-field"
                  rows={4}
                  placeholder="e.g. When performing a proper barbell squat, ensure your feet are shoulder-width apart. Focus on keeping your spine straight and descend slowly until your thighs are parallel to the floor."
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  style={{ resize: 'vertical', marginBottom: '8px' }}
                />
                {elevenLabsModel === 'eleven_v3' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>Insert ElevenLabs V3 Tag:</span>
                    {['[thoughtful]', '[sigh]', '[gasp]', '[laughs]', '[whisper]', '[cry]'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertExpressionTag(tag)}
                        style={{
                          fontSize: '11px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          color: 'var(--accent-purple)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          fontWeight: '600',
                          outline: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.borderColor = 'var(--accent-purple)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          e.currentTarget.style.borderColor = 'var(--border-light)';
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="radio" name="audio-src" checked={audioSource === 'generate'} onChange={() => setAudioSource('generate')} />
                  Generate Voiceover (ElevenLabs)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="radio" name="audio-src" checked={audioSource === 'upload'} onChange={() => setAudioSource('upload')} />
                  Upload Audio Directly
                </label>
              </div>

              {audioSource === 'generate' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="label">ElevenLabs Voice</label>
                      {!elevenLabsKeySet ? (
                        <div style={{ color: '#f87171', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} /> ElevenLabs key not set. Go to Settings tab.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            className="input-field"
                            value={selectedVoice}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedVoice(val);
                              if (audioRef.current) {
                                audioRef.current.pause();
                                setPlayingVoiceId(null);
                              }
                              fetch('/api/settings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lastSelectedVoice: val })
                              }).catch(err => console.error('Failed to save lastSelectedVoice:', err));
                            }}
                            style={{ flex: 1 }}
                          >
                            {voices.map(voice => (
                              <option key={voice.id} value={voice.id}>
                                {voice.name} ({voice.category})
                              </option>
                            ))}
                          </select>
                          {voices.find(v => v.id === selectedVoice)?.previewUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                const voiceObj = voices.find(v => v.id === selectedVoice);
                                if (voiceObj) toggleVoicePreview(voiceObj);
                              }}
                              className="btn-secondary"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '42px', height: '42px', padding: 0, borderRadius: '50%', flexShrink: 0
                              }}
                              title="Listen to voice sample"
                            >
                              {playingVoiceId === selectedVoice ? <Pause size={18} /> : <Play size={18} />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <label className="label">Synthesis Model</label>
                      <select
                        className="input-field"
                        value={elevenLabsModel}
                        onChange={(e) => {
                          setElevenLabsModel(e.target.value);
                          if (e.target.value !== 'eleven_v3') {
                            setEnhanceWithThoughtfulTags(false);
                          }
                        }}
                      >
                        <option value="eleven_multilingual_v2">Multilingual v2 (Standard)</option>
                        <option value="eleven_v3">Eleven v3 (Expressive)</option>
                        <option value="eleven_flash_v2_5">Flash v2.5 (Fast)</option>
                        <option value="eleven_turbo_v2_5">Turbo v2.5 (Balanced)</option>
                      </select>
                    </div>
                  </div>

                  {elevenLabsModel === 'eleven_v3' && (
                    <div 
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', 
                        borderRadius: '8px', border: '1px solid var(--border-light)',
                        marginTop: '-4px'
                      }}
                    >
                      <input
                        type="checkbox"
                        id="enhance-thoughtful"
                        checked={enhanceWithThoughtfulTags}
                        onChange={(e) => setEnhanceWithThoughtfulTags(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor="enhance-thoughtful" style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>Enhance speech expression</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Automatically injects a [thoughtful] style prompt for deeper and more emotional narration</span>
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateVoiceover}
                    className="btn-primary"
                    disabled={generatingAudio || !elevenLabsKeySet || !scriptText}
                    style={{ height: '46px', width: '100%' }}
                  >
                    <Sparkles size={16} />
                    {generatingAudio ? 'Generating...' : 'Synthesize Voiceover'}
                  </button>
                </div>
              ) : (
                <div>
                  <label className="label">Upload Audio File (.mp3)</label>
                  <div 
                    onClick={() => document.getElementById('audio-upload-input')?.click()}
                    style={{
                      border: '1px dashed var(--border-light)', borderRadius: '8px', padding: '24px',
                      textAlign: 'center', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.01)',
                      transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                    }}
                  >
                    <input
                      id="audio-upload-input"
                      type="file"
                      accept="audio/mp3,audio/mpeg,audio/*"
                      onChange={handleAudioUpload}
                      disabled={uploadingAudio}
                      style={{ display: 'none' }}
                    />
                    <Upload size={20} style={{ color: 'var(--text-muted)', marginBottom: '4px' }} />
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>
                      {uploadingAudio ? 'Uploading audio file...' : uploadedFileName ? 'Change audio file' : 'Select audio file'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {uploadedFileName || 'Drag and drop or click to browse (.mp3)'}
                    </div>
                  </div>
                </div>
              )}

              {voiceoverUrl && (
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '13px', display: 'block', color: 'var(--text-gray)', marginBottom: '8px' }}>Voiceover Preview:</span>
                  <audio src={voiceoverUrl} controls style={{ width: '100%' }} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Step 2: Script Alignment */}
        {voiceoverPath && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', position: 'relative' }}>
            <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 100%)' }}></div>
            
            <button
              type="button"
              onClick={handleAlignScript}
              disabled={projectType === 'talkinghead' || projectType === 'subtitles' ? transcribing : aligning}
              className="btn-secondary active-glow"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px',
                background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
                borderRadius: '24px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                color: 'var(--text-white)', transition: 'all 0.2s ease', height: '40px'
              }}
            >
              <RefreshCw size={14} className={(projectType === 'talkinghead' || projectType === 'subtitles' ? transcribing : aligning) ? 'spin' : ''} style={{ animation: (projectType === 'talkinghead' || projectType === 'subtitles' ? transcribing : aligning) ? 'spin-slow 2s linear infinite' : 'none' }} />
              {projectType === 'talkinghead' || projectType === 'subtitles'
                ? (transcribing ? 'Transcribing Video...' : 'Transcribe Video')
                : (aligning ? 'Aligning script with Gemini...' : 'Analyze Timestamps & Align')}
            </button>
            
            <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to top, rgba(255,255,255,0.15) 0%, transparent 100%)', marginTop: '8px' }}></div>
          </div>
        )}

        {/* Step 3: Storyboard Editing */}
        {scenes.length > 0 && (
          <section className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-headline)', fontWeight: 600, margin: 0 }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'var(--primary-foreground)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                  fontSize: '11px', fontFamily: 'var(--font-sans)', flexShrink: 0
                }}>3</span>
                Storyboard
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '0 6px' }}>Lang:</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAllLanguage('hinglish')}
                    style={{
                      fontSize: '11px',
                      height: '24px',
                      padding: '0 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeLang === 'hinglish' ? 'var(--accent-purple)' : 'transparent',
                      color: activeLang === 'hinglish' ? '#FFFFFF' : 'var(--text-muted)',
                      fontWeight: activeLang === 'hinglish' ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Hinglish
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllLanguage('hindi')}
                    style={{
                      fontSize: '11px',
                      height: '24px',
                      padding: '0 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeLang === 'hindi' ? 'var(--accent-purple)' : 'transparent',
                      color: activeLang === 'hindi' ? '#FFFFFF' : 'var(--text-muted)',
                      fontWeight: activeLang === 'hindi' ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Hindi
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="use-ai-fallback-toggle"
                    checked={useAiFallback}
                    onChange={(e) => setUseAiFallback(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="use-ai-fallback-toggle" style={{ fontSize: '12px', color: 'var(--text-gray)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontWeight: 500 }}>
                    <Sparkle size={12} color="var(--primary)" fill="var(--primary)" /> Use AI Fallback
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBeatSyncPanel(!showBeatSyncPanel)}
                  className="btn-secondary"
                  style={{
                    fontSize: '12px',
                    padding: '6px 14px',
                    height: '32px',
                    borderColor: showBeatSyncPanel ? 'var(--accent-purple)' : 'var(--border-medium)',
                    color: showBeatSyncPanel ? '#FFF' : 'var(--text-gray)',
                    background: showBeatSyncPanel ? 'var(--accent-purple)' : 'transparent'
                  }}
                >
                  <Music size={12} style={{ marginRight: '6px' }} />
                  Beat Sync & Auto-Cut
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkTransitions(!showBulkTransitions)}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 14px', height: '32px', borderColor: showBulkTransitions ? 'var(--primary)' : 'var(--border-medium)', color: showBulkTransitions ? 'var(--text-white)' : 'var(--text-gray)' }}
                >
                  ✨ Bulk Transitions & SFX
                </button>
                <button
                  type="button"
                  onClick={handleMatchClips}
                  className="btn-secondary"
                  disabled={matching || (clips.length === 0 && !useAiFallback)}
                  style={{ fontSize: '12px', padding: '6px 14px', height: '32px' }}
                >
                  <Sparkles size={12} style={{ marginRight: '6px' }} />
                  {matching ? 'Auto-matching...' : 'AI Auto-Match Clips'}
                </button>
              </div>
            </div>

            {showBeatSyncPanel && (
              <div
                className="premium-card"
                style={{
                  padding: '16px 20px',
                  marginBottom: '20px',
                  background: 'rgba(138, 75, 243, 0.08)',
                  border: '1px solid rgba(138, 75, 243, 0.3)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={18} style={{ color: 'var(--accent-purple)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-white)' }}>
                      🎵 Beat Detection & Auto-Split Timeline
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                    Analyzes audio PCM energy & creates beat-matched scenes
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '4px' }}>
                      <span>Sensitivity / Threshold:</span>
                      <strong style={{ color: '#FFF' }}>{beatThreshold.toFixed(1)}</strong>
                    </div>
                    <input
                      type="range" min={0.6} max={2.4} step={0.1}
                      value={beatThreshold}
                      onChange={(e) => setBeatThreshold(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>Frequent (0.6)</span>
                      <span>Heavy Beats (2.4)</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '4px' }}>
                      <span>Min Cut Duration:</span>
                      <strong style={{ color: '#FFF' }}>{minBeatDist.toFixed(1)}s</strong>
                    </div>
                    <input
                      type="range" min={0.4} max={3.0} step={0.1}
                      value={minBeatDist}
                      onChange={(e) => setMinBeatDist(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>Fast (0.4s)</span>
                      <span>Slow (3.0s)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectBeatsInCreateProject}
                    disabled={isDetectingBeats}
                    className="btn-secondary"
                    style={{
                      height: '36px',
                      fontSize: '12px',
                      fontWeight: 700,
                      justifyContent: 'center',
                      background: 'var(--accent-purple)',
                      color: '#FFF',
                      border: 'none',
                      cursor: isDetectingBeats ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isDetectingBeats ? (
                      <>
                        <RefreshCw className="spin" size={14} style={{ marginRight: '6px' }} />
                        Analyzing Audio Beats...
                      </>
                    ) : (
                      <>
                        <Music size={14} style={{ marginRight: '6px' }} />
                        Detect Beats & Auto-Cut Scenes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {showBulkTransitions && clips.length > 0 && (
              <div className="premium-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="label" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Smart Recommendation</label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRecommendTransitionsAndSfx}
                    style={{ fontSize: '11px', height: '32px', padding: '0 12px', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 'bold' }}
                  >
                    🪄 Auto-Recommend Transitions & SFXs (Alternating)
                  </button>
                </div>
                
                <div style={{ width: '1px', height: '40px', background: 'var(--border-light)', alignSelf: 'center' }} />
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <label className="label" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Transition</label>
                    <select
                      className="input-field"
                      value={bulkTransition}
                      onChange={(e) => setBulkTransition(e.target.value)}
                      style={{ height: '32px', fontSize: '11px', margin: 0, background: 'var(--bg-medium)' }}
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade</option>
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-right">Slide Right</option>
                      <option value="slide-up">Slide Up</option>
                      <option value="slide-down">Slide Down</option>
                      <option value="zoom-in">Zoom In</option>
                      <option value="zoom-out">Zoom Out</option>
                      <option value="random">Random</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <label className="label" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Transition SFX</label>
                    <select
                      className="input-field"
                      value={bulkSfx}
                      onChange={(e) => setBulkSfx(e.target.value)}
                      style={{ height: '32px', fontSize: '11px', margin: 0, background: 'var(--bg-medium)' }}
                    >
                      <option value="none">None</option>
                      {(sfxList.length > 0 ? sfxList : [
                        { id: 'trans_swoosh_fast', name: 'Snappy Swoosh' },
                        { id: 'trans_swoosh_deep', name: 'Cinematic Whoosh' },
                        { id: 'trans_glitch_digital', name: 'Glitch / Static' },
                        { id: 'trans_shutter_click', name: 'Shutter & Flash' },
                        { id: 'trans_vhs_rewind', name: 'Tape Rewind' },
                        { id: 'trans_paper_slide', name: 'Page Slide' },
                        { id: 'reveal_pop_bubble', name: 'Bubble Pop' },
                        { id: 'reveal_kb_click', name: 'Keyboard Tap' },
                        { id: 'reveal_ding_bell', name: 'Snappy Ding' },
                        { id: 'reveal_swoosh_zip', name: 'Micro Zip' },
                        { id: 'reveal_chime_sweet', name: 'Synth Chime' },
                        { id: 'hook_bass_drop', name: 'Sub Bass Rumble' },
                        { id: 'hook_vinyl_scratch', name: 'Record Scratch' },
                        { id: 'hook_metal_hit', name: 'Cinematic Metal Hit' },
                        { id: 'hook_woosh_hit', name: 'Whoosh To Hit' },
                        { id: 'hook_cymbal_swell', name: 'Reversed Cymbal' }
                      ]).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleApplyBulkTransition}
                    style={{ fontSize: '11px', height: '32px', padding: '0 16px', fontWeight: 'bold' }}
                  >
                    Apply to All
                  </button>
                </div>
              </div>
            )}


            {projectType !== 'subtitles' && clips.length === 0 ? (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} /> No clips in library. Import clips to start storyboarding.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {scenes.map((scene, idx) => {
                  const duration = scene.end_time - scene.start_time;
                  const selectedClip = clips.find(c => c.id === scene.clipId);
                  const previewBoxHeight = aspectRatio === '9:16' ? '220px' : aspectRatio === '1:1' ? '180px' : '150px';

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredSceneIdx(idx)}
                      onMouseLeave={() => setHoveredSceneIdx(null)}
                      onClick={() => {
                        setActiveSceneIdx(idx);
                        handleSelectSceneToPreview(scene.start_time);
                      }}
                      className="tonal-border"
                      style={{
                        background: 'var(--bg-darker)', 
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        transition: 'all 0.2s ease',
                        border: activeSceneIdx === idx ? '2px solid #d4af37' : '2px solid transparent',
                        boxShadow: activeSceneIdx === idx ? '0 0 12px rgba(212, 175, 55, 0.25)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        height: previewBoxHeight, background: '#020202', position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderBottom: '1px solid var(--border-medium)', overflow: 'hidden'
                      }}>
                        {scene.clipId === 'original' || projectType === 'subtitles' ? (
                          <VideoPreview
                            clipId="original"
                            thumbnail="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500&auto=format&fit=crop&q=60"
                            videoUrl={originalVideoUrl}
                            clipStart={scene.start_time}
                            isActive={hoveredSceneIdx === idx || activeSliderIdx === idx}
                          />
                        ) : selectedClip ? (
                          <VideoPreview
                            clipId={selectedClip.id}
                            thumbnail={selectedClip.thumbnail}
                            clipStart={scene.reverse ? 0 : (scene.clipStart || 0)}
                            videoUrl={scene.reverse ? `/api/reverse-video?clipId=${selectedClip.id}&videoUrl=${encodeURIComponent(`/api/clips/${selectedClip.id}/video`)}&start=${scene.clipStart || 0}&duration=${Math.max(0.5, (scene.end_time || 0) - (scene.start_time || 0))}` : undefined}
                            isActive={hoveredSceneIdx === idx || activeSliderIdx === idx}
                          />
                        ) : (
                          <div style={{ color: 'var(--text-gray)', fontSize: '11px', textAlign: 'center', padding: '12px', opacity: 0.5 }}>
                            No Clip Assigned
                          </div>
                        )}
                        
                        <div style={{
                          position: 'absolute', top: '8px', left: '8px', background: 'var(--glass-bg)',
                          backdropFilter: 'blur(8px)', padding: '2px 8px', borderRadius: '4px',
                          fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-white)',
                          border: '1px solid var(--glass-border)', zIndex: 10
                        }}>
                          {scene.start_time.toFixed(1)}s - {scene.end_time.toFixed(1)}s ({duration.toFixed(1)}s)
                        </div>

                        {/* Action buttons overlay: Merge Prev, Split, Merge Next, Delete */}
                        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', zIndex: 11 }}>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                mergeSceneWithPrevious(idx);
                              }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.35)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(59, 130, 246, 0.6)',
                                color: '#93c5fd',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              title="Merge with Previous Scene"
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.7)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.35)'; }}
                            >
                              <GitMerge size={12} style={{ transform: 'rotate(180deg)' }} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSplitModal(idx);
                            }}
                            style={{
                              background: 'rgba(138, 75, 243, 0.35)',
                              backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(138, 75, 243, 0.6)',
                              color: '#e9d5ff',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            title="Split Scene at Custom Length or Half"
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(138, 75, 243, 0.7)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(138, 75, 243, 0.35)'; }}
                          >
                            <Scissors size={12} />
                          </button>

                          {/* Reverse Continuity Cut Popover Button */}
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenReverseMenuIdx(openReverseMenuIdx === idx ? null : idx);
                              }}
                              style={{
                                background: scene.reverse ? 'rgba(234, 179, 8, 0.45)' : 'rgba(168, 85, 247, 0.35)',
                                backdropFilter: 'blur(8px)',
                                border: scene.reverse ? '1px solid #facc15' : '1px solid rgba(168, 85, 247, 0.6)',
                                color: scene.reverse ? '#fef08a' : '#f3e8ff',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              title="Reverse Continuity Match-Cut (Left/Right)"
                            >
                              <RotateCcw size={12} />
                            </button>

                            {openReverseMenuIdx === idx && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '28px',
                                  right: '0',
                                  zIndex: 100,
                                  background: 'var(--bg-darker)',
                                  border: '1px solid var(--border-medium)',
                                  borderRadius: '8px',
                                  padding: '6px',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  minWidth: '190px'
                                }}
                              >
                                <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', padding: '2px 6px', textTransform: 'uppercase' }}>
                                  Reverse Match-Cut:
                                </div>
                                
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMatchCutReverse(idx, 'prev');
                                    setOpenReverseMenuIdx(null);
                                  }}
                                  style={{
                                    fontSize: '11px',
                                    padding: '6px 8px',
                                    textAlign: 'left',
                                    background: 'transparent',
                                    border: 'none',
                                    color: idx === 0 ? 'var(--text-muted)' : 'var(--text-white)',
                                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onMouseEnter={(e) => { if (idx > 0) e.currentTarget.style.background = 'var(--bg-medium)' }}
                                  onMouseLeave={(e) => { if (idx > 0) e.currentTarget.style.background = 'transparent' }}
                                >
                                  ⬅️ Match Prev Scene (Left)
                                </button>

                                <button
                                  type="button"
                                  disabled={idx >= scenes.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMatchCutReverse(idx, 'next');
                                    setOpenReverseMenuIdx(null);
                                  }}
                                  style={{
                                    fontSize: '11px',
                                    padding: '6px 8px',
                                    textAlign: 'left',
                                    background: 'transparent',
                                    border: 'none',
                                    color: idx >= scenes.length - 1 ? 'var(--text-muted)' : 'var(--text-white)',
                                    cursor: idx >= scenes.length - 1 ? 'not-allowed' : 'pointer',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onMouseEnter={(e) => { if (idx < scenes.length - 1) e.currentTarget.style.background = 'var(--bg-medium)' }}
                                  onMouseLeave={(e) => { if (idx < scenes.length - 1) e.currentTarget.style.background = 'transparent' }}
                                >
                                  ➡️ Match Next Scene (Right)
                                </button>

                                <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMatchCutReverse(idx, 'toggle');
                                    setOpenReverseMenuIdx(null);
                                  }}
                                  style={{
                                    fontSize: '11px',
                                    padding: '6px 8px',
                                    textAlign: 'left',
                                    background: 'transparent',
                                    border: 'none',
                                    color: scene.reverse ? '#facc15' : 'var(--text-white)',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-medium)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  🔄 {scene.reverse ? 'Disable Reverse' : 'Toggle Reverse'}
                                </button>
                              </div>
                            )}
                          </div>

                          {idx < scenes.length - 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                mergeSceneWithNext(idx);
                              }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.35)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(59, 130, 246, 0.6)',
                                color: '#93c5fd',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              title="Merge with Next Scene"
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.7)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.35)'; }}
                            >
                              <GitMerge size={12} />
                            </button>
                          )}

                          {scenes.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeScene(idx);
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.25)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#ff8a8a',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              title="Delete Scene"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.5)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.7)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                              }}
                            >
                              <Trash size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        <div>
                          <label className="label" style={{ fontSize: '10px', marginBottom: '4px' }}>Scene Subtitles</label>
                          <textarea
                            className="input-field"
                            value={scene.text || ''}
                            onChange={(e) => updateSceneText(idx, e.target.value)}
                            placeholder="Type scene subtitles..."
                            rows={2}
                            style={{
                              margin: 0,
                              fontSize: '12px',
                              lineHeight: '1.4',
                              fontStyle: 'italic',
                              fontFamily: 'inherit',
                              resize: 'none',
                              height: '42px',
                              minHeight: '42px',
                              background: 'var(--bg-medium)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-white)'
                            }}
                          />
                        </div>

                        {/* Double-clickable per-word styling interface */}
                        {scene.words && scene.words.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <label className="label" style={{ fontSize: '10px', marginBottom: '4px' }}>
                              Words Styling (Double-click a word to style it)
                            </label>
                            <div style={{ 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              gap: '6px', 
                              padding: '8px', 
                              background: 'var(--bg-darker)', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border-medium)',
                              minHeight: '34px'
                            }}>
                              {scene.words.map((wordObj, wordIdx) => {
                                const isWordSelected = selectedWord && selectedWord.sceneIdx === idx && selectedWord.wordIdx === wordIdx;
                                return (
                                  <span 
                                    key={wordIdx} 
                                    onDoubleClick={() => setSelectedWord({ sceneIdx: idx, wordIdx })}
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: wordObj.size ? `${wordObj.size}px` : '12px',
                                      color: wordObj.color || 'var(--text-white)',
                                      fontWeight: wordObj.bold ? 'bold' : 'normal',
                                      fontStyle: wordObj.italic ? 'italic' : 'normal',
                                      border: isWordSelected ? '1px solid var(--primary)' : '1px solid transparent',
                                      background: isWordSelected ? 'rgba(100, 100, 255, 0.25)' : 'rgba(255,255,255,0.03)',
                                      transition: 'all 0.15s',
                                      userSelect: 'none'
                                    }}
                                    title="Double-click to style this word"
                                  >
                                    {wordObj.word}
                                  </span>
                                );
                              })}
                            </div>

                            {selectedWord && selectedWord.sceneIdx === idx && scene.words[selectedWord.wordIdx] && (
                              <div style={{ 
                                marginTop: '8px', 
                                padding: '10px', 
                                background: 'var(--bg-medium)', 
                                border: '1px solid var(--border-medium)', 
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                animation: 'fadeIn 0.15s ease-out'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold' }}>
                                    Styling word: "{scene.words[selectedWord.wordIdx].word}"
                                  </span>
                                  <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    onClick={() => setSelectedWord(null)}
                                    style={{ fontSize: '9px', padding: '2px 6px', height: 'auto', margin: 0 }}
                                  >
                                    Done
                                  </button>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {/* 1. Color Picker */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-gray)' }}>Color:</span>
                                    <input 
                                      type="color" 
                                      value={scene.words[selectedWord.wordIdx].color || '#ffffff'}
                                      onChange={(e) => updateWordStyle(idx, selectedWord.wordIdx, { color: e.target.value })}
                                      style={{ width: '22px', height: '22px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                                    />
                                    {scene.words[selectedWord.wordIdx].color && (
                                      <button 
                                        type="button" 
                                        onClick={() => updateWordStyle(idx, selectedWord.wordIdx, { color: undefined })}
                                        style={{ fontSize: '9px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 2px' }}
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>

                                  {/* 2. Font Size Offset */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-gray)' }}>Size:</span>
                                    <input 
                                      type="number" 
                                      min={8} 
                                      max={120} 
                                      value={scene.words[selectedWord.wordIdx].size || 24}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        updateWordStyle(idx, selectedWord.wordIdx, { size: isNaN(val) ? undefined : val });
                                      }}
                                      style={{ width: '48px', fontSize: '11px', background: 'var(--bg-darker)', color: 'var(--text-white)', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '2px 4px' }}
                                    />
                                    {scene.words[selectedWord.wordIdx].size && (
                                      <button 
                                        type="button" 
                                        onClick={() => updateWordStyle(idx, selectedWord.wordIdx, { size: undefined })}
                                        style={{ fontSize: '9px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 2px' }}
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>

                                  {/* 3. Bold toggle */}
                                  <button 
                                    type="button"
                                    onClick={() => updateWordStyle(idx, selectedWord.wordIdx, { bold: !scene.words[selectedWord.wordIdx].bold })}
                                    style={{ 
                                      fontSize: '11px', 
                                      fontWeight: 'bold',
                                      padding: '4px 8px', 
                                      height: 'auto',
                                      background: scene.words[selectedWord.wordIdx].bold ? 'var(--primary)' : 'var(--bg-darker)',
                                      color: 'var(--text-white)',
                                      border: '1px solid var(--border-medium)',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    B
                                  </button>

                                  {/* 4. Italic toggle */}
                                  <button 
                                    type="button"
                                    onClick={() => updateWordStyle(idx, selectedWord.wordIdx, { italic: !scene.words[selectedWord.wordIdx].italic })}
                                    style={{ 
                                      fontSize: '11px', 
                                      fontStyle: 'italic',
                                      padding: '4px 8px', 
                                      height: 'auto',
                                      background: scene.words[selectedWord.wordIdx].italic ? 'var(--primary)' : 'var(--bg-darker)',
                                      color: 'var(--text-white)',
                                      border: '1px solid var(--border-medium)',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    I
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* HUD layout Selector */}
                        <div style={{ marginTop: '4px' }}>
                          <label className="label" style={{ fontSize: '10px', marginBottom: '4px' }}>HUD Layout Card</label>
                          <select
                            className="input-field"
                            style={{ margin: 0, fontSize: '12px', height: '32px', width: '100%', background: 'var(--bg-medium)', border: '1px solid var(--border-light)', color: 'var(--text-white)' }}
                            value={scene.layout || 'full_broll'}
                            onChange={(e) => handleUpdateScene(idx, 'layout', e.target.value)}
                          >
                            <option value="full_broll">🎬 None / Full B-Roll</option>
                            <option value="versus">⚔️ Versus Battle</option>
                            <option value="quote">💬 Quote Card</option>
                            <option value="stat_callout">📊 Stat Counter</option>
                            <option value="timeline_checkpoint">📅 Timeline Node</option>
                            <option value="danger_callout">⚠️ Danger Callout</option>
                            <option value="progress_ratio">📈 Progress Ratio</option>
                            <option value="pro_tip">💡 Pro Tip</option>
                            <option value="versus_meter">⚖️ Versus Slider</option>
                            <option value="tier_list_ranker">🏆 Tier Ranker</option>
                          </select>
                        </div>

                        {/* Layout Props Form */}
                        {scene.layout && scene.layout !== 'graph' && scene.layout !== 'full_broll' && (
                          <div style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-light)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>Layout Parameters:</span>
                            
                            {scene.layout === 'quote' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Quote Text"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.quoteText || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, quoteText: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Author"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.quoteAuthor || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, quoteAuthor: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'versus' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Left Competitor"
                                    style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                                    value={scene.layoutProps?.versusLeft || ''}
                                    onChange={(e) => {
                                      const updatedProps = { ...scene.layoutProps, versusLeft: e.target.value };
                                      handleUpdateScene(idx, 'layoutProps', updatedProps);
                                    }}
                                  />
                                  <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Right Competitor"
                                    style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                                    value={scene.layoutProps?.versusRight || ''}
                                    onChange={(e) => {
                                      const updatedProps = { ...scene.layoutProps, versusRight: e.target.value };
                                      handleUpdateScene(idx, 'layoutProps', updatedProps);
                                    }}
                                  />
                                </div>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Battle Label"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.versusLabel || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, versusLabel: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Left Features (comma separated)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={Array.isArray(scene.layoutProps?.versusLeftFeatures) ? scene.layoutProps.versusLeftFeatures.join(', ') : ''}
                                  onChange={(e) => {
                                    const updatedProps = {
                                      ...scene.layoutProps,
                                      versusLeftFeatures: e.target.value.split(',').map(item => item.trim()).filter(Boolean)
                                    };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Right Features (comma separated)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={Array.isArray(scene.layoutProps?.versusRightFeatures) ? scene.layoutProps.versusRightFeatures.join(', ') : ''}
                                  onChange={(e) => {
                                    const updatedProps = {
                                      ...scene.layoutProps,
                                      versusRightFeatures: e.target.value.split(',').map(item => item.trim()).filter(Boolean)
                                    };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'stat_callout' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Stat Value (e.g. 97%)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.statValue || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, statValue: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Label (e.g. Accuracy)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.statLabel || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, statLabel: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'timeline_checkpoint' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Checkpoint Date/Step (e.g. Phase 1)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.timelineDate || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, timelineDate: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Description (e.g. Market research)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.timelineLabel || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, timelineLabel: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'danger_callout' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Caution Header (e.g. WARNING)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.dangerTitle || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, dangerTitle: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Danger alert message"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.dangerText || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, dangerText: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'progress_ratio' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <input
                                  type="number"
                                  min={0} max={100}
                                  className="input-field"
                                  placeholder="Completion % (e.g. 75)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.progressValue || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, progressValue: Number(e.target.value) };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Task Label (e.g. Rendering)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.progressLabel || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, progressLabel: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'pro_tip' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Tip Title (e.g. PRO TIP)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.tipTitle || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, tipTitle: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Actionable Tip Text"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.tipText || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, tipText: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'versus_meter' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Left Label (iOS)"
                                    style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                                    value={scene.layoutProps?.meterLeft || ''}
                                    onChange={(e) => {
                                      const updatedProps = { ...scene.layoutProps, meterLeft: e.target.value };
                                      handleUpdateScene(idx, 'layoutProps', updatedProps);
                                    }}
                                  />
                                  <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Right Label (Android)"
                                    style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                                    value={scene.layoutProps?.meterRight || ''}
                                    onChange={(e) => {
                                      const updatedProps = { ...scene.layoutProps, meterRight: e.target.value };
                                      handleUpdateScene(idx, 'layoutProps', updatedProps);
                                    }}
                                  />
                                </div>
                                <input
                                  type="number"
                                  min={0} max={100}
                                  className="input-field"
                                  placeholder="Needle Position % (0-100)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.meterValue || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, meterValue: Number(e.target.value) };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Bottom Label (e.g. Market Share)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.meterLabel || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, meterLabel: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {scene.layout === 'tier_list_ranker' && (
                              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Rank (S/A/B/C/F)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.tierRank || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, tierRank: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Item Ranked (e.g. React)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.tierItem || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, tierItem: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Bottom Label (e.g. Framework Grade)"
                                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                  value={scene.layoutProps?.tierLabel || ''}
                                  onChange={(e) => {
                                    const updatedProps = { ...scene.layoutProps, tierLabel: e.target.value };
                                    handleUpdateScene(idx, 'layoutProps', updatedProps);
                                  }}
                                />
                              </div>
                            )}

                            {/* Scene-specific Y-position and Scale adjusters */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '9.5px', color: 'var(--text-gray)' }}>Y Offset:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="range"
                                    min={0} max={60}
                                    disabled={applyHUDToAll}
                                    value={scene.layoutProps?.cardPositionY !== undefined ? Number(scene.layoutProps.cardPositionY) : cardPositionY}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (applyHUDToAll) {
                                        setCardPositionY(val);
                                        saveProjectState();
                                      } else {
                                        const updatedProps = { ...scene.layoutProps, cardPositionY: val };
                                        handleUpdateScene(idx, 'layoutProps', updatedProps);
                                      }
                                    }}
                                    style={{ width: '90px', height: '10px', accentColor: applyHUDToAll ? 'var(--text-muted)' : 'var(--primary)', cursor: applyHUDToAll ? 'not-allowed' : 'pointer' }}
                                  />
                                  <span style={{ fontSize: '9.5px', color: applyHUDToAll ? 'var(--text-muted)' : '#FFF', minWidth: '22px', textAlign: 'right' }}>
                                    {scene.layoutProps?.cardPositionY !== undefined ? scene.layoutProps.cardPositionY : cardPositionY}%
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '9.5px', color: 'var(--text-gray)' }}>Scale:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="range"
                                    min={0.5} max={1.8} step={0.05}
                                    disabled={applyHUDToAll}
                                    value={scene.layoutProps?.cardScale !== undefined ? Number(scene.layoutProps.cardScale) : cardScale}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (applyHUDToAll) {
                                        setCardScale(val);
                                        saveProjectState();
                                      } else {
                                        const updatedProps = { ...scene.layoutProps, cardScale: val };
                                        handleUpdateScene(idx, 'layoutProps', updatedProps);
                                      }
                                    }}
                                    style={{ width: '90px', height: '10px', accentColor: applyHUDToAll ? 'var(--text-muted)' : 'var(--primary)', cursor: applyHUDToAll ? 'not-allowed' : 'pointer' }}
                                  />
                                  <span style={{ fontSize: '9.5px', color: applyHUDToAll ? 'var(--text-muted)' : '#FFF', minWidth: '22px', textAlign: 'right' }}>
                                    {(scene.layoutProps?.cardScale !== undefined ? Number(scene.layoutProps.cardScale) : cardScale).toFixed(2)}x
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRegenerateHUD(idx)}
                                disabled={loading}
                                className="btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '10px', height: '22px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center', marginTop: '4px' }}
                              >
                                <span>⚡ Redo HUD</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {projectType !== 'subtitles' && (
                          <>
                            <div>
                              <label className="label" style={{ fontSize: '10px', marginBottom: '4px' }}>Assigned Video Clip</label>
                          <RichClipSelector
                            value={scene.clipId || ''}
                            onChange={(clipId) => updateSceneClip(idx, clipId)}
                            clips={clips}
                            onGenerateAi={() => openAiGenModal(idx)}
                            showOriginal={projectType === 'talkinghead' || !!originalVideoPath}
                            originalLabel={projectType === 'talkinghead' ? 'Original Video (Talking Head)' : 'Original Reel Clip'}
                            excludeBroll={true}
                          />
                        </div>

                        {selectedClip && (() => {
                          const reqDur = getRequiredSourceDuration(scene);
                          const maxStart = Math.max(0, selectedClip.duration - reqDur);
                          const isInsufficient = (scene.clipStart || 0) + reqDur > selectedClip.duration + 0.001;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-gray)' }}>
                                <span>Start offset: <strong>{(scene.clipStart || 0).toFixed(1)}s</strong></span>
                                <span>Max: {selectedClip.duration.toFixed(1)}s</span>
                              </div>
                              <input
                                type="range" min={0} max={maxStart} step={0.1}
                                value={scene.clipStart || 0}
                                onChange={(e) => updateSceneClipStart(idx, parseFloat(e.target.value))}
                                onMouseDown={() => setActiveSliderIdx(idx)}
                                onMouseUp={() => setActiveSliderIdx(null)}
                                onTouchStart={() => setActiveSliderIdx(idx)}
                                onTouchEnd={() => setActiveSliderIdx(null)}
                                style={{ width: '100%' }}
                              />

                              {/* Video Crop & Framing Controls (Zoom, Move X, Move Y, Speed) */}
                              <div style={{ marginTop: '6px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    🔍 Framing & Speed
                                  </span>
                                  {((scene.zoom || 1) !== 1 || (scene.offsetX || 0) !== 0 || (scene.offsetY || 0) !== 0 || (scene.speed || 1) !== 1) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateScene(idx, 'zoom', 1.0);
                                        handleUpdateScene(idx, 'offsetX', 0);
                                        handleUpdateScene(idx, 'offsetY', 0);
                                        handleUpdateScene(idx, 'speed', 1.0);
                                      }}
                                      style={{ fontSize: '9px', background: 'transparent', border: 'none', color: 'var(--text-gray)', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                      Reset Framing
                                    </button>
                                  )}
                                </div>

                                {/* Zoom slider */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-gray)' }}>Zoom:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                      type="range" min={0.2} max={3.0} step={0.05}
                                      value={scene.zoom || 1.0}
                                      onChange={(e) => handleUpdateScene(idx, 'zoom', parseFloat(e.target.value))}
                                      style={{ width: '90px', height: '10px', accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '10px', color: '#FFF', minWidth: '28px', textAlign: 'right' }}>
                                      {(scene.zoom || 1.0).toFixed(2)}x
                                    </span>
                                  </div>
                                </div>

                                {/* Move X slider */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-gray)' }}>Move X:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                      type="range" min={-50} max={50} step={1}
                                      value={scene.offsetX || 0}
                                      onChange={(e) => handleUpdateScene(idx, 'offsetX', parseInt(e.target.value, 10))}
                                      style={{ width: '90px', height: '10px', accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '10px', color: '#FFF', minWidth: '28px', textAlign: 'right' }}>
                                      {scene.offsetX || 0}%
                                    </span>
                                  </div>
                                </div>

                                {/* Move Y slider */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-gray)' }}>Move Y:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                      type="range" min={-50} max={50} step={1}
                                      value={scene.offsetY || 0}
                                      onChange={(e) => handleUpdateScene(idx, 'offsetY', parseInt(e.target.value, 10))}
                                      style={{ width: '90px', height: '10px', accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '10px', color: '#FFF', minWidth: '28px', textAlign: 'right' }}>
                                      {scene.offsetY || 0}%
                                    </span>
                                  </div>
                                </div>

                                {/* Speed slider */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-gray)' }}>Speed:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                      type="range" min={0.25} max={4.0} step={0.05}
                                      value={scene.speed || 1.0}
                                      onChange={(e) => handleUpdateScene(idx, 'speed', parseFloat(e.target.value))}
                                      style={{ width: '90px', height: '10px', accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '10px', color: (scene.speed || 1.0) < 1.0 ? '#fbbf24' : '#FFF', minWidth: '28px', textAlign: 'right', fontWeight: (scene.speed || 1.0) !== 1.0 ? 600 : 400 }}>
                                      {(scene.speed || 1.0).toFixed(2)}x
                                    </span>
                                  </div>
                                </div>
                                {(scene.speed || 1.0) < 1.0 && (
                                  <div style={{ fontSize: '9px', color: '#fbbf24', textAlign: 'right', marginTop: '-2px', fontStyle: 'italic' }}>
                                    ✨ Optical-Flow Slo-Mo Active
                                  </div>
                                )}
                              </div>

                              <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="checkbox" id={`speedramp-enable-${idx}`}
                                    checked={!!scene.speedRamp?.enabled}
                                    onChange={(e) => toggleSpeedRamp(idx, e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <label htmlFor={`speedramp-enable-${idx}`} style={{ fontSize: '11px', fontWeight: '500', cursor: 'pointer', color: 'var(--text-white)' }}>
                                    Enable Speed Ramping
                                  </label>
                                </div>

                                {scene.speedRamp?.enabled && (
                                  <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                      <select
                                        className="input-field"
                                        style={{ fontSize: '11px', padding: '4px 8px', height: '28px' }}
                                        value={scene.speedRamp.preset}
                                        onChange={(e) => updateSpeedRampPreset(idx, e.target.value)}
                                      >
                                        <option value="hero">Hero (2.0x → 0.5x → 2.0x)</option>
                                        <option value="slow-in">Slow-In (0.5x → 1.5x)</option>
                                        <option value="fast-in">Fast-In (2.0x → 0.5x)</option>
                                        <option value="slow-fast-slow">Slow-Fast-Slow (0.25x → 2.0x → 0.25x)</option>
                                        <option value="fast-slow-fast">Fast-Slow-Fast (2.0x → 0.25x → 2.0x)</option>
                                        <option value="custom">Custom Curve</option>
                                      </select>
                                    </div>

                                    {scene.speedRamp.preset === 'custom' && (
                                      <div style={{ padding: '6px', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                            <span>v0 (Start)</span>
                                            <span>{scene.speedRamp.v0.toFixed(2)}x</span>
                                          </div>
                                          <input
                                            type="range" min={0.25} max={4.0} step={0.05} value={scene.speedRamp.v0}
                                            onChange={(e) => updateCustomSpeed(idx, 'v0', parseFloat(e.target.value))}
                                            style={{ width: '100%' }}
                                          />
                                        </div>
                                        <div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                            <span>v1 (Mid)</span>
                                            <span>{scene.speedRamp.v1.toFixed(2)}x</span>
                                          </div>
                                          <input
                                            type="range" min={0.25} max={4.0} step={0.05} value={scene.speedRamp.v1}
                                            onChange={(e) => updateCustomSpeed(idx, 'v1', parseFloat(e.target.value))}
                                            style={{ width: '100%' }}
                                          />
                                        </div>
                                        <div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                            <span>v2 (End)</span>
                                            <span>{scene.speedRamp.v2.toFixed(2)}x</span>
                                          </div>
                                          <input
                                            type="range" min={0.25} max={4.0} step={0.05} value={scene.speedRamp.v2}
                                            onChange={(e) => updateCustomSpeed(idx, 'v2', parseFloat(e.target.value))}
                                            style={{ width: '100%' }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => applySpeedRampToAllClips(idx)}
                                      style={{
                                        fontSize: '9px', padding: '2px 6px', height: '20px', background: 'transparent',
                                        border: '1px solid var(--border-medium)', color: 'var(--text-gray)',
                                        cursor: 'pointer', borderRadius: '4px', textAlign: 'center', transition: 'all 0.15s ease'
                                      }}
                                    >
                                      Apply curve to all scenes
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="checkbox" id={`gymglow-enable-${idx}`}
                                    checked={!!scene.gymGlow?.enabled}
                                    onChange={(e) => toggleGymGlow(idx, e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <label htmlFor={`gymglow-enable-${idx}`} style={{ fontSize: '11px', fontWeight: '500', cursor: 'pointer', color: 'var(--text-white)' }}>
                                    Enable 💪 Gym Glow
                                  </label>
                                </div>

                                {scene.gymGlow?.enabled && (
                                  <div style={{ padding: '6px', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                        <span>Threshold (highlights)</span>
                                        <span>{scene.gymGlow.threshold}</span>
                                      </div>
                                      <input
                                        type="range" min={120} max={240} step={5} value={scene.gymGlow.threshold}
                                        onChange={(e) => updateGymGlowParam(idx, 'threshold', parseInt(e.target.value))}
                                        style={{ width: '100%' }}
                                      />
                                    </div>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                        <span>Glow Radius</span>
                                        <span>{scene.gymGlow.radius}px</span>
                                      </div>
                                      <input
                                        type="range" min={5} max={50} step={1} value={scene.gymGlow.radius}
                                        onChange={(e) => updateGymGlowParam(idx, 'radius', parseInt(e.target.value))}
                                        style={{ width: '100%' }}
                                      />
                                    </div>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                        <span>Intensity</span>
                                        <span>{Math.round(scene.gymGlow.opacity * 100)}%</span>
                                      </div>
                                      <input
                                        type="range" min={0.1} max={1.0} step={0.05} value={scene.gymGlow.opacity}
                                        onChange={(e) => updateGymGlowParam(idx, 'opacity', parseFloat(e.target.value))}
                                        style={{ width: '100%' }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Camera Shake */}
                              <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="checkbox" id={`shake-enable-${idx}`}
                                    checked={!!scene.shake}
                                    onChange={(e) => toggleSceneShake(idx, e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <label htmlFor={`shake-enable-${idx}`} style={{ fontSize: '11px', fontWeight: '500', cursor: 'pointer', color: 'var(--text-white)' }}>
                                    Enable Camera Shake 📳
                                  </label>
                                </div>

                                {scene.shake && (
                                  <div style={{ padding: '6px', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                        <span>Intensity (amplitude)</span>
                                        <span>{scene.shakeIntensity !== undefined ? scene.shakeIntensity : 15}px</span>
                                      </div>
                                      <input
                                        type="range" min={2} max={60} step={1} value={scene.shakeIntensity !== undefined ? scene.shakeIntensity : 15}
                                        onChange={(e) => updateSceneShakeParam(idx, 'shakeIntensity', parseInt(e.target.value))}
                                        style={{ width: '100%' }}
                                      />
                                    </div>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-gray)' }}>
                                        <span>Speed (frequency)</span>
                                        <span>{scene.shakeSpeed !== undefined ? scene.shakeSpeed : 20} Hz</span>
                                      </div>
                                      <input
                                        type="range" min={5} max={50} step={1} value={scene.shakeSpeed !== undefined ? scene.shakeSpeed : 20}
                                        onChange={(e) => updateSceneShakeParam(idx, 'shakeSpeed', parseInt(e.target.value))}
                                        style={{ width: '100%' }}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => applyShakeToAllScenes(idx)}
                                      style={{
                                        fontSize: '9px', padding: '2px 6px', height: '20px', background: 'transparent',
                                        border: '1px solid var(--border-medium)', color: 'var(--text-gray)',
                                        cursor: 'pointer', borderRadius: '4px', textAlign: 'center', transition: 'all 0.15s ease'
                                      }}
                                    >
                                      Apply shake to all scenes
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isInsufficient && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px', fontSize: '10px', marginTop: '6px' }}>
                                  <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                                  <span>Need {reqDur.toFixed(1)}s, have {(selectedClip.duration - (scene.clipStart || 0)).toFixed(1)}s.</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {idx < scenes.length - 1 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '4px' }}>
                            <div>
                              <label className="label" style={{ fontSize: '10px', marginBottom: '4px' }}>Transition Out</label>
                              <select
                                className="input-field"
                                value={scene.transition || 'none'}
                                onChange={(e) => updateSceneTransition(idx, e.target.value)}
                                style={{ margin: 0, fontSize: '11px', height: '28px', padding: '0 8px' }}
                              >
                                <option value="none">None</option>
                                <option value="fade">Fade</option>
                                <option value="slide-left">Slide Left</option>
                                <option value="slide-right">Slide Right</option>
                                <option value="slide-up">Slide Up</option>
                                <option value="slide-down">Slide Down</option>
                                <option value="zoom-in">Zoom In</option>
                                <option value="zoom-out">Zoom Out</option>
                                <option value="random">Random</option>
                              </select>
                              {scene.transition && scene.transition !== 'none' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                  <label style={{ fontSize: '9px', color: 'var(--text-gray)' }}>Duration:</label>
                                  <input
                                    type="number"
                                    min="0.1"
                                    max="2.0"
                                    step="0.1"
                                    className="input-field"
                                    value={scene.transitionDuration !== undefined ? scene.transitionDuration : transitionDuration}
                                    onChange={(e) => updateSceneTransitionDuration(idx, parseFloat(e.target.value) || 0.3)}
                                    style={{ margin: 0, fontSize: '10px', height: '22px', padding: '0 4px', width: '45px', textAlign: 'center' }}
                                  />
                                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>s</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="label" style={{ fontSize: '10px', marginBottom: '4px' }}>Transition SFX</label>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <select
                                  className="input-field"
                                  value={scene.sfx || 'none'}
                                  onChange={(e) => updateSceneSfx(idx, e.target.value)}
                                  style={{ margin: 0, fontSize: '11px', height: '28px', padding: '0 8px', flex: 1, minWidth: 0 }}
                                >
                                  <option value="none">None</option>
                                  {(sfxList.length > 0 ? sfxList : [
                                    { id: 'trans_swoosh_fast', name: 'Snappy Swoosh' },
                                    { id: 'trans_swoosh_deep', name: 'Cinematic Whoosh' },
                                    { id: 'trans_glitch_digital', name: 'Glitch / Static' },
                                    { id: 'trans_shutter_click', name: 'Shutter & Flash' },
                                    { id: 'trans_vhs_rewind', name: 'Tape Rewind' },
                                    { id: 'trans_paper_slide', name: 'Page Slide' },
                                    { id: 'reveal_pop_bubble', name: 'Bubble Pop' },
                                    { id: 'reveal_kb_click', name: 'Keyboard Tap' },
                                    { id: 'reveal_ding_bell', name: 'Snappy Ding' },
                                    { id: 'reveal_swoosh_zip', name: 'Micro Zip' },
                                    { id: 'reveal_chime_sweet', name: 'Synth Chime' },
                                    { id: 'hook_bass_drop', name: 'Sub Bass Rumble' },
                                    { id: 'hook_vinyl_scratch', name: 'Record Scratch' },
                                    { id: 'hook_metal_hit', name: 'Cinematic Metal Hit' },
                                    { id: 'hook_woosh_hit', name: 'Whoosh To Hit' },
                                    { id: 'hook_cymbal_swell', name: 'Reversed Cymbal' }
                                  ]).map(sfx => (
                                    <option key={sfx.id} value={sfx.id}>{sfx.name}</option>
                                  ))}
                                </select>
                                {scene.sfx && scene.sfx !== 'none' && (
                                  <button
                                    type="button"
                                    onClick={() => handlePlaySfx(scene.sfx!)}
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      width: '28px', height: '28px', borderRadius: '4px', border: '1px solid var(--border-light)',
                                      background: 'var(--bg-card)', color: 'var(--text-white)', cursor: 'pointer',
                                      transition: 'all 0.2s', flexShrink: 0
                                    }}
                                    title="Preview SFX"
                                  >
                                    {previewingSfx === scene.sfx ? <Pause size={12} /> : <Play size={12} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                        {scene.reason && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderLeft: '2px solid var(--primary)', paddingLeft: '8px', marginTop: '4px' }}>
                            <strong>Reason:</strong> {scene.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
        
      {/* MIDDLE: Aesthetics & Settings */}
      <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '20px' }}>
        <div style={{ position: 'sticky', top: '0px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', paddingRight: '12px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px' }}>
            {[
              { id: 'subtitles', label: 'Subtitles' },
              { id: 'video', label: 'Visuals' },
              { id: 'audio', label: 'Audio' },
              { id: 'layers', label: 'Layers' }
            ].map(t => {
              const active = sidebarTab === t.id;
              return (
                <button
                  key={t.id} type="button" onClick={() => setSidebarTab(t.id as any)}
                  style={{
                    flex: 1, padding: '16px 0', fontSize: '11px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em', background: 'transparent',
                    border: 'none', borderBottom: active ? '2px solid var(--primary)' : 'none',
                    color: active ? 'var(--text-white)' : 'var(--text-gray)', cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: SUBTITLES */}
          {sidebarTab === 'subtitles' && (
            <div style={{ animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Sticky Real-Time Preview Panel */}
              <div className="sticky-preview-container" style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                background: 'var(--bg-darker)',
                borderBottom: '1px solid var(--border-medium)',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div className="preview-canvas" style={{
                  // Pass design tokens to CSS variables
                  ['--preview-box-color' as any]: boxColor,
                  ['--preview-text-color' as any]: fontColor,
                  ['--preview-box-padding' as any]: boxPadding,
                  ['--preview-box-radius' as any]: `${boxRounding}px`,
                  ['--preview-box-color-alpha' as any]: (() => {
                    const hex = boxColor || '#8A4BF3';
                    let r = 138, g = 75, b = 243;
                    if (hex.length === 4) {
                      r = parseInt(hex[1] + hex[1], 16);
                      g = parseInt(hex[2] + hex[2], 16);
                      b = parseInt(hex[3] + hex[3], 16);
                    } else if (hex.length === 7) {
                      r = parseInt(hex.slice(1, 3), 16);
                      g = parseInt(hex.slice(3, 5), 16);
                      b = parseInt(hex.slice(5, 7), 16);
                    }
                    return `rgba(${r}, ${g}, ${b}, 0.65)`;
                  })(),
                  ['--preview-glow-color' as any]: glowColor,
                  ['--preview-outline-size' as any]: `${outlineSize}px`
                } as any}>
                  <div 
                    className={`preview-text-element preview-bg-${textBackgroundStyle} ${textAnimation !== 'none' ? `preview-anim-${textAnimation}` : ''}`}
                    style={{
                      fontFamily: fontName,
                      fontSize: `${Math.min(32, fontSize)}px`,
                      fontWeight: bold ? 'bold' : 'normal',
                      fontStyle: italic ? 'italic' : 'normal',
                      color: fontColor,
                      WebkitTextStroke: outlineSize > 0 ? `${outlineColor} ${outlineSize}px` : 'none',
                      textShadow: pop3d 
                        ? `${outlineSize + 1}px ${outlineSize + 1}px 0px ${pop3dColor}` 
                        : (shadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none')
                    }}
                  >
                    {textAnimation === 'wave' ? (
                      previewText.split('').map((char, index) => (
                        <span 
                          key={index} 
                          className="preview-anim-wave-char" 
                          style={{ animationDelay: `${index * 0.08}s` }}
                        >
                          {char === ' ' ? '\u00A0' : char}
                        </span>
                      ))
                    ) : textAnimation === 'typewriter' ? (
                      <span className="preview-anim-typewriter-container">
                        <span 
                          className="preview-anim-typewriter" 
                          style={{ animationDuration: `${Math.max(1, previewText.length * 0.08)}s` }}
                        >
                          {previewText}
                        </span>
                      </span>
                    ) : (
                      previewText
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Type custom preview word..."
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    style={{ flex: 1, height: '32px', fontSize: '12px', margin: 0 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPreviewText('Creative')}
                    style={{ height: '32px', fontSize: '11px', padding: '0 8px', flexShrink: 0 }}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <SubtitleStyleEditor
                subtitleMode={subtitleMode}
                setSubtitleMode={setSubtitleMode}
                fontName={fontName}
                setFontName={setFontName}
                fontSize={fontSize}
                setFontSize={setFontSize}
                fontColor={fontColor}
                setFontColor={setFontColor}
                outlineColor={outlineColor}
                setOutlineColor={setOutlineColor}
                outlineThickness={outlineThickness}
                setOutlineThickness={setOutlineThickness}
                bold={bold}
                setBold={setBold}
                italic={italic}
                setItalic={setItalic}
                shadow={shadow}
                setShadow={setShadow}
                highlightColor={highlightColor}
                setHighlightColor={setHighlightColor}
                showHighlightBox={showHighlightBox}
                setShowHighlightBox={setShowHighlightBox}
                boxColor={boxColor}
                setBoxColor={setBoxColor}
                boxRounding={boxRounding}
                setBoxRounding={setBoxRounding}
                textFade={textFade}
                setTextFade={setTextFade}
                textTransition={textTransition}
                setTextTransition={setTextTransition}
                textMotion={textMotion}
                setTextMotion={setTextMotion}
                activeWordScale={activeWordScale}
                setActiveWordScale={setActiveWordScale}
                wordDisplayTime={wordDisplayTime}
                setWordDisplayTime={setWordDisplayTime}
                maxWordsPerLine={maxWordsPerLine}
                setMaxWordsPerLine={setMaxWordsPerLine}
                textPositionX={textPositionX}
                setTextPositionX={setTextPositionX}
                textPositionY={textPositionY}
                setTextPositionY={setTextPositionY}
                showEmojis={showEmojis}
                setShowEmojis={setShowEmojis}
                autoEmphasis={autoEmphasis}
                setAutoEmphasis={setAutoEmphasis}
                emphasisColor={emphasisColor}
                setEmphasisColor={setEmphasisColor}
                neonGlow={neonGlow}
                setNeonGlow={setNeonGlow}
                glowColor={glowColor}
                setGlowColor={setGlowColor}
                glowBlur={glowBlur}
                setGlowBlur={setGlowBlur}
                glowDistance={glowDistance}
                setGlowDistance={setGlowDistance}
                highlightTrigger={highlightTrigger}
                setHighlightTrigger={setHighlightTrigger}
                textCase={textCase}
                setTextCase={setTextCase}
                pop3d={pop3d}
                setPop3d={setPop3d}
                pop3dColor={pop3dColor}
                setPop3dColor={setPop3dColor}
                pop3dDepth={pop3dDepth}
                setPop3dDepth={setPop3dDepth}
                letterSpacing={letterSpacing}
                setLetterSpacing={setLetterSpacing}
                wordSpacing={wordSpacing}
                setWordSpacing={setWordSpacing}
                shadowColor={shadowColor}
                setShadowColor={setShadowColor}
                shadowBlur={shadowBlur}
                setShadowBlur={setShadowBlur}
                shadowDistance={shadowDistance}
                setShadowDistance={setShadowDistance}
                shadowAngle={shadowAngle}
                setShadowAngle={setShadowAngle}
                shadowOpacity={shadowOpacity}
                setShadowOpacity={setShadowOpacity}
                normalStyle={normalStyle}
                setNormalStyle={setNormalStyle}
                highlightStyle={highlightStyle}
                setHighlightStyle={setHighlightStyle}
                emojiStyle={emojiStyle}
                setEmojiStyle={setEmojiStyle}
                headingTitle={headingTitle}
                setHeadingTitle={setHeadingTitle}
                headingFontName={headingFontName}
                setHeadingFontName={setHeadingFontName}
                headingFontSize={headingFontSize}
                setHeadingFontSize={setHeadingFontSize}
                headingFontColor={headingFontColor}
                setHeadingFontColor={setHeadingFontColor}
                headingBoxColor={headingBoxColor}
                setHeadingBoxColor={setHeadingBoxColor}
                headingPadding={headingPadding}
                setHeadingPadding={setHeadingPadding}
                showTimer={showTimer}
                setShowTimer={setShowTimer}
                headingTopOffset={headingTopOffset}
                setHeadingTopOffset={setHeadingTopOffset}
                headingLeftOffset={headingLeftOffset}
                setHeadingLeftOffset={setHeadingLeftOffset}
                headingBoxOpacity={headingBoxOpacity}
                setHeadingBoxOpacity={setHeadingBoxOpacity}
                headingTextOpacity={headingTextOpacity}
                setHeadingTextOpacity={setHeadingTextOpacity}
                brandingTheme={brandingTheme}
                setBrandingTheme={setBrandingTheme}
                seriesName={seriesName}
                setSeriesName={setSeriesName}
                episodeNumber={episodeNumber}
                setEpisodeNumber={setEpisodeNumber}
                nextEpisode={nextEpisode}
                setNextEpisode={setNextEpisode}
                scenes={scenes}
                setScenes={setScenes}
                sfxList={sfxList}
                handlePlaySfx={handlePlaySfx}
                previewingSfx={previewingSfx}
                brandPrimaryColor={brandPrimaryColor}
                setBrandPrimaryColor={setBrandPrimaryColor}
                brandSecondaryColor={brandSecondaryColor}
                setBrandSecondaryColor={setBrandSecondaryColor}
                cardPositionY={cardPositionY}
                setCardPositionY={setCardPositionY}
                cardScale={cardScale}
                setCardScale={setCardScale}
                cardFontName={cardFontName}
                setCardFontName={setCardFontName}
                showLayoutCards={showLayoutCards}
                setShowLayoutCards={setShowLayoutCards}
                applyHUDToAll={applyHUDToAll}
                setApplyHUDToAll={setApplyHUDToAll}
                textBackgroundStyle={textBackgroundStyle}
                setTextBackgroundStyle={setTextBackgroundStyle}
                textAnimation={textAnimation}
                setTextAnimation={setTextAnimation}
                boxPadding={boxPadding}
                setBoxPadding={setBoxPadding}
                outlineSize={outlineSize}
              />

              {/* Word-Specific Styles Section */}
              <div className="inspector-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Word Styling (Normal, Highlight, Emoji)</span>
                </div>
                
                {/* Tab Headers */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '6px', marginBottom: '12px' }}>
                  {(['normal', 'highlight', 'emoji'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStyleTab(tab)}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: '4px', border: 'none',
                        fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer',
                        background: styleTab === tab ? 'var(--primary)' : 'transparent',
                        color: styleTab === tab ? 'var(--text-white)' : 'var(--text-gray)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Copy-sync buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                  <button type="button" className="btn-secondary"
                    onClick={() => { setHighlightStyle({ ...normalStyle }); setEmojiStyle({ ...normalStyle }); }}
                    style={{ fontSize: '10px', padding: '4px 8px', height: 'auto' }}
                  >Copy Normal to All</button>
                  <button type="button" className="btn-secondary"
                    onClick={() => { setEmojiStyle({ ...highlightStyle }); }}
                    style={{ fontSize: '10px', padding: '4px 8px', height: 'auto' }}
                  >Copy Highlight to Emoji</button>
                </div>

                {/* Tab Contents */}
                <div>
                  {/* 1. Text Color */}
                  <div style={{ marginBottom: '12px' }}>
                    <label className="label" style={{ marginBottom: '4px', fontSize: '11px' }}>Text Color</label>
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px', height: '34px' }}>
                      <div style={{ position: 'relative', width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        <input 
                          type="color" 
                          value={styleTab === 'normal' ? normalStyle.fontColor : styleTab === 'highlight' ? highlightStyle.fontColor : emojiStyle.fontColor} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (styleTab === 'normal') { setNormalStyle({ ...normalStyle, fontColor: val }); setFontColor(val); }
                            else if (styleTab === 'highlight') { setHighlightStyle({ ...highlightStyle, fontColor: val }); setHighlightColor(val); }
                            else { setEmojiStyle({ ...emojiStyle, fontColor: val }); }
                          }} 
                          style={{ position: 'absolute', top: '-4px', left: '-4px', width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} 
                        />
                      </div>
                      <input 
                        type="text" 
                        value={(styleTab === 'normal' ? normalStyle.fontColor : styleTab === 'highlight' ? highlightStyle.fontColor : emojiStyle.fontColor).toUpperCase()} 
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                          if (styleTab === 'normal') { setNormalStyle({ ...normalStyle, fontColor: val }); setFontColor(val); }
                          else if (styleTab === 'highlight') { setHighlightStyle({ ...highlightStyle, fontColor: val }); setHighlightColor(val); }
                          else { setEmojiStyle({ ...emojiStyle, fontColor: val }); }
                        }} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-white)', fontFamily: 'monospace', fontSize: '11px', width: '100%', outline: 'none', padding: 0 }} 
                        placeholder="#FFFFFF"
                      />
                    </div>
                  </div>

                  {/* 2. Active Word Scale */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label className="label" style={{ margin: 0, fontSize: '11px' }}>Active Scale Zoom</label>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                        {(styleTab === 'normal' ? normalStyle.activeWordScale : styleTab === 'highlight' ? highlightStyle.activeWordScale : emojiStyle.activeWordScale).toFixed(2)}x
                      </span>
                    </div>
                    <input 
                      type="range" min={1.00} max={1.60} step={0.05} 
                      value={styleTab === 'normal' ? normalStyle.activeWordScale : styleTab === 'highlight' ? highlightStyle.activeWordScale : emojiStyle.activeWordScale}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (styleTab === 'normal') { setNormalStyle({ ...normalStyle, activeWordScale: val }); }
                        else if (styleTab === 'highlight') { setHighlightStyle({ ...highlightStyle, activeWordScale: val }); setActiveWordScale(val); }
                        else { setEmojiStyle({ ...emojiStyle, activeWordScale: val }); }
                      }}
                      style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                  </div>

                  {/* 3. Neon Glow */}
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💡</span>
                        <span style={{ fontSize: '11px', fontWeight: 500 }}>Glow Enabled</span>
                      </div>
                      <div 
                        className={`stitch-switch ${(styleTab === 'normal' ? normalStyle.neonGlow : styleTab === 'highlight' ? highlightStyle.neonGlow : emojiStyle.neonGlow) ? 'active' : ''}`} 
                        onClick={() => {
                          if (styleTab === 'normal') { const t = !normalStyle.neonGlow; setNormalStyle({ ...normalStyle, neonGlow: t }); setNeonGlow(t); }
                          else if (styleTab === 'highlight') { const t = !highlightStyle.neonGlow; setHighlightStyle({ ...highlightStyle, neonGlow: t }); }
                          else { const t = !emojiStyle.neonGlow; setEmojiStyle({ ...emojiStyle, neonGlow: t }); }
                        }}
                      >
                        <div className="stitch-switch-handle" />
                      </div>
                    </div>

                    {(styleTab === 'normal' ? normalStyle.neonGlow : styleTab === 'highlight' ? highlightStyle.neonGlow : emojiStyle.neonGlow) && (
                      <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Glow Color */}
                        <div>
                          <label className="label" style={{ marginBottom: '2px', fontSize: '10px' }}>Glow Color</label>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', width: '18px', height: '18px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                              <input 
                                type="color" 
                                value={styleTab === 'normal' ? normalStyle.glowColor : styleTab === 'highlight' ? highlightStyle.glowColor : emojiStyle.glowColor} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (styleTab === 'normal') { setNormalStyle({ ...normalStyle, glowColor: val }); setGlowColor(val); }
                                  else if (styleTab === 'highlight') { setHighlightStyle({ ...highlightStyle, glowColor: val }); }
                                  else { setEmojiStyle({ ...emojiStyle, glowColor: val }); }
                                }} 
                                style={{ position: 'absolute', top: '-4px', left: '-4px', width: '26px', height: '26px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} 
                              />
                            </div>
                            <input 
                              type="text" 
                              value={(styleTab === 'normal' ? normalStyle.glowColor : styleTab === 'highlight' ? highlightStyle.glowColor : emojiStyle.glowColor).toUpperCase()} 
                              onChange={(e) => {
                                let hex = e.target.value;
                                if (!hex.startsWith('#') && hex.length > 0) hex = '#' + hex;
                                if (styleTab === 'normal') { setNormalStyle({ ...normalStyle, glowColor: hex }); setGlowColor(hex); }
                                else if (styleTab === 'highlight') { setHighlightStyle({ ...highlightStyle, glowColor: hex }); }
                                else { setEmojiStyle({ ...emojiStyle, glowColor: hex }); }
                              }}
                              className="input-field"
                              style={{ flex: 1, height: '24px', padding: '2px 6px', fontSize: '10px', fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>

                        {/* Glow Blur */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                            <label className="label" style={{ fontSize: '10px', margin: 0 }}>Glow Strength (Blur)</label>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              {styleTab === 'normal' ? normalStyle.glowBlur : styleTab === 'highlight' ? highlightStyle.glowBlur : emojiStyle.glowBlur}px
                            </span>
                          </div>
                          <input 
                            type="range" min={1} max={15} step={1} 
                            value={styleTab === 'normal' ? normalStyle.glowBlur : styleTab === 'highlight' ? highlightStyle.glowBlur : emojiStyle.glowBlur} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (styleTab === 'normal') { setNormalStyle({ ...normalStyle, glowBlur: val }); setGlowBlur(val); }
                              else if (styleTab === 'highlight') { setHighlightStyle({ ...highlightStyle, glowBlur: val }); }
                              else { setEmojiStyle({ ...emojiStyle, glowBlur: val }); }
                            }}
                            style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                        </div>

                        {/* Glow Distance */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                            <label className="label" style={{ fontSize: '10px', margin: 0 }}>Glow Distance</label>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              {styleTab === 'normal' ? normalStyle.glowDistance : styleTab === 'highlight' ? highlightStyle.glowDistance : emojiStyle.glowDistance}px
                            </span>
                          </div>
                          <input 
                            type="range" min={1} max={20} step={1} 
                            value={styleTab === 'normal' ? normalStyle.glowDistance : styleTab === 'highlight' ? highlightStyle.glowDistance : emojiStyle.glowDistance} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (styleTab === 'normal') { setNormalStyle({ ...normalStyle, glowDistance: val }); setGlowDistance(val); }
                              else if (styleTab === 'highlight') { setHighlightStyle({ ...highlightStyle, glowDistance: val }); }
                              else { setEmojiStyle({ ...emojiStyle, glowDistance: val }); }
                            }}
                            style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Highlight Style Card (Conditional) */}
              {(subtitleMode === 'pop' || subtitleMode === 'centered-word' || subtitleMode === 'smart-highlight') && (
                <div className="inspector-card">
                  <div className="inspector-sub-title">Highlight Word Style</div>

                  <div style={{ marginBottom: '10px' }}>
                    <label className="label">Highlight Trigger Mode</label>
                    <select
                      value={highlightTrigger}
                      onChange={(e) => setHighlightTrigger(e.target.value as any)}
                      className="input-field"
                      style={{ width: '100%', height: '34px', fontSize: '12px', background: 'var(--bg-surface)' }}
                    >
                      <option value="all">Highlight Every Word (Standard)</option>
                      <option value="emphasis">Highlight Emphasis/Highlight Words Only</option>
                      <option value="emoji">Highlight Emoji Words Only</option>
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <label className="label">Highlight Word Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} />
                      <input 
                        type="text" value={highlightColor.toUpperCase()} 
                        onChange={(e) => {
                          let val = e.target.value;
                          if (val.startsWith('#') && val.length <= 7) setHighlightColor(val);
                          else if (val.length <= 6 && !val.startsWith('#')) setHighlightColor('#' + val);
                        }}
                        className="input-field"
                        style={{ width: '90px', height: '28px', padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center' }}
                      />
                    </div>
                  </div>

                  {(subtitleMode === 'pop' || subtitleMode === 'centered-word') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <input 
                        type="checkbox" id="show-bg-box" checked={showHighlightBox} 
                        onChange={(e) => setShowHighlightBox(e.target.checked)} 
                      />
                      <label htmlFor="show-bg-box" style={{ fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                        Show Word Background Box
                      </label>
                    </div>
                  )}

                  {(subtitleMode === 'pop' || subtitleMode === 'centered-word') && showHighlightBox && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '8px' }}>
                      <div>
                        <label className="label">Background Box Color</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="color" value={boxColor} onChange={(e) => setBoxColor(e.target.value)} />
                          <input 
                            type="text" value={boxColor.toUpperCase()} 
                            onChange={(e) => {
                              let val = e.target.value;
                              if (val.startsWith('#') && val.length <= 7) setBoxColor(val);
                              else if (val.length <= 6 && !val.startsWith('#')) setBoxColor('#' + val);
                            }}
                            className="input-field"
                            style={{ width: '90px', height: '28px', padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center' }}
                          />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <label className="label" style={{ margin: 0 }}>Box Corner Rounding</label>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{boxRounding}px</span>
                        </div>
                        <input
                          type="range" min={0} max={24} value={boxRounding}
                          onChange={(e) => setBoxRounding(parseInt(e.target.value, 10))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Text Animations Card */}
              <div className="inspector-card">
                <div className="inspector-sub-title">Text Animations & Effects</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="checkbox" id="fade-transition" checked={textFade} 
                    onChange={(e) => setTextFade(e.target.checked)} 
                  />
                  <label htmlFor="fade-transition" style={{ fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    In/Out Fade (150ms)
                  </label>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="label">In/Out Transition</label>
                  <select className="input-field" value={textTransition} onChange={(e) => setTextTransition(e.target.value)}>
                    <option value="none">None (Stationary Entrance/Exit)</option>
                    <option value="slide-up">Slide Up (No Fade)</option>
                    <option value="slide-up-fade">Slide Up & Fade</option>
                    <option value="slide-down">Slide Down (No Fade)</option>
                    <option value="slide-down-fade">Slide Down & Fade</option>
                    <option value="slide-left">Slide Left (No Fade)</option>
                    <option value="slide-left-fade">Slide Left & Fade</option>
                    <option value="slide-right">Slide Right (No Fade)</option>
                    <option value="slide-right-fade">Slide Right & Fade</option>
                    <option value="slide-up-blur">Slide Up with Blur (No Fade)</option>
                    <option value="slide-up-blur-fade">Slide Up with Blur & Fade</option>
                    <option value="slide-down-blur">Slide Down with Blur (No Fade)</option>
                    <option value="slide-down-blur-fade">Slide Down with Blur & Fade</option>
                    <option value="slide-left-blur">Slide Left with Blur (No Fade)</option>
                    <option value="slide-left-blur-fade">Slide Left with Blur & Fade</option>
                    <option value="slide-right-blur">Slide Right with Blur (No Fade)</option>
                    <option value="slide-right-blur-fade">Slide Right with Blur & Fade</option>
                    <option value="zoom-in-out">Snappy Zoom In / Zoom Out (No Fade)</option>
                    <option value="zoom-in-out-fade">Snappy Zoom In / Zoom Out & Fade</option>
                    <option value="zoom-in-out-blur">Zoom In / Zoom Out with Blur (No Fade)</option>
                    <option value="zoom-in-out-blur-fade">Zoom In / Zoom Out with Blur & Fade</option>
                  </select>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="label">Stay Animation (Motion)</label>
                  <select className="input-field" value={textMotion} onChange={(e) => setTextMotion(e.target.value)}>
                    <option value="none">None (Stationary)</option>
                    <option value="float">Floating Text (Slow Rise)</option>
                  </select>
                </div>

                {(subtitleMode === 'pop' || subtitleMode === 'centered-word' || subtitleMode === 'smart-highlight') && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label className="label" style={{ margin: 0 }}>Active Word Zoom Bump</label>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{activeWordScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range" min={1.00} max={1.40} step={0.05} value={activeWordScale}
                      onChange={(e) => setActiveWordScale(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {subtitleMode === 'smart-highlight' && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label className="label" style={{ margin: 0 }}>Max Words Per Line</label>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{maxWordsPerLine} words</span>
                    </div>
                    <input
                      type="range" min={1} max={15} step={1} value={maxWordsPerLine}
                      onChange={(e) => setMaxWordsPerLine(parseInt(e.target.value, 10))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {subtitleMode === 'pop' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label className="label" style={{ margin: 0 }}>Word Display Time</label>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{wordDisplayTime.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range" min={0.3} max={3.0} step={0.1} value={wordDisplayTime}
                      onChange={(e) => setWordDisplayTime(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>

              {/* Engagement Cards (Retention Styles) */}
              <div className="inspector-card">
                <div className="inspector-sub-title">Retention Features</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>😊</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'Inter' }}>Emoji Pop</span>
                    </div>
                    <div className={`stitch-switch ${showEmojis ? 'active' : ''}`} onClick={() => setShowEmojis(!showEmojis)}>
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🧱</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'Inter' }}>3D Extrusion</span>
                    </div>
                    <div className={`stitch-switch ${pop3d ? 'active' : ''}`} onClick={() => setPop3d(!pop3d)}>
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Emoji Word SFX Mappings */}
              {(() => {
                const emojiWordsList: {
                  sceneIdx: number;
                  wordIdx: number;
                  wordObj: WordTiming;
                  emoji: string;
                }[] = [];
                scenes.forEach((scene, sceneIdx) => {
                  if (scene.words && Array.isArray(scene.words)) {
                    scene.words.forEach((wordObj, wordIdx) => {
                      const emoji = getWordEmoji(wordObj.word);
                      if (emoji) {
                        emojiWordsList.push({
                          sceneIdx,
                          wordIdx,
                          wordObj,
                          emoji
                        });
                      }
                    });
                  }
                });

                const handleUpdateWordSfx = (sIdx: number, wIdx: number, sfxId: string) => {
                  const updatedScenes = [...scenes];
                  if (updatedScenes[sIdx] && updatedScenes[sIdx].words && updatedScenes[sIdx].words![wIdx]) {
                    updatedScenes[sIdx].words![wIdx].sfx = sfxId;
                    setScenes(updatedScenes);
                  }
                };

                if (!showEmojis || emojiWordsList.length === 0) return null;

                return (
                  <div className="inspector-card" style={{ marginTop: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
                    <div className="inspector-sub-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🎵 Emoji Word SFX Mappings</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>{emojiWordsList.length} detected</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginBottom: '10px' }}>
                      Play sound effects exactly when these key emoji words are spoken.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                      {emojiWordsList.map(({ sceneIdx, wordIdx, wordObj, emoji }) => {
                        const displayWord = wordObj.word;
                        const selectedSfx = wordObj.sfx || 'none';
                        return (
                          <div key={`${sceneIdx}_${wordIdx}`} style={{ 
                            display: 'flex', flexDirection: 'column', gap: '4px',
                            background: 'var(--bg-darker)', border: '1px solid var(--border-medium)', 
                            borderRadius: '4px', padding: '8px 10px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
                              <span>"{displayWord}" {emoji}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Scene {sceneIdx + 1} at {wordObj.start_time.toFixed(1)}s</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              <select
                                value={selectedSfx}
                                onChange={(e) => handleUpdateWordSfx(sceneIdx, wordIdx, e.target.value)}
                                className="input-field"
                                style={{ flex: 1, height: '28px', fontSize: '11px', padding: '0 6px', background: 'var(--bg-medium)' }}
                              >
                                <option value="none">No Sound Effect</option>
                                {sfxList.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              {selectedSfx !== 'none' && (
                                <button
                                  type="button"
                                  onClick={() => handlePlaySfx(selectedSfx)}
                                  style={{
                                    background: 'var(--bg-medium)', border: 'none', 
                                    color: 'var(--text-white)', width: '28px', height: '28px',
                                    borderRadius: '4px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: 'pointer', padding: 0
                                  }}
                                >
                                  {previewingSfx === selectedSfx ? '⏹' : '▶'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}



          {/* TAB 2: VIDEO */}
          {sidebarTab === 'video' && (
            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div className="inspector-card">
                <div className="inspector-sub-title">Canvas & Formatting</div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="label">Aspect Ratio</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {[
                      { id: '9:16', label: '9:16 Vertical', desc: 'Shorts' },
                      { id: '16:9', label: '16:9 Wide', desc: 'Youtube' },
                      { id: '1:1', label: '1:1 Square', desc: 'Feed' }
                    ].map(r => (
                      <button
                        key={r.id} type="button"
                        className={aspectRatio === r.id ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setAspectRatio(r.id as any)}
                        style={{ fontSize: '11px', padding: '8px 4px', flexDirection: 'column', height: 'auto', gap: '2px', justifyContent: 'center' }}
                      >
                        <span style={{ fontWeight: 600 }}>{r.id}</span>
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Landscape Clip Fit</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button" className={fillMode === 'crop' ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setFillMode('crop')} style={{ fontSize: '11px', padding: '8px 4px', justifyContent: 'center' }}
                      title="Crop center of landscape videos to fill vertical screen"
                    >
                      Crop & Fill
                    </button>
                    <button
                      type="button" className={fillMode === 'fit' ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setFillMode('fit')} style={{ fontSize: '11px', padding: '8px 4px', justifyContent: 'center' }}
                      title="Fit whole video in center with black bars"
                    >
                      Fit Letterbox
                    </button>
                  </div>
                </div>
              </div>

              <div className="inspector-card">
                <div className="inspector-sub-title">Transitions & Motion</div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="label">Scene Transition</label>
                  <select className="input-field" value={clipTransition} onChange={(e) => setClipTransition(e.target.value)}>
                    <option value="none">None (Hard Cut)</option>
                    <option value="fade">Fade Transition (0.25s)</option>
                    <optgroup label="Slide Transitions">
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-left-fade">Slide Left & Fade</option>
                      <option value="slide-right">Slide Right</option>
                      <option value="slide-right-fade">Slide Right & Fade</option>
                      <option value="slide-up">Slide Up</option>
                      <option value="slide-up-fade">Slide Up & Fade</option>
                      <option value="slide-down">Slide Down</option>
                      <option value="slide-down-fade">Slide Down & Fade</option>
                    </optgroup>
                    <optgroup label="Blurred Slide Transitions">
                      <option value="blur-slide-left">Blurred Slide Left</option>
                      <option value="blur-slide-left-fade">Blurred Slide Left & Fade</option>
                      <option value="blur-slide-right">Blurred Slide Right</option>
                      <option value="blur-slide-right-fade">Blurred Slide Right & Fade</option>
                      <option value="blur-slide-up">Blurred Slide Up</option>
                      <option value="blur-slide-up-fade">Blurred Slide Up & Fade</option>
                      <option value="blur-slide-down">Blurred Slide Down</option>
                      <option value="blur-slide-down-fade">Blurred Slide Down & Fade</option>
                    </optgroup>
                    <optgroup label="Pan Transitions">
                      <option value="pan-left">Pan Left</option>
                      <option value="pan-left-fade">Pan Left & Fade</option>
                      <option value="pan-right">Pan Right</option>
                      <option value="pan-right-fade">Pan Right & Fade</option>
                      <option value="pan-up">Pan Up</option>
                      <option value="pan-up-fade">Pan Up & Fade</option>
                      <option value="pan-down">Pan Down</option>
                      <option value="pan-down-fade">Pan Down & Fade</option>
                    </optgroup>
                    <optgroup label="Blurred Pan Transitions">
                      <option value="blur-pan-left">Blurred Pan Left</option>
                      <option value="blur-pan-left-fade">Blurred Pan Left & Fade</option>
                      <option value="blur-pan-right">Blurred Pan Right</option>
                      <option value="blur-pan-right-fade">Blurred Pan Right & Fade</option>
                      <option value="blur-pan-up">Blurred Pan Up</option>
                      <option value="blur-pan-up-fade">Blurred Pan Up & Fade</option>
                      <option value="blur-pan-down">Blurred Pan Down</option>
                      <option value="blur-pan-down-fade">Blurred Pan Down & Fade</option>
                    </optgroup>
                    <optgroup label="Zoom Transitions">
                      <option value="zoom-in">Zoom In</option>
                      <option value="zoom-in-fade">Zoom In & Fade</option>
                      <option value="zoom-out">Zoom Out</option>
                      <option value="zoom-out-fade">Zoom Out & Fade</option>
                      <option value="blur-zoom-in">Blurred Zoom In</option>
                      <option value="blur-zoom-in-fade">Blurred Zoom In & Fade</option>
                      <option value="blur-zoom-out">Blurred Zoom Out</option>
                      <option value="blur-zoom-out-fade">Blurred Zoom Out & Fade</option>
                    </optgroup>
                    <option value="random">Random Transition Mix</option>
                  </select>
                </div>

                {clipTransition !== 'none' && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label className="label" style={{ margin: 0 }}>Transition Duration</label>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{transitionDuration.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range" min="0.1" max="1.0" step="0.1" value={transitionDuration}
                      onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleApplyTransitionsToAll}
                    style={{ fontSize: '11px', width: '100%', justifyContent: 'center', padding: '6px' }}
                  >
                    Apply Current to All Scenes
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="zoom-ken-burns" checked={zoomAnimation} onChange={(e) => setZoomAnimation(e.target.checked)} />
                  <label htmlFor="zoom-ken-burns" style={{ fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    Enable Ken Burns Zoom In Animation
                  </label>
                </div>
              </div>

              <div className="inspector-card">
                <div className="inspector-sub-title">Export Settings</div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="label">Export Resolution</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {(['1080p', '2k', '4k'] as const).map(res => (
                      <button
                        key={res} type="button" className={exportResolution === res ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setExportResolution(res)} style={{ fontSize: '11px', padding: '6px', justifyContent: 'center' }}
                      >
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Export Frame Rate</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {([24, 30, 60] as const).map(fps => (
                      <button
                        key={fps} type="button" className={exportFps === fps ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setExportFps(fps)} style={{ fontSize: '11px', padding: '6px', justifyContent: 'center' }}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO */}
          {sidebarTab === 'audio' && (
            <div style={{ animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 1. Voiceover */}
              <div className="inspector-card">
                <div className="inspector-sub-title">Voiceover Track</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-gray)' }}>Mute Voiceover</span>
                    <div 
                      className={`stitch-switch ${muteVoiceover ? 'active' : ''}`} 
                      onClick={() => setMuteVoiceover(!muteVoiceover)}
                    >
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>
                  
                  {!muteVoiceover && (
                    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Volume</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{Math.round(voiceoverVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min={0.0} max={1.5} step={0.05} value={voiceoverVolume}
                        onChange={(e) => setVoiceoverVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Video Clips original audio */}
              <div className="inspector-card">
                <div className="inspector-sub-title">Video Clip Audio</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-gray)' }}>Mute Original Video Audio</span>
                    <div 
                      className={`stitch-switch ${muteVideoAudio ? 'active' : ''}`} 
                      onClick={() => setMuteVideoAudio(!muteVideoAudio)}
                    >
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>
                  
                  {!muteVideoAudio && (
                    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Volume</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{Math.round(videoVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min={0.0} max={1.0} step={0.05} value={videoVolume}
                        onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Transition SFX Audio */}
              <div className="inspector-card">
                <div className="inspector-sub-title">Transition SFX Audio</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-gray)' }}>Mute Sound Effects (SFX)</span>
                    <div 
                      className={`stitch-switch ${muteSfx ? 'active' : ''}`} 
                      onClick={() => setMuteSfx(!muteSfx)}
                    >
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>
                  
                  {!muteSfx && (
                    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Volume</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{Math.round(sfxVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min={0.0} max={1.0} step={0.05} value={sfxVolume}
                        onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Background Music */}
              <div className="inspector-card">
                <div className="inspector-sub-title">Background Music</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-gray)' }}>Mute BG Music</span>
                    <div 
                      className={`stitch-switch ${muteBgMusic ? 'active' : ''}`} 
                      onClick={() => setMuteBgMusic(!muteBgMusic)}
                    >
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>

                  <div style={{ marginBottom: '4px' }}>
                    <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>BGM Source</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button" className={bgmSource === 'library' ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setBgmSource('library')} style={{ fontSize: '11px', padding: '6px', justifyContent: 'center' }}
                      >
                        From Library
                      </button>
                      <button
                        type="button" className={bgmSource === 'custom' ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setBgmSource('custom')} style={{ fontSize: '11px', padding: '6px', justifyContent: 'center' }}
                      >
                        Custom Path
                      </button>
                    </div>
                  </div>

                  {bgmSource === 'library' ? (
                    <div>
                      <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>Select BGM Track</label>
                      <select className="input-field" value={bgMusicPath} onChange={(e) => setBgMusicPath(e.target.value)} style={{ fontSize: '12px', height: '34px' }}>
                        <option value="">-- No Background Music --</option>
                        {bgms.map(bgm => (
                          <option key={bgm.id} value={bgm.path}>
                            {bgm.name} ({bgm.duration ? `${Math.floor(bgm.duration / 60)}:${String(Math.floor(bgm.duration % 60)).padStart(2, '0')}` : '?'})
                          </option>
                        ))}
                      </select>
                      {bgms.length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                          No tracks imported yet. Go to Music Library tab to import BGMs.
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>Custom Audio File Path</label>
                      <input
                        type="text" className="input-field" placeholder="e.g. /path/to/bg_music.mp3"
                        value={bgMusicPath} onChange={(e) => setBgMusicPath(e.target.value)} style={{ fontSize: '12px', height: '34px' }}
                      />
                    </div>
                  )}

                  {!muteBgMusic && bgMusicPath && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', animation: 'fadeIn 0.2s ease-out' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>BG Music Volume</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{Math.round(bgMusicVolume * 100)}%</span>
                        </div>
                        <input
                          type="range" min={0.0} max={0.5} step={0.01} value={bgMusicVolume}
                          onChange={(e) => setBgMusicVolume(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Start Offset (skip intro)</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{bgMusicStartOffset}s</span>
                        </div>
                        <input
                          type="range" min={0} max={300} step={1} value={bgMusicStartOffset}
                          onChange={(e) => setBgMusicStartOffset(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LAYERS */}
          {sidebarTab === 'layers' && (
            <div style={{ animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* SECTION 1: BACKGROUND LAYER */}
              <div className="inspector-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Layers size={14} style={{ color: 'var(--accent-blue)' }} />
                  <div className="inspector-sub-title" style={{ margin: 0 }}>Background Layer (Deep Back)</div>
                </div>
                
                <div style={{ marginBottom: '14px' }}>
                  <label className="label">Background Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {(['none', 'image', 'video'] as const).map(t => (
                      <button
                        key={t} type="button"
                        className={backgroundType === t ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setBackgroundType(t)}
                        style={{
                          fontSize: '11px',
                          padding: '6px 0',
                          justifyContent: 'center',
                          textTransform: 'capitalize',
                          fontWeight: backgroundType === t ? 'bold' : 'normal',
                          background: backgroundType === t ? 'var(--primary)' : 'rgba(255, 255, 255, 0.02)',
                          borderColor: backgroundType === t ? 'var(--primary)' : 'var(--border-light)'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="label">Mat / Fallback Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        style={{
                          width: '36px',
                          height: '36px',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          background: 'transparent',
                          padding: 0
                        }}
                      />
                      <input
                        type="text"
                        className="input-field"
                        value={backgroundColor.toUpperCase()}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        style={{ width: '100px', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  {backgroundType !== 'none' && (
                    <div>
                      <label className="label">Select {backgroundType === 'image' ? 'Image' : 'Video'} Clip</label>
                      <select
                        className="input-field"
                        value={backgroundClipId}
                        onChange={(e) => setBackgroundClipId(e.target.value)}
                        style={{ fontSize: '12px', height: '34px' }}
                      >
                        <option value="">-- Choose Background Clip --</option>
                        {clips.map(clip => (
                          <option key={clip.id} value={clip.id}>
                            {clip.name} ({clip.duration.toFixed(1)}s)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: TALKING HEAD LAYER */}
              <div className="inspector-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Video size={14} style={{ color: 'var(--accent-purple)' }} />
                    <div className="inspector-sub-title" style={{ margin: 0 }}>Talking Head Layer (Top)</div>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={talkingHeadEnabled}
                      onChange={(e) => setTalkingHeadEnabled(e.target.checked)}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: '34px',
                      height: '20px',
                      background: talkingHeadEnabled ? 'var(--accent-purple)' : 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      position: 'relative',
                      transition: 'background-color 0.2s ease'
                    }}>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        background: '#ffffff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '3px',
                        left: talkingHeadEnabled ? '17px' : '3px',
                        transition: 'left 0.2s ease'
                      }} />
                    </div>
                  </label>
                </div>

                {talkingHeadEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                    
                    {/* Chroma Key Settings */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <div className="label" style={{ fontWeight: 600, color: 'var(--text-white)', marginBottom: '8px' }}>Chroma Key Removal</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label className="label">Key Color (Green Screen)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="color"
                              value={talkingHeadChromaColor}
                              onChange={(e) => setTalkingHeadChromaColor(e.target.value)}
                              style={{
                                width: '36px',
                                height: '36px',
                                border: '1px solid var(--border-medium)',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                background: 'transparent',
                                padding: 0
                              }}
                            />
                            <input
                              type="text"
                              className="input-field"
                              value={talkingHeadChromaColor.toUpperCase()}
                              onChange={(e) => setTalkingHeadChromaColor(e.target.value)}
                              style={{ width: '100px', fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <label className="label" style={{ margin: 0 }}>Similarity</label>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{talkingHeadChromaSimilarity.toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min={0.01} max={0.5} step={0.01}
                            value={talkingHeadChromaSimilarity}
                            onChange={(e) => setTalkingHeadChromaSimilarity(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <label className="label" style={{ margin: 0 }}>Blend Edge</label>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{talkingHeadChromaBlend.toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min={0.01} max={0.3} step={0.01}
                            value={talkingHeadChromaBlend}
                            onChange={(e) => setTalkingHeadChromaBlend(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Scale and Position */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <div className="label" style={{ fontWeight: 600, color: 'var(--text-white)', marginBottom: '8px' }}>Layout & Scaling</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <label className="label" style={{ margin: 0 }}>Base Size</label>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{talkingHeadSize}%</span>
                          </div>
                          <input
                            type="range" min={10} max={100} step={1}
                            value={talkingHeadSize}
                            onChange={(e) => setTalkingHeadSize(parseInt(e.target.value, 10))}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <label className="label">Overlay Position Preset</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                            {(['top-left', 'center', 'top-right', 'bottom-left', 'custom', 'bottom-right'] as const).map(pos => (
                              <button
                                key={pos} type="button"
                                className={talkingHeadPosition === pos ? 'btn-primary' : 'btn-secondary'}
                                onClick={() => setTalkingHeadPosition(pos)}
                                style={{
                                  fontSize: '10px',
                                  padding: '6px 2px',
                                  justifyContent: 'center',
                                  fontWeight: talkingHeadPosition === pos ? 'bold' : 'normal',
                                  background: talkingHeadPosition === pos ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.02)',
                                  borderColor: talkingHeadPosition === pos ? 'var(--accent-purple)' : 'var(--border-light)',
                                  color: 'var(--text-white)'
                                }}
                              >
                                {pos.replace('-', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {talkingHeadPosition === 'custom' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <label className="label" style={{ margin: 0 }}>Position X</label>
                                <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{talkingHeadPositionX}%</span>
                              </div>
                              <input
                                type="range" min={0} max={100} step={1}
                                value={talkingHeadPositionX}
                                onChange={(e) => setTalkingHeadPositionX(parseInt(e.target.value, 10))}
                                style={{ width: '100%' }}
                              />
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <label className="label" style={{ margin: 0 }}>Position Y</label>
                                <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{talkingHeadPositionY}%</span>
                              </div>
                              <input
                                type="range" min={0} max={100} step={1}
                                value={talkingHeadPositionY}
                                onChange={(e) => setTalkingHeadPositionY(parseInt(e.target.value, 10))}
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mask Outline Settings */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div className="label" style={{ fontWeight: 600, color: 'var(--text-white)', margin: 0 }}>Boundary Outline</div>
                        <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={talkingHeadOutlineEnabled}
                            onChange={(e) => setTalkingHeadOutlineEnabled(e.target.checked)}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            width: '30px',
                            height: '16px',
                            background: talkingHeadOutlineEnabled ? 'var(--accent-purple)' : 'rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            position: 'relative',
                            transition: 'background-color 0.2s ease'
                          }}>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              background: '#ffffff',
                              borderRadius: '50%',
                              position: 'absolute',
                              top: '2px',
                              left: talkingHeadOutlineEnabled ? '16px' : '2px',
                              transition: 'left 0.2s ease'
                            }} />
                          </div>
                        </label>
                      </div>

                      {talkingHeadOutlineEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.2s ease-out' }}>
                          <div>
                            <label className="label">Outline Color</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="color"
                                value={talkingHeadOutlineColor}
                                onChange={(e) => setTalkingHeadOutlineColor(e.target.value)}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  border: '1px solid var(--border-medium)',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  background: 'transparent',
                                  padding: 0
                                }}
                              />
                              <input
                                type="text"
                                className="input-field"
                                value={talkingHeadOutlineColor.toUpperCase()}
                                onChange={(e) => setTalkingHeadOutlineColor(e.target.value)}
                                style={{ width: '100px', fontFamily: 'monospace' }}
                              />
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <label className="label" style={{ margin: 0 }}>Thickness</label>
                              <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{talkingHeadOutlineThickness}px</span>
                            </div>
                            <input
                              type="range" min={1} max={5} step={1}
                              value={talkingHeadOutlineThickness}
                              onChange={(e) => setTalkingHeadOutlineThickness(parseInt(e.target.value, 10))}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compile Button - Pinned at bottom of sidebar */}
          <div style={{
            borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '20px',
            background: 'var(--bg-card)', position: 'sticky', bottom: 0, zIndex: 10
          }}>
            {hasSplicingError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', fontSize: '11px', marginBottom: '12px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>One or more scenes have insufficient source footage. Adjust offsets or speed ramps.</span>
              </div>
            )}
            <button
              onClick={handleCompileVideo}
              disabled={loading || scenes.length === 0 || scenes.some(s => !s.clipId) || hasSplicingError}
              style={{
                width: '100%', background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '14px 0',
                borderRadius: '12px', fontWeight: 900, textTransform: 'uppercase',
                letterSpacing: '-0.03em', fontSize: '13px', border: 'none', cursor: 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.boxShadow = '0 0 15px var(--glow-color)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Zap size={14} fill="var(--primary-foreground)" />
              {loading ? 'Submitting render...' : 'Generate Video'}
            </button>
          </div>

        </div>
      </div>

      {/* RIGHT: Live Video Preview */}
      <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '20px' }}>
        <div style={{ position: 'sticky', top: '0px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
          {/* Real-time Video Preview Player */}
          {scenes.length > 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={14} style={{ color: 'var(--primary)' }} />
                Real-Time Video Preview
              </div>
              <div style={{ 
                height: 'calc(100vh - 120px)',
                maxHeight: 'calc(100vh - 120px)',
                aspectRatio: aspectRatio === '9:16' ? '9/16' : aspectRatio === '1:1' ? '1/1' : '16/9', 
                maxWidth: aspectRatio === '16:9' ? '450px' : 'none',
                borderRadius: '12px', 
                overflow: 'hidden', 
                background: '#000000',
                border: '1px solid var(--border-medium)',
                position: 'relative'
              }}>
                <PlayerErrorBoundary componentName="CreateProject-RemotionPlayer">
                  <Player
                    ref={playerRef}
                    component={VideoReel as React.ComponentType<any>}
                    inputProps={{
                      scenes: scenes.map(s => ({
                        ...s,
                        clipUrl: s.clipId === 'original' 
                          ? originalVideoUrl 
                          : (s.clipId ? `/api/clips/${s.clipId}/video` : null)
                      })),
                      voiceoverUrl,
                      voiceoverVolume: muteVoiceover ? 0.0 : voiceoverVolume,
                      bgMusicUrl: bgMusicPath,
                      bgMusicVolume: muteBgMusic ? 0.0 : bgMusicVolume,
                      videoVolume: muteVideoAudio ? 0.0 : videoVolume,
                      sfxVolume: muteSfx ? 0.0 : sfxVolume,
                      subtitleMode,
                      fontName,
                      fontSize,
                      bold,
                      italic,
                      shadow,
                      activeWordScale,
                      normalStyle,
                      highlightStyle,
                      emojiStyle,
                      aspectRatio,
                      fillMode,
                      textPositionX,
                      textPositionY,
                      maxWordsPerLine,
                      highlightTrigger,
                      textCase,
                      autoEmphasis,
                      pop3d,
                      pop3dColor,
                      pop3dDepth,
                      letterSpacing,
                      wordSpacing,
                      shadowColor,
                      shadowBlur,
                      shadowDistance,
                      shadowAngle,
                      shadowOpacity,
                      outlineColor,
                      neonGlow,
                      glowColor,
                      glowBlur,
                      glowDistance,
                      textAnimation,
                      baseUrl: window.location.port ? window.location.origin.replace(window.location.port, '8000') : window.location.origin,
                      subtitlesOnly: projectType === 'subtitles',
                      brandPrimaryColor,
                      brandSecondaryColor,
                      cardPositionY,
                      cardScale,
                      cardFontName,
                      showLayoutCards,
                      applyHUDToAll,
                    }}
                    durationInFrames={Math.max(1, Math.round((scenes[scenes.length - 1]?.end_time || 30) * 30))}
                    fps={30}
                    compositionWidth={aspectRatio === '16:9' ? 1920 : 1080}
                    compositionHeight={aspectRatio === '9:16' ? 1920 : 1080}
                    style={{
                      width: '100%',
                      height: '100%',
                      maxHeight: '100%'
                    }}
                    controls
                    logLevel="trace"
                  />
                </PlayerErrorBoundary>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate AI Clip Modal */}
      {showAiGenModal && (
        <div className="modal-overlay" onClick={() => setShowAiGenModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sparkles size={16} color="var(--primary)" fill="var(--primary)" />
              Generate AI Clip for Scene
            </h3>
            
            {aiGenError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                {aiGenError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="label">AI Generation Prompt</label>
              <textarea
                className="input-field"
                value={aiGenPrompt}
                onChange={(e) => setAiGenPrompt(e.target.value)}
                placeholder="Describe what you want to see in this scene..."
                style={{ height: '100px', fontSize: '12px', resize: 'vertical' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Tip: Describe details like visual action, objects, lighting, and setting. If you have uploaded a Subject Profile, their face will be referenced.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label className="label">Format Type</label>
                <select
                  className="input-field"
                  value={aiGenType}
                  onChange={(e: any) => setAiGenType(e.target.value)}
                  style={{ height: '36px', fontSize: '12px' }}
                >
                  <option value="video">Motion Video (Ken Burns Pan)</option>
                  <option value="image">Static Image (Still Loop)</option>
                </select>
              </div>

              <div>
                <label className="label">Duration (seconds)</label>
                <input
                  type="number"
                  className="input-field"
                  value={aiGenDuration}
                  onChange={(e) => setAiGenDuration(parseFloat(e.target.value) || 5)}
                  min={1}
                  max={15}
                  step={0.1}
                  style={{ height: '36px', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAiGenModal(false)}
                disabled={aiGenLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleGenerateAiClip}
                disabled={aiGenLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {aiGenLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate & Assign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Split Scene Modal */}
      {splitModalSceneIdx !== null && scenes[splitModalSceneIdx] && (() => {
        const scene = scenes[splitModalSceneIdx];
        const totalDuration = Number((scene.end_time - scene.start_time || 2.0).toFixed(2));
        const part1Dur = Number(Math.max(0.1, Math.min(splitPointSeconds, totalDuration - 0.1)).toFixed(2));
        const part2Dur = Number((totalDuration - part1Dur).toFixed(2));

        return (
          <div className="modal-backdrop" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease'
          }}>
            <div className="glass-panel" style={{
              width: '520px', maxWidth: '92vw', padding: '28px', borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scissors size={18} style={{ color: 'var(--accent-purple)' }} />
                  Split Scene #{splitModalSceneIdx + 1}
                </h3>
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setSplitModalSceneIdx(null)}>
                  ✕
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Original Scene Duration</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{totalDuration}s</div>
                {scene.text && (
                  <div style={{ fontSize: '12px', color: 'var(--text-gray)', marginTop: '6px', fontStyle: 'italic' }}>
                    "{scene.text.length > 80 ? scene.text.substring(0, 80) + '...' : scene.text}"
                  </div>
                )}
              </div>

              {/* Preset Quick Split Buttons */}
              <div style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontSize: '12px', marginBottom: '8px' }}>Quick Split Presets</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setSplitPointSeconds(Number((totalDuration / 2).toFixed(2)))}>
                    ⚡ 50 / 50 (Half)
                  </button>
                  <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setSplitPointSeconds(Number((totalDuration / 3).toFixed(2)))}>
                    ⅓ & ⅔
                  </button>
                  {totalDuration > 1.5 && (
                    <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => setSplitPointSeconds(1.0)}>
                      1.0s Cut
                    </button>
                  )}
                  {totalDuration > 2.5 && (
                    <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => setSplitPointSeconds(2.0)}>
                      2.0s Cut
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Range Slider */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  <span style={{ color: 'var(--accent-indigo)' }}>Part 1: {part1Dur}s</span>
                  <span style={{ color: '#34d399' }}>Part 2: {part2Dur}s</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={Math.max(0.2, totalDuration - 0.1)}
                  step={0.05}
                  value={splitPointSeconds}
                  onChange={(e) => setSplitPointSeconds(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
              </div>

              {/* Numeric Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className="label" style={{ fontSize: '12px' }}>Scene 1 Length (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    max={totalDuration - 0.1}
                    className="input-field"
                    value={part1Dur}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.1;
                      setSplitPointSeconds(Math.max(0.1, Math.min(val, totalDuration - 0.1)));
                    }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: '12px' }}>Scene 2 Length (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    max={totalDuration - 0.1}
                    className="input-field"
                    value={part2Dur}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.1;
                      setSplitPointSeconds(Math.max(0.1, Math.min(totalDuration - val, totalDuration - 0.1)));
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn-secondary" onClick={() => setSplitModalSceneIdx(null)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={() => confirmSplitSceneInProject(splitModalSceneIdx, part1Dur)}>
                  <Scissors size={14} />
                  Confirm Split (2 Scenes)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}