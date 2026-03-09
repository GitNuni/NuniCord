import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users } from 'lucide-react';
import { useVoiceStore } from '../../store/voice';
import { useAuthStore } from '../../store/auth';
import {
  joinVoiceChannel, leaveVoiceChannel, updateVoiceState,
  createVoicePeerConnection, getSocket
} from '../../services/socket';
import Avatar from '../common/Avatar';

export default function VoiceChannel({ channelId, channelData, serverId }) {
  const {
    activeChannelId, isMuted, isDeafened, isVideo, isScreenSharing,
    localStream, screenStream, peers,
    setLocalStream, setScreenStream, toggleMute, toggleDeafen, toggleVideo,
    setActiveVoice, clearVoice,
  } = useVoiceStore();
  const { user } = useAuthStore();
  const [joined, setJoined] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);

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
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setScreenStream(stream);
        getSocket()?.emit('SCREEN_SHARE_START', { channel_id: channelId });
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          getSocket()?.emit('SCREEN_SHARE_STOP', { channel_id: channelId });
        };
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  }

  const peerList = Object.entries(peers);

  return (
    <div className="flex-1 flex flex-col bg-nc-bg-primary">
      {/* Header */}
      <div className="flex items-center h-12 border-b border-black/30 px-4 gap-2">
        <Volume2 size={20} className="text-nc-channel-icon" />
        <span className="font-semibold text-nc-header-primary">{channelData?.name}</span>
        <span className="text-nc-text-muted text-sm ml-2">
          {joined ? 'Connected' : 'Voice Channel'}
        </span>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        {!joined ? (
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
        ) : (
          <div className="w-full">
            {/* Video grid */}
            <div className={`grid gap-4 ${peerList.length === 0 ? 'grid-cols-1' : 'grid-cols-2'} max-w-4xl mx-auto`}>
              {/* Local user */}
              <ParticipantTile
                user={user}
                stream={localStream}
                isMuted={isMuted}
                isDeafened={isDeafened}
                isVideo={isVideo}
                isSelf
              />

              {/* Remote peers */}
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
        )}
      </div>

      {/* Controls */}
      {joined && (
        <div className="flex items-center justify-center gap-3 py-4 border-t border-black/30">
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
          <ControlButton
            icon={<Monitor size={20} />}
            label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
            active={isScreenSharing}
            onClick={handleScreenShare}
          />
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

function ParticipantTile({ user, stream, isMuted, isDeafened, isVideo, isSpeaking, isScreenSharing, isSelf }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative rounded-lg overflow-hidden bg-nc-bg-secondary aspect-video flex items-center justify-center ${isSpeaking ? 'speaking' : ''}`}>
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
            <HeadphoneOff size={14} className="text-nc-red" />
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
