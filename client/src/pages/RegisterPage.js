import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast('PASSKEY MUST BE 8+ CHARACTERS', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await register(form.username, form.email, form.password, form.display_name);
      if (data.pending) {
        setPending(true);
        return;
      }
      navigate('/');
    } catch (err) {
      const errors = err.response?.data?.errors;
      const message = errors
        ? errors.map(e => e.msg).join(' · ')
        : err.response?.data?.error || 'REGISTRATION FAILED';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <div style={{
        minHeight: '100vh', background: '#020609',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Share Tech Mono", "Courier New", monospace',
      }}>
        <div style={{
          width: '100%', maxWidth: 420, background: 'rgba(4,10,15,0.97)',
          border: '1px solid rgba(0,212,255,0.2)',
          boxShadow: '0 0 40px rgba(0,0,0,0.9)',
          padding: '36px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 16, color: '#00d4ff' }}>⏳</div>
          <div style={{ fontSize: 13, color: '#00d4ff', letterSpacing: '0.2em', marginBottom: 12 }}>
            ACCESS REQUEST SUBMITTED
          </div>
          <div style={{ fontSize: 11, color: '#5a8a9f', letterSpacing: '0.08em', lineHeight: 1.6 }}>
            Your registration is pending admin approval.<br />
            You will be notified when access is granted.
          </div>
          <Link to="/login" style={{
            display: 'inline-block', marginTop: 24, color: '#00d4ff',
            fontSize: 11, letterSpacing: '0.2em', textDecoration: 'none',
          }}>
            RETURN TO LOGIN
          </Link>
        </div>
      </div>
    );
  }

  const fields = [
    { name: 'username',     label: 'USERNAME',     type: 'text',     placeholder: 'unique_handle',  hint: 'Letters, numbers, _ . - only', required: true, minLength: 2, maxLength: 32 },
    { name: 'display_name', label: 'DISPLAY NAME', type: 'text',     placeholder: 'Optional alias', hint: null, maxLength: 64 },
    { name: 'email',        label: 'EMAIL',        type: 'email',    placeholder: 'user@domain.com', hint: null },
    { name: 'password',     label: 'PASSKEY',      type: 'password', placeholder: '8+ characters',  hint: null, required: true, minLength: 8 },
  ];

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
      <div className="hex-bg" style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)',
        animation: 'scanline 8s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Corner decorations */}
      {['tl','tr','bl','br'].map(pos => (
        <div key={pos} style={{
          position: 'fixed',
          top: pos.startsWith('t') ? 16 : 'auto',
          bottom: pos.startsWith('b') ? 16 : 'auto',
          left: pos.endsWith('l') ? 16 : 'auto',
          right: pos.endsWith('r') ? 16 : 'auto',
          width: 36, height: 36,
          borderTop:    pos.startsWith('t') ? '1px solid rgba(0,212,255,0.3)' : 'none',
          borderBottom: pos.startsWith('b') ? '1px solid rgba(0,212,255,0.3)' : 'none',
          borderLeft:   pos.endsWith('l')   ? '1px solid rgba(0,212,255,0.3)' : 'none',
          borderRight:  pos.endsWith('r')   ? '1px solid rgba(0,212,255,0.3)' : 'none',
        }} />
      ))}

      <div
        style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(4,10,15,0.97)',
          border: '1px solid rgba(0,212,255,0.2)',
          boxShadow: '0 0 40px rgba(0,0,0,0.9), 0 0 60px rgba(0,212,255,0.04)',
          padding: '36px',
          position: 'relative',
          animation: 'boot 0.4s ease-out',
        }}
      >
        {/* Top line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
        }} />
        {/* Corner brackets */}
        {['tl','tr','bl','br'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            top: pos.startsWith('t') ? -1 : 'auto',
            bottom: pos.startsWith('b') ? -1 : 'auto',
            left: pos.endsWith('l') ? -1 : 'auto',
            right: pos.endsWith('r') ? -1 : 'auto',
            width: 14, height: 14,
            borderTop:    pos.startsWith('t') ? '2px solid #00d4ff' : 'none',
            borderBottom: pos.startsWith('b') ? '2px solid #00d4ff' : 'none',
            borderLeft:   pos.endsWith('l')   ? '2px solid #00d4ff' : 'none',
            borderRight:  pos.endsWith('r')   ? '2px solid #00d4ff' : 'none',
          }} />
        ))}

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            border: '2px solid #00d4ff',
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)',
            background: 'rgba(0,212,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#00d4ff',
            boxShadow: '0 0 12px rgba(0,212,255,0.3)',
          }}>N</div>
          <div>
            <div style={{ fontSize: 14, letterSpacing: '0.25em', color: '#c0e4f4', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Request Access
            </div>
            <div style={{ fontSize: 9, color: '#2a5870', letterSpacing: '0.15em', marginTop: 2 }}>
              NEW OPERATOR REGISTRATION
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {fields.map(field => (
            <CtosField
              key={field.name}
              {...field}
              value={form[field.name]}
              onChange={handleChange}
            />
          ))}

          <div style={{ fontSize: 9, color: '#1e3d50', letterSpacing: '0.08em', marginTop: -6 }}>
            BY REGISTERING YOU ACCEPT OPERATIONAL TERMS AND CONDITIONS.
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? 'rgba(0,212,255,0.06)' : 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.5)',
              color: '#00d4ff',
              padding: '11px 0',
              fontSize: 11,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
              boxShadow: loading ? 'none' : '0 0 10px rgba(0,212,255,0.25)',
              transition: 'all 0.2s',
              width: '100%',
            }}
            onMouseEnter={e => !loading && (e.currentTarget.style.background = 'rgba(0,212,255,0.22)')}
            onMouseLeave={e => !loading && (e.currentTarget.style.background = 'rgba(0,212,255,0.12)')}
          >
            {loading ? 'PROCESSING...' : 'REGISTER OPERATOR'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#2e5568', marginTop: 20, letterSpacing: '0.08em' }}>
          ALREADY REGISTERED?{' '}
          <Link
            to="/login"
            style={{ color: '#00d4ff', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textShadow = '0 0 6px rgba(0,212,255,0.8)'}
            onMouseLeave={e => e.currentTarget.style.textShadow = 'none'}
          >
            ACCESS SYSTEM
          </Link>
        </p>
      </div>
    </div>
  );
}

function CtosField({ name, label, type, value, onChange, placeholder, hint, required, minLength, maxLength }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{
        fontSize: 9, color: focused ? '#00d4ff' : '#2a5870',
        letterSpacing: '0.2em', textTransform: 'uppercase',
        marginBottom: 5, transition: 'color 0.2s', display: 'flex', gap: 6,
      }}>
        {label}
        {required && <span style={{ color: '#ff3c00' }}>*</span>}
      </div>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          background: focused ? '#0d1d28' : '#080f18',
          border: 'none',
          borderBottom: `1px solid ${focused ? '#00d4ff' : 'rgba(0,212,255,0.15)'}`,
          color: '#9ecfdf',
          padding: '7px 0',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          letterSpacing: '0.04em',
          boxShadow: focused ? '0 2px 0 rgba(0,212,255,0.12)' : 'none',
          transition: 'all 0.2s',
        }}
      />
      {hint && <div style={{ fontSize: 9, color: '#1e3d50', marginTop: 4, letterSpacing: '0.08em' }}>{hint}</div>}
    </div>
  );
}
