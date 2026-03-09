import { create } from 'zustand';
import { produce } from 'immer';
import api from '../services/api';

export const useServerStore = create((set, get) => ({
  servers: [],
  activeServerId: null,
  activeChannelId: null,
  loading: false,

  fetchServers: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/servers');
      set({ servers: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveServer: (serverId) => {
    set({ activeServerId: serverId, activeChannelId: null });
  },

  setActiveChannel: (channelId) => {
    set({ activeChannelId: channelId });
  },

  addServer: (server) => {
    set(produce(state => {
      state.servers.push(server);
    }));
  },

  updateServer: (serverId, updates) => {
    set(produce(state => {
      const idx = state.servers.findIndex(s => s.id === serverId);
      if (idx !== -1) Object.assign(state.servers[idx], updates);
    }));
  },

  removeServer: (serverId) => {
    set(produce(state => {
      state.servers = state.servers.filter(s => s.id !== serverId);
      if (state.activeServerId === serverId) {
        state.activeServerId = null;
        state.activeChannelId = null;
      }
    }));
  },

  getActiveServer: () => {
    const { servers, activeServerId } = get();
    return servers.find(s => s.id === activeServerId) || null;
  },
}));
