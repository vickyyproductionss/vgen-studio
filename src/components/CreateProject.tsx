import { useState, useEffect, useRef } from 'react';
import { Sparkles, Music, Type, Video, RefreshCw, AlertTriangle, ArrowRight, CheckCircle, Upload, Zap, Search } from 'lucide-react';

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
}

interface Scene {
  text: string;
  start_time: number;
  end_time: number;
  clipId?: string;
  clipStart?: number;
  reason?: string;
  speedRamp?: {
    enabled: boolean;
    v0: number;
    v1: number;
    v2: number;
    preset: string;
  };
}

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
  'Courier New', 'Times New Roman', 'Orbitron'
];

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
}

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
  }
];

export default function CreateProject({ projectId, onStartRender }: CreateProjectProps) {
  const [sidebarTab, setSidebarTab] = useState<'subtitles' | 'video' | 'audio'>('subtitles');
  const [geminiKeySet, setGeminiKeySet] = useState(false);
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
  const [hoveredSceneIdx, setHoveredSceneIdx] = useState<number | null>(null);
  const [activeSliderIdx, setActiveSliderIdx] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [fillMode, setFillMode] = useState<'crop' | 'fit'>('crop');
  const [bgMusicPath, setBgMusicPath] = useState('');
  const [bgMusicVolume, setBgMusicVolume] = useState(0.07);
  const [bgMusicStartOffset, setBgMusicStartOffset] = useState(0);
  const [voiceoverVolume, setVoiceoverVolume] = useState(1.0);
  const [clipTransition, setClipTransition] = useState<string>('none');
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const [zoomAnimation, setZoomAnimation] = useState(true);
  const [exportResolution, setExportResolution] = useState<'1080p' | '2k' | '4k'>('1080p');
  const [exportFps, setExportFps] = useState<24 | 30 | 60>(30);
  const [bgms, setBgms] = useState<any[]>([]);
  const [bgmSource, setBgmSource] = useState<'library' | 'custom'>('library');
  const [subtitleMode, setSubtitleMode] = useState<'classic' | 'pop' | 'smart-highlight' | 'centered-word'>('classic');
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
  const [showHighlightBox, setShowHighlightBox] = useState(true);
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
  const [pop3d, setPop3d] = useState(false);
  const [pop3dColor, setPop3dColor] = useState('#000000');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLoadedProject, setHasLoadedProject] = useState(false);
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

  const handleApplyPreset = (preset: SubtitlePreset) => {
    setSubtitleMode(preset.subtitleMode);
    setFontName(preset.fontName);
    setFontSize(preset.fontSize);
    setFontColor(preset.fontColor);
    setOutlineColor(preset.outlineColor);
    setBold(preset.bold);
    setItalic(preset.italic);
    setShadow(preset.shadow);
    setHighlightColor(preset.highlightColor);
    setShowHighlightBox(preset.showHighlightBox);
    setBoxColor(preset.boxColor);
    setBoxRounding(preset.boxRounding);
    setActiveWordScale(preset.activeWordScale);
    setShowEmojis(preset.showEmojis);
    setAutoEmphasis(preset.autoEmphasis);
    setEmphasisColor(preset.emphasisColor);
    setNeonGlow(preset.neonGlow);
    setGlowColor(preset.glowColor);
    setPop3d(preset.pop3d);
    setPop3dColor(preset.pop3dColor);

    try {
      fetch('/api/fonts/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontName: preset.fontName })
      }).catch(err => console.warn('Backend font ensure failed:', err));
      
      loadGoogleFont(preset.fontName);
    } catch (err) {
      console.warn('Font preload failed:', err);
    }
  };

  const filteredFonts = CURATED_FONTS.filter(font =>
    font.toLowerCase().includes(fontSearchQuery.toLowerCase())
  );

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

  useEffect(() => {
    if (!hasLoadedProject) return;

    const saveProjectState = async () => {
      try {
        const endpoint = projectId ? `/api/projects/${projectId}` : '/api/project';
        const method = projectId ? 'PUT' : 'POST';
        const payload = projectId ? {
          state: {
            scriptText, selectedVoice, audioSource, voiceoverPath, voiceoverUrl, scenes,
            aspectRatio, fillMode, bgMusicPath, bgMusicVolume, bgMusicStartOffset,
            voiceoverVolume, clipTransition, transitionDuration, zoomAnimation, subtitleMode,
            fontName, fontSize, fontColor, outlineColor, bold, italic, shadow, highlightColor,
            showHighlightBox, boxColor, boxRounding, textFade, textTransition, textMotion,
            activeWordScale, wordDisplayTime, textPositionX, textPositionY, exportResolution,
            exportFps, showEmojis, autoEmphasis, emphasisColor, neonGlow, glowColor, pop3d, pop3dColor
          }
        } : {
          scriptText, selectedVoice, audioSource, voiceoverPath, voiceoverUrl, scenes,
          aspectRatio, fillMode, bgMusicPath, bgMusicVolume, bgMusicStartOffset,
          voiceoverVolume, clipTransition, transitionDuration, zoomAnimation, subtitleMode,
          fontName, fontSize, fontColor, outlineColor, bold, italic, shadow, highlightColor,
          showHighlightBox, boxColor, boxRounding, textFade, textTransition, textMotion,
          activeWordScale, wordDisplayTime, textPositionX, textPositionY, exportResolution,
          exportFps, showEmojis, autoEmphasis, emphasisColor, neonGlow, glowColor, pop3d, pop3dColor
        };

        await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error('Failed to save project state:', err);
      }
    };

    const delayDebounce = setTimeout(() => {
      saveProjectState();
    }, 1000);

    return () => clearTimeout(delayDebounce);
  }, [
    scriptText, selectedVoice, audioSource, voiceoverPath, voiceoverUrl, scenes, aspectRatio,
    fillMode, bgMusicPath, bgMusicVolume, bgMusicStartOffset, voiceoverVolume, clipTransition,
    transitionDuration, zoomAnimation, subtitleMode, fontName, fontSize, fontColor, outlineColor,
    bold, italic, shadow, highlightColor, showHighlightBox, boxColor, boxRounding, textFade,
    textTransition, textMotion, activeWordScale, wordDisplayTime, textPositionX, textPositionY,
    exportResolution, exportFps, showEmojis, autoEmphasis, emphasisColor, neonGlow, glowColor,
    pop3d, pop3dColor, hasLoadedProject, projectId
  ]);

  const fetchProjectState = async () => {
    try {
      const endpoint = projectId ? `/api/projects/${projectId}` : '/api/project';
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const project = projectId ? (data.state || {}) : data;
        if (projectId) {
          setProjectName(data.name || 'Untitled Project');
        }
        
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
        if (project.scenes !== undefined) setScenes(project.scenes);
        if (project.aspectRatio !== undefined) setAspectRatio(project.aspectRatio);
        if (project.fillMode !== undefined) setFillMode(project.fillMode);
        if (project.bgMusicPath !== undefined) setBgMusicPath(project.bgMusicPath);
        if (project.bgMusicVolume !== undefined) setBgMusicVolume(project.bgMusicVolume);
        if (project.bgMusicStartOffset !== undefined) setBgMusicStartOffset(project.bgMusicStartOffset);
        if (project.voiceoverVolume !== undefined) setVoiceoverVolume(project.voiceoverVolume);
        if (project.clipTransition !== undefined) setClipTransition(project.clipTransition);
        if (project.transitionDuration !== undefined) setTransitionDuration(project.transitionDuration);
        if (project.zoomAnimation !== undefined) setZoomAnimation(project.zoomAnimation);
        if (project.subtitleMode !== undefined) setSubtitleMode(project.subtitleMode);
        if (project.fontName !== undefined) setFontName(project.fontName);
        if (project.fontSize !== undefined) setFontSize(project.fontSize);
        if (project.fontColor !== undefined) setFontColor(project.fontColor);
        if (project.outlineColor !== undefined) setOutlineColor(project.outlineColor);
        if (project.bold !== undefined) setBold(project.bold);
        if (project.italic !== undefined) setItalic(project.italic);
        if (project.shadow !== undefined) setShadow(project.shadow);
        if (project.highlightColor !== undefined) setHighlightColor(project.highlightColor);
        if (project.showHighlightBox !== undefined) setShowHighlightBox(project.showHighlightBox);
        if (project.boxColor !== undefined) setBoxColor(project.boxColor);
        if (project.boxRounding !== undefined) setBoxRounding(project.boxRounding);
        if (project.textFade !== undefined) setTextFade(project.textFade);
        if (project.textTransition !== undefined) setTextTransition(project.textTransition);
        if (project.textMotion !== undefined) setTextMotion(project.textMotion);
        if (project.activeWordScale !== undefined) setActiveWordScale(project.activeWordScale);
        if (project.wordDisplayTime !== undefined) setWordDisplayTime(project.wordDisplayTime);
        if (project.textPositionX !== undefined) setTextPositionX(project.textPositionX);
        if (project.textPositionY !== undefined) setTextPositionY(project.textPositionY);
        if (project.exportResolution !== undefined) setExportResolution(project.exportResolution);
        if (project.exportFps !== undefined) setExportFps(project.exportFps);
        if (project.showEmojis !== undefined) setShowEmojis(project.showEmojis);
        if (project.autoEmphasis !== undefined) setAutoEmphasis(project.autoEmphasis);
        if (project.emphasisColor !== undefined) setEmphasisColor(project.emphasisColor);
        if (project.neonGlow !== undefined) setNeonGlow(project.neonGlow);
        if (project.glowColor !== undefined) setGlowColor(project.glowColor);
        if (project.pop3d !== undefined) setPop3d(project.pop3d);
        if (project.pop3dColor !== undefined) setPop3dColor(project.pop3dColor);
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
        setGeminiKeySet(!!settings.geminiApiKey);
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
        body: JSON.stringify({ text: scriptText, voiceId: selectedVoice })
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
      setError('Voiceover audio is required. Please generate or upload audio first.');
      return;
    }
    if (audioSource === 'generate' && !scriptText) {
      setError('Script text is required to generate and align a voiceover.');
      return;
    }

    setAligning(true);
    setError('');

    try {
      const res = await fetch('/api/align-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText: scriptText || '', audioPath: voiceoverPath })
      });

      if (!res.ok) {
        throw await parseFetchError(res, 'Failed to align script timings.');
      }

      const data = await res.json();
      setScenes(data.segments);
      setSuccess('Script timeline aligned successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAligning(false);
    }
  };

  const handleMatchClips = async () => {
    if (scenes.length === 0) {
      setError('Create scenes and timestamps first.');
      return;
    }
    if (clips.length === 0) {
      setError('No video clips available in library. Please import clips first.');
      return;
    }

    setMatching(true);
    setError('');

    try {
      const res = await fetch('/api/match-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes })
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
      setSuccess('AI storyboarding match complete!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMatching(false);
    }
  };

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
    if (scenes.some(s => !s.clipId)) {
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
          projectId, scenes, voiceoverPath, bgMusicPath, bgMusicVolume, bgMusicStartOffset,
          voiceoverVolume, aspectRatio, fillMode, clipTransition, transitionDuration, zoomAnimation,
          exportResolution, exportFps, subtitleStyle: {
            subtitleMode, fontName, fontSize, fontColor, outlineColor, bold, italic, shadow,
            highlightColor, showHighlightBox, boxColor, boxRounding, textFade, textTransition,
            textMotion, activeWordScale, wordDisplayTime, textPositionX, textPositionY, showEmojis,
            autoEmphasis, emphasisColor, neonGlow, glowColor, pop3d, pop3dColor
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' }}>
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
                  border: 'none', outline: 'none', color: 'white', width: '100%', padding: 0,
                  borderBottom: '1px dashed transparent', cursor: 'text'
                }}
                onFocus={(e) => { e.target.style.borderBottomColor = 'hsl(var(--accent-purple))'; }}
                onBlur={(e) => { e.target.style.borderBottomColor = 'transparent'; }}
                placeholder="Project Name"
              />
            ) : (
              <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Create Project</h2>
            )}
            <p style={{ color: 'hsl(var(--text-gray))', fontSize: '14px' }}>
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
              width: '24px', height: '24px', borderRadius: '50%', background: '#ffffff', color: '#000000',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
              fontSize: '11px', fontFamily: 'var(--font-sans)', flexShrink: 0
            }}>1</span>
            Script & Voiceover
          </h3>

          <div style={{ marginBottom: '20px' }}>
            <label className="label">Script text</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="e.g. When performing a proper barbell squat, ensure your feet are shoulder-width apart. Focus on keeping your spine straight and descend slowly until your thighs are parallel to the floor."
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              style={{ resize: 'vertical' }}
            />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="label">ElevenLabs Voice</label>
                {!elevenLabsKeySet ? (
                  <div style={{ color: '#f87171', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} /> ElevenLabs key not set. Go to Settings tab.
                  </div>
                ) : (
                  <select
                    className="input-field"
                    value={selectedVoice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedVoice(val);
                      fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lastSelectedVoice: val })
                      }).catch(err => console.error('Failed to save lastSelectedVoice:', err));
                    }}
                  >
                    {voices.map(voice => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} ({voice.category})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                onClick={handleGenerateVoiceover}
                className="btn-primary"
                disabled={generatingAudio || !elevenLabsKeySet || !scriptText}
                style={{ height: '46px' }}
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
                <Upload size={20} style={{ color: 'hsl(var(--text-muted))', marginBottom: '4px' }} />
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>
                  {uploadingAudio ? 'Uploading audio file...' : uploadedFileName ? 'Change audio file' : 'Select audio file'}
                </div>
                <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                  {uploadedFileName || 'Drag and drop or click to browse (.mp3)'}
                </div>
              </div>
            </div>
          )}

          {voiceoverUrl && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '13px', display: 'block', color: 'hsl(var(--text-gray))', marginBottom: '8px' }}>Voiceover Preview:</span>
              <audio src={voiceoverUrl} controls style={{ width: '100%' }} />
            </div>
          )}
        </section>

        {/* Step 2: Script Alignment */}
        {voiceoverPath && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', position: 'relative' }}>
            <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 100%)' }}></div>
            
            {!geminiKeySet ? (
              <div style={{ color: '#f87171', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#0a0a0a', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 20px', borderRadius: '20px' }}>
                <AlertTriangle size={14} /> Gemini API key not set. Go to Settings tab.
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAlignScript}
                disabled={aligning}
                className="btn-secondary active-glow"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
                  borderRadius: '24px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                  color: '#ffffff', transition: 'all 0.2s ease', height: '40px'
                }}
              >
                <RefreshCw size={14} className={aligning ? 'spin' : ''} style={{ animation: aligning ? 'spin-slow 2s linear infinite' : 'none' }} />
                {aligning ? 'Aligning script with Gemini...' : 'Analyze Timestamps & Align'}
              </button>
            )}
            
            <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to top, rgba(255,255,255,0.15) 0%, transparent 100%)', marginTop: '8px' }}></div>
          </div>
        )}

        {/* Step 3: Storyboard Editing */}
        {scenes.length > 0 && (
          <section className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-headline)', fontWeight: 600, margin: 0 }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%', background: '#ffffff', color: '#000000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                  fontSize: '11px', fontFamily: 'var(--font-sans)', flexShrink: 0
                }}>3</span>
                Storyboard
              </h3>
              {!geminiKeySet ? (
                <div style={{ color: '#f87171', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} /> Gemini API key not set. Go to Settings tab.
                </div>
              ) : (
                <button
                  onClick={handleMatchClips}
                  className="btn-secondary"
                  disabled={matching || clips.length === 0}
                  style={{ fontSize: '12px', padding: '6px 14px', height: '32px' }}
                >
                  <Sparkles size={12} style={{ marginRight: '6px' }} />
                  {matching ? 'Auto-matching...' : 'AI Auto-Match Clips'}
                </button>
              )}
            </div>

            {clips.length === 0 ? (
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
                      className="tonal-border"
                      style={{
                        background: 'var(--bg-darker)', borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{
                        height: previewBoxHeight, background: '#020202', position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderBottom: '1px solid var(--border-medium)', overflow: 'hidden'
                      }}>
                        {selectedClip ? (
                          <VideoPreview
                            clipId={selectedClip.id}
                            thumbnail={selectedClip.thumbnail}
                            clipStart={scene.clipStart || 0}
                            isActive={hoveredSceneIdx === idx || activeSliderIdx === idx}
                          />
                        ) : (
                          <div style={{ color: 'var(--text-gray)', fontSize: '11px', textAlign: 'center', padding: '12px', opacity: 0.5 }}>
                            No Clip Assigned
                          </div>
                        )}
                        
                        <div style={{
                          position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.65)',
                          backdropFilter: 'blur(8px)', padding: '2px 8px', borderRadius: '4px',
                          fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.06)', zIndex: 10
                        }}>
                          {scene.start_time.toFixed(1)}s - {scene.end_time.toFixed(1)}s ({duration.toFixed(1)}s)
                        </div>
                      </div>

                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        <div style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-white)', minHeight: '38px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          "{scene.text}"
                        </div>

                        <div>
                          <label className="label" style={{ fontSize: '10px', marginBottom: '4px' }}>Assigned Video Clip</label>
                          <select
                            className="input-field"
                            value={scene.clipId || ''}
                            onChange={(e) => updateSceneClip(idx, e.target.value)}
                            style={{ margin: 0, fontSize: '12px', height: '32px' }}
                          >
                            <option value="">-- Choose Video Clip --</option>
                            {clips.map(clip => (
                              <option key={clip.id} value={clip.id}>
                                {clip.name} ({clip.duration.toFixed(1)}s)
                              </option>
                            ))}
                          </select>
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

                              {isInsufficient && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px', fontSize: '10px', marginTop: '6px' }}>
                                  <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                                  <span>Need {reqDur.toFixed(1)}s, have {(selectedClip.duration - (scene.clipStart || 0)).toFixed(1)}s.</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

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
        
      {/* RIGHT: Aesthetics & Render Controls */}
      <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '32px' }}>
        <div style={{ position: 'sticky', top: '0px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', paddingRight: '12px' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px' }}>
            {[
              { id: 'subtitles', label: 'Subtitles' },
              { id: 'video', label: 'Visuals' },
              { id: 'audio', label: 'Audio' }
            ].map(t => {
              const active = sidebarTab === t.id;
              return (
                <button
                  key={t.id} type="button" onClick={() => setSidebarTab(t.id as any)}
                  style={{
                    flex: 1, padding: '16px 0', fontSize: '11px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em', background: 'transparent',
                    border: 'none', borderBottom: active ? '2px solid #ffffff' : 'none',
                    color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: SUBTITLES */}
          {sidebarTab === 'subtitles' && (
            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div className="inspector-card">
                <div className="inspector-sub-title">Quick Presets</div>
                <div style={{ fontSize: '11px', color: 'var(--text-gray)', marginBottom: '8px' }}>
                  Choose a high-performing subtitle preset styling.
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                  {SUBTITLE_PRESETS.map((p) => {
                    const isSelected = fontName === p.fontName && subtitleMode === p.subtitleMode && fontColor === p.fontColor;
                    
                    return (
                      <button
                        key={p.id} type="button" onClick={() => handleApplyPreset(p)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '8px',
                          borderRadius: '8px', background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                          border: isSelected ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid var(--border-light)',
                          textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease', minHeight: '115px'
                        }}
                      >
                        <div style={{
                          height: '48px', background: '#050505', borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.06)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', marginBottom: '8px'
                        }}>
                          {p.id === 'tiktok-hormozi' && (
                            <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: '11px', fontStyle: 'italic', background: '#eab308', color: '#000000', padding: '2px 4px' }}>HORMOZI</span>
                          )}
                          {p.id === 'minimal-vercel' && (
                            <span style={{ fontFamily: 'Inter', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Minimal Vercel</span>
                          )}
                          {p.id === 'cyberpunk-neon' && (
                            <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: '11px', color: '#22d3ee', textShadow: '0 0 5px rgba(34,211,238,0.8)' }}>CYBER</span>
                          )}
                          {p.id === 'retro-pop' && (
                            <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '13px', color: '#ec4899' }}>RETRO</span>
                          )}
                        </div>
                        
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.9)', lineHeight: 1.2 }}>{p.name}</span>
                        <span style={{
                          fontSize: '10px', color: 'var(--text-gray)', lineHeight: 1.3, marginTop: '4px',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>{p.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="inspector-card">
                <div className="inspector-sub-title">Caption Style & Layout</div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label className="label">Caption Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { id: 'classic', label: 'Classic Lines', desc: 'Standard lines at bottom' },
                      { id: 'smart-highlight', label: 'Smart Highlight', desc: 'Active word highlighted' },
                      { id: 'centered-word', label: 'Snappy Word', desc: 'One word at a time' },
                      { id: 'pop', label: 'Floating Pop', desc: 'Scattered popping words' }
                    ].map(mode => (
                      <button
                        key={mode.id} type="button" onClick={() => setSubtitleMode(mode.id as any)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px',
                          borderRadius: '8px', background: subtitleMode === mode.id ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                          border: subtitleMode === mode.id ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border-light)',
                          color: subtitleMode === mode.id ? 'white' : 'hsl(var(--text-gray))', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 600, color: subtitleMode === mode.id ? 'white' : 'hsl(var(--text-white))' }}>{mode.label}</span>
                        <span style={{ fontSize: '9px', color: 'hsl(var(--text-muted))', marginTop: '2px', lineHeight: '1.2' }}>{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {subtitleMode !== 'pop' && (
                  <div>
                    <label className="label">Anchor Alignment</label>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{
                        width: '96px', height: '96px', border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '6px', background: '#050505', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                        padding: '6px', gap: '4px', flexShrink: 0
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
                              }}
                              title={pos.label}
                              className={`matrix-btn ${isSelected ? 'active' : ''}`}
                              style={{ border: 'none', padding: 0 }}
                            >
                              {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#050505' }} />}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', lineHeight: '1.4', fontFamily: 'Inter' }}>
                          Select cell to snap subtitles, or drag the sliders below.
                        </span>
                        <button
                          type="button" className="btn-secondary"
                          style={{ alignSelf: 'flex-start', padding: '2px 8px', height: '24px', fontSize: '10px', borderColor: 'rgba(255, 255, 255, 0.08)', fontFamily: 'Inter', fontWeight: 600 }}
                          onClick={() => {
                            setTextPositionX(0);
                            setTextPositionY(-70);
                          }}
                        >
                          Reset to Bottom
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'hsl(var(--text-gray))', fontFamily: 'Inter' }}>Horizontal Offset (X)</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{textPositionX > 0 ? `+${textPositionX}` : textPositionX}px</span>
                        </div>
                        <input
                          type="range" min={-100} max={100} step={5} value={textPositionX}
                          onChange={(e) => setTextPositionX(parseInt(e.target.value, 10))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'hsl(var(--text-gray))', fontFamily: 'Inter' }}>Vertical Offset (Y)</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{textPositionY > 0 ? `+${textPositionY}` : textPositionY}px</span>
                        </div>
                        <input
                          type="range" min={-100} max={100} step={5} value={textPositionY}
                          onChange={(e) => setTextPositionY(parseInt(e.target.value, 10))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Typography Card */}
              <div className="inspector-card">
                <div className="inspector-sub-title">Typography</div>
                
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <label className="label">Font Family</label>
                  <div
                    className="input-field"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFontSelectorOpen(!fontSelectorOpen);
                    }}
                    style={{
                      cursor: 'pointer', display: 'flex', alignItems: 'center', height: '38px',
                      background: '#050505', border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '4px', padding: '0 12px'
                    }}
                  >
                    <Search size={14} style={{ marginRight: '8px', opacity: 0.4 }} />
                    <span style={{ fontFamily: fontName, fontSize: '13px', fontWeight: 600 }}>{fontName}</span>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>▼</span>
                  </div>

                  {fontSelectorOpen && (
                    <div
                      className="premium-card"
                      style={{
                        position: 'absolute', top: '64px', left: 0, right: 0, zIndex: 100, padding: '12px',
                        display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        background: 'hsl(var(--bg-card))', border: '1px solid var(--border-light)'
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
                        <div style={{ fontSize: '11px', color: 'hsl(var(--accent-purple))', padding: '4px' }}>
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
                              setFontSelectorOpen(false);
                              setFontSearchQuery('');
                            }}
                            style={{
                              padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontFamily: font, fontSize: '13px',
                              background: fontName === font ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                              color: fontName === font ? '#fff' : 'hsl(var(--text-gray))', transition: 'background 0.2s',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                          >
                            <span>{font}</span>
                            <span style={{ fontSize: '9px', opacity: 0.5, fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>Preview</span>
                          </div>
                        ))}

                        {filteredFonts.length === 0 && fontSearchQuery.trim().length > 0 && (
                          <div style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              type="button" className="btn-primary" disabled={fontLoading}
                              onClick={() => handleAddCustomFont(fontSearchQuery.trim())}
                              style={{ width: '100%', height: '28px', fontSize: '10px', justifyContent: 'center' }}
                            >
                              Get "{fontSearchQuery.trim()}"
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ 
                    flex: 1, background: '#050505', border: '1px solid rgba(255,255,255,0.06)', 
                    borderRadius: '4px', padding: '8px 12px', display: 'flex', alignItems: 'center', 
                    justifyContent: 'space-between', height: '38px' 
                  }}>
                    <span style={{ fontSize: '13px', fontFamily: 'Inter' }}>{fontSize}px</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginLeft: 'auto' }}>
                      <button 
                        type="button" onClick={() => setFontSize(Math.min(48, fontSize + 2))}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, height: '10px', fontSize: '8px' }}
                      >▲</button>
                      <button 
                        type="button" onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, height: '10px', fontSize: '8px' }}
                      >▼</button>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', gap: '6px', background: '#050505', border: '1px solid rgba(255,255,255,0.06)', 
                    borderRadius: '4px', padding: '8px', height: '38px', alignItems: 'center' 
                  }}>
                    {['#FFFFFF', '#FFCC00', '#00FFFF', '#FF3333'].map(color => (
                      <button
                        key={color} type="button" onClick={() => setFontColor(color)}
                        style={{
                          width: '16px', height: '16px', borderRadius: '50%', background: color,
                          border: fontColor === color ? '1.5px solid #fff' : 'none', cursor: 'pointer',
                          boxShadow: fontColor === color ? '0 0 4px rgba(255,255,255,0.5)' : 'none', padding: 0
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none', fontFamily: 'Inter' }}>
                    <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} />
                    Bold
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none', fontFamily: 'Inter' }}>
                    <input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} />
                    Italic
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none', fontFamily: 'Inter' }}>
                    <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
                    Shadow
                  </label>
                </div>
              </div>

              {/* Highlight Style Card (Conditional) */}
              {(subtitleMode === 'pop' || subtitleMode === 'centered-word' || subtitleMode === 'smart-highlight') && (
                <div className="inspector-card">
                  <div className="inspector-sub-title">Highlight Word Style</div>
                  
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
                      <span>💡</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'Inter' }}>Neon Glow</span>
                    </div>
                    <div className={`stitch-switch ${neonGlow ? 'active' : ''}`} onClick={() => setNeonGlow(!neonGlow)}>
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
            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div className="inspector-card">
                <div className="inspector-sub-title">Voiceover & Volume</div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <label className="label" style={{ margin: 0 }}>Voiceover Volume</label>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{Math.round(voiceoverVolume * 100)}%</span>
                  </div>
                  <input
                    type="range" min={0.0} max={1.5} step={0.05} value={voiceoverVolume}
                    onChange={(e) => setVoiceoverVolume(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="inspector-card">
                <div className="inspector-sub-title">Background Music</div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="label">BGM Source</label>
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
                  <div style={{ marginBottom: '12px' }}>
                    <label className="label">Select BGM Track</label>
                    <select className="input-field" value={bgMusicPath} onChange={(e) => setBgMusicPath(e.target.value)}>
                      <option value="">-- No Background Music --</option>
                      {bgms.map(bgm => (
                        <option key={bgm.id} value={bgm.path}>
                          {bgm.name} ({bgm.duration ? `${Math.floor(bgm.duration / 60)}:${String(Math.floor(bgm.duration % 60)).padStart(2, '0')}` : '?'})
                        </option>
                      ))}
                    </select>
                    {bgms.length === 0 && (
                      <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '6px', display: 'block' }}>
                        No tracks imported yet. Go to Music Library tab to import BGMs.
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ marginBottom: '12px' }}>
                    <label className="label">Custom Audio File Path</label>
                    <input
                      type="text" className="input-field" placeholder="e.g. /path/to/bg_music.mp3"
                      value={bgMusicPath} onChange={(e) => setBgMusicPath(e.target.value)}
                    />
                  </div>
                )}

                {bgMusicPath && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0 }}>BG Music Volume</label>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{Math.round(bgMusicVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min={0.0} max={0.5} step={0.01} value={bgMusicVolume}
                        onChange={(e) => setBgMusicVolume(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label className="label" style={{ margin: 0 }}>Start Offset (skip intro)</label>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{bgMusicStartOffset}s</span>
                      </div>
                      <input
                        type="range" min={0} max={300} step={1} value={bgMusicStartOffset}
                        onChange={(e) => setBgMusicStartOffset(parseInt(e.target.value, 10))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compile Button - Pinned at bottom of sidebar */}
          <div style={{
            borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '20px',
            background: 'hsl(var(--bg-card))', position: 'sticky', bottom: 0, zIndex: 10
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
                width: '100%', background: '#ffffff', color: '#000000', padding: '14px 0',
                borderRadius: '12px', fontWeight: 900, textTransform: 'uppercase',
                letterSpacing: '-0.03em', fontSize: '13px', border: 'none', cursor: 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Zap size={14} fill="#000" />
              {loading ? 'Submitting render...' : 'Generate Video'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}