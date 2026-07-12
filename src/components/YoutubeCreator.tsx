import React, { useState, useEffect, useRef } from 'react';
import { SubtitleStyleEditor } from './SubtitleStyleEditor';
import { 
  Sparkles, Play, Check, X, AlertCircle, 
  RefreshCw, ChevronRight, ChevronLeft, Plus, 
  Volume2, Rocket, Zap 
} from 'lucide-react';
import { Player } from '@remotion/player';
import { VideoReel } from '../remotion/VideoReel';
import { PlayerErrorBoundary } from './PlayerErrorBoundary';

interface YoutubeCreatorProps {
  projectId: string | null;
  onStartRender: (jobId: string) => void;
  onOpenProject?: (projectId: string, type: 'create' | 'beatsync' | 'talkinghead' | 'subtitles' | 'youtube') => void;
}

interface WordTiming {
  word: string;
  start_time: number;
  end_time: number;
  sfx?: string;
}

interface Scene {
  text: string;
  visualDescription: string;
  sfxKeywords: string;
  transition: string;
  sfx: string;
  start_time?: number;
  end_time?: number;
  clipId?: string;
  clipStart?: number;
  clipUrl?: string | null;
  words?: WordTiming[];
  words_hindi?: WordTiming[];
  words_hinglish?: WordTiming[];
  zoomAvatar?: boolean;
  graphContext?: string;
  zoom?: boolean;
  shake?: boolean;
  shakeIntensity?: number;
  shakeSpeed?: number;
  layout?: 'graph' | 'versus' | 'quote' | 'stat_callout' | 'timeline_checkpoint' | 'danger_callout' | 'progress_ratio' | 'pro_tip' | 'versus_meter' | 'tier_list_ranker' | 'full_broll';
  layoutProps?: {
    quoteText?: string;
    quoteAuthor?: string;
    statValue?: string;
    statLabel?: string;
    versusLeft?: string;
    versusRight?: string;
    versusLabel?: string;
    versusLeftFeatures?: string[];
    versusRightFeatures?: string[];
    timelineDate?: string;
    timelineLabel?: string;
    dangerTitle?: string;
    dangerText?: string;
    progressValue?: string | number;
    progressLabel?: string;
    tipTitle?: string;
    tipText?: string;
    meterLeft?: string;
    meterRight?: string;
    meterValue?: string | number;
    meterLabel?: string;
    tierRank?: string;
    tierItem?: string;
    tierLabel?: string;
  };
  ambientSoundscape?: string;
  postProcessingPreset?: string;
}

interface BGM {
  id: string;
  name: string;
  path: string;
  url: string;
  duration: number;
}

interface Voice {
  id: string;
  name: string;
  previewUrl: string;
  category: string;
}

interface WordStyle {
  fontColor: string;
  activeWordScale: number;
  neonGlow: boolean;
  glowColor: string;
  glowBlur: number;
  glowDistance: number;
}

/*
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
*/

const CURATED_FONTS = [
  'Arial', 'Anton', 'Bangers', 'Kalam', 'Kalam Light', 'Kalam Bold', 'Inter',
  'Poppins', 'Roboto', 'Montserrat', 'Oswald', 'Playfair Display', 'Lora',
  'Lilita One', 'Fredoka', 'Pacifico', 'Caveat', 'Rubik', 'Bebas Neue',
  'Righteous', 'Lobster', 'Cinzel', 'Titan One', 'Shadows Into Light',
  'Satisfy', 'Comfortaa', 'Bree Serif', 'Exo 2', 'Creepster', 'Impact',
  'Courier New', 'Times New Roman', 'Orbitron',
  'Rajdhani', 'Teko', 'Yatra One', 'Rozha One', 'Mukta', 'Martel'
];

/*
interface SubtitlePreset {
  id: string;
  name: string;
  description: string;
  subtitleMode: 'classic' | 'pop' | 'smart-highlight' | 'centered-word';
  fontName: string;
  fontSize: number;
  fontColor: string;
  outlineColor: string;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  highlightColor: string;
  showHighlightBox: boolean;
  boxColor: string;
  boxRounding: number;
  activeWordScale: number;
  showEmojis: boolean;
  autoEmphasis: boolean;
  emphasisColor: string;
  neonGlow: boolean;
  glowColor: string;
  pop3d: boolean;
  pop3dColor: string;
  brandingTheme?: 'none' | 'fitness-in-chunks';
}
*/

/*
const SUBTITLE_PRESETS: SubtitlePreset[] = [
  {
    id: 'tiktok-hormozi',
    name: 'TikTok Hormozi',
    description: '🔥 Viral style with heavy outline, yellow highlights & auto emojis',
    subtitleMode: 'centered-word',
    fontName: 'Bangers',
    fontSize: 36,
    fontColor: '#FFCC00',
    outlineColor: '#000000',
    bold: true,
    italic: false,
    shadow: true,
    highlightColor: '#00FF00',
    showHighlightBox: false,
    boxColor: '#8A4BF3',
    boxRounding: 8,
    activeWordScale: 1.25,
    showEmojis: true,
    autoEmphasis: true,
    emphasisColor: '#FF3333',
    neonGlow: false,
    glowColor: '#00FFFF',
    pop3d: false,
    pop3dColor: '#000000'
  },
  {
    id: 'minimal-vercel',
    name: 'Minimal Vercel',
    description: '⚡ Clean, modern aesthetic with sharp white lettering',
    subtitleMode: 'classic',
    fontName: 'Inter',
    fontSize: 24,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    bold: false,
    italic: false,
    shadow: false,
    highlightColor: '#FFFFFF',
    showHighlightBox: false,
    boxColor: '#8A4BF3',
    boxRounding: 8,
    activeWordScale: 1.0,
    showEmojis: false,
    autoEmphasis: false,
    emphasisColor: '#FFFF00',
    neonGlow: false,
    glowColor: '#00FFFF',
    pop3d: false,
    pop3dColor: '#000000'
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: '🌌 High tech glow, futuristic font & cyan/magenta highlight',
    subtitleMode: 'smart-highlight',
    fontName: 'Orbitron',
    fontSize: 28,
    fontColor: '#FFFFFF',
    outlineColor: '#050505',
    bold: true,
    italic: false,
    shadow: false,
    highlightColor: '#FF00FF',
    showHighlightBox: false,
    boxColor: '#8A4BF3',
    boxRounding: 8,
    activeWordScale: 1.15,
    showEmojis: false,
    autoEmphasis: false,
    emphasisColor: '#FFFF00',
    neonGlow: true,
    glowColor: '#00FFFF',
    pop3d: false,
    pop3dColor: '#000000'
  },
  {
    id: 'retro-pop',
    name: 'Retro Pop',
    description: '🎮 Bold 3D pop extrusion with black box highlight',
    subtitleMode: 'centered-word',
    fontName: 'Titan One',
    fontSize: 30,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    bold: true,
    italic: false,
    shadow: false,
    highlightColor: '#00FFFF',
    showHighlightBox: true,
    boxColor: '#000000',
    boxRounding: 6,
    activeWordScale: 1.15,
    showEmojis: false,
    autoEmphasis: false,
    emphasisColor: '#FFFF00',
    neonGlow: false,
    glowColor: '#00FFFF',
    pop3d: true,
    pop3dColor: '#FF3366'
  },
  {
    id: 'clean-slate',
    name: 'Clean Slate',
    description: '✨ Classic Montserrat clean look with soft text shadow',
    subtitleMode: 'classic',
    fontName: 'Montserrat',
    fontSize: 26,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    bold: true,
    italic: false,
    shadow: true,
    highlightColor: '#FFFF00',
    showHighlightBox: false,
    boxColor: '#8A4BF3',
    boxRounding: 8,
    activeWordScale: 1.15,
    showEmojis: false,
    autoEmphasis: false,
    emphasisColor: '#FFFF00',
    neonGlow: false,
    glowColor: '#00FFFF',
    pop3d: false,
    pop3dColor: '#000000'
  },
  {
    id: 'fitness-in-chunks',
    name: 'Fitness In Chunks',
    description: '🎬 Clean monochrome documentary captions matching the branding system',
    subtitleMode: 'classic',
    fontName: 'Montserrat',
    fontSize: 22,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    bold: true,
    italic: false,
    shadow: false,
    highlightColor: '#FFFFFF',
    showHighlightBox: false,
    boxColor: '#1A1A1A',
    boxRounding: 8,
    activeWordScale: 1.0,
    showEmojis: false,
    autoEmphasis: false,
    emphasisColor: '#FFFFFF',
    neonGlow: false,
    glowColor: '#00FFFF',
    pop3d: false,
    pop3dColor: '#000000',
    brandingTheme: 'fitness-in-chunks'
  }
];
*/

