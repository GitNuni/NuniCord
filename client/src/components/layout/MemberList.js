import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useUIStore } from '../../store/ui';
import Avatar from '../common/Avatar';
import UserProfileModal from '../common/UserProfileModal';

export default function MemberList({ serverId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { onlineUsers } = useUIStore();

  useEffect(() => {
    if (!serverId) return;
    setLoading(true);
    api.get(`/servers/${serverId}/members`)
      .then(r => {
        setMembers(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [serverId]);

  // Group by status
  const online = members.filter(m => {
    const s = onlineUsers[m.user_id] || m.status;
    return s === 'online' || s === 'idle' || s === 'dnd';
  });
  const offline = members.filter(m => {
    const s = onlineUsers[m.user_id] || m.status;
    return s === 'offline' || s === 'invisible' || !s;
  });

  return (
    <div className="w-60 min-w-60 bg-nc-bg-secondary overflow-y-auto py-4 flex-shrink-0">
      {loading ? (
        <div className="flex items-center justify-center h-20 text-nc-text-muted text-sm">
          Loading...
        </div>
      ) : (
        <>
          {online.length > 0 && (
            <MemberGroup title={`Online — ${online.length}`} members={online} onlineUsers={onlineUsers} />
          )}
          {offline.length > 0 && (
            <MemberGroup title={`Offline — ${offline.length}`} members={offline} onlineUsers={onlineUsers} muted />
          )}
        </>
      )}
    </div>
  );
}

function MemberGroup({ title, members, onlineUsers, muted = false }) {
  const [profileUser, setProfileUser] = useState(null);
  const [profileAnchor, setProfileAnchor] = useState(null);

  return (
    <div className="mb-4">
      <div className="px-4 mb-1 text-xs font-semibold uppercase tracking-wide text-nc-interactive-muted">
        {title}
      </div>
      {members.map(member => {
        const status = onlineUsers[member.user_id] || member.status || 'offline';
        const displayName = member.nickname || member.display_name || member.username;
        const userObj = { id: member.user_id, username: member.username, display_name: member.display_name, avatar_url: member.avatar_url, status, custom_status: member.custom_status, bio: member.bio, pronouns: member.pronouns };

        return (
          <div
            key={member.id}
            className={`flex items-center gap-3 px-2 mx-2 py-1 rounded cursor-pointer hover:bg-nc-bg-modifier-hover group ${muted ? 'opacity-50' : ''}`}
            onClick={e => { setProfileUser(userObj); setProfileAnchor(e.currentTarget); }}
          >
            <div className="relative flex-shrink-0">
              <Avatar user={userObj} size={32} />
              <span className={`status-indicator absolute -bottom-0.5 -right-0.5 status-${status}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-nc-interactive-normal group-hover:text-nc-interactive-hover truncate">
                {displayName}
              </div>
              {member.custom_status && (
                <div className="text-xs text-nc-text-muted truncate">{member.custom_status}</div>
              )}
              {member.roles?.length > 0 && member.roles[0]?.color && (
                <div className="text-xs truncate" style={{ color: member.roles[0].color }}>
                  {member.roles[0].name}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          anchorEl={profileAnchor}
          onClose={() => { setProfileUser(null); setProfileAnchor(null); }}
        />
      )}
    </div>
  );
}
