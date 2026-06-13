import React, { useState, useEffect } from 'react';
import { Save, Key, ShieldCheck, HelpCircle } from 'lucide-react';

interface SettingsProps {
  onSettingsSaved?: () => void;
}

export default function Settings({ onSettingsSaved }: SettingsProps) {
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setElevenLabsApiKey(data.elevenLabsApiKey || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          elevenLabsApiKey
        })
      });

      if (!res.ok) {
        throw new Error('Failed to save settings');
      }

      setSuccess(true);
      if (onSettingsSaved) onSettingsSaved();
      
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', animation: 'slideUp 0.3s ease' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Application Settings</h2>
        <p style={{ color: 'var(--text-gray)', fontSize: '14px' }}>
          Configure API credentials to enable video intelligence, voiceovers, and automatic segmentation.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-panel" style={{ padding: '32px' }}>
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
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
            <ShieldCheck size={18} /> Settings saved successfully!
          </div>
        )}

        <div style={{ marginBottom: '32px' }}>
          <label className="label" htmlFor="elevenlabs-key">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={14} style={{ color: 'var(--accent-blue)' }} />
              ElevenLabs API Key (Optional)
            </span>
          </label>
          <input
            id="elevenlabs-key"
            type="password"
            className="input-field"
            placeholder="Enter ElevenLabs API Key"
            value={elevenLabsApiKey}
            onChange={(e) => setElevenLabsApiKey(e.target.value)}
          />
          <span style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            display: 'block',
            marginTop: '6px'
          }}>
            Required if you want to generate high-quality text-to-speech voiceovers directly within the software.
          </span>
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="glass-panel" style={{ marginTop: '24px', padding: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <HelpCircle size={24} style={{ color: 'var(--accent-purple)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ fontSize: '15px', marginBottom: '4px' }}>Where do my keys go?</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-gray)', lineHeight: '1.5' }}>
            Your API keys are stored locally on your own Mac inside the <code>backend/db.json</code> file. They are never sent to any external server other than the official Google Gemini and ElevenLabs APIs.
          </p>
        </div>
      </div>
    </div>
  );
}
