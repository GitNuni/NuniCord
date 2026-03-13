import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users, Menu } from 'lucide-react';
import { useVoiceStore } from '../../store/voice';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import {
  joinVoiceChannel, leaveVoiceChannel, updateVoiceState,
  createVoicePeerConnection, getSocket, watchLocalSpeaking
} from '../../services/socket';
import Avatar from '../common/Avatar';

export default function VoiceChannel({ channelId, channelData, serverId }) {
  const {
    activeChannelId, isMuted, isDeafened, isVideo, isScreenSharing,
    localStream, screenStream, peers, localSpeaking,
    setLocalStream, setScreenStream, toggleMute, toggleDeafen, toggleVideo,
    setActiveVoice, clearVoice,
  } = useVoiceStore();
  const { user } = useAuthStore();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const [joined, setJoined] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [viewingScreenShare, setViewingScreenShare] = useState(null); // userId or 'local'
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const isActiveChannel = activeChannelId === channelId;

  async function handleJoin() {
    try {
      // Get media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setLocalStream(stream);
      setActiveVoice(channelId, serverId);
      joinVoiceChannel(channelId, serverId);
      watchLocalSpeaking(stream);
      setJoined(true);
    } catch (err) {
      console.error('Failed to join voice:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  function handleLeave() {
    clearVoice();
    leaveVoiceChannel(channelId, serverId);
    setJoined(false);
  }

  async function handleScreenShare() {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: channelId });
      updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: isVideo, self_stream: false, channel_id: channelId, server_id: serverId });
      setViewingScreenShare(v => v === 'local' ? null : v);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setScreenStream(stream);
        getSocket()?.emit('SCREEN_SHARE_START', { channel_id: channelId });
        updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: isVideo, self_stream: true, channel_id: channelId, server_id: serverId });
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: channelId });
          updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: isVideo, self_stream: false, channel_id: channelId, server_id: serverId });
        };
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  }

  const peerList = Object.entries(peers);
  const screenSharers = peerList.filter(([_, p]) => p.isScreenSharing);
  const hasScreenShare = screenSharers.length > 0 || isScreenSharing;

  // Derive the stream to show in screen share viewport
  const screenShareViewStream = viewingScreenShare === 'local'
    ? screenStream
    : viewingScreenShare
    ? peers[viewingScreenShare]?.stream
    : null;

  return (
    <div className="flex-1 flex flex-col bg-nc-bg-primary">
      {/* Header */}
      <div className="flex items-center h-12 border-b border-black/30 px-4 gap-2">
        <button
          onClick={() => setMobileSidebarOpen(o => !o)}
          style={{
            background: 'transparent', border: 'none', padding: '4px 6px 4px 0',
            cursor: 'pointer', color: mobileSidebarOpen ? '#00d4ff' : '#2a5870',
            transition: 'color 0.2s', display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
        >
          <Menu size={20} />
        </button>
        <Volume2 size={20} className="text-nc-channel-icon" />
        <span className="font-semibold text-nc-header-primary">{channelData?.name}</span>
        <span className="text-nc-text-muted text-sm ml-2">
          {joined ? 'Connected' : 'Voice Channel'}
        </span>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-auto">
        {!joined ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <Volume2 size={64} className="text-nc-text-muted mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-nc-header-primary mb-2">
                {channelData?.name}
              </h2>
              <p className="text-nc-text-muted mb-6">
                {peerList.length > 0 ? `${peerList.length} participant(s) in this channel` : 'No one is here yet'}
              </p>
              <button onClick={handleJoin} className="nc-btn-primary px-8 py-3 text-base">
                Join Voice
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Screen share viewer — max 1/3 height */}
            {viewingScreenShare && screenShareViewStream && (
              <div style={{ maxHeight: '33%', flexShrink: 0, background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ScreenShareVideo stream={screenShareViewStream} />
                <button
                  onClick={() => setViewingScreenShare(null)}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
                >
                  Close
                </button>
              </div>
            )}

            {/* Active screen shares bar — click to view */}
            {hasScreenShare && (
              <div style={{ display: 'flex', gap: 8, padding: '6px 12px', background: '#040a0f', borderBottom: '1px solid rgba(0,212,255,0.1)', flexShrink: 0, flexWrap: 'wrap' }}>
                {isScreenSharing && screenStream && (
                  <button
                    onClick={() => setViewingScreenShare(v => v === 'local' ? null : 'local')}
                    style={{ fontSize: 12, color: viewingScreenShare === 'local' ? '#00d4ff' : '#5a8fa8', background: viewingScreenShare === 'local' ? 'rgba(0,212,255,0.1)' : 'transparent', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    <Monitor size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Your screen
                  </button>
                )}
                {screenSharers.map(([uid, peer]) => (
                  <button
                    key={uid}
                    onClick={() => setViewingScreenShare(v => v === uid ? null : uid)}
                    style={{ fontSize: 12, color: viewingScreenShare === uid ? '#00d4ff' : '#5a8fa8', background: viewingScreenShare === uid ? 'rgba(0,212,255,0.1)' : 'transparent', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    <Monitor size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {peer.username}'s screen
                  </button>
                ))}
              </div>
            )}

            {/* Participant tiles */}
            <div className="flex-1 flex items-center justify-center p-4">
              <div className={`grid gap-4 w-full max-w-4xl ${peerList.length === 0 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <ParticipantTile
                  user={user}
                  stream={localStream}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  isVideo={isVideo}
                  isSpeaking={localSpeaking}
                  isSelf
                />
                {peerList.map(([userId, peer]) => (
                  <ParticipantTile
                    key={userId}
                    user={{ id: userId, username: peer.username, avatar_url: peer.avatar }}
                    stream={peer.stream}
                    isMuted={peer.isMuted}
                    isDeafened={peer.isDeafened}
                    isVideo={peer.isVideo}
                    isSpeaking={peer.isSpeaking}
                    isScreenSharing={peer.isScreenSharing}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {joined && (
        <div className="flex items-center justify-center gap-3 py-4 border-t border-black/30 flex-wrap">
          <ControlButton
            icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
            onClick={() => {
              const muted = toggleMute();
              updateVoiceState({ self_mute: muted, self_deaf: isDeafened, channel_id: channelId, server_id: serverId });
            }}
          />
          <ControlButton
            icon={isVideo ? <VideoOff size={20} /> : <Video size={20} />}
            label={isVideo ? 'Stop Video' : 'Start Video'}
            active={isVideo}
            onClick={toggleVideo}
          />
          {!isMobile && (
            <ControlButton
              icon={<Monitor size={20} />}
              label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
              active={isScreenSharing}
              onClick={handleScreenShare}
            />
          )}
          <ControlButton
            icon={<PhoneOff size={20} />}
            label="Disconnect"
            onClick={handleLeave}
            danger
          />
        </div>
      )}
    </div>
  );
}

function ScreenShareVideo({ stream }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
}

function ParticipantTile({ user, stream, isMuted, isDeafened, isVideo, isSpeaking, isScreenSharing, isSelf }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Play remote audio — essential for audio-only mode
  useEffect(() => {
    if (!isSelf && audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, isSelf]);

  return (
    <div className={`relative rounded-lg overflow-hidden bg-nc-bg-secondary aspect-video flex items-center justify-center ${isSpeaking ? 'speaking' : ''}`}>
      {/* Hidden audio element for remote peers — plays audio even without video */}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />}

      {(isVideo || isScreenSharing) && stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isSelf}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Avatar user={user} size={64} />
          <span className="text-nc-text-normal text-sm font-medium">
            {isSelf ? 'You' : (user?.display_name || user?.username)}
          </span>
        </div>
      )}

      {/* Status indicators */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        {isMuted && (
          <div className="bg-nc-bg-floating/80 rounded p-1">
            <MicOff size={14} className="text-nc-red" />
          </div>
        )}
        {isDeafened && (
          <div className="bg-nc-bg-floating/80 rounded p-1">
            <PhoneOff size={14} className="text-nc-red" />
          </div>
        )}
      </div>

      {/* Name tag */}
      <div className="absolute bottom-2 right-2 bg-nc-bg-floating/80 rounded px-2 py-0.5 text-xs text-white">
        {isSelf ? 'You' : (user?.display_name || user?.username)}
      </div>
    </div>
  );
}

function ControlButton({ icon, label, onClick, active, danger }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-1 p-3 rounded-full transition-colors ${
        danger
          ? 'bg-nc-red hover:bg-red-600 text-white'
          : active
          ? 'bg-nc-red/20 text-nc-red hover:bg-nc-red/30'
          : 'bg-nc-bg-secondary hover:bg-nc-bg-modifier-active text-nc-interactive-normal hover:text-nc-interactive-hover'
      }`}
    >
      {icon}
    </button>
  );
}
