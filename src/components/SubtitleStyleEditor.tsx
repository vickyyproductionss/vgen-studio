import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

export interface WordStyle {
  fontColor: string;
  activeWordScale: number;
  neonGlow: boolean;
  glowColor: string;
  glowBlur: number;
  glowDistance: number;
}

export interface WordTiming {
  word: string;
  start_time: number;
  end_time: number;
  sfx?: string;
}

interface SubtitleStyleEditorProps {
  subtitleMode: 'classic' | 'pop' | 'smart-highlight' | 'centered-word' | 'simple';
  setSubtitleMode: (val: 'classic' | 'pop' | 'smart-highlight' | 'centered-word' | 'simple') => void;
  fontName: string;
  setFontName: (val: string) => void;
  fontSize: number;
  setFontSize: (val: number) => void;
  fontColor: string;
  setFontColor: (val: string) => void;
  outlineColor: string;
  setOutlineColor: (val: string) => void;
  outlineThickness: number;
  setOutlineThickness: (val: number) => void;
  bold: boolean;
  setBold: (val: boolean) => void;
  italic: boolean;
  setItalic: (val: boolean) => void;
  shadow: boolean;
  setShadow: (val: boolean) => void;
  highlightColor: string;
  setHighlightColor: (val: string) => void;
  showHighlightBox: boolean;
  setShowHighlightBox: (val: boolean) => void;
  boxColor: string;
  setBoxColor: (val: string) => void;
  boxRounding: number;
  setBoxRounding: (val: number) => void;
  textFade: boolean;
  setTextFade: (val: boolean) => void;
  textTransition: string;
  setTextTransition: (val: string) => void;
  textMotion: string;
  setTextMotion: (val: string) => void;
  activeWordScale: number;
  setActiveWordScale: (val: number) => void;
  wordDisplayTime: number;
  setWordDisplayTime: (val: number) => void;
  maxWordsPerLine: number;
  setMaxWordsPerLine: (val: number) => void;
  textPositionX: number;
  setTextPositionX: (val: number) => void;
  textPositionY: number;
  setTextPositionY: (val: number) => void;
  showEmojis: boolean;
  setShowEmojis: (val: boolean) => void;
  autoEmphasis: boolean;
  setAutoEmphasis: (val: boolean) => void;
  emphasisColor: string;
  setEmphasisColor: (val: string) => void;
  neonGlow: boolean;
  setNeonGlow: (val: boolean) => void;
  glowColor: string;
  setGlowColor: (val: string) => void;
  glowBlur: number;
  setGlowBlur: (val: number) => void;
  glowDistance: number;
  setGlowDistance: (val: number) => void;
  highlightTrigger: 'all' | 'emphasis' | 'emoji' | 'none';
  setHighlightTrigger: (val: 'all' | 'emphasis' | 'emoji' | 'none') => void;
  textCase: 'default' | 'upper' | 'first-word-larger';
  setTextCase: (val: 'default' | 'upper' | 'first-word-larger') => void;
  pop3d: boolean;
  setPop3d: (val: boolean) => void;
  pop3dColor: string;
  setPop3dColor: (val: string) => void;
  pop3dDepth: number;
  setPop3dDepth: (val: number) => void;
  letterSpacing: number;
  setLetterSpacing: (val: number) => void;
  wordSpacing: number;
  setWordSpacing: (val: number) => void;
  shadowColor: string;
  setShadowColor: (val: string) => void;
  shadowBlur: number;
  setShadowBlur: (val: number) => void;
  shadowDistance: number;
  setShadowDistance: (val: number) => void;
  shadowAngle: number;
  setShadowAngle: (val: number) => void;
  shadowOpacity: number;
  setShadowOpacity: (val: number) => void;
  
  // Word styles
  normalStyle: WordStyle;
  setNormalStyle: (val: WordStyle) => void;
  highlightStyle: WordStyle;
  setHighlightStyle: (val: WordStyle) => void;
  emojiStyle: WordStyle;
  setEmojiStyle: (val: WordStyle) => void;
  
  // Heading / Hook state variables
  headingTitle: string;
  setHeadingTitle: (val: string) => void;
  headingFontName: string;
  setHeadingFontName: (val: string) => void;
  headingFontSize: number;
  setHeadingFontSize: (val: number) => void;
  headingFontColor: string;
  setHeadingFontColor: (val: string) => void;
  headingBoxColor: string;
  setHeadingBoxColor: (val: string) => void;
  headingPadding: number;
  setHeadingPadding: (val: number) => void;
  showTimer: boolean;
  setShowTimer: (val: boolean) => void;
  headingTopOffset: number;
  setHeadingTopOffset: (val: number) => void;
  headingLeftOffset: number;
  setHeadingLeftOffset: (val: number) => void;
  headingBoxOpacity: number;
  setHeadingBoxOpacity: (val: number) => void;
  headingTextOpacity: number;
  setHeadingTextOpacity: (val: number) => void;
  
  // Reel Branding System state variables
  brandingTheme: 'none' | 'fitness-in-chunks';
  setBrandingTheme: (val: 'none' | 'fitness-in-chunks') => void;
  seriesName: string;
  setSeriesName: (val: string) => void;
  episodeNumber: string;
  setEpisodeNumber: (val: string) => void;
  nextEpisode: string;
  setNextEpisode: (val: string) => void;

  // Emoji word sfx props
  scenes: any[];
  setScenes: (scenes: any[]) => void;
  sfxList?: { id: string; name: string }[];
  handlePlaySfx?: (sfxId: string) => void;
  previewingSfx?: string | null;

  // Optional save hook for components without auto-save useEffect (e.g. YoutubeCreator)
  onSaveFields?: (fields: Partial<any>) => void;

  // Card & Brand Customization
  brandPrimaryColor: string;
  setBrandPrimaryColor: (val: string) => void;
  brandSecondaryColor: string;
  setBrandSecondaryColor: (val: string) => void;
  cardPositionY: number;
  setCardPositionY: (val: number) => void;
  cardScale: number;
  setCardScale: (val: number) => void;
  cardFontName: string;
  setCardFontName: (val: string) => void;
  showLayoutCards: boolean;
  setShowLayoutCards: (val: boolean) => void;
  applyHUDToAll?: boolean;
  setApplyHUDToAll?: (val: boolean) => void;

  // Text Background & Animation Customization
  textBackgroundStyle: 'none' | 'rounded-box' | 'outline-badge' | 'semi-transparent';
  setTextBackgroundStyle: (val: 'none' | 'rounded-box' | 'outline-badge' | 'semi-transparent') => void;
  textAnimation: 'none' | 'typewriter' | 'bounce' | 'flicker' | 'slide' | 'wave' | 'glitch';
  setTextAnimation: (val: 'none' | 'typewriter' | 'bounce' | 'flicker' | 'slide' | 'wave' | 'glitch') => void;
  boxPadding: string;
  setBoxPadding: (val: string) => void;
  outlineSize: number;
  setOutlineSize: (val: number) => void;
}

