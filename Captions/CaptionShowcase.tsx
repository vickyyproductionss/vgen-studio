import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TikTokCaptions } from "./TikTokCaptions";
import { FadeRevealCaptions } from "./FadeRevealCaptions";
import { KaraokeCaptions } from "./KaraokeCaptions";
import { EmojiCaptions } from "./EmojiCaptions";
import { GlitchCaptions } from "./GlitchCaptions";
import { TypewriterCaptions } from "./TypewriterCaptions";
import { GlowCaptions } from "./GlowCaptions";
import { mockCaptions } from "./mockCaptions";

export const CaptionShowcase: React.FC = () => {
  const frame = useCurrentFrame();

  // Loop the captions animation every 170 frames (~5.6 seconds)
  const loopDuration = 170;
  const loopedFrame = frame % loopDuration;

  // We transition from Screen 1 to Screen 2 at frame 180 (exactly 6 seconds in at 30 fps)
  const transitionFrame = 180;
  
  // Interpolation for Screen 1 exit (sliding left and fading out)
  const screen1Opacity = interpolate(frame, [transitionFrame - 15, transitionFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const screen1TranslateX = interpolate(frame, [transitionFrame - 15, transitionFrame], [0, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Interpolation for Screen 2 entry (sliding in from right and fading in)
  const screen2Opacity = interpolate(frame, [transitionFrame, transitionFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const screen2TranslateX = interpolate(frame, [transitionFrame, transitionFrame + 15], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="bg-radial from-slate-950 to-zinc-950 flex flex-col justify-between items-center py-8 text-white font-sans overflow-hidden">
      {/* Decorative background grid and glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="z-20 text-center flex flex-col gap-1 mt-2">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent uppercase">
          Reusable Caption Styles
        </h1>
        <p className="text-slate-400 text-sm md:text-base font-semibold tracking-wide">
          {frame < transitionFrame ? "Gallery Page 1 of 2: Core Subtitles" : "Gallery Page 2 of 2: Advanced Effects"}
        </p>
      </div>

      {/* Container for Screens */}
      <div className="z-10 w-full max-w-6xl flex-grow flex items-center justify-center relative my-4">
        {/* Screen 1 (TikTok, Fade, Karaoke, Emoji) */}
        <div
          style={{
            opacity: screen1Opacity,
            transform: `translateX(${screen1TranslateX}%)`,
            position: "absolute",
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: "1.25rem",
            pointerEvents: frame >= transitionFrame ? "none" : "auto",
          }}
        >
          {/* Style 1: TikTok Pop */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-4 rounded-2xl shadow-lg">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 px-3 py-0.5 text-3xs font-black tracking-widest text-yellow-300 rounded-br-xl border-r border-b border-yellow-500/20 uppercase">
              TikTok Highlight Style
            </div>
            <div className="w-full flex justify-center items-center mt-2 min-h-[100px]">
              <TikTokCaptions pages={mockCaptions} activeColor="#FACC15" customFrame={loopedFrame} />
            </div>
          </div>

          {/* Style 2: Staggered Fade Reveal */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-4 rounded-2xl shadow-lg">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-emerald-500/30 to-teal-500/30 px-3 py-0.5 text-3xs font-black tracking-widest text-emerald-300 rounded-br-xl border-r border-b border-emerald-500/20 uppercase">
              Staggered Fade Reveal
            </div>
            <div className="w-full flex justify-center items-center mt-2 min-h-[100px]">
              <FadeRevealCaptions pages={mockCaptions} customFrame={loopedFrame} />
            </div>
          </div>

          {/* Style 3: Smooth Karaoke */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-4 rounded-2xl shadow-lg">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 px-3 py-0.5 text-3xs font-black tracking-widest text-blue-300 rounded-br-xl border-r border-b border-blue-500/20 uppercase">
              Smooth Karaoke Style
            </div>
            <div className="w-full flex justify-center items-center mt-2 min-h-[100px]">
              <KaraokeCaptions pages={mockCaptions} activeColor="#38BDF8" customFrame={loopedFrame} />
            </div>
          </div>

          {/* Style 4: Emoji Pop-up Overlay */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-4 rounded-2xl shadow-lg">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-purple-500/30 to-pink-500/30 px-3 py-0.5 text-3xs font-black tracking-widest text-purple-300 rounded-br-xl border-r border-b border-purple-500/20 uppercase">
              Emoji Pop-up Highlight
            </div>
            <div className="w-full flex justify-center items-center mt-2 min-h-[100px]">
              <EmojiCaptions pages={mockCaptions} activeColor="#22C55E" customFrame={loopedFrame} />
            </div>
          </div>
        </div>

        {/* Screen 2 (Glitch, Typewriter, Neon Glow, Instructions) */}
        <div
          style={{
            opacity: screen2Opacity,
            transform: `translateX(${screen2TranslateX}%)`,
            position: "absolute",
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: "1.25rem",
            pointerEvents: frame < transitionFrame ? "none" : "auto",
          }}
        >
          {/* Style 5: Glitch RGB Reveal */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-4 rounded-2xl shadow-lg">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-red-500/30 to-rose-500/30 px-3 py-0.5 text-3xs font-black tracking-widest text-rose-300 rounded-br-xl border-r border-b border-rose-500/20 uppercase">
              Glitch RGB Reveal
            </div>
            <div className="w-full flex justify-center items-center mt-2 min-h-[100px]">
              <GlitchCaptions pages={mockCaptions} activeColor="#00FFFF" customFrame={loopedFrame} />
            </div>
          </div>

          {/* Style 6: Typewriter Narration */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-4 rounded-2xl shadow-lg">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-orange-500/30 to-amber-500/30 px-3 py-0.5 text-3xs font-black tracking-widest text-amber-300 rounded-br-xl border-r border-b border-amber-500/20 uppercase">
              Typewriter Narration
            </div>
            <div className="w-full flex justify-center items-center mt-2 min-h-[100px]">
              <TypewriterCaptions pages={mockCaptions} customFrame={loopedFrame} />
            </div>
          </div>

          {/* Style 7: Neon Glow Style */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-4 rounded-2xl shadow-lg">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-pink-500/30 to-fuchsia-500/30 px-3 py-0.5 text-3xs font-black tracking-widest text-pink-300 rounded-br-xl border-r border-b border-pink-500/20 uppercase">
              Neon Pulsing Glow
            </div>
            <div className="w-full flex justify-center items-center mt-2 min-h-[100px]">
              <GlowCaptions pages={mockCaptions} glowColor="#F43F5E" customFrame={loopedFrame} />
            </div>
          </div>

          {/* Card 8: Quick Instructions */}
          <div className="relative flex flex-col justify-center items-center bg-gradient-to-br from-indigo-950/40 to-slate-950/80 backdrop-blur-md border border-indigo-900/40 p-6 rounded-2xl shadow-lg text-center">
            <h3 className="text-lg font-bold text-indigo-300 mb-1">🚀 Reusable & Portable</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              All styles are fully self-contained. Copy the files from the <code className="text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded font-mono text-[10px]">src/Captions/</code> folder directly to your other projects to use them!
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Pagination Indicator */}
      <div className="z-20 flex justify-center items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full transition-all duration-300 ${frame < transitionFrame ? "bg-indigo-400 scale-125" : "bg-slate-700"}`} />
        <span className={`w-2 h-2 rounded-full transition-all duration-300 ${frame >= transitionFrame ? "bg-indigo-400 scale-125" : "bg-slate-700"}`} />
      </div>
    </AbsoluteFill>
  );
};
