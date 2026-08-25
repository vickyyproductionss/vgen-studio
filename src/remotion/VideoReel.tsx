import React from 'react';
import { delayRender, continueRender, Sequence, Audio, AbsoluteFill, useCurrentFrame, useVideoConfig, spring, prefetch, OffthreadVideo, Video, interpolate, Easing } from 'remotion';
import { SubtitleWord } from './components/SubtitleWord';
import type { WordStyle } from './components/SubtitleWord';
import { StoryGraphCanvas } from './components/StoryGraphCanvas';
import type { GraphEntity, GraphEvent } from './components/StoryGraphCanvas';
import { QuoteCard } from './components/QuoteCard';
import { VersusLayout } from './components/VersusLayout';
import { StatCallout } from './components/StatCallout';
import { TimelineCheckpoint } from './components/TimelineCheckpoint';
import { DangerCallout } from './components/DangerCallout';
import { ProgressRatio } from './components/ProgressRatio';
import { ProTip } from './components/ProTip';
import { VersusMeter } from './components/VersusMeter';
import { TierListRanker } from './components/TierListRanker';

export interface Scene {
  text: string;
  start_time: number;
  end_time: number;
  clipId?: string;
  clipUrl?: string | null;
  clipStart?: number;
  words?: {
    word: string;
    start_time: number;
    end_time: number;
    sfx?: string;
  }[];
  transition?: string;
  transitionDuration?: number;
  transitionEasing?: string;
  shake?: boolean;
  shakeIntensity?: number;
  shakeSpeed?: number;
  zoom?: boolean;
  sfx?: string;
  graphContext?: string;
  transition?: string;
  layout?: 'graph' | 'versus' | 'quote' | 'stat_callout' | 'timeline_checkpoint' | 'full_broll';
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
  };
  ambientSoundscape?: string;
  postProcessingPreset?: string;
}

const emphasisWords = [
  'million', 'billion', 'secret', 'crash', 'danger', 'free', 'money', 'easy', 'growth', 'extreme', 
  'never', 'always', 'stop', 'go', 'die', 'live', 'win', 'lose', 'rich', 'poor', 'destroy', 'build', 
  'hack', 'hidden', 'viral', 'massive', 'insane', 'growthful', 'perfect', 'success', 'love', 'fast', 
  'gym', 'workout', 'fitness', 'strong', 'fire', 'broke', 'king', 'queen', 'power', 'energy', 'warning',
  'doctor', 'pizza', 'excited', 'wow', 'shocked', 'surprised', 'confused', 'truth', 'wild', 'beast'
];

export interface VideoReelProps {
  scenes: Scene[];
  originalVideoUrl?: string;
  voiceoverUrl?: string;
  voiceoverVolume?: number;
  bgMusicUrl?: string;
  bgMusicVolume?: number;
  videoVolume?: number;
  sfxVolume?: number;
  subtitleMode: 'classic' | 'pop' | 'smart-highlight' | 'centered-word' | 'simple';
  fontName: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowDistance?: number;
  shadowAngle?: number;
  shadowOpacity?: number;
  outlineColor?: string;
  outlineThickness?: number;
  letterSpacing?: number;
  wordSpacing?: number;
  // Top-level glow — overrides whatever neonGlow is set inside normalStyle/highlightStyle
  neonGlow?: boolean;
  glowColor?: string;
  glowBlur?: number;
  glowDistance?: number;
  activeWordScale: number;
  normalStyle?: WordStyle;
  highlightStyle?: WordStyle;
  emojiStyle?: WordStyle;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  fillMode?: 'crop' | 'fit';
  textPositionX?: number;
  textPositionY?: number;
  maxWordsPerLine?: number;
  baseUrl?: string;
  highlightTrigger?: 'all' | 'emphasis' | 'emoji' | 'none';
  textCase?: 'default' | 'upper' | 'first-word-larger';
  autoEmphasis?: boolean;
  entities?: GraphEntity[];
  graphEvents?: GraphEvent[];
  graphSettings?: {
    overlayOnBroll?: boolean;
    brollOpacity?: number;
    glowIntensity?: number;
  } | null;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  backgroundColor?: string;
  backgroundPattern?: 'grid' | 'dots' | 'radial' | 'none';
  backgroundImageUrl?: string;
  isRendering?: boolean;
  subtitlesOnly?: boolean;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
  showLayoutCards?: boolean;
  applyHUDToAll?: boolean;
}

// Hook to dynamically load Google Fonts and pause Remotion render until loaded (only during server rendering)
const useGoogleFont = (fontName: string, isRendering?: boolean) => {
  React.useEffect(() => {
    const systemFonts = ['Arial', 'Impact', 'Courier New', 'Times New Roman', 'Trebuchet MS'];
    if (systemFonts.includes(fontName) || !fontName) {
      return;
    }

    let targetFont = fontName;
    if (fontName.startsWith('Kalam')) {
      targetFont = 'Kalam';
    }

    const fontId = `google-font-reel-${targetFont.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Check if link tag is already injected
    if (document.getElementById(fontId)) {
      return;
    }

    const handle = isRendering ? delayRender(`Loading font: ${fontName}`) : null;

    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(targetFont)}:wght@400;700;900&display=swap`;
    
    link.onload = () => {
      if (document.fonts) {
        document.fonts.load(`12px "${targetFont}"`).then(() => {
          if (handle) continueRender(handle);
        }).catch((err) => {
          console.warn(`document.fonts failed to load ${targetFont}:`, err);
          if (handle) continueRender(handle);
        });
      } else {
        if (handle) continueRender(handle);
      }
    };

    link.onerror = (err) => {
      console.error(`Failed to load link stylesheet for font ${targetFont}:`, err);
      if (handle) continueRender(handle);
    };

    document.head.appendChild(link);
  }, [fontName, isRendering]);
};

