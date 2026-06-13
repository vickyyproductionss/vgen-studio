import { useState, useEffect } from 'react';
import { Upload, User, Trash2, RefreshCw, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

interface SubjectPhoto {
  id: string;
  path: string;
  angle: string;
  analysis: {
    description: string;
    traits: string[];
  };
}

interface SubjectProfileData {
  photos: SubjectPhoto[];
  summary: string;
  traitsList: string[];
}

const ANGLES = [
  'Front',
  'Left Profile',
  'Right Profile',
  'Three-Quarter Left',
  'Three-Quarter Right',
  'Top',
  'Bottom'
];

export default function SubjectProfile() {
  const [profile, setProfile] = useState<SubjectProfileData>({ photos: [], summary: '', traitsList: [] });
  const [loading, setLoading] = useState(false);
  const [uploadingAngle, setUploadingAngle] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subject');
      if (res.ok) {
        const data = await res.json();
        setProfile(data || { photos: [], summary: '', traitsList: [] });
      }
    } catch (err: any) {
      console.error('Failed to fetch subject profile:', err);
      setError('Failed to load subject profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async (angle: string, file: File) => {
    setUploadingAngle(angle);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('angle', angle);

    try {
      const res = await fetch('/api/subject/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed.');
      }

      const data = await res.json();
      setProfile(data.profile);
      setSuccess(`Uploaded and analyzed "${angle}" photo successfully!`);
      
      // Auto clear success message
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during photo analysis.');
    } finally {
      setUploadingAngle(null);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this subject photo?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/subject/photo/${photoId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error('Failed to delete photo.');
      }

      const data = await res.json();
      setProfile(data.profile);
      setSuccess('Photo deleted from profile.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClearProfile = async () => {
    if (!confirm('Are you sure you want to clear the entire subject profile? This will delete all uploaded photos.')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/subject', {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error('Failed to clear profile.');
      }

      setProfile({ photos: [], summary: '', traitsList: [] });
      setSuccess('Subject profile cleared.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleForceSummarize = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/subject/summarize', {
        method: 'POST'
      });

      if (!res.ok) {
        throw new Error('Failed to summarize.');
      }

      const data = await res.json();
      setProfile(data.profile);
      setSuccess('Physical description compiled successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'slideUp 0.3s ease', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px', fontFamily: 'var(--font-headline)', fontWeight: 700 }}>
            Subject Profile
          </h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '14px', maxWidth: '800px' }}>
            Upload photos of your subject (e.g., yourself, a model, or character) from multiple angles. 
            Vertex AI Gemini will analyze the facial/body features to build a consistent physical identity, 
            which is then referenced directly in AI generated clips to maintain face consistency.
          </p>
        </div>
        
        {profile.photos.length > 0 && (
          <button
            onClick={handleClearProfile}
            className="btn-secondary"
            style={{ color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.2)' }}
          >
            <Trash2 size={14} style={{ marginRight: '6px' }} />
            Clear Profile
          </button>
        )}
      </div>

      {/* Alerts */}
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
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: 'var(--success)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={18} /> {success}
        </div>
      )}

      {/* Upload Angles Grid */}
      <h3 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 600 }}>Face Sides & Angles</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {ANGLES.map(angle => {
          const photo = profile.photos.find(p => p.angle === angle);
          const isUploading = uploadingAngle === angle;

          if (photo) {
            return (
              <div key={photo.id} className="glass-panel" style={{ padding: '16px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative', width: '100%', paddingTop: '100%', borderRadius: '6px', overflow: 'hidden', background: '#000' }}>
                  <img
                    src={photo.path}
                    alt={angle}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.6)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ff453a',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 69, 58, 0.8)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
                    title="Delete Photo"
                  >
                    <Trash2 size={13} />
                  </button>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-white)'
                  }}>
                    {angle}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Gemini Feature Analysis</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-gray)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={photo.analysis.description}>
                    {photo.analysis.description}
                  </p>
                  
                  {photo.analysis.traits && photo.analysis.traits.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {photo.analysis.traits.slice(0, 4).map((trait, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            fontSize: '9px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-light)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            color: 'var(--text-white)'
                          }}
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={angle}
              className="glass-panel"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: '260px',
                border: isUploading ? '1px solid var(--primary)' : '1px dashed var(--border-medium)',
                cursor: isUploading ? 'default' : 'pointer',
                position: 'relative'
              }}
            >
              {isUploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)' }}>Analyzing Face Details...</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-gray)' }}>Gemini Vision Engine running analysis</span>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', height: '100%' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadPhoto(angle, file);
                    }}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-gray)'
                  }}>
                    <Upload size={18} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', display: 'block' }}>{angle}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-gray)', marginTop: '4px', display: 'block' }}>Click to upload profile photo</span>
                  </div>
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Compiled Profile Description */}
      <div className="glass-panel" style={{ padding: '32px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-headline)', fontWeight: 600, margin: 0 }}>
              Physical Identity Summary
            </h3>
          </div>
          
          {profile.photos.length > 0 && (
            <button
              onClick={handleForceSummarize}
              disabled={loading}
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px', height: '32px' }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
              Sync Description
            </button>
          )}
        </div>

        {profile.photos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-white)', lineHeight: '1.6', margin: 0, fontWeight: 500 }}>
                {profile.summary || 'Click "Sync Description" to compile uploaded photos analysis.'}
              </p>
            </div>

            {profile.traitsList && profile.traitsList.length > 0 && (
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
                  Unified Physical Traits
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {profile.traitsList.map((trait, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-medium)',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        color: 'var(--text-white)',
                        fontWeight: 500
                      }}
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 0', color: 'var(--text-muted)' }}>
            <User size={48} style={{ opacity: 0.15 }} />
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)', display: 'block' }}>No Subject Profile Uploaded</span>
              <span style={{ fontSize: '12px', color: 'var(--text-gray)', marginTop: '4px', display: 'block' }}>Upload photos from various angles above to compile your subject's description.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
