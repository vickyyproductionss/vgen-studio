import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { CaptionPage } from "./types";

interface GlitchCaptionsProps {
  pages: CaptionPage[];
  activeColor?: string;
  inactiveColor?: string;
  customFrame?: number;
}

export const GlitchCaptions: React.FC<GlitchCaptionsProps> = ({
  pages,
  activeColor = "#00FFFF", // Cyan active highlight
  inactiveColor = "#FFFFFF",
  customFrame,
}) => {
  const remotionFrame = useCurrentFrame();
  const frame = customFrame !== undefined ? customFrame : remotionFrame;
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;

  // Find the active page
  const activePage = pages.find(
    (page) => timeMs >= page.startMs && timeMs <= page.endMs
  );

  if (!activePage) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center items-center text-center font-black uppercase text-5xl md:text-7xl tracking-wider select-none px-10">
      {activePage.words.map((word, index) => {
        const isActive = timeMs >= word.startMs && timeMs < word.endMs;
        const wordStartFrame = (word.startMs / 1000) * fps;
        const relativeFrame = frame - wordStartFrame;

        // Glitch effect triggers at the start of word active state and lasts 8 frames
        const glitchProgress = spring({
          frame: relativeFrame,
          fps,
          config: {
            damping: 5, // Low damping for rapid bounce/shake
            stiffness: 250,
          },
        });

        // Split red/blue offsets on active, decaying quickly
        const offset = isActive
          ? interpolate(glitchProgress, [0, 0.4, 0.8, 1], [8, -6, 3, 0])
          : 0;

        const textColor = isActive ? activeColor : inactiveColor;

        // Glitch chromatic shadow outline
        const textShadow = offset > 0
          ? `
            -${offset}px 0px 0px rgba(255, 0, 80, 0.8),
            ${offset}px 0px 0px rgba(0, 243, 255, 0.8),
            0px 0px 10px rgba(255,255,255,0.2)
          `
          : `
            -2px -2px 0 #000,  
             2px -2px 0 #000,
            -2px  2px 0 #000,
             2px  2px 0 #000,
            4px  4px 0px rgba(0,0,0,0.4)
          `;

        return (
          <span
            key={index}
            style={{
              color: textColor,
              textShadow,
              display: "inline-block",
              margin: "10px 15px",
              transform: isActive ? `skewX(${offset * 1.5}deg)` : "none",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
