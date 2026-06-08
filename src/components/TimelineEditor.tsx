import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Trash2,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Sparkles,
  MoveLeft,
  MoveRight,
  Loader2,
  Check
} from 'lucide-react';

interface Word {
  word: string;
  start_time: number;
  end_time: number;
}

interface Scene {
  text: string;
  start_time: number;
  end_time: number;
  clipId: string;
  clipStart: number;
  words?: Word[];
  reason?: string;
}

interface Clip {
  id: string;
  path: string;
  name: string;
  thumbnail: string;
  duration: number;
}

interface BGM {
  id: string;
  path: string;
  name: string;
  duration: number;
}

interface TimelineEditorProps {
  onStartRender: (jobId: string) => void;
  onBack: () => void;
}

export default function TimelineEditor({ onStartRender, onBack }: TimelineEditorProps) {
  // Database States
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [bgms, setBgms] = useState<BGM[]>([]);

  // Project Configuration States
  const [scriptText, setScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [audioSource, setAudioSource] = useState('generate');
  const [voiceoverPath, setVoiceoverPath] = useState('');
  const [voiceoverUrl, setVoiceoverUrl] = useState('');
  const [bgMusicPath, setBgMusicPath] = useState('');
  const [bgMusicVolume, setBgMusicVolume] = useState(0.07);
  const [bgMusicStartOffset, setBgMusicStartOffset] = useState(0);
  const [voiceoverVolume, setVoiceoverVolume] = useState(1.0);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [fillMode, setFillMode] = useState('crop');
  const [clipTransition, setClipTransition] = useState<string>('none');
  const [zoomAnimation, setZoomAnimation] = useState(true);

  // Subtitle Style States
  const [subtitleMode, setSubtitleMode] = useState<'classic' | 'pop' | 'smart-highlight' | 'centered-word'>('classic');
  const [fontName, setFontName] = useState('Arial');
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

  // Player / Timeline Playback States
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(80); // pixels per second
  const [selectedSceneIdx, setSelectedSceneIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'clips' | 'subtitles' | 'audio' | 'video'>('clips');

  // UI Utilities
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);

  // References for Player HTML5 Nodes
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRulerRef = useRef<HTMLDivElement | null>(null);
  const playheadRequestRef = useRef<number | null>(null);

  // Fetch project configuration & library clips on mount
  useEffect(() => {
    fetchProjectState();
    fetchLibraryData();
  }, []);

  const fetchProjectState = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/project');
      if (res.ok) {
        const project = await res.json();
        if (project.scriptText) setScriptText(project.scriptText);
        if (project.selectedVoice) setSelectedVoice(project.selectedVoice);
        if (project.audioSource) setAudioSource(project.audioSource);
        if (project.voiceoverPath) setVoiceoverPath(project.voiceoverPath);
        if (project.voiceoverUrl) setVoiceoverUrl(project.voiceoverUrl);
        if (project.scenes) setScenes(project.scenes);
        if (project.aspectRatio) setAspectRatio(project.aspectRatio);
        if (project.fillMode) setFillMode(project.fillMode);
        if (project.bgMusicPath) setBgMusicPath(project.bgMusicPath);
        if (project.bgMusicVolume !== undefined) setBgMusicVolume(project.bgMusicVolume);
        if (project.bgMusicStartOffset !== undefined) setBgMusicStartOffset(project.bgMusicStartOffset);
        if (project.voiceoverVolume !== undefined) setVoiceoverVolume(project.voiceoverVolume);
        if (project.clipTransition) setClipTransition(project.clipTransition);
        if (project.zoomAnimation !== undefined) setZoomAnimation(project.zoomAnimation);
        if (project.subtitleMode) setSubtitleMode(project.subtitleMode);
        if (project.fontName) setFontName(project.fontName);
        if (project.fontSize) setFontSize(project.fontSize);
        if (project.fontColor) setFontColor(project.fontColor);
        if (project.outlineColor) setOutlineColor(project.outlineColor);
        if (project.bold !== undefined) setBold(project.bold);
        if (project.italic !== undefined) setItalic(project.italic);
        if (project.shadow !== undefined) setShadow(project.shadow);
        if (project.highlightColor) setHighlightColor(project.highlightColor);
        if (project.showHighlightBox !== undefined) setShowHighlightBox(project.showHighlightBox);
        if (project.boxColor) setBoxColor(project.boxColor);
        if (project.boxRounding !== undefined) setBoxRounding(project.boxRounding);
        if (project.textFade !== undefined) setTextFade(project.textFade);
        if (project.textTransition) setTextTransition(project.textTransition);
        if (project.textMotion) setTextMotion(project.textMotion);
        if (project.activeWordScale !== undefined) setActiveWordScale(project.activeWordScale);
        if (project.wordDisplayTime !== undefined) setWordDisplayTime(project.wordDisplayTime);
      }
    } catch (err) {
      console.error('Failed to load project state:', err);
      setError('Failed to load project configurations.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLibraryData = async () => {
    try {
      const clipsRes = await fetch('/api/clips');
      if (clipsRes.ok) {
        setClips(await clipsRes.json());
      }
      const bgmRes = await fetch('/api/bgms');
      if (bgmRes.ok) {
        setBgms(await bgmRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch media library:', err);
    }
  };

  // Save State Helper
  const saveProjectState = async (updatedScenes = scenes) => {
    setSaving(true);
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText,
          selectedVoice,
          audioSource,
          voiceoverPath,
          voiceoverUrl,
          scenes: updatedScenes,
          aspectRatio,
          fillMode,
          bgMusicPath,
          bgMusicVolume,
          bgMusicStartOffset,
          voiceoverVolume,
          clipTransition,
          zoomAnimation,
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
          wordDisplayTime
        })
      });
      if (res.ok) {
        setSuccess('Project state saved successfully.');
        setTimeout(() => setSuccess(''), 2500);
      }
    } catch (err) {
      console.error('Failed to save project:', err);
      setError('Failed to auto-save project configurations.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-Save whenever styling changes (debounced)
  useEffect(() => {
    if (scenes.length === 0) return;
    const timer = setTimeout(() => {
      saveProjectState();
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    aspectRatio,
    fillMode,
    bgMusicPath,
    bgMusicVolume,
    bgMusicStartOffset,
    voiceoverVolume,
    clipTransition,
    zoomAnimation,
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
    wordDisplayTime
  ]);

  // Video/Audio Track Total Duration calculation
  const totalDuration = useMemo(() => {
    if (scenes.length === 0) return 0;
    return scenes[scenes.length - 1].end_time;
  }, [scenes]);

  // BGM selection path resolve
  const bgmUrl = useMemo(() => {
    if (!bgMusicPath) return '';
    const name = bgMusicPath.split(/[/\\]/).pop();
    return `/uploads/music/${name}`;
  }, [bgMusicPath]);

  // Player Sync Loop (Scrubber playhead)
  const activeSceneIndex = useMemo(() => {
    return scenes.findIndex(s => currentTime >= s.start_time && currentTime < s.end_time);
  }, [scenes, currentTime]);

  const activeScene = activeSceneIndex !== -1 ? scenes[activeSceneIndex] : null;

  // Handle Play/Pause
  const togglePlay = () => {
    if (isPlaying) {
      pauseAll();
    } else {
      playAll();
    }
  };

  const playAll = () => {
    setIsPlaying(true);
    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.currentTime = currentTime;
      voiceoverAudioRef.current.play().catch(e => console.warn('VO Audio play error:', e));
    }
    if (bgmAudioRef.current && bgMusicPath) {
      // BGM play head offsets
      const seekTime = Math.max(0, currentTime - bgMusicStartOffset);
      bgmAudioRef.current.currentTime = seekTime;
      bgmAudioRef.current.play().catch(e => console.warn('BGM Audio play error:', e));
    }
    if (previewVideoRef.current && activeScene) {
      const elapsed = currentTime - activeScene.start_time;
      previewVideoRef.current.currentTime = (activeScene.clipStart || 0) + elapsed;
      previewVideoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  };

  const pauseAll = () => {
    setIsPlaying(false);
    if (voiceoverAudioRef.current) voiceoverAudioRef.current.pause();
    if (bgmAudioRef.current) bgmAudioRef.current.pause();
    if (previewVideoRef.current) previewVideoRef.current.pause();
    if (playheadRequestRef.current) {
      cancelAnimationFrame(playheadRequestRef.current);
      playheadRequestRef.current = null;
    }
  };

  // Sync Video source changes and play state on scene boundaries
  useEffect(() => {
    if (!activeScene || !previewVideoRef.current) return;
    
    const clipObj = clips.find(c => c.id === activeScene.clipId);
    if (!clipObj) return;

    const currentSrc = previewVideoRef.current.getAttribute('src');
    const expectedSrc = `/api/clips/${clipObj.id}/video`;

    if (currentSrc !== expectedSrc) {
      previewVideoRef.current.src = expectedSrc;
      previewVideoRef.current.load();
    }

    const elapsed = currentTime - activeScene.start_time;
    const targetVideoTime = (activeScene.clipStart || 0) + elapsed;

    // Direct seek if out of sync
    if (Math.abs(previewVideoRef.current.currentTime - targetVideoTime) > 0.15) {
      previewVideoRef.current.currentTime = targetVideoTime;
    }

    if (isPlaying) {
      previewVideoRef.current.play().catch(e => console.warn('Video switch play error:', e));
    } else {
      previewVideoRef.current.pause();
    }
  }, [activeSceneIndex, clips]);

  // requestAnimationFrame sync loop when playing
  const syncPlayback = () => {
    if (!isPlaying) return;
    
    let playbackTime = currentTime;
    if (voiceoverAudioRef.current) {
      playbackTime = voiceoverAudioRef.current.currentTime;
    }

    // Stop at end of video duration
    if (playbackTime >= totalDuration) {
      pauseAll();
      setCurrentTime(totalDuration);
      return;
    }

    setCurrentTime(playbackTime);

    // Keep active video segment synchronized
    if (activeScene && previewVideoRef.current) {
      const elapsed = playbackTime - activeScene.start_time;
      const targetVideoTime = (activeScene.clipStart || 0) + elapsed;
      const videoDiff = Math.abs(previewVideoRef.current.currentTime - targetVideoTime);
      
      if (videoDiff > 0.2) {
        previewVideoRef.current.currentTime = targetVideoTime;
      }
    }

    // Keep BGM synchronized
    if (bgmAudioRef.current && bgMusicPath) {
      const expectedBgmTime = Math.max(0, playbackTime - bgMusicStartOffset);
      if (Math.abs(bgmAudioRef.current.currentTime - expectedBgmTime) > 0.3) {
        bgmAudioRef.current.currentTime = expectedBgmTime;
      }
    }

    playheadRequestRef.current = requestAnimationFrame(syncPlayback);
  };

  useEffect(() => {
    if (isPlaying) {
      playheadRequestRef.current = requestAnimationFrame(syncPlayback);
    }
    return () => {
      if (playheadRequestRef.current) cancelAnimationFrame(playheadRequestRef.current);
    };
  }, [isPlaying, activeSceneIndex, totalDuration, bgMusicStartOffset]);

  // Seek Scrubber handling
  const handleTimelineSeek = (time: number) => {
    const seekTime = Math.min(totalDuration, Math.max(0, time));
    setCurrentTime(seekTime);

    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.currentTime = seekTime;
    }

    if (bgmAudioRef.current && bgMusicPath) {
      bgmAudioRef.current.currentTime = Math.max(0, seekTime - bgMusicStartOffset);
    }

    // Sync current active scene video seek immediately
    const targetSceneIdx = scenes.findIndex(s => seekTime >= s.start_time && seekTime < s.end_time);
    if (targetSceneIdx !== -1) {
      const s = scenes[targetSceneIdx];
      const elapsed = seekTime - s.start_time;
      if (previewVideoRef.current) {
        const clipObj = clips.find(c => c.id === s.clipId);
        if (clipObj) {
          const currentSrc = previewVideoRef.current.getAttribute('src');
          const expectedSrc = `/api/clips/${clipObj.id}/video`;
          if (currentSrc !== expectedSrc) {
            previewVideoRef.current.src = expectedSrc;
            previewVideoRef.current.load();
          }
        }
        previewVideoRef.current.currentTime = (s.clipStart || 0) + elapsed;
      }
    }
  };

  // Split Scene logic
  const handleSplitScene = () => {
    if (activeSceneIndex === -1) return;
    const sceneToSplit = scenes[activeSceneIndex];
    const splitTime = currentTime;

    // Minimum split padding constraints
    if (splitTime - sceneToSplit.start_time < 0.2 || sceneToSplit.end_time - splitTime < 0.2) {
      setError('Cannot split scene too close to boundaries (minimum 0.2s required).');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const words = sceneToSplit.words || [];
    const splitRelTime = splitTime - sceneToSplit.start_time;

    // Divide words based on timing bounds
    const leftWords = words.filter(w => (w.start_time - sceneToSplit.start_time) < splitRelTime);
    const rightWords = words.filter(w => (w.start_time - sceneToSplit.start_time) >= splitRelTime);

    const leftText = leftWords.map(w => w.word).join(' ') || sceneToSplit.text;
    const rightText = rightWords.map(w => w.word).join(' ') || sceneToSplit.text;

    const leftScene: Scene = {
      ...sceneToSplit,
      end_time: splitTime,
      text: leftText,
      words: leftWords
    };

    const rightScene: Scene = {
      ...sceneToSplit,
      start_time: splitTime,
      clipStart: (sceneToSplit.clipStart || 0) + splitRelTime,
      text: rightText,
      words: rightWords
    };

    const updatedScenes = [...scenes];
    updatedScenes.splice(activeSceneIndex, 1, leftScene, rightScene);
    setScenes(updatedScenes);
    setSelectedSceneIdx(activeSceneIndex + 1);
    saveProjectState(updatedScenes);
  };

  // Delete Scene logic
  const handleDeleteScene = (idx: number) => {
    if (scenes.length <= 1) {
      setError('Cannot delete last scene. A video project must contain at least one scene.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const updatedScenes = [...scenes];
    const deleted = updatedScenes[idx];
    const deletedDuration = deleted.end_time - deleted.start_time;

    // Remove the scene
    updatedScenes.splice(idx, 1);

    // Adjust timings of subsequent scenes to shift them left (gap-free timeline)
    for (let i = idx; i < updatedScenes.length; i++) {
      updatedScenes[i].start_time -= deletedDuration;
      updatedScenes[i].end_time -= deletedDuration;
    }

    setScenes(updatedScenes);
    setSelectedSceneIdx(null);
    handleTimelineSeek(Math.max(0, currentTime - deletedDuration));
    saveProjectState(updatedScenes);
  };

  // Move Scene Logic (Shift scene order left/right)
  const handleMoveScene = (idx: number, direction: 'left' | 'right') => {
    if (direction === 'left' && idx === 0) return;
    if (direction === 'right' && idx === scenes.length - 1) return;

    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    const updatedScenes = [...scenes];
    
    // Swap scenes in the array
    const temp = updatedScenes[idx];
    updatedScenes[idx] = updatedScenes[swapIdx];
    updatedScenes[swapIdx] = temp;

    // Re-calculate the timeline timings based on swapped sequence durations
    let current = 0.0;
    for (let i = 0; i < updatedScenes.length; i++) {
      const dur = updatedScenes[i].end_time - updatedScenes[i].start_time;
      updatedScenes[i].start_time = current;
      updatedScenes[i].end_time = current + dur;
      current = updatedScenes[i].end_time;
    }

    setScenes(updatedScenes);
    setSelectedSceneIdx(swapIdx);
    handleTimelineSeek(updatedScenes[swapIdx].start_time);
    saveProjectState(updatedScenes);
  };

  // Timeline dragging: resizing boundary between scene and next scene
  const handleBoundaryDrag = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const sceneToResize = scenes[idx];
    const nextScene = scenes[idx + 1];
    
    const initialEndTime = sceneToResize.end_time;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / timelineZoom;
      let newEndTime = initialEndTime + deltaSec;

      // Constrain end time
      const minStart = sceneToResize.start_time + 0.2;
      const maxEnd = nextScene.end_time - 0.2;
      newEndTime = Math.max(minStart, Math.min(maxEnd, newEndTime));

      const updated = [...scenes];
      updated[idx] = { ...sceneToResize, end_time: newEndTime };
      updated[idx + 1] = { ...nextScene, start_time: newEndTime };
      
      setScenes(updated);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveProjectState();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Inline Subtitle Wording Editing
  const updateSceneText = (idx: number, newText: string) => {
    const updated = [...scenes];
    updated[idx] = { ...updated[idx], text: newText };
    setScenes(updated);
    saveProjectState(updated);
  };

  // Drag-Seek clip start offset inside a scene block
  const handleClipOffsetDrag = (idx: number, e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // Only trigger on block background
    e.preventDefault();
    const startX = e.clientX;
    const s = scenes[idx];
    const initialClipStart = s.clipStart || 0;
    const clipObj = clips.find(c => c.id === s.clipId);
    if (!clipObj) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / timelineZoom; // offset speed relative to zoom
      let newClipStart = initialClipStart - deltaSec; // drag right seeks left

      // Constrain clipStart
      const sceneDur = s.end_time - s.start_time;
      const maxClipStart = Math.max(0, clipObj.duration - sceneDur);
      newClipStart = Math.max(0, Math.min(maxClipStart, newClipStart));

      const updated = [...scenes];
      updated[idx] = { ...s, clipStart: newClipStart };
      setScenes(updated);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveProjectState();
      handleTimelineSeek(currentTime); // Force player seek updates
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Trigger Compilation Final Video Render job
  const handleCompile = async () => {
    setIsCompiling(true);
    setError('');
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes,
          voiceoverPath,
          bgMusicPath,
          bgMusicVolume,
          bgMusicStartOffset,
          voiceoverVolume,
          aspectRatio,
          fillMode,
          clipTransition,
          zoomAnimation,
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
            wordDisplayTime
          }
        })
      });

      if (!res.ok) {
        throw new Error('Failed to start rendering job.');
      }

      const data = await res.json();
      onStartRender(data.jobId);
    } catch (err: any) {
      setError(err.message || 'Render initiation failed.');
    } finally {
      setIsCompiling(false);
    }
  };

  // HTML/CSS Subtitle Overlays preview calculations
  const renderedSubtitleOverlay = useMemo(() => {
    if (!activeScene) return null;

    const duration = activeScene.end_time - activeScene.start_time;
    const relTime = currentTime - activeScene.start_time;

    // Typography style setup
    const textStyle: React.CSSProperties = {
      fontFamily: fontName === 'Anton' ? 'Anton' : (fontName === 'Bangers' ? 'Bangers' : 'Inter, sans-serif'),
      fontSize: `${fontSize * 0.9}px`,
      color: fontColor,
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      textAlign: 'center',
      textShadow: shadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
      WebkitTextStroke: `1.5px ${outlineColor}`,
      letterSpacing: '0.02em',
      lineHeight: '1.2'
    };

    const activeWords = activeScene.words || [];

    if (subtitleMode === 'classic') {
      return <div style={textStyle}>{activeScene.text}</div>;
    }

    if (activeWords.length === 0) {
      return <div style={textStyle}>{activeScene.text}</div>;
    }

    // Map localized words
    const localWords = activeWords.map(w => ({
      word: w.word,
      start: Math.max(0, w.start_time - activeScene.start_time),
      end: Math.min(duration, w.end_time - activeScene.start_time)
    }));

    if (subtitleMode === 'centered-word') {
      const activeWordObj = localWords.find(w => relTime >= w.start && relTime < w.end);
      if (!activeWordObj) return null;

      const scale = activeWordScale > 1.0 ? `scale(${activeWordScale})` : 'none';

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {showHighlightBox && (
            <div style={{
              background: boxColor,
              padding: '6px 14px',
              borderRadius: `${boxRounding}px`,
              fontSize: `${fontSize * 0.9}px`,
              fontFamily: textStyle.fontFamily,
              fontWeight: 'bold',
              color: fontColor,
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
              transform: scale,
              transition: 'transform 0.1s ease',
              WebkitTextStroke: `1px ${outlineColor}`
            }}>
              {activeWordObj.word}
            </div>
          )}
          {!showHighlightBox && (
            <span style={{
              ...textStyle,
              color: highlightColor,
              display: 'inline-block',
              transform: scale,
              transition: 'transform 0.1s ease'
            }}>
              {activeWordObj.word}
            </span>
          )}
        </div>
      );
    }

    if (subtitleMode === 'smart-highlight') {
      return (
        <div style={{ ...textStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '0 20px' }}>
          {localWords.map((item, idx) => {
            const isActive = relTime >= item.start && relTime < item.end;
            const wordColor = isActive ? highlightColor : fontColor;
            const scale = isActive && activeWordScale > 1.0 ? `scale(${activeWordScale})` : 'none';

            return (
              <span
                key={idx}
                style={{
                  color: wordColor,
                  display: 'inline-block',
                  transform: scale,
                  transition: 'all 0.1s ease'
                }}
              >
                {item.word}
              </span>
            );
          })}
        </div>
      );
    }

    return <div style={textStyle}>{activeScene.text}</div>;
  }, [
    activeScene,
    currentTime,
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
    activeWordScale
  ]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr 280px',
        height: 'calc(100vh - 40px)',
        gap: '16px',
        color: 'var(--text-white)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden'
      }}
    >
      {/* HTML Audio Sync Nodes */}
      {voiceoverUrl && <audio ref={voiceoverAudioRef} src={voiceoverUrl} />}
      {bgmUrl && <audio ref={bgmAudioRef} src={bgmUrl} loop />}

      {/* Header Studio Controls */}
      <header
        className="glass-panel"
        style={{
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '13px' }}>
            <ChevronLeft size={16} /> Back to Wizard
          </button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>V-Gen Timeline Studio</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-gray)' }}>
              Adjust scene cuts, trim video sources, split segments, and customize styles in real time.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saving && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={14} className="spin" style={{ animation: 'spin-slow 2s linear infinite' }} />
              Saving...
            </span>
          )}
          {!saving && success && (
            <span style={{ fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> Saved
            </span>
          )}
          <button
            onClick={() => saveProjectState()}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Save Project
          </button>
          <button
            onClick={handleCompile}
            className="btn-primary"
            disabled={isCompiling || scenes.length === 0}
            style={{ padding: '8px 20px', fontSize: '13px' }}
          >
            <Sparkles size={14} />
            {isCompiling ? 'Compiling...' : 'Render Final Video'}
          </button>
        </div>
      </header>

      {/* Status Messages */}
      {(error || loading) && (
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && (
            <div style={{ padding: '10px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', borderRadius: '8px', fontSize: '13px' }}>
              Loading project data...
            </div>
          )}
          {error && (
            <div style={{ padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>Dismiss</button>
            </div>
          )}
        </div>
      )}

      {/* Middle Section: Sidebar Settings (Left) + Player Viewport (Right) */}
      <section style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px', overflow: 'hidden' }}>
        {/* Sidebar settings panel */}
        <aside className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-light)',
              background: 'var(--bg-dark)'
            }}
          >
            {(['clips', 'subtitles', 'audio', 'video'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  background: activeTab === tab ? 'rgba(255,255,255,0.05)' : 'transparent',
                  borderBottom: activeTab === tab ? '2px solid var(--accent-purple)' : 'none',
                  color: activeTab === tab ? 'var(--text-white)' : 'var(--text-gray)',
                  cursor: 'pointer'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {activeTab === 'clips' && (
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Clips Library</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-gray)', marginBottom: '16px' }}>
                  Click a scene in the timeline below, then choose a clip here to re-assign or swap.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {clips.map(clip => (
                    <div
                      key={clip.id}
                      onClick={() => {
                        if (selectedSceneIdx !== null) {
                          const updated = [...scenes];
                          updated[selectedSceneIdx] = { ...updated[selectedSceneIdx], clipId: clip.id, clipStart: 0 };
                          setScenes(updated);
                          saveProjectState(updated);
                        }
                      }}
                      style={{
                        borderRadius: '6px',
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                      }}
                      className="glass-panel-interactive"
                    >
                      <img src={clip.thumbnail} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover' }} />
                      <div style={{ padding: '6px', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {clip.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'subtitles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label">Caption Style Template</label>
                  <select
                    className="input-field"
                    value={subtitleMode}
                    onChange={e => setSubtitleMode(e.target.value as any)}
                  >
                    <option value="classic">Classic Subtitles (Bottom)</option>
                    <option value="smart-highlight">Smart Phrase Highlight (TikTok Style)</option>
                    <option value="centered-word">Snappy Word Centered (Hormozi Style)</option>
                    <option value="pop">Floating Pop (Word Linger)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Font Family</label>
                  <select className="input-field" value={fontName} onChange={e => setFontName(e.target.value)}>
                    <option value="Arial">Arial</option>
                    <option value="Anton">Anton (Bold Premium)</option>
                    <option value="Bangers">Bangers (Stylized Premium)</option>
                    <option value="Kalam">Kalam (Handwritten)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="label">Font Size</label>
                    <input
                      type="number"
                      className="input-field"
                      value={fontSize}
                      onChange={e => setFontSize(parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div>
                    <label className="label">Highlight Zoom</label>
                    <input
                      type="number"
                      step="0.05"
                      className="input-field"
                      value={activeWordScale}
                      onChange={e => setActiveWordScale(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label">Font Color</label>
                    <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Highlight Color</label>
                    <input type="color" value={highlightColor} onChange={e => setHighlightColor(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input type="checkbox" checked={bold} onChange={e => setBold(e.target.checked)} /> Bold
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input type="checkbox" checked={italic} onChange={e => setItalic(e.target.checked)} /> Italic
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input type="checkbox" checked={shadow} onChange={e => setShadow(e.target.checked)} /> Shadow
                  </label>
                </div>

                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={textFade} onChange={(e) => setTextFade(e.target.checked)} />
                    In/Out Fade (150ms)
                  </label>

                  <div>
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

                  <div>
                    <label className="label">Stay Animation (Motion)</label>
                    <select className="input-field" value={textMotion} onChange={(e) => setTextMotion(e.target.value)}>
                      <option value="none">None (Stationary)</option>
                      <option value="float">Floating Text (Slow Rise)</option>
                    </select>
                  </div>
                </div>

                {subtitleMode === 'centered-word' && (
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input type="checkbox" checked={showHighlightBox} onChange={e => setShowHighlightBox(e.target.checked)} /> Show Highlight Box
                    </label>
                    {showHighlightBox && (
                      <>
                        <div>
                          <label className="label">Box Color</label>
                          <input type="color" value={boxColor} onChange={e => setBoxColor(e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Box Corner Rounding ({boxRounding}px)</label>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            value={boxRounding}
                            onChange={e => setBoxRounding(parseInt(e.target.value, 10))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label">Voiceover Volume ({Math.round(voiceoverVolume * 100)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.1"
                    value={voiceoverVolume}
                    onChange={e => setVoiceoverVolume(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="label">Background Music</label>
                  <select
                    className="input-field"
                    value={bgMusicPath}
                    onChange={e => setBgMusicPath(e.target.value)}
                  >
                    <option value="">-- No Background Music --</option>
                    {bgms.map(bgm => (
                      <option key={bgm.id} value={bgm.path}>
                        {bgm.name} ({bgm.duration ? `${Math.floor(bgm.duration / 60)}:${String(Math.floor(bgm.duration % 60)).padStart(2, '0')}` : '?'})
                      </option>
                    ))}
                  </select>
                </div>

                {bgMusicPath && (
                  <>
                    <div>
                      <label className="label">Background Music Volume ({Math.round(bgMusicVolume * 100)}%)</label>
                      <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={bgMusicVolume}
                        onChange={e => setBgMusicVolume(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="label">BGM Starting Playback Offset ({bgMusicStartOffset.toFixed(1)}s)</label>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="1"
                        value={bgMusicStartOffset}
                        onChange={e => setBgMusicStartOffset(parseInt(e.target.value, 10))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'video' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label">Aspect Ratio</label>
                  <select className="input-field" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                    <option value="9:16">9:16 Vertical (Shorts/TikToks)</option>
                    <option value="16:9">16:9 Widescreen (YouTube)</option>
                    <option value="1:1">1:1 Square (Instagram)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Scale Fill Mode</label>
                  <select className="input-field" value={fillMode} onChange={e => setFillMode(e.target.value)}>
                    <option value="crop">Crop to Fill</option>
                    <option value="fit">Fit (Letterbox)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Scene Clip Transition</label>
                  <select
                    className="input-field"
                    value={clipTransition}
                    onChange={e => setClipTransition(e.target.value)}
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

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={zoomAnimation} onChange={e => setZoomAnimation(e.target.checked)} />
                  Enable Ken Burns Camera Zoom
                </label>
              </div>
            )}
          </div>
        </aside>

        {/* Video Preview Viewport Panel */}
        <main
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'black',
            position: 'relative'
          }}
        >
          {/* Dynamic Aspect Ratio viewport container */}
          <div
            style={{
              position: 'relative',
              width: aspectRatio === '9:16' ? '280px' : (aspectRatio === '16:9' ? '500px' : '360px'),
              height: aspectRatio === '9:16' ? '497px' : (aspectRatio === '16:9' ? '281px' : '360px'),
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'none',
              overflow: 'hidden'
            }}
          >
            {/* HTML5 Video node */}
            <video
              ref={previewVideoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: fillMode === 'crop' ? 'cover' : 'contain'
              }}
              muted
              playsInline
            />

            {/* Real-time Subtitles Overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: '15%',
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 10
              }}
            >
              {renderedSubtitleOverlay}
            </div>
          </div>

          {/* Simple controls bar overlayed below */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '16px',
              zIndex: 2,
              padding: '6px 16px',
              borderRadius: '20px',
              background: 'rgba(0,0,0,0.6)'
            }}
          >
            <button
              onClick={togglePlay}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-gray)' }}>
              {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </span>
          </div>
        </main>
      </section>

      {/* Bottom Visual Timeline Section */}
      <footer
        className="glass-panel"
        style={{
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          padding: '12px 16px',
          overflow: 'hidden'
        }}
      >
        {/* Timeline toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleSplitScene}
              disabled={activeSceneIndex === -1}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', height: '28px' }}
              title="Split scene clip at playhead"
            >
              <Scissors size={12} /> Split
            </button>
            <button
              onClick={() => selectedSceneIdx !== null && handleDeleteScene(selectedSceneIdx)}
              disabled={selectedSceneIdx === null}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', height: '28px' }}
              title="Delete selected scene"
            >
              <Trash2 size={12} /> Delete
            </button>
            <button
              onClick={() => selectedSceneIdx !== null && handleMoveScene(selectedSceneIdx, 'left')}
              disabled={selectedSceneIdx === null || selectedSceneIdx === 0}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', height: '28px' }}
              title="Move Scene Left"
            >
              <MoveLeft size={12} /> Move Left
            </button>
            <button
              onClick={() => selectedSceneIdx !== null && handleMoveScene(selectedSceneIdx, 'right')}
              disabled={selectedSceneIdx === null || selectedSceneIdx === scenes.length - 1}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', height: '28px' }}
              title="Move Scene Right"
            >
              <MoveRight size={12} /> Move Right
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ZoomOut size={12} />
            <input
              type="range"
              min="30"
              max="200"
              value={timelineZoom}
              onChange={e => setTimelineZoom(parseInt(e.target.value, 10))}
              style={{ width: '80px', height: '4px' }}
            />
            <ZoomIn size={12} />
            <span style={{ fontSize: '10px', color: 'var(--text-gray)', marginLeft: '6px' }}>
              Scale: {timelineZoom}px/s
            </span>
          </div>
        </div>

        {/* Scrollable Tracks container */}
        <div
          ref={timelineRulerRef}
          style={{
            position: 'relative',
            overflow: 'auto',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '6px',
            border: '1px solid var(--border-light)'
          }}
          onMouseDown={e => {
            const target = e.target as HTMLElement;
            if (
              target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.tagName === 'SELECT' ||
              target.tagName === 'BUTTON' ||
              target.closest('button') ||
              target.style.cursor === 'col-resize' ||
              target.style.cursor === 'ew-resize'
            ) {
              return;
            }

            const rect = timelineRulerRef.current?.getBoundingClientRect();
            if (rect) {
              const clickX = e.clientX - rect.left + (timelineRulerRef.current?.scrollLeft || 0);
              const clickTime = (clickX - 70) / timelineZoom;
              handleTimelineSeek(clickTime);
            }
          }}
        >
          {/* Sizing box matching timeline duration width */}
          <div style={{ width: `${totalDuration * timelineZoom + 200}px`, position: 'relative', height: '100%', padding: '10px 0' }}>
            
            {/* Playhead red vertical indicator bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${70 + currentTime * timelineZoom}px`,
                width: '2px',
                background: 'red',
                zIndex: 20,
                pointerEvents: 'none'
              }}
            >
              <div style={{ width: '10px', height: '10px', background: 'red', borderRadius: '50%', transform: 'translate(-4px, 0)' }} />
            </div>

            {/* TRACK 1: Subtitle blocks */}
            <div style={{ display: 'flex', alignItems: 'center', height: '36px', marginBottom: '6px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, width: '60px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '4px' }}>TEXT</div>
              <div style={{ marginLeft: '70px', display: 'flex', height: '100%', position: 'relative', width: '100%' }}>
                {scenes.map((scene, idx) => {
                  const left = scene.start_time * timelineZoom;
                  const width = (scene.end_time - scene.start_time) * timelineZoom;

                  return (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: `${left}px`,
                        width: `${width}px`,
                        height: '100%',
                        background: selectedSceneIdx === idx ? 'rgba(138, 75, 243, 0.25)' : 'rgba(255,255,255,0.03)',
                        border: selectedSceneIdx === idx ? '1px solid var(--accent-purple)' : '1px dashed var(--border-medium)',
                        borderRadius: '4px',
                        padding: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedSceneIdx(idx);
                        setActiveTab('subtitles');
                      }}
                    >
                      <input
                        type="text"
                        value={scene.text}
                        onChange={e => updateSceneText(idx, e.target.value)}
                        style={{
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          fontSize: '11px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TRACK 2: Video clip blocks */}
            <div style={{ display: 'flex', alignItems: 'center', height: '60px', marginBottom: '8px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, width: '60px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '4px' }}>VIDEO</div>
              <div style={{ marginLeft: '70px', display: 'flex', height: '100%', position: 'relative', width: '100%' }}>
                {scenes.map((scene, idx) => {
                  const left = scene.start_time * timelineZoom;
                  const width = (scene.end_time - scene.start_time) * timelineZoom;
                  const clipObj = clips.find(c => c.id === scene.clipId);

                  return (
                    <div
                      key={idx}
                      onMouseDown={e => {
                        setSelectedSceneIdx(idx);
                        setActiveTab('video');
                        handleClipOffsetDrag(idx, e);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${left}px`,
                        width: `${width}px`,
                        height: '100%',
                        background: selectedSceneIdx === idx ? 'rgba(138, 75, 243, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: selectedSceneIdx === idx ? '2px solid var(--accent-purple)' : '1px solid var(--border-light)',
                        borderRadius: '4px',
                        cursor: 'ew-resize',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                        userSelect: 'none'
                      }}
                      title="Click and drag to slide clip starting offset window"
                    >
                      {/* Left Resize handle */}
                      {idx > 0 && (
                        <div
                          onMouseDown={e => {
                            e.stopPropagation();
                            handleBoundaryDrag(idx - 1, e);
                          }}
                          style={{
                            width: '6px',
                            height: '100%',
                            background: 'rgba(255,255,255,0.2)',
                            cursor: 'col-resize',
                            zIndex: 15
                          }}
                        />
                      )}

                      {/* Clip display properties */}
                      <div style={{ padding: '0 8px', fontSize: '10px', pointerEvents: 'none', display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
                        {clipObj && <img src={clipObj.thumbnail} alt="" style={{ width: '40px', height: '24px', objectFit: 'cover', borderRadius: '2px' }} />}
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          [{idx}] {clipObj?.name || 'Missing clip'} (Offset: {scene.clipStart.toFixed(1)}s)
                        </div>
                      </div>

                      {/* Right Resize handle */}
                      {idx < scenes.length - 1 && (
                        <div
                          onMouseDown={e => {
                            e.stopPropagation();
                            handleBoundaryDrag(idx, e);
                          }}
                          style={{
                            width: '6px',
                            height: '100%',
                            background: 'rgba(255,255,255,0.2)',
                            cursor: 'col-resize',
                            zIndex: 15
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TRACK 3: Voiceover waveform block */}
            <div style={{ display: 'flex', alignItems: 'center', height: '24px', marginBottom: '4px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, width: '60px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '4px' }}>VOICE</div>
              <div
                onClick={() => setActiveTab('audio')}
                style={{
                  marginLeft: '70px',
                  width: `${totalDuration * timelineZoom}px`,
                  height: '100%',
                  background: 'linear-gradient(90deg, rgba(236,72,153,0.1) 0%, rgba(236,72,153,0.2) 100%)',
                  border: '1px solid rgba(236,72,153,0.3)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '12px',
                  fontSize: '9px',
                  color: 'rgba(236,72,153,0.8)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Voiceover Audio waveform (Locked)
              </div>
            </div>

            {/* TRACK 4: BGM track block */}
            {bgMusicPath && (
              <div style={{ display: 'flex', alignItems: 'center', height: '24px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, width: '60px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '4px' }}>MUSIC</div>
                <div
                  onClick={() => setActiveTab('audio')}
                  style={{
                    marginLeft: `${70 + bgMusicStartOffset * timelineZoom}px`,
                    width: `${(totalDuration - bgMusicStartOffset) * timelineZoom}px`,
                    height: '100%',
                    background: 'linear-gradient(90deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.2) 100%)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '12px',
                    fontSize: '9px',
                    color: 'rgba(59,130,246,0.8)',
                    fontWeight: 600,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  BGM: {bgMusicPath.split(/[/\\]/).pop()} (Vol: {Math.round(bgMusicVolume * 100)}%)
                </div>
              </div>
            )}

          </div>
        </div>
      </footer>
    </div>
  );
}
