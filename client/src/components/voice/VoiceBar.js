import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, PhoneOff, Volume2 } from 'lucide-react';
import { useVoiceStore } from '../../store/voice';
import { useAuthStore } from '../../store/auth';
import {
  joinVoiceChannel, leaveVoiceChannel, updateVoiceState,
  createVoicePeerConnection, getSocket, watchLocalSpeaking
} from '../../services/socket';
import Avatar from '../common/Avatar';

export default function VoiceBar({ channelId, serverId, channelName }) {
  const {
    activeChannelId, isMuted, isDeafened, isScreenSharing,
    peers, localStream, screenStream, localSpeaking,
    setLocalStream, setScreenStream, toggleMute, setActiveVoice, clearVoice,
  } = useVoiceStore();
  const { user } = useAuthStore();
  const streamRef = useRef(null);

  const isInThisChannel = activeChannelId === channelId;

  // All peers currently in this voice channel
  const voiceMembers = Object.entries(peers).filter(
    ([, p]) => p.channelId === channelId
  );

  async function handleJoin() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setLocalStream(stream);
      setActiveVoice(channelId, serverId);
      joinVoiceChannel(channelId, serverId);
      watchLocalSpeaking(stream);
    } catch {
      alert('Could not access microphone. Check permissions.');
    }
  }

  function handleLeave() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    leaveVoiceChannel(channelId, serverId);
    clearVoice();
  }

  async function handleScreenShare() {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: channelId });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setScreenStream(stream);
        getSocket()?.emit('SCREEN_SHARE_START', { channel_id: channelId });
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: channelId });
        };
      } catch { /* user cancelled */ }
    }
  }

  function handleToggleMute() {
    const muted = toggleMute();
    updateVoiceState({ self_mute: muted, self_deaf: isDeafened });
  }

  const totalInVoice = voiceMembers.length + (isInThisChannel ? 1 : 0);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b"
      style={{
        background: 'linear-gradient(90deg, #030a10 0%, #060f18 100%)',
        borderColor: 'rgba(0,212,255,0.15)',
        borderTop: '1px solid rgba(0,212,255,0.08)',
        minHeight: '52px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent line */}
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0, width: '2px',
          background: totalInVoice > 0
            ? 'linear-gradient(180deg, transparent, #00ff88, transparent)'
            : 'linear-gradient(180deg, transparent, rgba(0,212,255,0.4), transparent)',
        }}
      />

      {/* Icon + label */}
      <div className="flex items-center gap-2 text-nc-channel-icon shrink-0" style={{ minWidth: 120 }}>
        <Volume2 size={14} style={{ color: totalInVoice > 0 ? '#00ff88' : '#2a5870' }} />
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: totalInVoice > 0 ? '#00ff88' : '#2a5870' }}
        >
          VOICE · {totalInVoice}
        </span>
      </div>

      {/* Participant avatars */}
      <div className="flex items-center gap-2 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Self, if in this channel */}
        {isInThisChannel && (
          <VoiceMember
            key="self"
            username={user?.display_name || user?.username || 'You'}
            avatar={user?.avatar_url}
            isMuted={isMuted}
            isSpeaking={localSpeaking}
            isSelf
          />
        )}
        {/* Remote peers */}
        {voiceMembers.map(([userId, peer]) => (
          <VoiceMember
            key={userId}
            username={peer.username || userId}
            avatar={peer.avatar}
            isMuted={peer.isMuted}
            isSpeaking={peer.isSpeaking}
            isScreenSharing={peer.isScreenSharing}
          />
        ))}
        {totalInVoice === 0 && (
          <span className="text-xs" style={{ color: '#1e3d50' }}>
            No one in voice
          </span>
        )}
      </div>

      {/* Controls */}
      {isInThisChannel ? (
        <div className="flex items-center gap-1 shrink-0">
          <CtrlBtn
            active={isScreenSharing}
            onClick={handleScreenShare}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <Monitor size={14} />
          </CtrlBtn>
          <CtrlBtn
            danger={isMuted}
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </CtrlBtn>
          <CtrlBtn danger onClick={handleLeave} title="Disconnect">
            <PhoneOff size={14} />
          </CtrlBtn>
        </div>
      ) : (
        <button
          onClick={handleJoin}
          className="shrink-0 px-3 py-1 text-xs uppercase tracking-widest transition-all"
          style={{
            background: 'transparent',
            border: '1px solid rgba(0,212,255,0.4)',
            color: '#00d4ff',
            clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(0,212,255,0.12)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Join Voice
        </button>
      )}
    </div>
  );
}

function VoiceMember({ username, avatar, isMuted, isSpeaking, isScreenSharing, isSelf }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 shrink-0"
      style={{ minWidth: 44 }}
      title={username}
    >
      <div
        className="relative"
        style={{
          width: 32, height: 32,
          border: isSpeaking
            ? '2px solid #00ff88'
            : isSelf
            ? '2px solid rgba(0,212,255,0.5)'
            : '2px solid rgba(0,212,255,0.15)',
          boxShadow: isSpeaking ? '0 0 8px rgba(0,255,136,0.6)' : 'none',
          borderRadius: 0,
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        <Avatar
          user={{ id: username, username, avatar_url: avatar }}
          size={28}
        />
        {isMuted && (
          <div
            style={{
              position: 'absolute',
              bottom: -3, right: -3,
              background: '#ff3c00',
              width: 12, height: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MicOff size={8} color="#fff" />
          </div>
        )}
        {isScreenSharing && (
          <div
            style={{
              position: 'absolute',
              bottom: -3, left: -3,
              background: '#00d4ff',
              width: 12, height: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Monitor size={8} color="#040a0f" />
          </div>
        )}
      </div>
      <span
        className="text-xxs truncate w-full text-center"
        style={{ maxWidth: 44, color: isSpeaking ? '#00ff88' : '#2e5568' }}
      >
        {isSelf ? 'you' : username.split('#')[0].substring(0, 6)}
      </span>
    </div>
  );
}

function CtrlBtn({ children, onClick, title, danger, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid',
        borderColor: danger
          ? 'rgba(255,60,0,0.5)'
          : active
          ? 'rgba(0,212,255,0.6)'
          : 'rgba(0,212,255,0.2)',
        color: danger ? '#ff3c00' : active ? '#00d4ff' : '#5a8fa8',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger
          ? 'rgba(255,60,0,0.15)'
          : 'rgba(0,212,255,0.1)';
        e.currentTarget.style.color = danger ? '#ff5a1f' : '#00d4ff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = danger ? '#ff3c00' : active ? '#00d4ff' : '#5a8fa8';
      }}
    >
      {children}
    </button>
  );
}