const emojiMap: Record<string, string> = {
  'gym': '🏋️‍♂️', 'workout': '🏋️‍♂️', 'fitness': '💪', 'strong': '💪', 'training': '🏋️‍♂️', 'athlete': '🏃‍♂️', 'exercise': '🏋️‍♂️',
  'run': '🏃‍♂️', 'walk': '🏃‍♂️', 'jump': '🦘', 'swim': '🏊‍♂️', 'climb': '🧗‍♂️', 'wrestling': '🤼‍♂️', 'martial': '🥋', 'karate': '🥋', 'judo': '🥋', 'gymnastics': '🤸‍♂️', 'boxing': '🥊', 'punch': '🥊', 'fight': '🥊',
  'money': '💰', 'rich': '💰', 'million': '💵', 'billion': '💵', 'cash': '💵', 'dollar': '💵', 'wealth': '💰', 'broke': '💸', 'poor': '💸', 'bank': '🏦', 'card': '💳', 'credit': '💳', 'pay': '💵', 'buy': '🛒', 'sell': '📈', 'price': '🏷️', 'cost': '🏷️', 'bill': '💵', 'tax': '💸', 'gold': '🪙', 'coin': '🪙', 'diamond': '💎', 'gem': '💎', 'ring': '💍',
  'fire': '🔥', 'hot': '🔥', 'burn': '🔥', 'flame': '🔥',
  'danger': '⚠️', 'warn': '⚠️', 'warning': '⚠️', 'alert': '⚠️', 'stop': '🛑', 'go': '🟢', 'power': '⚡', 'energy': '⚡', 'speed': '⚡', 'fast': '⚡', 'lightning': '⚡', 'thunder': '⛈️', 'storm': '⛈️', 'bomb': '💣', 'explode': '💥', 'explosion': '💥', 'destroy': '💥', 'crash': '💥',
  'mind': '🧠', 'brain': '🧠', 'think': '🧠', 'smart': '🧠', 'idea': '💡', 'thought': '🤔', 'secret': '🤫', 'quiet': '🤫', 'genius': '🧠', 'truth': '🗣️', 'speak': '🗣️', 'talk': '🗣️', 'listen': '👂', 'hear': '👂',
  'time': '⏱️', 'clock': '⏰', 'watch': '⌚', 'target': '🎯', 'goal': '🎯', 'success': '🏆', 'win': '🏆', 'winner': '🏆', 'victory': '🏆', 'trophy': '🏆', 'medal': '🏅', 'first': '🥇', 'crown': '👑', 'king': '👑', 'queen': '👑',
  'love': '❤️', 'heart': '❤️', 'broken': '💔', 'hate': '💔', 'scream': '😱', 'scared': '😱', 'shock': '😱', 'fear': '😨', 'ghost': '👻', 'monster': '👹', 'alien': '👽', 'happy': '😊', 'smile': '😊', 'excited': '🤩', 'wow': '😮', 'shocked': '😲', 'surprised': '😲', 'confused': '😕', 'laugh': '😂', 'funny': '😂', 'joke': '😂', 'cry': '😭', 'sad': '😭', 'crap': '💩', 'shit': '💩',
  'phone': '📱', 'mobile': '📱', 'computer': '💻', 'laptop': '💻', 'code': '💻', 'software': '💻', 'program': '💻', 'gift': '🎁', 'party': '🎉', 'celebrate': '🎉', 'key': '🔑', 'lock': '🔒', 'unlock': '🔓', 'door': '🚪', 'bed': '🛏️', 'tv': '📺', 'camera': '📷', 'photo': '📷', 'video': '🎥', 'movie': '🎬', 'film': '🎬', 'music': '🎵', 'song': '🎶', 'sing': '🎤', 'dance': '💃', 'book': '📖', 'read': '📖', 'write': '✍️',
  'car': '🏎️', 'bus': '🚌', 'truck': '🚚', 'bike': '🚲', 'travel': '✈️', 'trip': '✈️', 'plane': '✈️', 'train': '🚆', 'rocket': '🚀', 'fly': '🚀',
  'earth': '🌍', 'world': '🌎', 'nature': '🌿', 'sun': '☀️', 'moon': '🌙', 'star': '⭐', 'sky': '🌌', 'cloud': '☁️', 'rain': '🌧️', 'snow': '❄️', 'wind': '💨', 'ice': '❄️', 'water': '💧', 'ocean': '🌊', 'sea': '🌊', 'mountain': '⛰️', 'forest': '🌲', 'flower': '🌸', 'rose': '🌹', 'tree': '🌳',
  'dog': '🐶', 'cat': '🐱', 'bird': '🐦', 'fish': '🐟', 'shark': '🦈', 'lion': '🦁', 'tiger': '🐯', 'bear': '🐻', 'wolf': '🐺', 'fox': '🦊',
  'food': '🍔', 'pizza': '🍕', 'burger': '🍔', 'fries': '🍟', 'coffee': '☕', 'drink': '🍹'
};

function getWordEmoji(word: string) {
  if (!word) return '';
  const clean = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  return emojiMap[clean] || '';
}

