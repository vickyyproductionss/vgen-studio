import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface ProgressRatioProps {
  progressValue: string | number;
  progressLabel?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

export const ProgressRatio: React.FC<ProgressRatioProps> = ({
  progressValue,
  progressLabel = 'Progress Meter',
  brandPrimaryColor = '#3b82f6', // blue
  brandSecondaryColor = '#10b981', // green/emerald
  fontName,
  cardPositionY = 0,
  cardScale = 1.0,
  cardFontName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Parsing percentage value
  const numericVal = typeof progressValue === 'number' 
    ? progressValue 
    : parseFloat(String(progressValue).replace(/[^\d.]/g, '')) || 0;
  
  const targetPercent = Math.min(100, Math.max(0, numericVal));

  const entryAnim = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 90, mass: 0.95 },
  });

  const barFillAnim = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 50, mass: 1.1 },
  });

  const countProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60, mass: 1.0 },
  });

  const activeFont = cardFontName || fontName || 'Outfit, -apple-system, sans-serif';
  const currentPercent = Math.round(targetPercent * countProgress);
  const currentBarWidth = targetPercent * barFillAnim;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: `${cardPositionY}%`,
        width: '100%',
        height: '65%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        pointerEvents: 'none',
        fontFamily: activeFont,
        transform: `scale(${cardScale * entryAnim})`,
        opacity: Math.min(1, entryAnim * 1.5),
      }}
    >
      <div
        style={{
          width: '84%',
          maxWidth: 500,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(8, 12, 24, 0.75) 100%)',
          border: '1.5px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: '36px 28px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {/* Title / Description */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: 16,
              fontWeight: '800',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: activeFont,
            }}
          >
            {progressLabel}
          </span>
          <span
            style={{
              fontSize: 36,
              fontWeight: '900',
              color: brandSecondaryColor,
              textShadow: `0 0 12px ${brandSecondaryColor}55`,
              fontFamily: activeFont,
            }}
          >
            {currentPercent}%
          </span>
        </div>

        {/* Progress Bar Track */}
        <div
          style={{
            height: 18,
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 9,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Filled Bar */}
          <div
            style={{
              width: `${currentBarWidth}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${brandPrimaryColor} 0%, ${brandSecondaryColor} 100%)`,
              borderRadius: 8,
              boxShadow: `0 0 16px ${brandSecondaryColor}`,
              position: 'relative',
            }}
          />
        </div>

        {/* Dynamic Glow Line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '10%',
            width: '80%',
            height: 2,
            background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, ${brandSecondaryColor}, transparent)`,
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
};
