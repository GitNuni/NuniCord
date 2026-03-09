import React, { useState } from 'react';
import { X, Copy, Check, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useServerStore } from '../../store/servers';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../store/ui';

export default function ServerSettingsModal({ serverId, serverData, onClose }) {
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ name: serverData?.name || '', description: serverData?.description || '' });
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState([]);
  const [copied, setCopied] = useState(null);
  const { updateServer, removeServer } = useServerStore();
  const navigate = useNavigate();

  async function loadInvites() {
    try {
      const { data } = await api.get(`/servers/${serverId}/invites`);
      setInvites(data);
    } catch {}
  }

  async function createInvite() {
    try {
      const { data } = await api.post(`/servers/${serverId}/invites`, { max_uses: 0 });
      setInvites(prev => [data, ...prev]);
      toast('Invite created', 'success');
    } catch {
      toast('Failed to create invite', 'error');
    }
  }

  async function save() {
    setLoading(true);
    try {
      const { data } = await api.patch(`/servers/${serverId}`, form);
      updateServer(serverId, data);
      toast('Server updated', 'success');
    } catch {
      toast('Failed to update server', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteServer() {
    if (!window.confirm(`Are you sure you want to delete "${serverData?.name}"? This is permanent.`)) return;
    try {
      await api.delete(`/servers/${serverId}`);
      removeServer(serverId);
      navigate('/');
      onClose();
    } catch {
      toast('Failed to delete server', 'error');
    }
  }

  function copyInvite(code) {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'invites', label: 'Invites' },
    { id: 'roles', label: 'Roles' },
    { id: 'danger', label: 'Danger Zone' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex z-50 animate-fade-in">
      <div className="m-auto flex w-full max-w-3xl h-[80vh] bg-nc-bg-primary rounded-lg shadow-2xl overflow-hidden animate-slide-up">
        {/* Sidebar */}
        <div className="w-48 bg-nc-bg-secondary p-2 flex flex-col">
          <div className="px-3 py-2 text-xs font-semibold uppercase text-nc-text-muted tracking-wide mb-2">
            {serverData?.name}
          </div>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === 'invites') loadInvites(); }}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                tab === t.id
                  ? 'bg-nc-bg-modifier-active text-nc-interactive-active'
                  : 'text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover'
              } ${t.id === 'danger' ? 'text-nc-red hover:text-red-400 mt-auto' : ''}`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-2 mt-2 text-sm text-nc-interactive-normal hover:text-nc-interactive-hover"
          >
            <X size={14} /> Esc
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {tab === 'overview' && (
            <div>
              <h2 className="text-xl font-bold text-nc-header-primary mb-6">Server Overview</h2>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="nc-label">Server Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="nc-input"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="nc-label">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="nc-input resize-none"
                    rows={3}
                    maxLength={512}
                    placeholder="Tell people what this server is about..."
                  />
                </div>
                <button onClick={save} disabled={loading} className="nc-btn-primary">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {tab === 'invites' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-nc-header-primary">Invites</h2>
                <button onClick={createInvite} className="nc-btn-primary text-sm">
                  Create Invite
                </button>
              </div>
              <div className="space-y-2">
                {invites.map(invite => (
                  <div key={invite.id} className="flex items-center gap-3 p-3 bg-nc-bg-secondary rounded">
                    <code className="flex-1 text-sm text-nc-brand font-mono">
                      {window.location.origin}/invite/{invite.code}
                    </code>
                    <span className="text-xs text-nc-text-muted">
                      {invite.uses}/{invite.max_uses || '∞'} uses
                    </span>
                    <button
                      onClick={() => copyInvite(invite.code)}
                      className="text-nc-interactive-normal hover:text-nc-interactive-hover"
                    >
                      {copied === invite.code ? <Check size={16} className="text-nc-green" /> : <Copy size={16} />}
                    </button>
                  </div>
                ))}
                {invites.length === 0 && (
                  <p className="text-nc-text-muted text-sm">No invites yet. Create one to share your server!</p>
                )}
              </div>
            </div>
          )}

          {tab === 'danger' && (
            <div>
              <h2 className="text-xl font-bold text-nc-red mb-6">Danger Zone</h2>
              <div className="p-4 border border-nc-red/30 rounded-lg bg-nc-red/5">
                <h3 className="font-semibold text-nc-text-normal mb-2">Delete Server</h3>
                <p className="text-sm text-nc-text-muted mb-4">
                  Once you delete a server, there is no going back. All channels, messages, and members will be permanently removed.
                </p>
                <button onClick={deleteServer} className="nc-btn-danger flex items-center gap-2">
                  <Trash2 size={16} />
                  Delete Server
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
