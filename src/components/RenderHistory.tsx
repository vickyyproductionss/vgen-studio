import { useState, useEffect } from 'react';
import { Download, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Film } from 'lucide-react';

interface RenderJob {
  jobId: string;
  userId: string;
  type: string;
  title: string;
  status: 'rendering' | 'completed' | 'failed';
  progress: number;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
  completedAt?: string;
}

export default function RenderHistory() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/renders', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('vgen_token') || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (e) {
      console.error('Failed to fetch render history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Auto-refresh every 5s if any job is still rendering
    const interval = setInterval(() => {
      setJobs(prev => {
        const hasActive = prev.some(j => j.status === 'rendering');
        if (hasActive) fetchJobs();
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (createdAt: string, completedAt?: string) => {
    if (!completedAt) return null;
    const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
    const secs = Math.round(ms / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const StatusIcon = ({ status }: { status: RenderJob['status'] }) => {
    if (status === 'completed') return <CheckCircle size={15} color="#22c55e" />;
    if (status === 'failed') return <XCircle size={15} color="#ef4444" />;
    return <Loader2 size={15} color="var(--primary)" className="spin" />;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: '10px', color: 'var(--text-gray)' }}>
        <Loader2 size={20} className="spin" />
        Loading render history...
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)', margin: 0, fontFamily: 'var(--font-headline)' }}>
            Render History
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-gray)' }}>
            All your renders — close the tab anytime, they run in the background
          </p>
        </div>
        <button
          onClick={() => fetchJobs(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '8px', color: 'var(--text-gray)', cursor: 'pointer',
            fontSize: '12px', fontWeight: 500, opacity: refreshing ? 0.6 : 1
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Empty State */}
      {jobs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '64px 32px',
          background: 'var(--surface)', borderRadius: '16px',
          border: '1px solid var(--border)'
        }}>
          <Film size={40} color="var(--text-gray)" style={{ marginBottom: '16px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-gray)', fontSize: '14px', margin: 0 }}>No renders yet</p>
          <p style={{ color: 'var(--text-gray)', fontSize: '12px', margin: '6px 0 0', opacity: 0.6 }}>
            Start a video render and it will appear here
          </p>
        </div>
      )}

      {/* Job List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {jobs.map(job => (
          <div key={job.jobId} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '16px',
            transition: 'border-color 0.2s',
          }}>
            {/* Icon */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
              background: job.status === 'completed' ? 'rgba(34,197,94,0.1)' : job.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(var(--primary-rgb),0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <StatusIcon status={job.status} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-white)', fontFamily: 'var(--font-headline)' }}>
                  {job.title || 'Video Render'}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: job.status === 'completed' ? 'rgba(34,197,94,0.15)' : job.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(var(--primary-rgb),0.15)',
                  color: job.status === 'completed' ? '#22c55e' : job.status === 'failed' ? '#ef4444' : 'var(--primary)',
                }}>
                  {job.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-gray)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} />
                  {formatDate(job.createdAt)}
                </span>
                {job.completedAt && (
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)' }}>
                    ⏱ {formatDuration(job.createdAt, job.completedAt)}
                  </span>
                )}
                {job.type && (
                  <span style={{ fontSize: '11px', color: 'var(--text-gray)', textTransform: 'capitalize' }}>
                    {job.type}
                  </span>
                )}
              </div>

              {/* Progress bar for active renders */}
              {job.status === 'rendering' && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      background: 'linear-gradient(90deg, var(--primary), var(--primary-light, var(--primary)))',
                      width: `${job.progress}%`, transition: 'width 1s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-gray)', marginTop: '3px', display: 'block' }}>
                    {job.progress}% complete — you can close this tab
                  </span>
                </div>
              )}

              {/* Error message */}
              {job.status === 'failed' && job.error && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#ef4444', opacity: 0.8 }}>
                  {job.error.slice(0, 120)}
                </p>
              )}
            </div>

            {/* Download button */}
            {job.status === 'completed' && job.resultUrl && (
              <a
                href={job.resultUrl}
                download
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px', textDecoration: 'none',
                  background: 'var(--primary)', color: 'var(--primary-foreground)',
                  fontSize: '12px', fontWeight: 600, flexShrink: 0,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Download size={13} />
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
