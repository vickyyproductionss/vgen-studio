import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, Video, Search, AlertCircle, FileText, CheckCircle2, RefreshCw, X } from 'lucide-react';

interface Clip {
  id: string;
  path: string;
  name: string;
  thumbnail: string;
  duration: number;
  description: string;
  tags: string[];
  status: 'ready' | 'analyzing' | 'failed';
  exists?: boolean;
}

interface UploadProgress {
  fileName: string;
  progress: number;  // 0-100
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

export default function ClipsLibrary() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [search, setSearch] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [importMode, setImportMode] = useState<'file' | 'folder'>('file');
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClips();
    
    // Poll for clip analysis statuses every 3 seconds if any clip is analyzing
    const interval = setInterval(() => {
      setClips(prevClips => {
        const needsPolling = prevClips.some(c => c.status === 'analyzing');
        if (needsPolling) {
          fetchClips();
        }
        return prevClips;
      });
    }, 3000);

    return () => clearInterval(interval);
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

  const handleAddPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPath) return;

    setImporting(true);
    setError('');

    try {
      const endpoint = importMode === 'file' ? '/api/clips/add-path' : '/api/clips/add-folder';
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
        setClips(prev => [data, ...prev]);
      } else {
        if (data.clips && data.clips.length > 0) {
          setClips(prev => [...data.clips, ...prev]);
        }
        alert(`Folder scan complete! Found and queued ${data.count} new clips.`);
      }
      setLocalPath('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const uploadFileToGCS = (file: File, uploadUrl: string, onProgress: (pct: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`GCS upload failed (${xhr.status})`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.send(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    const fileList = Array.from(files);

    // Initialize progress tracking
    const initialProgress: UploadProgress[] = fileList.map(f => ({
      fileName: f.name,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploadQueue(initialProgress);

    const uploadedClips: Clip[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        // Step 1: Request upload URL from server
        const initRes = await fetch('/api/clips/init-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'video/mp4',
            fileSize: file.size
          })
        });

        if (!initRes.ok) {
          const err = await initRes.json();
          throw new Error(err.error || 'Failed to initialize upload');
        }

        const initData = await initRes.json();

        if (initData.mode === 'multipart') {
          // Fallback: use old multipart upload (local dev)
          const formData = new FormData();
          formData.append('videos', file);
          const uploadRes = await fetch('/api/clips/upload', { method: 'POST', body: formData });
          if (!uploadRes.ok) throw new Error('Multipart upload failed');
          const clips = await uploadRes.json();
          uploadedClips.push(...clips);
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, progress: 100, status: 'done' as const } : item
          ));
          continue;
        }

        // Step 2: Upload file directly to GCS
        await uploadFileToGCS(file, initData.uploadUrl, (pct) => {
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, progress: pct, status: 'uploading' as const } : item
          ));
        });

        // Mark as processing
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, progress: 100, status: 'processing' as const } : item
        ));

        // Step 3: Finalize — server generates thumbnail + starts AI analysis
        const finalRes = await fetch('/api/clips/finalize-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipId: initData.clipId,
            gcsPath: initData.gcsPath,
            fileName: file.name
          })
        });

        if (!finalRes.ok) {
          const err = await finalRes.json();
          throw new Error(err.error || 'Failed to finalize upload');
        }

        const newClip = await finalRes.json();
        uploadedClips.push(newClip);

        // Mark as done
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, progress: 100, status: 'done' as const } : item
        ));
      }

      setClips(prev => [...uploadedClips, ...prev]);

      // Clear progress after a short delay
      setTimeout(() => {
        setUploadQueue([]);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setUploadQueue(prev => prev.map(item =>
        item.status !== 'done'
          ? { ...item, status: 'error' as const, error: err.message }
          : item
      ));
      // Add any partially uploaded clips
      if (uploadedClips.length > 0) {
        setClips(prev => [...uploadedClips, ...prev]);
      }
      setTimeout(() => {
        setUploadQueue([]);
      }, 5000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this clip?')) return;
    try {
      const res = await fetch(`/api/clips/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setClips(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete clip:', err);
    }
  };

  const handleReanalyzeAll = async () => {
    if (!confirm("This will scan your library and analyze any clips that don't have second-by-second timelines yet. Clips that are already done will be skipped. Proceed?")) return;
    
    setImporting(true);
    setError('');
    
    try {
      const res = await fetch('/api/clips/reanalyze-all', {
        method: 'POST'
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to trigger re-analysis.');
      }
      
      alert('Re-analysis started! All clips have been queued.');
      fetchClips();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const filteredClips = clips.filter(clip => {
    const query = search.toLowerCase();
    return (
      clip.name.toLowerCase().includes(query) ||
      clip.description.toLowerCase().includes(query) ||
      clip.tags.some(tag => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div style={{ animation: 'slideUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Video Library</h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '14px' }}>
            Import your short media clips. Gemini automatically analyzes content and extracts tags.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="video/*,.mp4,.mkv,.mov,.webm,.m4v"
            multiple
            style={{ display: 'none' }}
          />
          <button
            onClick={handleReanalyzeAll}
            className="btn-secondary"
            disabled={clips.length === 0 || importing || uploading}
            style={{ height: '34px', color: 'white' }}
          >
            <RefreshCw size={14} />
            Re-analyze All Clips
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
            disabled={uploading}
            style={{ height: '34px' }}
          >
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Upload Clips'}
          </button>
        </div>
      </div>

      {/* Upload Progress Panel */}
      {uploadQueue.length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              📤 Uploading {uploadQueue.length} clip{uploadQueue.length > 1 ? 's' : ''}
            </span>
            {!uploading && (
              <button
                onClick={() => setUploadQueue([])}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploadQueue.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--text-gray)',
                  minWidth: '140px',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.fileName}
                </span>
                <div style={{
                  flex: 1,
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${item.progress}%`,
                    height: '100%',
                    borderRadius: '3px',
                    background: item.status === 'error'
                      ? '#ef4444'
                      : item.status === 'done'
                        ? '#10b981'
                        : item.status === 'processing'
                          ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                          : '#3b82f6',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  minWidth: '70px',
                  textAlign: 'right',
                  color: item.status === 'error' ? '#f87171'
                    : item.status === 'done' ? '#10b981'
                    : item.status === 'processing' ? '#a78bfa'
                    : '#60a5fa',
                  fontWeight: 500
                }}>
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'processing' && '⏳ Analyzing'}
                  {item.status === 'done' && '✓ Done'}
                  {item.status === 'error' && '✗ Failed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          fontSize: '14px'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Path importer */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className={importMode === 'file' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setImportMode('file'); setError(''); }}
            style={{ padding: '6px 12px', fontSize: '12px', height: '32px' }}
          >
            Single File Path
          </button>
          <button
            type="button"
            className={importMode === 'folder' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setImportMode('folder'); setError(''); }}
            style={{ padding: '6px 12px', fontSize: '12px', height: '32px' }}
          >
            Entire Folder
          </button>
        </div>

        <form onSubmit={handleAddPath} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="label" htmlFor="clip-path">
              {importMode === 'file' ? 'Import local video file path (Mac filesystem)' : 'Import local folder path (scans all clips inside)'}
            </label>
            <input
              id="clip-path"
              type="text"
              className="input-field"
              placeholder={importMode === 'file' ? 'e.g. /Users/name/Movies/workout_clip.mp4' : 'e.g. /Users/name/Movies/workout_clips_folder'}
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={importing || !localPath} style={{ height: '46px', flexShrink: 0 }}>
            <Plus size={18} />
            {importing ? 'Importing...' : (importMode === 'file' ? 'Add Clip' : 'Scan Folder')}
          </button>
        </form>
      </div>

      {/* Search & Stats */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search clips by name, tags, or AI description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge-tag">Total Clips: {clips.length}</span>
          <span className="badge-tag" style={{ color: 'var(--accent-indigo)', borderColor: 'var(--border-light)' }}>Ready: {clips.filter(c => c.status === 'ready').length}</span>
        </div>
      </div>

      {/* Clips Grid */}
      {filteredClips.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-gray)' }}>
          <Video size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>No clips found</h3>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'var(--text-muted)' }}>
            {search ? 'Try adjusting your search criteria.' : 'Import local paths or upload clips to populate your video library.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {filteredClips.map((clip) => (
            <div
              key={clip.id}
              className="glass-panel glass-panel-interactive"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: '12px'
              }}
            >
              {/* Thumbnail Container */}
              <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: 'var(--bg-darker)' }}>
                {clip.thumbnail ? (
                  <img
                    src={clip.thumbnail}
                    alt={clip.name}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <Video size={24} />
                  </div>
                )}

                {/* Duration Badge */}
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  {clip.duration.toFixed(1)}s
                </div>

                {/* Status Badge */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                }}>
                  {clip.status === 'analyzing' && (
                    <span style={{
                      background: 'rgba(59, 130, 246, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '99px',
                      fontSize: '10px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      animation: 'pulse 1.5s infinite'
                    }}>
                      Analyzing...
                    </span>
                  )}
                  {clip.status === 'failed' && (
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '99px',
                      fontSize: '10px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertCircle size={10} /> Failed
                    </span>
                  )}
                  {clip.status === 'ready' && clip.exists !== false && (
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '99px',
                      fontSize: '10px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={10} /> Ready
                    </span>
                  )}
                  {clip.exists === false && (
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '99px',
                      fontSize: '10px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertCircle size={10} /> File Missing
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    wordBreak: 'break-all',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }} title={clip.name}>
                    {clip.name}
                  </h4>
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--text-gray)',
                    lineHeight: '1.4',
                    marginBottom: '12px',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }} title={clip.description}>
                    {clip.description}
                  </p>
                </div>

                <div>
                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {clip.tags.slice(0, 4).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-light)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          color: 'var(--text-gray)'
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={clip.path}>
                      <FileText size={12} /> {clip.path}
                    </span>
                    <button
                      onClick={() => handleDelete(clip.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
