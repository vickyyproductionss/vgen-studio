import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionPage } from "./types";

interface TypewriterCaptionsProps {
  pages: CaptionPage[];
  textColor?: string;
  cursorColor?: string;
  outlineColor?: string;
  customFrame?: number;
}

export const TypewriterCaptions: React.FC<TypewriterCaptionsProps> = ({
  pages,
  textColor = "#FFFFFF",
  cursorColor = "#FACC15", // Yellow blinking cursor
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

  // Construct the displayed text based on current timeMs
  let displayText = "";
  let isTypingFinished = true;

  activePage.words.forEach((word, index) => {
    if (timeMs >= word.endMs) {
      // Word is fully completed, render it followed by space
      displayText += word.text + " ";
    } else if (timeMs >= word.startMs && timeMs < word.endMs) {
      // Word is currently active, type it out character-by-character
      const wordProgress = (timeMs - word.startMs) / (word.endMs - word.startMs);
      const visibleLength = Math.max(0, Math.floor(wordProgress * word.text.length));
      displayText += word.text.substring(0, visibleLength);
      isTypingFinished = false;
    } else {
      // Future words are not rendered yet
      isTypingFinished = false;
    }
  });

  // Cursor blinks when typing is finished; stays solid while active
  const showCursor = isTypingFinished
    ? Math.floor(frame / 12) % 2 === 0
    : true;

  const textShadow = `
    -2px -2px 0 ${outlineColor},  
     2px -2px 0 ${outlineColor},
    -2px  2px 0 ${outlineColor},
     2px  2px 0 ${outlineColor},
    4px  4px 0px rgba(0,0,0,0.3)
  `;

  return (
    <div className="flex justify-center items-center text-center font-mono font-bold text-4xl md:text-5xl tracking-wide select-none px-10">
      <span style={{ color: textColor, textShadow }}>
        {displayText}
        {showCursor && (
          <span style={{ color: cursorColor, marginLeft: "4px" }}>|</span>
        )}
      </span>
    </div>
  );
};
