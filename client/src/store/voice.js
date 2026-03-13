import { create } from 'zustand';
import { produce } from 'immer';

export const useVoiceStore = create((set, get) => ({
  activeChannelId: null,
  activeServerId: null,
  peers: {}, // userId -> { stream, isMuted, isDeafened, isVideo, isScreenShare, isSpeaking }
  localStream: null,
  screenStream: null,
  isMuted: false,
  isDeafened: false,
  isVideo: false,
  isScreenSharing: false,
  localSpeaking: false,
  peerConnections: {}, // userId -> RTCPeerConnection

  setActiveVoice: (channelId, serverId) => {
    set({ activeChannelId: channelId, activeServerId: serverId });
  },

  clearVoice: () => {
    const { localStream, screenStream, peerConnections } = get();
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    Object.values(peerConnections).forEach(pc => pc.close());
    set({
      activeChannelId: null,
      activeServerId: null,
      peers: {},
      localStream: null,
      screenStream: null,
      isMuted: false,
      isDeafened: false,
      isVideo: false,
      isScreenSharing: false,
      localSpeaking: false,
      peerConnections: {},
    });
  },

  setLocalStream: (stream) => set({ localStream: stream }),
  setScreenStream: (stream) => set({ screenStream: stream, isScreenSharing: !!stream }),

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = isMuted);
    }
    set({ isMuted: !isMuted });
    return !isMuted;
  },

  toggleDeafen: () => {
    const next = !get().isDeafened;
    set({ isDeafened: next });
    return next;
  },

  toggleVideo: async () => {
    const { isVideo, localStream, peerConnections } = get();
    if (isVideo) {
      localStream?.getVideoTracks().forEach(t => { t.stop(); t.enabled = false; });
      set({ isVideo: false });
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        // Add to existing peer connections
        Object.values(peerConnections).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream);
          }
        });
        set({ isVideo: true });
        return videoTrack;
      } catch (err) {
        console.error('Camera error:', err);
      }
    }
  },

  addPeer: (userId, data) => {
    set(produce(state => {
      state.peers[userId] = { ...state.peers[userId], ...data };
    }));
  },

  updatePeer: (userId, updates) => {
    set(produce(state => {
      if (state.peers[userId]) {
        Object.assign(state.peers[userId], updates);
      }
    }));
  },

  removePeer: (userId) => {
    set(produce(state => {
      const pc = state.peerConnections[userId];
      if (pc) pc.close();
      delete state.peers[userId];
      delete state.peerConnections[userId];
    }));
  },

  addPeerConnection: (userId, pc) => {
    set(produce(state => {
      state.peerConnections[userId] = pc;
    }));
  },

  setSpeaking: (userId, isSpeaking) => {
    set(produce(state => {
      if (state.peers[userId]) {
        state.peers[userId].isSpeaking = isSpeaking;
      }
    }));
  },

  // Server-wide voice channel membership (for sidebar display and VoiceBar)
  voiceChannels: {}, // { channelId: [{ user_id, username, avatar_url, self_mute, self_deaf, self_stream }] }

  setVoiceChannels: (data) => set({ voiceChannels: data }),

  updateVoiceChannelMember: (channelId, userId, memberData) => {
    set(produce(state => {
      if (!state.voiceChannels[channelId]) state.voiceChannels[channelId] = [];
      const idx = state.voiceChannels[channelId].findIndex(m => m.user_id === userId);
      if (idx >= 0) {
        Object.assign(state.voiceChannels[channelId][idx], memberData);
      } else {
        state.voiceChannels[channelId].push({ user_id: userId, ...memberData });
      }
    }));
  },

  removeVoiceChannelMember: (userId) => {
    set(produce(state => {
      for (const channelId of Object.keys(state.voiceChannels)) {
        state.voiceChannels[channelId] = state.voiceChannels[channelId].filter(m => m.user_id !== userId);
        if (state.voiceChannels[channelId].length === 0) {
          delete state.voiceChannels[channelId];
        }
      }
    }));
  },
}));
