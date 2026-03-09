import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, UserPlus, Users } from 'lucide-react';
import api from '../../services/api';
import Avatar from '../common/Avatar';
import { useUIStore } from '../../store/ui';
import UserPanel from '../layout/UserPanel';

export default function DMList() {
  const [dms, setDMs] = useState([]);
  const { channelId } = useParams();
  const navigate = useNavigate();
  const { onlineUsers } = useUIStore();

  useEffect(() => {
    api.get('/channels/dms/list').then(r => setDMs(r.data)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col w-60 min-w-60 bg-nc-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-black/30 shadow-sm">
        <input
          placeholder="Find or start a conversation"
          className="flex-1 bg-nc-bg-tertiary text-nc-text-normal text-sm px-2 py-1 rounded outline-none placeholder-nc-text-muted"
        />
      </div>

      {/* DM list */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2">
          <button className="channel-item w-full text-left">
            <Users size={18} className="text-nc-channel-icon" />
            <span className="text-sm">Friends</span>
          </button>
        </div>

        <div className="mt-4">
          <div className="px-4 mb-2 text-xs font-semibold uppercase tracking-wide text-nc-interactive-muted flex items-center justify-between">
            <span>Direct Messages</span>
            <button title="New DM">
              <UserPlus size={14} className="hover:text-nc-interactive-hover" />
            </button>
          </div>

          {dms.map(dm => {
            const otherUsers = (dm.participants || []).filter(p => p.id !== dm.current_user_id);
            const displayUser = otherUsers[0];
            if (!displayUser) return null;
            const status = onlineUsers[displayUser.id] || displayUser.status || 'offline';

            return (
              <div
                key={dm.id}
                onClick={() => navigate(`/channels/@me/${dm.id}`)}
                className={`channel-item ${channelId === dm.id ? 'active' : ''} group`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar user={displayUser} size={32} />
                  <span className={`status-indicator absolute -bottom-0.5 -right-0.5 status-${status}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {displayUser.display_name || displayUser.username}
                  </div>
                  <div className="text-xs text-nc-text-muted truncate capitalize">{status}</div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 text-nc-text-muted hover:text-nc-interactive-hover">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <UserPanel />
    </div>
  );
}
