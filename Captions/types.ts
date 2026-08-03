export interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

export interface CaptionPage {
  words: Word[];
  startMs: number;
  endMs: number;
}
