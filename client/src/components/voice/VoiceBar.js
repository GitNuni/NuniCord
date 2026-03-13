import React, { useState } from 'react';
import { Mic, MicOff, Monitor, PhoneOff, Volume2, Headphones, VolumeX } from 'lucide-react';
import { useVoiceStore } from '../../store/voice';
import { useAuthStore } from '../../store/auth';
import {
  joinVoiceChannel, leaveVoiceChannel, updateVoiceState,
  getSocket, watchLocalSpeaking
} from '../../services/socket';
import Avatar from '../common/Avatar';

export default function VoiceBar({ serverId, serverData }) {
  const {
    voiceChannels, activeChannelId, isMuted, isDeafened, isScreenSharing,
    localStream, screenStream, localSpeaking,
    setLocalStream, setScreenStream, toggleMute, toggleDeafen, setActiveVoice, clearVoice,
  } = useVoiceStore();
  const { user } = useAuthStore();

  // Voice channels in this server
  const voiceChList = (serverData?.channels || []).filter(c => c.type === 'voice');

  // Active voice channels (have members or we're in them)
  const activeVoiceChannels = voiceChList.filter(c =>
    (voiceChannels[c.id] && voiceChannels[c.id].length > 0) || activeChannelId === c.id
  );

  // Which channel tab is selected for display
  const [selectedId, setSelectedId] = useState(null);
  const displayChannelId = selectedId && activeVoiceChannels.find(c => c.id === selectedId)
    ? selectedId
    : activeChannelId || activeVoiceChannels[0]?.id;

  if (activeVoiceChannels.length === 0) return null;

  const displayChannel = voiceChList.find(c => c.id === displayChannelId);
  const members = voiceChannels[displayChannelId] || [];
  const isInDisplayChannel = activeChannelId === displayChannelId;
  const selfInChannel = isInDisplayChannel && !!localStream;
  const totalInChannel = members.length + (selfInChannel && !members.find(m => m.user_id === user?.id) ? 1 : 0);

  async function handleJoin(channelId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      setActiveVoice(channelId, serverId);
      joinVoiceChannel(channelId, serverId);
      watchLocalSpeaking(stream);
      setSelectedId(channelId);
    } catch {
      alert('Could not access microphone. Check permissions.');
    }
  }

  function handleLeave() {
    clearVoice();
    leaveVoiceChannel(activeChannelId, serverId);
  }

  async function handleScreenShare() {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: activeChannelId });
      updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: false, self_stream: false, channel_id: activeChannelId, server_id: serverId });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setScreenStream(stream);
        getSocket()?.emit('SCREEN_SHARE_START', { channel_id: activeChannelId });
        updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: false, self_stream: true, channel_id: activeChannelId, server_id: serverId });
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: activeChannelId });
          updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: false, self_stream: false, channel_id: activeChannelId, server_id: serverId });
        };
      } catch { /* cancelled */ }
    }
  }

  function handleToggleMute() {
    const muted = toggleMute();
    updateVoiceState({ self_mute: muted, self_deaf: isDeafened, self_stream: isScreenSharing, channel_id: activeChannelId, server_id: serverId });
  }

  function handleToggleDeafen() {
    const deafened = toggleDeafen();
    updateVoiceState({ self_mute: isMuted, self_deaf: deafened, self_stream: isScreenSharing, channel_id: activeChannelId, server_id: serverId });
  }

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  return (
    <div
      style={{
        background: 'var(--nc-bg-secondary)',
        borderBottom: '1px solid rgba(var(--nc-divider-rgb), 0.35)',
        flexShrink: 0,
      }}
    >
      {/* Channel tabs — only shown if multiple active voice channels */}
      {activeVoiceChannels.length > 1 && (
        <div
          className="flex gap-1 px-3 pt-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {activeVoiceChannels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedId(ch.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
              style={{
                background: ch.id === displayChannelId
                  ? 'rgb(var(--nc-brand-rgb) / 0.15)'
                  : 'transparent',
                color: ch.id === displayChannelId
                  ? 'rgb(var(--nc-brand-rgb))'
                  : 'var(--nc-interactive-normal)',
                border: ch.id === displayChannelId
                  ? '1px solid rgb(var(--nc-brand-rgb) / 0.3)'
                  : '1px solid transparent',
              }}
            >
              <Volume2 size={11} />
              {ch.name}
              {activeChannelId === ch.id && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--nc-status-green)', flexShrink: 0,
                }} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main bar */}
      <div className="flex items-center gap-3 px-3 py-2" style={{ minHeight: 52 }}>
        {/* Voice icon + label */}
        <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: 100 }}>
          <Volume2 size={14} style={{ color: totalInChannel > 0 ? 'var(--nc-status-green)' : 'var(--nc-text-muted)' }} />
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--nc-header-secondary)', lineHeight: 1.2 }}>
              {displayChannel?.name || 'Voice'}
            </div>
            <div className="text-xs" style={{ color: 'var(--nc-text-muted)', lineHeight: 1.2 }}>
              {totalInChannel > 0 ? `${totalInChannel} connected` : 'Empty'}
            </div>
          </div>
        </div>

        {/* Participant avatars */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Self, if in this channel */}
          {selfInChannel && !members.find(m => m.user_id === user?.id) && (
            <VoiceMemberPill
              user={user}
              isMuted={isMuted}
              isDeafened={isDeafened}
              isSpeaking={localSpeaking}
              isSelf
            />
          )}
          {members.map(m => (
            <VoiceMemberPill
              key={m.user_id}
              user={{ id: m.user_id, username: m.username, avatar_url: m.avatar_url }}
              isMuted={m.self_mute}
              isDeafened={m.self_deaf}
            />
          ))}
          {totalInChannel === 0 && (
            <span className="text-xs" style={{ color: 'var(--nc-text-muted)' }}>
              No one here yet
            </span>
          )}
        </div>

        {/* Controls */}
        {isInDisplayChannel ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isMobile && (
              <VoiceCtrlBtn
                active={isScreenSharing}
                onClick={handleScreenShare}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <Monitor size={14} />
              </VoiceCtrlBtn>
            )}
            <VoiceCtrlBtn
              active={isMuted}
              onClick={handleToggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </VoiceCtrlBtn>
            <VoiceCtrlBtn
              active={isDeafened}
              onClick={handleToggleDeafen}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? <VolumeX size={14} /> : <Headphones size={14} />}
            </VoiceCtrlBtn>
            <VoiceCtrlBtn danger onClick={handleLeave} title="Disconnect">
              <PhoneOff size={14} />
            </VoiceCtrlBtn>
          </div>
        ) : (
          <button
            onClick={() => handleJoin(displayChannelId)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
            style={{
              background: 'rgb(var(--nc-brand-rgb))',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Join
          </button>
        )}
      </div>
    </div>
  );
}

