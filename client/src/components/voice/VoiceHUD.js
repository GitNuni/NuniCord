import React, { useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff } from 'lucide-react';
import { useVoiceStore } from '../../store/voice';
import { leaveVoiceChannel } from '../../services/socket';
import Soundboard from './Soundboard';

export default function VoiceHUD() {
  const { activeChannelId, activeServerId, isMuted, toggleMute, clearVoice } = useVoiceStore();

  if (!activeChannelId) return null;

  function handleDisconnect() {
    leaveVoiceChannel(activeChannelId, activeServerId);
    clearVoice();
  }

  return (
    <>
      {/* Persistent audio elements — keep playing even when navigating away from voice channel */}
      <PersistentVoiceAudio />

      <div className="bg-[#2b2d31] border-b border-black/20 p-2">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs text-nc-green font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-nc-green animate-pulse" />
              Voice Connected
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-nc-red hover:text-red-400 transition-colors"
            title="Disconnect"
          >
            <PhoneOff size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMute}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs ${
              isMuted ? 'text-nc-red' : 'text-nc-interactive-normal hover:text-nc-interactive-hover'
            }`}
          >
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <Soundboard />
        </div>
      </div>
    </>
  );
}

// Renders a hidden <audio> element per peer — survives channel navigation because VoiceHUD
// is mounted in ChannelSidebar for the entire voice session, not inside VoiceChannel.
function PersistentVoiceAudio() {
  const { peers, isDeafened } = useVoiceStore();

  return (
    <div style={{ display: 'none' }} aria-hidden="true">
      {Object.entries(peers).map(([userId, peer]) => (
        peer.stream ? (
          <PeerAudioElement
            key={userId}
            stream={peer.stream}
            isDeafened={isDeafened}
          />
        ) : null
      ))}
    </div>
  );
}

function PeerAudioElement({ stream, isDeafened }) {
  const audioRef = useRef(null);

  // Attach stream when it becomes available
  useEffect(() => {
    if (!audioRef.current || !stream) return;
    audioRef.current.srcObject = stream;
    audioRef.current.muted = isDeafened;
    if (!isDeafened) {
      audioRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Toggle mute in real-time when deafen changes
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = isDeafened;
    if (!isDeafened && audioRef.current.srcObject) {
      audioRef.current.play().catch(() => {});
    }
  }, [isDeafened]);

  return <audio ref={audioRef} autoPlay playsInline />;
}