export default function YoutubeCreator({ projectId, onStartRender, onOpenProject }: YoutubeCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Config States
  const [apiKeysConfigured, setApiKeysConfigured] = useState({
    gemini: false,
    elevenlabs: false,
    pexels: false,
    pixabay: false
  });
  const [niche, setNiche] = useState('The Wisdom Blueprint');
  const [topic, setTopic] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [shortScriptText, setShortScriptText] = useState('');
  
  // Audio settings
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [bgms, setBgms] = useState<BGM[]>([]);
  const [selectedBgm, setSelectedBgm] = useState('');
  const [bgmVolume, setBgmVolume] = useState(0.12);
  const [audioSource, setAudioSource] = useState<'generate' | 'upload'>('generate');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [voiceoverPath, setVoiceoverPath] = useState('');
  const [voiceoverUrl, setVoiceoverUrl] = useState('');

  // Audio preview helper
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<HTMLAudioElement | null>(null);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sfxList, setSfxList] = useState<{ id: string; name: string }[]>([]);
  const [previewingSfx, setPreviewingSfx] = useState<string | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlaySfx = (sfxId: string) => {
    if (!sfxId || sfxId === 'none') return;
    if (previewingSfx === sfxId) {
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
      }
      setPreviewingSfx(null);
      return;
    }

    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
    }

    const audio = new Audio(`/uploads/sfx/${sfxId}.mp3`);
    sfxAudioRef.current = audio;
    setPreviewingSfx(sfxId);
    audio.play().catch(err => {
      console.error('Failed to play SFX:', err);
      setPreviewingSfx(null);
    });
    audio.addEventListener('ended', () => {
      setPreviewingSfx(null);
    });
  };

  const [availableSfx, setAvailableSfx] = useState<string[]>([
    'none', 'cinematic-swoosh', 'trans_swoosh_fast', 'trans_swoosh_deep', 
    'trans_paper_slide', 'trans_glitch_digital', 'reveal_ding_bell', 'reveal_pop_bubble'
  ]);

  // Video and Short project properties
  const [renderedVideoUrl, setRenderedVideoUrl] = useState('');
  const [shortProjectId, setShortProjectId] = useState('');
  const [exportResolution, setExportResolution] = useState('1080p');
  const [exportFps, setExportFps] = useState(30);
  const [brollStyle, setBrollStyle] = useState('clean minimal');

  // Subtitle States
  const [subtitleMode, setSubtitleMode] = useState<'classic' | 'pop' | 'smart-highlight' | 'centered-word'>('classic');
  const [entities, setEntities] = useState<any[]>([]);
  const [graphEvents, setGraphEvents] = useState<any[]>([]);
  const [graphSettings, setGraphSettings] = useState<{
    overlayOnBroll: boolean;
    brollOpacity: number;
  }>({
    overlayOnBroll: false,
    brollOpacity: 0.35,
  });
  const [subStep, setSubStep] = useState<'transitions' | 'subtitles' | 'graph'>('transitions');
  const [bulkTransition, setBulkTransition] = useState('none');
  const [bulkSfx, setBulkSfx] = useState('none');
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState('character');
  const [localEventForm, setLocalEventForm] = useState<Record<number, any>>({});
  const [fontName, setFontName] = useState('Bangers');
  const [fontSize, setFontSize] = useState(48);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [shadow, setShadow] = useState(true);
  const [highlightColor, setHighlightColor] = useState('#FACC15');
  const [showHighlightBox, setShowHighlightBox] = useState(false);
  const [boxColor, setBoxColor] = useState('#8A4BF3');
  const [boxRounding, setBoxRounding] = useState(8);
  const [textFade, setTextFade] = useState(true);
  const [textTransition, setTextTransition] = useState('none');
  const [textMotion, setTextMotion] = useState('none');
  const [activeWordScale, setActiveWordScale] = useState(1.15);
  const [wordDisplayTime, setWordDisplayTime] = useState(1);
  const [textPositionX, setTextPositionX] = useState(0);
  const [textPositionY, setTextPositionY] = useState(-65);
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(3);
  const [showEmojis, setShowEmojis] = useState(false);
  const [autoEmphasis, setAutoEmphasis] = useState(false);
  const [emphasisColor, setEmphasisColor] = useState('#FFFFFF');
  const [neonGlow, setNeonGlow] = useState(true);
  const [glowColor, setGlowColor] = useState('#FFFFFF');
  const [glowBlur, setGlowBlur] = useState(1);
  const [glowDistance, setGlowDistance] = useState(20);
  const [pop3d, setPop3d] = useState(false);
  const [pop3dColor, setPop3dColor] = useState('#000000');
  const [pop3dDepth, setPop3dDepth] = useState(6);
  const [highlightTrigger, setHighlightTrigger] = useState<'all' | 'emphasis' | 'emoji' | 'none'>('all');
  
  // Brand colors & Background styling
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#d4af37');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#f5e6a3');
  const [backgroundColor, setBackgroundColor] = useState('#080c18');
  const [backgroundPattern, setBackgroundPattern] = useState<'grid' | 'dots' | 'radial' | 'none'>('grid');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [cardPositionY, setCardPositionY] = useState(0);
  const [cardScale, setCardScale] = useState(1.0);
  const [cardFontName, setCardFontName] = useState('Montserrat');
  const [showLayoutCards, setShowLayoutCards] = useState(true);
  const [applyHUDToAll, setApplyHUDToAll] = useState(true);
  const [activeSceneIdx, setActiveSceneIdx] = useState<number>(0);
  const [textCase, setTextCase] = useState<'default' | 'upper' | 'first-word-larger'>('default');
  const [letterSpacing, setLetterSpacing] = useState(3);
  const [wordSpacing, setWordSpacing] = useState(5);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(4);
  const [shadowDistance, setShadowDistance] = useState(2);
  const [shadowAngle, setShadowAngle] = useState(45);
  const [shadowOpacity, setShadowOpacity] = useState(0.6);
  const [outlineThickness, setOutlineThickness] = useState(1.5);

  // Heading / Hook state variables
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

  // Reel Branding System state variables
  const [brandingTheme, setBrandingTheme] = useState<'none' | 'fitness-in-chunks'>('none');
  const [seriesName, setSeriesName] = useState('FITNESSINCHUNKS');
  const [episodeNumber, setEpisodeNumber] = useState('EP 01');
  const [nextEpisode, setNextEpisode] = useState('EP 02');

  // Word styling states
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
  // const [styleTab, setStyleTab] = useState<'normal' | 'highlight' | 'emoji'>('normal');

  // Talking Head / Avatar States
  const [talkingHeadEnabled, setTalkingHeadEnabled] = useState(false);
  const [talkingHeadMode, setTalkingHeadMode] = useState<'overlay' | 'alternating' | 'fulltime' | 'rounded-pip'>('alternating');
  const [avatarPreset, setAvatarPreset] = useState('avatar_fitness.png');
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
  const [originalVideoPath, setOriginalVideoPath] = useState('');
  const [originalVideoUrl, setOriginalVideoUrl] = useState('');
  const [avatarGenerating, setAvatarGenerating] = useState(false);
  const [lipsyncProgress, setLipsyncProgress] = useState<{ percent: number; stageLabel: string; elapsedSec: number } | null>(null);
  const [sadtalkerStatus, setSadtalkerStatus] = useState<{ installed: boolean; hasCheckpoints: boolean; message: string } | null>(null);
  const [talkingHeadSource, setTalkingHeadSource] = useState<'ai' | 'upload'>('ai');
  const [talkingHeadUploading, setTalkingHeadUploading] = useState(false);

  // Font Selector States
  const [fontSelectorOpen, setFontSelectorOpen] = useState(false);
  // const [fontSearchQuery, setFontSearchQuery] = useState('');
  // const [fontLoading, setFontLoading] = useState(false);
  // const [fontDownloadError, setFontDownloadError] = useState('');

  const loadGoogleFont = (font: string) => {
    const systemFonts = ['Arial', 'Impact', 'Courier New', 'Times New Roman', 'Trebuchet MS'];
    if (systemFonts.includes(font)) return;

    let targetFont = font;
    if (font.startsWith('Kalam')) {
      targetFont = 'Kalam';
    }

    const id = `google-font-${targetFont.toLowerCase().replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(targetFont)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  };

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
  const filteredFonts = CURATED_FONTS.filter(font =>
    font.toLowerCase().includes(fontSearchQuery.toLowerCase())
  );
*/

  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
    fetchSettingsAndAssets();
    // Check SadTalker installation status
    fetch('/api/youtube/sadtalker-status')
      .then(r => r.json())
      .then(setSadtalkerStatus)
      .catch(() => {}); // silently ignore if backend is offline
  }, [projectId]);

  const fetchSettingsAndAssets = async () => {
    try {
      // 1. Fetch settings to verify API keys and load voices
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        const configured = {
          gemini: !!settings.geminiApiKey,
          elevenlabs: !!settings.elevenLabsApiKey && !settings.elevenLabsApiKey.includes('missing'),
          pexels: !!settings.pexelsApiKey && !settings.pexelsApiKey.includes('missing'),
          pixabay: !!settings.pixabayApiKey && !settings.pixabayApiKey.includes('missing')
        };
        setApiKeysConfigured(configured);

        // Fetch voices if ElevenLabs key is available
        if (settings.elevenLabsApiKey) {
          const vRes = await fetch(`/api/voices?apiKey=${encodeURIComponent(settings.elevenLabsApiKey)}`);
          if (vRes.ok) {
            const vData = await vRes.json();
            setVoices(vData);
            if (vData.length > 0 && !selectedVoice) {
              setSelectedVoice(settings.lastSelectedVoice || vData[0].id);
            }
          }
        }
      }

      // 2. Fetch BGMs
      const bgmRes = await fetch('/api/bgms');
      if (bgmRes.ok) {
        const bgmData = await bgmRes.json();
        setBgms(bgmData);
        if (bgmData.length > 0 && !selectedBgm) {
          setSelectedBgm(bgmData[0].path);
        }
      }

      // 3. Fetch SFXs dynamically from server
      const sfxRes = await fetch('/api/sfx');
      if (sfxRes.ok) {
        const sfxData = await sfxRes.json();
        setSfxList(sfxData);
        if (Array.isArray(sfxData) && sfxData.length > 0) {
          const sfxIds = ['none', ...sfxData.map((s: any) => s.id)];
          setAvailableSfx(sfxIds);
        }
      }
    } catch (err) {
      console.error('Failed to load settings or assets:', err);
    }
  };

  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const proj = await res.json();
        if (proj.type === 'youtube') {
          const state = proj.state || {};
          setNiche(state.niche || 'The Wisdom Blueprint');
          setTopic(state.topic || '');
          setScriptText(state.scriptText || '');
          setShortScriptText(state.shortScriptText || '');
          setSelectedVoice(state.selectedVoice || '');
          setAudioSource(state.audioSource || 'generate');
          setVoiceoverPath(state.voiceoverPath || '');
          setVoiceoverUrl(state.voiceoverUrl || '');
          setScenes(state.scenes || []);
          setSelectedBgm(state.bgMusicPath || '');
          setBgmVolume(state.bgMusicVolume || 0.12);
          setShortProjectId(state.shortProjectId || '');
          setExportResolution(state.exportResolution || '1080p');
          setExportFps(state.exportFps || 30);
          setBrollStyle(state.brollStyle || 'clean minimal');

          // Subtitle settings
          setSubtitleMode(state.subtitleMode || 'classic');
          setEntities(state.entities || []);
          setGraphEvents(state.graphEvents || []);
          setGraphSettings(state.graphSettings || { overlayOnBroll: false, brollOpacity: 0.35 });
          setFontName(state.fontName || 'Arial');
          setFontSize(state.fontSize || 24);
          setFontColor(state.fontColor || '#FFFFFF');
          setOutlineColor(state.outlineColor || '#000000');
          setBold(state.bold !== undefined ? state.bold : true);
          setItalic(state.italic !== undefined ? state.italic : false);
          setShadow(state.shadow !== undefined ? state.shadow : true);
          setHighlightColor(state.highlightColor || '#FFFF00');
          setShowHighlightBox(state.showHighlightBox !== undefined ? state.showHighlightBox : false);
          setBoxColor(state.boxColor || '#8A4BF3');
          setBoxRounding(state.boxRounding || 8);
          setTextFade(state.textFade !== undefined ? state.textFade : true);
          setTextTransition(state.textTransition || 'none');
          setTextMotion(state.textMotion || 'none');
          setActiveWordScale(state.activeWordScale || 1.15);
          setWordDisplayTime(state.wordDisplayTime || 1);
          setTextPositionX(state.textPositionX !== undefined ? state.textPositionX : 0);
          setTextPositionY(state.textPositionY !== undefined ? state.textPositionY : -70);
          setMaxWordsPerLine(state.maxWordsPerLine || 3);
          setPop3d(state.pop3d !== undefined ? state.pop3d : false);
          setPop3dColor(state.pop3dColor || '#000000');
          setPop3dDepth(state.pop3dDepth !== undefined ? state.pop3dDepth : 6);
          setHighlightTrigger(state.highlightTrigger || 'all');
          setTextCase(state.textCase || 'default');
          setLetterSpacing(state.letterSpacing !== undefined ? state.letterSpacing : 0);
          setWordSpacing(state.wordSpacing !== undefined ? state.wordSpacing : 0);
          setShadowColor(state.shadowColor || '#000000');
          setShadowBlur(state.shadowBlur !== undefined ? state.shadowBlur : 0);
          setShadowDistance(state.shadowDistance !== undefined ? state.shadowDistance : 0);
          setShadowAngle(state.shadowAngle !== undefined ? state.shadowAngle : 0);
          setShadowOpacity(state.shadowOpacity !== undefined ? state.shadowOpacity : 0.5);
          setOutlineThickness(state.outlineThickness !== undefined ? state.outlineThickness : 1.5);
          setShowEmojis(state.showEmojis !== undefined ? state.showEmojis : false);
          setAutoEmphasis(state.autoEmphasis !== undefined ? state.autoEmphasis : false);
          setEmphasisColor(state.emphasisColor || '#FFFF00');
           setNeonGlow(state.neonGlow !== undefined ? state.neonGlow : false);
          setGlowColor(state.glowColor || '#00FFFF');
          setGlowBlur(state.glowBlur !== undefined ? state.glowBlur : 6);
          setGlowDistance(state.glowDistance !== undefined ? state.glowDistance : 3);
          
          setBrandPrimaryColor(state.brandPrimaryColor || '#00f2fe');
          setBrandSecondaryColor(state.brandSecondaryColor || '#ff4757');
          setBackgroundColor(state.backgroundColor || '#080c18');
          setBackgroundPattern(state.backgroundPattern || 'grid');
          setBackgroundImageUrl(state.backgroundImageUrl || '');
          setCardPositionY(state.cardPositionY !== undefined ? state.cardPositionY : 0);
          setCardScale(state.cardScale !== undefined ? state.cardScale : 1.0);
          setCardFontName(state.cardFontName || 'Montserrat');
          setShowLayoutCards(state.showLayoutCards !== undefined ? state.showLayoutCards : true);
          setApplyHUDToAll(state.applyHUDToAll !== undefined ? state.applyHUDToAll : true);

          // Hook Title / Badge
          setHeadingTitle(state.headingTitle || '');
          setHeadingFontName(state.headingFontName || 'Montserrat');
          setHeadingFontSize(state.headingFontSize !== undefined ? state.headingFontSize : 18);
          setHeadingFontColor(state.headingFontColor || '#FFFFFF');
          setHeadingBoxColor(state.headingBoxColor || '#1A1A1A');
          setHeadingPadding(state.headingPadding !== undefined ? state.headingPadding : 6);
          setShowTimer(state.showTimer !== undefined ? state.showTimer : false);
          setHeadingTopOffset(state.headingTopOffset !== undefined ? state.headingTopOffset : 5);
          setHeadingLeftOffset(state.headingLeftOffset !== undefined ? state.headingLeftOffset : 5);
          setHeadingBoxOpacity(state.headingBoxOpacity !== undefined ? state.headingBoxOpacity : 85);
          setHeadingTextOpacity(state.headingTextOpacity !== undefined ? state.headingTextOpacity : 100);

          // Reel Branding System
          setBrandingTheme(state.brandingTheme || 'none');
          setSeriesName(state.seriesName || 'FITNESSINCHUNKS');
          setEpisodeNumber(state.episodeNumber || 'EP 01');
          setNextEpisode(state.nextEpisode || 'EP 02');

          // Word Styles
          setNormalStyle(state.normalStyle || {
            fontColor: state.fontColor || '#FFFFFF',
            activeWordScale: 1.0,
            neonGlow: state.neonGlow !== undefined ? state.neonGlow : true,
            glowColor: state.glowColor || '#FFFFFF',
            glowBlur: state.glowBlur !== undefined ? state.glowBlur : 1,
            glowDistance: state.glowDistance !== undefined ? state.glowDistance : 20
          });
          setHighlightStyle(state.highlightStyle || {
            fontColor: state.highlightColor || '#FACC15',
            activeWordScale: state.activeWordScale || 1.15,
            neonGlow: state.neonGlow !== undefined ? state.neonGlow : true,
            glowColor: state.glowColor || '#FACC15',
            glowBlur: state.glowBlur !== undefined ? state.glowBlur : 1,
            glowDistance: state.glowDistance !== undefined ? state.glowDistance : 20
          });
          setEmojiStyle(state.emojiStyle || {
            fontColor: state.highlightColor || '#FACC15',
            activeWordScale: state.activeWordScale || 1.15,
            neonGlow: state.neonGlow !== undefined ? state.neonGlow : true,
            glowColor: state.glowColor || '#FACC15',
            glowBlur: state.glowBlur !== undefined ? state.glowBlur : 1,
            glowDistance: state.glowDistance !== undefined ? state.glowDistance : 20
          });

          // Talking Head / Avatar settings
          setTalkingHeadEnabled(state.talkingHeadEnabled !== undefined ? state.talkingHeadEnabled : false);
          setTalkingHeadMode(state.talkingHeadMode || 'alternating');
          setAvatarPreset(state.avatarPreset || 'avatar_fitness.png');
          setTalkingHeadChromaColor(state.talkingHeadChromaColor || '#00ff00');
          setTalkingHeadChromaSimilarity(state.talkingHeadChromaSimilarity !== undefined ? state.talkingHeadChromaSimilarity : 0.15);
          setTalkingHeadChromaBlend(state.talkingHeadChromaBlend !== undefined ? state.talkingHeadChromaBlend : 0.10);
          setTalkingHeadSize(state.talkingHeadSize !== undefined ? state.talkingHeadSize : 40);
          setTalkingHeadPosition(state.talkingHeadPosition || 'bottom-right');
          setTalkingHeadPositionX(state.talkingHeadPositionX !== undefined ? state.talkingHeadPositionX : 10);
          setTalkingHeadPositionY(state.talkingHeadPositionY !== undefined ? state.talkingHeadPositionY : 10);
          setTalkingHeadOutlineEnabled(state.talkingHeadOutlineEnabled !== undefined ? state.talkingHeadOutlineEnabled : false);
          setTalkingHeadOutlineColor(state.talkingHeadOutlineColor || '#ffffff');
          setTalkingHeadOutlineThickness(state.talkingHeadOutlineThickness !== undefined ? state.talkingHeadOutlineThickness : 2);
          setOriginalVideoPath(state.originalVideoPath || '');
          setOriginalVideoUrl(state.originalVideoUrl || '');
          setTalkingHeadSource(state.talkingHeadSource || 'ai');

          if (state.lastRenderedVideoPath) {
            setRenderedVideoUrl(state.lastRenderedVideoPath.startsWith('http') ? state.lastRenderedVideoPath : `/uploads/generated/${state.lastRenderedVideoPath.split('/').pop()}`);
          }

          // Set active step based on progress status
          if (state.status === 'script_generated') setStep(3);
          else if (state.status === 'aligned') setStep(4);
          else if (state.status === 'matched') setStep(5);
          else if (state.status === 'rendered') setStep(6);
          else setStep(1);
        }
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  };

  const saveProjectState = async (updatedFields: any = {}) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const proj = await res.json();
        const updatedState = {
          ...proj.state,
          niche,
          topic,
          scriptText,
          shortScriptText,
          selectedVoice,
          audioSource,
          voiceoverPath,
          voiceoverUrl,
          scenes,
          bgMusicPath: selectedBgm,
          bgMusicVolume: bgmVolume,
          shortProjectId,
          exportResolution,
          exportFps,
          brollStyle,
          subtitleMode,
          fontName,
          fontSize,
          fontColor,
          outlineColor,
          bold,
          italic,
          shadow,
          highlightColor,
          showHighlightBox,
          boxColor,
          boxRounding,
          textFade,
          textTransition,
          textMotion,
          activeWordScale,
          wordDisplayTime,
          textPositionX,
          textPositionY,
          maxWordsPerLine,
          showEmojis,
          autoEmphasis,
          emphasisColor,
          neonGlow,
          glowColor,
          glowBlur,
          glowDistance,
          pop3d,
          pop3dColor,
          highlightTrigger,
          headingTitle,
          headingFontName,
          headingFontSize,
          headingFontColor,
          headingBoxColor,
          headingPadding,
          showTimer,
          headingTopOffset,
          headingLeftOffset,
          headingBoxOpacity,
          headingTextOpacity,
          brandingTheme,
          seriesName,
          episodeNumber,
          nextEpisode,
          normalStyle,
          highlightStyle,
          emojiStyle,
          textCase,
          letterSpacing,
          wordSpacing,
          shadowColor,
          shadowBlur,
          shadowDistance,
          shadowAngle,
          shadowOpacity,
          outlineThickness,
          talkingHeadEnabled,
          talkingHeadMode,
          avatarPreset,
          talkingHeadChromaColor,
          talkingHeadChromaSimilarity,
          talkingHeadChromaBlend,
          talkingHeadSize,
          talkingHeadPosition,
          talkingHeadPositionX,
          talkingHeadPositionY,
          talkingHeadOutlineEnabled,
          talkingHeadOutlineColor,
          talkingHeadOutlineThickness,
          originalVideoPath,
          originalVideoUrl,
          talkingHeadSource,
          entities,
          graphEvents,
          graphSettings,
          brandPrimaryColor,
          brandSecondaryColor,
          backgroundColor,
          backgroundPattern,
          backgroundImageUrl,
          cardPositionY,
          cardScale,
          cardFontName,
          showLayoutCards,
          ...updatedFields
        };

        await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: proj.name,
            state: updatedState
          })
        });
      }
    } catch (err) {
      console.error('Failed to save project progress:', err);
    }
  };

  const handleStartNewProject = async () => {
    if (loading) return;
    const confirmNew = window.confirm("Are you sure you want to start a new YouTube video project? Any unsaved progress on the current project might be lost.");
    if (!confirmNew) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'youtube' })
      });
      if (res.ok) {
        const newProj = await res.json();
        setStep(1);
        setTopic('');
        setScriptText('');
        setShortScriptText('');
        setScenes([]);
        setRenderedVideoUrl('');
        setShortProjectId('');
        setSuccess('Created new YouTube video project!');
        if (onOpenProject) {
          onOpenProject(newProj.id, 'youtube');
        }
      } else {
        throw new Error('Failed to create new project.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Generate script
  const handleGenerateScript = async () => {
    if (!topic) {
      setError('Please input a topic first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/youtube/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, topic, niche })
      });

      if (!res.ok) {
        throw new Error('Failed to generate script. Check Gemini API key settings.');
      }

      const data = await res.json();
      setScriptText(data.state.scriptText);
      setShortScriptText(data.state.shortScriptText);
      setScenes(data.state.scenes);
      setSuccess('Script and storyboard generated successfully!');
      setStep(3); // move to voice generation
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setLoading(true);
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
        throw new Error('Audio file upload failed.');
      }

      const data = await res.json();
      setVoiceoverPath(data.audioPath);
      setVoiceoverUrl(data.audioUrl);
      setSuccess('Voiceover audio file uploaded successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Generate speech via ElevenLabs
  const handleGenerateVoiceover = async () => {
    if (!scriptText) {
      setError('Script text is empty. Write or generate a script first.');
      return;
    }
    if (!selectedVoice) {
      setError('Please select a voice first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scriptText,
          voiceId: selectedVoice,
          modelId: 'eleven_turbo_v2_5',
          enhanceSpeech: false
        })
      });

      if (!res.ok) {
        throw new Error('TTS voice generation failed. Check ElevenLabs API key settings.');
      }

      const data = await res.json();
      setVoiceoverPath(data.audioPath);
      setVoiceoverUrl(data.audioUrl);
      setSuccess('Voiceover generated successfully!');
      await saveProjectState({ voiceoverPath: data.audioPath, voiceoverUrl: data.audioUrl });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Align Script timeline
  const handleAlignScript = async () => {
    if (!voiceoverPath) {
      setError('Voiceover audio is required. Generate or upload audio first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/align-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText, audioPath: voiceoverPath, language: 'original' })
      });

      if (!res.ok) {
        throw new Error('Timing alignment failed.');
      }

      const data = await res.json();
      const segments = data.segments || [];

      // Map segments to our scenes while preserving descriptions & keywords
      const alignedScenes = segments.map((seg: any, idx: number) => {
        const oldScene = scenes[idx] || {};
        return {
          ...oldScene,
          text: seg.text || oldScene.text || '',
          visualDescription: oldScene.visualDescription || 'Abstract cinematic background',
          sfxKeywords: oldScene.sfxKeywords || 'cinematic, abstract',
          transition: seg.transition || oldScene.transition || 'fade',
          sfx: seg.sfx || oldScene.sfx || 'none',
          start_time: seg.start_time,
          end_time: seg.end_time,
          words: seg.words,
          words_hindi: seg.words_hindi,
          words_hinglish: seg.words_hinglish,
          
          // STORYTELLER ENGINE AUTOMATION: Preserve layout cues chosen by Gemini
          layout: seg.layout || oldScene.layout || 'graph',
          layoutProps: seg.layoutProps || oldScene.layoutProps || {},
          ambientSoundscape: seg.ambientSoundscape || oldScene.ambientSoundscape || 'none',
          postProcessingPreset: seg.postProcessingPreset || oldScene.postProcessingPreset || 'none',
          shake: seg.shake !== undefined ? seg.shake : oldScene.shake,
          shakeIntensity: seg.shakeIntensity || oldScene.shakeIntensity,
          shakeSpeed: seg.shakeSpeed || oldScene.shakeSpeed
        };
      });

      setScenes(alignedScenes);
      setSuccess('Script timeline aligned with audio successfully!');
      await saveProjectState({ scenes: alignedScenes, status: 'aligned' });
      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Auto-Match & Download B-roll (Pexels/Pixabay)
  const handleAutoMatchClips = async () => {
    if (scenes.length === 0) {
      setError('Aligned scenes are required. Align script timeline first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/youtube/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, brollStyle })
      });

      if (!res.ok) {
        throw new Error('Auto-match B-roll fetch failed. Verify Pexels/Pixabay key settings.');
      }

      const data = await res.json();
      setScenes(data.state.scenes);
      setSuccess('All B-roll clips successfully fetched and matched!');
      await saveProjectState({ scenes: data.state.scenes, status: 'matched' });
      setStep(5);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!projectId) { setError('Project ID is missing. Start a project first.'); return; }
    if (!voiceoverPath) { setError('Please generate or upload the voiceover audio first (Step 3).'); return; }
    if (!avatarPreset) { setError('Please select or upload an avatar first.'); return; }

    setAvatarGenerating(true);
    setError('');
    setSuccess('');
    setLipsyncProgress({ percent: 2, stageLabel: 'Starting SadTalker…', elapsedSec: 0 });

    try {
      // 1. POST to start the async job
      const res = await fetch('/api/youtube/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, avatarPath: avatarPreset })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start lipsync job.');
      }
      const { jobId } = await res.json();

      // 2. Poll for progress every 2 seconds
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const pr = await fetch(`/api/youtube/avatar-progress/${jobId}?projectId=${projectId}`);
            if (!pr.ok) { clearInterval(poll); return reject(new Error('Progress endpoint failed.')); }
            const prog = await pr.json();

            setLipsyncProgress({
              percent:    prog.percent,
              stageLabel: prog.stageLabel,
              elapsedSec: prog.elapsedSec
            });

            if (prog.status === 'done') {
              clearInterval(poll);
              setOriginalVideoPath(prog.originalVideoPath);
              setOriginalVideoUrl(prog.originalVideoUrl);
              setTalkingHeadEnabled(true);
              resolve();
            } else if (prog.status === 'error') {
              clearInterval(poll);
              reject(new Error(prog.error || 'SadTalker failed.'));
            }
          } catch (e: any) {
            clearInterval(poll);
            reject(e);
          }
        }, 2000);
      });

      setSuccess('✅ AI Lip-Sync video generated successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAvatarGenerating(false);
      setLipsyncProgress(null);
    }
  };

  const handleCustomAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/youtube/upload-avatar', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload custom avatar.');
      }

      const data = await res.json();
      setAvatarPreset(data.url);
      await saveProjectState({ avatarPreset: data.url });
      setSuccess('Custom avatar successfully uploaded!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTalkingHeadVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setTalkingHeadUploading(true);
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
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload talking head video.');
      }

      const data = await res.json();
      setOriginalVideoPath(data.originalVideoPath);
      setOriginalVideoUrl(data.originalVideoUrl);
      setVoiceoverPath(data.audioPath);
      setVoiceoverUrl(data.audioUrl);
      setTalkingHeadEnabled(true);
      setTalkingHeadSource('upload');
      
      await saveProjectState({
        originalVideoPath: data.originalVideoPath,
        originalVideoUrl: data.originalVideoUrl,
        voiceoverPath: data.audioPath,
        voiceoverUrl: data.audioUrl,
        talkingHeadEnabled: true,
        talkingHeadSource: 'upload'
      });

      setSuccess('Talking head video uploaded successfully and audio extracted!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTalkingHeadUploading(false);
    }
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload-bg', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload background image.');
      }

      const data = await res.json();
      setBackgroundImageUrl(data.url);
      await saveProjectState({ backgroundImageUrl: data.url });
      setSuccess('Custom background image successfully uploaded!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Suggest SFX/Transitions
  const handleAutoSuggestAssets = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/youtube/auto-suggest-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      if (!res.ok) {
        throw new Error('Failed to auto-suggest assets.');
      }

      const data = await res.json();
      setScenes(data.state.scenes);
      setSuccess('Transitions and sound effects successfully suggested!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateHUD = async (sceneIndex?: number) => {
    setLoading(true);
    setError('');
    setSuccess('');

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
      setSuccess(
        sceneIndex !== undefined 
          ? `HUD layout successfully regenerated for scene ${sceneIndex + 1}!` 
          : 'HUD layouts successfully regenerated for all scenes!'
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

/*
  const handleApplyPreset = (p: SubtitlePreset) => {
    setSubtitleMode(p.subtitleMode);
    setFontName(p.fontName);
    setFontSize(p.fontSize);
    setFontColor(p.fontColor);
    setOutlineColor(p.outlineColor);
    setBold(p.bold);
    setItalic(p.italic);
    setShadow(p.shadow);
    setHighlightColor(p.highlightColor);
    setShowHighlightBox(p.showHighlightBox);
    setBoxColor(p.boxColor);
    setBoxRounding(p.boxRounding);
    setActiveWordScale(p.activeWordScale);
    setShowEmojis(p.showEmojis);
    setAutoEmphasis(p.autoEmphasis);
    setEmphasisColor(p.emphasisColor);
    setNeonGlow(p.neonGlow);
    setGlowColor(p.glowColor);
    setPop3d(p.pop3d);
    setPop3dColor(p.pop3dColor);
    setBrandingTheme(p.brandingTheme || 'none');

    const defaultNorm = {
      fontColor: p.fontColor,
      activeWordScale: 1.0,
      neonGlow: p.neonGlow,
      glowColor: p.glowColor,
      glowBlur: 6,
      glowDistance: 3
    };
    
    const defaultHighlight = {
      fontColor: p.highlightColor,
      activeWordScale: p.activeWordScale,
      neonGlow: p.neonGlow,
      glowColor: p.glowColor,
      glowBlur: 6,
      glowDistance: 3
    };

    setNormalStyle(defaultNorm);
    setHighlightStyle(defaultHighlight);
    setEmojiStyle(defaultHighlight);

    if (p.brandingTheme === 'fitness-in-chunks') {
      setSeriesName('FITNESSINCHUNKS');
      setEpisodeNumber('EP 01');
      setNextEpisode('EP 02');
    }

    try {
      fetch('/api/fonts/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontName: p.fontName })
      }).catch(err => console.warn('Backend font ensure failed:', err));
      
      loadGoogleFont(p.fontName);
    } catch (err) {
      console.warn('Font preload failed:', err);
    }
    
    saveProjectState({
      subtitleMode: p.subtitleMode,
      fontName: p.fontName,
      fontSize: p.fontSize,
      fontColor: p.fontColor,
      outlineColor: p.outlineColor,
      bold: p.bold,
      italic: p.italic,
      shadow: p.shadow,
      highlightColor: p.highlightColor,
      showHighlightBox: p.showHighlightBox,
      boxColor: p.boxColor,
      boxRounding: p.boxRounding,
      activeWordScale: p.activeWordScale,
      showEmojis: p.showEmojis,
      autoEmphasis: p.autoEmphasis,
      emphasisColor: p.emphasisColor,
      neonGlow: p.neonGlow,
      glowColor: p.glowColor,
      pop3d: p.pop3d,
      pop3dColor: p.pop3dColor,
      brandingTheme: p.brandingTheme || 'none',
      normalStyle: defaultNorm,
      highlightStyle: defaultHighlight,
      emojiStyle: defaultHighlight,
      seriesName: p.brandingTheme === 'fitness-in-chunks' ? 'FITNESSINCHUNKS' : seriesName,
      episodeNumber: p.brandingTheme === 'fitness-in-chunks' ? 'EP 01' : episodeNumber,
      nextEpisode: p.brandingTheme === 'fitness-in-chunks' ? 'EP 02' : nextEpisode
    });
  };
*/

  const handleUpdateScene = (index: number, field: string, value: any) => {
    const updated = [...scenes];
    let updatedScene = { ...updated[index], [field]: value };
    
    if (field === 'transition') {
      updatedScene.zoom = (value === 'zoom-in' || value === 'zoom-out');
      updatedScene.shake = (value === 'shake');
      if (value === 'shake') {
        updatedScene.shakeIntensity = updatedScene.shakeIntensity || 20;
        updatedScene.shakeSpeed = updatedScene.shakeSpeed || 18;
      }
    }
    
    updated[index] = updatedScene;
    setScenes(updated);
    saveProjectState({ scenes: updated });
  };

  const handleBulkApplyAssets = () => {
    if (scenes.length === 0) return;
    
    const updatedScenes = scenes.map(s => {
      const isZoom = (bulkTransition === 'zoom-in' || bulkTransition === 'zoom-out');
      const isShake = (bulkTransition === 'shake');
      return {
        ...s,
        transition: bulkTransition,
        sfx: bulkSfx,
        zoom: isZoom,
        shake: isShake,
        shakeIntensity: isShake ? (s.shakeIntensity || 20) : s.shakeIntensity,
        shakeSpeed: isShake ? (s.shakeSpeed || 18) : s.shakeSpeed
      };
    });
    
    setScenes(updatedScenes);
    saveProjectState({ scenes: updatedScenes });
    setSuccess('Successfully applied selected transition and SFX to all scenes!');
  };

  // Step 6: Render Long Video
  const handleCompileVideo = async () => {
    if (scenes.some(s => !s.clipId)) {
      setError('Please ensure all scenes have a matched B-roll clip.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          scenes,
          voiceoverPath,
          bgMusicPath: selectedBgm,
          bgMusicVolume: bgmVolume,
          aspectRatio: '16:9',
          fillMode: 'crop',
          clipTransition: 'none',
          transitionDuration: 0.3,
          zoomAnimation: true,
          exportResolution,
          exportFps,
          originalVideoPath,
          talkingHeadEnabled,
          entities,
          graphEvents,
          graphSettings,
          brandPrimaryColor,
          brandSecondaryColor,
          backgroundColor,
          backgroundPattern,
          backgroundImageUrl,
          cardPositionY,
          cardScale,
          cardFontName,
          showLayoutCards,
          talkingHeadChromaColor,
          talkingHeadChromaSimilarity,
          talkingHeadChromaBlend,
          talkingHeadSize,
          talkingHeadPosition,
          talkingHeadPositionX,
          talkingHeadPositionY,
          talkingHeadOutlineEnabled,
          talkingHeadOutlineColor,
          talkingHeadOutlineThickness,
          talkingHeadMode,
          subtitleStyle: {
            subtitleMode,
            fontName,
            fontSize,
            fontColor,
            outlineColor,
            bold,
            italic,
            shadow,
            highlightColor,
            showHighlightBox,
            boxColor,
            boxRounding,
            textFade,
            textTransition,
            textMotion,
            activeWordScale,
            wordDisplayTime,
            textPositionX,
            textPositionY,
            maxWordsPerLine,
            showEmojis,
            autoEmphasis,
            emphasisColor,
            neonGlow,
            glowColor,
            glowBlur,
            glowDistance,
            pop3d,
            pop3dColor,
            highlightTrigger,
            headingTitle,
            headingFontName,
            headingFontSize,
            headingFontColor,
            headingBoxColor,
            headingPadding,
            showTimer,
            headingTopOffset,
            headingLeftOffset,
            headingBoxOpacity,
            headingTextOpacity,
            brandingTheme,
            seriesName,
            episodeNumber,
            nextEpisode,
            normalStyle,
            highlightStyle,
            emojiStyle,
            textCase,
            letterSpacing,
            wordSpacing,
            shadowColor,
            shadowBlur,
            shadowDistance,
            shadowAngle,
            shadowOpacity,
            outlineThickness
          }
        })
      });

      if (!res.ok) {
        throw new Error('Compilation failed to start.');
      }

      const data = await res.json();
      setSuccess('Video compilation started! Opening Render Center...');
      onStartRender(data.jobId);
      await saveProjectState({ status: 'rendered' });
      setStep(6);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- LIVING STORY GRAPH HANDLERS ---
  const handleGenerateGraph = async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/youtube/extract-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract story graph.');
      }
      setEntities(data.entities || []);
      setGraphEvents(data.graphEvents || []);
      if (data.scenes) {
        setScenes(data.scenes);
      }
      setSuccess('Successfully extracted story graph using Gemini!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGraph = async (updatedEntities = entities, updatedEvents = graphEvents) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/save-graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entities: updatedEntities,
          graphEvents: updatedEvents,
          graphSettings,
        }),
      });
      if (res.ok) {
        setSuccess('Story graph saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError('Failed to save story graph: ' + err.message);
    }
  };

  const handleAddEntity = () => {
    if (!newEntityName.trim()) return;
    const newId = `entity_${Date.now()}`;
    const newEntity = {
      id: newId,
      name: newEntityName.trim(),
      type: newEntityType
    };
    const updatedEntities = [...entities, newEntity];
    setEntities(updatedEntities);
    setNewEntityName('');
    saveProjectState({ entities: updatedEntities });
    handleSaveGraph(updatedEntities);
  };

  const handleDeleteEntity = (id: string) => {
    const updatedEntities = entities.filter(e => e.id !== id);
    setEntities(updatedEntities);
    // Also clean up events referencing this entity
    const updatedEvents = graphEvents.filter(ev => 
      ev.entityId !== id && ev.fromEntityId !== id && ev.toEntityId !== id
    );
    setGraphEvents(updatedEvents);
    saveProjectState({ entities: updatedEntities, graphEvents: updatedEvents });
    handleSaveGraph(updatedEntities, updatedEvents);
  };

  const handleUpdateEntity = (id: string, field: string, value: string) => {
    const updatedEntities = entities.map(e => e.id === id ? { ...e, [field]: value } : e);
    setEntities(updatedEntities);
    saveProjectState({ entities: updatedEntities });
  };

  const handleUpdateEventForm = (sceneIndex: number, field: string, value: any) => {
    setLocalEventForm(prev => ({
      ...prev,
      [sceneIndex]: {
        ...(prev[sceneIndex] || {
          action: 'introduce',
          entityId: entities[0]?.id || '',
          fromEntityId: entities[0]?.id || '',
          toEntityId: entities[0]?.id || '',
          label: '',
          x: 50,
          y: 50
        }),
        [field]: value
      }
    }));
  };

  const handleAddEvent = (sceneIndex: number) => {
    const form = localEventForm[sceneIndex] || {
      action: 'introduce',
      entityId: entities[0]?.id || '',
      fromEntityId: entities[0]?.id || '',
      toEntityId: entities[0]?.id || '',
      label: '',
      x: 50,
      y: 50
    };

    const newEvent: any = {
      sceneIndex,
      action: form.action,
    };

    if (form.action === 'introduce') {
      newEvent.entityId = form.entityId || entities[0]?.id;
      newEvent.x = Number(form.x);
      newEvent.y = Number(form.y);
    } else if (form.action === 'remove' || form.action === 'highlight') {
      newEvent.entityId = form.entityId || entities[0]?.id;
    } else if (form.action === 'connect' || form.action === 'disconnect') {
      newEvent.fromEntityId = form.fromEntityId || entities[0]?.id;
      newEvent.toEntityId = form.toEntityId || entities[0]?.id;
      if (form.action === 'connect') {
        newEvent.label = form.label;
      }
    }

    const updatedEvents = [...graphEvents, newEvent];
    setGraphEvents(updatedEvents);
    saveProjectState({ graphEvents: updatedEvents });
    handleSaveGraph(entities, updatedEvents);

    // Clear form for this scene
    setLocalEventForm(prev => {
      const copy = { ...prev };
      delete copy[sceneIndex];
      return copy;
    });
  };

  const handleDeleteEvent = (eventIndex: number) => {
    const updatedEvents = graphEvents.filter((_, idx) => idx !== eventIndex);
    setGraphEvents(updatedEvents);
    saveProjectState({ graphEvents: updatedEvents });
    handleSaveGraph(entities, updatedEvents);
  };

  const handleUpdateEventProperty = (eventIndex: number, field: string, value: any) => {
    const updatedEvents = graphEvents.map((ev, idx) => {
      if (idx === eventIndex) {
        return { ...ev, [field]: value };
      }
      return ev;
    });
    setGraphEvents(updatedEvents);
    saveProjectState({ graphEvents: updatedEvents });
  };

  // Generate Shorts Promo Reel
  const handleGenerateShortPromo = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/youtube/create-short-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      if (!res.ok) {
        throw new Error('Failed to generate promo short project.');
      }

      const data = await res.json();
      setShortProjectId(data.shortProjectId);
      setSuccess('Promo Short project successfully created! Redirecting...');
      
      // Save short project mapping
      await saveProjectState({ shortProjectId: data.shortProjectId });
      
      setTimeout(() => {
        window.location.reload(); // Reload to update state and let user edit/render the new project
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Audio Previews
  const playVoicePreview = (url: string, id: string) => {
    if (audioPreview) {
      audioPreview.pause();
    }
    if (previewingVoiceId === id) {
      setPreviewingVoiceId(null);
      setAudioPreview(null);
      return;
    }

    const audio = new Audio(url);
    audio.play();
    setAudioPreview(audio);
    setPreviewingVoiceId(id);
    audio.onended = () => {
      setPreviewingVoiceId(null);
      setAudioPreview(null);
    };
  };

  const playSfxPreview = (sfxName: string) => {
    if (!sfxName || sfxName === 'none') return;
    if (audioPreview) {
      audioPreview.pause();
    }
    const audio = new Audio(`/uploads/sfx/${sfxName}.mp3`);
    audio.play().catch(err => console.error("Error playing SFX preview:", err));
    setAudioPreview(audio);
  };

  const handleUpdateSceneText = (index: number, value: string) => {
    const updated = [...scenes];
    const originalText = updated[index].text;
    if (originalText !== value) {
      updated[index] = { 
        ...updated[index], 
        text: value,
        visualDescription: 'Abstract cinematic background',
        sfxKeywords: 'cinematic, abstract',
        clipId: '' 
      };
    } else {
      updated[index] = { ...updated[index], text: value };
    }
    setScenes(updated);
  };

  const handleSaveSceneText = () => {
    saveProjectState({ scenes });
  };

  const renderPreviewPlayer = () => {
    if (scenes.length === 0) return null;
    return (
      <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Play size={14} style={{ color: 'var(--primary)' }} />
          Real-Time Video Preview
        </div>
        <div style={{ 
          width: '100%',
          aspectRatio: '16/9', 
          borderRadius: '12px', 
          overflow: 'hidden', 
          background: '#000000',
          border: '1px solid var(--border-medium)',
          position: 'relative'
        }}>
          <PlayerErrorBoundary componentName="YoutubeCreator-RemotionPlayer">
            <Player
              component={VideoReel as React.ComponentType<any>}
              inputProps={{
                scenes: scenes.map(s => ({
                  ...s,
                  clipUrl: s.clipUrl !== undefined 
                    ? s.clipUrl
                    : (s.clipId ? `/api/clips/${s.clipId}/video` : null)
                })),
                voiceoverUrl: voiceoverPath,
                voiceoverVolume: 1.0,
                bgMusicUrl: selectedBgm,
                bgMusicVolume: bgmVolume,
                videoVolume: 0.0,
                sfxVolume: 1.0,
                subtitleMode,
                fontName,
                fontSize,
                fontColor,
                bold,
                italic,
                shadow,
                activeWordScale,
                normalStyle,
                highlightStyle,
                emojiStyle,
                aspectRatio: '16:9',
                fillMode: 'crop',
                textPositionX,
                textPositionY,
                maxWordsPerLine,
                highlightTrigger,
                textCase,
                autoEmphasis,
                letterSpacing,
                wordSpacing,
                shadowColor,
                shadowBlur,
                shadowDistance,
                shadowAngle,
                shadowOpacity,
                outlineColor,
                outlineThickness,
                neonGlow,
                glowColor,
                glowBlur,
                glowDistance,
                entities,
                graphEvents,
                graphSettings,
                brandPrimaryColor,
                brandSecondaryColor,
                backgroundColor,
                backgroundPattern,
                backgroundImageUrl,
                cardPositionY,
                cardScale,
                cardFontName,
                showLayoutCards,
                baseUrl: window.location.port ? window.location.origin.replace(window.location.port, '8000') : window.location.origin,
              }}
              durationInFrames={Math.max(300, Math.round((scenes.length > 0 ? (scenes[scenes.length - 1].end_time || 10) : 10) * 30))}
              compositionWidth={1920}
              compositionHeight={1080}
              fps={30}
              style={{
                width: '100%',
                height: '100%',
              }}
              controls
              logLevel="trace"
            />
          </PlayerErrorBoundary>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-gray)', lineHeight: '1.4' }}>
          💡 Tip: Click Play to watch your living scene graph and subtitles animate in real time. Changes to presets, styles, and graph coordinates update immediately!
        </div>
      </div>
    );
  };

  return (
    <div className="youtube-wizard custom-scrollbar" style={{ padding: '24px', animation: 'fadeIn 0.3s ease', overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '26px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Play size={28} color="#FF0000" /> YouTube Channel Empire Creator
          </h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '13px', marginTop: '4px' }}>
            Fully automated creation pipeline for long-form Blueprint videos and suspense Short promos.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            onClick={handleStartNewProject} 
            disabled={loading}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Start New Video
          </button>

          {/* Key configure check */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!apiKeysConfigured.pexels && !apiKeysConfigured.pixabay && (
              <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '6px 12px', borderRadius: '6px' }}>
                <AlertCircle size={12} /> Stock Keys Missing (Configure in Settings)
              </div>
            )}
            {apiKeysConfigured.pexels && (
              <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '6px 12px', borderRadius: '6px' }}>
                <Check size={12} /> Pexels Connected
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Steps bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '32px' }}>
        {[
          '1. Niche & Setup',
          '2. Script Prep',
          '3. Voice & Timeline',
          '4. B-Roll Matching',
          '5. Transitions & SFX',
          '6. Render & Promo'
        ].map((lbl, idx) => {
          const stepNum = idx + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div 
              key={lbl} 
              style={{
                flex: 1, 
                padding: '10px', 
                borderBottom: isActive ? '3px solid var(--accent-purple)' : isDone ? '3px solid var(--success)' : '3px solid var(--border-medium)',
                color: isActive ? 'var(--text-white)' : isDone ? 'var(--success)' : 'var(--text-gray)',
                fontSize: '12px',
                fontWeight: isActive || isDone ? 700 : 500,
                textAlign: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              {lbl}
            </div>
          );
        })}
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="glass-panel" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Check size={18} /> {success}
        </div>
      )}

      {/* STEP CONTENT PANEL */}
      <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
        
        {/* STEP 1: NICHE & AUDIO SETUP */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Configure Niche & Audio Assets</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <div>
                <label className="label">Blueprint Channel Theme</label>
                <select className="input-field" value={niche} onChange={(e) => setNiche(e.target.value)}>
                  <option value="The Wisdom Blueprint">The Wisdom Blueprint (Stoicism, Philosophy)</option>
                  <option value="The Venture Blueprint">The Venture Blueprint (Business, Corporate Stories)</option>
                  <option value="The Mindset Blueprint">The Mindset Blueprint (Psychology, Cognitive Biases)</option>
                </select>
                <span className="subtitle" style={{ display: 'block', marginTop: '6px' }}>
                  Governs prompt structures, aesthetic B-roll searches, and title logic.
                </span>
              </div>

              <div>
                <label className="label">Background Music</label>
                <select className="input-field" value={selectedBgm} onChange={(e) => setSelectedBgm(e.target.value)}>
                  <option value="">No Background Music</option>
                  {bgms.map(bgm => (
                    <option key={bgm.path} value={bgm.path}>{bgm.name} ({Math.round(bgm.duration)}s)</option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <Volume2 size={14} color="var(--text-gray)" />
                  <input 
                    type="range" 
                    min="0" max="0.3" step="0.01" 
                    value={bgmVolume} 
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))} 
                    style={{ flexGrow: 1 }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>{Math.round(bgmVolume * 100)}%</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <div>
                <label className="label">B-Roll Footage Style / Aesthetic Modifier</label>
                <select className="input-field" value={brollStyle} onChange={(e) => { setBrollStyle(e.target.value); saveProjectState({ brollStyle: e.target.value }); }}>
                  <option value="clean minimal">Clean & Minimal (Default)</option>
                  <option value="dark cinematic">Dark & Cinematic</option>
                  <option value="vibrant modern">Vibrant & Modern</option>
                  <option value="aesthetic nature">Aesthetic & Organic Nature</option>
                  <option value="none">Pure Keywords (No Style Modifier)</option>
                </select>
                <span className="subtitle" style={{ display: 'block', marginTop: '6px' }}>
                  Appends search filters to stock APIs to ensure consistent clean/minimal styling.
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="label">Voiceover Audio Source</label>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={audioSource === 'generate'} onChange={() => setAudioSource('generate')} />
                  Generate Voiceover with ElevenLabs
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={audioSource === 'upload'} onChange={() => setAudioSource('upload')} />
                  Upload Custom Voiceover File
                </label>
              </div>

              {audioSource === 'generate' ? (
                <div>
                  <label className="label">Select ElevenLabs Narrator Voice</label>
                  {voices.length === 0 ? (
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-medium)', padding: '12px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-gray)' }}>
                      No voices found. Ensure your ElevenLabs key is configured in Settings.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxHeight: '200px', overflowY: 'auto', padding: '4px' }} className="custom-scrollbar">
                      {voices.map(v => (
                        <div 
                          key={v.id} 
                          onClick={() => setSelectedVoice(v.id)}
                          style={{
                            padding: '12px',
                            background: selectedVoice === v.id ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-dark)',
                            border: selectedVoice === v.id ? '1px solid var(--accent-purple)' : '1px solid var(--border-medium)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600 }}>{v.name}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-gray)', textTransform: 'capitalize' }}>{v.category} voice</div>
                          </div>
                          {v.previewUrl && (
                            <button 
                              type="button" 
                              onClick={(e) => { e.stopPropagation(); playVoicePreview(v.previewUrl, v.id); }}
                              className="btn-icon"
                              style={{ width: '22px', height: '22px', borderRadius: '50%' }}
                            >
                              {previewingVoiceId === v.id ? <X size={10} /> : <Play size={10} style={{ marginLeft: '1px' }} />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '20px', border: '2px dashed var(--border-medium)', borderRadius: '8px', textAlign: 'center' }}>
                  <label htmlFor="vo-upload" className="btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer', margin: 'auto' }}>
                    <Plus size={16} /> Choose Voiceover Audio
                  </label>
                  <input id="vo-upload" type="file" accept="audio/*" onChange={handleAudioUpload} style={{ display: 'none' }} />
                  {uploadedFileName && (
                    <div style={{ fontSize: '12px', marginTop: '12px', color: 'var(--success)' }}>
                      ✓ Selected: {uploadedFileName}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: SCRIPT PREP */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Generate or Paste Script</h3>
            
            <div style={{ marginBottom: '24px' }}>
              <label className="label">Video Topic / Description</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. 5 Rules Marcus Aurelius used to conquer his inner demons" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <span className="subtitle" style={{ display: 'block', marginTop: '6px' }}>
                Used by Gemini to write a high-value script matching the selected Blueprint theme.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button className="btn-primary" onClick={handleGenerateScript} disabled={loading || !topic}>
                <Sparkles size={16} /> Generate Script with Gemini
              </button>
              <button className="btn-secondary" onClick={() => setStep(3)} disabled={!scriptText && !voiceoverPath}>
                Skip & Write/Paste Script Directly
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label className="label">Long-Form Script Editor (8+ minutes)</label>
                <textarea 
                  className="input-field custom-scrollbar" 
                  rows={10} 
                  style={{ resize: 'vertical', fontSize: '13px', lineHeight: 1.5 }}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Paste or write your full 1200+ word narration script here..."
                />
              </div>

              <div>
                <label className="label">Short-Form Reel Script (Suspense cliffhanger)</label>
                <textarea 
                  className="input-field custom-scrollbar" 
                  rows={10} 
                  style={{ resize: 'vertical', fontSize: '13px', lineHeight: 1.5 }}
                  value={shortScriptText}
                  onChange={(e) => setShortScriptText(e.target.value)}
                  placeholder="The corresponding suspense short script will appear here to promote the long video..."
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: VOICEOVER & ALIGNMENT */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Voiceover Generation & Timing Alignment</h3>

            {audioSource === 'generate' ? (
              <div className="glass-panel" style={{ padding: '20px', background: 'var(--bg-dark)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>ElevenLabs Text-to-Speech</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-gray)' }}>
                    Convert your 1200+ word script into professional voiceover narration.
                  </p>
                </div>
                <button className="btn-primary" onClick={handleGenerateVoiceover} disabled={loading || !scriptText}>
                  <Zap size={16} /> Generate Audio Now
                </button>
              </div>
            ) : (
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', color: 'var(--success)' }}>
                ✓ Using uploaded voiceover: <strong>{voiceoverPath.split('/').pop()}</strong>
              </div>
            )}

            <div className="glass-panel" style={{ padding: '20px', background: 'var(--bg-dark)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Timeline Word Alignment</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-gray)' }}>
                  Extract timings and segment the script into consecutive scenes (ideal scene lengths: 4-8s).
                </p>
              </div>
              <button className="btn-primary" onClick={handleAlignScript} disabled={loading || !voiceoverPath}>
                <Rocket size={16} /> Align Script Timeline
              </button>
            </div>

            {scenes.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Storyboard Scenes Preview ({scenes.length} Scenes)</h4>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }} className="custom-scrollbar">
                  {scenes.map((s, idx) => (
                    <div key={idx} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div style={{ maxWidth: '60%' }}>
                        <strong>Scene {idx + 1}</strong>: {s.text}
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        Duration: {(s.start_time !== undefined && s.end_time !== undefined) ? `${(s.end_time - s.start_time).toFixed(1)}s` : 'Not aligned'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: B-ROLL MATCHING */}
        {step === 4 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '32px', alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Automated Stock B-roll Download & Matching</h3>
            <p style={{ color: 'var(--text-gray)', fontSize: '13px', marginBottom: '20px' }}>
              Matches scene visual descriptions to Pexels and Pixabay. Implements the 90s reuse rule to optimize downloads and keep footage fresh.
            </p>

            <button className="btn-primary" onClick={handleAutoMatchClips} disabled={loading} style={{ marginBottom: '24px' }}>
              <Sparkles size={16} /> Match and Fetch B-Roll Clips
            </button>

            {scenes.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Storyboard Visual Mapping</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }} className="custom-scrollbar">
                  {scenes.map((s, idx) => (
                    <div 
                      key={idx} 
                      style={{
                        padding: '16px', 
                        background: s.clipId ? 'rgba(16, 185, 129, 0.03)' : 'var(--bg-dark)',
                        border: s.clipId ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border-medium)',
                        borderRadius: '8px', 
                        display: 'flex', 
                        gap: '16px', 
                        alignItems: 'center'
                      }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', background: s.clipId ? 'var(--success)' : 'var(--border-medium)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {s.clipId ? <Check size={18} color="white" /> : <RefreshCw className={loading ? 'spin' : ''} size={16} color="var(--text-gray)" />}
                      </div>
                      
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Scene {idx + 1}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginTop: '2px' }}>{s.text}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <strong>Visual Ideal</strong>: {s.visualDescription} | <strong>Keywords</strong>: {s.sfxKeywords}
                        </div>
                      </div>

                      {s.clipId && (
                        <div style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '4px' }}>
                          Matched B-roll
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Avatar / Talking Head Setup */}
            <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-medium)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👤 AI Talking Head Avatar (Local SadTalker)
              </h4>
              <p style={{ color: 'var(--text-gray)', fontSize: '12px', marginBottom: '12px' }}>
                Configure an AI-generated character that will lip-sync with your ElevenLabs voiceover. Customize its display behavior below.
              </p>

              {/* SadTalker Installation Status Banner */}
              {sadtalkerStatus && !sadtalkerStatus.installed && (
                <div style={{
                  background: 'rgba(255, 100, 60, 0.08)', border: '1px solid rgba(255,100,60,0.3)',
                  borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
                  display: 'flex', gap: '12px', alignItems: 'flex-start'
                }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ff6b3d', marginBottom: '4px' }}>SadTalker Not Installed</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-gray)', lineHeight: 1.6 }}>
                      Run these commands in Terminal to set it up:
                    </div>
                    <pre style={{ fontSize: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '8px 10px', marginTop: '8px', overflowX: 'auto', color: '#7affb0', fontFamily: 'monospace', lineHeight: 1.7 }}>
{`cd /Volumes/1TB/WebProjects/VideoGenerator/backend
git clone https://github.com/OpenTalker/SadTalker.git sadtalker
cd sadtalker
conda env create -f environment.yaml
bash scripts/download_models.sh`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => fetch('/api/youtube/sadtalker-status').then(r => r.json()).then(setSadtalkerStatus)}
                      style={{ marginTop: '8px', fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      🔄 Refresh Status
                    </button>
                  </div>
                </div>
              )}
              {sadtalkerStatus && sadtalkerStatus.installed && !sadtalkerStatus.hasCheckpoints && (
                <div style={{
                  background: 'rgba(255, 200, 60, 0.08)', border: '1px solid rgba(255,200,60,0.3)',
                  borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
                  display: 'flex', gap: '12px', alignItems: 'flex-start'
                }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>📦</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffc93d', marginBottom: '4px' }}>Model Checkpoints Missing</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-gray)' }}>SadTalker is installed but model weights are missing. Run:</div>
                    <pre style={{ fontSize: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '8px 10px', marginTop: '6px', color: '#7affb0', fontFamily: 'monospace' }}>
{`cd /Volumes/1TB/WebProjects/VideoGenerator/backend/sadtalker
bash scripts/download_models.sh`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => fetch('/api/youtube/sadtalker-status').then(r => r.json()).then(setSadtalkerStatus)}
                      style={{ marginTop: '8px', fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      🔄 Refresh Status
                    </button>
                  </div>
                </div>
              )}
              {sadtalkerStatus && sadtalkerStatus.installed && sadtalkerStatus.hasCheckpoints && (
                <div style={{
                  background: 'rgba(60, 200, 100, 0.08)', border: '1px solid rgba(60,200,100,0.25)',
                  borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span>✅</span>
                  <span style={{ fontSize: '12px', color: '#3cc870', fontWeight: 600 }}>SadTalker is installed and ready!</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'start' }}>
                {/* Column 1: Configuration */}
                <div className="inspector-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-medium)' }}>
                  
                  {/* Toggle Option */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>Enable AI Talking Head</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overlays a talking character onto your video</span>
                    </div>
                    <div 
                      className={`stitch-switch ${talkingHeadEnabled ? 'active' : ''}`} 
                      onClick={() => { setTalkingHeadEnabled(!talkingHeadEnabled); saveProjectState({ talkingHeadEnabled: !talkingHeadEnabled }); }}
                    >
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>

                  {talkingHeadEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Talking Head Source Selection */}
                      <div>
                        <label className="label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Talking Head Source</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <button
                            type="button"
                            className={`btn-secondary ${talkingHeadSource === 'ai' ? 'active' : ''}`}
                            onClick={() => { setTalkingHeadSource('ai'); saveProjectState({ talkingHeadSource: 'ai' }); }}
                            style={{
                              padding: '10px', fontSize: '12px', borderRadius: '8px', textAlign: 'center',
                              background: talkingHeadSource === 'ai' ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'transparent',
                              borderColor: talkingHeadSource === 'ai' ? 'var(--primary)' : 'var(--border-light)',
                              color: talkingHeadSource === 'ai' ? 'var(--text-white)' : 'var(--text-gray)'
                            }}
                          >
                            🤖 AI-Generated Avatar
                          </button>
                          <button
                            type="button"
                            className={`btn-secondary ${talkingHeadSource === 'upload' ? 'active' : ''}`}
                            onClick={() => { setTalkingHeadSource('upload'); saveProjectState({ talkingHeadSource: 'upload' }); }}
                            style={{
                              padding: '10px', fontSize: '12px', borderRadius: '8px', textAlign: 'center',
                              background: talkingHeadSource === 'upload' ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'transparent',
                              borderColor: talkingHeadSource === 'upload' ? 'var(--primary)' : 'var(--border-light)',
                              color: talkingHeadSource === 'upload' ? 'var(--text-white)' : 'var(--text-gray)'
                            }}
                          >
                            📤 Upload Pre-recorded Video
                          </button>
                        </div>
                      </div>

                      {/* Character Display Mode */}
                      <div>
                        <label className="label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Character Display Mode</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <button
                            type="button"
                            className={`btn-secondary ${talkingHeadMode === 'alternating' ? 'active' : ''}`}
                            onClick={() => { setTalkingHeadMode('alternating'); saveProjectState({ talkingHeadMode: 'alternating' }); }}
                            style={{
                              padding: '10px', fontSize: '12px', borderRadius: '8px', textAlign: 'left',
                              background: talkingHeadMode === 'alternating' ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'transparent',
                              borderColor: talkingHeadMode === 'alternating' ? 'var(--primary)' : 'var(--border-light)',
                              color: talkingHeadMode === 'alternating' ? 'var(--text-white)' : 'var(--text-gray)'
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>Alternating</div>
                            <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Full-screen avatar when no B-roll; hides during B-rolls</div>
                          </button>
                          <button
                            type="button"
                            className={`btn-secondary ${talkingHeadMode === 'fulltime' ? 'active' : ''}`}
                            onClick={() => { setTalkingHeadMode('fulltime'); saveProjectState({ talkingHeadMode: 'fulltime' }); }}
                            style={{
                              padding: '10px', fontSize: '12px', borderRadius: '8px', textAlign: 'left',
                              background: talkingHeadMode === 'fulltime' ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'transparent',
                              borderColor: talkingHeadMode === 'fulltime' ? 'var(--primary)' : 'var(--border-light)',
                              color: talkingHeadMode === 'fulltime' ? 'var(--text-white)' : 'var(--text-gray)'
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>Full-time Background</div>
                            <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Plays full-screen in background under B-rolls</div>
                          </button>
                          <button
                            type="button"
                            className={`btn-secondary ${talkingHeadMode === 'overlay' ? 'active' : ''}`}
                            onClick={() => { setTalkingHeadMode('overlay'); saveProjectState({ talkingHeadMode: 'overlay' }); }}
                            style={{
                              padding: '10px', fontSize: '12px', borderRadius: '8px', textAlign: 'left',
                              background: talkingHeadMode === 'overlay' ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'transparent',
                              borderColor: talkingHeadMode === 'overlay' ? 'var(--primary)' : 'var(--border-light)',
                              color: talkingHeadMode === 'overlay' ? 'var(--text-white)' : 'var(--text-gray)'
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>Always Overlay (PIP)</div>
                            <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Always overlays in the corner (rectangular)</div>
                          </button>
                          <button
                            type="button"
                            className={`btn-secondary ${talkingHeadMode === 'rounded-pip' ? 'active' : ''}`}
                            onClick={() => { setTalkingHeadMode('rounded-pip'); saveProjectState({ talkingHeadMode: 'rounded-pip' }); }}
                            style={{
                              padding: '10px', fontSize: '12px', borderRadius: '8px', textAlign: 'left',
                              background: talkingHeadMode === 'rounded-pip' ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'transparent',
                              borderColor: talkingHeadMode === 'rounded-pip' ? 'var(--primary)' : 'var(--border-light)',
                              color: talkingHeadMode === 'rounded-pip' ? 'var(--text-white)' : 'var(--text-gray)'
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>Rounded Circle PIP</div>
                            <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Always overlays in the corner (circular mask)</div>
                          </button>
                        </div>
                      </div>

                      {talkingHeadSource === 'ai' ? (
                        <>
                          {/* Preset Avatars Grid */}
                          <div>
                            <label className="label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Select Avatar Character</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              {[
                                { id: 'avatar_fitness.png', name: 'Fitness Coach (Emma)', url: '/uploads/presets/avatars/avatar_fitness.png' },
                                { id: 'avatar_mentor.png', name: 'Wise Mentor (Arthur)', url: '/uploads/presets/avatars/avatar_mentor.png' }
                              ].map(preset => {
                                const isSel = avatarPreset === preset.id;
                                return (
                                  <div 
                                    key={preset.id}
                                    onClick={() => { setAvatarPreset(preset.id); saveProjectState({ avatarPreset: preset.id }); }}
                                    style={{
                                      border: isSel ? '2px solid var(--primary)' : '1px solid var(--border-medium)',
                                      borderRadius: '8px', padding: '8px', cursor: 'pointer', background: 'var(--bg-darker)',
                                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <img src={preset.url} alt={preset.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', background: 'var(--border-light)' }} />
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: isSel ? 'var(--text-white)' : 'var(--text-gray)' }}>{preset.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Custom Avatar Upload */}
                          <div>
                            <label className="label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              📤 Upload Your Own Avatar Image
                              <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)', background: 'rgba(138,75,243,0.15)', borderRadius: '4px', padding: '1px 6px' }}>PNG / JPG / WEBP</span>
                            </label>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                              Generated your own avatar on ChatGPT, Midjourney, or HeyGen? Upload it here — use a clear, forward-facing portrait photo for best results.
                            </p>

                            <label
                              htmlFor="custom-avatar-upload"
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: '8px', padding: '20px 16px', borderRadius: '10px', cursor: 'pointer',
                                border: avatarPreset && avatarPreset.startsWith('/uploads/avatars/')
                                  ? '2px solid var(--primary)'
                                  : '1.5px dashed var(--border-medium)',
                                background: avatarPreset && avatarPreset.startsWith('/uploads/avatars/')
                                  ? 'rgba(138,75,243,0.06)'
                                  : 'rgba(255,255,255,0.015)',
                                transition: 'all 0.2s ease',
                                position: 'relative'
                              }}
                            >
                              {avatarPreset && avatarPreset.startsWith('/uploads/avatars/') ? (
                                <>
                                  <div style={{ position: 'relative' }}>
                                    <img
                                      src={avatarPreset}
                                      alt="Custom avatar"
                                      style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', display: 'block' }}
                                    />
                                    <div style={{
                                      position: 'absolute', bottom: 0, right: 0, width: '22px', height: '22px',
                                      background: 'var(--primary)', borderRadius: '50%', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                                    }}>✓</div>
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>Your Custom Avatar — Selected ✅</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Click to replace with a different image</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: '28px' }}>🖼️</span>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-gray)' }}>Click to upload your avatar image</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '180px' }}>
                                    Best results: clear face, white/transparent background, 512×512px or higher
                                  </span>
                                </>
                              )}
                              <input
                                id="custom-avatar-upload"
                                type="file"
                                accept=".png,.jpg,.jpeg,.webp"
                                onChange={handleCustomAvatarUpload}
                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                              />
                            </label>

                            {avatarPreset && avatarPreset.startsWith('/uploads/avatars/') && (
                              <button
                                type="button"
                                onClick={() => { setAvatarPreset(''); saveProjectState({ avatarPreset: '' }); }}
                                style={{
                                  marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', background: 'none',
                                  border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', display: 'block'
                                }}
                              >
                                ✕ Remove and use a preset instead
                              </button>
                            )}
                          </div>

                          {/* Action trigger button */}
                          <button 
                            className="btn-primary" 
                            onClick={handleGenerateAvatar} 
                            disabled={avatarGenerating || !voiceoverPath || !avatarPreset}
                            style={{ marginTop: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                          >
                            {avatarGenerating ? (
                              <><RefreshCw className="spin" size={16} /> Processing…</>
                            ) : (
                              <><Sparkles size={16} /> Generate AI Lip-Sync Video</>
                            )}
                          </button>

                          {/* Live Progress Bar */}
                          {avatarGenerating && lipsyncProgress && (
                            <div style={{
                              marginTop: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
                              padding: '14px 16px', border: '1px solid var(--border-medium)'
                            }}>
                              {/* Stage label + elapsed */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-white)' }}>
                                  {lipsyncProgress.stageLabel}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                  {Math.floor(lipsyncProgress.elapsedSec / 60)}m {lipsyncProgress.elapsedSec % 60}s elapsed
                                </span>
                              </div>

                              {/* Progress bar track */}
                              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: '99px',
                                  width: `${lipsyncProgress.percent}%`,
                                  background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                                  transition: 'width 1.2s ease',
                                  boxShadow: '0 0 8px rgba(168,85,247,0.6)'
                                }} />
                              </div>

                              {/* Percent + ETA */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700 }}>
                                  {lipsyncProgress.percent}%
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  Est. total: 10–15 min
                                </span>
                              </div>

                              {/* Stage dots */}
                              <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                                {['Audio', 'Landmarks', 'Coefficients', 'Animate', 'Render', 'Enhance', 'Save'].map((s, i) => {
                                  const stagePcts = [10, 22, 38, 55, 72, 88, 96];
                                  const done = lipsyncProgress.percent >= stagePcts[i];
                                  const active = lipsyncProgress.percent >= (stagePcts[i - 1] ?? 0) && !done;
                                  return (
                                    <div key={s} style={{
                                      fontSize: '9px', padding: '2px 7px', borderRadius: '99px', fontWeight: 600,
                                      background: done ? 'rgba(138,75,243,0.25)' : active ? 'rgba(138,75,243,0.12)' : 'rgba(255,255,255,0.04)',
                                      color: done ? 'var(--primary)' : active ? 'var(--text-gray)' : 'var(--text-muted)',
                                      border: `1px solid ${done ? 'rgba(138,75,243,0.4)' : 'transparent'}`
                                    }}>
                                      {done ? '✓ ' : active ? '⟳ ' : ''}{s}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Custom Talking Head Video Upload */}
                          <div>
                            <label className="label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🎥 Upload Talking Head Video
                              <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)', background: 'rgba(138,75,243,0.15)', borderRadius: '4px', padding: '1px 6px' }}>MP4 / MOV / WEBM</span>
                            </label>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                              Upload a pre-recorded video of yourself or your avatar talking. We will automatically extract the audio track to use as the narrator voiceover!
                            </p>

                            <label
                              htmlFor="talking-head-video-upload"
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: '8px', padding: '24px 16px', borderRadius: '10px', cursor: 'pointer',
                                border: originalVideoUrl ? '2px solid var(--primary)' : '1.5px dashed var(--border-medium)',
                                background: originalVideoUrl ? 'rgba(138,75,243,0.06)' : 'rgba(255,255,255,0.015)',
                                transition: 'all 0.2s ease',
                                position: 'relative'
                              }}
                            >
                              {talkingHeadUploading ? (
                                <>
                                  <span style={{ fontSize: '28px' }} className="spin">⏳</span>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>Uploading & Extracting Audio...</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>This may take a moment for larger video files.</span>
                                </>
                              ) : originalVideoUrl ? (
                                <>
                                  <div style={{ position: 'relative' }}>
                                    <video
                                      src={originalVideoUrl}
                                      style={{ width: '120px', height: '68px', borderRadius: '6px', objectFit: 'cover', border: '2px solid var(--primary)', display: 'block' }}
                                    />
                                    <div style={{
                                      position: 'absolute', bottom: -4, right: -4, width: '18px', height: '18px',
                                      background: 'var(--primary)', borderRadius: '50%', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white'
                                    }}>✓</div>
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>Video Uploaded Successfully!</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Click to replace with a different video</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: '28px' }}>📁</span>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-gray)' }}>Click to upload video</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '200px' }}>
                                    Accepts .mp4, .mov, .webm files up to 50MB
                                  </span>
                                </>
                              )}
                              <input
                                id="talking-head-video-upload"
                                type="file"
                                accept=".mp4,.mov,.m4v,.webm,.mkv,.avi"
                                onChange={handleTalkingHeadVideoUpload}
                                disabled={talkingHeadUploading}
                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                              />
                            </label>
                          </div>
                        </>
                      )}

                      {/* Sizing & Positioning Controls */}
                      {(talkingHeadMode === 'overlay' || talkingHeadMode === 'rounded-pip') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-medium)', paddingTop: '12px' }}>
                          <h5 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '4px' }}>PIP Position & Sizing</h5>
                          
                          {/* Sizing Slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-gray)' }}>Overlay Size</span>
                              <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{talkingHeadSize}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="10" 
                              max="100" 
                              value={talkingHeadSize}
                              onChange={(e) => { setTalkingHeadSize(Number(e.target.value)); saveProjectState({ talkingHeadSize: Number(e.target.value) }); }}
                              style={{ width: '100%', accentColor: 'var(--primary)' }}
                            />
                          </div>

                          {/* Position Dropdown Preset */}
                          <div>
                            <label className="label" style={{ fontSize: '11px', color: 'var(--text-gray)', marginBottom: '4px' }}>Position preset</label>
                            <select 
                              className="input-field" 
                              style={{ fontSize: '12px', padding: '6px' }}
                              value={talkingHeadPosition}
                              onChange={(e) => { setTalkingHeadPosition(e.target.value as any); saveProjectState({ talkingHeadPosition: e.target.value }); }}
                            >
                              <option value="bottom-right">Bottom Right</option>
                              <option value="bottom-left">Bottom Left</option>
                              <option value="top-right">Top Right</option>
                              <option value="top-left">Top Left</option>
                              <option value="center">Center</option>
                              <option value="custom">Custom Position (X/Y Sliders)</option>
                            </select>
                          </div>

                          {/* Custom Coordinates */}
                          {talkingHeadPosition === 'custom' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                                  <span style={{ color: 'var(--text-gray)' }}>X Offset</span>
                                  <span style={{ color: 'var(--text-white)' }}>{talkingHeadPositionX}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={talkingHeadPositionX}
                                  onChange={(e) => { setTalkingHeadPositionX(Number(e.target.value)); saveProjectState({ talkingHeadPositionX: Number(e.target.value) }); }}
                                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                                />
                              </div>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                                  <span style={{ color: 'var(--text-gray)' }}>Y Offset</span>
                                  <span style={{ color: 'var(--text-white)' }}>{talkingHeadPositionY}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={talkingHeadPositionY}
                                  onChange={(e) => { setTalkingHeadPositionY(Number(e.target.value)); saveProjectState({ talkingHeadPositionY: Number(e.target.value) }); }}
                                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Column 2: Preview Area */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Character Preview</h4>
                  {originalVideoUrl ? (
                    <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-medium)', background: '#000000', position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                      <video 
                        src={originalVideoUrl} 
                        controls 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      />
                    </div>
                  ) : (
                    <div style={{
                      borderRadius: '8px', border: '1px dashed var(--border-medium)', background: 'var(--bg-darker)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', minHeight: '180px'
                    }}>
                      <span style={{ fontSize: '32px', marginBottom: '12px' }}>🎬</span>
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>No avatar generated yet</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-gray)', marginTop: '4px', maxWidth: '220px' }}>
                        Generate your voiceover first, choose an avatar, and click the lip-sync button to see the preview here.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {renderPreviewPlayer()}
        </div>
      )}

        {/* STEP 5: TRANSITIONS & SFX */}
        {step === 5 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '32px', alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Visuals, Subtitles & Story Graph</h3>

            {/* Sub-step Tab selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-medium)', marginBottom: '24px', gap: '8px' }}>
              <button
                type="button"
                className={`tab-btn ${subStep === 'transitions' ? 'active' : ''}`}
                onClick={() => setSubStep('transitions')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: subStep === 'transitions' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: subStep === 'transitions' ? 'var(--text-white)' : 'var(--text-gray)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                }}
              >
                🎥 Transitions
              </button>
              <button
                type="button"
                className={`tab-btn ${subStep === 'subtitles' ? 'active' : ''}`}
                onClick={() => setSubStep('subtitles')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: subStep === 'subtitles' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: subStep === 'subtitles' ? 'var(--text-white)' : 'var(--text-gray)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                }}
              >
                🔤 Subtitle Styling
              </button>
              <button
                type="button"
                className={`tab-btn ${subStep === 'graph' ? 'active' : ''}`}
                onClick={() => setSubStep('graph')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: subStep === 'graph' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: subStep === 'graph' ? 'var(--text-white)' : 'var(--text-gray)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                }}
              >
                📊 AI Living Scene Graph
              </button>
            </div>

            {subStep === 'transitions' && (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <button className="btn-primary" onClick={handleAutoSuggestAssets} disabled={loading}>
                    <Sparkles size={16} /> Auto-Suggest Transitions & SFX
                  </button>
                  <button className="btn-secondary" onClick={() => handleRegenerateHUD()} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚡ Redo HUD (All Scenes)</span>
                  </button>
                </div>

                {scenes.length > 0 && (
                  <div>
                {/* Column 1: Transitions & SFX Timeline */}
                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Transitions Timeline ({scenes.length} Scenes)</h4>
                  
                  {/* Bulk Actions Control Bar */}
                  <div style={{ 
                    background: 'rgba(255, 255, 255, 0.03)', 
                    border: '1px solid var(--border-light)', 
                    borderRadius: '8px', 
                    padding: '12px 16px', 
                    marginBottom: '16px',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)' }}>
                      Bulk Apply:
                    </span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-gray)' }}>Transition:</span>
                      <select 
                        className="input-field" 
                        style={{ padding: '4px 8px', fontSize: '12px', width: '130px' }}
                        value={bulkTransition}
                        onChange={(e) => setBulkTransition(e.target.value)}
                      >
                        <option value="none">None</option>
                        <option value="fade">Cross Fade</option>
                        <option value="slide-left">Slide Left</option>
                        <option value="slide-right">Slide Right</option>
                        <option value="zoom-in">Zoom In</option>
                        <option value="zoom-out">Zoom Out</option>
                        <option value="shake">Camera Shake</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-gray)' }}>SFX:</span>
                      <select 
                        className="input-field" 
                        style={{ padding: '4px 8px', fontSize: '12px', width: '155px' }}
                        value={bulkSfx}
                        onChange={(e) => setBulkSfx(e.target.value)}
                      >
                        {availableSfx.map(sfx => (
                          <option key={sfx} value={sfx}>{sfx}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      type="button" 
                      className="btn-secondary" 
                      style={{ padding: '5px 12px', fontSize: '12px', height: '30px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleBulkApplyAssets}
                    >
                      Apply to All Scenes
                    </button>
                  </div>

                  <div style={{ maxHeight: '520px', overflowY: 'auto' }} className="custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-medium)' }}>
                          <th style={{ padding: '10px' }}>Scene</th>
                          <th style={{ padding: '10px' }}>Narration Text</th>
                          <th style={{ padding: '10px' }}>Transition Effect</th>
                          <th style={{ padding: '10px' }}>Boundary SFX</th>
                          <th style={{ padding: '10px' }}>Layout</th>
                          <th style={{ padding: '10px' }}>Color Preset</th>
                          <th style={{ padding: '10px' }}>Ambient Sound</th>
                          {talkingHeadEnabled && (talkingHeadMode === 'overlay' || talkingHeadMode === 'rounded-pip') && (
                            <th style={{ padding: '10px', textAlign: 'center' }}>Zoom PIP</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {scenes.map((s, idx) => (
                          <tr 
                            key={idx} 
                            onClick={() => setActiveSceneIdx(idx)}
                            style={{ 
                              borderBottom: '1px solid var(--border-light)', 
                              background: activeSceneIdx === idx 
                                ? 'rgba(212, 175, 55, 0.08)' 
                                : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'),
                              borderLeft: activeSceneIdx === idx ? '3px solid #d4af37' : '3px solid transparent',
                              transition: 'all 0.15s ease',
                              cursor: 'pointer'
                            }}
                          >
                            <td style={{ padding: '10px', fontWeight: 600 }}>#{idx + 1}</td>
                            <td style={{ padding: '10px' }}>
                              <input 
                                type="text" 
                                className="input-field" 
                                style={{ padding: '4px 8px', fontSize: '12px', width: '100%', minWidth: '220px' }}
                                value={s.text}
                                onChange={(e) => handleUpdateSceneText(idx, e.target.value)}
                                onBlur={handleSaveSceneText}
                              />
                              
                              {/* Layout Props Sub-form */}
                              {s.layout && s.layout !== 'graph' && s.layout !== 'full_broll' && (
                                <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-light)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>Layout Parameters:</span>
                                  
                                  {s.layout === 'quote' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Quote Text"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={s.layoutProps?.quoteText || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, quoteText: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Author"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '100px' }}
                                        value={s.layoutProps?.quoteAuthor || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, quoteAuthor: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {s.layout === 'versus' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <input
                                          type="text"
                                          className="input-field"
                                          placeholder="Left Competitor"
                                          style={{ padding: '2px 6px', fontSize: '11px', flex: 1 }}
                                          value={s.layoutProps?.versusLeft || ''}
                                          onChange={(e) => {
                                            const updatedProps = { ...s.layoutProps, versusLeft: e.target.value };
                                            handleUpdateScene(idx, 'layoutProps', updatedProps);
                                          }}
                                        />
                                        <input
                                          type="text"
                                          className="input-field"
                                          placeholder="Right Competitor"
                                          style={{ padding: '2px 6px', fontSize: '11px', flex: 1 }}
                                          value={s.layoutProps?.versusRight || ''}
                                          onChange={(e) => {
                                            const updatedProps = { ...s.layoutProps, versusRight: e.target.value };
                                            handleUpdateScene(idx, 'layoutProps', updatedProps);
                                          }}
                                        />
                                        <input
                                          type="text"
                                          className="input-field"
                                          placeholder="Battle Label"
                                          style={{ padding: '2px 6px', fontSize: '11px', width: '120px' }}
                                          value={s.layoutProps?.versusLabel || ''}
                                          onChange={(e) => {
                                            const updatedProps = { ...s.layoutProps, versusLabel: e.target.value };
                                            handleUpdateScene(idx, 'layoutProps', updatedProps);
                                          }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <input
                                          type="text"
                                          className="input-field"
                                          placeholder="Left Features (comma separated)"
                                          style={{ padding: '2px 6px', fontSize: '11px', flex: 1 }}
                                          value={Array.isArray(s.layoutProps?.versusLeftFeatures) ? s.layoutProps.versusLeftFeatures.join(', ') : ''}
                                          onChange={(e) => {
                                            const updatedProps = {
                                              ...s.layoutProps,
                                              versusLeftFeatures: e.target.value.split(',').map(item => item.trim()).filter(Boolean)
                                            };
                                            handleUpdateScene(idx, 'layoutProps', updatedProps);
                                          }}
                                        />
                                        <input
                                          type="text"
                                          className="input-field"
                                          placeholder="Right Features (comma separated)"
                                          style={{ padding: '2px 6px', fontSize: '11px', flex: 1 }}
                                          value={Array.isArray(s.layoutProps?.versusRightFeatures) ? s.layoutProps.versusRightFeatures.join(', ') : ''}
                                          onChange={(e) => {
                                            const updatedProps = {
                                              ...s.layoutProps,
                                              versusRightFeatures: e.target.value.split(',').map(item => item.trim()).filter(Boolean)
                                            };
                                            handleUpdateScene(idx, 'layoutProps', updatedProps);
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  
                                  {s.layout === 'stat_callout' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Number/Value (e.g. $10M or 1984)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '180px' }}
                                        value={s.layoutProps?.statValue || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, statValue: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Label (e.g. Active Users)"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={s.layoutProps?.statLabel || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, statLabel: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {s.layout === 'timeline_checkpoint' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Milestone Date"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '130px' }}
                                        value={s.layoutProps?.timelineDate || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, timelineDate: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Milestone Title"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={s.layoutProps?.timelineLabel || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, timelineLabel: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}

                                  {s.layout === 'danger_callout' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Warning Title (e.g. DANGER)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '150px' }}
                                        value={s.layoutProps?.dangerTitle || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, dangerTitle: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Warning Description text"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={s.layoutProps?.dangerText || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, dangerText: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {s.layout === 'progress_ratio' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Percentage/Value (e.g. 70)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '150px' }}
                                        value={s.layoutProps?.progressValue || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, progressValue: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Progress Description Label"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={s.layoutProps?.progressLabel || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, progressLabel: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {s.layout === 'pro_tip' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Tip Title (e.g. PRO TIP)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '150px' }}
                                        value={s.layoutProps?.tipTitle || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, tipTitle: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Actionable Tip Text"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={s.layoutProps?.tipText || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, tipText: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {s.layout === 'versus_meter' && (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Left (e.g. iOS)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '110px' }}
                                        value={s.layoutProps?.meterLeft || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, meterLeft: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Right (e.g. Android)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '110px' }}
                                        value={s.layoutProps?.meterRight || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, meterRight: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Left Value % (e.g. 60)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '120px' }}
                                        value={s.layoutProps?.meterValue || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, meterValue: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Label (e.g. Market Share)"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1, minWidth: '100px' }}
                                        value={s.layoutProps?.meterLabel || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, meterLabel: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {s.layout === 'tier_list_ranker' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Rank (S/A/B/C/F)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '100px' }}
                                        value={s.layoutProps?.tierRank || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, tierRank: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Item Ranked (e.g. React)"
                                        style={{ padding: '2px 6px', fontSize: '11px', width: '160px' }}
                                        value={s.layoutProps?.tierItem || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, tierItem: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Label (e.g. Framework Grade)"
                                        style={{ padding: '2px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={s.layoutProps?.tierLabel || ''}
                                        onChange={(e) => {
                                          const updatedProps = { ...s.layoutProps, tierLabel: e.target.value };
                                          handleUpdateScene(idx, 'layoutProps', updatedProps);
                                        }}
                                      />
                                    </div>
                                  )}

                                  {/* Scene-specific position overrides & redo HUD button */}
                                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '10px', color: 'var(--text-gray)' }}>Y Offset:</span>
                                      <input
                                        type="range"
                                        min={0}
                                        max={60}
                                        disabled={applyHUDToAll}
                                        value={s.layoutProps?.cardPositionY !== undefined ? Number(s.layoutProps.cardPositionY) : cardPositionY}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          if (applyHUDToAll) {
                                            setCardPositionY(val);
                                            saveProjectState({ cardPositionY: val });
                                          } else {
                                            const updatedProps = { ...s.layoutProps, cardPositionY: val };
                                            handleUpdateScene(idx, 'layoutProps', updatedProps);
                                          }
                                        }}
                                        style={{ width: '80px', height: '12px', accentColor: applyHUDToAll ? 'var(--text-muted)' : 'var(--primary)', cursor: applyHUDToAll ? 'not-allowed' : 'pointer' }}
                                      />
                                      <span style={{ fontSize: '10px', color: applyHUDToAll ? 'var(--text-muted)' : 'var(--text-white)', minWidth: '24px', fontWeight: 600 }}>
                                        {s.layoutProps?.cardPositionY !== undefined ? s.layoutProps.cardPositionY : cardPositionY}%
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '10px', color: 'var(--text-gray)' }}>Scale:</span>
                                      <input
                                        type="range"
                                        min={0.5}
                                        max={1.8}
                                        step={0.05}
                                        disabled={applyHUDToAll}
                                        value={s.layoutProps?.cardScale !== undefined ? Number(s.layoutProps.cardScale) : cardScale}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          if (applyHUDToAll) {
                                            setCardScale(val);
                                            saveProjectState({ cardScale: val });
                                          } else {
                                            const updatedProps = { ...s.layoutProps, cardScale: val };
                                            handleUpdateScene(idx, 'layoutProps', updatedProps);
                                          }
                                        }}
                                        style={{ width: '80px', height: '12px', accentColor: applyHUDToAll ? 'var(--text-muted)' : 'var(--primary)', cursor: applyHUDToAll ? 'not-allowed' : 'pointer' }}
                                      />
                                      <span style={{ fontSize: '10px', color: applyHUDToAll ? 'var(--text-muted)' : 'var(--text-white)', minWidth: '32px', fontWeight: 600 }}>
                                        {(s.layoutProps?.cardScale !== undefined ? Number(s.layoutProps.cardScale) : cardScale).toFixed(2)}x
                                      </span>
                                    </div>
                                    
                                    {applyHUDToAll && (
                                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        (Global positioning active)
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleRegenerateHUD(idx)}
                                      disabled={loading}
                                      className="btn-secondary"
                                      style={{ padding: '2px 8px', fontSize: '10px', height: '22px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
                                    >
                                      <span>⚡ Redo HUD</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <select 
                                className="input-field" 
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                value={s.transition}
                                onChange={(e) => handleUpdateScene(idx, 'transition', e.target.value)}
                              >
                                <option value="none">None</option>
                                <option value="fade">Cross Fade</option>
                                <option value="slide-left">Slide Left</option>
                                <option value="slide-right">Slide Right</option>
                                <option value="zoom-in">Zoom In</option>
                                <option value="zoom-out">Zoom Out</option>
                                <option value="shake">Camera Shake</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <select 
                                  className="input-field" 
                                  style={{ padding: '4px 8px', fontSize: '12px', flexGrow: 1, minWidth: '130px' }}
                                  value={s.sfx}
                                  onChange={(e) => handleUpdateScene(idx, 'sfx', e.target.value)}
                                >
                                  {availableSfx.map(sfx => (
                                    <option key={sfx} value={sfx}>{sfx}</option>
                                  ))}
                                </select>
                                {s.sfx && s.sfx !== 'none' && (
                                  <button 
                                    type="button" 
                                    onClick={() => playSfxPreview(s.sfx)}
                                    className="btn-icon"
                                    style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)' }}
                                    title="Preview sound effect"
                                  >
                                    <Play size={12} style={{ marginLeft: '1px' }} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <select 
                                className="input-field" 
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                value={s.layout || 'graph'}
                                onChange={(e) => handleUpdateScene(idx, 'layout', e.target.value)}
                              >
                                <option value="graph">🕸️ Graph Map</option>
                                <option value="versus">⚔️ Versus Battle</option>
                                <option value="quote">💬 Quote Card</option>
                                <option value="stat_callout">📊 Stat Counter</option>
                                <option value="timeline_checkpoint">📅 Timeline Node</option>
                                <option value="danger_callout">⚠️ Danger Callout</option>
                                <option value="progress_ratio">📈 Progress Ratio</option>
                                <option value="pro_tip">💡 Pro Tip</option>
                                <option value="versus_meter">⚖️ Versus Slider</option>
                                <option value="tier_list_ranker">🏆 Tier Ranker</option>
                                <option value="full_broll">🎬 Full B-Roll</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <select 
                                className="input-field" 
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                value={s.postProcessingPreset || 'none'}
                                onChange={(e) => handleUpdateScene(idx, 'postProcessingPreset', e.target.value)}
                              >
                                <option value="none">None</option>
                                <option value="vintage_sepia">Vintage Sepia</option>
                                <option value="cyber_neon">Cyberpunk Neon</option>
                                <option value="noir_monochrome">Noir Grayscale</option>
                                <option value="cinematic_warm">Cinematic Warm</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <select 
                                className="input-field" 
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                value={s.ambientSoundscape || 'none'}
                                onChange={(e) => handleUpdateScene(idx, 'ambientSoundscape', e.target.value)}
                              >
                                <option value="none">None</option>
                                <option value="vintage_projector">Vintage Projector</option>
                                <option value="cyberpunk_hum">Cyber Synth Hum</option>
                                <option value="nature_ambience">Nature Wind/Birds</option>
                                <option value="tense_drone">Cinematic Drone</option>
                                <option value="office_chatter">Office Typing</option>
                                <option value="war_rumblings">War Rumbles</option>
                              </select>
                            </td>
                            {talkingHeadEnabled && (talkingHeadMode === 'overlay' || talkingHeadMode === 'rounded-pip') && (
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={!!s.zoomAvatar}
                                  onChange={(e) => handleUpdateScene(idx, 'zoomAvatar', e.target.checked)}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

            {subStep === 'subtitles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
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
                  onSaveFields={(fields) => saveProjectState(fields)}
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
                />
              </div>
            )}



            {subStep === 'graph' && (
              <div>
                {/* Graph generation trigger if empty */}
                {entities.length === 0 ? (
                  <div className="inspector-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
                    <Sparkles size={48} color="var(--primary)" style={{ marginBottom: '16px', opacity: 0.8 }} />
                    <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Generate Living Scene Graph</h4>
                    <p style={{ color: 'var(--text-gray)', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
                      Let Gemini analyze your transcript and storyboard to extract all characters, objects, and concepts. They will be animated automatically on-screen in sync with your script!
                    </p>
                    <button type="button" className="btn-primary" onClick={handleGenerateGraph} disabled={loading} style={{ margin: '0 auto' }}>
                      {loading ? 'Analyzing script...' : '✨ Generate Story Graph using AI'}
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>✓ AI Story Graph Active ({entities.length} Entities)</span>
                        <button type="button" className="btn-secondary" onClick={handleGenerateGraph} disabled={loading} style={{ padding: '6px 12px', fontSize: '11px' }}>
                          🔄 Re-generate Graph
                        </button>
                      </div>
                      <button type="button" className="btn-primary" onClick={() => handleSaveGraph()} style={{ padding: '6px 16px', fontSize: '12px' }}>
                        💾 Save Graph Changes
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Left Column: Entities & Canvas Settings */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Canvas Settings Card */}
                        <div className="inspector-card">
                          <div className="inspector-sub-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                            ⚙️ Graph Canvas Settings
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                              <input
                                type="checkbox"
                                checked={graphSettings.overlayOnBroll}
                                onChange={(e) => {
                                  const updated = { ...graphSettings, overlayOnBroll: e.target.checked };
                                  setGraphSettings(updated);
                                  saveProjectState({ graphSettings: updated });
                                }}
                              />
                              Overlay Graph on B-Roll Footage (HUD Mode)
                            </label>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '4px' }}>
                                <span>B-Roll Opacity (if HUD mode active):</span>
                                <span>{Math.round(graphSettings.brollOpacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.05"
                                max="0.80"
                                step="0.05"
                                value={graphSettings.brollOpacity}
                                onChange={(e) => {
                                  const updated = { ...graphSettings, brollOpacity: Number(e.target.value) };
                                  setGraphSettings(updated);
                                  saveProjectState({ graphSettings: updated });
                                }}
                                style={{ width: '100%', cursor: 'pointer' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Brand Theme & Background Card */}
                        <div className="inspector-card">
                          <div className="inspector-sub-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                            🎨 Visual Brand & Background Theme
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                            {/* Brand Colors */}
                            <div style={{ display: 'flex', gap: '16px' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '6px' }}>
                                  Primary Brand Color:
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input
                                    type="color"
                                    value={brandPrimaryColor}
                                    onChange={(e) => {
                                      setBrandPrimaryColor(e.target.value);
                                      saveProjectState({ brandPrimaryColor: e.target.value });
                                    }}
                                    style={{ width: '36px', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                                  />
                                  <input
                                    type="text"
                                    className="input-field"
                                    value={brandPrimaryColor}
                                    onChange={(e) => {
                                      setBrandPrimaryColor(e.target.value);
                                      saveProjectState({ brandPrimaryColor: e.target.value });
                                    }}
                                    style={{ padding: '6px', fontSize: '12px', flex: 1, fontFamily: 'monospace' }}
                                  />
                                </div>
                              </div>
                              
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '6px' }}>
                                  Secondary Brand Color:
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input
                                    type="color"
                                    value={brandSecondaryColor}
                                    onChange={(e) => {
                                      setBrandSecondaryColor(e.target.value);
                                      saveProjectState({ brandSecondaryColor: e.target.value });
                                    }}
                                    style={{ width: '36px', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                                  />
                                  <input
                                    type="text"
                                    className="input-field"
                                    value={brandSecondaryColor}
                                    onChange={(e) => {
                                      setBrandSecondaryColor(e.target.value);
                                      saveProjectState({ brandSecondaryColor: e.target.value });
                                    }}
                                    style={{ padding: '6px', fontSize: '12px', flex: 1, fontFamily: 'monospace' }}
                                  />
                                </div>
                              </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />

                            {/* Canvas Background Color */}
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '6px' }}>
                                Canvas Background Color:
                              </label>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="color"
                                  value={backgroundColor}
                                  onChange={(e) => {
                                    setBackgroundColor(e.target.value);
                                    saveProjectState({ backgroundColor: e.target.value });
                                  }}
                                  style={{ width: '36px', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  value={backgroundColor}
                                  onChange={(e) => {
                                    setBackgroundColor(e.target.value);
                                    saveProjectState({ backgroundColor: e.target.value });
                                  }}
                                  style={{ padding: '6px', fontSize: '12px', flex: 1, fontFamily: 'monospace' }}
                                />
                              </div>
                            </div>

                            {/* Background Pattern Presets */}
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '6px' }}>
                                Background Pattern Style:
                              </label>
                              <select
                                className="input-field"
                                value={backgroundPattern}
                                onChange={(e) => {
                                  setBackgroundPattern(e.target.value as any);
                                  saveProjectState({ backgroundPattern: e.target.value });
                                }}
                                style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                              >
                                <option value="grid">Grid Pattern Presets</option>
                                <option value="dots">Polka Dots Pattern Presets</option>
                                <option value="radial">Radial Glow Presets</option>
                                <option value="none">No Pattern (Solid Color)</option>
                              </select>
                            </div>

                            {/* Background Image Upload */}
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-gray)', marginBottom: '6px' }}>
                                Custom Background Image:
                              </label>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder="Background Image URL..."
                                  value={backgroundImageUrl}
                                  onChange={(e) => {
                                    setBackgroundImageUrl(e.target.value);
                                    saveProjectState({ backgroundImageUrl: e.target.value });
                                  }}
                                  style={{ padding: '8px', fontSize: '12px' }}
                                />
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBgImageUpload}
                                    style={{ display: 'none' }}
                                    id="bg-image-upload-input"
                                  />
                                  <label
                                    htmlFor="bg-image-upload-input"
                                    className="btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', textAlign: 'center', flex: 1 }}
                                  >
                                    📤 Upload Image File
                                  </label>
                                  {backgroundImageUrl && (
                                    <button
                                      type="button"
                                      className="btn-danger"
                                      onClick={() => {
                                        setBackgroundImageUrl('');
                                        saveProjectState({ backgroundImageUrl: '' });
                                      }}
                                      style={{ padding: '6px 12px', fontSize: '11px' }}
                                    >
                                      🗑 Clear
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Entities Manager Card */}
                        <div className="inspector-card" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                          <div className="inspector-sub-title" style={{ fontSize: '12px', fontWeight: 600 }}>Entity Manager</div>
                          
                          {/* Add entity form */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="New Entity Name..."
                              style={{ padding: '6px 10px', fontSize: '12px', flexGrow: 1 }}
                              value={newEntityName}
                              onChange={(e) => setNewEntityName(e.target.value)}
                            />
                            <select
                              className="input-field"
                              style={{ padding: '6px 8px', fontSize: '12px', width: '110px' }}
                              value={newEntityType}
                              onChange={(e) => setNewEntityType(e.target.value)}
                            >
                              <option value="character">👤 Character</option>
                              <option value="object">📦 Object</option>
                              <option value="concept">💡 Concept</option>
                              <option value="organization">🏢 Company</option>
                              <option value="location">📍 Location</option>
                            </select>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleAddEntity}
                              style={{ padding: '0 12px', fontSize: '12px' }}
                            >
                              +
                            </button>
                          </div>

                          {/* List of entities */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {entities.map(entity => (
                              <div key={entity.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '4px 8px', fontSize: '12px', flexGrow: 1 }}
                                  value={entity.name}
                                  onChange={(e) => handleUpdateEntity(entity.id, 'name', e.target.value)}
                                  onBlur={() => handleSaveGraph()}
                                />
                                <select
                                  className="input-field"
                                  style={{ padding: '4px 8px', fontSize: '12px', width: '110px' }}
                                  value={entity.type}
                                  onChange={(e) => {
                                    handleUpdateEntity(entity.id, 'type', e.target.value);
                                    handleSaveGraph();
                                  }}
                                >
                                  <option value="character">👤 Character</option>
                                  <option value="object">📦 Object</option>
                                  <option value="concept">💡 Concept</option>
                                  <option value="organization">🏢 Company</option>
                                  <option value="location">📍 Location</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntity(entity.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                                  title="Delete Entity"
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Scene Timeline Editor */}
                      <div>
                        <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Scene Graph Interactions</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                          {scenes.map((scene, sceneIdx) => {
                            const eventsForScene = graphEvents
                              .map((ev, originalIdx) => ({ ...ev, originalIdx }))
                              .filter(ev => ev.sceneIndex === sceneIdx);
                            
                            const formState = localEventForm[sceneIdx] || {
                              action: 'introduce',
                              entityId: entities[0]?.id || '',
                              fromEntityId: entities[0]?.id || '',
                              toEntityId: entities[0]?.id || '',
                              label: '',
                              x: 50,
                              y: 50
                            };

                            return (
                              <div key={sceneIdx} className="inspector-card" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.01)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Scene #{sceneIdx + 1} ({(scene.start_time || 0).toFixed(1)}s - {(scene.end_time || 0).toFixed(1)}s)</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Duration: {((scene.end_time || 0) - (scene.start_time || 0)).toFixed(1)}s</span>
                                </div>
                                <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-gray)', marginBottom: '8px', lineHeight: '1.4' }}>
                                  "{scene.text}"
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                  <label className="label" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Graph Context Caption (On-Screen)</label>
                                  <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. Steve Jobs founds Apple"
                                    style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                                    value={scene.graphContext || ''}
                                    onChange={(e) => {
                                      const updated = [...scenes];
                                      updated[sceneIdx] = { ...updated[sceneIdx], graphContext: e.target.value };
                                      setScenes(updated);
                                    }}
                                    onBlur={() => saveProjectState({ scenes })}
                                  />
                                </div>

                                {/* List existing scene events */}
                                {eventsForScene.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                    {eventsForScene.map(ev => {
                                      const entity = entities.find(e => e.id === ev.entityId);
                                      const fromNode = entities.find(e => e.id === ev.fromEntityId);
                                      const toNode = entities.find(e => e.id === ev.toEntityId);

                                      return (
                                        <div key={ev.originalIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                          <div style={{ flexGrow: 1, display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {ev.action === 'introduce' && (
                                              <>
                                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>[Introduce]</span>
                                                <span style={{ fontWeight: 700 }}>{entity?.name || ev.entityId}</span>
                                                <span>at</span>
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                  <span>X:</span>
                                                  <input
                                                    type="number"
                                                    className="input-field"
                                                    style={{ padding: '2px 4px', fontSize: '11px', width: '45px', textAlign: 'center' }}
                                                    min="10" max="90"
                                                    value={ev.x ?? 50}
                                                    onChange={(e) => handleUpdateEventProperty(ev.originalIdx, 'x', Number(e.target.value))}
                                                    onBlur={() => handleSaveGraph()}
                                                  />
                                                  <span>Y:</span>
                                                  <input
                                                    type="number"
                                                    className="input-field"
                                                    style={{ padding: '2px 4px', fontSize: '11px', width: '45px', textAlign: 'center' }}
                                                    min="10" max="90"
                                                    value={ev.y ?? 50}
                                                    onChange={(e) => handleUpdateEventProperty(ev.originalIdx, 'y', Number(e.target.value))}
                                                    onBlur={() => handleSaveGraph()}
                                                  />
                                                </div>
                                              </>
                                            )}
                                            {ev.action === 'remove' && (
                                              <>
                                                <span style={{ color: 'var(--error)', fontWeight: 600 }}>[Remove]</span>
                                                <span style={{ fontWeight: 700 }}>{entity?.name || ev.entityId}</span>
                                              </>
                                            )}
                                            {ev.action === 'highlight' && (
                                              <>
                                                <span style={{ color: '#f39c12', fontWeight: 600 }}>[Highlight]</span>
                                                <span style={{ fontWeight: 700 }}>{entity?.name || ev.entityId}</span>
                                              </>
                                            )}
                                            {ev.action === 'connect' && (
                                              <>
                                                <span style={{ color: '#2ecc71', fontWeight: 600 }}>[Link]</span>
                                                <span style={{ fontWeight: 700 }}>{fromNode?.name || ev.fromEntityId}</span>
                                                <span>➔</span>
                                                <span style={{ fontWeight: 700 }}>{toNode?.name || ev.toEntityId}</span>
                                                <span>as</span>
                                                <input
                                                  type="text"
                                                  className="input-field"
                                                  placeholder="label..."
                                                  style={{ padding: '2px 6px', fontSize: '11px', width: '80px' }}
                                                  value={ev.label || ''}
                                                  onChange={(e) => handleUpdateEventProperty(ev.originalIdx, 'label', e.target.value)}
                                                  onBlur={() => handleSaveGraph()}
                                                />
                                              </>
                                            )}
                                            {ev.action === 'disconnect' && (
                                              <>
                                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>[Unlink]</span>
                                                <span style={{ fontWeight: 700 }}>{fromNode?.name || ev.fromEntityId}</span>
                                                <span>-x-</span>
                                                <span style={{ fontWeight: 700 }}>{toNode?.name || ev.toEntityId}</span>
                                              </>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteEvent(ev.originalIdx)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
                                            title="Remove Event"
                                          >
                                            ❌
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Add Event Form inline */}
                                <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,255,255,0.015)', border: '1px dashed var(--border-light)', borderRadius: '6px' }}>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <select
                                      className="input-field"
                                      style={{ padding: '4px 6px', fontSize: '11px', width: '100px' }}
                                      value={formState.action}
                                      onChange={(e) => handleUpdateEventForm(sceneIdx, 'action', e.target.value)}
                                    >
                                      <option value="introduce">Introduce</option>
                                      <option value="remove">Remove</option>
                                      <option value="highlight">Highlight</option>
                                      <option value="connect">Link Nodes</option>
                                      <option value="disconnect">Unlink Nodes</option>
                                    </select>

                                    {/* Action target pickers */}
                                    {(formState.action === 'introduce' || formState.action === 'remove' || formState.action === 'highlight') && (
                                      <select
                                        className="input-field"
                                        style={{ padding: '4px 6px', fontSize: '11px', flexGrow: 1 }}
                                        value={formState.entityId}
                                        onChange={(e) => handleUpdateEventForm(sceneIdx, 'entityId', e.target.value)}
                                      >
                                        <option value="">-- Choose Node --</option>
                                        {entities.map(ent => (
                                          <option key={ent.id} value={ent.id}>{ent.name}</option>
                                        ))}
                                      </select>
                                    )}

                                    {formState.action === 'introduce' && (
                                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '11px' }}>
                                        <span>X:</span>
                                        <input
                                          type="number"
                                          className="input-field"
                                          style={{ padding: '4px', width: '40px', textAlign: 'center', fontSize: '11px' }}
                                          value={formState.x}
                                          min="10" max="90"
                                          onChange={(e) => handleUpdateEventForm(sceneIdx, 'x', Number(e.target.value))}
                                        />
                                        <span>Y:</span>
                                        <input
                                          type="number"
                                          className="input-field"
                                          style={{ padding: '4px', width: '40px', textAlign: 'center', fontSize: '11px' }}
                                          value={formState.y}
                                          min="10" max="90"
                                          onChange={(e) => handleUpdateEventForm(sceneIdx, 'y', Number(e.target.value))}
                                        />
                                      </div>
                                    )}

                                    {(formState.action === 'connect' || formState.action === 'disconnect') && (
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexGrow: 1 }}>
                                        <select
                                          className="input-field"
                                          style={{ padding: '4px 6px', fontSize: '11px', width: '45%' }}
                                          value={formState.fromEntityId}
                                          onChange={(e) => handleUpdateEventForm(sceneIdx, 'fromEntityId', e.target.value)}
                                        >
                                          <option value="">-- From --</option>
                                          {entities.map(ent => (
                                            <option key={ent.id} value={ent.id}>{ent.name}</option>
                                          ))}
                                        </select>
                                        <span>➔</span>
                                        <select
                                          className="input-field"
                                          style={{ padding: '4px 6px', fontSize: '11px', width: '45%' }}
                                          value={formState.toEntityId}
                                          onChange={(e) => handleUpdateEventForm(sceneIdx, 'toEntityId', e.target.value)}
                                        >
                                          <option value="">-- To --</option>
                                          {entities.map(ent => (
                                            <option key={ent.id} value={ent.id}>{ent.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}

                                    {formState.action === 'connect' && (
                                      <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Link description (e.g. founded)"
                                        style={{ padding: '4px 8px', fontSize: '11px', width: '100%', marginTop: '6px' }}
                                        value={formState.label}
                                        onChange={(e) => handleUpdateEventForm(sceneIdx, 'label', e.target.value)}
                                      />
                                    )}

                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={() => handleAddEvent(sceneIdx)}
                                      style={{ padding: '4px 10px', fontSize: '11px', flexGrow: 1, marginTop: '6px' }}
                                    >
                                      ➕ Add visual event
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
            {renderPreviewPlayer()}
          </div>
        )}

        {/* STEP 6: RENDER & PROMOTION */}
        {step === 6 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '32px', alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Render Long-Form Video & Generate Short Reel</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Video Compiler</h4>
                <p style={{ color: 'var(--text-gray)', fontSize: '12px', marginBottom: '16px', lineHeight: '1.5' }}>
                  Render the full 8-minute value-heavy video. Dynamic transitions, subtitle styling, zooming Ken Burns B-rolls, and sound effects will be baked in.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label className="label" style={{ fontSize: '11px' }}>Export Resolution</label>
                    <select className="input-field" style={{ padding: '6px 10px', fontSize: '12px' }} value={exportResolution} onChange={(e) => { setExportResolution(e.target.value); saveProjectState({ exportResolution: e.target.value }); }}>
                      <option value="1080p">Full HD (1080p)</option>
                      <option value="2k">QHD / 2K (1440p)</option>
                      <option value="4k">Ultra HD / 4K (2160p)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '11px' }}>Frame Rate (FPS)</label>
                    <select className="input-field" style={{ padding: '6px 10px', fontSize: '12px' }} value={exportFps} onChange={(e) => { setExportFps(Number(e.target.value)); saveProjectState({ exportFps: Number(e.target.value) }); }}>
                      <option value="30">30 FPS (Standard)</option>
                      <option value="60">60 FPS (Ultra Smooth)</option>
                    </select>
                  </div>
                </div>

                <button className="btn-primary" onClick={handleCompileVideo} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                  <Rocket size={16} /> Compile Long-Form Video
                </button>

                {renderedVideoUrl && (
                  <div style={{ marginTop: '24px' }}>
                    <h5 style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--success)' }}>✓ Compilation Complete! Preview:</h5>
                    <video src={renderedVideoUrl} controls style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-medium)' }} />
                  </div>
                )}
              </div>

              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '24px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="var(--accent-purple)" /> Promo Short Form Reel
                </h4>
                <p style={{ color: 'var(--text-gray)', fontSize: '12px', marginBottom: '16px', lineHeight: '1.5' }}>
                  Once your video is generated, click the button below to automatically extract the suspense hook, write a cliffhanger short script, generate audio, download portrait B-roll clips, and create a promotional reel!
                </p>
                <button className="btn-primary" onClick={handleGenerateShortPromo} disabled={loading} style={{ width: '100%', justifyContent: 'center', background: 'var(--accent-purple)' }}>
                  <Sparkles size={16} /> Generate Suspense Short Reel
                </button>

                {shortProjectId && (
                  <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', padding: '16px', borderRadius: '8px', marginTop: '20px', fontSize: '12px' }}>
                    <strong>Linked Short Project Created!</strong><br />
                    Project ID: {shortProjectId.substring(0, 8)}...<br />
                    Navigate to "My Projects" or click "Voiceover Video" to edit/compile the Short form version!
                  </div>
                )}
              </div>
            </div>
            
            {/* Create Another Video Banner */}
            <div className="glass-panel" style={{ marginTop: '32px', padding: '20px', background: 'rgba(139, 92, 246, 0.03)', border: '1px solid var(--border-medium)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Finished with this video?</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-gray)' }}>
                  Start a fresh YouTube video project to scale your channel empire.
                </p>
              </div>
              <button className="btn-secondary" onClick={handleStartNewProject} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Create Another YouTube Video
              </button>
            </div>
            </div>
            {renderPreviewPlayer()}
          </div>
        )}
      </div>

      {/* WIZARD ACTIONS NAV BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          className="btn-secondary" 
          onClick={() => setStep(prev => Math.max(1, prev - 1))} 
          disabled={step === 1 || loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ChevronLeft size={16} /> Back
        </button>

        <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>
          Step {step} of 6
        </span>

        <button 
          className="btn-primary" 
          onClick={() => setStep(prev => Math.min(6, prev + 1))} 
          disabled={step === 6 || loading || (step === 2 && !scriptText) || (step === 3 && scenes.length === 0)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
