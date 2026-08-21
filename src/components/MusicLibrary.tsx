import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, Music, Play, Pause, Search, FileAudio, AlertCircle } from 'lucide-react';

interface BGM {
  id: string;
  path: string;
  name: string;
  duration: number;
  createdAt?: string;
}

export default function MusicLibrary() {
  const [bgms, setBgms] = useState<BGM[]>([]);
  const [search, setSearch] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [importMode, setImportMode] = useState<'file' | 'folder'>('file');
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio playback state
  const [playingBgmId, setPlayingBgmId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchBgms();
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  const fetchBgms = async () => {
    try {
      const res = await fetch('/api/bgms');
      if (res.ok) {
        const data = await res.json();
        setBgms(data);
      }
    } catch (err) {
      console.error('Failed to fetch BGMs:', err);
    }
  };

  const handleAddPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPath) return;

    setImporting(true);
    setError('');

    try {
      const endpoint = importMode === 'file' ? '/api/bgms/add-path' : '/api/bgms/add-folder';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ absolutePath: localPath })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import path.');
      }

      const data = await res.json();
      if (importMode === 'file') {
        setBgms(prev => [data, ...prev]);
      } else {
        if (data.bgms && data.bgms.length > 0) {
          setBgms(prev => [...data.bgms, ...prev]);
        }
        alert(`Folder scan complete! Imported ${data.count} background music files.`);
      }
      setLocalPath('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('bgms', files[i]);
    }

    try {
      const res = await fetch('/api/bgms/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload audio files.');
      }

      const newBgms = await res.json();
      setBgms(prev => [...newBgms, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this track from your music library?')) return;
    try {
      const res = await fetch(`/api/bgms/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setBgms(prev => prev.filter(b => b.id !== id));
        if (playingBgmId === id) {
          stopAudio();
        }
      }
    } catch (err) {
      console.error('Failed to delete BGM:', err);
    }
  };

  // Inline audio player helpers
  const playAudio = (bgm: BGM) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    // Determine the playing URL. Uploaded files use relative `/uploads/music/...` if they reside in backend
    // Otherwise if it's an absolute local path, it can be served relative to backend (if served in static)
    // Wait, let's see: we serve static `/uploads` from `UPLOADS_DIR`.
    // If the path starts with backend/uploads/, we serve it via `/uploads/...` URL.
    let audioUrl = '';
    const normPath = bgm.path.replace(/\\/g, '/');
    if (normPath.includes('/uploads/')) {
      audioUrl = normPath.substring(normPath.indexOf('/uploads/'));
    } else {
      // For absolute local paths outside backend, we can't easily play them in the web browser
      // unless we serve them. So let's alert the user or disable preview if not servable.
      alert("Local absolute files can be compiled into your video, but browser audio preview is only supported for uploaded tracks.");
      return;
    }

    const player = new Audio(audioUrl);
    player.play();
    audioPlayerRef.current = player;
    setPlayingBgmId(bgm.id);

    player.onended = () => {
      setPlayingBgmId(null);
    };
  };

  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setPlayingBgmId(null);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const filteredBgms = bgms.filter(bgm =>
    (bgm.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (bgm.path || '').toLowerCase().includes(search.toLowerCase())
  );

  const sortedBgms = [...filteredBgms].sort((a, b) => {
    if (sortBy === 'newest') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    }
    if (sortBy === 'oldest') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    }
    if (sortBy === 'name-asc') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'name-desc') {
      return (b.name || '').localeCompare(a.name || '');
    }
    return 0;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Music Library</h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '14px' }}>
            Manage background music tracks (.mp3, .wav, .m4a) to overlay on your generated videos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="audio/*"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
            disabled={uploading}
            style={{ height: '44px' }}
          >
            <Upload size={16} />
            {uploading ? 'Uploading audio...' : 'Upload Music'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Grid: Import Panel & List */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px', alignItems: 'start' }}>
        
        {/* LEFT: Local Import Form */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} style={{ color: 'var(--accent-purple)' }} />
            Import Local Audio
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              className={importMode === 'file' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setImportMode('file')}
              style={{ fontSize: '12px', padding: '8px 4px', justifyContent: 'center' }}
            >
              Single File
            </button>
            <button
              type="button"
              className={importMode === 'folder' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setImportMode('folder')}
              style={{ fontSize: '12px', padding: '8px 4px', justifyContent: 'center' }}
            >
              Scan Folder
            </button>
          </div>

          <form onSubmit={handleAddPath}>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">
                {importMode === 'file' ? 'Absolute Audio File Path' : 'Absolute Folder Path'}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder={importMode === 'file' ? 'e.g. /Music/beat.mp3' : 'e.g. /Music/BGM_Folder'}
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Audio will be registered instantly without heavy AI transcript analysis.
              </span>
            </div>

            <button
              type="submit"
              className="btn-secondary"
              disabled={importing}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {importing ? 'Importing...' : 'Add Path'}
            </button>
          </form>
        </section>

        {/* RIGHT: Music Tracks Table */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Search music library by filename or path..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-gray)' }}>Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input-field"
                style={{ width: '130px', height: '38px', fontSize: '12px', margin: 0, background: 'var(--bg-darker)' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>

          {sortedBgms.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileAudio size={48} style={{ strokeWidth: 1, marginBottom: '16px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px' }}>No music files found in library.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Upload audio files or import local paths to populate the BGM choices.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedBgms.map(bgm => (
                <div
                  key={bgm.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-light)',
                    transition: 'all 0.2s ease'
                  }}
                  className="glass-panel-interactive"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: 'rgba(138, 75, 243, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-purple)',
                        flexShrink: 0
                      }}
                    >
                      <Music size={18} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                        {bgm.name}
                      </h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {bgm.path}
                      </p>
                    </div>
                  </div>

                  {/* Track Duration & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '16px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-gray)', fontFamily: 'monospace' }}>
                      {formatDuration(bgm.duration)}
                    </span>

                    {/* Audio Preview controls */}
                    {bgm.path.replace(/\\/g, '/').includes('/uploads/') && (
                      <button
                        onClick={() => playingBgmId === bgm.id ? stopAudio() : playAudio(bgm)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-white)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {playingBgmId === bgm.id ? <Pause size={14} fill="var(--text-white)" /> : <Play size={14} fill="var(--text-white)" style={{ marginLeft: '1px' }} />}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(bgm.id)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Delete from library"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
