import { create } from 'zustand';
import { produce } from 'immer';

export const useUIStore = create((set, get) => ({
  sidebarOpen: true,
  memberListOpen: true,
  activeModal: null,
  modalData: null,
  toasts: [],
  readStates: {}, // channelId -> { lastReadId, mentionCount }
  onlineUsers: {}, // userId -> status
  presenceMap: {}, // serverId -> { userId -> status }

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setMemberListOpen: (open) => set({ memberListOpen: open }),
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  toggleMemberList: () => set(state => ({ memberListOpen: !state.memberListOpen })),

  openModal: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  addToast: (toast) => {
    const id = Date.now().toString();
    set(produce(state => {
      state.toasts.push({ id, ...toast });
    }));
    setTimeout(() => get().removeToast(id), toast.duration || 4000);
    return id;
  },

  removeToast: (id) => {
    set(produce(state => {
      state.toasts = state.toasts.filter(t => t.id !== id);
    }));
  },

  updateReadState: (channelId, lastReadId, mentionCount = 0) => {
    set(produce(state => {
      state.readStates[channelId] = { lastReadId, mentionCount };
    }));
  },

  updatePresence: (userId, status, serverId) => {
    set(produce(state => {
      state.onlineUsers[userId] = status;
      if (serverId) {
        if (!state.presenceMap[serverId]) state.presenceMap[serverId] = {};
        state.presenceMap[serverId][userId] = status;
      }
    }));
  },

  getUserStatus: (userId) => {
    return get().onlineUsers[userId] || 'offline';
  },
}));

// Toast helper
export function toast(message, type = 'info', duration = 4000) {
  useUIStore.getState().addToast({ message, type, duration });
}
