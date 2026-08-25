import { useState, useEffect } from 'react';
import { Film, Settings as SettingsIcon, Play, Video, Terminal, Music, Zap, Folder, LogOut, User, Check, X, Bell, HelpCircle, Rocket, Sun, Moon, Sparkles, Clock } from 'lucide-react';
import ClipsLibrary from './components/ClipsLibrary';
import MusicLibrary from './components/MusicLibrary';
import CreateProject from './components/CreateProject';
import RenderCenter from './components/RenderCenter';
import Settings from './components/Settings';
import BeatSync from './components/BeatSync';
import ProjectsList from './components/ProjectsList';
import RecreateReel from './components/RecreateReel';
import SubjectProfile from './components/SubjectProfile';
import YoutubeCreator from './components/YoutubeCreator';
import QuickBeatSync from './components/QuickBeatSync';
import RenderHistory from './components/RenderHistory';

type Tab = 'projects' | 'library' | 'music' | 'create' | 'render' | 'settings' | 'editor' | 'beatsync' | 'recreate' | 'subject' | 'youtube' | 'quick-beatsync' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('vgen_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('vgen_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };


  // SaaS States
  const [user, setUser] = useState<{ email: string; plan: string; credits: number } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [customCreditsAmount, setCustomCreditsAmount] = useState('500');

  const fetchUserProfile = async () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        if (isLocalhost) {
          setUser({ email: 'local-user', plan: 'local', credits: 999999 });
        } else {
          setUser(null);
          setShowAuthModal(true);
        }
      }
    } catch (_) {
      if (isLocalhost) {
        setUser({ email: 'local-user', plan: 'local', credits: 999999 });
      } else {
        setUser(null);
        setShowAuthModal(true);
      }
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const cleanEmail = authEmail.trim();
      const cleanPassword = authPassword.trim();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        try {
          localStorage.setItem('vgen_token', data.user.email);
        } catch (_) {}
        setUser(data.user);
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login request failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const cleanEmail = authEmail.trim();
      const cleanPassword = authPassword.trim();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        try {
          localStorage.setItem('vgen_token', data.user.email);
        } catch (_) {}
        setUser(data.user);
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Registration failed.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Registration request failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vgen_token');
    setUser({ email: 'local-user', plan: 'local', credits: 999999 });
    window.location.reload();
  };

  const handleUpgradePlan = async (plan: 'free' | 'pro' | 'business') => {
    setBillingLoading(true);
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        alert(`Successfully upgraded to ${plan.toUpperCase()} tier!`);
      } else {
        alert(data.error || 'Failed to upgrade.');
      }
    } catch (err: any) {
      alert(err.message || 'Upgrade request failed.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleAddCredits = async () => {
    const amount = parseInt(customCreditsAmount, 10);
    if (isNaN(amount) || amount <= 0) return;
    setBillingLoading(true);
    try {
      const res = await fetch('/api/billing/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        alert(`Successfully purchased ${amount} credits!`);
      } else {
        alert(data.error || 'Failed to add credits.');
      }
    } catch (err: any) {
      alert(err.message || 'Purchase request failed.');
    } finally {
      setBillingLoading(false);
    }
  };

  const getCreditProgressInfo = () => {
    if (!user) return { percentage: 100, strokeDashoffset: 0, limit: '∞', current: 0 };
    if (user.plan === 'local') return { percentage: 100, strokeDashoffset: 0, limit: '∞', current: 999999 };
    
    let limit = 100;
    if (user.plan === 'pro') limit = 1000;
    if (user.plan === 'business') limit = 5000;
    
    const current = user.credits;
    const percentage = Math.min(100, Math.max(0, (current / limit) * 100));
    const strokeDashoffset = 113.097 - (113.097 * percentage) / 100;
    
    return { percentage, strokeDashoffset, limit, current };
  };

  const startRenderJob = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveTab('render');
  };

  const clearRenderSession = () => {
    setActiveJobId(null);
  };

  const [activeProjectType, setActiveProjectType] = useState<'create' | 'beatsync' | 'talkinghead' | 'subtitles' | 'youtube' | null>(null);

  const openProject = (projectId: string, type: 'create' | 'beatsync' | 'talkinghead' | 'subtitles' | 'youtube') => {
    setActiveProjectId(projectId);
    setActiveProjectType(type);
    setActiveTab(type === 'beatsync' ? 'beatsync' : type === 'youtube' ? 'youtube' : 'create');
  };

  const handleTabClick = async (tab: Tab) => {
    if (tab === 'create') {
      if (activeProjectId) {
        try {
          const res = await fetch(`/api/projects/${activeProjectId}`);
          if (res.ok) {
            const proj = await res.json();
            if (proj.type === 'create' || proj.type === 'talkinghead' || proj.type === 'subtitles') {
              setActiveProjectType(proj.type);
              setActiveTab('create');
              return;
            }
          }
        } catch (_) {}
      }
      
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const projects = await res.json();
          const lastVO = projects.find((p: any) => p.type === 'create' || p.type === 'talkinghead' || p.type === 'subtitles');
          if (lastVO) {
            openProject(lastVO.id, lastVO.type);
            return;
          }
        }
      } catch (_) {}

      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'create' })
        });
        if (res.ok) {
          const newProj = await res.json();
          openProject(newProj.id, newProj.type);
          return;
        }
      } catch (_) {}
      
      setActiveTab('create');
    } else if (tab === 'beatsync') {
      if (activeProjectId) {
        try {
          const res = await fetch(`/api/projects/${activeProjectId}`);
          if (res.ok) {
            const proj = await res.json();
            if (proj.type === 'beatsync') {
              setActiveTab('beatsync');
              return;
            }
          }
        } catch (_) {}
      }

      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const projects = await res.json();
          const lastBS = projects.find((p: any) => p.type === 'beatsync');
          if (lastBS) {
            openProject(lastBS.id, 'beatsync');
            return;
          }
        }
      } catch (_) {}

      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'beatsync' })
        });
        if (res.ok) {
          const newProj = await res.json();
          openProject(newProj.id, 'beatsync');
          return;
        }
      } catch (_) {}

      setActiveTab('beatsync');
    } else if (tab === 'youtube') {
      if (activeProjectId) {
        try {
          const res = await fetch(`/api/projects/${activeProjectId}`);
          if (res.ok) {
            const proj = await res.json();
            if (proj.type === 'youtube') {
              setActiveTab('youtube');
              return;
            }
          }
        } catch (_) {}
      }

      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const projects = await res.json();
          const lastYT = projects.find((p: any) => p.type === 'youtube');
          if (lastYT) {
            openProject(lastYT.id, 'youtube');
            return;
          }
        }
      } catch (_) {}

      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'youtube' })
        });
        if (res.ok) {
          const newProj = await res.json();
          openProject(newProj.id, 'youtube');
          return;
        }
      } catch (_) {}

      setActiveTab('youtube');
    } else {
      setActiveTab(tab);
    }
  };

  // Derived top-nav label for the active section
  const getTopNavLabel = () => {
    if (activeTab === 'projects') return 'My Projects';
    if (activeTab === 'create') {
      return activeProjectType === 'talkinghead' ? 'Talking Head Editor' : activeProjectType === 'subtitles' ? 'Add Subtitles Editor' : 'Video Creator Editor';
    }
    if (activeTab === 'beatsync') return 'Beat Sync Editor';
    if (activeTab === 'library') return 'Video Library';
    if (activeTab === 'music') return 'Music Library';
    if (activeTab === 'render') return 'Render Center';
    if (activeTab === 'settings') return 'Settings';
    if (activeTab === 'recreate') return 'Replicate Reel';
    if (activeTab === 'subject') return 'Subject Profile';
    if (activeTab === 'youtube') return 'YouTube Empire';
    return '';
  };

  const isEditorTab = activeTab === 'create' || activeTab === 'beatsync';

  return (
    <div className="dashboard-grid">
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '36px', padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: 'var(--primary)',
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Play size={8} fill="var(--primary-foreground)" color="var(--primary-foreground)" style={{ marginLeft: '1px' }} />
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-white)', fontFamily: 'var(--font-headline)', margin: 0, lineHeight: 1.1 }}>
                V-Gen Studio
              </h1>
            </div>
            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-gray)', marginTop: '2px', display: 'block', fontWeight: 600, paddingLeft: '28px' }}>
              AI Video Engine
            </span>
          </div>

          {/* Generate Video CTA */}
          <button
            className="sidebar-generate-btn"
            onClick={() => handleTabClick('create')}
          >
            <Rocket size={15} />
            Generate Video
          </button>

          <nav style={{ marginTop: '8px' }}>
            <div
              className={`nav-link ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => handleTabClick('projects')}
            >
              <Folder size={18} />
              My Projects
            </div>

            <div
              className={`nav-link ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => handleTabClick('create')}
            >
              <Film size={18} />
              Voiceover Video
            </div>

            <div
              className={`nav-link ${activeTab === 'beatsync' ? 'active' : ''}`}
              onClick={() => handleTabClick('beatsync')}
            >
              <Zap size={18} />
              Beat Sync Video
            </div>

            <div
              className={`nav-link ${activeTab === 'quick-beatsync' ? 'active' : ''}`}
              onClick={() => handleTabClick('quick-beatsync')}
            >
              <Sparkles size={18} />
              Quick Beat Sync
            </div>

            <div
              className={`nav-link ${activeTab === 'recreate' ? 'active' : ''}`}
              onClick={() => handleTabClick('recreate')}
            >
              <Sparkles size={18} />
              Replicate Reel
            </div>

            <div
              className={`nav-link ${activeTab === 'youtube' ? 'active' : ''}`}
              onClick={() => handleTabClick('youtube')}
            >
              <Play size={18} />
              YouTube Empire
            </div>

            <div
              className={`nav-link ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => handleTabClick('library')}
            >
              <Video size={18} />
              Video Library
            </div>

            <div
              className={`nav-link ${activeTab === 'music' ? 'active' : ''}`}
              onClick={() => handleTabClick('music')}
            >
              <Music size={18} />
              Music Library
            </div>

            <div
              className={`nav-link ${activeTab === 'subject' ? 'active' : ''}`}
              onClick={() => handleTabClick('subject')}
            >
              <User size={18} />
              Subject Profile
            </div>

            <div
              className={`nav-link ${activeTab === 'render' ? 'active' : ''}`}
              onClick={() => handleTabClick('render')}
            >
              <Terminal size={18} />
              Render Center
              {activeJobId && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  marginLeft: 'auto'
                }} />
              )}
            </div>

            <div
              className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => handleTabClick('history')}
            >
              <Clock size={18} />
              Render History
            </div>
          </nav>
        </div>

        <div>
          {/* Credit balance gauge widget */}
          {user && user.plan !== 'local' && (
            <div className="credit-widget" onClick={() => setShowBillingModal(true)} style={{ cursor: 'pointer' }}>
              <div className="circular-progress-container">
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <circle className="circular-progress-bg" cx="18" cy="18" r="15" />
                  <circle
                    className="circular-progress-bar"
                    cx="18"
                    cy="18"
                    r="15"
                    strokeDasharray="94.248"
                    strokeDashoffset={getCreditProgressInfo().strokeDashoffset}
                  />
                </svg>
              </div>
              <div className="credit-details">
                <span className="credit-title">Credits</span>
                <span className="credit-number">{user.credits}</span>
                <span className="credit-subtitle">of {getCreditProgressInfo().limit} limit</span>
              </div>
            </div>
          )}

          {user && user.plan === 'local' && (
            <div className="credit-widget" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}>
              <Zap size={16} color="var(--text-gray)" style={{ flexShrink: 0 }} />
              <div className="credit-details">
                <span className="credit-title">Local Workspace</span>
                <span className="credit-number" style={{ fontSize: '11px' }}>Unlimited Credits</span>
                <span className="credit-subtitle">Sync to Cloud SaaS</span>
              </div>
            </div>
          )}

          <div className="nav-link" onClick={() => handleTabClick('settings')} style={{ margin: 0, padding: '10px 16px' }}>
            <SettingsIcon size={18} />
            Settings
          </div>

          <div className="user-profile-section">
            {user && user.plan !== 'local' ? (
              <div className="profile-card" onClick={() => setShowBillingModal(true)}>
                <div className="profile-avatar">
                  {user.email.substring(0, 2)}
                </div>
                <div className="profile-info" style={{ flexGrow: 1 }}>
                  <span className="profile-name">{user.email}</span>
                  <span className="profile-badge">{user.plan} Account</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }}
                  className="btn-icon" 
                  title="Sign Out"
                  style={{ padding: '4px' }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <div className="profile-card" onClick={() => { setShowAuthModal(true); setAuthTab('login'); }}>
                <div className="profile-avatar" style={{ background: 'var(--bg-surface)' }}>
                  <User size={14} />
                </div>
                <div className="profile-info">
                  <span className="profile-name">Sign In / Register</span>
                  <span className="profile-badge" style={{ color: 'var(--text-muted)' }}>Local Mode</span>
                </div>
              </div>
            )}
          </div>
          <div style={{
            fontSize: '9px',
            color: 'var(--text-muted)',
            padding: '12px 8px 0 8px',
            textAlign: 'center',
            borderTop: '1px solid var(--border-light)',
            marginTop: '12px'
          }}>
            v1.1.0 (Cloud Sync Active)
          </div>
        </div>
      </aside>

      {/* Top Header Bar — Stitch Design */}
      <header className="top-header">
        {/* Left: Section breadcrumb / context tabs */}
        <div className="top-header-left">
          <nav className="top-header-tabs">
            <span className="top-header-tab active">{getTopNavLabel()}</span>
            {isEditorTab && (
              <>
                <span className="top-header-tab-sep">/</span>
                <span className="top-header-tab inactive">Inspector</span>
                <span className="top-header-tab-sep">/</span>
                <span className="top-header-tab inactive">Preview</span>
              </>
            )}
          </nav>
        </div>

        {/* Right: Action CTA + utility icons */}
        <div className="top-header-right">
          {isEditorTab && (
            <div className="top-header-actions">
              <button className="top-header-btn-ghost">Save Draft</button>
              <button
                className="top-header-btn-render"
                onClick={() => handleTabClick('render')}
              >
                Render Video
              </button>
            </div>
          )}

          <div className="top-header-icons">
            <button 
              className="btn-icon top-header-icon-btn" 
              onClick={toggleTheme} 
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="btn-icon top-header-icon-btn" title="Notifications">
              <Bell size={16} />
            </button>
            <button className="btn-icon top-header-icon-btn" title="Help">
              <HelpCircle size={16} />
            </button>
            <button
              className="btn-icon top-header-icon-btn"
              title="Settings"
              onClick={() => handleTabClick('settings')}
            >
              <SettingsIcon size={16} />
            </button>
            <div
              className="top-header-avatar"
              title={user?.email || 'Sign In'}
              onClick={() => user?.plan !== 'local' ? setShowBillingModal(true) : setShowAuthModal(true)}
            >
              {user && user.plan !== 'local'
                ? user.email.substring(0, 2).toUpperCase()
                : <User size={13} />}
            </div>
          </div>
        </div>
      </header>

      <main className="content-pane">
        {activeTab === 'projects' && (
          <ProjectsList onOpenProject={openProject} />
        )}

        {activeTab === 'create' && (
          <CreateProject projectId={activeProjectId} onStartRender={startRenderJob} />
        )}

        {activeTab === 'beatsync' && (
          <BeatSync projectId={activeProjectId} onStartRender={startRenderJob} />
        )}

        {activeTab === 'quick-beatsync' && (
          <QuickBeatSync />
        )}

        {activeTab === 'recreate' && (
          <RecreateReel onOpenProject={openProject} />
        )}

        {activeTab === 'library' && (
          <ClipsLibrary />
        )}

        {activeTab === 'music' && (
          <MusicLibrary />
        )}

        {activeTab === 'subject' && (
          <SubjectProfile />
        )}

        {activeTab === 'render' && (
          <RenderCenter jobId={activeJobId} onClearJob={clearRenderSession} />
        )}

        {activeTab === 'history' && (
          <RenderHistory />
        )}

        {activeTab === 'settings' && (
          <Settings />
        )}

        {activeTab === 'youtube' && (
          <YoutubeCreator projectId={activeProjectId} onStartRender={startRenderJob} onOpenProject={openProject} />
        )}
      </main>

      {/* SaaS Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => {
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const canCloseAuth = isLocalhost || (user !== null && user.plan !== 'local');
          if (canCloseAuth) setShowAuthModal(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || (user !== null && user.plan !== 'local')) && (
              <button className="modal-close" onClick={() => setShowAuthModal(false)}>
                <X size={18} />
              </button>
            )}
            
            <div className="auth-tabs">
              <div 
                className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
                onClick={() => setAuthTab('login')}
              >
                Sign In
              </div>
              <div 
                className={`auth-tab ${authTab === 'register' ? 'active' : ''}`}
                onClick={() => setAuthTab('register')}
              >
                Sign Up
              </div>
            </div>

            <form onSubmit={authTab === 'login' ? handleLogin : handleRegister}>
              {authError && (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  color: '#ff453a', 
                  padding: '10px', 
                  borderRadius: '6px', 
                  fontSize: '12px', 
                  marginBottom: '16px' 
                }}>
                  {authError}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label className="label">Email Address</label>
                <input 
                  type="email" 
                  required
                  className="input-field" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="label">Password</label>
                <input 
                  type="password" 
                  required
                  className="input-field" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%' }}
                disabled={authLoading}
              >
                {authLoading ? 'Please wait...' : authTab === 'login' ? 'Sign In to Studio' : 'Create SaaS Account'}
              </button>
            </form>

            <div style={{ 
              marginTop: '16px', 
              fontSize: '11px', 
              color: 'var(--text-muted)', 
              textAlign: 'center' 
            }}>
              By continuing, you agree to our Terms of Service & Privacy Policy.
            </div>
          </div>
        </div>
      )}

      {/* SaaS Billing & Plans Modal */}
      {showBillingModal && (
        <div className="modal-overlay" onClick={() => setShowBillingModal(false)}>
          <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBillingModal(false)}>
              <X size={18} />
            </button>
            <h2 style={{ marginBottom: '8px' }}>Manage Subscription & Credits</h2>
            <p style={{ color: 'var(--text-gray)', fontSize: '13px', marginBottom: '24px' }}>
              Current Account: <strong style={{ color: 'var(--text-white)' }}>{user?.email}</strong> (Plan: <span style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>{user?.plan}</span>)
            </p>

            <div className="pricing-grid">
              {/* Free Plan */}
              <div className={`pricing-card ${user?.plan === 'free' ? 'popular' : ''}`}>
                {user?.plan === 'free' && <div className="pricing-badge">Current</div>}
                <div>
                  <h3 className="pricing-name">Free Plan</h3>
                  <div className="pricing-price">$0<span>/month</span></div>
                  <ul className="pricing-features">
                    <li><Check size={14} /> 100 Credits included</li>
                    <li><Check size={14} /> 720p maximum resolution</li>
                    <li><Check size={14} /> Standard generation speeds</li>
                  </ul>
                </div>
                <button 
                  className="btn-secondary" 
                  disabled={user?.plan === 'free' || billingLoading}
                  onClick={() => handleUpgradePlan('free')}
                >
                  {user?.plan === 'free' ? 'Active' : 'Downgrade'}
                </button>
              </div>

              {/* Pro Plan */}
              <div className={`pricing-card ${user?.plan === 'pro' ? 'popular' : ''}`}>
                {user?.plan === 'pro' && <div className="pricing-badge">Current</div>}
                <div>
                  <h3 className="pricing-name">Pro Plan</h3>
                  <div className="pricing-price">$19<span>/month</span></div>
                  <ul className="pricing-features">
                    <li><Check size={14} /> 1000 Credits monthly</li>
                    <li><Check size={14} /> 1080p full resolution</li>
                    <li><Check size={14} /> Custom font uploading</li>
                    <li><Check size={14} /> Priority generation queue</li>
                  </ul>
                </div>
                <button 
                  className="btn-primary" 
                  disabled={user?.plan === 'pro' || billingLoading}
                  onClick={() => handleUpgradePlan('pro')}
                >
                  {user?.plan === 'pro' ? 'Active' : 'Upgrade to Pro'}
                </button>
              </div>

              {/* Business Plan */}
              <div className={`pricing-card ${user?.plan === 'business' ? 'popular' : ''}`}>
                {user?.plan === 'business' && <div className="pricing-badge">Current</div>}
                <div>
                  <h3 className="pricing-name">Business Plan</h3>
                  <div className="pricing-price">$49<span>/month</span></div>
                  <ul className="pricing-features">
                    <li><Check size={14} /> 5000 Credits monthly</li>
                    <li><Check size={14} /> Up to 4K resolution</li>
                    <li><Check size={14} /> Ultimate processing priority</li>
                    <li><Check size={14} /> Multi-tenant cloud workspace</li>
                  </ul>
                </div>
                <button 
                  className="btn-primary" 
                  disabled={user?.plan === 'business' || billingLoading}
                  onClick={() => handleUpgradePlan('business')}
                >
                  {user?.plan === 'business' ? 'Active' : 'Upgrade to Business'}
                </button>
              </div>
            </div>

            <div className="buy-credits-section">
              <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Purchase Additional Credits</h3>
              <p style={{ color: 'var(--text-gray)', fontSize: '12px', marginBottom: '16px' }}>
                Credits cost $0.02 each. Add credits directly to your balance to continue rendering without upgrading.
              </p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  className="input-field" 
                  value={customCreditsAmount} 
                  onChange={(e) => setCustomCreditsAmount(e.target.value)}
                  style={{ width: '120px' }}
                  placeholder="500"
                  min="100"
                />
                <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>
                  = ${(parseInt(customCreditsAmount, 10) * 0.02 || 0).toFixed(2)} USD
                </span>
                <button 
                  className="btn-primary" 
                  onClick={handleAddCredits}
                  disabled={billingLoading}
                  style={{ marginLeft: 'auto' }}
                >
                  Buy {customCreditsAmount} Credits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
