import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface StatCalloutProps {
  statValue: string;
  statLabel?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
}

/**
 * Parse a stat string into prefix ($), numeric digits, and suffix (KG, %, etc.)
 * Examples: "83KG" -> { prefix:'', digits:'83', suffix:'KG' }
 *           "$5000" -> { prefix:'$', digits:'5000', suffix:'' }
 *           "100%" -> { prefix:'', digits:'100', suffix:'%' }
 */
const parseStat = (str: string): { prefix: string; digits: string; suffix: string } => {
  const m = str.match(/^(\$?)([\d,.]+)\s*(.*)$/);
  if (!m) return { prefix: '', digits: '', suffix: str };
  return { prefix: m[1], digits: m[2].replace(/,/g, ''), suffix: m[3] };
};

export const StatCallout: React.FC<StatCalloutProps> = ({
  statValue,
  statLabel = 'Milestone Reached',
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
    config: { damping: 15, stiffness: 90, mass: 0.95 },
  });

  const countProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60, mass: 1.0 },
  });

  const { prefix, digits, suffix } = parseStat(statValue);
  const targetNum = digits ? parseInt(digits, 10) : null;

  let displayDigits = digits || statValue;

  if (targetNum !== null) {
    const isYear = targetNum > 1900 && targetNum < 2100;
    const startNum = isYear ? targetNum - 40 : 0;
    const currentNum = Math.round(startNum + (targetNum - startNum) * countProgress);
    displayDigits = currentNum.toLocaleString();
  }

  const offset = 70 * (1 - entryAnim);
  const opacity = Math.min(1, entryAnim * 1.5);
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
          width: '82%',
          maxWidth: 520,
          background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.55) 0%, rgba(10, 10, 12, 0.7) 100%)',
          border: '1.5px solid rgba(212, 175, 55, 0.2)',
          borderRadius: 18,
          padding: '38px 32px 30px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          transform: `translateY(${offset}px) scale(${0.92 + 0.08 * entryAnim})`,
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
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            width: '80%',
            height: 2,
            background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, ${brandSecondaryColor}, transparent)`,
            boxShadow: `0 0 12px ${brandPrimaryColor}99`,
            borderRadius: 1,
          }}
        />

        {/* Bottom gold edge line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '10%',
            width: '80%',
            height: 2,
            background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}, ${brandSecondaryColor}, transparent)`,
            boxShadow: `0 0 12px ${brandPrimaryColor}99`,
            borderRadius: 1,
          }}
        />

        {/* Glow behind number */}
        <div
          style={{
            position: 'absolute',
            width: 200,
            height: 100,
            background: `radial-gradient(circle, ${brandPrimaryColor}22 0%, transparent 70%)`,
            filter: 'blur(20px)',
            zIndex: -1,
            top: '25%',
          }}
        />

        {/* Stat Value — number + suffix */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            margin: 0,
            lineHeight: 1.0,
          }}
        >
          {/* Prefix ($) and animated digits in gold gradient */}
          <span
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              background: `linear-gradient(180deg, #d4af37 0%, #f5e6a3 45%, #b8860b 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: activeFont,
            }}
          >
            {prefix}{displayDigits}
          </span>

          {/* Suffix (KG, %, etc.) in white */}
          {suffix && (
            <span
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.9)',
                letterSpacing: '0.04em',
                marginLeft: 6,
                fontFamily: activeFont,
              }}
            >
              {suffix}
            </span>
          )}
        </div>

        {/* Gold divider */}
        <div
          style={{
            width: 60,
            height: 2,
            background: `linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5), transparent)`,
            margin: '20px auto 14px',
            borderRadius: 1,
          }}
        />

        {/* Label */}
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.55)',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            margin: 0,
            fontFamily: activeFont,
          }}
        >
          {statLabel}
        </p>
      </div>
    </div>
  );
};
