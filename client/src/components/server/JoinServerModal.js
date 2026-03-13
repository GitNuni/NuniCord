import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useServerStore } from '../../store/servers';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../store/ui';
import Portal from '../common/Portal';

export default function JoinServerModal({ onClose }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchServers } = useServerStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const inviteCode = code.trim().split('/').pop();
    setLoading(true);
    try {
      const { data } = await api.post(`/servers/join/${inviteCode}`);
      await fetchServers();
      navigate(`/channels/${data.server_id}`);
      onClose();
    } catch (err) {
      toast(err.response?.data?.error || 'Invalid invite', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-nc-bg-primary rounded-lg shadow-2xl w-full max-w-md p-6 relative animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-nc-text-muted hover:text-nc-interactive-hover">
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-nc-header-primary text-center mb-2">Join a Server</h2>
        <p className="text-nc-text-muted text-center text-sm mb-6">
          Enter an invite link below to join an existing server.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="nc-label">Invite Link or Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              className="nc-input"
              placeholder="https://nunicord.app/invite/XXXXXXXX or XXXXXXXX"
              required
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="nc-btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !code.trim()} className="nc-btn-primary flex-1">
              {loading ? 'Joining...' : 'Join Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
