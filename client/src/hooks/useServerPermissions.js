import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/auth';

// Use number flags (JS numbers support up to 2^53)
const ADMINISTRATOR = 8;   // 1 << 3
const MANAGE_CHANNELS = 16; // 1 << 4
const MANAGE_GUILD = 32;    // 1 << 5
const MANAGE_ROLES = 268435456; // 1 << 28

function has(perms, flag) {
  if (perms & ADMINISTRATOR) return true;
  return !!(perms & flag);
}

// Cache: serverId -> permissions number
const cache = {};

export function useServerPermissions(serverId, serverData) {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState(0);

  const isOwner = serverData?.owner_id === user?.id || serverData?.owner?.id === user?.id;

  useEffect(() => {
    if (!serverId || !user) return;

    if (isOwner) {
      setPermissions(0xFFFFFF);
      return;
    }

    if (cache[serverId] !== undefined) {
      setPermissions(cache[serverId]);
      return;
    }

    api.get(`/servers/${serverId}/my-permissions`)
      .then(r => {
        // Server returns BigInt as string; parse lower 32 bits (covers all common flags)
        const p = Number(r.data.permissions) || 0;
        cache[serverId] = p;
        setPermissions(p);
      })
      .catch(() => {});
  }, [serverId, user, isOwner]);

  return {
    isOwner,
    canManageChannels: isOwner || has(permissions, MANAGE_CHANNELS),
    canManageGuild: isOwner || has(permissions, MANAGE_GUILD),
    canManageRoles: isOwner || has(permissions, MANAGE_ROLES),
    isAdmin: isOwner || has(permissions, ADMINISTRATOR),
  };
}
