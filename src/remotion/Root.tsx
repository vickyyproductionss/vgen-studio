import { registerRoot, Composition } from 'remotion';
import { VideoReel } from './VideoReel';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoReel"
        component={VideoReel as React.ComponentType<any>}
        durationInFrames={900} // dynamic fallback duration, overwritten at render-time
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: [],
          subtitleMode: 'classic',
          fontName: 'Montserrat ExtraBold',
          fontSize: 26,
          bold: true,
          italic: false,
          shadow: false,
          activeWordScale: 1.15,
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
