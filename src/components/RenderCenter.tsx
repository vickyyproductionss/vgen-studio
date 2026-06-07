import { useState, useEffect } from 'react';
import { Play, Download, Copy, RefreshCw, AlertCircle, CheckCircle2, Film } from 'lucide-react';

interface RenderCenterProps {
  jobId: string | null;
  onClearJob: () => void;
}

interface JobState {
  id: string;
  progress: number;
  status: string;
  resultUrl: string | null;
  error: string | null;
}

export default function RenderCenter({ jobId, onClearJob }: RenderCenterProps) {
  const [job, setJob] = useState<JobState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    setLogs(['Queued in rendering engine...']);
    
    // Connect to Server Sent Events (SSE)
    const eventSource = new EventSource(`/api/jobs/${jobId}/progress`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as JobState;
      setJob(data);

      setLogs(prev => {
        // Only append status log if it's new
        if (prev.length === 0 || prev[prev.length - 1] !== data.status) {
          return [...prev, data.status];
        }
        return prev;
      });

      if (data.progress >= 100 || data.status === 'Completed' || data.status === 'Failed') {
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      setLogs(prev => [...prev, 'Error: Lost connection to render engine.']);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  const copyPathToClipboard = () => {
    if (!job?.resultUrl) return;
    // Map relative uploads URL to a simulated absolute workspace path for user convenience
    // Since it's a local app, we can construct the backend folder path
    const filename = job.resultUrl.split('/').pop();
    const absolutePath = `/Volumes/1TB/WebProjects/VideoGenerator/backend/uploads/generated/${filename}`;
    navigator.clipboard.writeText(absolutePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!jobId) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'hsl(var(--text-gray))', animation: 'slideUp 0.3s ease' }}>
        <Film size={48} style={{ color: 'hsl(var(--text-muted))', marginBottom: '16px' }} />
        <h3>No rendering jobs active</h3>
        <p style={{ fontSize: '14px', marginTop: '8px', color: 'hsl(var(--text-muted))' }}>
          Go to the "Create Project" tab to customize subtitle styles, storyboard your scenes, and compile your video.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', animation: 'slideUp 0.3s ease' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Render Center</h2>
          <p style={{ color: 'hsl(var(--text-gray))', fontSize: '14px' }}>
            Job ID: <code style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{jobId}</code>
          </p>
        </div>
        <button className="btn-secondary" onClick={onClearJob} style={{ padding: '8px 16px', fontSize: '13px' }}>
          Clear Session
        </button>
      </div>

      {/* Progress Card */}
      <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
        {job ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {job.status === 'Completed' ? (
                  <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={18} /> Render Complete!</span>
                ) : job.status === 'Failed' ? (
                  <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={18} /> Rendering Failed</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} className="spin" style={{ animation: 'spin-slow 2s linear infinite' }} />
                    Generating Video Asset...
                  </span>
                )}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>{job.progress}%</span>
            </div>

            {/* Progress bar container */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '24px', border: '1px solid var(--border-light)' }}>
              <div style={{
                width: `${job.progress}%`,
                height: '100%',
                background: '#ffffff',
                borderRadius: '99px',
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* Error Message */}
            {job.error && (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', fontSize: '14px', marginBottom: '24px' }}>
                <strong>Render Error:</strong> {job.error}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <RefreshCw size={24} className="spin" style={{ animation: 'spin-slow 2s linear infinite' }} />
          </div>
        )}

        {/* Logs terminal */}
        <div>
          <span style={{ fontSize: '12px', color: 'hsl(var(--text-gray))', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Pipeline Status Log</span>
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-light)',
            borderRadius: '6px',
            padding: '16px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#34d399',
            maxHeight: '160px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {logs.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'hsl(var(--text-muted))' }}>&gt;</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Result Player Card */}
      {job?.resultUrl && (
        <div className="glass-panel" style={{ padding: '32px', animation: 'slideUp 0.4s ease' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Play size={16} />
            Video Preview Player
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
            {/* Player */}
            <div style={{
              position: 'relative',
              width: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#05060b',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <video
                src={`${job.resultUrl}?t=${Date.now()}`}
                controls
                style={{
                  width: '100%',
                  display: 'block',
                  maxHeight: '420px'
                }}
              />
            </div>

            {/* Info details & Export actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>Render Successful</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-gray))', lineHeight: '1.4' }}>
                  The video has been compiled. Audio mixing, subtitle burns, aspect ratios, and transitions were applied successfully.
                </p>
              </div>

              <div>
                <label className="label">Render Path (macOS path)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    readOnly
                    value={`/Volumes/1TB/WebProjects/VideoGenerator/backend/uploads/generated/${job.resultUrl.split('/').pop()}`}
                    style={{ fontSize: '11px', fontFamily: 'monospace', flex: 1 }}
                  />
                  <button
                    onClick={copyPathToClipboard}
                    className="btn-secondary"
                    style={{ padding: '10px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Copy full local path"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                {copied && <span style={{ fontSize: '11px', color: '#34d399', display: 'block', marginTop: '4px' }}>Copied to clipboard!</span>}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <a
                  href={`${job.resultUrl}?t=${Date.now()}`}
                  download={`render_${jobId}.mp4`}
                  className="btn-primary"
                  style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', height: '46px' }}
                >
                  <Download size={16} />
                  Download File
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
