import { useState, useEffect, useRef } from 'react';
import { 
  Music, Video, Upload, Download, RefreshCw, 
  AlertCircle, CheckCircle2, Trash2, Settings, 
  Activity, Sparkles, ArrowRight, Check, X, RefreshCcw
} from 'lucide-react';

interface Clip {
  id: string;
  name: string;
  thumbnail: string;
  duration: number;
  status: string;
}

interface JobState {
  id: string;
  progress: number;
  status: string;
  resultUrl: string | null;
  error: string | null;
}

const PRESET_EFFECTS: Record<string, any> = {
  aggressive: { 
    whiteFlash: true, whiteFlashIntensity: 0.8, rgbSplit: true, rgbSplitPixels: 8, 
    speedRamp: true, speedRampHold: 0.1, speedRampPreset: 'hero', speedRampV0: 2.0, 
    speedRampV1: 0.5, speedRampV2: 2.0, whipPan: true, whipPanStrength: 35, 
    bassBounce: true, bassBounceScale: 1.08, preset: 'aggressive' 
  },
  cinematic: { 
    speedRamp: true, speedRampHold: 0.15, speedRampPreset: 'hero', speedRampV0: 2.0, 
    speedRampV1: 0.5, speedRampV2: 2.0, colorFlash: true, colorFlashTint: '#FF6B00', 
    vignettePulse: true, letterbox: true, letterboxSize: 50, filmGrain: true, 
    filmGrainAmount: 10, preset: 'cinematic' 
  },
  glitch: { 
    rgbSplit: true, rgbSplitPixels: 10, glitchTear: true, glitchTearPixels: 25, 
    negativeFlash: true, whiteFlash: true, whiteFlashIntensity: 0.5, preset: 'glitch' 
  },
  clean: { 
    bassBounce: true, bassBounceScale: 1.06, vignettePulse: true, preset: 'clean' 
  },
  none: { 
    whiteFlash: false, rgbSplit: false, bassBounce: false, preset: 'none' 
  }
};

const TRANSITIONS = [
  { value: 'none', label: 'Cut (No Transition)' },
  { value: 'fade', label: '0.25s Fade to Black' },
  { value: 'random', label: '🎲 Randomly Mix Transitions' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'blur-slide-left', label: 'Blurred Slide Left' },
  { value: 'blur-slide-right', label: 'Blurred Slide Right' },
  { value: 'blur-slide-up', label: 'Blurred Slide Up' },
  { value: 'blur-slide-down', label: 'Blurred Slide Down' },
];