const CURATED_FONTS = [
  'Arial', 'Anton', 'Bangers', 'Kalam', 'Kalam Light', 'Kalam Bold', 'Inter',
  'Poppins', 'Roboto', 'Montserrat', 'Oswald', 'Playfair Display', 'Lora',
  'Lilita One', 'Fredoka', 'Pacifico', 'Caveat', 'Rubik', 'Bebas Neue',
  'Righteous', 'Lobster', 'Cinzel', 'Titan One', 'Shadows Into Light',
  'Satisfy', 'Comfortaa', 'Bree Serif', 'Exo 2', 'Creepster', 'Impact',
  'Courier New', 'Times New Roman', 'Orbitron', 'Rajdhani', 'Teko',
  'Yatra One', 'Rozha One', 'Mukta', 'Martel'
];

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
      fontColor: '#FFFFFF',
      highlightColor: '#FACC15',
      outlineColor: '#000000',
      outlineThickness: 1.5,
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#FACC15', activeWordScale: 1.25, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#22C55E', activeWordScale: 1.35, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  },
  {
    id: 'glow',
    name: 'Neon Glow',
    icon: '⚡',
    style: {
      fontName: 'Montserrat',
      textCase: 'upper',
      activeWordScale: 1.15,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: true,
      showHighlightBox: false,
      neonGlow: true,
      textTransition: 'zoom-in-out-blur-fade',
      showEmojis: true,
      autoEmphasis: false,
      pop3d: false,
      fontColor: '#FFFFFF',
      highlightColor: '#F43F5E',
      outlineColor: '#000000',
      outlineThickness: 1.5,
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: true, glowColor: '#F43F5E', glowBlur: 8, glowDistance: 4 },
      highlightStyle: { fontColor: '#F43F5E', activeWordScale: 1.15, neonGlow: true, glowColor: '#FFFFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#10B981', activeWordScale: 1.25, neonGlow: true, glowColor: '#FFFFFF', glowBlur: 6, glowDistance: 3 }
    }
  },
  {
    id: 'karaoke',
    name: 'Karaoke Style',
    icon: '🎤',
    style: {
      fontName: 'Montserrat',
      textCase: 'default',
      activeWordScale: 1.0,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: true,
      showHighlightBox: false,
      neonGlow: false,
      textTransition: 'none',
      showEmojis: false,
      autoEmphasis: false,
      pop3d: false,
      fontColor: '#FFFFFF',
      highlightColor: '#38BDF8',
      outlineColor: '#000000',
      outlineThickness: 1.5,
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#38BDF8', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#38BDF8', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  },
  {
    id: 'glitch',
    name: 'RGB Glitch',
    icon: '👾',
    style: {
      fontName: 'Impact',
      textCase: 'upper',
      activeWordScale: 1.2,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: false,
      showHighlightBox: false,
      neonGlow: false,
      textTransition: 'none',
      showEmojis: true,
      autoEmphasis: false,
      pop3d: true,
      pop3dColor: '#FF00FF',
      pop3dDepth: 6,
      fontColor: '#FFFFFF',
      highlightColor: '#00FFFF',
      outlineColor: '#000000',
      outlineThickness: 1.5,
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#00FFFF', activeWordScale: 1.2, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#00FFFF', activeWordScale: 1.2, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  },
  {
    id: 'fade',
    name: 'Fade Reveal',
    icon: '✨',
    style: {
      fontName: 'Montserrat',
      textCase: 'default',
      activeWordScale: 1.1,
      highlightTrigger: 'all',
      bold: true,
      italic: false,
      shadow: true,
      showHighlightBox: false,
      neonGlow: false,
      textTransition: 'slide-up-fade',
      showEmojis: false,
      autoEmphasis: false,
      pop3d: false,
      fontColor: '#E2E8F0',
      highlightColor: '#10B981',
      outlineColor: '#000000',
      outlineThickness: 1.5,
      normalStyle: { fontColor: '#E2E8F0', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#10B981', activeWordScale: 1.1, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#10B981', activeWordScale: 1.1, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    icon: '⌨️',
    style: {
      fontName: 'Courier New',
      textCase: 'default',
      activeWordScale: 1.0,
      highlightTrigger: 'none',
      bold: false,
      italic: false,
      shadow: false,
      showHighlightBox: false,
      neonGlow: false,
      textTransition: 'none',
      showEmojis: false,
      autoEmphasis: false,
      pop3d: false,
      fontColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineThickness: 1.5,
      normalStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      highlightStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 },
      emojiStyle: { fontColor: '#FFFFFF', activeWordScale: 1.0, neonGlow: false, glowColor: '#00FFFF', glowBlur: 6, glowDistance: 3 }
    }
  }
];

export const SubtitleStyleEditor: React.FC<SubtitleStyleEditorProps> = ({
  subtitleMode,
  setSubtitleMode,
  fontName,
  setFontName,
  fontSize,
  setFontSize,
  setFontColor,
  outlineColor,
  setOutlineColor,
  outlineThickness,
  setOutlineThickness,
  bold,
  setBold,
  italic,
  setItalic,
  shadow,
  setShadow,
  setHighlightColor,
  showHighlightBox,
  setShowHighlightBox,
  boxColor,
  setBoxColor,
  boxRounding,
  setBoxRounding,
  textFade,
  setTextFade,
  textTransition,
  setTextTransition,
  textMotion,
  setTextMotion,
  activeWordScale,
  setActiveWordScale,
  wordDisplayTime,
  setWordDisplayTime,
  maxWordsPerLine,
  setMaxWordsPerLine,
  textPositionX,
  setTextPositionX,
  textPositionY,
  setTextPositionY,
  showEmojis,
  setShowEmojis,
  setAutoEmphasis,
  neonGlow,
  setNeonGlow,
  setGlowColor,
  glowBlur,
  setGlowBlur,
  glowDistance,
  setGlowDistance,
  highlightTrigger,
  setHighlightTrigger,
  textCase,
  setTextCase,
  pop3d,
  setPop3d,
  setPop3dColor,
  pop3dDepth,
  setPop3dDepth,
  letterSpacing,
  setLetterSpacing,
  wordSpacing,
  setWordSpacing,
  shadowColor,
  setShadowColor,
  shadowBlur,
  setShadowBlur,
  shadowDistance,
  setShadowDistance,
  shadowAngle,
  setShadowAngle,
  shadowOpacity,
  setShadowOpacity,
  normalStyle,
  setNormalStyle,
  highlightStyle,
  setHighlightStyle,
  emojiStyle,
  setEmojiStyle,
  headingTitle,
  setHeadingTitle,
  headingFontName,
  setHeadingFontName,
  headingFontSize,
  setHeadingFontSize,
  headingFontColor,
  setHeadingFontColor,
  headingBoxColor,
  setHeadingBoxColor,
  headingPadding,
  setHeadingPadding,
  showTimer,
  setShowTimer,
  headingTopOffset,
  setHeadingTopOffset,
  headingLeftOffset,
  setHeadingLeftOffset,
  headingBoxOpacity,
  setHeadingBoxOpacity,
  headingTextOpacity,
  setHeadingTextOpacity,
  brandingTheme,
  setBrandingTheme,
  seriesName,
  setSeriesName,
  episodeNumber,
  setEpisodeNumber,
  nextEpisode,
  setNextEpisode,
  scenes,
  setScenes,
  sfxList = [],
  handlePlaySfx,
  previewingSfx,
  onSaveFields,
  brandPrimaryColor,
  setBrandPrimaryColor,
  brandSecondaryColor,
  setBrandSecondaryColor,
  cardPositionY,
  setCardPositionY,
  cardScale,
  setCardScale,
  cardFontName,
  setCardFontName,
  showLayoutCards,
  setShowLayoutCards,
  applyHUDToAll = true,
  setApplyHUDToAll,
  textBackgroundStyle,
  setTextBackgroundStyle,
  textAnimation,
  setTextAnimation,
  boxPadding,
  setBoxPadding,
  outlineSize,
  setOutlineSize,
}) => {
  const [activeAccordion, setActiveAccordion] = useState<'layout' | 'typography' | 'words' | 'branding' | 'cards' | 'effects' | null>('layout');
  const [fontSelectorOpen, setFontSelectorOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [fontLoading, setFontLoading] = useState(false);
  const [fontDownloadError, setFontDownloadError] = useState('');
  const [styleTab, setStyleTab] = useState<'normal' | 'highlight' | 'emoji'>('normal');

  // Load Google Font style dynamically in document head
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
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(targetFont)}:wght@400;700;900&display=swap`;
    document.head.appendChild(link);
  };

  useEffect(() => {
    if (fontName) loadGoogleFont(fontName);
  }, [fontName]);

  useEffect(() => {
    if (headingFontName) loadGoogleFont(headingFontName);
  }, [headingFontName]);

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
      if (onSaveFields) onSaveFields({ fontName: customFont });
      setFontSelectorOpen(false);
      setFontSearchQuery('');
    } catch (err: any) {
      console.error(err);
      setFontDownloadError(err.message || 'Font not found on Google Fonts.');
    } finally {
      setFontLoading(false);
    }
  };

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
    if (s.outlineThickness !== undefined) setOutlineThickness(s.outlineThickness);
    if (s.normalStyle !== undefined) setNormalStyle(s.normalStyle);
    if (s.highlightStyle !== undefined) setHighlightStyle(s.highlightStyle);
    if (s.emojiStyle !== undefined) setEmojiStyle(s.emojiStyle);

    if (onSaveFields) {
      onSaveFields({
        fontName: s.fontName,
        textCase: s.textCase,
        activeWordScale: s.activeWordScale,
        highlightTrigger: s.highlightTrigger,
        bold: s.bold,
        italic: s.italic,
        shadow: s.shadow,
        showHighlightBox: s.showHighlightBox,
        neonGlow: s.neonGlow,
        textTransition: s.textTransition,
        showEmojis: s.showEmojis,
        autoEmphasis: s.autoEmphasis,
        pop3d: s.pop3d,
        pop3dColor: s.pop3dColor,
        fontColor: s.fontColor,
        highlightColor: s.highlightColor,
        outlineColor: s.outlineColor,
        outlineThickness: s.outlineThickness,
        normalStyle: s.normalStyle,
        highlightStyle: s.highlightStyle,
        emojiStyle: s.emojiStyle
      });
    }
  };

  const filteredFonts = CURATED_FONTS.filter(font =>
    font.toLowerCase().includes(fontSearchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* CAPTION STYLE PRESETS */}
      <div className="inspector-card" style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-medium)', borderRadius: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-white)', display: 'block', marginBottom: '8px' }}>🎨 Caption Style Presets</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {CAPTION_PRESETS.map(preset => {
            const isSelected = fontName === preset.style.fontName && neonGlow === preset.style.neonGlow && pop3d === preset.style.pop3d;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyCaptionPreset(preset)}
                className="btn-secondary"
                style={{
                  fontSize: '10px', padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: '4px',
                  alignItems: 'center', height: 'auto', border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  background: isSelected ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'var(--bg-darker)'
                }}
              >
                <span style={{ fontSize: '14px' }}>{preset.icon}</span>
                <span style={{ fontSize: '9px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%', textAlign: 'center', color: 'var(--text-white)' }}>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ACCORDION 1: LAYOUT & POSITIONING */}
      <div className="inspector-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div 
          onClick={() => setActiveAccordion(activeAccordion === 'layout' ? null : 'layout')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer',
            borderBottom: activeAccordion === 'layout' ? '1px solid var(--border-light)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '6px' }}>📐 Layout & Positioning</span>
          <span style={{ fontSize: '9px', color: 'var(--text-gray)' }}>{activeAccordion === 'layout' ? '▲' : '▼'}</span>
        </div>
        
        {activeAccordion === 'layout' && (
          <div style={{ padding: '16px', animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label">Caption Mode</label>
              <select
                value={subtitleMode}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setSubtitleMode(val);
                  if (onSaveFields) onSaveFields({ subtitleMode: val });
                }}
                className="input-field"
                style={{ height: '34px', fontSize: '12.5px', background: 'var(--bg-darker)' }}
              >
                <option value="classic">Classic Lines</option>
                <option value="smart-highlight">Smart Highlight</option>
                <option value="centered-word">Snappy Single Word</option>
                <option value="pop">Floating Pop</option>
                <option value="simple">Simple Text</option>
              </select>
            </div>

            {subtitleMode !== 'pop' && (
              <div>
                <label className="label" style={{ marginBottom: '6px' }}>Anchor Alignment</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="position-grid" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px',
                    background: 'var(--bg-darker)', border: '1px solid var(--border-medium)', borderRadius: '6px',
                    padding: '6px', flexShrink: 0
                  }}>
                    {[
                      { label: 'TL', x: -70, y: 75 }, { label: 'T', x: 0, y: 75 }, { label: 'TR', x: 70, y: 75 },
                      { label: 'L', x: -70, y: 0 }, { label: 'C', x: 0, y: 0 }, { label: 'R', x: 70, y: 0 },
                      { label: 'BL', x: -70, y: -70 }, { label: 'B', x: 0, y: -70 }, { label: 'BR', x: 70, y: -70 }
                    ].map((pos, idx) => {
                      const isSelected = textPositionX === pos.x && textPositionY === pos.y;
                      return (
                        <button
                          key={idx} type="button"
                          onClick={() => {
                            setTextPositionX(pos.x);
                            setTextPositionY(pos.y);
                            if (onSaveFields) onSaveFields({ textPositionX: pos.x, textPositionY: pos.y });
                          }}
                          title={pos.label}
                          className={`matrix-btn ${isSelected ? 'active' : ''}`}
                          style={{ border: 'none', padding: 0 }}
                        >
                          {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-foreground)' }} />}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', fontFamily: 'Inter' }}>
                      Select cell to snap subtitles, or drag the offsets below.
                    </span>
                    <button
                      type="button" className="btn-secondary"
                      style={{ alignSelf: 'flex-start', padding: '2px 8px', height: '24px', fontSize: '10px', borderColor: 'rgba(255, 255, 255, 0.08)', fontFamily: 'Inter', fontWeight: 600 }}
                      onClick={() => {
                        setTextPositionX(0);
                        setTextPositionY(-70);
                        if (onSaveFields) onSaveFields({ textPositionX: 0, textPositionY: -70 });
                      }}
                    >
                      Reset to Bottom
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Horizontal Offset (X)</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{textPositionX > 0 ? `+${textPositionX}` : textPositionX}px</span>
                </div>
                <input
                  type="range" min={-100} max={100} step={5} value={textPositionX}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTextPositionX(val);
                  }}
                  onMouseUp={() => {
                    if (onSaveFields) onSaveFields({ textPositionX });
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Vertical Offset (Y)</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{textPositionY > 0 ? `+${textPositionY}` : textPositionY}px</span>
                </div>
                <input
                  type="range" min={-100} max={100} step={5} value={textPositionY}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTextPositionY(val);
                  }}
                  onMouseUp={() => {
                    if (onSaveFields) onSaveFields({ textPositionY });
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              
              {(subtitleMode === 'classic' || subtitleMode === 'smart-highlight') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Max Words per Line</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{maxWordsPerLine}</span>
                  </div>
                  <input
                    type="range" min={1} max={15} step={1} value={maxWordsPerLine}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setMaxWordsPerLine(val);
                      if (onSaveFields) onSaveFields({ maxWordsPerLine: val });
                    }}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>
              )}

              {subtitleMode === 'pop' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>Word Display Time</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{wordDisplayTime.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range" min={0.3} max={3.0} step={0.1} value={wordDisplayTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setWordDisplayTime(val);
                      if (onSaveFields) onSaveFields({ wordDisplayTime: val });
                    }}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" id="fade-transition" checked={textFade} 
                    onChange={(e) => {
                      setTextFade(e.target.checked);
                      if (onSaveFields) onSaveFields({ textFade: e.target.checked });
                    }} 
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="fade-transition" style={{ fontSize: '12px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-white)' }}>
                    In/Out Fade (150ms)
                  </label>
                </div>

                <div>
                  <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>In/Out Transition Effect</label>
                  <select 
                    className="input-field" 
                    value={textTransition} 
                    onChange={(e) => {
                      setTextTransition(e.target.value);
                      if (onSaveFields) onSaveFields({ textTransition: e.target.value });
                    }}
                    style={{ height: '32px', fontSize: '11.5px', background: 'var(--bg-darker)' }}
                  >
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

                <div>
                  <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>Stay Animation (Continuous Motion)</label>
                  <select 
                    className="input-field" 
                    value={textMotion} 
                    onChange={(e) => {
                      setTextMotion(e.target.value);
                      if (onSaveFields) onSaveFields({ textMotion: e.target.value });
                    }}
                    style={{ height: '32px', fontSize: '11.5px', background: 'var(--bg-darker)' }}
                  >
                    <option value="none">None (Stationary)</option>
                    <option value="float">Floating Text (Slow Rise)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 2: TYPOGRAPHY & STYLE */}
      <div className="inspector-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div 
          onClick={() => setActiveAccordion(activeAccordion === 'typography' ? null : 'typography')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer',
            borderBottom: activeAccordion === 'typography' ? '1px solid var(--border-light)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '6px' }}>✍️ Typography & Outline</span>
          <span style={{ fontSize: '9px', color: 'var(--text-gray)' }}>{activeAccordion === 'typography' ? '▲' : '▼'}</span>
        </div>

        {activeAccordion === 'typography' && (
          <div style={{ padding: '16px', animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ position: 'relative' }}>
              <label className="label">Font Family</label>
              <div
                className="input-field"
                onClick={(e) => {
                  e.stopPropagation();
                  setFontSelectorOpen(!fontSelectorOpen);
                }}
                style={{
                  cursor: 'pointer', display: 'flex', alignItems: 'center', height: '38px',
                  background: 'var(--bg-darker)', border: '1px solid var(--border-medium)',
                  borderRadius: '4px', padding: '0 12px'
                }}
              >
                <Search size={14} style={{ marginRight: '8px', opacity: 0.4 }} />
                <span style={{ fontFamily: fontName, fontSize: '13px', fontWeight: 600 }}>{fontName}</span>
                <span style={{ fontSize: '8px', color: 'var(--text-gray)', marginLeft: 'auto' }}>▼</span>
              </div>

              {fontSelectorOpen && (
                <div
                  className="premium-card"
                  style={{
                    position: 'absolute', top: '64px', left: 0, right: 0, zIndex: 100, padding: '12px',
                    display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-light)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text" className="input-field" placeholder="Search Google Fonts..." value={fontSearchQuery}
                    onChange={(e) => {
                      setFontSearchQuery(e.target.value);
                      setFontDownloadError('');
                    }}
                    style={{ height: '32px', fontSize: '12px' }}
                    autoFocus
                  />

                  {fontLoading && (
                    <div style={{ fontSize: '11px', color: 'var(--accent-purple)', padding: '4px' }}>
                      Downloading from Google Fonts...
                    </div>
                  )}
                  {fontDownloadError && (
                    <div style={{ fontSize: '11px', color: '#f87171', padding: '4px' }}>
                      {fontDownloadError}
                    </div>
                  )}

                  <div
                    className="custom-scrollbar"
                    style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '4px' }}
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
                          } catch (_) {}
                          loadGoogleFont(font);
                          setFontName(font);
                          if (onSaveFields) onSaveFields({ fontName: font });
                          setFontSelectorOpen(false);
                          setFontSearchQuery('');
                        }}
                        style={{
                          padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontFamily: font, fontSize: '13px',
                          background: fontName === font ? 'rgba(var(--scrollbar-thumb), 0.15)' : 'transparent',
                          color: fontName === font ? 'var(--text-white)' : 'var(--text-gray)', transition: 'background 0.2s',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <span>{font}</span>
                        <span style={{ fontSize: '9px', opacity: 0.5, fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>Preview</span>
                      </div>
                    ))}

                    {filteredFonts.length === 0 && fontSearchQuery.trim().length > 0 && (
                      <div
                        onClick={() => handleAddCustomFont(fontSearchQuery.trim())}
                        style={{
                          padding: '8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'center',
                          border: '1px dashed var(--border-medium)', color: 'var(--accent-purple)', fontSize: '12px', fontWeight: 600
                        }}
                      >
                        📥 Download "{fontSearchQuery.trim()}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Font Size</span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{fontSize}px</span>
              </div>
              <input
                type="range" min={16} max={48} step={1} value={fontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setFontSize(val);
                }}
                onMouseUp={() => {
                  if (onSaveFields) onSaveFields({ fontSize });
                }}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
              <div>
                <label className="label" style={{ marginBottom: '4px' }}>Outline Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="color" value={outlineColor} 
                    onChange={(e) => {
                      setOutlineColor(e.target.value);
                      if (onSaveFields) onSaveFields({ outlineColor: e.target.value });
                    }} 
                    style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} 
                  />
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-white)' }}>{outlineColor.toUpperCase()}</span>
                </div>
              </div>

              <div>
                <label className="label" style={{ marginBottom: '4px' }}>Formatting</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setBold(!bold);
                      if (onSaveFields) onSaveFields({ bold: !bold });
                    }}
                    style={{
                      flex: 1, padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                      background: bold ? 'var(--primary)' : 'var(--bg-darker)',
                      border: '1px solid var(--border-medium)', color: bold ? '#121212' : 'var(--text-gray)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    title="Bold Text"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItalic(!italic);
                      if (onSaveFields) onSaveFields({ italic: !italic });
                    }}
                    style={{
                      flex: 1, padding: '6px', borderRadius: '4px', fontSize: '11px', fontStyle: 'italic',
                      background: italic ? 'var(--primary)' : 'var(--bg-darker)',
                      border: '1px solid var(--border-medium)', color: italic ? '#121212' : 'var(--text-gray)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    title="Italic Text"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShadow(!shadow);
                      if (onSaveFields) onSaveFields({ shadow: !shadow });
                    }}
                    style={{
                      flex: 1, padding: '6px', borderRadius: '4px', fontSize: '11px',
                      background: shadow ? 'var(--primary)' : 'var(--bg-darker)',
                      border: '1px solid var(--border-medium)', color: shadow ? '#121212' : 'var(--text-gray)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    title="Drop Shadow"
                  >
                    S
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Outline Width</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{outlineThickness}px</span>
                </div>
                <input
                  type="range" min={0} max={5} step={0.5} value={outlineThickness}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setOutlineThickness(val);
                  }}
                  onMouseUp={() => {
                    if (onSaveFields) onSaveFields({ outlineThickness });
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>3D Pop Depth</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{pop3dDepth}px</span>
                </div>
                <input
                  type="range" min={1} max={15} step={1} value={pop3dDepth}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setPop3dDepth(val);
                  }}
                  onMouseUp={() => {
                    if (onSaveFields) onSaveFields({ pop3dDepth });
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Letter Spacing</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{letterSpacing}px</span>
                </div>
                <input
                  type="range" min={-5} max={15} step={1} value={letterSpacing}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setLetterSpacing(val);
                  }}
                  onMouseUp={() => {
                    if (onSaveFields) onSaveFields({ letterSpacing });
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>Word Spacing</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{wordSpacing}px</span>
                </div>
                <input
                  type="range" min={-5} max={25} step={1} value={wordSpacing}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setWordSpacing(val);
                  }}
                  onMouseUp={() => {
                    if (onSaveFields) onSaveFields({ wordSpacing });
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
            </div>

            {/* Advanced Shadows controls */}
            {shadow && (
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-medium)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-white)' }}>Custom Drop Shadow Control</span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="label" style={{ fontSize: '10px', marginBottom: '2px' }}>Color</label>
                    <input 
                      type="color" value={shadowColor} 
                      onChange={(e) => {
                        setShadowColor(e.target.value);
                        if (onSaveFields) onSaveFields({ shadowColor: e.target.value });
                      }} 
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '10px', marginBottom: '2px' }}>Opacity ({shadowOpacity})</label>
                    <input 
                      type="range" min={0} max={1} step={0.1} value={shadowOpacity} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setShadowOpacity(val);
                      }}
                      onMouseUp={() => {
                        if (onSaveFields) onSaveFields({ shadowOpacity });
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Blur ({shadowBlur}px)</span>
                    <input 
                      type="range" min={0} max={15} step={1} value={shadowBlur} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setShadowBlur(val);
                      }}
                      onMouseUp={() => {
                        if (onSaveFields) onSaveFields({ shadowBlur });
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Dist ({shadowDistance}px)</span>
                    <input 
                      type="range" min={0} max={20} step={1} value={shadowDistance} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setShadowDistance(val);
                      }}
                      onMouseUp={() => {
                        if (onSaveFields) onSaveFields({ shadowDistance });
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Angle ({shadowAngle}°)</span>
                    <input 
                      type="range" min={0} max={360} step={5} value={shadowAngle} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setShadowAngle(val);
                      }}
                      onMouseUp={() => {
                        if (onSaveFields) onSaveFields({ shadowAngle });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="label" style={{ marginBottom: '4px' }}>Text Case / Capitalization</label>
              <select
                value={textCase}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setTextCase(val);
                  if (onSaveFields) onSaveFields({ textCase: val });
                }}
                className="input-field"
                style={{ width: '100%', height: '34px', fontSize: '12px', background: 'var(--bg-darker)' }}
              >
                <option value="default">Default (As Transcribed)</option>
                <option value="upper">ALL CAPITAL LETTERS</option>
                <option value="first-word-larger">First Letter Larger, All Caps</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 2.5: TEXT EFFECTS & ANIMATIONS */}
      <div className="inspector-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div 
          onClick={() => setActiveAccordion(activeAccordion === 'effects' ? null : 'effects')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer',
            borderBottom: activeAccordion === 'effects' ? '1px solid var(--border-light)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '6px' }}>🎬 Text Effects & Animations</span>
          <span style={{ fontSize: '9px', color: 'var(--text-gray)' }}>{activeAccordion === 'effects' ? '▲' : '▼'}</span>
        </div>

        {activeAccordion === 'effects' && (
          <div style={{ padding: '16px', animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Background Style Select */}
            <div>
              <label className="label">Background Style</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'none', label: 'None' },
                  { id: 'rounded-box', label: 'Rounded Box' },
                  { id: 'outline-badge', label: 'Outline Badge' },
                  { id: 'semi-transparent', label: 'Semi-Transparent' }
                ].map(style => (
                  <button
                    key={style.id} type="button" 
                    onClick={() => {
                      setTextBackgroundStyle(style.id as any);
                      if (onSaveFields) onSaveFields({ textBackgroundStyle: style.id });
                    }}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: textBackgroundStyle === style.id ? 'rgba(var(--scrollbar-thumb), 0.1)' : 'transparent',
                      border: textBackgroundStyle === style.id ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      color: textBackgroundStyle === style.id ? 'var(--text-white)' : 'var(--text-gray)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Animation Selector */}
            <div>
              <label className="label">Text Animation</label>
              <select
                className="input-field"
                value={textAnimation}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setTextAnimation(val);
                  if (onSaveFields) onSaveFields({ textAnimation: val });
                }}
                style={{ height: '34px', fontSize: '12px', background: 'var(--bg-darker)' }}
              >
                <option value="none">None (Static)</option>
                <option value="typewriter">Typewriter (Reveal)</option>
                <option value="bounce">Bounce (Spring Pop)</option>
                <option value="flicker">Flicker (Neon Pulse)</option>
                <option value="slide">Slide (Glide Up/Down)</option>
                <option value="wave">Wave (Letter Bobbing)</option>
                <option value="glitch">Glitch (Skews)</option>
              </select>
            </div>

            {/* Optional controls when background style is not none */}
            {textBackgroundStyle !== 'none' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <label className="label" style={{ margin: 0, fontSize: '11px' }}>Box Padding</label>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{boxPadding}</span>
                  </div>
                  <select
                    className="input-field"
                    value={boxPadding}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBoxPadding(val);
                      if (onSaveFields) onSaveFields({ boxPadding: val });
                    }}
                    style={{ height: '28px', padding: '2px 6px', fontSize: '11px', background: 'var(--bg-darker)' }}
                  >
                    <option value="2px 4px">Extra Tight</option>
                    <option value="4px 8px">Tight</option>
                    <option value="6px 12px">Standard</option>
                    <option value="8px 16px">Loose</option>
                    <option value="12px 24px">Extra Loose</option>
                  </select>
                </div>

                {textBackgroundStyle === 'outline-badge' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label className="label" style={{ margin: 0, fontSize: '11px' }}>Outline Weight</label>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{outlineSize}px</span>
                    </div>
                    <input
                      type="range" min={1} max={10} value={outlineSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setOutlineSize(val);
                      }}
                      onMouseUp={() => {
                        if (onSaveFields) onSaveFields({ outlineSize });
                      }}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ACCORDION 3: ACTIVE WORD STYLES */}
      <div className="inspector-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div 
          onClick={() => setActiveAccordion(activeAccordion === 'words' ? null : 'words')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer',
            borderBottom: activeAccordion === 'words' ? '1px solid var(--border-light)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '6px' }}>✨ Active Word Styles</span>
          <span style={{ fontSize: '9px', color: 'var(--text-gray)' }}>{activeAccordion === 'words' ? '▲' : '▼'}</span>
        </div>

        {activeAccordion === 'words' && (
          <div style={{ padding: '16px', animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>✨</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)' }}>Active Word Highlighting</span>
              </div>
              <div 
                className={`stitch-switch ${highlightTrigger !== 'none' ? 'active' : ''}`} 
                onClick={() => {
                  const target = highlightTrigger !== 'none' ? 'none' : 'all';
                  setHighlightTrigger(target);
                  if (onSaveFields) onSaveFields({ highlightTrigger: target });
                }}
              >
                <div className="stitch-switch-handle" />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '6px', marginBottom: '8px' }}>
              {(['normal', 'highlight', 'emoji'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStyleTab(tab)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: '4px', border: 'none',
                    fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer',
                    background: styleTab === tab ? 'var(--primary)' : 'transparent',
                    color: styleTab === tab ? '#121212' : 'var(--text-gray)',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

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
                      if (styleTab === 'normal') {
                        setNormalStyle({ ...normalStyle, fontColor: val });
                        setFontColor(val);
                        if (onSaveFields) onSaveFields({ normalStyle: { ...normalStyle, fontColor: val }, fontColor: val });
                      } else if (styleTab === 'highlight') {
                        setHighlightStyle({ ...highlightStyle, fontColor: val });
                        setHighlightColor(val);
                        if (onSaveFields) onSaveFields({ highlightStyle: { ...highlightStyle, fontColor: val }, highlightColor: val });
                      } else {
                        setEmojiStyle({ ...emojiStyle, fontColor: val });
                        if (onSaveFields) onSaveFields({ emojiStyle: { ...emojiStyle, fontColor: val } });
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
                      if (onSaveFields) onSaveFields({ normalStyle: { ...normalStyle, fontColor: val }, fontColor: val });
                    } else if (styleTab === 'highlight') {
                      setHighlightStyle({ ...highlightStyle, fontColor: val });
                      setHighlightColor(val);
                      if (onSaveFields) onSaveFields({ highlightStyle: { ...highlightStyle, fontColor: val }, highlightColor: val });
                    } else {
                      setEmojiStyle({ ...emojiStyle, fontColor: val });
                      if (onSaveFields) onSaveFields({ emojiStyle: { ...emojiStyle, fontColor: val } });
                    }
                  }}
                  className="input-field"
                  style={{ flex: 1, height: '24px', padding: '2px 6px', fontSize: '10px', fontFamily: 'monospace' }}
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
                onMouseUp={() => {
                  if (onSaveFields) {
                    if (styleTab === 'normal') onSaveFields({ normalStyle: { ...normalStyle } });
                    else if (styleTab === 'highlight') onSaveFields({ highlightStyle: { ...highlightStyle }, activeWordScale });
                    else onSaveFields({ emojiStyle: { ...emojiStyle } });
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
                    let target = false;
                    if (styleTab === 'normal') {
                      target = !normalStyle.neonGlow;
                      setNormalStyle({ ...normalStyle, neonGlow: target });
                      setNeonGlow(target);
                      if (onSaveFields) onSaveFields({ normalStyle: { ...normalStyle, neonGlow: target }, neonGlow: target });
                    } else if (styleTab === 'highlight') {
                      target = !highlightStyle.neonGlow;
                      setHighlightStyle({ ...highlightStyle, neonGlow: target });
                      if (onSaveFields) onSaveFields({ highlightStyle: { ...highlightStyle, neonGlow: target } });
                    } else {
                      target = !emojiStyle.neonGlow;
                      setEmojiStyle({ ...emojiStyle, neonGlow: target });
                      if (onSaveFields) onSaveFields({ emojiStyle: { ...emojiStyle, neonGlow: target } });
                    }
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
                            if (styleTab === 'normal') {
                              setNormalStyle({ ...normalStyle, glowColor: val });
                              setGlowColor(val);
                              if (onSaveFields) onSaveFields({ normalStyle: { ...normalStyle, glowColor: val }, glowColor: val });
                            } else if (styleTab === 'highlight') {
                              setHighlightStyle({ ...highlightStyle, glowColor: val });
                              if (onSaveFields) onSaveFields({ highlightStyle: { ...highlightStyle, glowColor: val } });
                            } else {
                              setEmojiStyle({ ...emojiStyle, glowColor: val });
                              if (onSaveFields) onSaveFields({ emojiStyle: { ...emojiStyle, glowColor: val } });
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
                            if (onSaveFields) onSaveFields({ normalStyle: { ...normalStyle, glowColor: hex }, glowColor: hex });
                          } else if (styleTab === 'highlight') {
                            setHighlightStyle({ ...highlightStyle, glowColor: hex });
                            if (onSaveFields) onSaveFields({ highlightStyle: { ...highlightStyle, glowColor: hex } });
                          } else {
                            setEmojiStyle({ ...emojiStyle, glowColor: hex });
                            if (onSaveFields) onSaveFields({ emojiStyle: { ...emojiStyle, glowColor: hex } });
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
                      onMouseUp={() => {
                        if (onSaveFields) {
                          if (styleTab === 'normal') onSaveFields({ normalStyle: { ...normalStyle }, glowBlur });
                          else if (styleTab === 'highlight') onSaveFields({ highlightStyle: { ...highlightStyle } });
                          else onSaveFields({ emojiStyle: { ...emojiStyle } });
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
                      onMouseUp={() => {
                        if (onSaveFields) {
                          if (styleTab === 'normal') onSaveFields({ normalStyle: { ...normalStyle }, glowDistance });
                          else if (styleTab === 'highlight') onSaveFields({ highlightStyle: { ...highlightStyle } });
                          else onSaveFields({ emojiStyle: { ...emojiStyle } });
                        }
                      }}
                      style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Highlight Trigger & Box Styles (Only for active highlighting modes) */}
            {(subtitleMode === 'pop' || subtitleMode === 'centered-word' || subtitleMode === 'smart-highlight') && (
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label className="label" style={{ fontSize: '11px', marginBottom: '4px' }}>Highlight Trigger Mode</label>
                  <select
                    value={highlightTrigger}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setHighlightTrigger(val);
                      if (onSaveFields) onSaveFields({ highlightTrigger: val });
                    }}
                    className="input-field"
                    style={{ width: '100%', height: '34px', fontSize: '12px', background: 'var(--bg-darker)' }}
                  >
                    <option value="all">Highlight Every Word (Standard)</option>
                    <option value="emphasis">Highlight Emphasis/Highlight Words Only</option>
                    <option value="emoji">Highlight Emoji Words Only</option>
                    <option value="none">No Highlighting (Plain Static Text)</option>
                  </select>
                </div>

                {(subtitleMode === 'pop' || subtitleMode === 'centered-word') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input 
                      type="checkbox" id="show-bg-box" checked={showHighlightBox} 
                      onChange={(e) => {
                        setShowHighlightBox(e.target.checked);
                        if (onSaveFields) onSaveFields({ showHighlightBox: e.target.checked });
                      }} 
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="show-bg-box" style={{ fontSize: '12px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-white)' }}>
                      Show Word Background Box
                    </label>
                  </div>
                )}

                {(subtitleMode === 'pop' || subtitleMode === 'centered-word') && showHighlightBox && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                    <div>
                      <label className="label" style={{ fontSize: '10.5px' }}>Background Box Color</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="color" value={boxColor} 
                          onChange={(e) => {
                            setBoxColor(e.target.value);
                            if (onSaveFields) onSaveFields({ boxColor: e.target.value });
                          }} 
                        />
                        <input 
                          type="text" value={boxColor.toUpperCase()} 
                          onChange={(e) => {
                            let val = e.target.value;
                            if (val.startsWith('#') && val.length <= 7) {
                              setBoxColor(val);
                              if (onSaveFields) onSaveFields({ boxColor: val });
                            } else if (val.length <= 6 && !val.startsWith('#')) {
                              setBoxColor('#' + val);
                              if (onSaveFields) onSaveFields({ boxColor: '#' + val });
                            }
                          }}
                          className="input-field"
                          style={{ width: '90px', height: '28px', padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center' }}
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0, fontSize: '10.5px' }}>Box Corner Rounding</label>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{boxRounding}px</span>
                      </div>
                      <input
                        type="range" min={0} max={24} value={boxRounding}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setBoxRounding(val);
                        }}
                        onMouseUp={() => {
                          if (onSaveFields) onSaveFields({ boxRounding });
                        }}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Emoji SFX Mapping Trigger */}
            {(() => {
              const emojiWordsList: {
                sceneIdx: number;
                wordIdx: number;
                wordObj: WordTiming;
                emoji: string;
              }[] = [];
              scenes.forEach((scene, sceneIdx) => {
                if (scene.words && Array.isArray(scene.words)) {
                  scene.words.forEach((wordObj: WordTiming, wordIdx: number) => {
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
                  if (onSaveFields) onSaveFields({ scenes: updatedScenes });
                }
              };

              if (!showEmojis || emojiWordsList.length === 0) return null;

              return (
                <div style={{ marginTop: '16px', background: 'var(--bg-darker)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-white)' }}>🎵 Emoji Word SFX Mappings</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{emojiWordsList.length} detected</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-gray)', marginBottom: '10px' }}>
                    Play sound effects exactly when these key emoji words are spoken.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                    {emojiWordsList.map(({ sceneIdx, wordIdx, wordObj, emoji }) => {
                      const displayWord = wordObj.word;
                      const selectedSfx = wordObj.sfx || 'none';
                      return (
                        <div key={`${sceneIdx}_${wordIdx}`} style={{ 
                          display: 'flex', flexDirection: 'column', gap: '4px',
                          background: 'var(--bg-medium)', border: '1px solid var(--border-light)', 
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
                              style={{ flex: 1, height: '28px', fontSize: '11px', padding: '0 6px', background: 'var(--bg-darker)' }}
                            >
                              <option value="none">No Sound Effect</option>
                              {sfxList.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            {selectedSfx !== 'none' && handlePlaySfx && (
                              <button
                                type="button"
                                onClick={() => handlePlaySfx(selectedSfx)}
                                style={{
                                  background: 'var(--bg-darker)', border: 'none', 
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
      </div>

      {/* ACCORDION 4: CINEMATIC BRANDING & HOOKS */}
      <div className="inspector-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div 
          onClick={() => setActiveAccordion(activeAccordion === 'branding' ? null : 'branding')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer',
            borderBottom: activeAccordion === 'branding' ? '1px solid var(--border-light)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '6px' }}>🎬 Cinematic Branding & Hooks</span>
          <span style={{ fontSize: '9px', color: 'var(--text-gray)' }}>{activeAccordion === 'branding' ? '▲' : '▼'}</span>
        </div>

        {activeAccordion === 'branding' && (
          <div style={{ padding: '16px', animation: 'fadeIn 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Hook Badge / Video Title */}
            <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <label className="label" style={{ fontWeight: 600, fontSize: '11.5px', marginBottom: '6px' }}>🎯 Hook Badge / Video Title</label>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', lineHeight: '1.3' }}>
                Add an animated hook heading in the top safe zone for the first 3 seconds of the video.
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 3 SECRETS TO GROW FAST 🚀"
                value={headingTitle}
                onChange={(e) => {
                  setHeadingTitle(e.target.value);
                }}
                onBlur={() => {
                  if (onSaveFields) onSaveFields({ headingTitle });
                }}
                style={{ height: '36px', fontSize: '12px', marginBottom: '10px' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <input 
                  type="checkbox" 
                  id="show-timer-create" 
                  checked={showTimer} 
                  onChange={(e) => {
                    setShowTimer(e.target.checked);
                    if (onSaveFields) onSaveFields({ showTimer: e.target.checked });
                  }} 
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="show-timer-create" style={{ fontSize: '12px', cursor: 'pointer', userSelect: 'none', fontWeight: 500, color: 'var(--text-white)' }}>
                  Show Countdown Timer Overlay
                </label>
              </div>

              {headingTitle.trim().length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                  <div>
                    <label className="label" style={{ fontSize: '10.5px' }}>Hook Font Name</label>
                    <select
                      value={headingFontName}
                      onChange={(e) => {
                        setHeadingFontName(e.target.value);
                        if (onSaveFields) onSaveFields({ headingFontName: e.target.value });
                      }}
                      className="input-field"
                      style={{ height: '30px', fontSize: '11px', background: 'var(--bg-darker)' }}
                    >
                      {CURATED_FONTS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0, fontSize: '10px' }}>Font Size</label>
                        <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>{headingFontSize}px</span>
                      </div>
                      <input
                        type="range" min={12} max={36} value={headingFontSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setHeadingFontSize(val);
                        }}
                        onMouseUp={() => {
                          if (onSaveFields) onSaveFields({ headingFontSize });
                        }}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0, fontSize: '10px' }}>Padding</label>
                        <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>{headingPadding}px</span>
                      </div>
                      <input
                        type="range" min={2} max={16} value={headingPadding}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setHeadingPadding(val);
                        }}
                        onMouseUp={() => {
                          if (onSaveFields) onSaveFields({ headingPadding });
                        }}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                    <div>
                      <label className="label" style={{ fontSize: '10px', marginBottom: '2px' }}>Text Color</label>
                      <input 
                        type="color" value={headingFontColor} 
                        onChange={(e) => {
                          setHeadingFontColor(e.target.value);
                          if (onSaveFields) onSaveFields({ headingFontColor: e.target.value });
                        }} 
                      />
                    </div>

                    <div>
                      <label className="label" style={{ fontSize: '10px', marginBottom: '2px' }}>Box Color</label>
                      <input 
                        type="color" value={headingBoxColor} 
                        onChange={(e) => {
                          setHeadingBoxColor(e.target.value);
                          if (onSaveFields) onSaveFields({ headingBoxColor: e.target.value });
                        }} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0, fontSize: '10px' }}>Box Opacity</label>
                        <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>{headingBoxOpacity}%</span>
                      </div>
                      <input
                        type="range" min={0} max={100} value={headingBoxOpacity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setHeadingBoxOpacity(val);
                        }}
                        onMouseUp={() => {
                          if (onSaveFields) onSaveFields({ headingBoxOpacity });
                        }}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0, fontSize: '10px' }}>Text Opacity</label>
                        <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>{headingTextOpacity}%</span>
                      </div>
                      <input
                        type="range" min={10} max={100} value={headingTextOpacity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setHeadingTextOpacity(val);
                        }}
                        onMouseUp={() => {
                          if (onSaveFields) onSaveFields({ headingTextOpacity });
                        }}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0, fontSize: '10px' }}>Top Offset</label>
                        <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>{headingTopOffset}%</span>
                      </div>
                      <input
                        type="range" min={0} max={40} step={1} value={headingTopOffset}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setHeadingTopOffset(val);
                        }}
                        onMouseUp={() => {
                          if (onSaveFields) onSaveFields({ headingTopOffset });
                        }}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0, fontSize: '10px' }}>Left Offset</label>
                        <span style={{ fontSize: '9px', fontFamily: 'monospace' }}>{headingLeftOffset}%</span>
                      </div>
                      <input
                        type="range" min={0} max={40} step={1} value={headingLeftOffset}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setHeadingLeftOffset(val);
                        }}
                        onMouseUp={() => {
                          if (onSaveFields) onSaveFields({ headingLeftOffset });
                        }}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reel Branding System */}
            <div>
              <label className="label" style={{ fontWeight: 600, fontSize: '11.5px', marginBottom: '6px' }}>🎬 Reel Branding System</label>
              <select
                value={brandingTheme}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setBrandingTheme(val);
                  if (onSaveFields) onSaveFields({ brandingTheme: val });
                }}
                className="input-field"
                style={{ width: '100%', height: '34px', fontSize: '12px', background: 'var(--bg-darker)', marginBottom: '10px' }}
              >
                <option value="none">No Branding Watermarks</option>
                <option value="fitness-in-chunks">"Fitness In Chunks" Documentary Theme</option>
              </select>

              {brandingTheme === 'fitness-in-chunks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                  <div>
                    <label className="label" style={{ fontSize: '10px' }}>Series Name Tag</label>
                    <input
                      type="text" className="input-field" style={{ height: '28px', fontSize: '11px' }}
                      value={seriesName} 
                      onChange={(e) => setSeriesName(e.target.value)}
                      onBlur={() => {
                        if (onSaveFields) onSaveFields({ seriesName });
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="label" style={{ fontSize: '10px' }}>Episode Number</label>
                      <input
                        type="text" className="input-field" style={{ height: '28px', fontSize: '11px' }}
                        value={episodeNumber} 
                        onChange={(e) => setEpisodeNumber(e.target.value)}
                        onBlur={() => {
                          if (onSaveFields) onSaveFields({ episodeNumber });
                        }}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: '10px' }}>Next Episode</label>
                      <input
                        type="text" className="input-field" style={{ height: '28px', fontSize: '11px' }}
                        value={nextEpisode} 
                        onChange={(e) => setNextEpisode(e.target.value)}
                        onBlur={() => {
                          if (onSaveFields) onSaveFields({ nextEpisode });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 💎 HUD & LAYOUT CARDS ─── */}
      <div className="inspector-card" style={{ marginTop: '12px' }}>
        <div
          onClick={() => setActiveAccordion(activeAccordion === 'cards' ? null : 'cards')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0' }}
        >
          <span style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '0.03em' }}>💎 HUD & Layout Cards</span>
          <span style={{ fontSize: '10px', opacity: 0.5 }}>{activeAccordion === 'cards' ? '▲' : '▼'}</span>
        </div>

        {activeAccordion === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px' }}>

            {/* Toggle HUD & Layout Cards */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <input
                type="checkbox"
                id="toggle-layout-cards"
                checked={showLayoutCards}
                onChange={(e) => {
                  setShowLayoutCards(e.target.checked);
                  if (onSaveFields) onSaveFields({ showLayoutCards: e.target.checked });
                }}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="toggle-layout-cards" style={{ fontSize: '11px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-white)' }}>
                Enable HUD & Layout Cards
              </label>
            </div>

            {/* Brand Primary Color */}
            <div>
              <label className="label" style={{ fontSize: '10.5px', marginBottom: '4px' }}>Brand Primary Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={brandPrimaryColor}
                  onChange={(e) => { setBrandPrimaryColor(e.target.value); if (onSaveFields) onSaveFields({ brandPrimaryColor: e.target.value }); }}
                  style={{ width: 32, height: 32, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'transparent', padding: 0 }}
                />
                <input
                  type="text"
                  className="input-field"
                  value={brandPrimaryColor.toUpperCase()}
                  onChange={(e) => { setBrandPrimaryColor(e.target.value); }}
                  onBlur={() => { if (onSaveFields) onSaveFields({ brandPrimaryColor }); }}
                  style={{ width: '100px', fontFamily: 'monospace', height: '28px', fontSize: '11px' }}
                />
              </div>
            </div>

            {/* Brand Secondary Color */}
            <div>
              <label className="label" style={{ fontSize: '10.5px', marginBottom: '4px' }}>Brand Secondary Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={brandSecondaryColor}
                  onChange={(e) => { setBrandSecondaryColor(e.target.value); if (onSaveFields) onSaveFields({ brandSecondaryColor: e.target.value }); }}
                  style={{ width: 32, height: 32, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'transparent', padding: 0 }}
                />
                <input
                  type="text"
                  className="input-field"
                  value={brandSecondaryColor.toUpperCase()}
                  onChange={(e) => { setBrandSecondaryColor(e.target.value); }}
                  onBlur={() => { if (onSaveFields) onSaveFields({ brandSecondaryColor }); }}
                  style={{ width: '100px', fontFamily: 'monospace', height: '28px', fontSize: '11px' }}
                />
              </div>
            </div>

            {/* Apply HUD Position to All Scenes Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                id="applyHUDToAll"
                checked={applyHUDToAll}
                onChange={(e) => {
                  if (setApplyHUDToAll) setApplyHUDToAll(e.target.checked);
                  if (onSaveFields) onSaveFields({ applyHUDToAll: e.target.checked });
                }}
                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
              />
              <label htmlFor="applyHUDToAll" style={{ fontSize: '11px', color: 'var(--text-white)', cursor: 'pointer', fontWeight: 600 }}>
                Apply HUD Position & Scale to All Scenes
              </label>
            </div>

            {!applyHUDToAll && (
              <div style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.15)', fontSize: '10px', color: '#f59e0b', marginBottom: '12px', lineHeight: '1.3' }}>
                ℹ️ Individual positioning active. Change layout positions per-scene inside the storyboard list table!
              </div>
            )}

            {/* Card Vertical Position */}
            <div>
              <label className="label" style={{ fontSize: '10.5px', marginBottom: '4px' }}>Card Vertical Position ({cardPositionY}%)</label>
              <input
                type="range" min={0} max={60} step={1}
                value={cardPositionY}
                onChange={(e) => { setCardPositionY(Number(e.target.value)); }}
                onMouseUp={() => { if (onSaveFields) onSaveFields({ cardPositionY }); }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Card Scale */}
            <div>
              <label className="label" style={{ fontSize: '10.5px', marginBottom: '4px' }}>Card Scale ({cardScale.toFixed(2)}x)</label>
              <input
                type="range" min={0.5} max={1.8} step={0.05}
                value={cardScale}
                onChange={(e) => { setCardScale(Number(e.target.value)); }}
                onMouseUp={() => { if (onSaveFields) onSaveFields({ cardScale }); }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Card Font */}
            <div>
              <label className="label" style={{ fontSize: '10.5px', marginBottom: '4px' }}>Card Font</label>
              <select
                className="input-field"
                value={cardFontName}
                onChange={(e) => { setCardFontName(e.target.value); if (onSaveFields) onSaveFields({ cardFontName: e.target.value }); }}
                style={{ width: '100%', height: '32px', fontSize: '11px' }}
              >
                {['Montserrat', 'Outfit', 'Inter', 'Poppins', 'Roboto', 'Oswald', 'Anton', 'Bangers', 'Bebas Neue', 'Playfair Display', 'Cinzel', 'Orbitron', 'Rajdhani', 'Teko', 'Impact', 'Arial'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