const resolveAssetUrl = (url: string, baseUrl?: string, isRendering?: boolean) => {
  if (!url) return '';
  
  let formattedUrl = url.trim();

  // If raw filename without leading slash or protocol (e.g. "audio_123.mp3" or "sfx_xyz.mp3"), prefix with /uploads/
  if (!formattedUrl.startsWith('http://') && 
      !formattedUrl.startsWith('https://') && 
      !formattedUrl.startsWith('data:') && 
      !formattedUrl.startsWith('/')) {
    formattedUrl = `/uploads/${formattedUrl}`;
  }

  if (formattedUrl.startsWith('http://') || formattedUrl.startsWith('https://') || formattedUrl.startsWith('data:')) {
    return formattedUrl;
  }

  // Route /api/ endpoints directly to Express backend on port 8000
  if (formattedUrl.startsWith('/api/')) {
    const backendBase = isRendering ? 'http://localhost:8000' : (baseUrl || 'http://localhost:8000');
    return `${backendBase}${formattedUrl}`;
  }

  // Handle absolute local paths (macOS/Linux) or /uploads/ local asset URLs
  if (formattedUrl.startsWith('/') && (
    formattedUrl.startsWith('/Volumes/') || 
    formattedUrl.startsWith('/Users/') || 
    formattedUrl.startsWith('/var/') || 
    formattedUrl.startsWith('/tmp/') ||
    formattedUrl.startsWith('/uploads/')
  )) {
    const backendBase = isRendering ? 'http://localhost:8000' : (baseUrl || 'http://localhost:8000');
    return `${backendBase}/api/serve-local-file?path=${encodeURIComponent(formattedUrl)}`;
  }
  
  const base = baseUrl || 'http://localhost:8000';
  return `${base}${formattedUrl}`;
};

