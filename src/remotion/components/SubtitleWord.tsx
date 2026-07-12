import React from 'react';

export interface WordStyle {
  fontColor: string;
  activeWordScale: number;
  neonGlow: boolean;
  glowColor: string;
  glowBlur: number;
  glowDistance: number;
}

interface SubtitleWordProps {
  word: string;
  isActive: boolean;
  fontName: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowDistance?: number;
  shadowAngle?: number;
  shadowOpacity?: number;
  outlineColor?: string;
  outlineThickness?: number;
  letterSpacing?: number;
  wordSpacing?: number;
  // Top-level glow overrides — these win over whatever is in normalStyle/highlightStyle
  neonGlow?: boolean;
  glowColor?: string;
  glowBlur?: number;
  glowDistance?: number;
  normalStyle?: WordStyle;
  highlightStyle?: WordStyle;
  emojiStyle?: WordStyle;
  textCase?: 'default' | 'upper' | 'first-word-larger';
  isFirst?: boolean;
}

// Convert a 3- or 6-char hex string to rgba()
const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const SubtitleWord: React.FC<SubtitleWordProps> = ({
  word,
  isActive,
  fontName,
  fontSize,
  bold,
  italic,
  shadow,
  shadowColor = '#000000',
  shadowBlur = 4,
  shadowDistance = 2,
  shadowAngle = 45,
  shadowOpacity = 0.6,
  outlineColor,
  outlineThickness = 1.5,
  letterSpacing = 0,
  wordSpacing = 0,
  neonGlow: neonGlowProp,
  glowColor: glowColorProp,
  glowBlur: glowBlurProp,
  glowDistance: glowDistanceProp,
  normalStyle,
  highlightStyle,
  emojiStyle,
  textCase = 'default',
}) => {
  // Determine if this is an emoji word to apply emoji style
  const isEmoji = /[\uD800-\uDFFF\u2600-\u27BF]/.test(word);
  const activeWordStyle = isEmoji ? emojiStyle : highlightStyle;

  const currentStyle = isActive
    ? (activeWordStyle || {
        fontColor: '#FFFFFF',
        activeWordScale: 1.15,
        neonGlow: true,
        glowColor: '#FFFFFF',
        glowBlur: 8,
        glowDistance: 4,
      })
    : (normalStyle || {
        fontColor: '#FFFFFF',
        activeWordScale: 1.0,
        neonGlow: false,
        glowColor: '#FFFFFF',
        glowBlur: 8,
        glowDistance: 4,
      });

  const scale = isActive ? currentStyle.activeWordScale : 1.0;

  // Process text casing
  let processedWord = word;
  if (textCase === 'upper') {
    processedWord = word.toUpperCase();
  }

  // ─── Build textShadow ─────────────────────────────────────────────────────
  const shadowLayers: string[] = [];

  if (shadow) {
    const hasCustomShadow = shadowDistance > 0 || shadowBlur > 0;
    if (hasCustomShadow) {
      const rad = (shadowAngle * Math.PI) / 180;
      const dx  = Math.round(shadowDistance * Math.cos(rad) * 10) / 10;
      const dy  = Math.round(shadowDistance * Math.sin(rad) * 10) / 10;
      // Primary layer — sharp and opaque
      shadowLayers.push(`${dx}px ${dy}px ${shadowBlur}px ${hexToRgba(shadowColor, shadowOpacity)}`);
      // Soft feathered halo around it
      shadowLayers.push(`${dx * 0.5}px ${dy * 0.5}px ${shadowBlur * 2.5}px ${hexToRgba(shadowColor, shadowOpacity * 0.5)}`);
    } else {
      shadowLayers.push('2px 2px 5px rgba(0, 0, 0, 0.90)');
    }
  }

  const _glowBlur = glowBlurProp     ?? currentStyle.glowBlur;
  const _glowDist = glowDistanceProp ?? currentStyle.glowDistance;
  const _glowHex  = glowColorProp    ?? currentStyle.glowColor;

  // ─── Build style object ───────────────────────────────────────────────────
  const styleObj: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: fontName,
    fontSize: `${fontSize}px`,
    fontWeight: bold ? 'bold' : 'normal',
    fontStyle: italic ? 'italic' : 'normal',
    color: currentStyle.fontColor,
    transform: `scale(${scale})`,
    transition: 'transform 0.08s ease-out, color 0.08s ease-out',
    margin: `0 ${4 + wordSpacing}px`,
    letterSpacing: letterSpacing !== 0 ? `${letterSpacing}px` : undefined,
    lineHeight: 1.2,
    whiteSpace: 'pre',
    paintOrder: 'stroke fill',
  };

  if (shadowLayers.length > 0) {
    styleObj.textShadow = shadowLayers.join(', ');
  }

  // Outline via -webkit-text-stroke (independent of textShadow, unaffected by glow)
  if (outlineColor && outlineThickness > 0) {
    (styleObj as any).WebkitTextStroke = `${outlineThickness}px ${outlineColor}`;
  }

  // ─── Glow via CSS filter (smooth, per-word) ───────────────────────────────
  // text-shadow applies per character → visible per-letter rings.
  // filter:drop-shadow treats the whole element as one shape → perfectly smooth bloom.
  if ((currentStyle.neonGlow || neonGlowProp) && (_glowBlur > 0 || _glowDist > 0)) {
    const r1 = _glowBlur + _glowDist;              // inner spread
    const r2 = _glowBlur * 2.5 + _glowDist;       // outer spread (wider, softer)
    const op1 = 0.80 / (1 + _glowDist / 20);      // opacity fades as distance grows
    const op2 = op1 * 0.45;                         // outer ring much fainter
    const c1 = hexToRgba(_glowHex, op1);
    const c2 = hexToRgba(_glowHex, op2);
    // Two drop-shadows blend into one continuous smooth Gaussian — no visible rings
    styleObj.filter = `drop-shadow(0 0 ${r1}px ${c1}) drop-shadow(0 0 ${r2}px ${c2})`;
  }


  if (textCase === 'first-word-larger' && word.length > 0 && !isEmoji) {
    const match = word.match(/[a-zA-Z0-9\u0900-\u097F]/);
    const firstCharIndex = match && match.index !== undefined ? match.index : 0;

    const leading   = word.substring(0, firstCharIndex);
    const firstChar = word.charAt(firstCharIndex).toUpperCase();
    const trailing  = word.substring(firstCharIndex + 1).toUpperCase();

    return (
      <span style={styleObj}>
        {leading}
        <span style={{ fontSize: '1.30em', display: 'inline-block' }}>{firstChar}</span>
        <span style={{ fontSize: '0.90em', display: 'inline-block' }}>{trailing}</span>
      </span>
    );
  }

  return <span style={styleObj}>{processedWord}</span>;
};
