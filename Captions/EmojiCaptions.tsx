import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { CaptionPage } from "./types";

// A dictionary mapping keywords to emojis
const EMOJI_MAP: Record<string, string> = {
  welcome: "👋",
  video: "📹",
  remotion: "🚀",
  build: "🛠️",
  gorgeous: "✨",
  animations: "🎬",
};

interface EmojiCaptionsProps {
  pages: CaptionPage[];
  activeColor?: string;
  inactiveColor?: string;
  outlineColor?: string;
  customFrame?: number;
}

export const EmojiCaptions: React.FC<EmojiCaptionsProps> = ({
  pages,
  activeColor = "#22C55E", // Vibrant green-500
  inactiveColor = "#FFFFFF",
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
    <div className="flex flex-wrap justify-center items-end text-center font-black uppercase text-5xl md:text-7xl tracking-wider select-none px-10 min-h-[160px] pb-4">
      {activePage.words.map((word, index) => {
        // Strip punctuation and convert to lowercase to look up matching emoji
        const cleanWord = word.text
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
          .toLowerCase();
        const emoji = EMOJI_MAP[cleanWord];

        const isActive = timeMs >= word.startMs && timeMs < word.endMs;
        const wordStartFrame = (word.startMs / 1000) * fps;

        // Bouncy spring animation for the active state
        const activeSpring = spring({
          frame: frame - wordStartFrame,
          fps,
          config: {
            damping: 10,
            stiffness: 160,
            mass: 0.4,
          },
        });

        // Scale the word and emoji on active state
        const scale = isActive ? interpolate(activeSpring, [0, 1], [1, 1.25]) : 1;
        const emojiScale = isActive ? interpolate(activeSpring, [0, 1], [0, 1.3]) : 0;
        const emojiTranslateY = isActive ? interpolate(activeSpring, [0, 1], [0, -15]) : 0;

        const textColor = isActive ? activeColor : inactiveColor;

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
          <div key={index} className="flex flex-col items-center mx-4 my-4 relative">
            {/* Animated Emoji Floating above the active word */}
            {emoji && (
              <div
                style={{
                  transform: `scale(${emojiScale}) translateY(${emojiTranslateY}px)`,
                  fontSize: "1.2em",
                  position: "absolute",
                  bottom: "90%",
                  opacity: isActive ? 1 : 0,
                  transition: "opacity 0.1s ease-out",
                  pointerEvents: "none",
                }}
              >
                {emoji}
              </div>
            )}
            <span
              style={{
                transform: `scale(${scale})`,
                color: textColor,
                textShadow,
                display: "inline-block",
                transition: "color 0.1s ease-out",
              }}
            >
              {word.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
