import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useServerStore } from '../store/servers';
import { getSocket } from '../services/socket';

export default function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { fetchServers } = useServerStore();
  const [status, setStatus] = useState('joining');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) { setStatus('error'); setError('No invite code provided.'); return; }

    api.post(`/servers/join/${code}`)
      .then(async ({ data }) => {
        const serverId = data.server_id;
        const socket = getSocket();
        if (socket && !data.already_member) socket.emit('SERVER_JOIN', { server_id: serverId });
        await fetchServers();
        navigate(`/channels/${serverId}`, { replace: true });
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Invalid or expired invite link.';
        const alreadyServerId = err.response?.data?.server_id;
        if (alreadyServerId) {
          fetchServers().then(() => navigate(`/channels/${alreadyServerId}`, { replace: true }));
        } else {
          setStatus('error');
          setError(msg);
        }
      });
  }, [code]);

  if (status === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-nc-bg-primary min-h-screen">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-nc-bg-secondary flex items-center justify-center mx-auto mb-4 text-3xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-nc-header-primary mb-2">Invite Invalid</h2>
          <p className="text-nc-text-muted text-sm mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="nc-btn-primary px-8 py-2.5">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-nc-bg-primary min-h-screen">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-nc-brand border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-nc-text-muted text-sm">Joining server…</p>
      </div>
    </div>
  );
}
