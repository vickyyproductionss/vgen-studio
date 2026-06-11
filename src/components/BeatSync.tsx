import React, { useState, useEffect, useRef } from 'react';
import { Zap, Upload, Play, Pause, Trash2, Music, Video, Activity, ChevronRight, AlertTriangle, CheckCircle, RefreshCw, Scissors, Sparkles, Type } from 'lucide-react';

interface ClipSegment {
  start_time: number;
  end_time: number;
  description: string;
}

interface Clip {
  id: string;
  name: string;
  description: string;
  duration: number;
  thumbnail: string;
  exists?: boolean;
  segments?: ClipSegment[];
}

interface BGM {
  id: string;
  path: string;
  name: string;
  duration: number;
}

interface WordTiming {
  word: string;
  start_time: number;
  end_time: number;
  sfx?: string;
}

interface BeatScene {
  text: string;
  text_hindi?: string;
  text_hinglish?: string;
  start_time: number;
  end_time: number;
  clipId?: string;
  clipStart?: number;
  reason?: string;
  words?: WordTiming[];
  words_hindi?: WordTiming[];
  words_hinglish?: WordTiming[];
  pingPong?: boolean;
  isBeatSyncOnly?: boolean;
  transition?: string;
  sfx?: string;
}

interface WordStyle {
  fontColor: string;
  activeWordScale: number;
  neonGlow: boolean;
  glowColor: string;
  glowBlur: number;
  glowDistance: number;
}

const CURATED_FONTS = [
  'Arial',
  'Anton',
  'Bangers',
  'Kalam',
  'Kalam Light',
  'Kalam Bold',
  'Inter',
  'Poppins',
  'Roboto',
  'Montserrat',
  'Oswald',
  'Playfair Display',
  'Lora',
  'Lilita One',
  'Fredoka',
  'Pacifico',
  'Caveat',
  'Rubik',
  'Bebas Neue',
  'Righteous',
  'Lobster',
  'Cinzel',
  'Titan One',
  'Shadows Into Light',
  'Satisfy',
  'Comfortaa',
  'Bree Serif',
  'Exo 2',
  'Creepster',
  'Impact',
  'Courier New',
  'Times New Roman'
];

const SFX_CATEGORIES = [
  {
    name: 'Video Transitions',
    items: [
      { id: 'trans_swoosh_fast', name: 'Snappy Swoosh', desc: 'Clean, high-frequency whip/swish.' },
      { id: 'trans_swoosh_deep', name: 'Cinematic Whoosh', desc: 'Low-end heavy, sub-bass air rush.' },
      { id: 'trans_glitch_digital', name: 'Glitch / Static', desc: 'Digital stutter, pixelation hiss.' },
      { id: 'trans_shutter_click', name: 'Shutter & Flash', desc: 'Crisp mechanical camera shutter click.' },
      { id: 'trans_vhs_rewind', name: 'Tape Rewind', desc: 'Vintage tape reverse spooling.' },
      { id: 'trans_paper_slide', name: 'Page Slide / Turn', desc: 'Dry paper friction slide or page flip.' }
    ]
  },
  {
    name: 'Subtitles & Reveals',
    items: [
      { id: 'reveal_pop_bubble', name: 'Bubble Pop', desc: 'Light, organic, high-pitched plop.' },
      { id: 'reveal_kb_click', name: 'Keyboard Tap', desc: 'Mechanical keyboard switch click.' },
      { id: 'reveal_ding_bell', name: 'Snappy Ding', desc: 'Desk bell ding or chime.' },
      { id: 'reveal_swoosh_zip', name: 'Micro Zip', desc: 'Tiny, high-pitched air zip.' },
      { id: 'reveal_chime_sweet', name: 'Synth Chime', desc: 'Gentle, ascending synth chime.' }
    ]
  },
  {
    name: 'Dramatic Hooks',
    items: [
      { id: 'hook_bass_drop', name: 'Sub Bass Rumble', desc: 'Massive, clean sub-octave boom.' },
      { id: 'hook_vinyl_scratch', name: 'Record Scratch', desc: 'Sharp DJ vinyl stop/scratch.' },
      { id: 'hook_metal_hit', name: 'Cinematic Metal Hit', desc: 'Heavy metallic hit with deep resonance.' },
      { id: 'hook_woosh_hit', name: 'Whoosh To Hit', desc: 'Rising whoosh to drum/impact hit.' },
      { id: 'hook_cymbal_swell', name: 'Reversed Cymbal', desc: 'Soft air hiss rising to a sharp cutoff.' }
    ]
  },
  {
    name: 'UI & Interactive',
    items: [
      { id: 'ui_button_click', name: 'Snappy Click', desc: 'Subtle, hollow click.' },
      { id: 'ui_success_chime', name: 'Happy Ping', desc: 'Optimistic double-tone chime.' },
      { id: 'ui_error_buzz', name: 'Error Buzz', desc: 'Soft, double-pulse warning buzzer.' },
      { id: 'ui_trash_crumple', name: 'Paper Crumple', desc: 'Quick trash bin paper crunch.' }
    ]
  }
];

