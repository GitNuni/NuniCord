import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useServerStore } from '../../store/servers';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../store/ui';

export default function CreateServerModal({ onClose }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { addServer } = useServerStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/servers', { name: name.trim() });
      addServer(data);
      navigate(`/channels/${data.id}`);
      onClose();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to create server', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-nc-bg-primary rounded-lg shadow-2xl w-full max-w-md p-6 relative animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-nc-text-muted hover:text-nc-interactive-hover">
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-nc-header-primary text-center mb-2">Customize Your Server</h2>
        <p className="text-nc-text-muted text-center text-sm mb-6">
          Give your new server a personality with a name and an icon.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="nc-label">Server Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="nc-input"
              placeholder="My Awesome Server"
              required
              maxLength={100}
              autoFocus
            />
          </div>

          <p className="text-xs text-nc-text-muted">
            By creating a server, you agree to our Community Guidelines.
          </p>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="nc-btn-secondary flex-1">
              Back
            </button>
            <button type="submit" disabled={loading || !name.trim()} className="nc-btn-primary flex-1">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
