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
  createdAt?: string;
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
  const [activeTab, setActiveTab] = useState<'uploads' | 'broll'>('uploads');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'duration-desc' | 'duration-asc'>('newest');
  const [syncStatus, setSyncStatus] = useState<{
    totalClips: number;
    localCount: number;
    syncingCount: number;
    isSyncing: boolean;
    percentComplete: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchSyncStatus();
    const syncInterval = setInterval(fetchSyncStatus, 2000);
    return () => clearInterval(syncInterval);
  }, []);

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

  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks (well under Cloud Run's 32MB limit)

  const uploadFileDirectlyToGcs = (
    file: File,
    gcsUrl: string,
    onProgress: (pct: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', gcsUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve();
        } else {
          reject(new Error(`Direct GCS upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Direct GCS upload connection error'));
      xhr.send(file);
    });
  };

  const uploadFileInChunks = async (
    file: File,
    clipId: string,
    onProgress: (pct: number) => void
  ): Promise<void> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk, `chunk-${chunkIndex}`);

      let attempts = 0;
      let success = false;
      let lastErr = 'Chunk upload failed';

      while (attempts < 3 && !success) {
        attempts++;
        try {
          const res = await fetch(`/api/clips/upload-chunk/${clipId}?fileName=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            body: formData
          });

          if (res.ok) {
            success = true;
          } else {
            const err = await res.json().catch(() => ({}));
            lastErr = err.error || `Chunk upload failed (${res.status})`;
            if (attempts < 3) {
              await new Promise(r => setTimeout(r, 1000 * attempts));
            }
          }
        } catch (netErr: any) {
          lastErr = netErr?.message || 'Network connection glitch during upload';
          if (attempts < 3) {
            await new Promise(r => setTimeout(r, 1000 * attempts));
          }
        }
      }

      if (!success) {
        throw new Error(lastErr);
      }

      onProgress(Math.round((end / file.size) * 100));
    }
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
      const uploadPromises = fileList.map(async (file, i) => {
        try {
          // Step 1: Request upload session from server
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

          const { clipId, gcsUrl } = await initRes.json();

          // Step 2: Upload file (directly to GCS if signed URL is provided, otherwise fall back to server chunks)
          if (gcsUrl) {
            await uploadFileDirectlyToGcs(file, gcsUrl, (pct) => {
              setUploadQueue(prev => prev.map((item, idx) =>
                idx === i ? { ...item, progress: pct, status: 'uploading' as const } : item
              ));
            });
          } else {
            await uploadFileInChunks(file, clipId, (pct) => {
              setUploadQueue(prev => prev.map((item, idx) =>
                idx === i ? { ...item, progress: pct, status: 'uploading' as const } : item
              ));
            });
          }

          // Mark as processing (server is generating thumbnail + uploading to GCS)
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, progress: 100, status: 'processing' as const } : item
          ));

          // Step 3: Finalize — server processes the complete file
          const finalRes = await fetch('/api/clips/finalize-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clipId,
              fileName: file.name
            })
          });

          if (!finalRes.ok) {
            const err = await finalRes.json();
            throw new Error(err.error || 'Failed to finalize upload');
          }

          const newClip = await finalRes.json();

          // Mark as done
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, progress: 100, status: 'done' as const } : item
          ));

          return newClip;
        } catch (err: any) {
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error' as const, error: err.message } : item
          ));
          console.error(`Upload failed for ${file.name}:`, err.message);
          return null; // Return null on failure so other uploads can continue
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulClips = results.filter((c): c is Clip => c !== null);
      uploadedClips.push(...successfulClips);

      if (uploadedClips.length > 0) {
        setClips(prev => [...uploadedClips, ...prev]);
      }

      // Clear progress after a short delay
      setTimeout(() => {
        setUploadQueue([]);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
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

  const isStockOrBroll = (clip: Clip) => {
    // 1. Check tags
    const hasSystemTag = Array.isArray(clip.tags) && clip.tags.some(tag => 
      tag === 'stock_downloaded' || 
      tag === 'ai_generated' || 
      tag === 'fallback' ||
      tag === 'recreate_fallback'
    );
    if (hasSystemTag) return true;

    // 2. Check name prefix (e.g., starts with "STOCK" or "AI - ")
    if (clip.name) {
      const lowerName = clip.name.toLowerCase();
      if (lowerName.startsWith('stock') || lowerName.startsWith('ai -') || lowerName.startsWith('ai_')) {
        return true;
      }
    }

    // 3. Check path / file name prefix
    if (clip.path) {
      const filename = clip.path.split('/').pop() || '';
      if (filename.startsWith('stock_') || filename.includes('/stock_') || filename.startsWith('ai_clip_') || filename.includes('/ai_clip_')) {
        return true;
      }
    }

    // 4. Check ID prefix
    if (clip.id && (clip.id.startsWith('pexels_') || clip.id.startsWith('pixabay_') || clip.id.startsWith('ai_clip_'))) {
      return true;
    }

    return false;
  };

  const filteredClips = clips.filter(clip => {
    const matchesTab = activeTab === 'broll' ? isStockOrBroll(clip) : !isStockOrBroll(clip);
    if (!matchesTab) return false;

    const query = search.toLowerCase();
    return (
      (clip.name || '').toLowerCase().includes(query) ||
      (clip.description || '').toLowerCase().includes(query) ||
      (Array.isArray(clip.tags) && clip.tags.some(tag => (tag || '').toLowerCase().includes(query)))
    );
  });

  const sortedClips = [...filteredClips].sort((a, b) => {
    if (sortBy === 'newest') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA || timeB) return timeB - timeA;
      return clips.indexOf(b) - clips.indexOf(a);
    }
    if (sortBy === 'oldest') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA || timeB) return timeA - timeB;
      return clips.indexOf(a) - clips.indexOf(b);
    }
    if (sortBy === 'name-asc') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'name-desc') {
      return (b.name || '').localeCompare(a.name || '');
    }
    if (sortBy === 'duration-desc') {
      return (b.duration || 0) - (a.duration || 0);
    }
    if (sortBy === 'duration-asc') {
      return (a.duration || 0) - (b.duration || 0);
    }
    return 0;
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

      {/* Hybrid Local Mac Disk vs Cloud Storage Sync Progress Panel */}
      {syncStatus && syncStatus.totalClips > 0 && (
        <div style={{
          background: syncStatus.isSyncing
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.08))'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.06))',
          border: `1px solid ${syncStatus.isSyncing ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: syncStatus.isSyncing ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
                {syncStatus.isSyncing ? '🔄' : '⚡'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14.5px', color: '#fff' }}>
                  {syncStatus.isSyncing
                    ? `Syncing Cloud Storage Clips to Local Mac Disk... (${syncStatus.localCount}/${syncStatus.totalClips} Files Cached)`
                    : `Mac Disk Cache Fully Synced (${syncStatus.totalClips} Clips Loaded on Mac SSD)`}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-gray)', marginTop: '2px' }}>
                  {syncStatus.isSyncing
                    ? `Downloading remaining ${syncStatus.syncingCount} cloud file${syncStatus.syncingCount > 1 ? 's' : ''} to local Mac disk for 0ms ultra-fast local editing.`
                    : `Editing runs directly from local Mac disk (0ms latency) with background Cloud backup active.`}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: syncStatus.isSyncing ? '#60a5fa' : '#34d399' }}>
                {syncStatus.percentComplete}%
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {syncStatus.localCount} / {syncStatus.totalClips} Disk Cached
              </div>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${syncStatus.percentComplete}%`,
              height: '100%',
              background: syncStatus.isSyncing
                ? 'linear-gradient(90deg, #3b82f6, #6366f1, #60a5fa)'
                : 'linear-gradient(90deg, #10b981, #34d399)',
              borderRadius: '4px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>
      )}

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

      {/* Tabs for Uploads vs B-Roll / Stock */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '24px', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('uploads')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'uploads' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'uploads' ? '#fff' : 'var(--text-gray)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          Uploaded Clips ({clips.filter(c => !isStockOrBroll(c)).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('broll')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'broll' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'broll' ? '#fff' : 'var(--text-gray)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          B-Roll & Stock Library ({clips.filter(isStockOrBroll).length})
        </button>
      </div>

      {/* Search, Sort & Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
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

        {/* Sort selector dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-gray)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Sort:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input-field"
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              height: '44px',
              borderRadius: '8px',
              background: 'var(--bg-darker)',
              color: '#fff',
              border: '1px solid var(--border-light)',
              cursor: 'pointer'
            }}
          >
            <option value="newest">🕒 Latest Uploaded First</option>
            <option value="oldest">⏳ Oldest Uploaded First</option>
            <option value="name-asc">🔤 Name (A → Z)</option>
            <option value="name-desc">🔤 Name (Z → A)</option>
            <option value="duration-desc">⏱️ Duration (Longest First)</option>
            <option value="duration-asc">⏱️ Duration (Shortest First)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge-tag">Total: {clips.length}</span>
          <span className="badge-tag" style={{ color: 'var(--accent-indigo)', borderColor: 'var(--border-light)' }}>Ready: {clips.filter(c => c.status === 'ready').length}</span>
        </div>
      </div>

      {/* Clips Grid */}
      {sortedClips.length === 0 ? (
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
          {sortedClips.map((clip) => (
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
