import { CaptionPage } from "./types";

export const mockCaptions: CaptionPage[] = [
  {
    startMs: 0,
    endMs: 1400,
    words: [
      { text: "Welcome", startMs: 100, endMs: 500 },
      { text: "to", startMs: 500, endMs: 800 },
      { text: "Remotion!", startMs: 800, endMs: 1300 },
    ],
  },
  {
    startMs: 1400,
    endMs: 3300,
    words: [
      { text: "In", startMs: 1500, endMs: 1700 },
      { text: "this", startMs: 1700, endMs: 1900 },
      { text: "video,", startMs: 1900, endMs: 2300 },
      { text: "we", startMs: 2300, endMs: 2500 },
      { text: "will", startMs: 2500, endMs: 2700 },
      { text: "show", startMs: 2700, endMs: 3000 },
      { text: "you", startMs: 3000, endMs: 3300 },
    ],
  },
  {
    startMs: 3300,
    endMs: 5500,
    words: [
      { text: "how", startMs: 3400, endMs: 3600 },
      { text: "to", startMs: 3600, endMs: 3800 },
      { text: "build", startMs: 3800, endMs: 4200 },
      { text: "gorgeous", startMs: 4200, endMs: 4700 },
      { text: "text", startMs: 4700, endMs: 5000 },
      { text: "animations.", startMs: 5000, endMs: 5500 },
    ],
  },
];
