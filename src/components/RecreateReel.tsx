import React, { useState, useEffect } from 'react';
import { Link2, Sparkles, Video, Type, Music, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, FileVideo, Trash2 } from 'lucide-react';

interface RecreateReelProps {
  onOpenProject: (projectId: string, type: 'create' | 'beatsync' | 'talkinghead') => void;
}

interface Clip {
  id: string;
  name: string;
  thumbnailUrl?: string;
  duration: number;
}

interface Scene {
  start_time: number;
  end_time: number;
  visual_description: string;
}

interface TextOverlay {
  text: string;
  start_time: number;
  end_time: number;
  position: string;
}

interface AnalysisData {
  description: string;
  scenes: Scene[];
  textOverlays: TextOverlay[];
}

type RecreateStep = 'idle' | 'downloading' | 'extracting' | 'analyzing' | 'matching' | 'creating' | 'done';

export default function RecreateReel({ onOpenProject }: RecreateReelProps) {
  const [url, setUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [step, setStep] = useState<RecreateStep>('idle');
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [createdProject, setCreatedProject] = useState<any | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [clips, setClips] = useState<Clip[]>([]);
  const [recreates, setRecreates] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [useAiFallback, setUseAiFallback] = useState(false);

  useEffect(() => {
    fetchClips();
    fetchRecreates();
  }, []);

  const fetchClips = async () => {
    try {
      const res = await fetch('/api/clips');
      if (res.ok) {
        const data = await res.json();
        setClips(data);
      }
    } catch (err) {
      console.error('Failed to fetch library clips:', err);
    }
  };

  const fetchRecreates = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/recreates');
      if (res.ok) {
        const data = await res.json();
        setRecreates(data);
      }
    } catch (err) {
      console.error('Failed to fetch recreation history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartRecreation = async (e?: React.FormEvent, savedRecreateId?: string) => {
    if (e) e.preventDefault();

    if (!savedRecreateId && !url) {
      setError('Please provide a valid Reel/Video link.');
      return;
    }

    setError('');
    setAnalysis(null);
    setCreatedProject(null);
    setVideoUrl('');
    
    // Step-by-step progress simulation on top of real API calls
    if (savedRecreateId) {
      setStep('matching');
    } else {
      setStep('downloading');
    }
    
    try {
      const response = await fetch('/api/recreate/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recreateId: savedRecreateId,
          url: savedRecreateId ? undefined : url,
          projectName: savedRecreateId ? undefined : (projectName.trim() || undefined),
          useAiFallback
        }),
      });

      if (!response.ok) {
        let errMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) {
          // Response wasn't JSON (e.g. 503 Service Unavailable HTML) — use status text
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      if (savedRecreateId) {
        // Fast-forward simulated progress steps for cached recreation
        setStep('creating');
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        // Advance steps to feel natural for fresh download
        setStep('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setStep('analyzing');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setStep('matching');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setStep('creating');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setAnalysis(data.analysis);
      setCreatedProject(data.project);
      setVideoUrl(data.videoUrl);
      setStep('done');
      
      // Refresh history list since we saved a new one
      fetchRecreates();
    } catch (err: any) {
      console.error('[Recreation UI Error]', err);
      setError(err.message || 'An error occurred during replication.');
      setStep('idle');
    }
  };

  const handleDeleteRecreate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this recreation history item and its downloaded files?')) {
      return;
    }

    try {
      const res = await fetch(`/api/recreates/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setRecreates(recreates.filter(r => r.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete history item.');
      }
    } catch (err) {
      console.error('Failed to delete recreation:', err);
      alert('An error occurred while deleting.');
    }
  };

  const getClipThumbnail = (clipId: string) => {
    const matched = clips.find(c => c.id === clipId);
    return matched?.thumbnailUrl || '/uploads/thumbnails/placeholder.jpg';
  };

  const getClipName = (clipId: string) => {
    const matched = clips.find(c => c.id === clipId);
    return matched?.name || 'Library Clip';
  };

  const renderStepIcon = (currentStep: RecreateStep, targetStep: RecreateStep, defaultIcon: React.ReactNode) => {
    const stepOrder: RecreateStep[] = ['idle', 'downloading', 'extracting', 'analyzing', 'matching', 'creating', 'done'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);

    if (currentStep === 'idle') return defaultIcon;
    if (currentIndex > targetIndex) {
      return <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />;
    }
    if (currentStep === targetStep) {
      return <RefreshCw size={18} className="spin" style={{ color: 'var(--accent-purple)' }} />;
    }
    return defaultIcon;
  };

  return (
    <div style={{ animation: 'slideUp 0.3s ease', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles style={{ color: 'var(--accent-purple)' }} />
          Replicate Reel
        </h2>
        <p style={{ color: 'var(--text-gray)', fontSize: '14px' }}>
          Paste a working Reel/Short link, and Gemini will analyze and replicate the pacing, on-screen text, and visuals matching your local library.
        </p>
      </div>

      {step === 'idle' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
          {/* Form Column */}
          <form onSubmit={(e) => handleStartRecreation(e)} className="glass-panel" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: 600 }}>Create New Replication</h3>
            
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label className="label" htmlFor="reel-url">Reel / Video Link</label>
              <div style={{ position: 'relative' }}>
                <Link2 size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                <input
                  id="reel-url"
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '40px' }}
                  placeholder="https://www.instagram.com/reel/... or https://www.youtube.com/shorts/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label className="label" htmlFor="proj-name">Project Name (Optional)</label>
              <input
                id="proj-name"
                type="text"
                className="input-field"
                placeholder="e.g. Instagram Gym Motivation Recreation"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <input
                type="checkbox"
                id="use-ai-fallback-toggle-recreate"
                checked={useAiFallback}
                onChange={(e) => setUseAiFallback(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="use-ai-fallback-toggle-recreate" style={{ fontSize: '13px', color: 'var(--text-white)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none', margin: 0, fontWeight: 500 }}>
                <Sparkles size={14} color="var(--primary)" fill="var(--primary)" /> Use AI Generated Fallback Clips / Images
              </label>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
              <Sparkles size={18} />
              Download & Analyze Reel
            </button>
          </form>

          {/* History Column */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileVideo size={18} style={{ color: 'var(--accent-purple)' }} />
              Previous Recreations
            </h3>

            {loadingHistory ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw className="spin" size={24} style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--accent-purple)' }} />
                Loading history...
              </div>
            ) : recreates.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-light)' }}>
                No previously processed Reels. Enter a URL above to start!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                {recreates.map((item) => (
                  <div 
                    key={item.id} 
                    className="tonal-border"
                    style={{ 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      background: 'var(--bg-darker)',
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.projectName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ fontSize: '11px', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link2 size={10} /> Link
                        </a>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          • {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {item.projectId && (
                        <button
                          onClick={() => onOpenProject(item.projectId, 'create')}
                          className="btn-primary"
                          style={{ fontSize: '11px', padding: '4px 10px', height: '28px' }}
                          title="Open the saved recreation project directly"
                        >
                          Open Project
                        </button>
                      )}
                      <button
                        onClick={() => handleStartRecreation(undefined, item.id)}
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 10px', height: '28px', background: 'var(--bg-medium)' }}
                        title="Use cached download and analysis to recreate project"
                      >
                        {item.projectId ? 'Re-match Clips' : 'Select'}
                      </button>
                      <button
                        onClick={(e) => handleDeleteRecreate(item.id, e)}
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-light)', 
                          background: 'rgba(239, 68, 68, 0.08)', 
                          color: '#f87171', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        title="Delete from history"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step !== 'idle' && step !== 'done' && (
        <div className="glass-panel" style={{ padding: '40px', maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>Processing Video Replication</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: step === 'downloading' ? 1 : 0.6 }}>
              {renderStepIcon(step, 'downloading', <Link2 size={18} style={{ color: 'var(--text-muted)' }} />)}
              <div>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>Downloading Reel</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fetching video with python downloader</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: step === 'extracting' ? 1 : 0.6 }}>
              {renderStepIcon(step, 'extracting', <Music size={18} style={{ color: 'var(--text-muted)' }} />)}
              <div>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>Extracting Audio</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Isolating background music and voiceover</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: step === 'analyzing' ? 1 : 0.6 }}>
              {renderStepIcon(step, 'analyzing', <Video size={18} style={{ color: 'var(--text-muted)' }} />)}
              <div>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>Gemini Video Analysis</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Understanding scenes, cuts, and text overlays</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: step === 'matching' ? 1 : 0.6 }}>
              {renderStepIcon(step, 'matching', <Type size={18} style={{ color: 'var(--text-muted)' }} />)}
              <div>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>Matching Clip Library</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Finding similar videos in your local folder</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: step === 'creating' ? 1 : 0.6 }}>
              {renderStepIcon(step, 'creating', <Sparkles size={18} style={{ color: 'var(--text-muted)' }} />)}
              <div>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>Assembling Project</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Synchronizing timestamps and assets</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && analysis && createdProject && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', animation: 'fadeIn 0.4s ease' }}>
          
          {/* Reference Video */}
          <div>
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileVideo size={18} style={{ color: 'var(--accent-purple)' }} />
                Downloaded Reel Reference
              </h3>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', maxHeight: '500px', background: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video src={videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>AI Summary</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)', lineHeight: '1.5' }}>{analysis.description}</p>
              </div>
            </div>

            <button
              onClick={() => onOpenProject(createdProject.id, 'create')}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '16px' }}
            >
              Configure & Edit Recreated Timeline
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Analysis Breakdown */}
          <div className="glass-panel" style={{ padding: '24px', height: 'fit-content', maxHeight: '720px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Scene & Subtitle Breakdown</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {createdProject.state.scenes.map((scene: any, index: number) => (
                <div key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-purple)' }}>SCENE #{index + 1}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                      {scene.start_time.toFixed(1)}s - {scene.end_time.toFixed(1)}s ({(scene.end_time - scene.start_time).toFixed(1)}s)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                    {/* Matched library clip thumbnail */}
                    <div style={{ width: '80px', height: '60px', borderRadius: '6px', overflow: 'hidden', background: '#222', position: 'relative', flexShrink: 0 }}>
                      <img 
                        src={getClipThumbnail(scene.clipId)} 
                        alt="clip" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e: any) => { e.target.src = '/uploads/thumbnails/placeholder.jpg' }}
                      />
                      <div style={{ position: 'absolute', bottom: '2px', right: '4px', fontSize: '9px', background: 'rgba(0,0,0,0.6)', padding: '0 4px', borderRadius: '2px' }}>
                        clip
                      </div>
                    </div>

                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Original: <span style={{ color: 'var(--text-gray)' }}>{analysis.scenes[index]?.visual_description}</span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>
                        Matched: <span style={{ color: 'var(--accent-blue)' }}>{getClipName(scene.clipId)}</span>
                      </div>
                    </div>
                  </div>

                  {scene.text && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(138, 75, 243, 0.08)', borderLeft: '3px solid var(--accent-purple)', padding: '6px 12px', borderRadius: '0 6px 6px 0' }}>
                      <Type size={14} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-gray)' }}>
                        "{scene.text}"
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
