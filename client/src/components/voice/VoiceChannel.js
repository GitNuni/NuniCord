import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Headphones, Maximize2 } from 'lucide-react';
import { useVoiceStore } from '../../store/voice';
import { useAuthStore } from '../../store/auth';
import {
  joinVoiceChannel, leaveVoiceChannel, updateVoiceState,
  createVoicePeerConnection, getSocket, watchLocalSpeaking
} from '../../services/socket';
import Avatar from '../common/Avatar';

export default function VoiceChannel({ channelId, channelData, serverId }) {
  const {
    activeChannelId, isMuted, isDeafened, isVideo, isScreenSharing,
    localStream, screenStream, peers, localSpeaking, peerConnections,
    setLocalStream, setScreenStream, toggleMute, toggleDeafen, toggleVideo,
    setActiveVoice, clearVoice,
  } = useVoiceStore();
  const { user } = useAuthStore();

  const [joined, setJoined] = useState(() => activeChannelId === channelId && !!localStream);
  const [viewingScreenShare, setViewingScreenShare] = useState(null);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  useEffect(() => {
    if (activeChannelId !== channelId && joined) {
      setJoined(false);
    }
  }, [activeChannelId, channelId]);

  const peerList = Object.entries(peers).filter(([, p]) => p.channelId === channelId);
  const screenSharers = peerList.filter(([, p]) => p.isScreenSharing && p.screenStream);
  const hasScreenShare = screenSharers.length > 0 || isScreenSharing;

  const screenShareViewStream = viewingScreenShare === 'local'
    ? screenStream
    : viewingScreenShare
    ? peers[viewingScreenShare]?.screenStream
    : null;

  async function handleJoin() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      setActiveVoice(channelId, serverId);
      joinVoiceChannel(channelId, serverId);
      watchLocalSpeaking(stream);
      setJoined(true);
    } catch (err) {
      console.error('Failed to join voice:', err);
      alert('Could not access microphone. Please check your browser permissions.');
    }
  }

  function handleLeave() {
    clearVoice();
    leaveVoiceChannel(channelId, serverId);
    setJoined(false);
    setViewingScreenShare(null);
  }

  async function handleScreenShare() {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(t => t.stop());
      // Remove video senders from all peer connections
      Object.values(peerConnections).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) pc.removeTrack(sender);
      });
      setScreenStream(null);
      getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: channelId });
      updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: isVideo, self_stream: false, channel_id: channelId, server_id: serverId });
      setViewingScreenShare(v => v === 'local' ? null : v);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setScreenStream(stream);
        const videoTrack = stream.getVideoTracks()[0];

        // Transmit screen share video track to all connected peers
        Object.values(peerConnections).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            // addTrack triggers onnegotiationneeded → auto re-negotiation
            pc.addTrack(videoTrack, localStream || stream);
          }
        });

        getSocket()?.emit('SCREEN_SHARE_START', { channel_id: channelId });
        updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: isVideo, self_stream: true, channel_id: channelId, server_id: serverId });

        videoTrack.onended = () => {
          Object.values(peerConnections).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) pc.removeTrack(sender);
          });
          setScreenStream(null);
          getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: channelId });
          updateVoiceState({ self_mute: isMuted, self_deaf: isDeafened, self_video: isVideo, self_stream: false, channel_id: channelId, server_id: serverId });
          setViewingScreenShare(v => v === 'local' ? null : v);
        };
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-nc-bg-primary">
      {/* Header */}
      <div className="flex items-center h-14 border-b border-black/20 px-4 gap-3"
           style={{ background: 'var(--nc-bg-secondary)' }}>
        <Volume2 size={20} className="text-nc-channel-icon" />
        <span className="font-bold text-base text-nc-header-primary">{channelData?.name}</span>
        <span className="text-nc-text-muted text-sm">
          {joined ? '· Connected' : '· Voice Channel'}
        </span>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-auto">
        {!joined ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-nc-bg-secondary flex items-center justify-center mx-auto mb-5">
                <Volume2 size={36} className="text-nc-text-muted" />
              </div>
              <h2 className="text-2xl font-bold text-nc-header-primary mb-2">
                {channelData?.name}
              </h2>
              <p className="text-nc-text-muted mb-8">
                {peerList.length > 0
                  ? `${peerList.length} participant${peerList.length !== 1 ? 's' : ''} in this channel`
                  : 'No one is here yet — join and start talking'}
              </p>
              <button onClick={handleJoin} className="nc-btn-primary px-10 py-3 text-base">
                Join Voice
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Screen share viewer */}
            {viewingScreenShare && screenShareViewStream && (
              <ScreenShareViewer
                stream={screenShareViewStream}
                onClose={() => setViewingScreenShare(null)}
              />
            )}

            {/* Active screen shares bar */}
            {hasScreenShare && (
              <div style={{ display: 'flex', gap: 8, padding: '8px 14px', background: 'var(--nc-bg-secondary)', borderBottom: '1px solid rgba(var(--nc-divider-rgb), 0.3)', flexShrink: 0, flexWrap: 'wrap' }}>
                {isScreenSharing && screenStream && (
                  <button
                    onClick={() => setViewingScreenShare(v => v === 'local' ? null : 'local')}
                    style={{ fontSize: 12, color: viewingScreenShare === 'local' ? 'rgb(var(--nc-brand-rgb))' : 'var(--nc-interactive-normal)', background: viewingScreenShare === 'local' ? 'rgb(var(--nc-brand-rgb) / 0.12)' : 'transparent', border: '1px solid rgba(var(--nc-divider-rgb), 0.4)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Monitor size={12} />
                    Your screen
                  </button>
                )}
                {screenSharers.map(([uid, peer]) => (
                  <button
                    key={uid}
                    onClick={() => setViewingScreenShare(v => v === uid ? null : uid)}
                    style={{ fontSize: 12, color: viewingScreenShare === uid ? 'rgb(var(--nc-brand-rgb))' : 'var(--nc-interactive-normal)', background: viewingScreenShare === uid ? 'rgb(var(--nc-brand-rgb) / 0.12)' : 'transparent', border: '1px solid rgba(var(--nc-divider-rgb), 0.4)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Monitor size={12} />
                    {peer.username}'s screen
                  </button>
                ))}
              </div>
            )}

            {/* Participant grid */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className={`grid gap-4 w-full max-w-4xl ${peerList.length === 0 ? 'grid-cols-1 max-w-xs' : peerList.length < 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <ParticipantTile
                  user={user}
                  stream={localStream}
                  screenStream={screenStream}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  isVideo={isVideo}
                  isScreenSharing={isScreenSharing}
                  isSpeaking={localSpeaking}
                  isSelf
                />
                {peerList.map(([userId, peer]) => (
                  <ParticipantTile
                    key={userId}
                    user={{ id: userId, username: peer.username, display_name: peer.username, avatar_url: peer.avatar }}
                    stream={peer.stream}
                    screenStream={peer.screenStream}
                    isMuted={peer.isMuted}
                    isDeafened={peer.isDeafened}
                    isVideo={peer.isVideo}
                    isScreenSharing={peer.isScreenSharing}
                    isSpeaking={peer.isSpeaking}
                    localIsDeafened={isDeafened}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {joined && (
        <div className="flex items-center justify-center gap-3 py-5 border-t border-black/20 flex-wrap"
             style={{ background: 'var(--nc-bg-secondary)' }}>
          <ControlButton
            icon={isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
            onClick={() => {
              const muted = toggleMute();
              updateVoiceState({ self_mute: muted, self_deaf: isDeafened, self_video: isVideo, self_stream: isScreenSharing, channel_id: channelId, server_id: serverId });
            }}
          />
          <ControlButton
            icon={isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
            label={isDeafened ? 'Undeafen' : 'Deafen'}
            active={isDeafened}
            onClick={() => {
              const deafened = toggleDeafen();
              updateVoiceState({ self_mute: isMuted, self_deaf: deafened, self_video: isVideo, self_stream: isScreenSharing, channel_id: channelId, server_id: serverId });
            }}
          />
          <ControlButton
            icon={isVideo ? <VideoOff size={20} /> : <Video size={20} />}
            label={isVideo ? 'Stop Video' : 'Video'}
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
            label="Leave"
            onClick={handleLeave}
            danger
          />
        </div>
      )}
    </div>
  );
}

function ScreenShareViewer({ stream, onClose }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  function handleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ flexShrink: 0, background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '60vh' }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        onDoubleClick={handleFullscreen}
      />
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
        <button
          onClick={handleFullscreen}
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Maximize2 size={12} />
          Fullscreen
        </button>
        <button
          onClick={onClose}
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          Close
        </button>
      </div>
      <p style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
        Double-click to fullscreen
      </p>
    </div>
  );
}

function ParticipantTile({ user, stream, screenStream, isMuted, isDeafened, isVideo, isSpeaking, isScreenSharing, isSelf, localIsDeafened }) {
  const videoRef = useRef(null);

  // Attach video/screen stream to the video element
  const videoStream = isScreenSharing ? screenStream : (isVideo ? stream : null);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(() => {});
    }
  }, [videoStream]);

  // Note: audio for remote peers is handled by PersistentVoiceAudio in VoiceHUD
  // so we don't add audio elements here (would cause double-playback)

  return (
    <div
      className={`relative rounded-2xl overflow-hidden aspect-video flex items-center justify-center ${isSpeaking ? 'speaking' : ''}`}
      style={{ background: 'var(--nc-bg-secondary)' }}
    >
      {(isVideo || isScreenSharing) && videoStream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isSelf}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Avatar user={user} size={72} />
          <span className="text-sm font-semibold" style={{ color: 'var(--nc-header-primary)' }}>
            {isSelf ? 'You' : (user?.display_name || user?.username)}
          </span>
        </div>
      )}

      {/* Status badges */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        {isMuted && (
          <div className="rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <MicOff size={13} style={{ color: 'var(--nc-status-danger)' }} />
          </div>
        )}
        {isDeafened && (
          <div className="rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <VolumeX size={13} style={{ color: 'var(--nc-status-danger)' }} />
          </div>
        )}
      </div>

      {/* Name tag */}
      <div className="absolute bottom-2 right-2 rounded-lg px-2 py-0.5 text-xs font-medium text-white"
           style={{ background: 'rgba(0,0,0,0.55)' }}>
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
      className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-2xl transition-all text-sm font-medium ${
        danger
          ? 'bg-nc-red text-white hover:opacity-90'
          : active
          ? 'bg-nc-red/15 text-nc-red hover:bg-nc-red/25'
          : 'bg-nc-bg-tertiary text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover/15'
      }`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}
