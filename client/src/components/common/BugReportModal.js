import React, { useState } from 'react';
import { Bug, X, Send } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/auth';

function collectDeviceInfo() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    online: nav.onLine,
    networkType: conn?.effectiveType || 'unknown',
    appVersion: process.env.REACT_APP_VERSION || '1.0.0',
    currentUrl: window.location.pathname,
    theme: localStorage.getItem('nc_user_theme') || 'default',
    timestamp: new Date().toISOString(),
  };
}

export default function BugReportModal({ onClose }) {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please fill in both fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/bugs', {
        title: title.trim(),
        description: description.trim(),
        device_info: collectDeviceInfo(),
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--nc-bg-secondary)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/20">
          <div className="flex items-center gap-2">
            <Bug size={18} style={{ color: 'rgb(var(--nc-brand-rgb))' }} />
            <span className="font-bold text-base" style={{ color: 'var(--nc-header-primary)' }}>
              Report a Bug
            </span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--nc-interactive-normal)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                 style={{ background: 'rgb(var(--nc-brand-rgb) / 0.15)' }}>
              <Send size={24} style={{ color: 'rgb(var(--nc-brand-rgb))' }} />
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--nc-header-primary)' }}>Thanks!</h3>
            <p className="text-sm" style={{ color: 'var(--nc-text-muted)' }}>
              Your bug report has been submitted. We'll look into it.
            </p>
            <button onClick={onClose} className="nc-btn-primary mt-6 px-8 py-2">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                     style={{ color: 'var(--nc-text-muted)' }}>
                Title
              </label>
              <input
                className="nc-input w-full"
                placeholder="Short description of the issue"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                     style={{ color: 'var(--nc-text-muted)' }}>
                What happened?
              </label>
              <textarea
                className="nc-input w-full resize-none"
                rows={5}
                placeholder="Describe the bug. What did you expect to happen? What actually happened? Steps to reproduce..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={2000}
              />
            </div>

            <p className="text-xs" style={{ color: 'var(--nc-text-muted)' }}>
              Device info (browser, OS, screen resolution) will be included automatically to help with debugging.
            </p>

            {error && (
              <p className="text-xs" style={{ color: 'var(--nc-status-danger)' }}>{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1 pb-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--nc-bg-tertiary)', color: 'var(--nc-interactive-normal)', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="nc-btn-primary px-5 py-2 text-sm"
                style={{ opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
