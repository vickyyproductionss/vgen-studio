import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface ProTipProps {
  tipTitle?: string;
  tipText: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

export const ProTip: React.FC<ProTipProps> = ({
  tipTitle = 'PRO TIP',
  tipText,
  brandPrimaryColor = '#06b6d4', // neon cyan
  brandSecondaryColor = '#eab308', // gold/yellow
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
          background: 'linear-gradient(135deg, rgba(8, 28, 36, 0.65) 0%, rgba(4, 12, 18, 0.8) 100%)',
          border: `2px solid ${brandPrimaryColor}`,
          borderRadius: 20,
          padding: '30px 24px',
          boxShadow: `0 8px 40px rgba(6, 182, 212, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)`,
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Glow behind lightbulb icon */}
        <div
          style={{
            position: 'absolute',
            width: 130,
            height: 130,
            background: `radial-gradient(circle, ${brandPrimaryColor}2b 0%, transparent 70%)`,
            filter: 'blur(15px)',
            zIndex: -1,
            top: -15,
          }}
        />

        {/* Floating Lightbulb Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${brandPrimaryColor} 0%, ${brandSecondaryColor} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 25px ${brandPrimaryColor}66`,
            marginBottom: 14,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
        </div>

        {/* Tip Title */}
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: '900',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            margin: '0 0 10px 0',
            textShadow: `0 0 12px ${brandPrimaryColor}aa`,
            fontFamily: activeFont,
          }}
        >
          {tipTitle}
        </h2>

        {/* Divider */}
        <div
          style={{
            width: 70,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, transparent)`,
            marginBottom: 14,
          }}
        />

        {/* Tip Text */}
        <p
          style={{
            color: '#E0F2FE',
            fontSize: 19,
            fontWeight: '700',
            lineHeight: 1.45,
            margin: 0,
            fontFamily: activeFont,
          }}
        >
          {tipText}
        </p>
      </div>
    </div>
  );
};