export const VideoReel: React.FC<VideoReelProps> = ({
  scenes,
  originalVideoUrl,
  voiceoverUrl,
  voiceoverVolume = 1.0,
  bgMusicUrl,
  bgMusicVolume = 0.15,
  videoVolume = 0.0,
  sfxVolume = 1.0,
  subtitleMode,
  fontName,
  fontSize,
  bold,
  italic,
  shadow,
  shadowColor = '#000000',
  shadowBlur = 4,
  shadowDistance = 2,
  shadowAngle = 45,
  shadowOpacity = 0.6,
  outlineColor,
  outlineThickness = 1.5,
  letterSpacing = 0,
  wordSpacing = 0,
  neonGlow,
  glowColor,
  glowBlur: glowBlurProp,
  glowDistance: glowDistanceProp,
  activeWordScale: _activeWordScale,
  normalStyle,
  highlightStyle,
  emojiStyle,
  aspectRatio: _aspectRatio = '9:16',
  fillMode = 'crop',
  textPositionX = 0,
  textPositionY = -70,
  maxWordsPerLine = 3,
  baseUrl,
  highlightTrigger = 'all',
  textCase = 'default',
  autoEmphasis = false,
  entities = [],
  graphEvents = [],
  graphSettings = null,
  brandPrimaryColor = '#d4af37',
  brandSecondaryColor = '#f5e6a3',
  backgroundColor = '#080c18',
  backgroundPattern = 'grid',
  backgroundImageUrl = '',
  subtitlesOnly = false,
  isRendering = false,
  cardPositionY = 0,
  cardScale = 1.0,
  cardFontName,
  showLayoutCards = true,
  applyHUDToAll = true,
}) => {
  useGoogleFont(fontName, isRendering);

  React.useEffect(() => {
    if (isRendering) return;

    // Collect all unique URLs that we want to prefetch
    const urlsToPrefetch: string[] = [];
    
    if (voiceoverUrl) {
      urlsToPrefetch.push(resolveAssetUrl(voiceoverUrl, baseUrl));
    }
    if (bgMusicUrl) {
      urlsToPrefetch.push(resolveAssetUrl(bgMusicUrl, baseUrl));
    }
    
    scenes.forEach((scene) => {
      const clipUrl = scene.clipUrl !== undefined
        ? scene.clipUrl
        : (!scene.clipId || scene.clipId === 'original'
          ? null
          : `/api/clips/${scene.clipId}/video`);
          
      if (clipUrl) {
        const resolved = resolveAssetUrl(clipUrl, baseUrl);
        if (!urlsToPrefetch.includes(resolved)) {
          urlsToPrefetch.push(resolved);
        }
      }
      
      if (scene.sfx && scene.sfx !== 'none') {
        const sfxUrl = resolveAssetUrl(`/uploads/sfx/${scene.sfx.endsWith('.mp3') ? scene.sfx : `${scene.sfx}.mp3`}`, baseUrl);
        if (!urlsToPrefetch.includes(sfxUrl)) {
          urlsToPrefetch.push(sfxUrl);
        }
      }
      
      if (scene.ambientSoundscape && scene.ambientSoundscape !== 'none') {
        const ambientUrl = resolveAssetUrl(`/uploads/sfx/${scene.ambientSoundscape}.mp3`, baseUrl);
        if (!urlsToPrefetch.includes(ambientUrl)) {
          urlsToPrefetch.push(ambientUrl);
        }
      }
    });

    let active = true;
    const prefetches: { free: () => void }[] = [];

    const runPrefetchQueue = () => {
      urlsToPrefetch.forEach(url => {
        if (!active) return;
        try {
          const p = prefetch(url);
          prefetches.push(p);
        } catch (_) {}
      });
    };

    runPrefetchQueue();

    return () => {
      active = false;
      console.log('[Prefetch] Cleaning up prefetch objects...');
      prefetches.forEach((p) => {
        try {
          p.free();
        } catch (e) {
          // ignore
        }
      });
    };
  }, [scenes, voiceoverUrl, bgMusicUrl, baseUrl]);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  // Pre-calculate frame boundaries & transition overlaps to ensure 100% seamless zero-gap transitions
  const sceneStartFrames: number[] = [];
  const sceneDurations: number[] = [];
  const boundaries: number[] = [];

  if (scenes.length > 0) {
    boundaries.push(Math.round(scenes[0].start_time * fps));
    for (let i = 1; i < scenes.length; i++) {
      boundaries.push(Math.max(boundaries[i - 1] + 1, Math.round(scenes[i].start_time * fps)));
    }
    boundaries.push(Math.max(boundaries[boundaries.length - 1] + 1, Math.round(scenes[scenes.length - 1].end_time * fps)));

    for (let i = 0; i < scenes.length; i++) {
      const rawStart = boundaries[i];
      const rawEnd = boundaries[i + 1];
      const rawDur = Math.max(1, rawEnd - rawStart);

      const incomingTrans = i > 0 ? (scenes[i - 1].transition || 'none') : 'none';
      const incomingDur = i > 0 ? (scenes[i - 1].transitionDuration !== undefined ? scenes[i - 1].transitionDuration : 0.3) : 0.3;
      const incomingFrames = (incomingTrans !== 'none') ? Math.max(1, Math.round(incomingDur * fps)) : 0;

      const startF = Math.max(0, rawStart - incomingFrames);
      const durF = rawDur + incomingFrames;

      sceneStartFrames.push(startF);
      sceneDurations.push(durF);
    }
  }

  const hasGraph = !subtitlesOnly && entities && entities.length > 0 && graphEvents && graphEvents.length > 0;
  const overlayOnBroll = graphSettings?.overlayOnBroll ?? false;
  const brollOpacity = graphSettings?.brollOpacity ?? 0.35;

  const currentSceneIndex = scenes.findIndex(
    (s, idx) => frame >= boundaries[idx] && frame < boundaries[idx + 1]
  );
  const currentScene = scenes[currentSceneIndex];

  const resolvedBgImage = backgroundImageUrl ? resolveAssetUrl(backgroundImageUrl, baseUrl) : null;

  let bgImageStyle = 'none';
  let bgSizeStyle = 'auto';

  if (resolvedBgImage) {
    bgImageStyle = `url(${resolvedBgImage})`;
    bgSizeStyle = 'cover';
  } else if (backgroundPattern === 'grid') {
    bgImageStyle = `linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px), radial-gradient(circle at center, rgba(16, 24, 48, 0.8) 0%, ${backgroundColor} 100%)`;
    bgSizeStyle = '40px 40px, 40px 40px, auto';
  } else if (backgroundPattern === 'dots') {
    bgImageStyle = `radial-gradient(rgba(255, 255, 255, 0.04) 1.5px, transparent 1.5px), radial-gradient(circle at center, rgba(16, 24, 48, 0.7) 0%, ${backgroundColor} 100%)`;
    bgSizeStyle = '30px 30px, auto';
  } else if (backgroundPattern === 'radial') {
    bgImageStyle = `radial-gradient(circle at center, rgba(255, 255, 255, 0.08) 0%, transparent 60%), radial-gradient(circle at center, ${brandPrimaryColor}15 0%, ${backgroundColor} 100%)`;
    bgSizeStyle = 'auto';
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        backgroundImage: resolvedBgImage ? `url(${resolvedBgImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 0. Story Graph Canvas Layer */}
      {hasGraph && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            opacity: (!currentScene || currentScene.layout === 'graph' || !currentScene.layout) ? 1.0 : 0.0,
            transition: 'opacity 0.4s ease-in-out',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <StoryGraphCanvas
            entities={entities}
            graphEvents={graphEvents}
            scenes={scenes}
            graphSettings={graphSettings}
          />
        </div>
      )}
      {/* 1. Background Music */}
      {bgMusicUrl && (
        <Audio
          src={resolveAssetUrl(bgMusicUrl, baseUrl)}
          volume={bgMusicVolume}
          crossOrigin={isRendering ? "anonymous" : undefined}
          pauseWhenBuffering={isRendering ? true : false}
          onError={(error) => {
            console.error("Remotion Audio Error (BGM):", error);
            const targetPort = 8000;
            const backendUrl = window.location.port 
              ? `${window.location.protocol}//${window.location.hostname}:${targetPort}`
              : window.location.origin;
            fetch(`${backendUrl}/api/log-client-error`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                error: error?.toString() || 'HTML5 Audio Error',
                message: `Failed to load background music: ${bgMusicUrl}`,
                stack: error?.stack || new Error().stack,
                component: 'VideoReel-AudioComponent-BGM'
              })
            }).catch(err => console.error("Failed to report audio error to backend:", err));
            return 'fallback';
          }}
        />
      )}

      {/* 2. Voiceover Track */}
      {voiceoverUrl && !subtitlesOnly && (
        <Audio
          src={resolveAssetUrl(voiceoverUrl, baseUrl)}
          volume={voiceoverVolume}
          crossOrigin={isRendering ? "anonymous" : undefined}
          pauseWhenBuffering={isRendering ? true : false}
          onError={(error) => {
            console.error("Remotion Audio Error (Voiceover):", error);
            const targetPort = 8000;
            const backendUrl = window.location.port 
              ? `${window.location.protocol}//${window.location.hostname}:${targetPort}`
              : window.location.origin;
            fetch(`${backendUrl}/api/log-client-error`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                error: error?.toString() || 'HTML5 Audio Error',
                message: `Failed to load voiceover: ${voiceoverUrl}`,
                stack: error?.stack || new Error().stack,
                component: 'VideoReel-AudioComponent-VO'
              })
            }).catch(err => console.error("Failed to report audio error to backend:", err));
            return 'fallback';
          }}
        />
      )}

      {/* 3. Sequence through B-Roll scenes */}
      {scenes.map((scene, idx) => {
        const startFrame = sceneStartFrames[idx];
        const durationInFrames = sceneDurations[idx];

        const isSceneActive = frame >= startFrame && frame < startFrame + durationInFrames;
        if (!isSceneActive) return null;

        // Calculate rightBlurredMode and merge layoutProps for Versus layout
        let rightBlurredMode: 'blurred' | 'unblurred' | 'auto-transition' = 'auto-transition';
        let mergedVersusLeft = scene.layoutProps?.versusLeft || '';
        let mergedVersusRight = scene.layoutProps?.versusRight || '';
        let mergedVersusLabel = scene.layoutProps?.versusLabel || '';
        let mergedVersusLeftFeatures = scene.layoutProps?.versusLeftFeatures || [];
        let mergedVersusRightFeatures = scene.layoutProps?.versusRightFeatures || [];

        if (scene.layout === 'versus') {
          let hasPrev = false;
          let hasNext = false;
          
          if (idx > 0) {
            const prev = scenes[idx - 1];
            if (prev.layout === 'versus') {
              hasPrev = true;
            }
          }
          if (idx < scenes.length - 1) {
            const next = scenes[idx + 1];
            if (next.layout === 'versus') {
              hasNext = true;
            }
          }
          
          if (hasPrev && !hasNext) {
            rightBlurredMode = 'unblurred';
          } else if (!hasPrev && hasNext) {
            rightBlurredMode = 'blurred';
          } else if (hasPrev && hasNext) {
            rightBlurredMode = 'blurred';
          } else {
            rightBlurredMode = 'auto-transition';
          }

          // Walk backward and forward to collect all non-empty properties
          let searchIdx = idx - 1;
          while (searchIdx >= 0 && scenes[searchIdx].layout === 'versus') {
            const p = scenes[searchIdx].layoutProps;
            if (p) {
              if (!mergedVersusLeft && p.versusLeft) mergedVersusLeft = p.versusLeft;
              if (!mergedVersusRight && p.versusRight) mergedVersusRight = p.versusRight;
              if (!mergedVersusLabel && p.versusLabel) mergedVersusLabel = p.versusLabel;
              if (mergedVersusLeftFeatures.length === 0 && p.versusLeftFeatures?.length) mergedVersusLeftFeatures = p.versusLeftFeatures;
              if (mergedVersusRightFeatures.length === 0 && p.versusRightFeatures?.length) mergedVersusRightFeatures = p.versusRightFeatures;
            }
            searchIdx--;
          }
          searchIdx = idx + 1;
          while (searchIdx < scenes.length && scenes[searchIdx].layout === 'versus') {
            const p = scenes[searchIdx].layoutProps;
            if (p) {
              if (!mergedVersusLeft && p.versusLeft) mergedVersusLeft = p.versusLeft;
              if (!mergedVersusRight && p.versusRight) mergedVersusRight = p.versusRight;
              if (!mergedVersusLabel && p.versusLabel) mergedVersusLabel = p.versusLabel;
              if (mergedVersusLeftFeatures.length === 0 && p.versusLeftFeatures?.length) mergedVersusLeftFeatures = p.versusLeftFeatures;
              if (mergedVersusRightFeatures.length === 0 && p.versusRightFeatures?.length) mergedVersusRightFeatures = p.versusRightFeatures;
            }
            searchIdx++;
          }
        }

        // 1. Resolve Transitions & DOTween Easing
        const incomingTrans = idx > 0 ? (scenes[idx - 1].transition || 'none') : 'none';
        const incomingDur = idx > 0 ? (scenes[idx - 1].transitionDuration !== undefined ? scenes[idx - 1].transitionDuration : 0.3) : 0.3;
        const incomingEasingName = idx > 0 ? (scenes[idx - 1].transitionEasing || 'out-expo') : (scene.transitionEasing || 'out-expo');

        const outgoingTrans = idx < scenes.length - 1 ? (scene.transition || 'none') : 'none';
        const outgoingDur = idx < scenes.length - 1 ? (scene.transitionDuration !== undefined ? scene.transitionDuration : 0.3) : 0.3;
        const outgoingEasingName = scene.transitionEasing || 'out-expo';

        const getTransType = (type: string, index: number) => {
          if (!type || type === 'none') return 'none';
          if (type === 'random') {
            const transitionsList = [
              'fade',
              'slide-left', 'slide-right', 'slide-up', 'slide-down',
              'blur-slide-left', 'blur-slide-right',
              'pan-left', 'pan-right',
              'zoom-in', 'zoom-out',
              'blur-zoom-in'
            ];
            return transitionsList[index % transitionsList.length];
          }
          return type;
        };

        const activeIncomingTrans = getTransType(incomingTrans, idx - 1);
        const activeOutgoingTrans = getTransType(outgoingTrans, idx);

        const incomingFrames = (activeIncomingTrans !== 'none') ? Math.max(1, Math.round(incomingDur * fps)) : 0;
        const outgoingFrames = (activeOutgoingTrans !== 'none') ? Math.max(1, Math.round(outgoingDur * fps)) : 0;

        const relativeFrame = frame - startFrame;

        // B-Roll Clip Video URL
        const clipUrl = (scene.clipUrl !== undefined && scene.clipUrl !== null && scene.clipUrl !== '')
          ? scene.clipUrl
          : ((!scene.clipId || scene.clipId === 'original')
            ? (originalVideoUrl || null)
            : `/api/clips/${scene.clipId}/video`);

        const getEasingFn = (easingName: string) => {
          const name = (easingName || 'out-expo').toLowerCase();
          switch (name) {
            case 'out-expo':
            case 'expo-out':
            case 'expo':
              return Easing.out(Easing.exp);
            case 'in-expo':
              return Easing.in(Easing.exp);
            case 'in-out-expo':
              return Easing.inOut(Easing.exp);

            case 'out-back':
            case 'back':
              return Easing.out(Easing.back(1.5));
            case 'in-out-back':
              return Easing.inOut(Easing.back(1.5));

            case 'out-bounce':
            case 'bounce':
              return Easing.out(Easing.bounce);

            case 'out-elastic':
            case 'elastic':
              return Easing.out(Easing.elastic(1));

            case 'out-cubic':
            case 'cubic':
              return Easing.out(Easing.cubic);
            case 'in-out-cubic':
              return Easing.inOut(Easing.cubic);

            case 'out-quad':
            case 'quad':
              return Easing.out(Easing.quad);
            case 'in-out-quad':
              return Easing.inOut(Easing.quad);

            case 'out-circ':
            case 'circ':
            case 'circle':
              return Easing.out(Easing.circle);

            case 'linear':
              return Easing.linear;

            default:
              return Easing.out(Easing.exp);
          }
        };

        const incomingEasing = getEasingFn(incomingEasingName);
        const outgoingEasing = getEasingFn(outgoingEasingName);

        const parseTrans = (trans: string) => {
          if (!trans || trans === 'none') {
            return { hasFade: false, hasBlur: false, hasMove: false, isLeft: false, isRight: false, isUp: false, isDown: false, isZoom: false, isZoomIn: false, isZoomOut: false };
          }
          const hasFade = trans.includes('fade');
          const hasBlur = trans.includes('blur');
          const isSlideOrPan = trans.includes('slide') || trans.includes('pan');
          const isLeft = trans.includes('left');
          const isRight = trans.includes('right');
          const isUp = trans.includes('up');
          const isDown = trans.includes('down');
          const isZoom = trans.includes('zoom');
          const isZoomIn = trans.includes('zoom-in');
          const isZoomOut = trans.includes('zoom-out');
          return { hasFade, hasBlur, hasMove: isSlideOrPan, isLeft, isRight, isUp, isDown, isZoom, isZoomIn, isZoomOut };
        };

        const inParsed = parseTrans(activeIncomingTrans);
        const outParsed = parseTrans(activeOutgoingTrans);

        let transitionOpacity = 1;
        let transitionTranslateX = 0;
        let transitionTranslateY = 0;
        let transitionScale = 1;
        let transitionBlur = 0;

        // A. Incoming Transition (first incomingFrames of this scene's sequence)
        if (!subtitlesOnly && incomingFrames > 0 && relativeFrame < incomingFrames) {
          const progress = interpolate(relativeFrame, [0, incomingFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: incomingEasing,
          });

          if (inParsed.hasFade) {
            transitionOpacity = progress;
          }
          if (inParsed.hasMove) {
            const startX = inParsed.isLeft ? 100 : (inParsed.isRight ? -100 : 0);
            const startY = inParsed.isUp ? 100 : (inParsed.isDown ? -100 : 0);
            transitionTranslateX = (1 - progress) * startX;
            transitionTranslateY = (1 - progress) * startY;
          }
          if (inParsed.isZoom) {
            const startScale = inParsed.isZoomIn ? 0.8 : 1.2;
            transitionScale = startScale + (1.0 - startScale) * progress;
            transitionOpacity = progress;
          }
          if (inParsed.hasBlur) {
            transitionBlur = 14 * (1 - progress);
          }
        }
        // B. Outgoing Transition (last outgoingFrames of this scene's sequence)
        else if (!subtitlesOnly && outgoingFrames > 0 && relativeFrame > durationInFrames - outgoingFrames) {
          const progress = interpolate(relativeFrame, [durationInFrames - outgoingFrames, durationInFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: outgoingEasing,
          });

          if (outParsed.hasFade) {
            transitionOpacity = 1 - progress;
          }
          if (outParsed.hasMove) {
            const endX = outParsed.isLeft ? -100 : (outParsed.isRight ? 100 : 0);
            const endY = outParsed.isUp ? -100 : (outParsed.isDown ? 100 : 0);
            transitionTranslateX = progress * endX;
            transitionTranslateY = progress * endY;
          }
          if (outParsed.isZoom) {
            const endScale = outParsed.isZoomIn ? 1.25 : 0.75;
            transitionScale = 1.0 + (endScale - 1.0) * progress;
            transitionOpacity = 1 - progress;
          }
          if (outParsed.hasBlur) {
            transitionBlur = 14 * progress;
          }
        }

        let videoTransform = '';
        const customZoom = (typeof scene.zoom === 'number' && scene.zoom > 0) ? scene.zoom : ((typeof scene.clipScale === 'number' && scene.clipScale > 0) ? scene.clipScale : 1.0);
        const customOffsetX = (typeof scene.offsetX === 'number') ? scene.offsetX : ((typeof scene.clipOffsetX === 'number') ? scene.clipOffsetX : 0);
        const customOffsetY = (typeof scene.offsetY === 'number') ? scene.offsetY : ((typeof scene.clipOffsetY === 'number') ? scene.clipOffsetY : 0);
        const isZoom = !subtitlesOnly && (scene.transition === 'zoom-in' || scene.transition === 'zoom-out');
        const isShake = !subtitlesOnly && (scene.shake || scene.transition === 'shake');
        const baseScale = isShake ? (1.0 + (scene.shakeIntensity || 15) / 300) : 1.0;
        const zoomScale = isZoom ? (1.0 + 0.1 * (relativeFrame / durationInFrames)) : 1.0;
        
        const scaleVal = subtitlesOnly ? customZoom : (baseScale * zoomScale * transitionScale * customZoom);

        if (isShake) {
          const intensity = scene.shakeIntensity || 15;
          const speed = scene.shakeSpeed || 15;
          const t = relativeFrame / fps;
          const dx = intensity * Math.sin(2 * Math.PI * t * speed);
          const dy = intensity * Math.cos(2 * Math.PI * t * (speed * 1.25));
          videoTransform = `scale(${scaleVal}) translate(calc(${customOffsetX}% + ${dx}px), calc(${customOffsetY}% + ${dy}px))`;
        } else {
          videoTransform = `scale(${scaleVal}) translate(${customOffsetX}%, ${customOffsetY}%)`;
        }

        // Subtitle Word Extraction
        let words = scene.words || [];
        if (words.length === 0 && scene.text) {
          const textWords = scene.text.trim().split(/\s+/).filter(Boolean);
          if (textWords.length > 0) {
            const duration = (scene.end_time || 5) - (scene.start_time || 0);
            const timePerWord = duration / textWords.length;
            words = textWords.map((w, wIdx) => ({
              word: w,
              start_time: (scene.start_time || 0) + wIdx * timePerWord,
              end_time: (scene.start_time || 0) + (wIdx + 1) * timePerWord,
            }));
          }
        }

        const contextOpacity = spring({
          frame: relativeFrame,
          fps,
          config: {
            damping: 15,
            stiffness: 80,
          },
        });

        // If highlightTrigger === 'none', override effectiveSubtitleMode to 'smart-highlight' for non-classic modes
        const effectiveSubtitleMode = (highlightTrigger === 'none' && subtitleMode !== 'classic')
          ? 'smart-highlight'
          : subtitleMode;

        // Position offset calculations matching editor preview
        const vertPercent = 50 - (textPositionY / 2); // e.g. textPositionY=-70 matches bottom: ~15%
        const effectiveVertPercent = hasGraph ? 14 : vertPercent;

        const transitionCaptions = scene.transitionCaptionsWithScene !== undefined
          ? scene.transitionCaptionsWithScene
          : true;

        const captionTranslateX = (transitionCaptions && transitionTranslateX !== 0) ? transitionTranslateX : 0;
        const captionTranslateY = (transitionCaptions && transitionTranslateY !== 0) ? transitionTranslateY : 0;

        let captionTransform = `translateX(${textPositionX}px)`;
        if (captionTranslateX !== 0 || captionTranslateY !== 0) {
          captionTransform += ` translate(${captionTranslateX}%, ${captionTranslateY}%)`;
        }

        // Render Subtitles
        const renderSubtitles = () => {
          if (words.length === 0) return null;

          const subtitleContainerStyle: React.CSSProperties = {
            position: 'absolute',
            left: '5%',
            right: '5%',
            bottom: `${effectiveVertPercent}%`,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            transform: captionTransform,
            opacity: transitionCaptions ? transitionOpacity : 1.0,
            filter: transitionCaptions && transitionBlur > 0 ? `blur(${transitionBlur}px)` : undefined,
            zIndex: 100,
          };

          const relativeTime = currentTime - scene.start_time;

          // Render only the active single word
          if (effectiveSubtitleMode === 'pop' || effectiveSubtitleMode === 'centered-word') {
            const activeWord = words.find(w => 
              (currentTime >= w.start_time && currentTime <= w.end_time) ||
              (relativeTime >= w.start_time && relativeTime <= w.end_time)
            );
            if (!activeWord) return null;

            // Highlight checking
            const category = /[\uD800-\uDFFF\u2600-\u27BF]/.test(activeWord.word) ? 'emoji' : (
              emphasisWords.includes(activeWord.word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")) ? 'highlight' : 'normal'
            );

            let shouldHighlight = highlightTrigger === 'all' || 
              (highlightTrigger === 'emphasis' && category === 'highlight') ||
              (highlightTrigger === 'emoji' && category === 'emoji');

            return (
              <div style={subtitleContainerStyle}>
                <SubtitleWord
                  word={activeWord.word}
                  isActive={shouldHighlight}
                  fontName={fontName}
                  fontSize={fontSize * 1.3}
                  bold={bold}
                  italic={italic}
                  shadow={shadow}
                  shadowColor={shadowColor}
                  shadowBlur={shadowBlur}
                  shadowDistance={shadowDistance}
                  shadowAngle={shadowAngle}
                  shadowOpacity={shadowOpacity}
                  outlineColor={outlineColor}
                  outlineThickness={outlineThickness}
                  letterSpacing={letterSpacing}
                  wordSpacing={wordSpacing}
                  neonGlow={neonGlow}
                  glowColor={glowColor}
                  glowBlur={glowBlurProp}
                  glowDistance={glowDistanceProp}
                  normalStyle={normalStyle}
                  highlightStyle={highlightStyle}
                  emojiStyle={emojiStyle}
                  textCase={textCase}
                  isFirst={false}
                  customColor={activeWord.color}
                  customSize={activeWord.size}
                  customBold={activeWord.bold}
                  customItalic={activeWord.italic}
                />
              </div>
            );
          }

          // Simple mode: Render all words of the scene at once, preserving newlines
          if (effectiveSubtitleMode === 'simple') {
            return (
              <div style={subtitleContainerStyle}>
                {words.map((w, wIdx) => {
                  return (
                    <React.Fragment key={wIdx}>
                      {w.newline && <div style={{ width: '100%', height: 0 }} />}
                      <SubtitleWord
                        word={w.word}
                        isActive={false}
                        fontName={fontName}
                        fontSize={fontSize}
                        bold={bold}
                        italic={italic}
                        shadow={shadow}
                        shadowColor={shadowColor}
                        shadowBlur={shadowBlur}
                        shadowDistance={shadowDistance}
                        shadowAngle={shadowAngle}
                        shadowOpacity={shadowOpacity}
                        outlineColor={outlineColor}
                        outlineThickness={outlineThickness}
                        letterSpacing={letterSpacing}
                        wordSpacing={wordSpacing}
                        neonGlow={neonGlow}
                        glowColor={glowColor}
                        glowBlur={glowBlurProp}
                        glowDistance={glowDistanceProp}
                        normalStyle={normalStyle}
                        highlightStyle={highlightStyle}
                        emojiStyle={emojiStyle}
                        textCase={textCase}
                        isFirst={wIdx === 0}
                        customColor={w.color}
                        customSize={w.size}
                        customBold={w.bold}
                        customItalic={w.italic}
                      />
                    </React.Fragment>
                  );
                })}
              </div>
            );
          }

          // Classic / Smart-Highlight modes: render current word chunk group
          let activeIndex = words.findIndex(w => currentTime >= w.start_time && currentTime <= w.end_time);
          if (activeIndex === -1) {
            activeIndex = words.findIndex(w => relativeTime >= w.start_time && relativeTime <= w.end_time);
          }

          // Hide subtitles if we are past the very last word of this scene
          const lastWordEnd = words[words.length - 1]?.end_time || 0;
          if (words.length > 0 && currentTime > lastWordEnd && relativeTime > lastWordEnd) {
            return null;
          }

          const currentGroupIndex = activeIndex !== -1 ? Math.floor(activeIndex / maxWordsPerLine) : 0;
          const currentGroupWords = highlightTrigger === 'none'
            ? words
            : words.slice(
                currentGroupIndex * maxWordsPerLine,
                (currentGroupIndex + 1) * maxWordsPerLine
              );

          return (
            <div style={subtitleContainerStyle}>
              {currentGroupWords.map((w, wIdx) => {
                const isCurrentActive = activeIndex !== -1 && words[activeIndex].word === w.word && 
                  ((currentTime >= w.start_time && currentTime <= w.end_time) || 
                   (relativeTime >= w.start_time && relativeTime <= w.end_time));

                // Highlight logic matching highlightTrigger and autoEmphasis
                const category = /[\uD800-\uDFFF\u2600-\u27BF]/.test(w.word) ? 'emoji' : (
                  emphasisWords.includes(w.word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")) ? 'highlight' : 'normal'
                );

                let isHighlighted = false;
                if (highlightTrigger !== 'none') {
                  if (isCurrentActive) {
                    isHighlighted = highlightTrigger === 'all' || 
                      (highlightTrigger === 'emphasis' && category === 'highlight') ||
                      (highlightTrigger === 'emoji' && category === 'emoji');
                  } else if (autoEmphasis && category === 'highlight') {
                    isHighlighted = true;
                  }
                }

                return (
                  <SubtitleWord
                    key={wIdx}
                    word={w.word}
                    isActive={isHighlighted}
                    fontName={fontName}
                    fontSize={fontSize}
                    bold={bold}
                    italic={italic}
                    shadow={shadow}
                    shadowColor={shadowColor}
                    shadowBlur={shadowBlur}
                    shadowDistance={shadowDistance}
                    shadowAngle={shadowAngle}
                    shadowOpacity={shadowOpacity}
                    outlineColor={outlineColor}
                    outlineThickness={outlineThickness}
                    letterSpacing={letterSpacing}
                    wordSpacing={wordSpacing}
                    neonGlow={neonGlow}
                    glowColor={glowColor}
                    glowBlur={glowBlurProp}
                    glowDistance={glowDistanceProp}
                    normalStyle={normalStyle}
                    highlightStyle={highlightStyle}
                    emojiStyle={emojiStyle}
                    textCase={textCase}
                    isFirst={wIdx === 0}
                    customColor={w.color}
                    customSize={w.size}
                    customBold={w.bold}
                    customItalic={w.italic}
                  />
                );
              })}
            </div>
          );
        };

        // Resolve custom color adjustments & post-processing filter presets
        const adj = scene.adjustments || {};
        const brightness = adj.brightness !== undefined ? adj.brightness : 1.0;
        const contrast = adj.contrast !== undefined ? adj.contrast : 1.0;
        const saturation = adj.saturation !== undefined ? adj.saturation : 1.0;
        const temperature = adj.temperature !== undefined ? adj.temperature : 0;
        const hueRotate = adj.hueRotate !== undefined ? adj.hueRotate : 0;
        const blur = adj.blur !== undefined ? adj.blur : 0;
        const sepia = adj.sepia !== undefined ? adj.sepia : 0.0;
        const grayscale = adj.grayscale !== undefined ? adj.grayscale : 0.0;
        const invert = adj.invert !== undefined ? adj.invert : 0.0;

        const filterParts: string[] = [];
        if (brightness !== 1.0) filterParts.push(`brightness(${brightness})`);
        if (contrast !== 1.0) filterParts.push(`contrast(${contrast})`);
        if (saturation !== 1.0) filterParts.push(`saturate(${saturation})`);

        // Temperature (Warm Gold vs Cool Cyan)
        if (temperature > 0) {
          const warmSepia = (temperature / 100) * 0.45;
          filterParts.push(`sepia(${warmSepia.toFixed(3)})`);
        } else if (temperature < 0) {
          const coolHue = (temperature / 100) * 22;
          filterParts.push(`hue-rotate(${coolHue.toFixed(1)}deg)`);
        }

        // Hue Shift (Color Wheel Spectrum)
        if (hueRotate !== 0) filterParts.push(`hue-rotate(${hueRotate}deg)`);

        if (blur > 0) filterParts.push(`blur(${blur}px)`);
        if (sepia > 0) filterParts.push(`sepia(${sepia})`);
        if (grayscale > 0) filterParts.push(`grayscale(${grayscale})`);
        if (invert > 0) filterParts.push(`invert(${invert})`);

        if (!subtitlesOnly && scene.clipId !== 'original') {
          if (scene.postProcessingPreset === 'vintage_sepia') {
            filterParts.push('sepia(0.55) contrast(1.1) brightness(0.95) saturate(0.85)');
          } else if (scene.postProcessingPreset === 'cyber_neon') {
            filterParts.push('contrast(1.15) saturate(1.45) hue-rotate(5deg)');
          } else if (scene.postProcessingPreset === 'noir_monochrome') {
            filterParts.push('grayscale(1) contrast(1.3) brightness(0.95)');
          } else if (scene.postProcessingPreset === 'cinematic_warm') {
            filterParts.push('saturate(1.1) sepia(0.12) contrast(1.05) brightness(0.98)');
          }
        }

        let filterStyle = filterParts.length > 0 ? filterParts.join(' ') : 'none';

        return (
          <Sequence
            key={idx}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={90}
            postmountFor={90}
          >
            <AbsoluteFill style={{ 
              overflow: 'hidden',
              transform: (transitionTranslateX !== 0 || transitionTranslateY !== 0) 
                ? `translate(${transitionTranslateX}%, ${transitionTranslateY}%)` 
                : undefined
            }}>
              {/* Color-graded Cinematic Container */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  filter: transitionBlur > 0
                    ? (filterStyle === 'none' ? `blur(${transitionBlur}px)` : `${filterStyle} blur(${transitionBlur}px)`)
                    : filterStyle,
                  opacity: (hasGraph && (!scene.layout || scene.layout === 'graph')) ? brollOpacity * transitionOpacity : transitionOpacity,
                }}
              >
                {/* B-Roll Video Element */}
                {clipUrl && (
                  <div 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      transform: videoTransform, 
                      opacity: 1.0,
                    }}
                  >
                    {(() => {
                      const isReversed = !!scene.reverse;
                      const rawClipStart = (scene.clipId === 'original' && scene.clipStart === undefined) 
                        ? (scene.start_time || 0) 
                        : (scene.clipStart !== undefined ? scene.clipStart : 0);
                      const sceneDur = Math.max(0.5, (scene.end_time || 0) - (scene.start_time || 0));
                      const baseSpeed = Math.abs(scene.speed || 1.0);

                      const directClipSrc = resolveAssetUrl(clipUrl, baseUrl, isRendering);

                      const prevScene = idx > 0 ? scenes[idx - 1] : null;
                      const prevDur = prevScene ? Math.max(0.5, (prevScene.end_time || 0) - (prevScene.start_time || 0)) : sceneDur;
                      const targetSliceDur = scene.reverseTarget === 'prev' ? prevDur : sceneDur;

                      const effectiveSrc = isReversed
                        ? resolveAssetUrl(`/api/reverse-video?clipId=${scene.clipId || 'original'}&videoUrl=${encodeURIComponent(clipUrl || '')}&start=${rawClipStart}&duration=${targetSliceDur}&revKey=v10_${scene.clipId}_${rawClipStart}_${targetSliceDur}`, baseUrl, isRendering)
                        : directClipSrc;

                      const effectiveStartFrom = isReversed ? 0 : Math.round(rawClipStart * fps);

                      return isRendering ? (
                        <OffthreadVideo
                          src={effectiveSrc}
                          startFrom={effectiveStartFrom}
                          playbackRate={baseSpeed}
                          volume={subtitlesOnly ? 1.0 : videoVolume}
                          crossOrigin="anonymous"
                          pauseWhenBuffering={isRendering ? true : false}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: fillMode === 'crop' ? 'cover' : 'contain',
                          }}
                          onError={(error) => {
                            console.error("Remotion Video Error:", error);
                            const targetPort = 8000;
                            const backendUrl = window.location.port 
                              ? `${window.location.protocol}//${window.location.hostname}:${targetPort}`
                              : window.location.origin;
                            fetch(`${backendUrl}/api/log-client-error`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                error: error?.toString() || 'HTML5 Video Error',
                                message: `Failed to load video clip ${scene.clipId} for Scene ${idx} (URL: ${effectiveSrc})`,
                                stack: error?.stack || new Error().stack,
                                component: 'VideoReel-VideoComponent'
                              })
                            }).catch(err => console.error("Failed to report video error to backend:", err));
                            return 'fallback';
                          }}
                        />
                      ) : (
                        <Video
                          src={effectiveSrc}
                          startFrom={effectiveStartFrom}
                          playbackRate={baseSpeed}
                          volume={subtitlesOnly ? 1.0 : videoVolume}
                          crossOrigin={isRendering ? "anonymous" : undefined}
                          pauseWhenBuffering={isRendering ? true : false}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: fillMode === 'crop' ? 'cover' : 'contain',
                          }}
                        />
                      );
                    })()}
                  </div>
                )}

                {/* Dynamic Layout Overlays */}
                {(() => {
                  const effectiveCardPositionY = (!applyHUDToAll && scene.layoutProps?.cardPositionY !== undefined)
                    ? Number(scene.layoutProps.cardPositionY) 
                    : cardPositionY;
                  const effectiveCardScale = (!applyHUDToAll && scene.layoutProps?.cardScale !== undefined)
                    ? Number(scene.layoutProps.cardScale) 
                    : cardScale;

                  return (
                    <>
                      {showLayoutCards && scene.layout === 'quote' && (
                        <QuoteCard
                          quoteText={scene.layoutProps?.quoteText || ''}
                          quoteAuthor={scene.layoutProps?.quoteAuthor}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'versus' && (
                        <VersusLayout
                          versusLeft={mergedVersusLeft}
                          versusRight={mergedVersusRight}
                          versusLabel={mergedVersusLabel}
                          versusLeftFeatures={mergedVersusLeftFeatures}
                          versusRightFeatures={mergedVersusRightFeatures}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                          rightBlurredMode={rightBlurredMode}
                          durationInFrames={durationInFrames}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'stat_callout' && (
                        <StatCallout
                          statValue={scene.layoutProps?.statValue || ''}
                          statLabel={scene.layoutProps?.statLabel}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'timeline_checkpoint' && (
                        <TimelineCheckpoint
                          timelineDate={scene.layoutProps?.timelineDate || ''}
                          timelineLabel={scene.layoutProps?.timelineLabel}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'danger_callout' && (
                        <DangerCallout
                          dangerTitle={scene.layoutProps?.dangerTitle}
                          dangerText={scene.layoutProps?.dangerText || ''}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'progress_ratio' && (
                        <ProgressRatio
                          progressValue={scene.layoutProps?.progressValue || 0}
                          progressLabel={scene.layoutProps?.progressLabel}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'pro_tip' && (
                        <ProTip
                          tipTitle={scene.layoutProps?.tipTitle}
                          tipText={scene.layoutProps?.tipText || ''}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'versus_meter' && (
                        <VersusMeter
                          meterLeft={scene.layoutProps?.meterLeft || ''}
                          meterRight={scene.layoutProps?.meterRight || ''}
                          meterValue={scene.layoutProps?.meterValue || 50}
                          meterLabel={scene.layoutProps?.meterLabel}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                      {showLayoutCards && scene.layout === 'tier_list_ranker' && (
                        <TierListRanker
                          tierRank={scene.layoutProps?.tierRank || 'S'}
                          tierItem={scene.layoutProps?.tierItem || ''}
                          tierLabel={scene.layoutProps?.tierLabel}
                          brandPrimaryColor={brandPrimaryColor}
                          brandSecondaryColor={brandSecondaryColor}
                          width={width}
                          height={height}
                          fontName={fontName}
                          cardPositionY={effectiveCardPositionY}
                          cardScale={effectiveCardScale}
                          cardFontName={cardFontName}
                        />
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Optional Neon / Cyber Vignette Overlay */}
              {!subtitlesOnly && scene.postProcessingPreset === 'cyber_neon' && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, transparent 40%, rgba(191, 85, 236, 0.15) 100%)',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                    zIndex: 15,
                  }}
                />
              )}

              {/* Scene SFX */}
              {!subtitlesOnly && scene.sfx && scene.sfx !== 'none' && (
                <Audio
                  src={resolveAssetUrl(`/uploads/sfx/${scene.sfx.endsWith('.mp3') ? scene.sfx : `${scene.sfx}.mp3`}`, baseUrl)}
                  volume={sfxVolume}
                  crossOrigin="anonymous"
                />
              )}

              {/* Ambient Soundscape Loop */}
              {!subtitlesOnly && scene.ambientSoundscape && scene.ambientSoundscape !== 'none' && (
                <Audio
                  src={resolveAssetUrl(`/uploads/sfx/${scene.ambientSoundscape}.mp3`, baseUrl)}
                  volume={bgMusicVolume * 0.4}
                  loop
                  crossOrigin="anonymous"
                />
              )}

              {/* Subtitles Overlay */}
              {renderSubtitles()}

              {/* Story Graph Context Card (On-Screen Caption) */}
              {scene.graphContext && hasGraph && (
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '68%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(10, 15, 28, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '8px 20px',
                  borderRadius: '24px',
                  color: '#FFFFFF',
                  fontSize: '20px',
                  fontFamily: fontName || 'Montserrat',
                  fontWeight: 600,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 90,
                  textAlign: 'center',
                  maxWidth: '85%',
                  opacity: transitionCaptions ? (contextOpacity * transitionOpacity) : contextOpacity,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}>
                  {scene.graphContext}
                </div>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
