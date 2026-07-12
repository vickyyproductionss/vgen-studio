import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface QuoteCardProps {
  quoteText: string;
  quoteAuthor?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({
  quoteText,
  quoteAuthor = 'Anonymous',
  brandPrimaryColor = '#d4af37',
  brandSecondaryColor = '#f5e6a3',
  fontName,
  cardPositionY = 0,
  cardScale = 1.0,
  cardFontName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const translateY = spring({
    frame,
    fps,
    config: { damping: 15, mass: 0.9, stiffness: 90 },
  });

  const offset = 120 * (1 - translateY);
  const opacity = Math.min(1, translateY * 1.5);
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
        transform: `scale(${cardScale})`,
      }}
    >
      <div
        style={{
          width: '85%',
          maxWidth: 600,
          background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.55) 0%, rgba(10, 10, 12, 0.7) 100%)',
          border: '1.5px solid rgba(212, 175, 55, 0.2)',
          borderRadius: 18,
          padding: '35px 40px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          transform: `translateY(${offset}px)`,
          opacity,
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          textAlign: 'center' as const,
          position: 'relative' as const,
          overflow: 'hidden' as const,
        }}
      >
        {/* Top gold edge line */}
        <div style={{ position: 'absolute', top: 0, left: '10%', width: '80%', height: 2, background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, transparent)`, boxShadow: `0 0 12px ${brandPrimaryColor}99`, borderRadius: 1 }} />
        {/* Bottom gold edge line */}
        <div style={{ position: 'absolute', bottom: 0, left: '10%', width: '80%', height: 2, background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, transparent)`, boxShadow: `0 0 12px ${brandPrimaryColor}99`, borderRadius: 1 }} />

        {/* Quote Mark */}
        <div
          style={{
            fontSize: 84,
            lineHeight: 0.8,
            color: brandPrimaryColor,
            opacity: 0.7,
            marginBottom: -5,
            fontFamily: 'Georgia, serif',
            textShadow: `0 0 15px ${brandPrimaryColor}66`,
          }}
        >
          "
        </div>

        {/* Quote Text */}
        <p
          style={{
            color: '#FFFFFF',
            fontSize: 30,
            fontWeight: '600',
            lineHeight: 1.45,
            margin: '10px 0 20px 0',
            fontStyle: 'italic',
            letterSpacing: '0.02em',
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
            fontFamily: activeFont,
          }}
        >
          {quoteText}
        </p>

        {/* Gold Divider */}
        <div
          style={{
            width: 60,
            height: 2,
            background: `linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)`,
            borderRadius: 1,
            marginBottom: 16,
          }}
        />

        {/* Quote Author */}
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.55)',
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: activeFont,
          }}
        >
          — {quoteAuthor}
        </span>
      </div>
    </div>
  );
};
