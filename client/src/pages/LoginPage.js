import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';

export default function LoginPage() {
  const [login, setLogin] = useState(() => localStorage.getItem('rememberedLogin') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedLogin'));
  const [loading, setLoading] = useState(false);
  const [bootText, setBootText] = useState('');
  const { login: doLogin } = useAuthStore();
  const navigate = useNavigate();

  // Boot sequence text animation
  useEffect(() => {
    const lines = [
      'INITIALIZING CTOS INTERFACE...',
      'ESTABLISHING SECURE TUNNEL...',
      'ENCRYPTION PROTOCOL: AES-256',
      'READY.',
    ];
    let i = 0;
    let charI = 0;
    let current = '';
    const iv = setInterval(() => {
      if (i >= lines.length) { clearInterval(iv); return; }
      if (charI < lines[i].length) {
        current += lines[i][charI++];
        setBootText(current);
      } else {
        current = '';
        charI = 0;
        i++;
        if (i < lines.length) setBootText('');
      }
    }, 35);
    return () => clearInterval(iv);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await doLogin(login, password);
      if (rememberMe) localStorage.setItem('rememberedLogin', login);
      else localStorage.removeItem('rememberedLogin');
      navigate('/');
    } catch (err) {
      toast(err.response?.data?.error || 'ACCESS DENIED', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#020609',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Share Tech Mono", "Courier New", monospace',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Hex grid background */}
      <div className="hex-bg" style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

      {/* Animated scan line */}
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)',
          animation: 'scanline 6s linear infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Corner decorations */}
      {['tl','tr','bl','br'].map(pos => (
        <div
          key={pos}
          style={{
            position: 'fixed',
            top: pos.startsWith('t') ? 16 : 'auto',
            bottom: pos.startsWith('b') ? 16 : 'auto',
            left: pos.endsWith('l') ? 16 : 'auto',
            right: pos.endsWith('r') ? 16 : 'auto',
            width: 40, height: 40,
            borderTop: pos.startsWith('t') ? '1px solid rgba(0,212,255,0.4)' : 'none',
            borderBottom: pos.startsWith('b') ? '1px solid rgba(0,212,255,0.4)' : 'none',
            borderLeft: pos.endsWith('l') ? '1px solid rgba(0,212,255,0.4)' : 'none',
            borderRight: pos.endsWith('r') ? '1px solid rgba(0,212,255,0.4)' : 'none',
          }}
        />
      ))}

      {/* Panel */}
      <div
        style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(4,10,15,0.95)',
          border: '1px solid rgba(0,212,255,0.2)',
          boxShadow: '0 0 40px rgba(0,0,0,0.9), 0 0 80px rgba(0,212,255,0.05)',
          padding: '40px 36px',
          position: 'relative',
          animation: 'boot 0.5s ease-out',
        }}
      >
        {/* Top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
        }} />
        {/* Panel corner brackets */}
        {['tl','tr','bl','br'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            top: pos.startsWith('t') ? -1 : 'auto',
            bottom: pos.startsWith('b') ? -1 : 'auto',
            left: pos.endsWith('l') ? -1 : 'auto',
            right: pos.endsWith('r') ? -1 : 'auto',
            width: 16, height: 16,
            borderTop: pos.startsWith('t') ? '2px solid #00d4ff' : 'none',
            borderBottom: pos.startsWith('b') ? '2px solid #00d4ff' : 'none',
            borderLeft: pos.endsWith('l') ? '2px solid #00d4ff' : 'none',
            borderRight: pos.endsWith('r') ? '2px solid #00d4ff' : 'none',
          }} />
        ))}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-block',
              width: 56, height: 56,
              background: 'transparent',
              border: '2px solid #00d4ff',
              clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)',
              lineHeight: '52px',
              fontSize: 24,
              color: '#00d4ff',
              textAlign: 'center',
              boxShadow: '0 0 20px rgba(0,212,255,0.4)',
              marginBottom: 16,
              animation: 'flicker 8s linear infinite',
            }}
          >
            N
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: '0.3em',
              color: '#c0e4f4',
              textTransform: 'uppercase',
              fontWeight: 'bold',
            }}
            data-text="NUNICORD"
          >
            NUNICORD
          </div>
          <div style={{ fontSize: 10, color: '#2a5870', letterSpacing: '0.2em', marginTop: 4 }}>
            SECURE COMMUNICATION TERMINAL
          </div>
        </div>

        {/* Boot text */}
        <div style={{
          fontSize: 10, color: '#00d4ff', letterSpacing: '0.1em',
          marginBottom: 24, minHeight: 14, opacity: 0.7,
        }}>
          {bootText}<span style={{ animation: 'flicker 0.8s linear infinite' }}>█</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <CtosField
            label="IDENTIFIER"
            type="text"
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="email or username"
            autoFocus
          />
          <CtosField
            label="PASSKEY"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••••"
          />

          {/* Remember me */}
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <div
              style={{
                width: 14, height: 14, flexShrink: 0,
                border: `1px solid ${rememberMe ? '#00d4ff' : 'rgba(0,212,255,0.3)'}`,
                background: rememberMe ? 'rgba(0,212,255,0.2)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              {rememberMe && <span style={{ color: '#00d4ff', fontSize: 10, lineHeight: 1 }}>✓</span>}
            </div>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              style={{ display: 'none' }}
            />
            <span style={{ fontSize: 10, color: '#2a5870', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Remember identifier
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? 'rgba(0,212,255,0.1)' : 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.6)',
              color: '#00d4ff',
              padding: '12px 0',
              fontSize: 12,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
              boxShadow: loading ? 'none' : '0 0 12px rgba(0,212,255,0.3)',
              transition: 'all 0.2s',
              width: '100%',
              marginTop: 8,
            }}
            onMouseEnter={e => !loading && (e.currentTarget.style.background = 'rgba(0,212,255,0.25)')}
            onMouseLeave={e => !loading && (e.currentTarget.style.background = 'rgba(0,212,255,0.15)')}
          >
            {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(0,212,255,0.1)' }} />
          <span style={{ fontSize: 9, color: '#1e3d50', letterSpacing: '0.2em' }}>PROTOCOL</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(0,212,255,0.1)' }} />
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#2e5568', letterSpacing: '0.1em' }}>
          NO ACCESS CREDENTIALS?{' '}
          <Link
            to="/register"
            style={{ color: '#00d4ff', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textShadow = '0 0 8px rgba(0,212,255,0.8)'}
            onMouseLeave={e => e.currentTarget.style.textShadow = 'none'}
          >
            REQUEST ACCESS
          </Link>
        </p>

        {/* OAuth */}
        {process.env.REACT_APP_OAUTH_GOOGLE === 'true' && (
          <a
            href="/api/auth/google"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 12, padding: '10px 0',
              background: 'transparent',
              border: '1px solid rgba(0,212,255,0.15)',
              color: '#5a8fa8', fontSize: 11, letterSpacing: '0.1em',
              textDecoration: 'none', textTransform: 'uppercase',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
            Google Auth
          </a>
        )}
      </div>
    </div>
  );
}

function CtosField({ label, type, value, onChange, placeholder, autoFocus }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{
        fontSize: 9, color: focused ? '#00d4ff' : '#2a5870',
        letterSpacing: '0.2em', textTransform: 'uppercase',
        marginBottom: 6, transition: 'color 0.2s',
      }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required
        style={{
          width: '100%',
          background: focused ? '#0d1d28' : '#080f18',
          border: 'none',
          borderBottom: `1px solid ${focused ? '#00d4ff' : 'rgba(0,212,255,0.2)'}`,
          color: '#9ecfdf',
          padding: '8px 0',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          letterSpacing: '0.05em',
          boxShadow: focused ? '0 2px 0 rgba(0,212,255,0.15)' : 'none',
          transition: 'all 0.2s',
        }}
      />
    </div>
  );
}
