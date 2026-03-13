import { io } from 'socket.io-client';
import { useMessageStore } from '../store/messages';
import { useUIStore } from '../store/ui';
import { useVoiceStore } from '../store/voice';
import { useServerStore } from '../store/servers';
import { playSound } from './sounds';

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
    const activeChannelId = useServerStore.getState().activeChannelId;
    if (message.channel_id !== activeChannelId) {
      useUIStore.getState().markUnread(message.channel_id);
    }
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
    const { useAuthStore } = require('../store/auth');
    const currentUser = useAuthStore.getState().user;
    const voiceStore = useVoiceStore.getState();

    // Update server-wide voice channel tracking (everyone, including self)
    if (!state.channel_id) {
      voiceStore.removeVoiceChannelMember(state.user_id);
    } else {
      voiceStore.updateVoiceChannelMember(state.channel_id, state.user_id, {
        username: state.display_name || state.username,
        avatar_url: state.avatar_url,
        self_mute: state.self_mute,
        self_deaf: state.self_deaf,
        self_stream: state.self_stream,
      });
    }

    // Skip WebRTC peer management for self
    if (state.user_id === currentUser?.id) return;

    if (!state.channel_id) {
      voiceStore.removePeer(state.user_id);
    } else {
      voiceStore.addPeer(state.user_id, {
        channelId: state.channel_id,
        // Only update name/avatar if present — don't overwrite with undefined on mute/deafen events
        ...(state.username != null && { username: state.username }),
        ...(state.avatar_url != null && { avatar: state.avatar_url }),
        isMuted: state.self_mute,
        isDeafened: state.self_deaf,
        isVideo: state.self_video,
        isScreenSharing: state.self_stream,
      });
      // Do NOT initiate here — the new joiner initiates via VOICE_MEMBERS.
      // This prevents the WebRTC "glare" condition where both peers send offers simultaneously.
    }
  });

  socket.on('VOICE_MEMBERS', ({ channel_id, members }) => {
    const { useAuthStore } = require('../store/auth');
    const currentUser = useAuthStore.getState().user;
    const voiceStore = useVoiceStore.getState();
    const others = members.filter(m => m.user_id !== currentUser?.id);

    // Update server-wide voiceChannels for sidebar display
    members.forEach(member => {
      voiceStore.updateVoiceChannelMember(channel_id, member.user_id, {
        username: member.display_name || member.username,
        avatar_url: member.avatar_url,
        self_mute: member.self_mute,
        self_deaf: member.self_deaf,
      });
    });

    others.forEach(member => {
      voiceStore.addPeer(member.user_id, {
        channelId: channel_id,
        username: member.display_name || member.username,
        avatar: member.avatar_url,
        isMuted: member.self_mute,
        isDeafened: member.self_deaf,
      });
    });
    // Initiate RTC connections to all existing members
    if (voiceStore.localStream) {
      others.forEach(member => {
        createVoicePeerConnection(member.user_id, voiceStore.localStream, channel_id);
      });
    }
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

  socket.on('SPEAKING', ({ user_id, is_speaking }) => {
    useVoiceStore.getState().setSpeaking(user_id, is_speaking);
  });

  socket.on('SOUNDBOARD_PLAY', ({ sound_id }) => {
    playSound(sound_id);
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
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
if (process.env.REACT_APP_TURN_HOST) {
  const turnHost = process.env.REACT_APP_TURN_HOST;
  iceServers.push({ urls: `stun:${turnHost}:3478` });
  iceServers.push({
    urls: `turn:${turnHost}:3478`,
    username: process.env.REACT_APP_TURN_USER || 'nunicord',
    credential: process.env.REACT_APP_TURN_PASS || 'nunicord',
  });
}
const RTCConfig = { iceServers };

async function handleRTCOffer({ from_user_id, offer, channel_id }) {
  try {
    const voiceStore = useVoiceStore.getState();
    const localStream = voiceStore.localStream;

    // Reuse existing peer connection for re-negotiation (e.g., screen share added)
    let pc = voiceStore.peerConnections[from_user_id];
    const isNew = !pc || pc.connectionState === 'closed' || pc.connectionState === 'failed';

    if (isNew) {
      pc = new RTCPeerConnection(RTCConfig);
      voiceStore.addPeerConnection(from_user_id, pc);
      setupPeerConnectionHandlers(pc, from_user_id, channel_id);
      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }
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

// Audio level analyser — returns a cleanup function
function watchAudioLevel(stream, onSpeaking) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false;
    const interval = setInterval(() => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const isSpeaking = avg > 8;
      if (isSpeaking !== speaking) {
        speaking = isSpeaking;
        onSpeaking(isSpeaking);
      }
    }, 80);
    return () => { clearInterval(interval); ctx.close(); };
  } catch {
    return () => {};
  }
}

// Call this after getting localStream to show self-speaking indicator
let localSpeakingCleanup = null;
export function watchLocalSpeaking(stream) {
  if (localSpeakingCleanup) localSpeakingCleanup();
  if (!stream) return;
  localSpeakingCleanup = watchAudioLevel(stream, (isSpeaking) => {
    useVoiceStore.setState({ localSpeaking: isSpeaking });
    socket?.emit('SPEAKING', { is_speaking: isSpeaking });
  });
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

  // Re-negotiation needed when new tracks are added (e.g., screen share start/stop)
  pc.onnegotiationneeded = async () => {
    try {
      if (pc.signalingState !== 'stable') return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('RTC_OFFER', {
        target_user_id: userId,
        offer: pc.localDescription,
        channel_id: channelId,
      });
    } catch (err) {
      console.error('Re-negotiation error:', err);
    }
  };

  pc.ontrack = ({ track, streams }) => {
    if (!streams[0]) return;
    if (track.kind === 'video') {
      // Screen share or camera video — store separately so audio stream is preserved
      useVoiceStore.getState().addPeer(userId, { screenStream: streams[0] });
    } else {
      useVoiceStore.getState().addPeer(userId, { stream: streams[0] });
      // Watch remote audio level for speaking indicator
      watchAudioLevel(streams[0], (isSpeaking) => {
        useVoiceStore.getState().setSpeaking(userId, isSpeaking);
      });
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
