import React, { useState, useEffect } from 'react';
import { Folder, Plus, Trash2, Search, AlertCircle, Play, Pencil } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  type: 'create' | 'beatsync' | 'talkinghead';
  updatedAt: string;
  state: any;
  diskSize?: number;
}

interface ProjectsListProps {
  onOpenProject: (projectId: string, type: 'create' | 'beatsync' | 'talkinghead') => void;
}



export default function ProjectsList({ onOpenProject }: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'create' | 'beatsync' | 'talkinghead'>('all');
  const [error, setError] = useState('');
  const [clips, setClips] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  
  // Ambient glow coordinate tracking
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchProjects();
    fetchClips();
    fetchActiveJobs();

    const handleMouseMove = (e: MouseEvent) => {
      setCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const interval = setInterval(() => {
      fetchActiveJobs();
    }, 4000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
    };
  }, []);

  const fetchClips = async () => {
    try {
      const res = await fetch('/api/clips');
      if (res.ok) {
        const data = await res.json();
        setClips(data);
      }
    } catch (err) {
      console.error('Failed to fetch clips:', err);
    }
  };

  const fetchActiveJobs = async () => {
    try {
      const res = await fetch('/api/jobs/active');
      if (res.ok) {
        const data = await res.json();
        setActiveJobs(data);
      }
    } catch (err) {
      console.error('Failed to fetch active jobs:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects.');
      const data = await res.json();
      data.sort((a: Project, b: Project) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setProjects(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getProjectThumbnail = (proj: Project) => {
    if (proj.state && Array.isArray(proj.state.scenes)) {
      const firstSceneWithClip = proj.state.scenes.find((s: any) => s.clipId);
      if (firstSceneWithClip) {
        const clip = clips.find(c => c.id === firstSceneWithClip.clipId);
        if (clip && clip.thumbnail) {
          return clip.thumbnail;
        }
      }
    }
    if (proj.state && proj.state.selectedVideoClipId) {
      const clip = clips.find(c => c.id === proj.state.selectedVideoClipId);
      if (clip && clip.thumbnail) {
        return clip.thumbnail;
      }
    }
    if (clips.length > 0 && clips[0].thumbnail) {
      return clips[0].thumbnail;
    }
    return proj.type === 'beatsync'
      ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60"
      : proj.type === 'talkinghead'
      ? "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500&auto=format&fit=crop&q=60"
      : "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=500&auto=format&fit=crop&q=60";
  };

  const getProjectState = (proj: Project) => {
    const activeJob = activeJobs.find(job => job.projectId === proj.id);
    if (activeJob) {
      return { type: 'generating', progress: activeJob.progress, statusText: activeJob.status };
    }
    if (proj.state && proj.state.lastRenderedVideoPath) {
      return { type: 'rendered' };
    }
    return { type: 'draft' };
  };

  const getProjectDuration = (proj: Project) => {
    if (proj.state) {
      if (typeof proj.state.audioDuration === 'number' && proj.state.audioDuration > 0) {
        return formatDuration(proj.state.audioDuration);
      }
      if (Array.isArray(proj.state.scenes) && proj.state.scenes.length > 0) {
        const maxEndTime = Math.max(...proj.state.scenes.map((s: any) => s.end_time || 0));
        if (maxEndTime > 0) {
          return formatDuration(maxEndTime);
        }
      }
    }
    return '0:00';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateProject = async (type: 'create' | 'beatsync' | 'talkinghead') => {
    try {
      setError('');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });

      if (!res.ok) throw new Error('Failed to create new project.');
      const newProj = await res.json();
      onOpenProject(newProj.id, newProj.type);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project.');
      setProjects(projects.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalProjects = projects.length;
  const totalDiskSize = projects.reduce((sum, p) => sum + (p.diskSize || 0), 0);
  const totalRenders = projects.filter(p => p.state?.lastRenderedVideoPath).length;

  const formatStorage = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 100) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  return (
    <div 
      style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '24px 0 64px 0',
        backgroundImage: `radial-gradient(circle at ${coords.x}px ${coords.y}px, rgba(255,255,255,0.015) 0%, transparent 45%)`,
        backgroundAttachment: 'fixed'
      }}
    >
      
      {/* Header section with Create triggers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h2 style={{ fontSize: '32px', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-white)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
            My Projects
          </h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '14px', fontFamily: 'Inter' }}>
            Manage and edit your generated cinematic sequences.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => handleCreateProject('create')}
            className="btn-secondary"
            style={{ padding: '0 16px', height: '36px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={14} />
            Voiceover Video
          </button>
          <button
            onClick={() => handleCreateProject('talkinghead')}
            className="btn-secondary"
            style={{ padding: '0 16px', height: '36px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={14} />
            Talking Head Video
          </button>
          <button
            onClick={() => handleCreateProject('beatsync')}
            className="btn-primary"
            style={{
              padding: '0 16px',
              height: '36px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={14} />
            Beat Sync Video
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#ff453a', borderRadius: '8px', fontSize: '13px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'create', 'talkinghead', 'beatsync'] as const).map(filter => (
            <button
              key={filter}
              className={typeFilter === filter ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTypeFilter(filter)}
              style={{ fontSize: '12px', padding: '6px 16px', textTransform: 'capitalize', fontWeight: typeFilter === filter ? 700 : 500 }}
            >
              {filter === 'create' ? 'Voiceover' : filter === 'talkinghead' ? 'Talking Head' : filter === 'beatsync' ? 'Beat Sync' : 'All Projects'}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
          <input
            type="text"
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            style={{ paddingLeft: '38px', margin: 0, height: '36px', fontSize: '13px', borderRadius: '9999px', background: 'var(--bg-surface)' }}
          />
        </div>
      </div>

      {/* Projects Bento Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '120px 0', color: 'var(--text-gray)' }}>
          <div className="spin-slow" style={{ display: 'inline-block', marginBottom: '16px' }}>
            <Plus size={32} />
          </div>
          <p style={{ fontSize: '14px', fontFamily: 'Inter' }}>Loading your project library...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '80px 20px', borderStyle: 'dashed', borderWidth: '2px', borderRadius: '8px' }}>
          <Folder size={48} style={{ margin: '0 auto 16px auto', color: 'rgba(255, 255, 255, 0.2)' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px', fontFamily: 'Outfit' }}>No projects found</h3>
          <p style={{ color: 'var(--text-gray)', fontSize: '13px', maxWidth: '320px', margin: '0 auto 24px auto', fontFamily: 'Inter' }}>
            {searchQuery || typeFilter !== 'all'
              ? 'Try modifying your search or category filters.'
              : 'Get started by creating a new Voiceover script, Talking Head video, or Beat Sync project.'}
          </p>
          {!searchQuery && typeFilter === 'all' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => handleCreateProject('create')} className="btn-secondary" style={{ fontSize: '12px', fontWeight: 600 }}>
                Voiceover Script
              </button>
              <button onClick={() => handleCreateProject('talkinghead')} className="btn-secondary" style={{ fontSize: '12px', fontWeight: 600 }}>
                Talking Head
              </button>
              <button onClick={() => handleCreateProject('beatsync')} className="btn-primary" style={{ fontSize: '12px', fontWeight: 700 }}>
                Beat Sync
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
          
          {/* New Project Card Trigger */}
          <div
            onClick={() => handleCreateProject('create')}
            className="project-card"
            style={{
              aspectRatio: '9/16',
              border: '2px dashed var(--border-medium)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'rgba(var(--scrollbar-thumb), 0.05)',
              padding: '24px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-gray)';
              e.currentTarget.style.background = 'rgba(var(--scrollbar-thumb), 0.1)';
              const iconWrapper = e.currentTarget.querySelector('.add-icon-wrapper') as HTMLElement;
              if (iconWrapper) iconWrapper.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-medium)';
              e.currentTarget.style.background = 'rgba(var(--scrollbar-thumb), 0.05)';
              const iconWrapper = e.currentTarget.querySelector('.add-icon-wrapper') as HTMLElement;
              if (iconWrapper) iconWrapper.style.transform = 'scale(1)';
            }}
          >
            <div 
              className="add-icon-wrapper"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <Plus size={20} color="var(--text-white)" />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-gray)', fontFamily: 'Inter' }}>Create New Video</span>
          </div>

          {filteredProjects.map((proj) => {
            const updatedAtStr = new Date(proj.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            const pState = getProjectState(proj);
            const thumbUrl = getProjectThumbnail(proj);

            return (
              <div
                key={proj.id}
                className="project-card"
                style={{
                  aspectRatio: '9/16',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-glow)';
                  const img = e.currentTarget.querySelector('.card-thumbnail-img') as HTMLElement;
                  if (img) img.style.transform = 'scale(1.05)';
                  const overlay = e.currentTarget.querySelector('.card-hover-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  const img = e.currentTarget.querySelector('.card-thumbnail-img') as HTMLElement;
                  if (img) img.style.transform = 'scale(1)';
                  const overlay = e.currentTarget.querySelector('.card-hover-overlay') as HTMLElement;
                  if (overlay) overlay.style.opacity = '0';
                }}
                onClick={() => onOpenProject(proj.id, proj.type)}
              >
                {/* Visual Thumbnail Area */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-darker)' }}>
                  <img 
                    src={thumbUrl} 
                    alt={proj.name}
                    className="card-thumbnail-img"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: pState.type === 'generating' ? 0.4 : 1,
                      transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />

                  {/* Play & Edit Hover Overlay */}
                  <div 
                    className="card-hover-overlay"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0, 0, 0, 0.4)',
                      opacity: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      zIndex: 2,
                      transition: 'opacity 0.3s ease'
                    }}
                  >
                    {pState.type !== 'generating' && (
                      <button 
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProject(proj.id, proj.type);
                        }}
                      >
                        <Play size={18} fill="var(--primary-foreground)" />
                      </button>
                    )}
                    <button 
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--glass-bg)',
                        color: 'var(--text-white)',
                        border: '1px solid var(--glass-border)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProject(proj.id, proj.type);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>

                  {/* Top-Left Duration/Draft Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--text-white)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    zIndex: 1
                  }}>
                    {pState.type === 'draft' ? 'Draft' : pState.type === 'generating' ? 'Rendering' : getProjectDuration(proj)}
                  </div>

                  {/* Active Rendering State */}
                  {pState.type === 'generating' && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 24px',
                      zIndex: 1
                    }}>
                      <div 
                        className="shimmer"
                        style={{
                          width: '100%',
                          height: '2px',
                          background: 'var(--border-medium)',
                          position: 'relative',
                          overflow: 'hidden',
                          marginBottom: '12px',
                          borderRadius: '1px'
                        }}
                      >
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pState.progress}%`, background: 'var(--primary)' }} />
                      </div>
                      <span style={{ fontSize: '11px', fontFamily: 'Inter', fontWeight: 600, color: 'var(--text-white)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Generating... {pState.progress}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Info & Footer Details */}
                <div style={{ padding: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', fontFamily: 'Inter', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                      {proj.name}
                    </h3>
                    
                    <button 
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-gray)', fontFamily: 'Inter' }}>
                      {updatedAtStr}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: pState.type === 'generating' ? 'var(--primary)' : pState.type === 'draft' ? 'var(--text-muted)' : '#10b981',
                          animation: pState.type === 'generating' ? 'pulse 1.5s infinite' : 'none'
                        }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-gray)', textTransform: 'capitalize', fontFamily: 'Inter' }}>
                        {pState.type === 'generating' ? 'Active' : pState.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Stats/Status Panel */}
      <div 
        className="glass-panel" 
        style={{ 
          marginTop: '64px', 
          padding: '24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'between', 
          borderRadius: '8px',
          border: '1px solid var(--border-medium)',
          gap: '24px'
        }}
      >
        <div style={{ display: 'flex', gap: '48px', flexGrow: 1 }}>
          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontFamily: 'Inter' }}>Total Projects</span>
            <span style={{ fontSize: '24px', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-white)' }}>
              {totalProjects}
            </span>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontFamily: 'Inter' }}>Storage Used</span>
            <span style={{ fontSize: '24px', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-white)' }}>
              {formatStorage(totalDiskSize)} <span style={{ fontSize: '13px', color: 'var(--text-gray)', fontWeight: 400, fontFamily: 'Inter' }}>/ 50GB</span>
            </span>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontFamily: 'Inter' }}>Total Renders</span>
            <span style={{ fontSize: '24px', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-white)' }}>
              {totalRenders}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" style={{ padding: '0 20px', height: '38px', fontSize: '12px', fontWeight: 600 }}>
            Manage Storage
          </button>
          <button className="btn-primary" style={{ padding: '0 20px', height: '38px', fontSize: '12px', fontWeight: 700 }}>
            Upgrade Plan
          </button>
        </div>
      </div>

    </div>
  );
}
