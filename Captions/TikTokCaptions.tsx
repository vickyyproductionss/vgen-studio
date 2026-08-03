import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { CaptionPage } from "./types";

interface TikTokCaptionsProps {
  pages: CaptionPage[];
  activeColor?: string;
  inactiveColor?: string;
  outlineColor?: string;
  customFrame?: number;
}

export const TikTokCaptions: React.FC<TikTokCaptionsProps> = ({
  pages,
  activeColor = "#FACC15", // Tailwind yellow-400
  inactiveColor = "#FFFFFF",
  outlineColor = "#000000",
  customFrame,
}) => {
  const remotionFrame = useCurrentFrame();
  const frame = customFrame !== undefined ? customFrame : remotionFrame;
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;

  // Find the active page of captions based on the current frame time
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

        // Bouncy entrance when active
        const activeSpring = spring({
          frame: frame - wordStartFrame,
          fps,
          config: {
            damping: 12,
            stiffness: 150,
            mass: 0.4,
          },
        });

        // Interpolate the spring value so the active word scales up and bounces back slightly
        const scale = isActive
          ? interpolate(activeSpring, [0, 1], [1, 1.25])
          : 1;

        const textColor = isActive ? activeColor : inactiveColor;

        // Thick text shadow / outline to ensure legibility over any background video/image
        const textShadow = `
          -3px -3px 0 ${outlineColor},  
           3px -3px 0 ${outlineColor},
          -3px  3px 0 ${outlineColor},
           3px  3px 0 ${outlineColor},
          -3px  0px 0 ${outlineColor},
           3px  0px 0 ${outlineColor},
           0px -3px 0 ${outlineColor},
           0px  3px 0 ${outlineColor},
           5px  5px 0px rgba(0,0,0,0.5)
        `;

        return (
          <span
            key={index}
            style={{
              transform: `scale(${scale})`,
              color: textColor,
              textShadow,
              display: "inline-block",
              margin: "10px 15px",
              transition: "color 0.1s ease-out",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
