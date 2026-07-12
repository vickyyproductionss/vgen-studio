import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface VersusLayoutProps {
  versusLeft: string;
  versusRight: string;
  versusLabel?: string;
  versusLeftFeatures?: string[];
  versusRightFeatures?: string[];
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  width?: number;
  height?: number;
  fontName?: string;
  cardPositionY?: number;
  cardScale?: number;
  cardFontName?: string;
  rightBlurredMode?: 'blurred' | 'unblurred' | 'auto-transition';
  durationInFrames?: number;
}

export const VersusLayout: React.FC<VersusLayoutProps> = ({
  versusLeft,
  versusRight,
  versusLabel = 'The Ultimate Showdown',
  versusLeftFeatures = [],
  versusRightFeatures = [],
  brandPrimaryColor = '#d4af37',
  brandSecondaryColor = '#f5e6a3',
  fontName,
  cardPositionY = 0,
  cardScale = 1.0,
  cardFontName,
  rightBlurredMode = 'auto-transition',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animations for entry
  const leftAnim = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const rightAnim = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const vsAnim = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
  });

  // Right side blur animation
  const halfFrame = durationInFrames ? Math.floor(durationInFrames / 2) : 30;
  const startFrame = rightBlurredMode === 'unblurred' 
    ? 0 
    : rightBlurredMode === 'blurred' 
      ? 999999 
      : halfFrame;

  const blurAnim = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  const activeFont = cardFontName || fontName || 'Outfit, -apple-system, sans-serif';

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: `${cardPositionY}%`,
        width: '100%',
        height: '68%',
        zIndex: 20,
        overflow: 'hidden',
        pointerEvents: 'none',
        fontFamily: activeFont,
        transform: `scale(${cardScale})`,
      }}
    >


      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Versus Content row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-around',
            width: '94%',
            maxWidth: 750,
            marginTop: 20,
          }}
        >
          {/* Left Competitor Column */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `translateX(${-120 * (1 - leftAnim)}px)`,
              opacity: leftAnim,
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.55) 0%, rgba(10, 10, 12, 0.7) 100%)',
                border: '1.5px solid rgba(212, 175, 55, 0.2)',
                borderLeft: `3px solid ${brandPrimaryColor}`,
                borderRadius: 16,
                padding: '18px 22px',
                textAlign: 'center',
                minWidth: 140,
                width: '100%',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
              }}
            >
              <span
                style={{
                  color: brandPrimaryColor,
                  fontSize: 14,
                  fontWeight: '800',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 6,
                  fontFamily: activeFont,
                }}
              >
                CONTENDER A
              </span>
              <h2
                style={{
                  color: '#FFFFFF',
                  fontSize: 28,
                  fontWeight: '900',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  textShadow: `0 0 10px ${brandPrimaryColor}66`,
                  fontFamily: activeFont,
                }}
              >
                {versusLeft}
              </h2>
            </div>

            {/* Left Features list */}
            <div style={{ width: '100%', marginTop: 12 }}>
              {versusLeftFeatures.map((feat, index) => {
                const featAnim = spring({
                  frame: Math.max(0, frame - 12 - index * 6),
                  fps,
                  config: { damping: 12, stiffness: 100 },
                });
                return (
                  <div
                    key={index}
                    style={{
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: `1px solid rgba(255, 255, 255, 0.08)`,
                      borderLeft: `3px solid ${brandPrimaryColor}d9`,
                      borderRadius: 10,
                      padding: '8px 14px',
                      marginTop: 8,
                      color: '#e2e8f0',
                      fontSize: 17,
                      fontWeight: '700',
                      textAlign: 'center',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      transform: `translateX(${-30 * (1 - featAnim)}px)`,
                      opacity: featAnim,
                      fontFamily: activeFont,
                    }}
                  >
                    {feat}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Versus Center Circle */}
          <div
            style={{
              margin: '20px 15px 0 15px',
              transform: `scale(${vsAnim})`,
              opacity: vsAnim,
              zIndex: 30,
              alignSelf: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${brandPrimaryColor} 0%, ${brandSecondaryColor} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 35px ${brandSecondaryColor}66, 0 8px 25px rgba(0,0,0,0.6)`,
                border: '2.5px solid #FFFFFF',
              }}
            >
              <span
                style={{
                  color: '#FFFFFF',
                  fontFamily: activeFont,
                  fontSize: 22,
                  fontWeight: '900',
                  fontStyle: 'italic',
                  letterSpacing: '-0.04em',
                  textShadow: '0 2px 5px rgba(0,0,0,0.4)',
                }}
              >
                VS
              </span>
            </div>
          </div>

          {/* Right Competitor Column */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `translateX(${120 * (1 - leftAnim)}px)`,
              opacity: leftAnim,
              filter: `blur(${12 * (1 - blurAnim)}px)`,
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.55) 0%, rgba(10, 10, 12, 0.7) 100%)',
                border: '1.5px solid rgba(212, 175, 55, 0.2)',
                borderRight: `3px solid ${brandSecondaryColor}`,
                borderRadius: 16,
                padding: '18px 22px',
                textAlign: 'center',
                minWidth: 140,
                width: '100%',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
              }}
            >
              <span
                style={{
                  color: brandSecondaryColor,
                  fontSize: 14,
                  fontWeight: '800',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 6,
                  fontFamily: activeFont,
                }}
              >
                CONTENDER B
              </span>
              <h2
                style={{
                  color: '#FFFFFF',
                  fontSize: 28,
                  fontWeight: '900',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  textShadow: `0 0 10px ${brandSecondaryColor}66`,
                  fontFamily: activeFont,
                }}
              >
                {versusRight}
              </h2>
            </div>

            {/* Right Features list */}
            <div style={{ width: '100%', marginTop: 12 }}>
              {versusRightFeatures.map((feat, index) => {
                const featAnim = spring({
                  frame: Math.max(0, frame - 15 - index * 6),
                  fps,
                  config: { damping: 12, stiffness: 100 },
                });
                return (
                  <div
                    key={index}
                    style={{
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: `1px solid rgba(255, 255, 255, 0.08)`,
                      borderRight: `3px solid ${brandSecondaryColor}d9`,
                      borderRadius: 10,
                      padding: '8px 14px',
                      marginTop: 8,
                      color: '#e2e8f0',
                      fontSize: 17,
                      fontWeight: '700',
                      textAlign: 'center',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      transform: `translateX(${30 * (1 - featAnim)}px)`,
                      opacity: featAnim,
                      fontFamily: activeFont,
                    }}
                  >
                    {feat}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Versus Battle Description Label */}
        {versusLabel && (
          <div
            style={{
              marginTop: 25,
              padding: '8px 20px',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(8, 12, 24, 0.95) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 24,
              opacity: rightAnim,
              transform: `translateY(${15 * (1 - rightAnim)}px)`,
              boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '800',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                fontFamily: activeFont,
              }}
            >
              {versusLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
