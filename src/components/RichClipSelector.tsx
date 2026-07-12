import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Search, ChevronDown, Check, Video, Film, X, ZoomIn, ZoomOut } from 'lucide-react';

interface Clip {
  id: string;
  name: string;
  thumbnail?: string;
  duration: number;
  exists?: boolean;
  tags?: string[];
  path?: string;
}

interface RichClipSelectorProps {
  value: string;
  onChange: (clipId: string) => void;
  clips: Clip[];
  onGenerateAi: () => void;
  showOriginal?: boolean;
  originalLabel?: string;
  placeholder?: string;
  excludeBroll?: boolean;
}

export default function RichClipSelector({
  value,
  onChange,
  clips,
  onGenerateAi,
  showOriginal = false,
  originalLabel = 'Original Clip',
  placeholder = '-- Choose Video Clip --',
  excludeBroll = false
}: RichClipSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectorTab, setSelectorTab] = useState<'uploads' | 'broll'>('uploads');
  const [zoom, setZoom] = useState(160); // Column width in pixels (Finder-like slider)
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const isStockOrBroll = (clip: Clip) => {
    // 1. Check tags
    const hasSystemTag = Array.isArray(clip.tags) && clip.tags.some(tag => 
      tag === 'stock_downloaded' || 
      tag === 'ai_generated' || 
      tag === 'fallback' ||
      tag === 'recreate_fallback'
    );
    if (hasSystemTag) return true;

    // 2. Check name prefix (e.g. starts with "STOCK" or "AI - ")
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

  // Set the default preview clip when the modal is opened
  useEffect(() => {
    if (isOpen) {
      if (value && value !== 'original') {
        const current = clips.find(c => c.id === value);
        if (current) {
          setPreviewClip(current);
          setSelectorTab(isStockOrBroll(current) ? 'broll' : 'uploads');
        } else {
          setPreviewClip(null);
        }
      } else if (value === 'original') {
        setPreviewClip({ id: 'original', name: originalLabel, duration: 0 } as any);
      } else {
        setPreviewClip(null);
      }
    }
  }, [isOpen, value, clips, originalLabel]);

  // Filter clips based on search input and excludeBroll setting
  const searchMatchedClips = clips.filter(c => {
    if (c.exists === false) return false;
    if (excludeBroll && isStockOrBroll(c)) return false;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  const uploadsCount = searchMatchedClips.filter(c => !isStockOrBroll(c)).length;
  const brollCount = searchMatchedClips.filter(isStockOrBroll).length;

  const filteredClips = searchMatchedClips.filter(c => {
    if (excludeBroll) return true;
    const isBroll = isStockOrBroll(c);
    return selectorTab === 'broll' ? isBroll : !isBroll;
  });

  // Find currently selected clip for the trigger button
  const selectedClip = clips.find(c => c.id === value);

  const handleOpen = () => {
    setIsOpen(true);
    setSearch('');
  };

  // Determine trigger button content
  const renderTriggerContent = () => {
    if (value === 'original') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '18px', borderRadius: '3px',
            background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Video size={10} color="var(--accent-indigo)" />
          </div>
          <span style={{ fontWeight: 500, color: 'var(--text-white)' }}>{originalLabel}</span>
        </div>
      );
    }

    if (selectedClip) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          {selectedClip.thumbnail ? (
            <img
              src={selectedClip.thumbnail}
              alt=""
              style={{ width: '28px', height: '18px', borderRadius: '3px', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '28px', height: '18px', borderRadius: '3px',
              background: 'var(--bg-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Video size={10} color="var(--text-muted)" />
            </div>
          )}
          <span
            style={{ fontWeight: 500, color: 'var(--text-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={selectedClip.name}
          >
            {selectedClip.name}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
            ({selectedClip.duration.toFixed(1)}s)
          </span>
        </div>
      );
    }

    return <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>;
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Dynamic inline styles for modal transitions and animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .clip-card-hover {
          transition: all 0.2s ease-in-out;
        }
        .clip-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
          background: rgba(255, 255, 255, 0.03) !important;
        }
        .clip-grid-container::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .clip-grid-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .clip-grid-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
        }
        .clip-grid-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
      `}} />

      {/* Selector Trigger Button */}
      <button
        type="button"
        className="input-field"
        onClick={handleOpen}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          padding: '0 12px',
          height: '36px',
          margin: 0,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          gap: '8px'
        }}
      >
        <div style={{ flexGrow: 1, overflow: 'hidden' }}>
          {renderTriggerContent()}
        </div>
        <ChevronDown size={14} style={{
          color: 'var(--text-muted)',
          flexShrink: 0
        }} />
      </button>

      {/* Fullscreen Popup Modal */}
      {isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '32px',
            boxSizing: 'border-box',
            animation: 'modalFadeIn 0.2s ease-out'
          }}
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Container */}
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '1200px',
              height: '100%',
              maxHeight: 'min(820px, calc(100vh - 64px))',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
              animation: 'modalScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-medium)',
              background: 'var(--bg-dark)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Film size={18} color="var(--accent-purple)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', fontFamily: 'var(--font-headline)' }}>
                  Clip Explorer
                </h3>
              </div>

              {/* Search Field */}
              <div style={{ position: 'relative', width: '340px' }}>
                <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
                <input
                  type="text"
                  placeholder="Search library clips by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    paddingLeft: '32px',
                    paddingRight: '12px',
                    fontSize: '12.5px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    color: 'var(--text-white)',
                    outline: 'none'
                  }}
                  autoFocus
                />
              </div>

              {/* Header Right Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onGenerateAi();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-indigo) 100%)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Sparkles size={13} fill="currentColor" />
                  Generate with AI
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-gray)',
                    cursor: 'pointer',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Sub-header toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 24px',
              background: 'var(--bg-darker)',
              borderBottom: '1px solid var(--border-light)'
            }}>
              {/* Category selector tabs */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectorTab('uploads')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectorTab === 'uploads' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    color: selectorTab === 'uploads' ? 'var(--text-white)' : 'var(--text-gray)',
                    fontWeight: 600,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Uploads ({uploadsCount})
                </button>
                {!excludeBroll && (
                  <button
                    type="button"
                    onClick={() => setSelectorTab('broll')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: selectorTab === 'broll' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                      color: selectorTab === 'broll' ? 'var(--text-white)' : 'var(--text-gray)',
                      fontWeight: 600,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    B-Roll / Stock ({brollCount})
                  </button>
                )}
              </div>

              {/* Finder-style zoom slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ZoomOut size={12} color="var(--text-gray)" />
                <input
                  type="range"
                  min={110}
                  max={280}
                  step={10}
                  value={zoom}
                  onChange={(e) => setZoom(parseInt(e.target.value, 10))}
                  style={{
                    width: '120px',
                    height: '4px',
                    accentColor: 'var(--accent-purple)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                />
                <ZoomIn size={12} color="var(--text-gray)" />
                <span style={{ fontSize: '11px', color: 'var(--text-gray)', marginLeft: '4px', minWidth: '38px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {zoom}px
                </span>
              </div>
            </div>

            {/* Split layout explorer */}
            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
              {/* Left Panel: Clips Grid */}
              <div
                className="clip-grid-container"
                style={{
                  flex: 1,
                  padding: '20px 24px',
                  overflowY: 'auto',
                  background: 'var(--bg-darker)'
                }}
              >
                {/* Original fallback card */}
                {showOriginal && selectorTab === 'uploads' && (
                  <div
                    onClick={() => {
                      const origClip = { id: 'original', name: originalLabel, duration: 0 };
                      setPreviewClip(origClip as any);
                    }}
                    onDoubleClick={() => {
                      onChange('original');
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '10px',
                      borderRadius: '8px',
                      background: previewClip?.id === 'original' ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                      border: previewClip?.id === 'original' ? '2px solid var(--accent-purple)' : '1px solid var(--border-medium)',
                      cursor: 'pointer',
                      marginBottom: '16px',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      height: '80px',
                      background: 'var(--bg-dark)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '8px'
                    }}>
                      <Video size={20} color="var(--text-gray)" />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {originalLabel}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-gray)', marginTop: '2px' }}>
                      Default timeline camera
                    </div>
                    {value === 'original' && (
                      <div style={{
                        position: 'absolute', top: '8px', right: '8px',
                        width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent-purple)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Check size={10} color="white" />
                      </div>
                    )}
                  </div>
                )}

                {filteredClips.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${zoom}px, 1fr))`,
                    gap: '16px'
                  }}>
                    {filteredClips.map(clip => {
                      const isPreviewed = previewClip?.id === clip.id;
                      const isAssigned = value === clip.id;
                      return (
                        <div
                          key={clip.id}
                          className="clip-card-hover"
                          onClick={() => setPreviewClip(clip)}
                          onDoubleClick={() => {
                            onChange(clip.id);
                            setIsOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '8px',
                            borderRadius: '8px',
                            background: isPreviewed ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.01)',
                            border: isPreviewed
                              ? '2px solid var(--accent-purple)'
                              : isAssigned
                                ? '1.5px dashed var(--accent-indigo)'
                                : '1px solid var(--border-medium)',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Thumbnail */}
                          <div style={{
                            width: '100%',
                            aspectRatio: '16/9',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            background: '#000',
                            position: 'relative',
                            marginBottom: '8px'
                          }}>
                            {clip.thumbnail ? (
                              <img
                                src={clip.thumbnail}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--bg-dark)'
                              }}>
                                <Video size={16} color="var(--text-gray)" />
                              </div>
                            )}

                            {/* Duration Indicator */}
                            <div style={{
                              position: 'absolute', bottom: '4px', right: '4px',
                              background: 'rgba(0,0,0,0.65)', color: 'white',
                              fontSize: '9px', padding: '1px 4px', borderRadius: '3px', fontWeight: 600,
                              fontFamily: 'monospace'
                            }}>
                              {clip.duration.toFixed(1)}s
                            </div>
                          </div>

                          {/* Info */}
                          <div style={{
                            fontSize: '11.5px',
                            fontWeight: 500,
                            color: 'var(--text-white)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={clip.name}>
                            {clip.name}
                          </div>

                          <div style={{
                            fontSize: '9.5px',
                            color: 'var(--text-gray)',
                            marginTop: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {clip.tags && clip.tags.length > 0 ? clip.tags.slice(0, 2).join(', ') : 'no tags'}
                          </div>

                          {isAssigned && (
                            <div style={{
                              position: 'absolute', top: '6px', right: '6px',
                              padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.95)',
                              color: 'white', fontSize: '9px', fontWeight: 700,
                              boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                            }}>
                              Assigned
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-gray)' }}>
                    <Video size={36} style={{ marginBottom: '12px', opacity: 0.25 }} />
                    <p style={{ fontSize: '13px' }}>No video clips match your search query.</p>
                  </div>
                )}
              </div>

              {/* Right Panel: Live Preview Player & Metadata Details */}
              <div
                style={{
                  width: '360px',
                  background: 'var(--bg-dark)',
                  borderLeft: '1px solid var(--border-medium)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px',
                  overflowY: 'auto'
                }}
              >
                {previewClip ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-white)' }}>
                      Preview Clip
                    </h4>

                    {/* Loop Video Player */}
                    {previewClip.id === 'original' ? (
                      <div style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        borderRadius: '8px',
                        background: '#000',
                        border: '1px solid var(--border-medium)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        textAlign: 'center',
                        gap: '8px'
                      }}>
                        <Video size={28} color="var(--accent-purple)" />
                        <span style={{ fontSize: '12px', color: 'var(--text-white)' }}>Original Video Source</span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-gray)', lineHeight: '1.4' }}>
                          Returns camera rendering to the primary aligned narration track.
                        </span>
                      </div>
                    ) : (
                      <video
                        key={previewClip.id}
                        src={`/api/clips/${previewClip.id}/video`}
                        autoPlay
                        muted
                        loop
                        controls
                        style={{
                          width: '100%',
                          borderRadius: '8px',
                          background: '#000',
                          border: '1px solid var(--border-medium)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}
                      />
                    )}

                    {/* Metadata details */}
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clip Name</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', marginTop: '3px', wordBreak: 'break-all' }}>
                          {previewClip.name}
                        </div>
                      </div>

                      {previewClip.description && (
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
                          <div style={{
                            fontSize: '11.5px',
                            color: 'var(--text-gray)',
                            marginTop: '4px',
                            lineHeight: '1.45',
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            maxHeight: '120px',
                            overflowY: 'auto'
                          }}>
                            {previewClip.description}
                          </div>
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', marginTop: '3px' }}>
                          {previewClip.duration.toFixed(2)} seconds
                        </div>
                      </div>

                      {previewClip.tags && previewClip.tags.length > 0 && (
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Tags</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {previewClip.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '9.5px',
                                  padding: '2px 7px',
                                  background: 'rgba(255,255,255,0.03)',
                                  color: 'var(--text-gray)',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-light)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(previewClip.id);
                          setIsOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-indigo) 100%)',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 6px 18px rgba(99, 102, 241, 0.35)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.25)';
                        }}
                      >
                        Assign Clip to Scene
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewClip(null)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'none',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-gray)',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        Deselect Preview
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-gray)', textAlign: 'center', opacity: 0.5 }}>
                    <Film size={32} style={{ marginBottom: '12px' }} />
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>No clip selected</div>
                    <div style={{ fontSize: '11px', marginTop: '4px', maxWidth: '220px', lineHeight: '1.4' }}>
                      Click on any video in the explorer grid to load its preview and details panel.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
