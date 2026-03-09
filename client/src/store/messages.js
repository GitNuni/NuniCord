import { create } from 'zustand';
import { produce } from 'immer';
import api from '../services/api';

export const useMessageStore = create((set, get) => ({
  channels: {}, // channelId -> { messages: [], loading: bool, hasMore: bool }
  typingUsers: {}, // channelId -> { userId: { username, timestamp } }

  getChannel: (channelId) => {
    return get().channels[channelId] || { messages: [], loading: false, hasMore: true };
  },

  fetchMessages: async (channelId, before = null) => {
    set(produce(state => {
      if (!state.channels[channelId]) {
        state.channels[channelId] = { messages: [], loading: true, hasMore: true };
      } else {
        state.channels[channelId].loading = true;
      }
    }));

    try {
      const params = { limit: 50 };
      if (before) params.before = before;

      const { data } = await api.get(`/channels/${channelId}/messages`, { params });

      set(produce(state => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = { messages: [], loading: false, hasMore: true };
        }
        const ch = state.channels[channelId];

        if (before) {
          // Prepend older messages
          const existingIds = new Set(ch.messages.map(m => m.id));
          const newMessages = data.filter(m => !existingIds.has(m.id));
          ch.messages = [...newMessages, ...ch.messages];
          ch.hasMore = data.length === 50;
        } else {
          ch.messages = data;
          ch.hasMore = data.length === 50;
        }
        ch.loading = false;
      }));
    } catch {
      set(produce(state => {
        if (state.channels[channelId]) {
          state.channels[channelId].loading = false;
        }
      }));
    }
  },

  addMessage: (channelId, message) => {
    set(produce(state => {
      if (!state.channels[channelId]) {
        state.channels[channelId] = { messages: [], loading: false, hasMore: true };
      }
      const msgs = state.channels[channelId].messages;
      // Avoid duplicates
      if (!msgs.find(m => m.id === message.id)) {
        msgs.push(message);
      }
    }));
  },

  updateMessage: (channelId, messageId, updates) => {
    set(produce(state => {
      if (!state.channels[channelId]) return;
      const msg = state.channels[channelId].messages.find(m => m.id === messageId);
      if (msg) Object.assign(msg, updates);
    }));
  },

  deleteMessage: (channelId, messageId) => {
    set(produce(state => {
      if (!state.channels[channelId]) return;
      state.channels[channelId].messages = state.channels[channelId].messages.filter(
        m => m.id !== messageId
      );
    }));
  },

  updateReaction: (channelId, messageId, emoji, userId, add) => {
    set(produce(state => {
      if (!state.channels[channelId]) return;
      const msg = state.channels[channelId].messages.find(m => m.id === messageId);
      if (!msg) return;

      if (!msg.reaction_counts) msg.reaction_counts = [];
      const reaction = msg.reaction_counts.find(r => r.emoji === emoji);

      if (add) {
        if (reaction) {
          reaction.count++;
          if (userId === msg.author?.id) reaction.me = true;
        } else {
          msg.reaction_counts.push({ emoji, count: 1, me: false });
        }
      } else {
        if (reaction) {
          reaction.count--;
          if (userId === msg.author?.id) reaction.me = false;
          if (reaction.count <= 0) {
            msg.reaction_counts = msg.reaction_counts.filter(r => r.emoji !== emoji);
          }
        }
      }
    }));
  },

  setTyping: (channelId, userId, username) => {
    set(produce(state => {
      if (!state.typingUsers[channelId]) state.typingUsers[channelId] = {};
      state.typingUsers[channelId][userId] = { username, timestamp: Date.now() };
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      set(produce(state => {
        if (state.typingUsers[channelId]?.[userId]) {
          const entry = state.typingUsers[channelId][userId];
          if (Date.now() - entry.timestamp >= 4500) {
            delete state.typingUsers[channelId][userId];
          }
        }
      }));
    }, 5000);
  },

  clearTyping: (channelId, userId) => {
    set(produce(state => {
      if (state.typingUsers[channelId]) {
        delete state.typingUsers[channelId][userId];
      }
    }));
  },

  clearChannel: (channelId) => {
    set(produce(state => {
      delete state.channels[channelId];
    }));
  },
}));