export default function QuickBeatSync() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Step 1: Music Track States
  const [audioPath, setAudioPath] = useState<string>('');
  const [audioName, setAudioName] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(1.4);
  
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);
  
  const [beats, setBeats] = useState<number[]>([]);
  const [miniBeats, setMiniBeats] = useState<number[]>([]);
  const [boundaries, setBoundaries] = useState<number[]>([]);
  
  // Step 2: Media Asset States
  const [uploadedClips, setUploadedClips] = useState<Clip[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [effectPreset, setEffectPreset] = useState<string>('cinematic');
  const [transitionStyle, setTransitionStyle] = useState<string>('random');
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [shakeIntensity, setShakeIntensity] = useState(15);
  const [shakeSpeed, setShakeSpeed] = useState(20);
  
  // Step 3: Compile / Render States
  const [compiling, setCompiling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [renderLogs, setRenderLogs] = useState<string[]>([]);
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [renderLogs]);

  // Clean up SSE on unmount
  useEffect(() => {
    let eventSource: EventSource | null = null;
    if (jobId) {
      setRenderLogs(['Preparing rendering engine...']);
      eventSource = new EventSource(`/api/jobs/${jobId}/progress`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data) as JobState;
        setJob(data);
        setRenderLogs(prev => {
          if (prev.length === 0 || prev[prev.length - 1] !== data.status) {
            return [...prev, data.status];
          }
          return prev;
        });

        if (data.progress >= 100 || data.status === 'Completed' || data.status === 'Failed') {
          eventSource?.close();
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        setRenderLogs(prev => [...prev, 'Error: Connection interrupted. Stated progress is cached.']);
        eventSource?.close();
      };
    }
    return () => {
      eventSource?.close();
    };
  }, [jobId]);

  // ── Step 1 handlers ──
  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    setAudioName(file.name);
    
    // Upload it immediately to the server to get path
    setUploadingAudio(true);
    const formData = new FormData();
    formData.append('audio', file);
    
    try {
      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Audio upload failed.');
      const data = await res.json();
      setAudioPath(data.audioPath);
      
      // Fetch duration of uploaded audio
      const durRes = await fetch(`/api/bgms/duration?path=${encodeURIComponent(data.audioPath)}`);
      if (durRes.ok) {
        const durData = await durRes.json();
        setAudioDuration(durData.duration || 10.0);
      } else {
        setAudioDuration(15.0); // Fallback
      }
      setSuccess('Audio uploaded successfully! Now click "Analyze Track" below.');
    } catch (err: any) {
      setError(err.message || 'Failed to upload audio file.');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleAnalyzeTrack = async () => {
    if (!audioPath) {
      setError('Please upload an audio or video track first.');
      return;
    }
    setAnalyzingAudio(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/beat-sync/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, threshold })
      });
      
      if (!res.ok) throw new Error('Beat detection failed.');
      
      const data = await res.json();
      const detectedBeats = data.beats || [];
      const detectedMiniBeats = data.miniBeats || [];
      
      const bounds = [0.0, ...detectedBeats, audioDuration].sort((a, b) => a - b);
      const uniqueBounds = bounds.filter((val, i, arr) => i === 0 || val > arr[i-1] + 0.05);
      
      setBeats(detectedBeats);
      setMiniBeats(detectedMiniBeats);
      setBoundaries(uniqueBounds);
      
      setSuccess(`Analysis complete! Found ${detectedBeats.length} major cuts and ${detectedMiniBeats.length} sub-beats.`);
      
      // Automatically advance to Step 2 after a small delay
      setTimeout(() => {
        setStep(2);
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error running audio analysis.');
    } finally {
      setAnalyzingAudio(false);
    }
  };

  // ── Step 2 handlers ──
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingMedia(true);
    setError('');
    setSuccess('');
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('videos', files[i]);
    }
    
    try {
      const res = await fetch('/api/clips/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to upload video clips.');
      
      const data = await res.json();
      setUploadedClips(prev => [...prev, ...data]);
      setSuccess(`Successfully uploaded ${data.length} clips!`);
    } catch (err: any) {
      setError(err.message || 'Failed to upload clips.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const deleteClip = (clipId: string) => {
    setUploadedClips(prev => prev.filter(c => c.id !== clipId));
  };

  // Helper to generate a random selection from transitions
  const getRandomTransition = () => {
    const pool = ['fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'blur-slide-left', 'blur-slide-right', 'blur-slide-up', 'blur-slide-down'];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const handleProceedToRender = async () => {
    if (uploadedClips.length === 0) {
      setError('Please upload at least 1 video or photo clip.');
      return;
    }
    
    setCompiling(true);
    setError('');
    setSuccess('');
    setStep(3);
    
    try {
      // 1. Create a temporary project to hold this render session
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `Quick Beat Sync - ${audioName}`, 
          type: 'beatsync' 
        })
      });
      if (!projRes.ok) throw new Error('Failed to initialize render project.');
      const project = await projRes.json();
      
      // 2. Build scenes based on detected boundaries
      const scenes: any[] = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const start = boundaries[i];
        const end = boundaries[i + 1];
        const duration = end - start;
        
        // Cycle through uploaded clips
        const clip = uploadedClips[i % uploadedClips.length];
        
        // Pick a random clipStart offset if the clip is longer than the segment
        let clipStart = 0;
        if (clip.duration > duration) {
          const maxStart = clip.duration - duration;
          clipStart = Math.random() * maxStart;
        }
        clipStart = parseFloat(clipStart.toFixed(2));
        
        // Handle transitions
        let currentSceneTransition = transitionStyle;
        if (transitionStyle === 'random') {
          currentSceneTransition = getRandomTransition();
        }
        
        scenes.push({
          start_time: start,
          end_time: end,
          clipId: clip.id,
          clipStart,
          transition: currentSceneTransition !== 'none' ? currentSceneTransition : undefined,
          transitionDuration: currentSceneTransition !== 'none' ? 0.3 : undefined,
          text: '',
          words: [],
          shake: shakeEnabled,
          shakeIntensity: shakeEnabled ? shakeIntensity : undefined,
          shakeSpeed: shakeEnabled ? shakeSpeed : undefined
        });
      }
      
      // 3. Trigger compilation
      const beatEffects = PRESET_EFFECTS[effectPreset] || PRESET_EFFECTS.none;
      const renderRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          scenes,
          voiceoverPath: audioPath,
          bgMusicPath: '',
          aspectRatio,
          fillMode: 'crop',
          clipTransition: transitionStyle === 'random' ? 'none' : transitionStyle,
          transitionDuration: 0.3,
          beatEffects,
          zoomAnimation: true,
          exportResolution: '1080p',
          exportFps: 30,
          miniBeats,
          miniBeatEffect: ['glitch', 'aggressive'].includes(effectPreset) ? 'blink' : 'none',
          subtitleStyle: { subtitleMode: 'none' } // No subtitle transcription needed for audio beat sync
        })
      });
      
      if (!renderRes.ok) {
        const errData = await renderRes.json();
        throw new Error(errData.error || 'Failed to submit render job.');
      }
      
      const renderData = await renderRes.json();
      setJobId(renderData.jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to start video rendering.');
      setCompiling(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setAudioPath('');
    setAudioName('');
    setAudioDuration(0);
    setBeats([]);
    setMiniBeats([]);
    setBoundaries([]);
    setUploadedClips([]);
    setJobId(null);
    setJob(null);
    setRenderLogs([]);
    setError('');
    setSuccess('');
    setCompiling(false);
  };

  const getThresholdLabel = () => {
    if (threshold <= 1.2) return 'High Frequency (Fast cuts)';
    if (threshold >= 1.6) return 'Low Frequency (Chill, slow cuts)';
    return 'Balanced Beat Detection';
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Visual Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center', animation: 'slideUp 0.3s ease' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 800, 
          background: 'linear-gradient(135deg, #FF6B00 0%, #FFA800 100%)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          Quick Beat Sync Wizard
        </h1>
        <p style={{ color: 'var(--text-gray)', fontSize: '15px' }}>
          Create amazing high-tempo video edits synchronized perfectly to your favorite music in seconds.
        </p>
      </div>

      {/* Stepper progress bar */}
      <div className="glass-panel" style={{ padding: '20px 32px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', 
            background: step === 1 ? 'var(--primary)' : step > 1 ? '#34d399' : 'rgba(255,255,255,0.05)',
            color: step >= 1 ? '#fff' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px'
          }}>
            {step > 1 ? <Check size={14} /> : '1'}
          </div>
          <span style={{ fontSize: '14px', fontWeight: step === 1 ? 600 : 400, color: step === 1 ? '#fff' : 'var(--text-gray)' }}>
            Soundtrack & Tempo
          </span>
        </div>
        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', 
            background: step === 2 ? 'var(--primary)' : step > 2 ? '#34d399' : 'rgba(255,255,255,0.05)',
            color: step >= 2 ? '#fff' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px'
          }}>
            {step > 2 ? <Check size={14} /> : '2'}
          </div>
          <span style={{ fontSize: '14px', fontWeight: step === 2 ? 600 : 400, color: step === 2 ? '#fff' : 'var(--text-gray)' }}>
            Add Media & Styles
          </span>
        </div>
        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', 
            background: step === 3 ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: step === 3 ? '#fff' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px'
          }}>
            3
          </div>
          <span style={{ fontSize: '14px', fontWeight: step === 3 ? 600 : 400, color: step === 3 ? '#fff' : 'var(--text-gray)' }}>
            Magic Render
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'shake 0.3s ease' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '14px' }}>{error}</span>
          <button style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }} onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {success && (
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34d399', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'slideUp 0.3s ease' }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '14px' }}>{success}</span>
          <button style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer' }} onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {/* STEP 1: UPLOAD SOUNDTRACK */}
      {step === 1 && (
        <div className="glass-panel" style={{ padding: '40px', animation: 'slideUp 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(255, 107, 0, 0.08)', color: 'var(--primary)', marginBottom: '16px' }}>
              <Music size={32} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Select background audio track</h2>
            <p style={{ color: 'var(--text-gray)', fontSize: '14px', maxWidth: '500px', margin: '0 auto' }}>
              Upload any music file (`.mp3`, `.wav`) or a video clip containing audio. We will analyze the transients to identify beats automatically.
            </p>
          </div>

          {/* Upload Box */}
          <div 
            onClick={() => audioInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-light)',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.01)',
              transition: 'border-color 0.2s, background-color 0.2s',
              marginBottom: '32px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.backgroundColor = 'rgba(255,107,0,0.02)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)';
            }}
          >
            <input 
              type="file" 
              ref={audioInputRef} 
              style={{ display: 'none' }} 
              accept="audio/*,video/*"
              onChange={handleAudioSelect}
            />
            {uploadingAudio ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <RefreshCw size={32} className="spin" style={{ color: 'var(--primary)', animation: 'spin-slow 2s linear infinite' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-gray)' }}>Uploading track...</span>
              </div>
            ) : audioPath ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={32} style={{ color: '#34d399' }} />
                <span style={{ fontSize: '15px', fontWeight: 600 }}>{audioName}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>
                  Duration: {audioDuration.toFixed(1)}s (Ready for beat detection)
                </span>
                <span style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '8px', textDecoration: 'underline' }}>
                  Click to replace track
                </span>
              </div>
            ) : (
              <div>
                <Upload size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
                  Drag & Drop file or click to browse
                </span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Supports MP3, WAV, AAC, MP4, MOV (Max size 100MB)
                </span>
              </div>
            )}
          </div>

          {/* Threshold Adjuster */}
          {audioPath && (
            <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={16} style={{ color: 'var(--primary)' }} />
                  Beat Sync Sensitivity
                </span>
                <span style={{ fontSize: '12px', background: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  {threshold.toFixed(2)}
                </span>
              </div>
              <input 
                type="range" 
                min="0.8" 
                max="2.0" 
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>More Cuts (Frenetic)</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{getThresholdLabel()}</span>
                <span>Fewer Cuts (Chill)</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          {audioPath && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn-primary" 
                onClick={handleAnalyzeTrack}
                disabled={analyzingAudio}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', 
                  fontSize: '14px', boxShadow: '0 4px 12px rgba(255, 107, 0, 0.2)'
                }}
              >
                {analyzingAudio ? (
                  <>
                    <RefreshCw size={16} className="spin" style={{ animation: 'spin-slow 2s linear infinite' }} />
                    Detecting beats...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Analyze Track
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: UPLOAD CLIPS & CHOOSE STYLES */}
      {step === 2 && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          
          {/* Analysis Info Card */}
          <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', background: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>
                  Track Analysis Successful
                </h3>
                <p style={{ color: 'var(--text-gray)', fontSize: '13px' }}>
                  Detected <strong style={{ color: '#fff' }}>{beats.length} major beats</strong> in the track. You need to provide <strong style={{ color: '#fff' }}>{boundaries.length - 1} clips or photos</strong> to sync perfectly.
                </p>
              </div>
              <button 
                className="btn-secondary" 
                onClick={() => setStep(1)}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCcw size={12} /> Re-analyze Audio
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
            
            {/* Upload Clips Grid */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={18} style={{ color: 'var(--primary)' }} />
                Upload Videos & Photos ({uploadedClips.length} of {boundaries.length - 1} uploaded)
              </h2>

              <div 
                onClick={() => mediaInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-light)',
                  borderRadius: '10px',
                  padding: '32px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.01)',
                  transition: 'border-color 0.2s',
                  marginBottom: '24px'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
              >
                <input 
                  type="file" 
                  ref={mediaInputRef} 
                  style={{ display: 'none' }} 
                  multiple
                  accept="video/*,image/*"
                  onChange={handleMediaUpload}
                />
                {uploadingMedia ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)', animation: 'spin-slow 2s linear infinite' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Processing and converting uploads...</span>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                      Drag & Drop files or click to browse
                    </span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Supports MP4, MOV, PNG, JPG. We recommend providing exactly {boundaries.length - 1} files (extra files will cycle or be skipped).
                    </span>
                  </div>
                )}
              </div>

              {uploadedClips.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '16px' }}>
                  {uploadedClips.map((clip) => (
                    <div 
                      key={clip.id}
                      style={{
                        position: 'relative',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-light)',
                        aspectRatio: '1',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <img 
                        src={clip.thumbnail} 
                        alt={clip.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', zIndex: 1 }}
                      />
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%)', zIndex: 2 }} />
                      
                      {/* Delete Clip */}
                      <button 
                        onClick={() => deleteClip(clip.id)}
                        style={{
                          position: 'absolute', top: '4px', right: '4px', zIndex: 3,
                          background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '4px',
                          color: '#fff', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                        }}
                      >
                        <Trash2 size={12} />
                      </button>

                      {/* Info details */}
                      <div style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', zIndex: 3, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {clip.name}
                        </span>
                        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.6)' }}>
                          {clip.duration.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No clips uploaded yet. Upload files to proceed.
                </div>
              )}
            </div>

            {/* Styling Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={16} style={{ color: 'var(--primary)' }} />
                  Style Preferences
                </h3>

                {/* Aspect Ratio */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="label" style={{ fontSize: '12px', marginBottom: '6px' }}>Aspect Ratio</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {(['9:16', '16:9', '1:1'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        className={aspectRatio === ratio ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setAspectRatio(ratio)}
                        style={{ padding: '6px 0', fontSize: '11px' }}
                      >
                        {ratio === '9:16' ? 'Vertical 📱' : ratio === '16:9' ? 'Landscape 🖥️' : 'Square ⬜'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Effect Presets */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="label" style={{ fontSize: '12px', marginBottom: '6px' }}>Beat Sync Presets</label>
                  <select
                    className="input-field"
                    value={effectPreset}
                    onChange={(e) => setEffectPreset(e.target.value)}
                    style={{ fontSize: '12px', height: '34px' }}
                  >
                    <option value="cinematic">Cinematic (Smooth ramps & glows)</option>
                    <option value="aggressive">Aggressive (Speed ramps, whip pans & flashes)</option>
                    <option value="glitch">Glitch (Glitch tear, negative flash, RGB split)</option>
                    <option value="clean">Clean (Subtle bass bounce)</option>
                    <option value="none">None (Cut only)</option>
                  </select>
                </div>

                {/* Transition Styles */}
                <div style={{ marginBottom: '24px' }}>
                  <label className="label" style={{ fontSize: '12px', marginBottom: '6px' }}>Transitions</label>
                  <select
                    className="input-field"
                    value={transitionStyle}
                    onChange={(e) => setTransitionStyle(e.target.value)}
                    style={{ fontSize: '12px', height: '34px' }}
                  >
                    {TRANSITIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Camera Shake Settings */}
                <div style={{ marginBottom: '24px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-medium)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: shakeEnabled ? '12px' : '0' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)' }}>Enable Camera Shake 📳</span>
                    <div 
                      className={`stitch-switch ${shakeEnabled ? 'active' : ''}`} 
                      onClick={() => setShakeEnabled(!shakeEnabled)}
                    >
                      <div className="stitch-switch-handle" />
                    </div>
                  </div>

                  {shakeEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      {/* Shake Intensity */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="label" style={{ fontSize: '11px', margin: 0 }}>Shake Intensity</label>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{shakeIntensity}px</span>
                        </div>
                        <input 
                          type="range" min={2} max={60} step={1} 
                          value={shakeIntensity} 
                          onChange={(e) => setShakeIntensity(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                      </div>

                      {/* Shake Speed */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="label" style={{ fontSize: '11px', margin: 0 }}>Shake Speed</label>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{shakeSpeed} Hz</span>
                        </div>
                        <input 
                          type="range" min={5} max={50} step={1} 
                          value={shakeSpeed} 
                          onChange={(e) => setShakeSpeed(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <button 
                  className="btn-primary"
                  onClick={handleProceedToRender}
                  disabled={uploadedClips.length === 0}
                  style={{
                    width: '100%', padding: '12px 0', fontSize: '14px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: uploadedClips.length > 0 ? '0 4px 12px rgba(255, 107, 0, 0.3)' : 'none',
                    opacity: uploadedClips.length === 0 ? 0.5 : 1
                  }}
                >
                  <Sparkles size={16} />
                  Generate Beat Sync Video
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* STEP 3: RENDER & SAVE */}
      {step === 3 && (
        <div className="glass-panel" style={{ padding: '36px', animation: 'slideUp 0.3s ease' }}>
          
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Magic Rendering Center</h2>
              <p style={{ color: 'var(--text-gray)', fontSize: '13px' }}>
                Analyzing frames and compiling the H.264 video.
              </p>
            </div>
            {(!compiling && job?.status === 'Completed') && (
              <button className="btn-secondary" onClick={resetWizard} style={{ padding: '8px 16px', fontSize: '13px' }}>
                Create New Edit
              </button>
            )}
          </div>

          {/* Render progress */}
          <div style={{ padding: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', borderRadius: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {job?.status === 'Completed' ? (
                  <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} /> Render Successful!</span>
                ) : job?.status === 'Failed' ? (
                  <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={16} /> Rendering Failed</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={14} className="spin" style={{ animation: 'spin-slow 2s linear infinite', color: 'var(--primary)' }} />
                    Running video synthesis...
                  </span>
                )}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>{job ? job.progress : 5}%</span>
            </div>

            {/* Progress bar container */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '20px', border: '1px solid var(--border-light)' }}>
              <div style={{
                width: `${job ? job.progress : 5}%`,
                height: '100%',
                background: 'var(--primary)',
                borderRadius: '99px',
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* Terminal logs */}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Terminal Output</span>
              <div 
                ref={logTerminalRef}
                style={{
                  background: '#090a0f',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#34d399',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                {renderLogs.map((log, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Render Result (Player + Download) */}
          {job?.resultUrl && (
            <div style={{ animation: 'slideUp 0.4s ease', borderTop: '1px solid var(--border-light)', paddingTop: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px', alignItems: 'center' }}>
                
                {/* Preview Player */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#000',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  aspectRatio: aspectRatio === '9:16' ? '9/16' : aspectRatio === '16:9' ? '16/9' : '1'
                }}>
                  <video
                    src={`${job.resultUrl}?t=${Date.now()}`}
                    controls
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block'
                    }}
                  />
                </div>

                {/* Actions */}
                <div>
                  <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', background: 'rgba(52, 211, 153, 0.08)', color: '#34d399', marginBottom: '16px' }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Your Video is Ready!</h3>
                  <p style={{ color: 'var(--text-gray)', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
                    The beat sync compilation has completed successfully! You can preview the video, download the file, or generate another version with different tracks.
                  </p>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <a 
                      href={job.resultUrl} 
                      download={`beatsync_${Date.now()}.mp4`}
                      className="btn-primary"
                      style={{
                        padding: '12px 24px', fontSize: '14px', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(255, 107, 0, 0.2)'
                      }}
                    >
                      <Download size={16} />
                      Download Video
                    </a>
                    <button 
                      className="btn-secondary" 
                      onClick={resetWizard}
                      style={{ padding: '12px 20px', fontSize: '14px' }}
                    >
                      Start Over
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
