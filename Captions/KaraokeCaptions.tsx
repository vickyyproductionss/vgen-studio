import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionPage } from "./types";

interface KaraokeCaptionsProps {
  pages: CaptionPage[];
  activeColor?: string;
  completedColor?: string;
  upcomingColor?: string;
  outlineColor?: string;
  customFrame?: number;
}

export const KaraokeCaptions: React.FC<KaraokeCaptionsProps> = ({
  pages,
  activeColor = "#3B82F6",    // Tailwind blue-500
  completedColor = "#FFFFFF", // Solid white
  upcomingColor = "rgba(255, 255, 255, 0.4)", // Dimmed white
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
    <div className="flex flex-wrap justify-center items-center text-center font-extrabold text-4xl md:text-6xl tracking-normal select-none px-10">
      {activePage.words.map((word, index) => {
        const isCompleted = timeMs >= word.endMs;
        const isActive = timeMs >= word.startMs && timeMs < word.endMs;

        let textColor = upcomingColor;
        let scale = 1;
        
        if (isActive) {
          textColor = activeColor;
          scale = 1.05; // Gentle emphasis on active word
        } else if (isCompleted) {
          textColor = completedColor;
        }

        const textShadow = `
          -2px -2px 0 ${outlineColor},  
           2px -2px 0 ${outlineColor},
          -2px  2px 0 ${outlineColor},
           2px  2px 0 ${outlineColor},
          4px  4px 0px rgba(0,0,0,0.3)
        `;

        return (
          <span
            key={index}
            style={{
              color: textColor,
              transform: `scale(${scale})`,
              textShadow,
              display: "inline-block",
              margin: "6px 10px",
              transition: "color 0.15s ease-out, transform 0.15s ease-out",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
