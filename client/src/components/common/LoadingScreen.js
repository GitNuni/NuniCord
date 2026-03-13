import React, { useEffect, useState } from 'react';

const BOOT_LINES = [
  'INITIALIZING CTOS INTERFACE...',
  'LOADING SECURE CHANNELS...',
  'ESTABLISHING ENCRYPTED LINK...',
  'SYNCING OPERATOR DATA...',
  'SYSTEM READY.',
];

export default function LoadingScreen() {
  const [lines, setLines] = useState([]);
  const [dot, setDot] = useState(true);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setLines(prev => [...prev, BOOT_LINES[i++]]);
      } else {
        clearInterval(iv);
      }
    }, 300);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setDot(d => !d), 400);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: '#020609',
        fontFamily: '"Share Tech Mono", "Courier New", monospace',
        flexDirection: 'column', gap: 24,
        position: 'relative',
      }}
    >
      <div className="hex-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />

      {/* Logo */}
      <div style={{
        width: 56, height: 56,
        border: '2px solid #00d4ff',
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: '#00d4ff',
        boxShadow: '0 0 20px rgba(0,212,255,0.5)',
        animation: 'pulseCyan 2s ease-in-out infinite',
        position: 'relative', zIndex: 1,
      }}>
        N
      </div>

      {/* Boot text */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        minWidth: 300, position: 'relative', zIndex: 1,
      }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: 10,
              color: i === lines.length - 1 ? '#00d4ff' : '#2a5870',
              letterSpacing: '0.12em',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {i === lines.length - 1 ? '> ' : '  '}{line}
            {i === lines.length - 1 && (
              <span style={{ opacity: dot ? 1 : 0 }}>█</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{
        width: 300, height: 2,
        background: 'rgba(0,212,255,0.08)',
        position: 'relative', zIndex: 1,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
          animation: 'scanline 1.8s linear infinite',
        }} />
      </div>
    </div>
  );
}
