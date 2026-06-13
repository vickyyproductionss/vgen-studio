import { useState, useRef, useEffect } from 'react';
import { Sparkles, Search, ChevronDown, Check, Video } from 'lucide-react';

interface Clip {
  id: string;
  name: string;
  thumbnail?: string;
  duration: number;
  exists?: boolean;
}

interface RichClipSelectorProps {
  value: string;
  onChange: (clipId: string) => void;
  clips: Clip[];
  onGenerateAi: () => void;
  showOriginal?: boolean;
  originalLabel?: string;
  placeholder?: string;
}

export default function RichClipSelector({
  value,
  onChange,
  clips,
  onGenerateAi,
  showOriginal = false,
  originalLabel = 'Original Clip',
  placeholder = '-- Choose Video Clip --'
}: RichClipSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter clips based on search input
  const filteredClips = clips.filter(c =>
    c.exists !== false &&
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Find currently selected clip
  const selectedClip = clips.find(c => c.id === value);

  // Determine trigger button content
  const renderTriggerContent = () => {
    if (value === 'original') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '18px', borderRadius: '3px',
            background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Video size={10} color="var(--primary)" />
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
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        className="input-field"
        onClick={() => setIsOpen(!isOpen)}
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
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
          flexShrink: 0
        }} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            zIndex: 1000,
            maxHeight: '340px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-medium)',
            animation: 'slideUp 0.15s ease-out'
          }}
        >
          {/* Search Header */}
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search library clips..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '28px',
                paddingLeft: '28px',
                paddingRight: '8px',
                fontSize: '11px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                color: 'var(--text-white)'
              }}
              autoFocus
            />
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* 1. Generate with AI Button */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onGenerateAi();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                textAlign: 'left',
                border: '1px dashed var(--accent-purple-border)',
                background: 'rgba(168, 85, 247, 0.05)',
                color: 'var(--accent-purple)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                transition: 'background 0.2s',
                marginBottom: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)'}
            >
              <Sparkles size={13} fill="currentColor" />
              Generate with AI...
            </button>

            {/* 2. Original option if enabled */}
            {showOriginal && (
              <div
                onClick={() => {
                  onChange('original');
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: value === 'original' ? 'var(--primary-dim)' : 'transparent',
                  fontSize: '12px'
                }}
                onMouseEnter={(e) => { if (value !== 'original') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { if (value !== 'original') e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px', height: '20px', borderRadius: '3px',
                    background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Video size={10} color="var(--primary)" />
                  </div>
                  <span style={{ fontWeight: value === 'original' ? 600 : 400, color: 'var(--text-white)' }}>
                    {originalLabel}
                  </span>
                </div>
                {value === 'original' && <Check size={12} color="var(--primary)" />}
              </div>
            )}

            {/* 3. Library Clips list */}
            {filteredClips.length > 0 ? (
              filteredClips.map(clip => {
                const isSelected = clip.id === value;
                return (
                  <div
                    key={clip.id}
                    onClick={() => {
                      onChange(clip.id);
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--primary-dim)' : 'transparent',
                      fontSize: '12px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {clip.thumbnail ? (
                        <img
                          src={clip.thumbnail}
                          alt=""
                          style={{ width: '32px', height: '20px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: '32px', height: '20px', borderRadius: '3px',
                          background: 'var(--bg-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Video size={10} color="var(--text-muted)" />
                        </div>
                      )}
                      <span
                        style={{
                          fontWeight: isSelected ? 600 : 400,
                          color: 'var(--text-white)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={clip.name}
                      >
                        {clip.name}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        ({clip.duration.toFixed(1)}s)
                      </span>
                    </div>
                    {isSelected && <Check size={12} color="var(--primary)" />}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                No clips match your search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
