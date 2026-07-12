import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface StoryNodeProps {
  id: string;
  name: string;
  type: 'character' | 'object' | 'concept' | 'organization' | 'location' | string;
  x: number; // 0 - 100 percentage of canvas width
  y: number; // 0 - 100 percentage of canvas height
  active: boolean; // highlighted state
  entryFrame: number;
  hasActiveNode?: boolean;
  focusProgress?: number;
}

export const StoryNode: React.FC<StoryNodeProps> = ({
  id,
  name,
  type,
  x,
  y,
  active,
  entryFrame,
  hasActiveNode = false,
  focusProgress,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - entryFrame;
  if (relativeFrame < 0) {
    return null;
  }

  // Calculate spring scale for entry animation
  const entryScale = spring({
    frame: relativeFrame,
    fps,
    config: {
      damping: 14,
      mass: 0.8,
      stiffness: 120,
    },
  });

  // Calculate gentle breathing pulse if active, scale down if inactive and another node is active
  const baseScaleMultiplier = active
    ? 1.0 + Math.sin((frame - entryFrame) * 0.12) * 0.05
    : (hasActiveNode ? 0.85 : 1.0);

  // Interpolate scale based on focusProgress (out-of-focus scale is 0.6)
  const scaleMultiplier = focusProgress !== undefined
    ? (0.6 * (1 - focusProgress) + baseScaleMultiplier * focusProgress)
    : baseScaleMultiplier;

  const finalScale = entryScale * scaleMultiplier;

  // Gently float up and down to look alive
  const floatOffsetY = Math.sin((frame + id.charCodeAt(0) * 5) * 0.05) * 3;

  // Determine glow and accent colors based on entity type
  let accentColor = '#00f2fe'; // Default electric cyan
  let iconGlowColor = 'rgba(0, 242, 254, 0.4)';

  switch (type) {
    case 'character':
      accentColor = '#00f2fe'; // Cyan
      iconGlowColor = 'rgba(0, 242, 254, 0.35)';
      break;
    case 'object':
      accentColor = '#bf55ec'; // Violet/Purple
      iconGlowColor = 'rgba(191, 85, 236, 0.35)';
      break;
    case 'concept':
      accentColor = '#f39c12'; // Yellow/Orange
      iconGlowColor = 'rgba(243, 156, 18, 0.35)';
      break;
    case 'organization':
      accentColor = '#2ecc71'; // Neon Green
      iconGlowColor = 'rgba(46, 204, 113, 0.35)';
      break;
    case 'location':
      accentColor = '#ff4757'; // Coral Red
      iconGlowColor = 'rgba(255, 71, 87, 0.35)';
      break;
  }

  // Render node icon based on type
  const renderIcon = () => {
    switch (type) {
      case 'character':
        return (
          <svg viewBox="0 0 100 100" style={{ width: 50, height: 50 }}>
            {/* Minimalist Head and Shoulders */}
            <circle cx="50" cy="35" r="18" fill="none" stroke="#FFFFFF" strokeWidth="4" />
            <path d="M20,80 C20,60 30,55 50,55 C70,55 80,60 80,80" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={accentColor} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.7" />
          </svg>
        );
      case 'object':
        return (
          <svg viewBox="0 0 100 100" style={{ width: 50, height: 50 }}>
            {/* Isometric Gadget / Smartphone */}
            <rect x="30" y="20" width="40" height="60" rx="6" fill="none" stroke="#FFFFFF" strokeWidth="4" transform="rotate(-10 50 50)" />
            <line x1="40" y1="28" x2="60" y2="28" stroke="#FFFFFF" strokeWidth="3" transform="rotate(-10 50 50)" />
            <circle cx="50" cy="72" r="4" fill="#FFFFFF" transform="rotate(-10 50 50)" />
            <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="none" stroke={accentColor} strokeWidth="1" opacity="0.3" />
          </svg>
        );
      case 'concept':
        return (
          <svg viewBox="0 0 100 100" style={{ width: 50, height: 50 }}>
            {/* Futuristic Concentric Gear/Idea Circles */}
            <circle cx="50" cy="50" r="28" fill="none" stroke="#FFFFFF" strokeWidth="4" />
            <circle cx="50" cy="50" r="12" fill="none" stroke="#FFFFFF" strokeWidth="3" />
            {/* Outer Ray Dashes */}
            <circle cx="50" cy="50" r="42" fill="none" stroke={accentColor} strokeWidth="2.5" strokeDasharray="6,8" />
            <line x1="50" y1="8" x2="50" y2="20" stroke="#FFFFFF" strokeWidth="3" />
            <line x1="50" y1="80" x2="50" y2="92" stroke="#FFFFFF" strokeWidth="3" />
          </svg>
        );
      case 'organization':
        return (
          <svg viewBox="0 0 100 100" style={{ width: 50, height: 50 }}>
            {/* Clean architectural Columns / Building */}
            <path d="M15,85 L85,85 M20,85 L20,35 L80,35 L80,85 M35,85 L35,35 M50,85 L50,35 M65,85 L65,35" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
            <polygon points="12,35 50,15 88,35" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" />
            <rect x="8" y="10" width="84" height="80" fill="none" stroke={accentColor} strokeWidth="1" strokeDasharray="3,6" opacity="0.4" />
          </svg>
        );
      case 'location':
        return (
          <svg viewBox="0 0 100 100" style={{ width: 50, height: 50 }}>
            {/* Minimalist Map Pin & Target */}
            <path d="M50,15 C32,15 20,28 20,48 C20,70 50,88 50,88 C50,88 80,70 80,48 C80,28 68,15 50,15 Z" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" />
            <circle cx="50" cy="45" r="10" fill="none" stroke="#FFFFFF" strokeWidth="3" />
            <ellipse cx="50" cy="88" rx="20" ry="6" fill="none" stroke={accentColor} strokeWidth="2" opacity="0.5" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 100 100" style={{ width: 50, height: 50 }}>
            {/* Default Diamond Node */}
            <polygon points="50,15 85,50 50,85 15,50" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" />
            <circle cx="50" cy="50" r="12" fill={accentColor} />
          </svg>
        );
    }
  };

  const baseOpacity = !active && hasActiveNode ? 0.7 : 1.0;
  const opacity = focusProgress !== undefined
    ? (0.25 * (1 - focusProgress) + baseOpacity * focusProgress)
    : baseOpacity;

  const baseBlur = 0; // Keep all text perfectly sharp in wide/static views
  const blurAmount = focusProgress !== undefined
    ? (2.8 * (1 - focusProgress) + baseBlur * focusProgress)
    : baseBlur;

  const blurFilter = blurAmount > 0 ? `blur(${blurAmount}px)` : 'none';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translate(0, ${floatOffsetY}px) scale(${finalScale})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: active ? 20 : 10,
        filter: blurFilter,
        opacity: opacity,
        transition: 'z-index 0.2s ease, filter 0.3s ease, opacity 0.3s ease',
      }}
    >
      {/* Glow Effect Aura */}
      <div
        style={{
          position: 'absolute',
          width: 85,
          height: 85,
          borderRadius: '50%',
          background: active
            ? `radial-gradient(circle, ${accentColor} 0%, rgba(0,0,0,0) 70%)`
            : `radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0) 65%)`,
          filter: 'blur(8px)',
          opacity: active ? 0.9 : 0.4,
          transition: 'all 0.3s ease-out',
          zIndex: -1,
        }}
      />

      {/* Main Node Circular Plate */}
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: '50%',
          background: active ? 'rgba(26, 36, 54, 0.95)' : 'rgba(15, 23, 42, 0.85)',
          border: `2px solid ${active ? accentColor : 'rgba(255, 255, 255, 0.3)'}`,
          boxShadow: active
            ? `0 0 20px ${iconGlowColor}, inset 0 0 10px rgba(255,255,255,0.05)`
            : '0 4px 12px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(5px)',
        }}
      >
        {renderIcon()}
      </div>

      {/* Glassmorphic Name Tag Badge */}
      <div
        style={{
          marginTop: 10,
          padding: '4px 12px',
          background: active ? 'rgba(26, 36, 54, 0.9)' : 'rgba(15, 23, 42, 0.75)',
          border: `1.5px solid ${active ? accentColor : 'rgba(255, 255, 255, 0.15)'}`,
          borderRadius: 20,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          color: '#FFFFFF',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: active ? '700' : '500',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          textShadow: active ? `0 0 6px ${accentColor}` : 'none',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {name}
      </div>
    </div>
  );
};