function VoiceMemberPill({ user, isMuted, isDeafened, isSpeaking, isSelf }) {
  return (
    <div
      className="flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded-full"
      style={{
        background: isSpeaking
          ? 'rgb(var(--nc-status-green-rgb, 52 199 89) / 0.15)'
          : 'var(--nc-bg-tertiary)',
        border: isSpeaking
          ? '1px solid rgb(var(--nc-status-green-rgb, 52 199 89) / 0.5)'
          : '1px solid rgba(var(--nc-divider-rgb), 0.3)',
        transition: 'all 0.2s',
      }}
      title={isSelf ? 'You' : (user?.display_name || user?.username)}
    >
      <Avatar user={user} size={18} />
      <span className="text-xs max-w-[56px] truncate" style={{ color: 'var(--nc-text-normal)' }}>
        {isSelf ? 'You' : (user?.display_name || user?.username || '').split('#')[0].substring(0, 8)}
      </span>
      {isMuted && <MicOff size={10} style={{ color: 'var(--nc-status-danger)', flexShrink: 0 }} />}
      {isDeafened && <VolumeX size={10} style={{ color: 'var(--nc-status-danger)', flexShrink: 0 }} />}
    </div>
  );
}

function VoiceCtrlBtn({ children, onClick, title, danger, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger
          ? 'rgb(var(--nc-red-rgb, 255 59 48) / 0.15)'
          : active
          ? 'rgb(var(--nc-red-rgb, 255 59 48) / 0.12)'
          : 'var(--nc-bg-tertiary)',
        border: '1px solid',
        borderColor: danger
          ? 'rgb(var(--nc-red-rgb, 255 59 48) / 0.4)'
          : active
          ? 'rgb(var(--nc-red-rgb, 255 59 48) / 0.3)'
          : 'rgba(var(--nc-divider-rgb), 0.3)',
        borderRadius: 8,
        color: danger || active ? 'var(--nc-red, #ff3b30)' : 'var(--nc-interactive-normal)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
