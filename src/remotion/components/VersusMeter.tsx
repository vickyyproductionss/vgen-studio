import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface VersusMeterProps {
  meterLeft: string;
  meterRight: string;
  meterValue: string | number;
  meterLabel?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

export const VersusMeter: React.FC<VersusMeterProps> = ({
  meterLeft,
  meterRight,
  meterValue,
  meterLabel = 'Head-To-Head',
  brandPrimaryColor = '#d4af37',
  brandSecondaryColor = '#f5e6a3',
  fontName,
  cardPositionY = 0,
  cardScale = 1.0,
  cardFontName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Parsing left-side percentage
  const parsedVal = typeof meterValue === 'number'
    ? meterValue
    : parseFloat(String(meterValue).replace(/[^\d.]/g, '')) || 50;

  const targetLeftPercent = Math.min(100, Math.max(0, parsedVal));
  const targetRightPercent = 100 - targetLeftPercent;

  const entryAnim = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.95 },
  });

  const meterFillAnim = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 60, mass: 1.05 },
  });

  const activeFont = cardFontName || fontName || 'Outfit, -apple-system, sans-serif';

  // Animate the needle / slider position
  const currentLeftWidth = 50 + (targetLeftPercent - 50) * meterFillAnim;
  const currentRightWidth = 100 - currentLeftWidth;

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
          width: '86%',
          maxWidth: 520,
          background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.6) 0%, rgba(10, 10, 12, 0.75) 100%)',
          border: '1.5px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 22,
          padding: '32px 24px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {/* Label Header */}
        {meterLabel && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span
              style={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 14,
                fontWeight: '800',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontFamily: activeFont,
              }}
            >
              {meterLabel}
            </span>
          </div>
        )}

        {/* Row for Contenders and Values */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          {/* Left Contender */}
          <div style={{ flex: 1, textAlign: 'left' }}>
            <span
              style={{
                color: brandPrimaryColor,
                fontSize: 22,
                fontWeight: '900',
                textTransform: 'uppercase',
                display: 'block',
                fontFamily: activeFont,
              }}
            >
              {meterLeft}
            </span>
            <span style={{ fontSize: 32, fontWeight: '900', color: '#FFFFFF', fontFamily: activeFont }}>
              {Math.round(currentLeftWidth)}%
            </span>
          </div>

          {/* VS Center Indicator */}
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: 14,
              fontStyle: 'italic',
              letterSpacing: '0.04em',
              fontFamily: activeFont,
            }}
          >
            VS
          </div>

          {/* Right Contender */}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <span
              style={{
                color: brandSecondaryColor,
                fontSize: 22,
                fontWeight: '900',
                textTransform: 'uppercase',
                display: 'block',
                fontFamily: activeFont,
              }}
            >
              {meterRight}
            </span>
            <span style={{ fontSize: 32, fontWeight: '900', color: '#FFFFFF', fontFamily: activeFont }}>
              {Math.round(currentRightWidth)}%
            </span>
          </div>
        </div>

        {/* Balance Meter Slider Track */}
        <div
          style={{
            height: 24,
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Left Fill */}
          <div
            style={{
              width: `${currentLeftWidth}%`,
              height: '100%',
              background: brandPrimaryColor,
              boxShadow: `inset 0 0 12px ${brandPrimaryColor}aa`,
              transition: 'width 0.1s ease',
            }}
          />

          {/* Right Fill */}
          <div
            style={{
              width: `${currentRightWidth}%`,
              height: '100%',
              background: brandSecondaryColor,
              boxShadow: `inset 0 0 12px ${brandSecondaryColor}aa`,
              transition: 'width 0.1s ease',
            }}
          />

          {/* Divider Needle pin */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `calc(${currentLeftWidth}% - 3px)`,
              width: 6,
              height: '100%',
              background: '#FFFFFF',
              boxShadow: '0 0 10px rgba(0,0,0,0.8), 0 0 4px #FFFFFF',
              zIndex: 5,
            }}
          />
        </div>
      </div>
    </div>
  );
};
