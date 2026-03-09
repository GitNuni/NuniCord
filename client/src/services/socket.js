import { io } from 'socket.io-client';
import { useMessageStore } from '../store/messages';
import { useUIStore } from '../store/ui';
import { useVoiceStore } from '../store/voice';
import { useServerStore } from '../store/servers';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected) return socket;

  const url = process.env.REACT_APP_WS_URL || window.location.origin;

  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  // Message events
  socket.on('MESSAGE_CREATE', (message) => {
    useMessageStore.getState().addMessage(message.channel_id, message);
  });

  socket.on('MESSAGE_UPDATE', (message) => {
    useMessageStore.getState().updateMessage(message.channel_id, message.id, message);
  });

  socket.on('MESSAGE_DELETE', ({ id, channel_id }) => {
    useMessageStore.getState().deleteMessage(channel_id, id);
  });

  socket.on('REACTION_ADD', ({ message_id, channel_id, emoji, user_id }) => {
    useMessageStore.getState().updateReaction(channel_id, message_id, emoji, user_id, true);
  });

  socket.on('REACTION_REMOVE', ({ message_id, channel_id, emoji, user_id }) => {
    useMessageStore.getState().updateReaction(channel_id, message_id, emoji, user_id, false);
  });

  socket.on('TYPING_START', ({ channel_id, user_id, username }) => {
    useMessageStore.getState().setTyping(channel_id, user_id, username);
  });

  socket.on('TYPING_STOP', ({ channel_id, user_id }) => {
    useMessageStore.getState().clearTyping(channel_id, user_id);
  });

  // Presence
  socket.on('PRESENCE_UPDATE', ({ user_id, status, server_id }) => {
    useUIStore.getState().updatePresence(user_id, status, server_id);
  });

  // Voice events
  socket.on('VOICE_STATE_UPDATE', (state) => {
    const voiceStore = useVoiceStore.getState();
    if (!state.channel_id) {
      voiceStore.removePeer(state.user_id);
    } else {
      voiceStore.addPeer(state.user_id, {
        channelId: state.channel_id,
        isMuted: state.self_mute,
        isDeafened: state.self_deaf,
        isVideo: state.self_video,
        isScreenSharing: state.self_stream,
      });
    }
  });

  socket.on('VOICE_MEMBERS', ({ channel_id, members }) => {
    const voiceStore = useVoiceStore.getState();
    members.forEach(member => {
      voiceStore.addPeer(member.user_id, {
        channelId: channel_id,
        username: member.display_name || member.username,
        avatar: member.avatar_url,
        isMuted: member.self_mute,
        isDeafened: member.self_deaf,
      });
    });
  });

  // WebRTC signaling
  socket.on('RTC_OFFER', handleRTCOffer);
  socket.on('RTC_ANSWER', handleRTCAnswer);
  socket.on('RTC_ICE_CANDIDATE', handleRTCIceCandidate);

  socket.on('SCREEN_SHARE_START', ({ user_id }) => {
    useVoiceStore.getState().updatePeer(user_id, { isScreenSharing: true });
  });

  socket.on('SCREEN_SHARE_STOP', ({ user_id }) => {
    useVoiceStore.getState().updatePeer(user_id, { isScreenSharing: false });
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function sendMessage(channelId, content, replyToId = null, attachments = []) {
  socket?.emit('MESSAGE_CREATE', {
    channel_id: channelId,
    content,
    reply_to_id: replyToId,
    attachments,
    nonce: Date.now().toString(),
  });
}

export function startTyping(channelId) {
  socket?.emit('TYPING_START', { channel_id: channelId });
}

export function stopTyping(channelId) {
  socket?.emit('TYPING_STOP', { channel_id: channelId });
}

export function joinVoiceChannel(channelId, serverId) {
  socket?.emit('VOICE_JOIN', { channel_id: channelId, server_id: serverId });
}

export function leaveVoiceChannel(channelId, serverId) {
  socket?.emit('VOICE_LEAVE', { channel_id: channelId, server_id: serverId });
}

export function updateVoiceState(state) {
  socket?.emit('VOICE_STATE_UPDATE', state);
}

export function updateStatus(status, customStatus) {
  socket?.emit('STATUS_UPDATE', { status, custom_status: customStatus });
}

// WebRTC helpers
const RTCConfig = {
  iceServers: [
    { urls: `stun:${process.env.REACT_APP_TURN_HOST || window.location.hostname}:3478` },
    {
      urls: `turn:${process.env.REACT_APP_TURN_HOST || window.location.hostname}:3478`,
      username: process.env.REACT_APP_TURN_USER || 'nunicord',
      credential: process.env.REACT_APP_TURN_PASS || 'nunicord',
    },
  ],
};

async function handleRTCOffer({ from_user_id, offer, channel_id }) {
  try {
    const voiceStore = useVoiceStore.getState();
    const localStream = voiceStore.localStream;

    const pc = new RTCPeerConnection(RTCConfig);
    voiceStore.addPeerConnection(from_user_id, pc);
    setupPeerConnectionHandlers(pc, from_user_id, channel_id);

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket?.emit('RTC_ANSWER', {
      target_user_id: from_user_id,
      answer: pc.localDescription,
      channel_id,
    });
  } catch (err) {
    console.error('Handle RTC offer error:', err);
  }
}

async function handleRTCAnswer({ from_user_id, answer }) {
  try {
    const pc = useVoiceStore.getState().peerConnections[from_user_id];
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  } catch (err) {
    console.error('Handle RTC answer error:', err);
  }
}

async function handleRTCIceCandidate({ from_user_id, candidate }) {
  try {
    const pc = useVoiceStore.getState().peerConnections[from_user_id];
    if (pc && candidate) {
      await pc.addIceCandidate(candidate);
    }
  } catch (err) {
    console.error('Handle ICE candidate error:', err);
  }
}

function setupPeerConnectionHandlers(pc, userId, channelId) {
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket?.emit('RTC_ICE_CANDIDATE', {
        target_user_id: userId,
        candidate,
        channel_id: channelId,
      });
    }
  };

  pc.ontrack = ({ streams }) => {
    if (streams[0]) {
      useVoiceStore.getState().addPeer(userId, { stream: streams[0] });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      useVoiceStore.getState().removePeer(userId);
    }
  };
}

export async function createVoicePeerConnection(targetUserId, localStream, channelId) {
  const pc = new RTCPeerConnection(RTCConfig);
  useVoiceStore.getState().addPeerConnection(targetUserId, pc);
  setupPeerConnectionHandlers(pc, targetUserId, channelId);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket?.emit('RTC_OFFER', {
    target_user_id: targetUserId,
    offer: pc.localDescription,
    channel_id: channelId,
  });

  return pc;
}
