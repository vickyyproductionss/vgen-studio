import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface TimelineCheckpointProps {
  timelineDate: string;
  timelineLabel?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

export const TimelineCheckpoint: React.FC<TimelineCheckpointProps> = ({
  timelineDate,
  timelineLabel = 'Key Event',
  brandPrimaryColor = '#d4af37',
  brandSecondaryColor = '#f5e6a3',
  fontName,
  cardPositionY = 0,
  cardScale = 1.0,
  cardFontName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineAnim = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 70, mass: 1.0 },
  });

  const nodeAnim = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
  });

  const cardAnim = spring({
    frame: Math.max(0, frame - 14),
    fps,
    config: { damping: 15, stiffness: 90, mass: 0.9 },
  });

  const cardOffset = 40 * (1 - cardAnim);
  const cardOpacity = Math.min(1, cardAnim * 1.5);
  const activeFont = cardFontName || fontName || 'Outfit, -apple-system, sans-serif';

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: `${cardPositionY}%`,
        width: '100%',
        height: '65%',
        zIndex: 20,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 40,
        fontFamily: activeFont,
        transform: `scale(${cardScale})`,
      }}
    >
      {/* Milestone Detail Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.55) 0%, rgba(10, 10, 12, 0.7) 100%)',
          border: '1.5px solid rgba(212, 175, 55, 0.2)',
          borderBottom: `2.5px solid ${brandPrimaryColor}`,
          borderRadius: 18,
          padding: '22px 30px',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          transform: `translateY(${cardOffset}px)`,
          opacity: cardOpacity,
          marginBottom: 20,
          zIndex: 10,
          position: 'relative' as const,
          overflow: 'hidden' as const,
        }}
      >
        {/* Top gold edge */}
        <div style={{ position: 'absolute', top: 0, left: '10%', width: '80%', height: 2, background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, transparent)`, boxShadow: `0 0 12px ${brandPrimaryColor}99`, borderRadius: 1 }} />

        <span
          style={{
            color: brandPrimaryColor,
            fontSize: 20,
            fontWeight: '900',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: 6,
            textShadow: `0 0 8px ${brandPrimaryColor}80`,
            fontFamily: activeFont,
          }}
        >
          {timelineDate}
        </span>
        <h3
          style={{
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: '800',
            margin: 0,
            letterSpacing: '0.02em',
            fontFamily: activeFont,
          }}
        >
          {timelineLabel}
        </h3>
      </div>

      {/* Vertical Pointer Line */}
      <div
        style={{
          width: 2,
          height: 35,
          background: `linear-gradient(180deg, ${brandPrimaryColor}, ${brandSecondaryColor})`,
          opacity: nodeAnim,
          transformOrigin: 'bottom',
          transform: `scaleY(${nodeAnim})`,
          marginBottom: -1,
        }}
      />

      {/* Horizontal Timeline Track */}
      <div
        style={{
          position: 'relative',
          width: '85%',
          height: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: 3,
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: 1.5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${lineAnim * 100}%`,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, ${brandSecondaryColor}, transparent)`,
            borderRadius: 1.5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            transform: `scale(${nodeAnim})`,
            opacity: nodeAnim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: brandPrimaryColor,
              border: '2.5px solid #FFFFFF',
              boxShadow: `0 0 12px ${brandPrimaryColor}`,
              zIndex: 5,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: `${brandPrimaryColor}4d`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
