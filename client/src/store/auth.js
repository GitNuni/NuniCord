import { create } from 'zustand';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, token, isLoading: false });
      connectSocket(token);
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },

  login: async (login, password) => {
    const { data } = await api.post('/auth/login', { login, password });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    connectSocket(data.token);
    return data;
  },

  register: async (username, email, password, display_name) => {
    const { data } = await api.post('/auth/register', { username, email, password, display_name });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    connectSocket(data.token);
    return data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('token');
    disconnectSocket();
    set({ user: null, token: null });
  },

  updateUser: (updates) => {
    set(state => ({ user: { ...state.user, ...updates } }));
  },
}));
