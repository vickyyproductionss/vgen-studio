import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface TierListRankerProps {
  tierRank: string;
  tierItem: string;
  tierLabel?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

// Map tier rank letters to their corresponding theme colors
const getTierColor = (rank: string): string => {
  const cleanRank = String(rank).trim().toUpperCase();
  switch (cleanRank) {
    case 'S': return '#ef4444'; // red
    case 'A': return '#f97316'; // orange
    case 'B': return '#f59e0b'; // amber
    case 'C': return '#eab308'; // yellow
    case 'D': return '#84cc16'; // lime
    case 'E': return '#10b981'; // emerald
    case 'F': return '#3b82f6'; // blue
    default: return '#8b5cf6';  // purple fallback
  };
};

export const TierListRanker: React.FC<TierListRankerProps> = ({
  tierRank,
  tierItem,
  tierLabel = 'Tier List Ranking',
  brandPrimaryColor = '#d4af37',
  brandSecondaryColor = '#f5e6a3',
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

  const stampAnim = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
  });

  const activeFont = cardFontName || fontName || 'Outfit, -apple-system, sans-serif';
  const cleanRank = String(tierRank).trim().toUpperCase().charAt(0) || 'S';
  const tierColor = getTierColor(cleanRank);

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
          maxWidth: 480,
          background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.6) 0%, rgba(10, 10, 12, 0.75) 100%)',
          border: '1.5px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: '30px 24px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          position: 'relative',
        }}
      >
        {/* Tier Stamp / Badge */}
        <div
          style={{
            transform: `scale(${1.8 - 0.8 * stampAnim}) rotate(${-15 * (1 - stampAnim)}deg)`,
            opacity: stampAnim,
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: tierColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 25px ${tierColor}88, 0 4px 15px rgba(0,0,0,0.4)`,
              border: '3px solid #FFFFFF',
            }}
          >
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 48,
                fontWeight: '950',
                fontFamily: activeFont,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {cleanRank}
            </span>
          </div>
        </div>

        {/* Content Column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: 13,
              fontWeight: '800',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 4,
              fontFamily: activeFont,
            }}
          >
            {tierLabel}
          </span>
          <h2
            style={{
              color: '#FFFFFF',
              fontSize: 26,
              fontWeight: '900',
              textTransform: 'uppercase',
              margin: 0,
              letterSpacing: '0.02em',
              fontFamily: activeFont,
              lineHeight: 1.25,
            }}
          >
            {tierItem}
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 6,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierColor }} />
            <span style={{ fontSize: 13, color: tierColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: activeFont }}>
              {cleanRank}-Tier Rating
            </span>
          </div>
        </div>

        {/* Bottom border decoration */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '5%',
            width: '90%',
            height: 2,
            background: `linear-gradient(90deg, transparent, ${tierColor}, transparent)`,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
};
