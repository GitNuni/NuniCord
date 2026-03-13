import React, { useState } from 'react';
import { X, Hash, Volume2, Trash2, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../store/ui';
import Portal from '../common/Portal';
import { useNavigate } from 'react-router-dom';

export default function ChannelSettingsModal({ channel, serverId, onClose, onDeleted, onChannelUpdated }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: channel.name || '',
    topic: channel.topic || '',
    nsfw: channel.nsfw || false,
    slowmode_delay: channel.slowmode_delay || 0,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/channels/${channel.id}`, {
        name: form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        topic: form.topic || null,
        nsfw: form.nsfw,
        slowmode_delay: Number(form.slowmode_delay),
      });
      toast('Channel updated', 'success');
      onChannelUpdated ? onChannelUpdated() : onClose();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update channel', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/channels/${channel.id}`);
      navigate(`/channels/${serverId}`);
      onClose();
      onDeleted?.();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete channel', 'error');
    }
  }

  const Icon = channel.type === 'voice' ? Volume2 : Hash;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 flex z-50 animate-fade-in">
        <div className="m-auto flex w-full max-w-2xl max-h-[85vh] bg-nc-bg-primary rounded-lg shadow-2xl overflow-hidden animate-slide-up">
          {/* Sidebar */}
          <div className="w-48 bg-nc-bg-secondary p-3 flex flex-col flex-shrink-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-nc-text-muted px-3 py-2 flex items-center gap-2 mb-1">
              <Icon size={14} />
              <span className="truncate">{channel.name}</span>
            </div>
            {['Overview'].map(t => (
              <button key={t} className="w-full text-left px-3 py-2 rounded text-sm bg-nc-bg-modifier-active text-nc-interactive-active mb-0.5">
                {t}
              </button>
            ))}
            <div className="mt-auto">
              <div className="w-full h-px bg-nc-divider my-2" />
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-left px-3 py-2 rounded text-sm text-nc-red hover:bg-nc-red/10 flex items-center gap-2"
              >
                <Trash2 size={14} /> Delete Channel
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-nc-text-muted hover:text-nc-interactive-hover">
              <X size={20} />
            </button>

            {!confirmDelete ? (
              <div>
                <h2 className="text-xl font-bold text-nc-header-primary mb-6">Channel Overview</h2>
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="nc-label">Channel Name</label>
                    <div className="relative">
                      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nc-text-muted" />
                      <input
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        className="nc-input pl-8"
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {channel.type === 'text' && (
                    <div>
                      <label className="nc-label">Topic <span className="text-nc-text-muted font-normal normal-case">(shown in channel header)</span></label>
                      <input
                        value={form.topic}
                        onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                        className="nc-input"
                        placeholder="Optional channel topic..."
                        maxLength={1024}
                      />
                    </div>
                  )}

                  {channel.type === 'text' && (
                    <div>
                      <label className="nc-label">Slowmode</label>
                      <select
                        value={form.slowmode_delay}
                        onChange={e => setForm(p => ({ ...p, slowmode_delay: e.target.value }))}
                        className="nc-input"
                      >
                        <option value={0}>Off</option>
                        <option value={5}>5 seconds</option>
                        <option value={10}>10 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                        <option value={900}>15 minutes</option>
                        <option value={3600}>1 hour</option>
                      </select>
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={form.nsfw}
                      onChange={e => setForm(p => ({ ...p, nsfw: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="text-sm text-nc-text-normal">Age-Restricted Channel (NSFW)</div>
                      <div className="text-xs text-nc-text-muted">Users must confirm age before viewing</div>
                    </div>
                  </label>

                  <button onClick={handleSave} disabled={saving} className="nc-btn-primary">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle size={24} className="text-nc-red" />
                  <h2 className="text-xl font-bold text-nc-header-primary">Delete Channel</h2>
                </div>
                <p className="text-nc-text-muted mb-2">
                  Are you sure you want to delete <strong className="text-nc-header-primary">#{channel.name}</strong>?
                </p>
                <p className="text-nc-text-muted text-sm mb-6">This action is permanent and will delete all messages in this channel.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete(false)} className="nc-btn-secondary flex-1">Cancel</button>
                  <button onClick={handleDelete} className="flex-1 py-2 px-4 bg-nc-red text-white rounded text-sm font-medium hover:bg-red-600 transition-colors">
                    Delete Channel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
