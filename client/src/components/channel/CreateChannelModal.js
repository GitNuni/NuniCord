import React, { useState } from 'react';
import { X, Hash, Volume2, BookOpen } from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../store/ui';
import { useNavigate } from 'react-router-dom';

const channelTypes = [
  { type: 'text', icon: Hash, label: 'Text', description: 'Send messages, images, GIFs, emoji, and more' },
  { type: 'voice', icon: Volume2, label: 'Voice', description: 'Hang out together with voice, video, and screen share' },
  { type: 'forum', icon: BookOpen, label: 'Forum', description: 'Create organized threads for discussions' },
];

export default function CreateChannelModal({ serverId, categoryId, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/channels', {
        server_id: serverId,
        category_id: categoryId !== 'uncategorized' ? categoryId : undefined,
        name: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        type,
      });
      navigate(`/channels/${serverId}/channels/${data.id}`);
      onClose();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to create channel', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-nc-bg-primary rounded-lg shadow-2xl w-full max-w-md p-6 relative animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-nc-text-muted hover:text-nc-interactive-hover">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-nc-header-primary mb-1">Create Channel</h2>
        <p className="text-nc-text-muted text-sm mb-4">in <span className="uppercase font-semibold">General</span></p>

        {/* Channel type */}
        <div className="mb-4">
          <label className="nc-label">Channel Type</label>
          <div className="space-y-2">
            {channelTypes.map(ct => (
              <label
                key={ct.type}
                className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${
                  type === ct.type ? 'bg-nc-bg-modifier-selected' : 'hover:bg-nc-bg-modifier-hover'
                }`}
              >
                <input
                  type="radio"
                  name="channel_type"
                  value={ct.type}
                  checked={type === ct.type}
                  onChange={() => setType(ct.type)}
                  className="hidden"
                />
                <ct.icon size={20} className="text-nc-channel-icon flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-nc-text-normal">{ct.label}</div>
                  <div className="text-xs text-nc-text-muted">{ct.description}</div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  type === ct.type ? 'border-nc-brand' : 'border-nc-interactive-muted'
                }`}>
                  {type === ct.type && <div className="w-2 h-2 rounded-full bg-nc-brand" />}
                </div>
              </label>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="nc-label">Channel Name</label>
            <div className="relative">
              <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nc-text-muted" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="nc-input pl-8"
                placeholder="new-channel"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="nc-btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()} className="nc-btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
