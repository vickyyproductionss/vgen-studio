import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface DangerCalloutProps {
  dangerTitle?: string;
  dangerText: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

export const DangerCallout: React.FC<DangerCalloutProps> = ({
  dangerTitle = 'WARNING',
  dangerText,
  brandPrimaryColor = '#e11d48', // default warning red
  brandSecondaryColor = '#fbbf24', // default warning amber
  fontName,
  cardPositionY = 0,
  cardScale = 1.0,
  cardFontName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryAnim = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const activeFont = cardFontName || fontName || 'Outfit, -apple-system, sans-serif';
  const pulseScale = 1 + 0.02 * Math.sin((frame * Math.PI) / 15); // Pulsing border effect

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
          background: 'linear-gradient(135deg, rgba(28, 10, 10, 0.7) 0%, rgba(12, 5, 5, 0.85) 100%)',
          border: `2px solid ${brandPrimaryColor}`,
          borderRadius: 20,
          padding: '32px 24px',
          boxShadow: `0 8px 45px rgba(225, 29, 72, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)`,
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          transform: `scale(${pulseScale})`,
          transition: 'border-color 0.3s ease',
        }}
      >
        {/* Glow behind warning indicator */}
        <div
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            background: `radial-gradient(circle, ${brandPrimaryColor}33 0%, transparent 70%)`,
            filter: 'blur(15px)',
            zIndex: -1,
            top: -20,
          }}
        />

        {/* Warning Icon SVG */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${brandPrimaryColor} 0%, ${brandSecondaryColor} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 25px ${brandPrimaryColor}66`,
            marginBottom: 16,
          }}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Danger Title */}
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 32,
            fontWeight: '900',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: '0 0 12px 0',
            textShadow: `0 0 12px ${brandPrimaryColor}aa`,
            fontFamily: activeFont,
          }}
        >
          {dangerTitle}
        </h2>

        {/* Divider line */}
        <div
          style={{
            width: 80,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, transparent)`,
            marginBottom: 16,
          }}
        />

        {/* Warning Description */}
        <p
          style={{
            color: '#FFDDDD',
            fontSize: 20,
            fontWeight: '700',
            lineHeight: 1.4,
            margin: 0,
            fontFamily: activeFont,
          }}
        >
          {dangerText}
        </p>
      </div>
    </div>
  );
};