interface VideoPreviewProps {
  clipId: string;
  thumbnail: string;
  clipStart: number;
  isActive: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ clipId, thumbnail, clipStart, isActive }) => {
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
      src={`/api/clips/${clipId}/video`}
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

interface BeatSyncProps {
  projectId: string | null;
  onStartRender: (jobId: string) => void;
}

const enforceMinimumSegmentDuration = (segs: any[]) => {
  if (!segs || segs.length <= 1) return segs;
  
  const minDuration = 2.0;
  const result: any[] = [];
  const segsCopy = segs.map(s => ({ ...s }));
  
  for (let i = 0; i < segsCopy.length; i++) {
    const current = segsCopy[i];
    const dur = current.end_time - current.start_time;
    
    if (dur < minDuration) {
      if (result.length > 0) {
        const prev = result[result.length - 1];
        prev.end_time = Number(current.end_time.toFixed(3));
        prev.text = ((prev.text || '') + ' ' + (current.text || '')).trim();
        prev.text_hindi = ((prev.text_hindi || '') + ' ' + (current.text_hindi || '')).trim();
        prev.text_hinglish = ((prev.text_hinglish || '') + ' ' + (current.text_hinglish || '')).trim();
        
        prev.words = [...(prev.words || []), ...(current.words || [])];
        prev.words_hindi = [...(prev.words_hindi || []), ...(current.words_hindi || [])];
        prev.words_hinglish = [...(prev.words_hinglish || []), ...(current.words_hinglish || [])];
        
        if (current.isBeatSyncOnly && prev.isBeatSyncOnly) {
          prev.isBeatSyncOnly = true;
        } else {
          delete prev.isBeatSyncOnly;
        }
      } else if (i + 1 < segsCopy.length) {
        const next = segsCopy[i + 1];
        next.start_time = Number(current.start_time.toFixed(3));
        next.text = ((current.text || '') + ' ' + (next.text || '')).trim();
        next.text_hindi = ((current.text_hindi || '') + ' ' + (next.text_hindi || '')).trim();
        next.text_hinglish = ((current.text_hinglish || '') + ' ' + (next.text_hinglish || '')).trim();
        
        next.words = [...(current.words || []), ...(next.words || [])];
        next.words_hindi = [...(current.words_hindi || []), ...(next.words_hindi || [])];
        next.words_hinglish = [...(current.words_hinglish || []), ...(next.words_hinglish || [])];
        
        if (current.isBeatSyncOnly && next.isBeatSyncOnly) {
          next.isBeatSyncOnly = true;
        } else {
          delete next.isBeatSyncOnly;
        }
      } else {
        result.push(current);
      }
    } else {
      result.push(current);
    }
  }
  
  if (result.length > 1) {
    const lastIdx = result.length - 1;
    const last = result[lastIdx];
    const lastDur = last.end_time - last.start_time;
    if (lastDur < minDuration) {
      const prev = result[lastIdx - 1];
      prev.end_time = Number(last.end_time.toFixed(3));
      prev.text = ((prev.text || '') + ' ' + (last.text || '')).trim();
      prev.text_hindi = ((prev.text_hindi || '') + ' ' + (last.text_hindi || '')).trim();
      prev.text_hinglish = ((prev.text_hinglish || '') + ' ' + (last.text_hinglish || '')).trim();
      
      prev.words = [...(prev.words || []), ...(last.words || [])];
      prev.words_hindi = [...(prev.words_hindi || []), ...(last.words_hindi || [])];
      prev.words_hinglish = [...(prev.words_hinglish || []), ...(last.words_hinglish || [])];
      
      if (last.isBeatSyncOnly && prev.isBeatSyncOnly) {
        prev.isBeatSyncOnly = true;
      } else {
        delete prev.isBeatSyncOnly;
      }
      result.pop();
    }
  }
  
  return result;
};

export default function BeatSync({ projectId, onStartRender }: BeatSyncProps) {
  // Library lists
  const [clips, setClips] = useState<Clip[]>([]);
  const [bgms, setBgms] = useState<BGM[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'subtitles' | 'video' | 'audio'>('audio');
  
  // Selected Audio Track state
  const [audioSource, setAudioSource] = useState<'upload' | 'music_library' | 'video_library'>('upload');
  const [audioPath, setAudioPath] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [selectedVideoClipId, setSelectedVideoClipId] = useState('');
  
  // Analysis parameters
  const [syncMode, setSyncMode] = useState<'beats' | 'dialogue'>('beats');
  const [threshold, setThreshold] = useState(1.4);
  const [geminiKeySet, setGeminiKeySet] = useState(false);
  const [activeLang, setActiveLang] = useState<'hinglish' | 'hindi'>('hinglish');
  const [mergeShortScenes, setMergeShortScenes] = useState(true);
  const [rawScenes, setRawScenes] = useState<BeatScene[]>([]);
  const [boundaries, setBoundaries] = useState<number[]>([]);
  const [scenes, setScenes] = useState<BeatScene[]>([]);

  const handleToggleMergeScenes = (shouldMerge: boolean) => {
    setMergeShortScenes(shouldMerge);
    if (rawScenes && rawScenes.length > 0) {
      const processed = shouldMerge 
        ? enforceMinimumSegmentDuration(rawScenes)
        : rawScenes;
      
      // Rebuild boundaries
      const bounds: number[] = [0.0];
      processed.forEach((seg: any) => {
        bounds.push(seg.end_time);
      });
      bounds.push(audioDuration);
      const sortedBounds = Array.from(new Set(bounds)).sort((a, b) => a - b);
      
      setBoundaries(sortedBounds);
      
      const mappedScenes: BeatScene[] = processed.map((seg: any) => ({
        text: activeLang === 'hindi' ? (seg.text_hindi || seg.text || '') : (seg.text_hinglish || seg.text || ''),
        text_hindi: seg.text_hindi || '',
        text_hinglish: seg.text_hinglish || '',
        start_time: seg.start_time,
        end_time: seg.end_time,
        clipId: seg.clipId || '',
        clipStart: seg.clipStart || 0,
        reason: seg.reason || '',
        words: activeLang === 'hindi' ? (seg.words_hindi || seg.words || []) : (seg.words_hinglish || seg.words || []),
        words_hindi: seg.words_hindi || [],
        words_hinglish: seg.words_hinglish || [],
        isBeatSyncOnly: seg.isBeatSyncOnly || false
      }));
      setScenes(mappedScenes);
    }
  };
  const [sfxList, setSfxList] = useState<{ id: string; name: string }[]>([]);

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

  const [miniBeats, setMiniBeats] = useState<number[]>([]);
  const [miniBeatEffect, setMiniBeatEffect] = useState<'none' | 'blink' | 'shake' | 'both'>('none');
  
  // Subtitle styling states
  const [subtitleMode, setSubtitleMode] = useState<'classic' | 'pop' | 'smart-highlight' | 'centered-word'>('smart-highlight');
  const [fontName, setFontName] = useState('Arial');
  const [fontSelectorOpen, setFontSelectorOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [fontLoading, setFontLoading] = useState(false);
  const [fontDownloadError, setFontDownloadError] = useState('');
  const [fontSize, setFontSize] = useState(24);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [shadow, setShadow] = useState(true);
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [showHighlightBox, setShowHighlightBox] = useState(false);
  const [boxColor, setBoxColor] = useState('#8A4BF3');
  const [boxRounding, setBoxRounding] = useState(8);
  const [textFade, setTextFade] = useState(true);
  const [textMotion, setTextMotion] = useState<string>('none');
  const [textTransition, setTextTransition] = useState<string>('none');
  const [activeWordScale, setActiveWordScale] = useState(1.15);
  const [wordDisplayTime, setWordDisplayTime] = useState(1.0);
  const [textPositionX, setTextPositionX] = useState(0);
  const [textPositionY, setTextPositionY] = useState(-70);
  const [showEmojis, setShowEmojis] = useState(false);
  const [autoEmphasis, setAutoEmphasis] = useState(false);
  const [emphasisColor, setEmphasisColor] = useState('#FFFF00');
  const [neonGlow, setNeonGlow] = useState(false);
  const [glowColor, setGlowColor] = useState('#00FFFF');
  const [glowBlur, setGlowBlur] = useState(6);
  const [glowDistance, setGlowDistance] = useState(3);
  const [highlightTrigger, setHighlightTrigger] = useState<'all' | 'emphasis' | 'emoji'>('all');
  const [pop3d, setPop3d] = useState(false);
  const [pop3dColor, setPop3dColor] = useState('#000000');

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
  const [brandingTheme, setBrandingTheme] = useState<'none' | 'fitness-in-chunks'>('none');
  const [seriesName, setSeriesName] = useState('FITNESSINCHUNKS');
  const [episodeNumber, setEpisodeNumber] = useState('EP 01');
  const [nextEpisode, setNextEpisode] = useState('EP 02');
  
  const [normalStyle, setNormalStyle] = useState<WordStyle>({
    fontColor: '#FFFFFF',
    activeWordScale: 1.0,
    neonGlow: false,
    glowColor: '#00FFFF',
    glowBlur: 6,
    glowDistance: 3
  });
  const [highlightStyle, setHighlightStyle] = useState<WordStyle>({
    fontColor: '#FFFF00',
    activeWordScale: 1.15,
    neonGlow: false,
    glowColor: '#00FFFF',
    glowBlur: 6,
    glowDistance: 3
  });
  const [emojiStyle, setEmojiStyle] = useState<WordStyle>({
    fontColor: '#FFFF00',
    activeWordScale: 1.15,
    neonGlow: false,
    glowColor: '#00FFFF',
    glowBlur: 6,
    glowDistance: 3
  });
  const [styleTab, setStyleTab] = useState<'normal' | 'highlight' | 'emoji'>('normal');
  
  // UI states
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasLoadedProject, setHasLoadedProject] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Beat Sync Project');
  const [hoveredSceneIdx, setHoveredSceneIdx] = useState<number | null>(null);
  const [activeSliderIdx, setActiveSliderIdx] = useState<number | null>(null);

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
      console.error('Failed to rename beat sync project:', err);
    }
  };
  
  // Audio preview player
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewingSfx, setPreviewingSfx] = useState<string | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlaySfx = (sfxId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
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

  // Formatting settings (Right Column)
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [fillMode, setFillMode] = useState<'crop' | 'fit'>('crop');
  const [clipTransition, setClipTransition] = useState<string>('none');
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const [beatEffects, setBeatEffects] = useState({
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
    pingPong: false,
    preset: 'none' as string
  });
  const applyPreset = (presetName: string) => {
    const presets: Record<string, any> = {
      aggressive: { whiteFlash: true, whiteFlashIntensity: 0.8, rgbSplit: true, rgbSplitPixels: 8, speedRamp: true, speedRampHold: 0.1, whipPan: true, whipPanStrength: 35, bassBounce: true, bassBounceScale: 1.08, preset: 'aggressive' },
      cinematic: { speedRamp: true, speedRampHold: 0.15, colorFlash: true, colorFlashTint: '#FF6B00', vignettePulse: true, letterbox: true, letterboxSize: 50, filmGrain: true, filmGrainAmount: 10, preset: 'cinematic' },
      glitch: { rgbSplit: true, rgbSplitPixels: 10, glitchTear: true, glitchTearPixels: 25, negativeFlash: true, whiteFlash: true, whiteFlashIntensity: 0.5, preset: 'glitch' },
      clean: { bassBounce: true, bassBounceScale: 1.06, vignettePulse: true, preset: 'clean' }
    };
    if (presetName === 'none') {
      setBeatEffects({ whiteFlash: false, whiteFlashIntensity: 0.6, rgbSplit: false, rgbSplitPixels: 6, bassBounce: false, bassBounceScale: 1.06, speedRamp: false, speedRampHold: 0.1, whipPan: false, whipPanStrength: 30, spinTransition: false, spinDegrees: 90, colorFlash: false, colorFlashTint: '#FF6B00', glitchTear: false, glitchTearPixels: 20, filmGrain: false, filmGrainAmount: 12, letterbox: false, letterboxSize: 50, vignettePulse: false, negativeFlash: false, pingPong: false, preset: 'none' });
    } else {
      setBeatEffects(prev => ({ ...prev, whiteFlash: false, rgbSplit: false, bassBounce: false, speedRamp: false, whipPan: false, spinTransition: false, colorFlash: false, glitchTear: false, filmGrain: false, letterbox: false, vignettePulse: false, negativeFlash: false, pingPong: false, ...presets[presetName] }));
    }
  };
  const [zoomAnimation, setZoomAnimation] = useState(true);
  const [exportResolution, setExportResolution] = useState<'1080p' | '2k' | '4k'>('1080p');
  const [exportFps, setExportFps] = useState<24 | 30 | 60>(30);


  // Reset audio preview when audioUrl changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, [audioUrl]);

  async function fetchProjectState() {
    if (!projectId) {
      setHasLoadedProject(true);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProjectName(data.name || 'Untitled Beat Sync Project');
        const state = data.state || {};
        
        if (state.audioSource !== undefined) setAudioSource(state.audioSource);
        if (state.audioPath !== undefined) setAudioPath(state.audioPath);
        if (state.audioUrl !== undefined) setAudioUrl(state.audioUrl);
        if (state.audioName !== undefined) setAudioName(state.audioName);
        if (state.audioDuration !== undefined) setAudioDuration(state.audioDuration);
        if (state.selectedVideoClipId !== undefined) setSelectedVideoClipId(state.selectedVideoClipId);
        if (state.syncMode !== undefined) setSyncMode(state.syncMode);
        if (state.threshold !== undefined) setThreshold(state.threshold);
        if (state.activeLang !== undefined) setActiveLang(state.activeLang);
        if (state.mergeShortScenes !== undefined) setMergeShortScenes(state.mergeShortScenes);
        if (state.rawScenes !== undefined) {
          setRawScenes(state.rawScenes);
        } else if (state.scenes !== undefined) {
          setRawScenes(state.scenes);
        }
        if (state.boundaries !== undefined) setBoundaries(state.boundaries);
        if (state.scenes !== undefined) setScenes(state.scenes);
        if (state.miniBeats !== undefined) setMiniBeats(state.miniBeats);
        if (state.miniBeatEffect !== undefined) setMiniBeatEffect(state.miniBeatEffect);
        if (state.aspectRatio !== undefined) setAspectRatio(state.aspectRatio);
        if (state.fillMode !== undefined) setFillMode(state.fillMode);
        if (state.clipTransition !== undefined) setClipTransition(state.clipTransition);
        if (state.transitionDuration !== undefined) setTransitionDuration(state.transitionDuration);
        if (state.beatEffects !== undefined) setBeatEffects(prev => ({ ...prev, ...state.beatEffects }));
        if (state.zoomAnimation !== undefined) setZoomAnimation(state.zoomAnimation);
        if (state.exportResolution !== undefined) setExportResolution(state.exportResolution);
        if (state.exportFps !== undefined) setExportFps(state.exportFps);

        // Subtitle styling states
        if (state.subtitleMode !== undefined) setSubtitleMode(state.subtitleMode);
        if (state.fontName !== undefined) setFontName(state.fontName);
        if (state.fontSize !== undefined) setFontSize(state.fontSize);
        if (state.fontColor !== undefined) setFontColor(state.fontColor);
        if (state.outlineColor !== undefined) setOutlineColor(state.outlineColor);
        if (state.bold !== undefined) setBold(state.bold);
        if (state.italic !== undefined) setItalic(state.italic);
        if (state.shadow !== undefined) setShadow(state.shadow);
        if (state.highlightColor !== undefined) setHighlightColor(state.highlightColor);
        if (state.showHighlightBox !== undefined) setShowHighlightBox(state.showHighlightBox);
        if (state.boxColor !== undefined) setBoxColor(state.boxColor);
        if (state.boxRounding !== undefined) setBoxRounding(state.boxRounding);
        if (state.textFade !== undefined) setTextFade(state.textFade);
        if (state.textTransition !== undefined) setTextTransition(state.textTransition);
        if (state.textMotion !== undefined) setTextMotion(state.textMotion);
        if (state.activeWordScale !== undefined) setActiveWordScale(state.activeWordScale);
        if (state.wordDisplayTime !== undefined) setWordDisplayTime(state.wordDisplayTime);
        if (state.textPositionX !== undefined) setTextPositionX(state.textPositionX);
        if (state.textPositionY !== undefined) setTextPositionY(state.textPositionY);
        if (state.showEmojis !== undefined) setShowEmojis(state.showEmojis);
        if (state.autoEmphasis !== undefined) setAutoEmphasis(state.autoEmphasis);
        if (state.emphasisColor !== undefined) setEmphasisColor(state.emphasisColor);
        if (state.neonGlow !== undefined) setNeonGlow(state.neonGlow);
        if (state.glowColor !== undefined) setGlowColor(state.glowColor);
        if (state.glowBlur !== undefined) setGlowBlur(state.glowBlur);
        if (state.glowDistance !== undefined) setGlowDistance(state.glowDistance);
        if (state.highlightTrigger !== undefined) setHighlightTrigger(state.highlightTrigger);
        if (state.pop3d !== undefined) setPop3d(state.pop3d);
        if (state.pop3dColor !== undefined) setPop3dColor(state.pop3dColor);

        const norm = state.normalStyle || {
          fontColor: state.fontColor || '#FFFFFF',
          activeWordScale: 1.0,
          neonGlow: !!state.neonGlow,
          glowColor: state.glowColor || '#00FFFF',
          glowBlur: state.glowBlur !== undefined ? state.glowBlur : 6,
          glowDistance: state.glowDistance !== undefined ? state.glowDistance : 3
        };
        const high = state.highlightStyle || {
          fontColor: state.highlightColor || '#FFFF00',
          activeWordScale: state.activeWordScale !== undefined ? state.activeWordScale : 1.15,
          neonGlow: !!state.neonGlow,
          glowColor: state.glowColor || '#00FFFF',
          glowBlur: state.glowBlur !== undefined ? state.glowBlur : 6,
          glowDistance: state.glowDistance !== undefined ? state.glowDistance : 3
        };
        const emoj = state.emojiStyle || {
          fontColor: state.highlightColor || '#FFFF00',
          activeWordScale: state.activeWordScale !== undefined ? state.activeWordScale : 1.15,
          neonGlow: !!state.neonGlow,
          glowColor: state.glowColor || '#00FFFF',
          glowBlur: state.glowBlur !== undefined ? state.glowBlur : 6,
          glowDistance: state.glowDistance !== undefined ? state.glowDistance : 3
        };
        setNormalStyle(norm);
        setHighlightStyle(high);
        setEmojiStyle(emoj);

        if (state.headingTitle !== undefined) setHeadingTitle(state.headingTitle);
        if (state.headingFontName !== undefined) setHeadingFontName(state.headingFontName);
        if (state.headingFontSize !== undefined) setHeadingFontSize(state.headingFontSize);
        if (state.headingFontColor !== undefined) setHeadingFontColor(state.headingFontColor);
        if (state.headingBoxColor !== undefined) setHeadingBoxColor(state.headingBoxColor);
        if (state.headingPadding !== undefined) setHeadingPadding(state.headingPadding);
        if (state.showTimer !== undefined) setShowTimer(state.showTimer);
        if (state.headingTopOffset !== undefined) setHeadingTopOffset(state.headingTopOffset);
        if (state.headingLeftOffset !== undefined) setHeadingLeftOffset(state.headingLeftOffset);
        if (state.headingBoxOpacity !== undefined) setHeadingBoxOpacity(state.headingBoxOpacity);
        if (state.headingTextOpacity !== undefined) setHeadingTextOpacity(state.headingTextOpacity);
        if (state.brandingTheme !== undefined) setBrandingTheme(state.brandingTheme);
        if (state.seriesName !== undefined) setSeriesName(state.seriesName);
        if (state.episodeNumber !== undefined) setEpisodeNumber(state.episodeNumber);
        if (state.nextEpisode !== undefined) setNextEpisode(state.nextEpisode);
      }
    } catch (err) {
      console.error('Failed to load beat sync project state:', err);
    } finally {
      setHasLoadedProject(true);
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (!hasLoadedProject || !projectId) return;

    const saveProjectState = async () => {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: {
              audioSource,
              audioPath,
              audioUrl,
              audioName,
              audioDuration,
              selectedVideoClipId,
              syncMode,
              threshold,
              activeLang,
              mergeShortScenes,
              rawScenes,
              boundaries,
              scenes,
              miniBeats,
              miniBeatEffect,
              aspectRatio,
              fillMode,
              clipTransition,
              transitionDuration,
              beatEffects,
              zoomAnimation,
              exportResolution,
              exportFps,
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
              showEmojis,
              autoEmphasis,
              emphasisColor,
              neonGlow,
              glowColor,
              glowBlur,
              glowDistance,
              highlightTrigger,
              pop3d,
              pop3dColor,
              normalStyle,
              highlightStyle,
              emojiStyle,
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
              nextEpisode
            }
          })
        });
      } catch (err) {
        console.error('Failed to autosave beat sync project:', err);
      }
    };

    const delayDebounce = setTimeout(() => {
      saveProjectState();
    }, 1000);

    return () => clearTimeout(delayDebounce);
  }, [
    audioSource,
    audioPath,
    audioUrl,
    audioName,
    audioDuration,
    selectedVideoClipId,
    syncMode,
    threshold,
    activeLang,
    mergeShortScenes,
    rawScenes,
    boundaries,
    scenes,
    miniBeats,
    miniBeatEffect,
    aspectRatio,
    fillMode,
    clipTransition,
    transitionDuration,
    beatEffects,
    zoomAnimation,
    exportResolution,
    exportFps,
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
    showEmojis,
    autoEmphasis,
    emphasisColor,
    neonGlow,
    glowColor,
    glowBlur,
    glowDistance,
    highlightTrigger,
    pop3d,
    pop3dColor,
    hasLoadedProject,
    projectId,
    normalStyle,
    highlightStyle,
    emojiStyle,
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
    nextEpisode
  ]);

  // Load Google Font style dynamically in the document head
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
    link.href = `https://fonts.googleapis.com/css2?family=${targetFont.replace(/\s+/g, '+')}:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap`;
    document.head.appendChild(link);
  };

  // Pre-load font stylesheet on mount or change
  useEffect(() => {
    if (fontName) {
      try {
        loadGoogleFont(fontName);
      } catch (err) {
        console.warn('Load active font error:', err);
      }
    }
  }, [fontName]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!fontSelectorOpen) return;
    const handleClose = () => setFontSelectorOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [fontSelectorOpen]);

  // Handler to add custom google font
  const handleAddCustomFont = async (customFont: string) => {
    setFontLoading(true);
    setFontDownloadError('');
    try {
      const res = await fetch('/api/fonts/ensure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

  const filteredFonts = CURATED_FONTS.filter(font =>
    font.toLowerCase().includes(fontSearchQuery.toLowerCase())
  );

  async function fetchClips() {
    try {
      const res = await fetch('/api/clips');
      if (res.ok) {
        const data = await res.json();
        setClips(data);
      }
    } catch (err) {
      console.error('Failed to fetch clips:', err);
    }
  };

  async function fetchBgms() {
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

  async function checkSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        setGeminiKeySet(!!settings.geminiApiKey);
      }
    } catch (err) {
      console.error('Failed to check API settings:', err);
    }
  };

  // Fetch initial data & project state
  useEffect(() => {
    const init = async () => {
      setHasLoadedProject(false);
      await fetchClips();
      await fetchBgms();
      await checkSettings();
      await fetchProjectState();
    };
    init();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
      }
    };
  }, [projectId]);


  // Audio Previews control
  const togglePlayAudio = () => {
    if (!audioUrl) return;
    
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
      setPreviewingSfx(null);
    }
    
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle uploaded audio file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');
    setIsPlaying(false);
    setSelectedVideoClipId('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error('Failed to upload file.');
      }

      const data = await res.json();
      setAudioPath(data.audioPath);
      setAudioUrl(data.audioUrl);
      setAudioName(file.name);

      // Fetch duration of the uploaded audio track
      const durRes = await fetch(`/api/bgms/duration?path=${encodeURIComponent(data.audioPath)}`);
      if (durRes.ok) {
        const durData = await durRes.json();
        setAudioDuration(durData.duration || 10.0);
      } else {
        setAudioDuration(10.0); // fallback
      }

      setSuccess('File uploaded and processed successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Select audio from music library
  const handleSelectLibraryAudio = (path: string) => {
    const selected = bgms.find(b => b.path === path);
    if (!selected) return;

    setError('');
    setSuccess('');
    setIsPlaying(false);
    setSelectedVideoClipId('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setAudioPath(selected.path);
    setAudioUrl(`/uploads/music/${path.split('/').pop()}`);
    setAudioName(selected.name);
    setAudioDuration(selected.duration || 10.0);
  };

  // Extract and select audio from Video Library
  const handleExtractFromLibraryVideo = async (clipId: string) => {
    if (!clipId) return;

    setError('');
    setSuccess('');
    setIsPlaying(false);
    setUploading(true);
    setSelectedVideoClipId(clipId);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const res = await fetch('/api/clips/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId })
      });

      if (!res.ok) {
        throw new Error('Failed to extract audio from video clip.');
      }

      const data = await res.json();
      setAudioPath(data.audioPath);
      setAudioUrl(data.audioUrl);
      
      const clip = clips.find(c => c.id === clipId);
      setAudioName(clip ? `Audio from ${clip.name}` : 'Extracted Video Audio');

      // Fetch duration of the extracted audio track
      const durRes = await fetch(`/api/bgms/duration?path=${encodeURIComponent(data.audioPath)}`);
      if (durRes.ok) {
        const durData = await durRes.json();
        setAudioDuration(durData.duration || clip?.duration || 10.0);
      } else {
        setAudioDuration(clip?.duration || 10.0);
      }

      setSuccess('Audio successfully extracted from video clip!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Run audio analysis (beat detection or speech alignment)
  const handleAnalyzeAudio = async () => {
    if (!audioPath) {
      setError('Please upload or select an audio track first.');
      return;
    }

    setAnalyzing(true);
    setError('');
    setSuccess('');

    try {
      if (syncMode === 'beats') {
        const res = await fetch('/api/beat-sync/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioPath, threshold })
        });

        if (!res.ok) {
          throw new Error('Beat detection failed.');
        }

        const data = await res.json();
        const detectedBeats = data.beats || [];
        const detectedMiniBeats = data.miniBeats || [];
        
        // Rebuild boundaries starting at 0.0 and ending at total audio duration
        const bounds = [0.0, ...detectedBeats, audioDuration].sort((a, b) => a - b);
        // Clean duplicate bounds
        const uniqueBounds = bounds.filter((val, i, arr) => i === 0 || val > arr[i-1] + 0.05);

        setBoundaries(uniqueBounds);
        setScenes(rebuildScenes(uniqueBounds));
        setMiniBeats(detectedMiniBeats);
        setSuccess(`Beat analysis complete! Detected ${detectedBeats.length} major cuts and ${detectedMiniBeats.length} sub-beats.`);
      } else {
        setMiniBeats([]);
        // Spoken Dialogue: call /api/align-script with empty script text
        const res = await fetch('/api/align-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptText: '', audioPath, mergeShortScenes: false })
        });

        if (!res.ok) {
          throw new Error('Dialogue boundary analysis failed.');
        }

        const data = await res.json();
        const segments = data.segments || [];
        setRawScenes(segments);

        const processedSegments = mergeShortScenes
          ? enforceMinimumSegmentDuration(segments)
          : segments;

        // Build boundaries from dialogue segment timings
        const bounds: number[] = [0.0];
        processedSegments.forEach((seg: any) => {
          bounds.push(seg.end_time);
        });
        bounds.push(audioDuration);
        
        const sortedBounds = Array.from(new Set(bounds)).sort((a, b) => a - b);
        setBoundaries(sortedBounds);

        // Map dialogue segments directly to scenes
        const mappedScenes: BeatScene[] = processedSegments.map((seg: any) => ({
          text: activeLang === 'hindi' ? (seg.text_hindi || seg.text || '') : (seg.text_hinglish || seg.text || ''),
          text_hindi: seg.text_hindi || '',
          text_hinglish: seg.text_hinglish || '',
          start_time: seg.start_time,
          end_time: seg.end_time,
          clipId: seg.clipId || '',
          clipStart: seg.clipStart || 0,
          reason: seg.reason || '',
          words: activeLang === 'hindi' ? (seg.words_hindi || seg.words || []) : (seg.words_hinglish || seg.words || []),
          words_hindi: seg.words_hindi || [],
          words_hinglish: seg.words_hinglish || [],
          isBeatSyncOnly: seg.isBeatSyncOnly || false
        }));

        setScenes(mappedScenes);
        setSuccess(`Dialogue aligned! Extracted ${segments.length} spoken phrases.`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Helper to clamp and adjust word timings strictly within segment start/end times
  const clampWordTimings = (wordsList: WordTiming[], start: number, end: number): WordTiming[] => {
    if (!wordsList || wordsList.length === 0) return [];
    const duration = end - start;
    
    // 1. Initial localization relative to start
    const localWords = wordsList.map(w => ({
      word: w.word,
      start: w.start_time - start,
      end: w.end_time - start,
      sfx: w.sfx
    }));

    const N = localWords.length;
    const safeDuration = Math.max(0.01, duration);
    const W = Math.max(0.001, Math.min(0.08, safeDuration / N));

    // 2. Adjust starts to fit in [0, duration] with minimum spacing W
    const starts: number[] = [];
    for (let i = 0; i < N; i++) {
      const idealStart = localWords[i].start;
      const minStart = i * W;
      const maxStart = safeDuration - (N - i) * W;
      const clampedStart = Math.max(minStart, Math.min(maxStart, idealStart));
      starts.push(clampedStart);
    }

    // 3. Compute ends
    const adjustedWords: WordTiming[] = [];
    for (let i = 0; i < N; i++) {
      const originalDur = Math.max(W, localWords[i].end - localWords[i].start);
      const startVal = starts[i];
      const nextStart = (i < N - 1) ? starts[i + 1] : safeDuration;
      const endVal = Math.min(nextStart, startVal + originalDur);
      adjustedWords.push({
        word: localWords[i].word,
        start_time: Number((start + startVal).toFixed(3)),
        end_time: Number((start + endVal).toFixed(3)),
        sfx: localWords[i].sfx
      });
    }

    return adjustedWords;
  };

  // Rebuild scenes list from sorted boundaries list
  const rebuildScenes = (bounds: number[], currentScenes: BeatScene[] = []) => {
    const sorted = [...bounds].sort((a, b) => a - b);
    const newScenes: BeatScene[] = [];
    
    // Gather all words across all current scenes
    const allWords = currentScenes.flatMap(s => s.words || []);
    const allWordsHindi = currentScenes.flatMap(s => s.words_hindi || []);
    const allWordsHinglish = currentScenes.flatMap(s => s.words_hinglish || []);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      
      // Find all original scenes that overlap with [start, end]
      const overlappingScenes = currentScenes.filter(s => {
        const overlapStart = Math.max(start, s.start_time);
        const overlapEnd = Math.min(end, s.end_time);
        return (overlapEnd - overlapStart) > 0.01; // positive overlap
      });
      
      // The best match is the one with the maximum overlap duration
      let bestMatch: BeatScene | null = null;
      let maxOverlap = -1;
      for (const s of overlappingScenes) {
        const overlapStart = Math.max(start, s.start_time);
        const overlapEnd = Math.min(end, s.end_time);
        const overlap = overlapEnd - overlapStart;
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestMatch = s;
        }
      }
      
      // Filter words for this time range and clamp them strictly to new scene bounds
      const filteredWords = allWords.filter(w => w.start_time >= start && w.start_time < end);
      const filteredWordsHindi = allWordsHindi.filter(w => w.start_time >= start && w.start_time < end);
      const filteredWordsHinglish = allWordsHinglish.filter(w => w.start_time >= start && w.start_time < end);

      const sceneWords = clampWordTimings(filteredWords, start, end);
      const sceneWordsHindi = clampWordTimings(filteredWordsHindi, start, end);
      const sceneWordsHinglish = clampWordTimings(filteredWordsHinglish, start, end);
      
      // Determine text
      let text: string;
      if (sceneWords.length > 0) {
        text = sceneWords.map(w => w.word).join(' ');
      } else if (overlappingScenes.length > 0) {
        // Concatenate texts of overlapping scenes
        text = overlappingScenes.map(s => s.text).filter(Boolean).join(' ');
      } else {
        text = bestMatch?.text || '';
      }

      // Determine text_hindi
      let text_hindi: string;
      if (sceneWordsHindi.length > 0) {
        text_hindi = sceneWordsHindi.map(w => w.word).join(' ');
      } else if (overlappingScenes.length > 0) {
        text_hindi = overlappingScenes.map(s => s.text_hindi).filter(Boolean).join(' ');
      } else {
        text_hindi = bestMatch?.text_hindi || '';
      }

      // Determine text_hinglish
      let text_hinglish: string;
      if (sceneWordsHinglish.length > 0) {
        text_hinglish = sceneWordsHinglish.map(w => w.word).join(' ');
      } else if (overlappingScenes.length > 0) {
        text_hinglish = overlappingScenes.map(s => s.text_hinglish).filter(Boolean).join(' ');
      } else {
        text_hinglish = bestMatch?.text_hinglish || '';
      }
      
      // Determine clip offset: if this is a split, we want the second half to start later!
      let clipStart = bestMatch?.clipStart || 0;
      if (bestMatch && start > bestMatch.start_time) {
        // If this new scene starts after the original matching scene started,
        // we shift the clip start by the difference to keep the video continuous!
        clipStart = parseFloat((clipStart + (start - bestMatch.start_time)).toFixed(2));
      }
      
      newScenes.push({
        text,
        text_hindi,
        text_hinglish,
        start_time: start,
        end_time: end,
        clipId: bestMatch?.clipId || '',
        clipStart: clipStart,
        reason: bestMatch?.reason || '',
        words: sceneWords,
        words_hindi: sceneWordsHindi,
        words_hinglish: sceneWordsHinglish,
        pingPong: bestMatch?.pingPong || false,
        isBeatSyncOnly: bestMatch?.isBeatSyncOnly || false
      });
    }
    return newScenes;
  };

  const handleToggleAllLanguage = (lang: 'hinglish' | 'hindi') => {
    setActiveLang(lang);
    const updated = scenes.map(scene => {
      if (scene.isBeatSyncOnly) {
        return scene;
      }
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
  };

  // Adjust segment boundary (Roll Edit)
  const adjustBoundary = (idx: number, delta: number) => {
    if (idx <= 0 || idx >= boundaries.length - 1) return; // Cannot edit start (0) or end (duration)
    
    const newBounds = [...boundaries];
    const prevBound = newBounds[idx - 1];
    const nextBound = newBounds[idx + 1];

    const targetVal = newBounds[idx] + delta;
    // Enforce minimum segment size of 0.2 seconds
    newBounds[idx] = Math.max(prevBound + 0.2, Math.min(nextBound - 0.2, parseFloat(targetVal.toFixed(2))));

    setBoundaries(newBounds);
    setScenes(rebuildScenes(newBounds, scenes));
  };

  // Split a segment in half (inserts a new beat/cut boundary)
  const handleSplitSegment = (idx: number) => {
    const scene = scenes[idx];
    const midPoint = parseFloat(((scene.start_time + scene.end_time) / 2).toFixed(2));

    const newBounds = [...boundaries, midPoint].sort((a, b) => a - b);
    setBoundaries(newBounds);
    const rebuilt = rebuildScenes(newBounds, scenes);
    setScenes(rebuilt);
    setRawScenes(rebuilt);
    setSuccess('Segment split successfully.');
  };

  // Delete a boundary (merges segment idx with idx + 1)
  const handleMergeSegment = (idx: number) => {
    if (idx >= scenes.length - 1) return; // cannot merge last segment
    
    // The boundary to remove is at index idx + 1
    const newBounds = boundaries.filter((_: number, i: number) => i !== idx + 1);
    setBoundaries(newBounds);
    const rebuilt = rebuildScenes(newBounds, scenes);
    setScenes(rebuilt);
    setRawScenes(rebuilt);
    setSuccess('Merged adjacent segments.');
  };

  // Update specific parameters on a segment
  const updateSceneClip = (idx: number, clipId: string) => {
    const updated = [...scenes];
    updated[idx].clipId = clipId;
    updated[idx].clipStart = 0;
    setScenes(updated);
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

  const updateSceneSfx = (idx: number, sfx: string) => {
    const updated = [...scenes];
    updated[idx].sfx = sfx;
    setScenes(updated);
  };

  const handleRecommendTransitionsAndSfx = () => {
    const transitionSfxMap: { [key: string]: string } = {
      'slide-left': 'trans_swoosh_fast',
      'slide-right': 'trans_swoosh_fast',
      'zoom-in': 'trans_swoosh_deep',
      'zoom-out': 'trans_swoosh_deep',
      'fade': 'trans_swoosh_fast',
      'blur-zoom-in': 'trans_swoosh_deep'
    };

    const updated = scenes.map((scene, idx) => {
      if (idx === scenes.length - 1) {
        return { ...scene, transition: 'none', sfx: 'none' };
      }

      const text = (scene.text || '').toLowerCase();
      let transition: string;
      let sfx: string;

      if (text.includes('gym') || text.includes('workout') || text.includes('strong') || text.includes('heavy') || text.includes('beast') || text.includes('lift') || text.includes('deadlift')) {
        transition = 'zoom-in';
        sfx = 'trans_swoosh_deep';
      } else if (text.includes('money') || text.includes('rich') || text.includes('wealth') || text.includes('success') || text.includes('target')) {
        transition = 'fade';
        sfx = 'trans_swoosh_fast';
      } else if (text.includes('danger') || text.includes('warning') || text.includes('stop') || text.includes('never') || text.includes('secret')) {
        transition = 'zoom-out';
        sfx = 'trans_swoosh_deep';
      } else {
        const pool = ['slide-left', 'slide-right', 'fade', 'zoom-in'];
        transition = pool[idx % pool.length];
        sfx = transitionSfxMap[transition] || 'trans_swoosh_fast';
      }

      return { ...scene, transition, sfx };
    });

    setScenes(updated);
    setSuccess('Transitions & SFXs recommended successfully!');
  };

  const updateSceneText = (idx: number, text: string) => {
    const updated = [...scenes];
    updated[idx].text = text;
    setScenes(updated);
  };

  // Auto assign clips to all segments
  const handleAutoMatchClips = async () => {
    if (scenes.length === 0) return;
    setMatching(true);
    setError('');

    try {
      if (syncMode === 'dialogue' && geminiKeySet) {
        // Dialogue: Run Semantic Match via Gemini
        const res = await fetch('/api/match-clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenes })
        });

        if (!res.ok) {
          throw new Error('Semantic auto-matching failed.');
        }

        const data = await res.json();
        const updated = [...scenes];
        data.matches.forEach((match: any) => {
          if (updated[match.sceneIndex]) {
            updated[match.sceneIndex].clipId = match.clipId;
            updated[match.sceneIndex].clipStart = match.clipStart;
            updated[match.sceneIndex].reason = match.reason;
          }
        });
        setScenes(updated);
        setSuccess('AI Semantic matching complete!');
      } else {
        // Music Beats: Random clip + random segment + random offset within segment for each beat scene
        const availableClips = clips.filter(c => c.exists !== false);
        if (availableClips.length === 0) {
          throw new Error('Video Library is empty or all clips are missing on disk. Import clips first.');
        }
        const updated = [...scenes];
        const usedClips = new Set<string>();
        const usedSegments = new Set<string>(); // Format: "clipId_segmentIndex"

        updated.forEach((scene, sceneIdx) => {
          const sceneDuration = scene.end_time - scene.start_time;
          let selectedClip: any = null;
          let selectedSegIdx = 0;
          let selectedSegment: any = null;

          // 1. Try to find a completely unused clip first
          const unusedClips = availableClips.filter(c => !usedClips.has(c.id));
          if (unusedClips.length > 0) {
            selectedClip = unusedClips[Math.floor(Math.random() * unusedClips.length)];
            const segments = selectedClip.segments || [];
            if (segments.length > 0) {
              selectedSegIdx = Math.floor(Math.random() * segments.length);
              selectedSegment = segments[selectedSegIdx];
            }
          } else {
            // 2. If all clips are used, try to find a clip that has an unused segment
            const clipsWithUnusedSegments = availableClips.filter(c => {
              const segments = c.segments || [];
              if (segments.length === 0) {
                // If a clip has no segments, treat the whole clip as segment 0
                return !usedSegments.has(`${c.id}_0`);
              }
              return segments.some((_: ClipSegment, idx: number) => !usedSegments.has(`${c.id}_${idx}`));
            });

            if (clipsWithUnusedSegments.length > 0) {
              selectedClip = clipsWithUnusedSegments[Math.floor(Math.random() * clipsWithUnusedSegments.length)];
              const segments = selectedClip.segments || [];
              if (segments.length > 0) {
                const unusedIndices = segments
                  .map((_: ClipSegment, idx: number) => idx)
                  .filter((idx: number) => !usedSegments.has(`${selectedClip.id}_${idx}`));
                selectedSegIdx = unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
                selectedSegment = segments[selectedSegIdx];
              } else {
                selectedSegIdx = 0;
                selectedSegment = null;
              }
            } else {
              // 3. Fallback: all segments of all clips have been used. Reuse any random clip and segment,
              // but try to avoid the one used in the previous scene.
              const prevScene = sceneIdx > 0 ? updated[sceneIdx - 1] : null;
              const allowedClips = prevScene 
                ? availableClips.filter(c => c.id !== prevScene.clipId)
                : availableClips;
              const pool = allowedClips.length > 0 ? allowedClips : availableClips;
              
              selectedClip = pool[Math.floor(Math.random() * pool.length)];
              const segments = selectedClip.segments || [];
              if (segments.length > 0) {
                selectedSegIdx = Math.floor(Math.random() * segments.length);
                selectedSegment = segments[selectedSegIdx];
              } else {
                selectedSegIdx = 0;
                selectedSegment = null;
              }
            }
          }

          // Mark as used
          usedClips.add(selectedClip.id);
          usedSegments.add(`${selectedClip.id}_${selectedSegIdx}`);

          // Calculate clipStart within the selected segment
          let clipStart: number;
          let pickedSegmentDesc = '';

          if (selectedSegment) {
            const segmentStart = selectedSegment.start_time;
            const segmentEnd = selectedSegment.end_time;
            const segmentDuration = segmentEnd - segmentStart;
            pickedSegmentDesc = ` (Segment: "${selectedSegment.description}")`;

            const maxStart = Math.max(0, selectedClip.duration - sceneDuration);
            if (maxStart > 0) {
              if (segmentDuration >= sceneDuration) {
                const minS = segmentStart;
                const maxS = Math.min(maxStart, segmentEnd - sceneDuration);
                if (minS <= maxS) {
                  clipStart = minS + Math.random() * (maxS - minS);
                } else {
                  clipStart = Math.max(0, Math.min(segmentStart, maxStart));
                }
              } else {
                const minS = Math.max(0, segmentEnd - sceneDuration);
                const maxS = Math.min(maxStart, segmentStart);
                if (minS <= maxS) {
                  clipStart = minS + Math.random() * (maxS - minS);
                } else {
                  clipStart = Math.max(0, Math.min(segmentStart, maxStart));
                }
              }
            } else {
              clipStart = 0;
            }
          } else {
            const maxStart = Math.max(0, selectedClip.duration - sceneDuration);
            clipStart = maxStart > 0 ? Math.random() * maxStart : 0;
          }

          clipStart = parseFloat(clipStart.toFixed(2));
          scene.clipId = selectedClip.id;
          scene.clipStart = clipStart;
          scene.reason = `Random pick: ${selectedClip.name}${pickedSegmentDesc} @ ${clipStart.toFixed(1)}s`;
        });
        setScenes(updated);
        setSuccess('Smart clip and segment assignment complete! Click again to re-shuffle.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMatching(false);
    }
  };

  const handleCompileVideo = async () => {
    if (scenes.length === 0) {
      setError('Please analyze audio and generate beat segments first.');
      return;
    }
    if (scenes.some(s => !s.clipId)) {
      setError('All beat segments must have an assigned video clip.');
      return;
    }

    setCompiling(true);
    setError('');

    try {
      // Re-use backend generate-video endpoint
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          scenes,
          voiceoverPath: audioPath, // User's beat audio is treated as the primary voiceover track
          bgMusicPath: '', // No voiceover background mixing needed
          aspectRatio,
          fillMode,
          clipTransition,
          transitionDuration,
          beatEffects,
          zoomAnimation,
          exportResolution,
          exportFps,
          miniBeats,
          miniBeatEffect,
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
            showEmojis,
            autoEmphasis,
            emphasisColor,
            neonGlow,
            glowColor,
            glowBlur,
            glowDistance,
            highlightTrigger,
            pop3d,
            pop3dColor,
            normalStyle,
            highlightStyle,
            emojiStyle,
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
            nextEpisode
          }
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit compile job.');
      }

      const data = await res.json();
      onStartRender(data.jobId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCompiling(false);
    }
  };

  // Calculate splicing issues
  const hasSplicingError = scenes.some(scene => {
    if (!scene.clipId) return false;
    const clip = clips.find(c => c.id === scene.clipId);
    if (!clip) return false;
    const duration = scene.end_time - scene.start_time;
    return (scene.clipStart || 0) + duration > clip.duration + 0.001;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' }}>
      
      {/* LEFT COLUMN: Beat sync timelines and segment editor */}
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '28px', marginBottom: '8px', display: 'flex', alignItems: 'center' }} className="heading-page">
            <Zap size={24} style={{ color: 'var(--accent-purple)', marginRight: '10px', flexShrink: 0 }} />
            {projectId ? (
              <input
                type="text"
                value={projectName}
                onChange={(e) => handleRenameProject(e.target.value)}
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  width: '100%',
                  padding: 0,
                  borderBottom: '1px dashed transparent',
                  cursor: 'text'
                }}
                onFocus={(e) => {
                  e.target.style.borderBottomColor = 'var(--accent-purple)';
                }}
                onBlur={(e) => {
                  e.target.style.borderBottomColor = 'transparent';
                }}
                placeholder="Project Name"
              />
            ) : (
              "Beat Sync Editor"
            )}
          </h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '14px' }}>
            Sync video cuts perfectly to music drops, shayaris, or dialogue transitions.
          </p>
        </div>

        {error && (
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#4ade80', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {scenes.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-gray)', borderStyle: 'dashed', borderWidth: '2px', borderRadius: '8px', marginBottom: '24px' }}>
            <Music size={48} style={{ color: 'var(--accent-purple)', marginBottom: '16px', margin: '0 auto' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px', fontFamily: 'Outfit' }}>No audio analyzed yet</h3>
            <p style={{ color: 'var(--text-gray)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 24px auto', fontFamily: 'Inter' }}>
              Go to the "Audio" tab in the right sidebar to select a music track or voiceover, configure sync parameters, and run beat analysis.
            </p>
          </div>
        )}

        {/* STEP 3: Timeline Aligned Segment Editor */}
        {scenes.length > 0 && (
          <section className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="heading-component" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scissors size={18} style={{ color: 'var(--accent-purple)' }} />
                Step 3: Timeline Roll-Edit List
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {syncMode === 'dialogue' && (
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
                )}

                {syncMode === 'dialogue' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '0 12px', borderRadius: '24px', border: '1px solid var(--border-medium)', height: '32px' }}>
                    <input
                      type="checkbox"
                      id="merge-short-scenes-storyboard"
                      checked={mergeShortScenes}
                      onChange={(e) => handleToggleMergeScenes(e.target.checked)}
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    <label htmlFor="merge-short-scenes-storyboard" style={{ fontSize: '11px', fontWeight: '500', cursor: 'pointer', color: 'var(--text-white)', userSelect: 'none' }}>
                      Merge short (&lt; 2s)
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRecommendTransitionsAndSfx}
                  className="btn-secondary"
                  disabled={clips.length === 0}
                  style={{ fontSize: '12px', height: '32px', padding: '0 12px', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' }}
                >
                  <Sparkles size={12} />
                  Auto-Recommend SFX & Transition
                </button>
                <button
                  type="button"
                  onClick={handleAutoMatchClips}
                  className="btn-secondary"
                  disabled={matching || clips.length === 0}
                  style={{ fontSize: '12px', height: '32px', padding: '0 12px' }}
                >
                  <Sparkles size={12} />
                  {matching ? 'Matching...' : 'Auto-Match Video Clips'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {scenes.map((scene, idx) => {
                const duration = scene.end_time - scene.start_time;
                const selectedClip = clips.find(c => c.id === scene.clipId);
                const isInsufficient = selectedClip && (scene.clipStart || 0) + duration > selectedClip.duration + 0.001;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredSceneIdx(idx)}
                    onMouseLeave={() => setHoveredSceneIdx(null)}
                    style={{
                      padding: '16px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    {/* Header: Segment boundary and actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge-tag">
                        Segment #{idx + 1}: {scene.start_time.toFixed(1)}s - {scene.end_time.toFixed(1)}s ({duration.toFixed(1)}s)
                      </span>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {idx > 0 && (
                          <button
                            title="Shift start cut boundary earlier (-0.1s)"
                            className="btn-secondary"
                            onClick={() => adjustBoundary(idx, -0.1)}
                            style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                          >
                            -0.1s
                          </button>
                        )}
                        {idx < scenes.length - 1 && (
                          <button
                            title="Shift end cut boundary later (+0.1s)"
                            className="btn-secondary"
                            onClick={() => adjustBoundary(idx + 1, 0.1)}
                            style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                          >
                            +0.1s
                          </button>
                        )}
                        <button
                          title="Split segment in half"
                          className="btn-secondary"
                          onClick={() => handleSplitSegment(idx)}
                          style={{ height: '26px', padding: '0 6px' }}
                        >
                          <Scissors size={12} />
                        </button>
                        {idx < scenes.length - 1 && (
                          <button
                            title="Merge with next segment"
                            className="btn-secondary"
                            onClick={() => handleMergeSegment(idx)}
                            style={{ height: '26px', padding: '0 6px', color: '#f87171' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dialogue Text (subtitles) if dialogue mode */}
                    {syncMode === 'dialogue' && (
                      <div>
                        {scene.isBeatSyncOnly ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed rgba(99, 102, 241, 0.2)', borderRadius: '6px', fontSize: '11px', color: 'var(--accent-purple)' }}>
                            <span>🎵 Beat Sync Segment (Music Outro - No Subtitles)</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <label className="label" style={{ fontSize: '11px', margin: 0 }}>Phrase Subtitle Lyrics</label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...scenes];
                                    updated[idx].text = scene.text_hinglish || '';
                                    updated[idx].words = scene.words_hinglish || [];
                                    setScenes(updated);
                                  }}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-light)',
                                    background: scene.text === scene.text_hinglish ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    color: scene.text === scene.text_hinglish ? 'var(--accent-purple)' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Hinglish
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...scenes];
                                    updated[idx].text = scene.text_hindi || '';
                                    updated[idx].words = scene.words_hindi || [];
                                    setScenes(updated);
                                  }}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-light)',
                                    background: scene.text === scene.text_hindi ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    color: scene.text === scene.text_hindi ? 'var(--accent-purple)' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Hindi
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              className="input-field"
                              value={scene.text}
                              onChange={(e) => updateSceneText(idx, e.target.value)}
                              placeholder="e.g. spoken line for this interval..."
                              style={{ height: '34px', fontSize: '12px' }}
                            />
                          </>
                        )}
                      </div>
                    )}

                    {/* Clip Selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                      <div>
                        <label className="label" style={{ fontSize: '11px' }}>Assigned Video Clip</label>
                        <select
                          className="input-field"
                          value={scene.clipId || ''}
                          onChange={(e) => updateSceneClip(idx, e.target.value)}
                          style={{ height: '36px', fontSize: '12px', margin: 0 }}
                        >
                          <option value="">-- Choose Video Clip --</option>
                          {clips.filter(c => c.exists !== false).map(clip => (
                            <option key={clip.id} value={clip.id}>
                              {clip.name} ({clip.duration.toFixed(1)}s)
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedClip && (() => {
                        const dims = aspectRatio === '9:16'
                          ? { width: '112px', height: '200px' }
                          : aspectRatio === '1:1'
                            ? { width: '160px', height: '160px' }
                            : { width: '240px', height: '136px' };
                        return (
                          <div style={{ ...dims, borderRadius: '6px', overflow: 'hidden', background: '#000', border: '1px solid var(--border-light)' }}>
                            <VideoPreview
                              clipId={selectedClip.id}
                              thumbnail={selectedClip.thumbnail}
                              clipStart={scene.clipStart || 0}
                              isActive={hoveredSceneIdx === idx || activeSliderIdx === idx}
                            />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Offset Slider */}
                    {selectedClip && (() => {
                      const maxStart = Math.max(0, selectedClip.duration - duration);
                      return (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-gray)', marginBottom: '2px' }}>
                            <span>Start cut offset: <strong>{(scene.clipStart || 0).toFixed(1)}s</strong></span>
                            <span>Max clip duration: {selectedClip.duration.toFixed(1)}s</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={maxStart}
                            step={0.1}
                            value={scene.clipStart || 0}
                            onChange={(e) => updateSceneClipStart(idx, parseFloat(e.target.value))}
                            onMouseDown={() => setActiveSliderIdx(idx)}
                            onMouseUp={() => setActiveSliderIdx(null)}
                            onTouchStart={() => setActiveSliderIdx(idx)}
                            onTouchEnd={() => setActiveSliderIdx(null)}
                            style={{ width: '100%' }}
                          />
                        </div>
                      );
                    })()}

                    {/* Insufficient footage check */}
                    {isInsufficient && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '6px', fontSize: '11px' }}>
                        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                        <span>
                          Required: {duration.toFixed(1)}s, but only {(selectedClip.duration - (scene.clipStart || 0)).toFixed(1)}s remains.
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginBottom: '4px' }}>
                      <input
                        type="checkbox"
                        id={`scene-pingpong-${idx}`}
                        checked={!!scene.pingPong}
                        onChange={(e) => {
                          const updated = [...scenes];
                          updated[idx] = { ...updated[idx], pingPong: e.target.checked };
                          setScenes(updated);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor={`scene-pingpong-${idx}`} className="label" style={{ margin: 0, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Play-and-Reverse (Beat Bounce)
                      </label>
                    </div>

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

                    {scene.reason && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderLeft: '2px solid var(--accent-purple)', paddingLeft: '6px' }}>
                        <strong>Reason:</strong> {scene.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* RIGHT COLUMN: Aesthetics & Compilation Controls */}
      <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '32px' }}>
        <div style={{ position: 'sticky', top: '0px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', paddingRight: '12px' }}>
          
          {/* Tab Selector Headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px' }}>
            {[
              { id: 'subtitles', label: 'Subtitles' },
              { id: 'video', label: 'Visuals' },
              { id: 'audio', label: 'Audio' }
            ].map(t => {
              const active = sidebarTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSidebarTab(t.id as any)}
                  style={{
                    flex: 1,
                    padding: '16px 0',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--accent-purple)' : 'none',
                    color: active ? 'var(--text-white)' : 'var(--text-gray)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: AUDIO */}
          {sidebarTab === 'audio' && (
            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
              
              {/* Choose Audio Track */}
              <section className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Music size={15} style={{ color: 'var(--accent-blue)' }} />
                  Choose Audio Track
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '14px' }}>
                  <button
                    className={audioSource === 'upload' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => { setAudioSource('upload'); setError(''); setSuccess(''); }}
                    style={{ fontSize: '10px', padding: '6px 2px', justifyContent: 'center' }}
                  >
                    Upload
                  </button>
                  <button
                    className={audioSource === 'music_library' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => { setAudioSource('music_library'); setError(''); setSuccess(''); }}
                    style={{ fontSize: '10px', padding: '6px 2px', justifyContent: 'center' }}
                  >
                    Music Lib
                  </button>
                  <button
                    className={audioSource === 'video_library' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => { setAudioSource('video_library'); setError(''); setSuccess(''); }}
                    style={{ fontSize: '10px', padding: '6px 2px', justifyContent: 'center' }}
                  >
                    Video Lib
                  </button>
                </div>

                {audioSource === 'upload' && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-light)',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-surface)',
                      transition: 'border-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="audio/*,video/*"
                      style={{ display: 'none' }}
                    />
                    <Upload size={20} style={{ margin: '0 auto 6px auto', color: 'var(--text-muted)' }} />
                    <div style={{ fontSize: '11px', fontWeight: 600 }}>
                      {uploading ? 'Processing...' : 'Drag file or click to upload'}
                    </div>
                  </div>
                )}

                {audioSource === 'music_library' && (
                  <div>
                    <label className="label">Background Music Track</label>
                    <select
                      className="input-field"
                      value={audioPath}
                      onChange={(e) => handleSelectLibraryAudio(e.target.value)}
                      style={{ height: '34px', fontSize: '12px' }}
                    >
                      <option value="">-- Choose Track --</option>
                      {bgms.map(bgm => (
                        <option key={bgm.id} value={bgm.path}>
                          {bgm.name} ({Math.floor(bgm.duration / 60)}:{(bgm.duration % 60).toFixed(0).padStart(2, '0')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {audioSource === 'video_library' && (
                  <div>
                    <label className="label">Select Video for Extraction</label>
                    <select
                      className="input-field"
                      value={selectedVideoClipId}
                      onChange={(e) => handleExtractFromLibraryVideo(e.target.value)}
                      style={{ height: '34px', fontSize: '12px' }}
                    >
                      <option value="">-- Choose Video Clip --</option>
                      {clips.filter(c => c.exists !== false).map(clip => (
                        <option key={clip.id} value={clip.id}>
                          {clip.name} ({clip.duration.toFixed(1)}s)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {audioPath && (
                  <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      <span className="micro-label" style={{ display: 'block', marginBottom: '1px' }}>Selected Track</span>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{audioName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge-tag" style={{ fontSize: '9px', padding: '2px 4px' }}>{audioDuration.toFixed(1)}s</span>
                      <button className="btn-secondary" onClick={togglePlayAudio} style={{ padding: '4px', height: '26px', width: '26px', justifyContent: 'center' }}>
                        {isPlaying ? <Pause size={11} /> : <Play size={11} fill="currentColor" />}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Sync Analysis Options */}
              {audioPath && (
                <section className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Activity size={15} style={{ color: 'var(--accent-purple)' }} />
                    Sync Analysis Options
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                    <div
                      onClick={() => setSyncMode('beats')}
                      style={{
                        border: '1px solid var(--border-light)',
                        borderRadius: '6px',
                        padding: '10px',
                        cursor: 'pointer',
                        background: syncMode === 'beats' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)',
                        borderColor: syncMode === 'beats' ? 'var(--accent-purple)' : 'var(--border-light)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Activity size={12} style={{ color: 'var(--accent-purple)' }} />
                        Rhythmic Beat Drops
                      </div>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.3' }}>
                        Detects music transients/kicks to align edits.
                      </p>
                    </div>

                    <div
                      onClick={() => setSyncMode('dialogue')}
                      style={{
                        border: '1px solid var(--border-light)',
                        borderRadius: '6px',
                        padding: '10px',
                        cursor: 'pointer',
                        background: syncMode === 'dialogue' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)',
                        borderColor: syncMode === 'dialogue' ? 'var(--accent-purple)' : 'var(--border-light)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} style={{ color: 'var(--accent-blue)' }} />
                        Spoken Dialogue / Shayari
                      </div>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.3' }}>
                        Splits at sentence endpoints using Gemini AI.
                      </p>
                    </div>
                  </div>

                  {syncMode === 'beats' && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-gray)', marginBottom: '4px' }}>
                        <span>Sensitivity Threshold</span>
                        <span>{threshold.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={1.1}
                        max={2.0}
                        step={0.05}
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}

                  {syncMode === 'dialogue' && (
                    <div 
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        background: 'rgba(255, 255, 255, 0.02)', padding: '10px 12px', 
                        borderRadius: '6px', border: '1px solid var(--border-light)',
                        marginBottom: '14px'
                      }}
                    >
                      <input
                        type="checkbox"
                        id="merge-short-scenes"
                        checked={mergeShortScenes}
                        onChange={(e) => handleToggleMergeScenes(e.target.checked)}
                        style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                      />
                      <label htmlFor="merge-short-scenes" style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>Merge short scenes</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Merge scenes shorter than 2.0 seconds into adjacent scenes</span>
                      </label>
                    </div>
                  )}

                  {syncMode === 'dialogue' && !geminiKeySet && (
                    <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '6px', fontSize: '11px', marginBottom: '14px' }}>
                      <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      Gemini API key is not configured in Settings.
                    </div>
                  )}

                  <button
                    onClick={handleAnalyzeAudio}
                    className="btn-primary"
                    disabled={analyzing || (syncMode === 'dialogue' && !geminiKeySet)}
                    style={{ width: '100%', height: '38px', justifyContent: 'center', fontSize: '12px' }}
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw size={14} className="spin-slow" style={{ marginRight: '6px' }} /> Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap size={14} style={{ marginRight: '6px' }} /> Start Sync Analysis
                      </>
                    )}
                  </button>
                </section>
              )}

              {/* Sound Effects Library */}
              <section className="glass-panel" style={{ padding: '20px', maxHeight: '420px', overflowY: 'auto', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Music size={15} style={{ color: 'var(--accent-purple)' }} />
                  Sound Effects Library
                </h4>

                {SFX_CATEGORIES.map(cat => (
                  <div key={cat.name} style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {cat.name}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {cat.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, marginRight: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-white)' }}>{item.name}</span>
                            <span style={{ fontSize: '9px', color: 'var(--text-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.desc}>{item.desc}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlaySfx(item.id)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '24px', height: '24px', borderRadius: '4px', border: 'none',
                              background: previewingSfx === item.id ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-white)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                            }}
                          >
                            {previewingSfx === item.id ? <Pause size={10} /> : <Play size={10} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}

          {/* TAB 2: VISUALS */}
          {sidebarTab === 'video' && (
            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
              
              {/* Format Settings */}
              <section className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Video size={16} style={{ color: 'var(--accent-purple)' }} />
              Video Formatting
            </h4>

            <div style={{ marginBottom: '14px' }}>
              <label className="label">Aspect Ratio</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {([['9:16', 'Vertical'], ['16:9', 'Wide'], ['1:1', 'Square']] as const).map(([ratio, label]) => (
                  <button
                    key={ratio}
                    className={aspectRatio === ratio ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setAspectRatio(ratio)}
                    style={{ fontSize: '10px', padding: '6px 2px', justifyContent: 'center' }}
                  >
                    {label} ({ratio})
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="label">Fill Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  className={fillMode === 'crop' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setFillMode('crop')}
                  style={{ fontSize: '11px', padding: '6px 4px', justifyContent: 'center' }}
                >
                  Zoom Crop
                </button>
                <button
                  className={fillMode === 'fit' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setFillMode('fit')}
                  style={{ fontSize: '11px', padding: '6px 4px', justifyContent: 'center' }}
                >
                  Black Bars (Fit)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <input
                type="checkbox"
                id="beatsync-zoom"
                checked={zoomAnimation}
                onChange={(e) => setZoomAnimation(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="beatsync-zoom" className="label" style={{ margin: 0, cursor: 'pointer' }}>
                Ken Burns Zoom Animations
              </label>
            </div>

            <div>
              <label className="label">Scene Transitions</label>
              <select
                className="input-field"
                value={clipTransition}
                onChange={(e: any) => setClipTransition(e.target.value)}
                style={{ height: '34px', fontSize: '12px' }}
              >
                <option value="none">None (Cut)</option>
                <option value="fade">0.25s Fade to Black</option>
                
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
              <div style={{ marginTop: '8px' }}>
                <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Transition Duration</span>
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>{transitionDuration.toFixed(1)}s</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={transitionDuration}
                  onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', opacity: 0.5 }}>
                  <span>0.1s</span>
                  <span>1.0s</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              <label className="label">Viral Mini-Beat Effects</label>
              <select
                className="input-field"
                value={miniBeatEffect}
                onChange={(e: any) => setMiniBeatEffect(e.target.value)}
                style={{ height: '34px', fontSize: '12px' }}
              >
                <option value="none">None (Standard Cut)</option>
                <option value="blink">Quick Black Blink</option>
                <option value="shake">Dynamic Camera Shake</option>
                <option value="both">Blink & Camera Shake</option>
              </select>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Triggers visual stroboscopic shakes/blinks on minor rhythmic sub-beats.
              </div>
            </div>
          </section>

          {/* 🔥 Viral Beat Effects Panel */}
          <section className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔥 Viral Beat Effects
            </h4>

            {/* Preset Quick-Select */}
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Effect Presets</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { key: 'aggressive', label: '⚡ Aggressive', desc: 'Flash + RGB + Speed' },
                  { key: 'cinematic', label: '🎬 Cinematic', desc: 'Grain + Bars + Tint' },
                  { key: 'glitch', label: '👾 Glitch', desc: 'RGB + Tear + Invert' },
                  { key: 'clean', label: '✨ Clean', desc: 'Bounce + Vignette' }
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className={beatEffects.preset === p.key ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => applyPreset(beatEffects.preset === p.key ? 'none' : p.key)}
                    style={{ fontSize: '11px', padding: '8px 6px', textAlign: 'center', lineHeight: '1.3' }}
                    title={p.desc}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Click active preset again to reset all effects.</div>
            </div>

            {/* Tier 1 — Maximum Impact */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>⚡ Maximum Impact</div>
              
              {/* White Flash */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.whiteFlash} onChange={e => setBeatEffects(p => ({ ...p, whiteFlash: e.target.checked, preset: 'none' }))} />
                  💥 White Flash
                  {beatEffects.whiteFlash && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{(beatEffects.whiteFlashIntensity * 100).toFixed(0)}%</span>}
                </label>
                {beatEffects.whiteFlash && <input type="range" min="0.3" max="1.0" step="0.05" value={beatEffects.whiteFlashIntensity} onChange={e => setBeatEffects(p => ({ ...p, whiteFlashIntensity: parseFloat(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* RGB Split */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.rgbSplit} onChange={e => setBeatEffects(p => ({ ...p, rgbSplit: e.target.checked, preset: 'none' }))} />
                  🌈 RGB Split
                  {beatEffects.rgbSplit && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{beatEffects.rgbSplitPixels}px</span>}
                </label>
                {beatEffects.rgbSplit && <input type="range" min="2" max="15" step="1" value={beatEffects.rgbSplitPixels} onChange={e => setBeatEffects(p => ({ ...p, rgbSplitPixels: parseInt(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* Bass Bounce */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.bassBounce} onChange={e => setBeatEffects(p => ({ ...p, bassBounce: e.target.checked, preset: 'none' }))} />
                  💫 Bass Bounce
                  {beatEffects.bassBounce && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{((beatEffects.bassBounceScale - 1) * 100).toFixed(0)}%</span>}
                </label>
                {beatEffects.bassBounce && <input type="range" min="1.02" max="1.15" step="0.01" value={beatEffects.bassBounceScale} onChange={e => setBeatEffects(p => ({ ...p, bassBounceScale: parseFloat(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* Speed Ramp */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.speedRamp} onChange={e => setBeatEffects(p => ({ ...p, speedRamp: e.target.checked, preset: 'none' }))} />
                  ⚡ Beat Freeze
                  {beatEffects.speedRamp && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{beatEffects.speedRampHold}s</span>}
                </label>
                {beatEffects.speedRamp && <input type="range" min="0.05" max="0.2" step="0.01" value={beatEffects.speedRampHold} onChange={e => setBeatEffects(p => ({ ...p, speedRampHold: parseFloat(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* Ping-Pong Beat Bounce */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={beatEffects.pingPong || false}
                    onChange={e => {
                      const enabled = e.target.checked;
                      setBeatEffects(p => ({ ...p, pingPong: enabled, preset: 'none' }));
                      setScenes(prev => prev.map(s => ({ ...s, pingPong: enabled })));
                    }}
                  />
                  🔄 Beat Bounce (Ping-Pong)
                </label>
              </div>
            </div>

            {/* Tier 2 — Pro Editor */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>🎬 Pro Editor</div>

              {/* Whip Pan */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.whipPan} onChange={e => setBeatEffects(p => ({ ...p, whipPan: e.target.checked, preset: 'none' }))} />
                  🌀 Whip Pan Blur
                  {beatEffects.whipPan && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{beatEffects.whipPanStrength}px</span>}
                </label>
                {beatEffects.whipPan && <input type="range" min="10" max="50" step="5" value={beatEffects.whipPanStrength} onChange={e => setBeatEffects(p => ({ ...p, whipPanStrength: parseInt(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* Spin */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.spinTransition} onChange={e => setBeatEffects(p => ({ ...p, spinTransition: e.target.checked, preset: 'none' }))} />
                  🔄 Spin Entry
                  {beatEffects.spinTransition && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{beatEffects.spinDegrees}°</span>}
                </label>
                {beatEffects.spinTransition && <input type="range" min="45" max="180" step="15" value={beatEffects.spinDegrees} onChange={e => setBeatEffects(p => ({ ...p, spinDegrees: parseInt(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* Color Flash */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.colorFlash} onChange={e => setBeatEffects(p => ({ ...p, colorFlash: e.target.checked, preset: 'none' }))} />
                  🎨 Color Flash
                  {beatEffects.colorFlash && <input type="color" value={beatEffects.colorFlashTint} onChange={e => setBeatEffects(p => ({ ...p, colorFlashTint: e.target.value, preset: 'none' }))} style={{ marginLeft: 'auto', width: '24px', height: '20px', padding: 0, border: 'none', cursor: 'pointer' }} />}
                </label>
              </div>

              {/* Glitch Tear */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.glitchTear} onChange={e => setBeatEffects(p => ({ ...p, glitchTear: e.target.checked, preset: 'none' }))} />
                  📐 Glitch Tear
                  {beatEffects.glitchTear && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{beatEffects.glitchTearPixels}px</span>}
                </label>
                {beatEffects.glitchTear && <input type="range" min="5" max="40" step="5" value={beatEffects.glitchTearPixels} onChange={e => setBeatEffects(p => ({ ...p, glitchTearPixels: parseInt(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>
            </div>

            {/* Tier 3 — Polish & Atmosphere */}
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>✨ Polish & Atmosphere</div>

              {/* Film Grain */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.filmGrain} onChange={e => setBeatEffects(p => ({ ...p, filmGrain: e.target.checked, preset: 'none' }))} />
                  🎞️ Film Grain
                  {beatEffects.filmGrain && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{beatEffects.filmGrainAmount}</span>}
                </label>
                {beatEffects.filmGrain && <input type="range" min="5" max="30" step="1" value={beatEffects.filmGrainAmount} onChange={e => setBeatEffects(p => ({ ...p, filmGrainAmount: parseInt(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* Letterbox */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.letterbox} onChange={e => setBeatEffects(p => ({ ...p, letterbox: e.target.checked, preset: 'none' }))} />
                  🖤 Cinematic Letterbox
                  {beatEffects.letterbox && <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>{beatEffects.letterboxSize}px</span>}
                </label>
                {beatEffects.letterbox && <input type="range" min="20" max="100" step="5" value={beatEffects.letterboxSize} onChange={e => setBeatEffects(p => ({ ...p, letterboxSize: parseInt(e.target.value), preset: 'none' }))} style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }} />}
              </div>

              {/* Vignette Pulse */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.vignettePulse} onChange={e => setBeatEffects(p => ({ ...p, vignettePulse: e.target.checked, preset: 'none' }))} />
                  ⚫ Vignette Pulse
                </label>
              </div>

              {/* Negative Flash */}
              <div style={{ marginBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={beatEffects.negativeFlash} onChange={e => setBeatEffects(p => ({ ...p, negativeFlash: e.target.checked, preset: 'none' }))} />
                  🔲 Negative Flash
                </label>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: SUBTITLES */}
      {sidebarTab === 'subtitles' && (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          {syncMode === 'dialogue' ? (
            <section className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Type size={16} style={{ color: 'var(--accent-purple)' }} />
                Subtitle Styling
              </h4>

              <div style={{ marginBottom: '16px' }}>
                <label className="label">Caption Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className={subtitleMode === 'classic' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setSubtitleMode('classic')}
                    style={{ fontSize: '11px', padding: '8px 4px', justifyContent: 'center' }}
                    title="Standard subtitle lines shown at the bottom of the screen"
                  >
                    Classic Lines
                  </button>
                  <button
                    type="button"
                    className={subtitleMode === 'smart-highlight' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setSubtitleMode('smart-highlight')}
                    style={{ fontSize: '11px', padding: '8px 4px', justifyContent: 'center' }}
                    title="Whole phrase is centered, active word is highlighted dynamically"
                  >
                    Smart Highlight
                  </button>
                  <button
                    type="button"
                    className={subtitleMode === 'centered-word' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setSubtitleMode('centered-word')}
                    style={{ fontSize: '11px', padding: '8px 4px', justifyContent: 'center' }}
                    title="Single word centered on screen, snapping in matching the voiceover"
                  >
                    Snappy Word
                  </button>
                  <button
                    type="button"
                    className={subtitleMode === 'pop' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setSubtitleMode('pop')}
                    style={{ fontSize: '11px', padding: '8px 4px', justifyContent: 'center' }}
                    title="Words appear randomly scattered, popping and lingering on screen"
                  >
                    Floating Pop
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <label className="label">Font Family</label>
                <div
                  className="input-field"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFontSelectorOpen(!fontSelectorOpen);
                  }}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: '40px',
                    background: 'var(--bg-surface)'
                  }}
                >
                  <span style={{ fontFamily: fontName, fontSize: '15px' }}>{fontName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-gray)', transform: fontSelectorOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </div>

                {fontSelectorOpen && (
                  <div
                    className="premium-card"
                    style={{
                      position: 'absolute',
                      top: '72px',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Search Google Fonts..."
                      value={fontSearchQuery}
                      onChange={(e) => {
                        setFontSearchQuery(e.target.value);
                        setFontDownloadError('');
                      }}
                      style={{ height: '36px', fontSize: '13px' }}
                      autoFocus
                    />

                    {fontLoading && (
                      <div style={{ fontSize: '12px', color: 'var(--accent-purple)', padding: '4px' }}>
                        Checking and downloading font from Google Fonts...
                      </div>
                    )}
                    {fontDownloadError && (
                      <div style={{ fontSize: '12px', color: '#f87171', padding: '4px' }}>
                        {fontDownloadError}
                      </div>
                    )}

                    <div
                      className="custom-scrollbar"
                      style={{
                        maxHeight: '160px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        paddingRight: '4px'
                      }}
                    >
                      {filteredFonts.map((font) => (
                        <div
                          key={font}
                          onClick={async () => {
                            try {
                              await fetch('/api/fonts/ensure', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fontName: font })
                              });
                            } catch (err) {
                              console.error('Prefetch error:', err);
                            }
                            loadGoogleFont(font);
                            setFontName(font);
                            setFontSelectorOpen(false);
                            setFontSearchQuery('');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontFamily: font,
                            fontSize: '15px',
                            background: fontName === font ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            color: fontName === font ? '#fff' : 'var(--text-gray)',
                            transition: 'background 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (fontName !== font) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                          }}
                          onMouseLeave={(e) => {
                            if (fontName !== font) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span>{font}</span>
                          <span style={{ fontSize: '11px', opacity: 0.5, fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>Preview</span>
                        </div>
                      ))}

                      {filteredFonts.length === 0 && fontSearchQuery.trim().length > 0 && (
                        <div style={{ padding: '8px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>No curated match for "{fontSearchQuery}"</p>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={fontLoading}
                            onClick={() => handleAddCustomFont(fontSearchQuery.trim())}
                            style={{
                              width: '100%',
                              height: '32px',
                              fontSize: '11px',
                              justifyContent: 'center'
                            }}
                          >
                            Search & Download "{fontSearchQuery.trim()}"
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="label">Font Size</label>
                  <span style={{ fontSize: '12px' }}>{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={48}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Outline Color & Formatting */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px', alignItems: 'center' }}>
                <div>
                  <label className="label">Outline Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{outlineColor.toUpperCase()}</span>
                  </div>
                </div>
                <div>
                  <label className="label">Formatting</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} />
                      B
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} />
                      I
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
                      S
                    </label>
                  </div>
                </div>
              </div>

              {/* Word-Specific Styles Section */}
              <div className="inspector-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Word styling (Normal, Highlight, Emoji)</span>
                </div>
                
                {/* Tab Headers */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '6px', marginBottom: '12px' }}>
                  {(['normal', 'highlight', 'emoji'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStyleTab(tab)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                        background: styleTab === tab ? 'var(--primary)' : 'transparent',
                        color: styleTab === tab ? 'var(--text-white)' : 'var(--text-gray)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Toolbar for copy-sync buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setHighlightStyle({ ...normalStyle });
                      setEmojiStyle({ ...normalStyle });
                    }}
                    style={{ fontSize: '10px', padding: '4px 8px', height: 'auto' }}
                  >
                    Copy Normal to All
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEmojiStyle({ ...highlightStyle });
                    }}
                    style={{ fontSize: '10px', padding: '4px 8px', height: 'auto' }}
                  >
                    Copy Highlight to Emoji
                  </button>
                </div>

                {/* Tab Contents */}
                <div>
                  {/* 1. Text Color */}
                  <div style={{ marginBottom: '12px' }}>
                    <label className="label" style={{ marginBottom: '4px', fontSize: '11px' }}>Text Color</label>
                    <div style={{ 
                      background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-medium)', 
                      borderRadius: '4px', padding: '4px 8px', display: 'flex', alignItems: 'center', 
                      gap: '6px', height: '34px' 
                    }}>
                      <div style={{ position: 'relative', width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        <input 
                          type="color" 
                          value={styleTab === 'normal' ? normalStyle.fontColor : styleTab === 'highlight' ? highlightStyle.fontColor : emojiStyle.fontColor} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (styleTab === 'normal') {
                              setNormalStyle({ ...normalStyle, fontColor: val });
                              setFontColor(val);
                            } else if (styleTab === 'highlight') {
                              setHighlightStyle({ ...highlightStyle, fontColor: val });
                              setHighlightColor(val);
                            } else {
                              setEmojiStyle({ ...emojiStyle, fontColor: val });
                            }
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
                          if (styleTab === 'normal') {
                            setNormalStyle({ ...normalStyle, fontColor: val });
                            setFontColor(val);
                          } else if (styleTab === 'highlight') {
                            setHighlightStyle({ ...highlightStyle, fontColor: val });
                            setHighlightColor(val);
                          } else {
                            setEmojiStyle({ ...emojiStyle, fontColor: val });
                          }
                        }} 
                        style={{ 
                          background: 'none', border: 'none', color: 'var(--text-white)', 
                          fontFamily: 'monospace', fontSize: '11px', width: '100%', outline: 'none',
                          padding: 0
                        }} 
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
                        if (styleTab === 'normal') {
                          setNormalStyle({ ...normalStyle, activeWordScale: val });
                        } else if (styleTab === 'highlight') {
                          setHighlightStyle({ ...highlightStyle, activeWordScale: val });
                          setActiveWordScale(val);
                        } else {
                          setEmojiStyle({ ...emojiStyle, activeWordScale: val });
                        }
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
                          if (styleTab === 'normal') {
                            const target = !normalStyle.neonGlow;
                            setNormalStyle({ ...normalStyle, neonGlow: target });
                            setNeonGlow(target);
                          } else if (styleTab === 'highlight') {
                            const target = !highlightStyle.neonGlow;
                            setHighlightStyle({ ...highlightStyle, neonGlow: target });
                          } else {
                            const target = !emojiStyle.neonGlow;
                            setEmojiStyle({ ...emojiStyle, neonGlow: target });
                          }
                        }}
                      >
                        <div className="stitch-switch-handle" />
                      </div>
                    </div>

                    {(styleTab === 'normal' ? normalStyle.neonGlow : styleTab === 'highlight' ? highlightStyle.neonGlow : emojiStyle.neonGlow) && (
                      <div style={{ 
                        padding: '8px', background: 'rgba(0,0,0,0.2)', 
                        borderRadius: '6px', border: '1px solid var(--border-medium)',
                        display: 'flex', flexDirection: 'column', gap: '8px'
                      }}>
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
                                  if (styleTab === 'normal') {
                                    setNormalStyle({ ...normalStyle, glowColor: val });
                                    setGlowColor(val);
                                  } else if (styleTab === 'highlight') {
                                    setHighlightStyle({ ...highlightStyle, glowColor: val });
                                  } else {
                                    setEmojiStyle({ ...emojiStyle, glowColor: val });
                                  }
                                }} 
                                style={{ position: 'absolute', top: '-4px', left: '-4px', width: '26px', height: '26px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} 
                              />
                            </div>
                            <input 
                              type="text" 
                              value={(styleTab === 'normal' ? normalStyle.glowColor : styleTab === 'highlight' ? highlightStyle.glowColor : emojiStyle.glowColor).toUpperCase()} 
                              onChange={(e) => {
                                const val = e.target.value;
                                let hex = val;
                                if (!hex.startsWith('#') && hex.length > 0) hex = '#' + hex;
                                if (styleTab === 'normal') {
                                  setNormalStyle({ ...normalStyle, glowColor: hex });
                                  setGlowColor(hex);
                                } else if (styleTab === 'highlight') {
                                  setHighlightStyle({ ...highlightStyle, glowColor: hex });
                                } else {
                                  setEmojiStyle({ ...emojiStyle, glowColor: hex });
                                }
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
                              if (styleTab === 'normal') {
                                  setNormalStyle({ ...normalStyle, glowBlur: val });
                                  setGlowBlur(val);
                              } else if (styleTab === 'highlight') {
                                  setHighlightStyle({ ...highlightStyle, glowBlur: val });
                              } else {
                                  setEmojiStyle({ ...emojiStyle, glowBlur: val });
                              }
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
                              if (styleTab === 'normal') {
                                  setNormalStyle({ ...normalStyle, glowDistance: val });
                                  setGlowDistance(val);
                              } else if (styleTab === 'highlight') {
                                  setHighlightStyle({ ...highlightStyle, glowDistance: val });
                              } else {
                                  setEmojiStyle({ ...emojiStyle, glowDistance: val });
                              }
                            }}
                            style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Highlight Style Settings (Conditional) */}
              {(subtitleMode === 'pop' || subtitleMode === 'centered-word' || subtitleMode === 'smart-highlight') && (
                <div className="inspector-card" style={{ background: 'var(--bg-darker)', border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '10px' }}>Highlight Word Style</div>

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '8px' }}>
                      <div>
                        <label className="label">Background Box Color</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="color" value={boxColor} onChange={(e) => setBoxColor(e.target.value)} />
                          <input 
                            type="text" value={boxColor.toUpperCase()} 
                            onChange={(e) => {
                              const val = e.target.value;
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

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="label" style={{ fontWeight: 600, color: 'var(--text-white)', marginBottom: '10px' }}>Text Animations & Effects</label>
                  
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={textFade} onChange={(e) => setTextFade(e.target.checked)} />
                      In/Out Fade (150ms)
                    </label>
                  </div>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <label className="label">In/Out Transition</label>
                    <select className="input-field" value={textTransition} onChange={(e) => setTextTransition(e.target.value)} style={{ height: '34px', fontSize: '12px' }}>
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

                  <div style={{ marginBottom: '10px' }}>
                    <label className="label">Stay Animation (Motion)</label>
                    <select className="input-field" value={textMotion} onChange={(e) => setTextMotion(e.target.value)} style={{ height: '34px', fontSize: '12px' }}>
                      <option value="none">None (Stationary)</option>
                      <option value="float">Floating Text (Slow Rise)</option>
                    </select>
                  </div>

                  {(subtitleMode === 'pop' || subtitleMode === 'centered-word' || subtitleMode === 'smart-highlight') && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label className="label">Active Word Zoom Bump</label>
                        <span style={{ fontSize: '12px' }}>{activeWordScale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={1.00}
                        max={1.40}
                        step={0.05}
                        value={activeWordScale}
                        onChange={(e) => setActiveWordScale(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}

                  {subtitleMode === 'pop' && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label className="label">Word Display Time</label>
                        <span style={{ fontSize: '12px' }}>{wordDisplayTime.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0.3}
                        max={3.0}
                        step={0.1}
                        value={wordDisplayTime}
                        onChange={(e) => setWordDisplayTime(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {subtitleMode !== 'pop' && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 600, color: 'var(--text-white)', marginBottom: '10px' }}>Text Positioning</label>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => {
                          setTextPositionX(0);
                          setTextPositionY(75);
                        }}
                      >
                        Top
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => {
                          setTextPositionX(0);
                          setTextPositionY(0);
                        }}
                      >
                        Center
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => {
                          setTextPositionX(0);
                          setTextPositionY(-70);
                        }}
                      >
                        Bottom
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => {
                          setTextPositionX(-70);
                          setTextPositionY(0);
                        }}
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => {
                          setTextPositionX(70);
                          setTextPositionY(0);
                        }}
                      >
                        Right
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', fontSize: '11px', justifyContent: 'center', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                        onClick={() => {
                          setTextPositionX(0);
                          setTextPositionY(-70);
                        }}
                      >
                        Reset
                      </button>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label className="label">Horizontal Offset (X)</label>
                        <span style={{ fontSize: '12px' }}>{textPositionX > 0 ? `+${textPositionX}` : textPositionX}</span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        step={5}
                        value={textPositionX}
                        onChange={(e) => setTextPositionX(parseInt(e.target.value, 10))}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label className="label">Vertical Offset (Y)</label>
                        <span style={{ fontSize: '12px' }}>{textPositionY > 0 ? `+${textPositionY}` : textPositionY}</span>
                      </div>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        step={5}
                        value={textPositionY}
                        onChange={(e) => setTextPositionY(parseInt(e.target.value, 10))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Premium Algorithmic Styles Section */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="label" style={{ fontWeight: 600, color: 'var(--text-white)', marginBottom: '10px' }}>🔥 Premium Retention Styles</label>

                  {/* Auto-Emoji Pop */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showEmojis} onChange={(e) => setShowEmojis(e.target.checked)} />
                      Auto-Emoji Pop (Algorithm Booster)
                    </label>
                    <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginLeft: '20px', marginTop: '2px' }}>
                      Automatically burns contextual emojis next to matching words on-screen.
                    </div>
                  </div>

                  {/* Key-Phrase Auto-Emphasis */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={autoEmphasis} onChange={(e) => setAutoEmphasis(e.target.checked)} />
                      Key-Phrase Auto-Emphasis (Hormozi Style)
                    </label>
                    <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginLeft: '20px', marginTop: '2px', marginBottom: '6px' }}>
                      Highlights high-impact words (e.g. money, free, crash) with a 25% scale bump.
                    </div>
                    {autoEmphasis && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '20px' }}>
                        <span style={{ fontSize: '12px' }}>Emphasis Color:</span>
                        <input type="color" value={emphasisColor} onChange={(e) => setEmphasisColor(e.target.value)} style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{emphasisColor.toUpperCase()}</span>
                      </div>
                    )}
                  </div>



                  {/* 3D Pop Extrusion */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={pop3d} onChange={(e) => setPop3d(e.target.checked)} />
                      3D Pop Extrusion (Retro Meme Style)
                    </label>
                    <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginLeft: '20px', marginTop: '2px', marginBottom: '6px' }}>
                      Applies a solid, thick blocky shadow offset for high-contrast visibility.
                    </div>
                    {pop3d && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '20px' }}>
                        <span style={{ fontSize: '12px' }}>Pop Color:</span>
                        <input type="color" value={pop3dColor} onChange={(e) => setPop3dColor(e.target.value)} style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{pop3dColor.toUpperCase()}</span>
                      </div>
                    )}
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
                  if (updatedScenes[sIdx] && updatedScenes[sIdx].words && updatedScenes[sIdx].words[wIdx]) {
                    updatedScenes[sIdx].words[wIdx].sfx = sfxId;
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

              {/* Hook Badge / Video Title Card */}
              <div className="inspector-card" style={{ marginTop: '16px' }}>
                <div className="inspector-sub-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px' }}>🎯 Hook Badge / Video Title</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginBottom: '12px', lineHeight: '1.4' }}>
                  Add an animated hook heading in the top-left corner for the first 3.0 seconds to boost social media retention.
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="label">Hook Title Text</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 3 SECRETS TO GROW FAST 🚀"
                    value={headingTitle}
                    onChange={(e) => setHeadingTitle(e.target.value)}
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="checkbox" 
                    id="show-timer-beatsync" 
                    checked={showTimer} 
                    onChange={(e) => setShowTimer(e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="show-timer-beatsync" style={{ fontSize: '12.5px', cursor: 'pointer', userSelect: 'none', fontWeight: 500, color: 'var(--text-white)' }}>
                    Show Countdown Timer
                  </label>
                </div>

                {(headingTitle.trim().length > 0 || showTimer) && (
                  <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div>
                        <label className="label">Font Family</label>
                        <select
                          value={headingFontName}
                          onChange={(e) => setHeadingFontName(e.target.value)}
                          className="input-field"
                          style={{ height: '34px', fontSize: '12px', background: 'var(--bg-darker)' }}
                        >
                          <option value="Montserrat">Montserrat</option>
                          <option value="Oswald">Oswald</option>
                          <option value="Arial">Arial</option>
                          <option value="Kalam Bold">Kalam Bold</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Padding (px)</label>
                        <input
                          type="number"
                          className="input-field"
                          min={2}
                          max={20}
                          value={headingPadding}
                          onChange={(e) => setHeadingPadding(Math.max(2, parseInt(e.target.value, 10) || 6))}
                          style={{ height: '34px', fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div>
                        <label className="label">Font Size</label>
                        <input
                          type="number"
                          className="input-field"
                          min={10}
                          max={48}
                          value={headingFontSize}
                          onChange={(e) => setHeadingFontSize(Math.max(10, parseInt(e.target.value, 10) || 18))}
                          style={{ height: '34px', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label className="label">Text Color</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="color"
                            value={headingFontColor}
                            onChange={(e) => setHeadingFontColor(e.target.value)}
                            style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer', padding: 0 }}
                          />
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.7 }}>{headingFontColor}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="label">Badge Background Color</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={headingBoxColor}
                          onChange={(e) => setHeadingBoxColor(e.target.value)}
                          style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.7 }}>{headingBoxColor}</span>
                        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                          {['#1A1A1A', '#8A4BF3', '#FFCC00', '#FF3333'].map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setHeadingBoxColor(color)}
                              style={{
                                width: '16px', height: '16px', borderRadius: '50%', background: color,
                                border: headingBoxColor === color ? '1.5px solid var(--text-white)' : 'none', cursor: 'pointer',
                                padding: 0
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Bg Opacity</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{headingBoxOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={headingBoxOpacity}
                          onChange={(e) => setHeadingBoxOpacity(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Text Opacity</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{headingTextOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={headingTextOpacity}
                          onChange={(e) => setHeadingTextOpacity(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Top Margin (Y)</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{headingTopOffset}%</span>
                        </div>
                        <input
                          type="range" 
                          min={2} 
                          max={30} 
                          step={1} 
                          value={headingTopOffset}
                          onChange={(e) => setHeadingTopOffset(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Side Margin (X)</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{headingLeftOffset}%</span>
                        </div>
                        <input
                          type="range" 
                          min={2} 
                          max={20} 
                          step={1} 
                          value={headingLeftOffset}
                          onChange={(e) => setHeadingLeftOffset(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reel Branding System Card */}
              <div className="inspector-card" style={{ marginTop: '16px' }}>
                <div className="inspector-sub-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px' }}>🎬 Reel Branding System</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginBottom: '12px', lineHeight: '1.4' }}>
                  Overlays premium monochrome branding signatures matching Instagram Reels UI safe zones.
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="label">Branding Theme</label>
                  <select
                    value={brandingTheme}
                    onChange={(e) => setBrandingTheme(e.target.value as 'none' | 'fitness-in-chunks')}
                    className="input-field"
                    style={{ height: '34px', fontSize: '12.5px', background: 'var(--bg-darker)' }}
                  >
                    <option value="none">None (Disabled)</option>
                    <option value="fitness-in-chunks">FitnessInChunks (v1.0)</option>
                  </select>
                </div>

                {brandingTheme === 'fitness-in-chunks' && (
                  <div style={{ animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                    <div>
                      <label className="label">Series Name Signature</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. FITNESSINCHUNKS"
                        value={seriesName}
                        onChange={(e) => setSeriesName(e.target.value)}
                        style={{ height: '34px', fontSize: '12.5px' }}
                      />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label className="label">Episode Number</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. EP 02"
                          value={episodeNumber}
                          onChange={(e) => setEpisodeNumber(e.target.value)}
                          style={{ height: '34px', fontSize: '12.5px' }}
                        />
                      </div>
                      <div>
                        <label className="label">Next Episode CTA</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. EP 03"
                          value={nextEpisode}
                          onChange={(e) => setNextEpisode(e.target.value)}
                          style={{ height: '34px', fontSize: '12.5px' }}
                        />
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '10px', fontSize: '10.5px', color: 'var(--text-gray)', lineHeight: '1.4' }}>
                      <strong style={{ color: 'var(--text-white)', display: 'block', marginBottom: '4px' }}>Theme Specifications Enforced:</strong>
                      • Typography: Montserrat (ExtraBold topic, Bold episode, Medium series)<br />
                      • Opacity: Topic 100%, Episode 100%, Series 60%, vertical line 80%<br />
                      • Layout: Topic card (top-left, 0s-2s), Episode block (bottom-left, persistent), Progress bar (extreme right, vertical line shrinks over time)<br />
                      • End Screen: Signature visibility increases; introduces centered follow CTA.
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="inspector-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-gray)' }}>
              <Type size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px', margin: '0 auto' }} />
              <div className="inspector-sub-title" style={{ fontSize: '14px', marginBottom: '6px' }}>Subtitles Disabled</div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Subtitles are only available in **Spoken Dialogue / Shayari** sync mode.
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-gray)', marginTop: '8px' }}>
                Switch to **Dialogue Sync** in the **Audio** tab to configure transcription and styling.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Export Options (under Visuals tab) */}
      {sidebarTab === 'video' && (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          {/* Export Options */}
          <section className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ChevronRight size={16} style={{ color: 'var(--accent-blue)' }} />
              Export Quality Settings
            </h4>

            <div style={{ marginBottom: '14px' }}>
              <label className="label">Resolution</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {(['1080p', '2k', '4k'] as const).map(res => (
                  <button
                    key={res}
                    className={exportResolution === res ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setExportResolution(res)}
                    style={{ fontSize: '11px', padding: '6px 2px', justifyContent: 'center' }}
                  >
                    {res.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Frame Rate</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {([24, 30, 60] as const).map(fps => (
                  <button
                    key={fps}
                    className={exportFps === fps ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setExportFps(fps)}
                    style={{ fontSize: '11px', padding: '6px 2px', justifyContent: 'center' }}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

          {/* Compilation Banner and Action Button */}
          {scenes.length > 0 && (() => {
            return (
              <>
                {hasSplicingError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', fontSize: '11px', marginBottom: '12px' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>Some scenes have insufficient source footage. Check offsets.</span>
                  </div>
                )}
                <button
                  onClick={handleCompileVideo}
                  className="btn-primary"
                  disabled={compiling || scenes.length === 0 || scenes.some(s => !s.clipId) || hasSplicingError}
                  style={{ width: '100%', height: '40px', fontSize: '13px', justifyContent: 'center' }}
                >
                  <RefreshCw size={16} className={compiling ? 'spin-slow' : ''} style={{ marginRight: '6px' }} />
                  {compiling ? 'Submitting render...' : 'Compile Beat Sync Video'}
                </button>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
