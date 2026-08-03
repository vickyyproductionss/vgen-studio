import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { CaptionPage } from "./types";

interface GlowCaptionsProps {
  pages: CaptionPage[];
  glowColor?: string;
  textColor?: string;
  outlineColor?: string;
  customFrame?: number;
}

export const GlowCaptions: React.FC<GlowCaptionsProps> = ({
  pages,
  glowColor = "#EC4899", // Neon pink-500
  textColor = "#FFFFFF",
  outlineColor = "#000000",
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

  // Create a pulsing effect using a sine wave based on the frame
  const pulseFactor = Math.sin(frame / 3) * 5 + 15; // fluctuates glow radius between 10px and 20px

  return (
    <div className="flex flex-wrap justify-center items-center text-center font-extrabold uppercase text-5xl md:text-6xl tracking-wider select-none px-10">
      {activePage.words.map((word, index) => {
        const isActive = timeMs >= word.startMs && timeMs < word.endMs;
        const wordStartFrame = (word.startMs / 1000) * fps;
        const relativeFrame = frame - wordStartFrame;

        // Bounce spring on enter
        const activeSpring = spring({
          frame: relativeFrame,
          fps,
          config: {
            damping: 12,
            stiffness: 150,
            mass: 0.4,
          },
        });

        const scale = isActive ? interpolate(activeSpring, [0, 1], [1, 1.2]) : 1;

        // Apply neon glow only to the active word
        const textShadow = isActive
          ? `
            -1px -1px 0 ${outlineColor},  
             1px -1px 0 ${outlineColor},
            -1px  1px 0 ${outlineColor},
             1px  1px 0 ${outlineColor},
            0 0 ${pulseFactor}px ${glowColor},
            0 0 ${pulseFactor + 10}px ${glowColor},
            0 0 ${pulseFactor + 20}px ${glowColor}
          `
          : `
            -2px -2px 0 ${outlineColor},  
             2px -2px 0 ${outlineColor},
            -2px  2px 0 ${outlineColor},
             2px  2px 0 ${outlineColor},
            4px  4px 0px rgba(0,0,0,0.4)
          `;

        return (
          <span
            key={index}
            style={{
              transform: `scale(${scale})`,
              color: textColor,
              textShadow,
              display: "inline-block",
              margin: "8px 12px",
              transition: "text-shadow 0.1s ease-out",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
