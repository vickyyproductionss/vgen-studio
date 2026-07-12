import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface StoryEdgeProps {
  id: string;
  fromX: number; // in pixels
  fromY: number; // in pixels
  toX: number; // in pixels
  toY: number; // in pixels
  label?: string;
  sentiment?: 'positive' | 'conflict' | 'neutral' | string;
  active: boolean;
  entryFrame: number;
  width: number;
  height: number;
  customDrawProgress?: number;
  focusProgress?: number;
}

export const StoryEdge: React.FC<StoryEdgeProps> = ({
  id,
  fromX,
  fromY,
  toX,
  toY,
  label,
  sentiment,
  active,
  entryFrame,
  width,
  height,
  customDrawProgress,
  focusProgress,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - entryFrame;
  if (relativeFrame < 0) {
    return null;
  }

  // Sentiment-based vibrating red lightning / jitter for conflict
  const jitterX = active && sentiment === 'conflict' ? Math.sin(frame * 1.5) * 1.8 : 0;
  const jitterY = active && sentiment === 'conflict' ? Math.cos(frame * 1.5) * 1.8 : 0;

  // Calculate coordinates for the Bezier curve
  const dx = toX - fromX;
  const dy = toY - fromY;
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  // Add a slight curve bending upwards/downwards depending on positions
  const angle = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;
  
  // Bend factor based on distance (calculated in percentage for capping, then converted to pixels)
  const pctDx = (toX - fromX) / width * 100;
  const pctDy = (toY - fromY) / height * 100;
  const pctDistance = Math.sqrt(pctDx * pctDx + pctDy * pctDy);
  
  const pctCurveIntensity = Math.min(12, pctDistance * 0.25);
  const curveIntensity = (pctCurveIntensity / 100) * Math.sqrt(width * height);
  const controlX = midX + Math.cos(perpAngle) * curveIntensity;
  const controlY = midY + Math.sin(perpAngle) * curveIntensity;

  // Distance in pixel coordinates
  const distance = Math.sqrt(dx * dx + dy * dy);
  // Approximation of path length for stroke dash calculations
  const approxPathLength = distance * 1.15;

  // Draw progress (0 to 1)
  const drawProgress = customDrawProgress !== undefined ? customDrawProgress : spring({
    frame: relativeFrame,
    fps,
    config: {
      damping: 18,
      mass: 0.9,
      stiffness: 70,
    },
  });

  const dashOffset = approxPathLength * (1 - drawProgress);

  // Label position at the center of the curve (t = 0.5)
  const labelX = 0.25 * fromX + 0.5 * controlX + 0.25 * toX;
  const labelY = 0.25 * fromY + 0.5 * controlY + 0.25 * toY;

  // Animate label appearance once the line is mostly drawn
  const labelOpacity = Math.max(0, Math.min(1, (drawProgress - 0.6) * 2.5));

  const baseEdgeOpacity = active ? 1.0 : 0.6;
  const edgeOpacity = focusProgress !== undefined
    ? (0.15 * (1 - focusProgress) + baseEdgeOpacity * focusProgress)
    : baseEdgeOpacity;

  // Flowing particles: compute points along Bezier curve
  const renderFlowParticles = () => {
    if (!active || drawProgress < 0.95) return null;

    // We render 3 particles moving along the curve at different offset intervals
    let particleSpeeds = [70, 90, 110]; // frames per loop
    let particleColors = ['#FFFFFF', '#FFFFFF', '#FFFFFF'];
    let particleGlow = 'rgba(255, 255, 255, 0.6)';

    if (sentiment === 'positive') {
      particleColors = ['#2ecc71', '#a3e4d7', '#ffffff'];
      particleGlow = 'rgba(46, 204, 113, 0.6)';
    } else if (sentiment === 'conflict') {
      particleSpeeds = [35, 45, 55]; // faster flow
      particleColors = ['#e74c3c', '#f1948a', '#ffffff'];
      particleGlow = 'rgba(231, 76, 60, 0.7)';
    } else if (sentiment === 'neutral') {
      particleSpeeds = [100, 120, 140]; // slower flow
      particleColors = ['#bdc3c7', '#ecf0f1', '#ffffff'];
      particleGlow = 'rgba(189, 195, 199, 0.4)';
    }

    return particleSpeeds.map((speed, i) => {
      const charOffset = id.charCodeAt(0) * 3 + i * 20;
      const t = ((frame - entryFrame + charOffset) % speed) / speed;
      
      // Quadratic Bezier interpolation formula
      const u = 1 - t;
      const px = u * u * (fromX + jitterX) + 2 * u * t * (controlX + jitterX) + t * t * (toX + jitterX);
      const py = u * u * (fromY + jitterY) + 2 * u * t * (controlY + jitterY) + t * t * (toY + jitterY);

      return (
        <circle
          key={`part-${i}`}
          cx={px}
          cy={py}
          r="5.0" // 10px diameter
          fill={particleColors[i % particleColors.length]}
          style={{
            filter: `drop-shadow(0 0 2px ${particleGlow})`,
            opacity: edgeOpacity,
          }}
        />
      );
    });
  };

  const pathData = `M ${fromX + jitterX} ${fromY + jitterY} Q ${controlX + jitterX} ${controlY + jitterY} ${toX + jitterX} ${toY + jitterY}`;

  // Sentiment-based styles
  let accentColor = active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)';
  let edgeGlow = active ? 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.4))' : 'none';

  if (sentiment === 'positive') {
    accentColor = active ? '#2ecc71' : 'rgba(46, 204, 113, 0.3)';
    edgeGlow = active ? 'drop-shadow(0 0 4px rgba(46, 204, 113, 0.5))' : 'none';
  } else if (sentiment === 'conflict') {
    accentColor = active ? '#e74c3c' : 'rgba(231, 76, 60, 0.3)';
    edgeGlow = active ? 'drop-shadow(0 0 5px rgba(231, 76, 60, 0.6))' : 'none';
  } else if (sentiment === 'neutral') {
    accentColor = active ? '#95a5a6' : 'rgba(149, 165, 166, 0.3)';
    edgeGlow = active ? 'drop-shadow(0 0 2px rgba(149, 165, 166, 0.3))' : 'none';
  }

  // Dash array overrides: neutral is dashed when fully drawn
  const strokeDashArray = drawProgress < 0.95 
    ? approxPathLength 
    : (sentiment === 'neutral' ? '6,6' : approxPathLength);
  const strokeDashOffset = drawProgress < 0.95 ? dashOffset : 0;

  // Label card border sentiment matching
  let labelBorder = `1px solid ${active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)'}`;
  let labelColor = active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)';
  if (active) {
    if (sentiment === 'positive') {
      labelBorder = '1px solid #2ecc71';
      labelColor = '#2ecc71';
    } else if (sentiment === 'conflict') {
      labelBorder = '1px solid #e74c3c';
      labelColor = '#e74c3c';
    } else if (sentiment === 'neutral') {
      labelBorder = '1px solid #95a5a6';
      labelColor = '#bdc3c7';
    }
  }

  return (
    <>
      {/* SVG Connection Path */}
      <path
        d={pathData}
        fill="none"
        stroke={accentColor}
        strokeWidth={5.0}
        strokeDasharray={strokeDashArray}
        strokeDashoffset={strokeDashOffset}
        strokeLinecap="round"
        style={{
          filter: edgeGlow,
          opacity: edgeOpacity,
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease, opacity 0.3s ease',
        }}
      />

      {/* Render particles flowing along path */}
      {renderFlowParticles()}

      {/* Connection Label Card */}
      {label && labelOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${(labelX / width) * 100}%`,
            top: `${(labelY / height) * 100}%`,
            transform: 'translate(-50%, -50%)',
            opacity: labelOpacity * edgeOpacity,
            padding: '2px 8px',
            background: 'rgba(10, 15, 28, 0.85)',
            border: labelBorder,
            borderRadius: 6,
            color: labelColor,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 9,
            fontWeight: '600',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            zIndex: 5,
            transition: 'border 0.3s ease, color 0.3s ease, opacity 0.3s ease',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          {label}
        </div>
      )}
    </>
  );
};
