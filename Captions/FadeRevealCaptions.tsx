import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { CaptionPage } from "./types";

interface FadeRevealCaptionsProps {
  pages: CaptionPage[];
  textColor?: string;
  outlineColor?: string;
  customFrame?: number;
}

export const FadeRevealCaptions: React.FC<FadeRevealCaptionsProps> = ({
  pages,
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

  return (
    <div className="flex flex-wrap justify-center items-center text-center font-bold text-4xl md:text-6xl tracking-wide select-none px-10">
      {activePage.words.map((word, index) => {
        const wordStartFrame = (word.startMs / 1000) * fps;
        const relativeFrame = frame - wordStartFrame;

        // Animate only if the word has started (relativeFrame >= 0)
        const animProgress = spring({
          frame: Math.max(0, relativeFrame),
          fps,
          config: {
            damping: 15,
            stiffness: 120,
            mass: 0.5,
          },
        });

        // If the word hasn't started yet, keep it fully hidden
        const opacity = relativeFrame >= 0 ? interpolate(animProgress, [0, 1], [0, 1]) : 0;
        const translateY = relativeFrame >= 0 ? interpolate(animProgress, [0, 1], [15, 0]) : 15;

        const textShadow = `
          -2px -2px 0 ${outlineColor},  
           2px -2px 0 ${outlineColor},
          -2px  2px 0 ${outlineColor},
           2px  2px 0 ${outlineColor},
          3px  3px 0px rgba(0,0,0,0.4)
        `;

        return (
          <span
            key={index}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              color: textColor,
              textShadow,
              display: "inline-block",
              margin: "8px 12px",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
