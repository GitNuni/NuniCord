import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Avatar from './Avatar';

export default function UserProfileModal({ user, onClose, anchorEl }) {
  const ref = useRef(null);

  // Position near anchor element if provided, otherwise center
  const pos = (() => {
    if (!anchorEl) return null;
    const r = anchorEl.getBoundingClientRect();
    return {
      top: Math.min(r.bottom + 8, window.innerHeight - 280),
      left: Math.max(8, Math.min(r.left, window.innerWidth - 240)),
    };
  })();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorEl && !anchorEl.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorEl]);

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const statusColors = {
    online: 'var(--nc-status-green)',
    idle: 'var(--nc-status-yellow)',
    dnd: 'var(--nc-status-red)',
    offline: 'var(--nc-text-muted)',
  };

  const card = (
    <div
      ref={ref}
      style={{
        position: pos ? 'fixed' : 'fixed',
        top: pos ? pos.top : '50%',
        left: pos ? pos.left : '50%',
        transform: pos ? 'none' : 'translate(-50%, -50%)',
        width: 240,
        background: 'var(--nc-bg-secondary)',
        border: '1px solid var(--nc-divider)',
        borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        zIndex: 10000,
        overflow: 'hidden',
      }}
    >
      {/* Banner */}
      <div style={{ height: 60, background: 'rgb(var(--nc-brand-rgb) / 0.3)', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 6,
            color: '#fff', cursor: 'pointer', padding: 4, display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Avatar */}
      <div style={{ padding: '0 16px', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: -28, left: 16,
          border: '4px solid var(--nc-bg-secondary)', borderRadius: '50%',
          background: 'var(--nc-bg-secondary)',
        }}>
          <div style={{ position: 'relative' }}>
            <Avatar user={user} size={52} />
            <span
              className={`status-indicator status-${user?.status || 'offline'}`}
              style={{ position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, border: '3px solid var(--nc-bg-secondary)' }}
            />
          </div>
        </div>

        <div style={{ paddingTop: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--nc-header-primary)' }}>
            {user?.display_name || user?.username}
          </div>
          <div style={{ fontSize: 12, color: 'var(--nc-text-muted)', marginBottom: 4 }}>
            @{user?.username}
          </div>

          {user?.pronouns && (
            <div style={{ fontSize: 11, color: 'var(--nc-text-muted)', marginBottom: 4 }}>
              {user.pronouns}
            </div>
          )}

          {user?.custom_status && (
            <div style={{
              fontSize: 12, color: 'var(--nc-text-normal)',
              background: 'var(--nc-bg-tertiary)', borderRadius: 6,
              padding: '4px 8px', marginTop: 4, marginBottom: 8,
            }}>
              {user.custom_status}
            </div>
          )}

          {user?.bio && (
            <div style={{
              fontSize: 12, color: 'var(--nc-text-normal)',
              borderTop: '1px solid var(--nc-divider)',
              paddingTop: 8, marginTop: 4, marginBottom: 12,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {user.bio}
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 12 }} />
    </div>
  );

  // Backdrop only when centered (no anchor)
  if (!pos) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)' }}
        onMouseDown={onClose}>
        {card}
      </div>,
      document.body
    );
  }

  return createPortal(card, document.body);
}
