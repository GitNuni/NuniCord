import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Music2, Plus, Trash2, X } from 'lucide-react';
import { SOUNDS, playSound, playCustomSound } from '../../services/sounds';
import { getSocket } from '../../services/socket';
import { useVoiceStore } from '../../store/voice';
import { useServerStore } from '../../store/servers';
import api from '../../services/api';

export default function Soundboard({ inChat = false }) {
  const [open, setOpen] = useState(false);
  const [serverSounds, setServerSounds] = useState([]);
  const [addingName, setAddingName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const { activeChannelId, activeServerId } = useVoiceStore();
  const { activeServerId: storeServerId } = useServerStore();
  const serverId = activeServerId || storeServerId;
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load server sounds when panel opens or serverId changes
  const loadSounds = useCallback(() => {
    if (!serverId) return;
    api.get(`/sounds/${serverId}`).then(r => setServerSounds(r.data)).catch(() => {});
  }, [serverId]);

  useEffect(() => {
    if (open) loadSounds();
  }, [open, loadSounds]);

  // Real-time sound updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !serverId) return;
    function onSoundCreate(sound) {
      if (sound.server_id === serverId) setServerSounds(prev => [...prev, sound]);
    }
    function onSoundDelete({ id, server_id }) {
      if (server_id === serverId) setServerSounds(prev => prev.filter(s => s.id !== id));
    }
    socket.on('SOUND_CREATE', onSoundCreate);
    socket.on('SOUND_DELETE', onSoundDelete);
    return () => { socket.off('SOUND_CREATE', onSoundCreate); socket.off('SOUND_DELETE', onSoundDelete); };
  }, [serverId]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.top - 8, left: rect.right + 8 });
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  function broadcast(soundId, soundUrl) {
    const socket = getSocket();
    if (socket && activeChannelId) {
      socket.emit('SOUNDBOARD_PLAY', {
        channel_id: activeChannelId,
        sound_id: soundId || null,
        sound_url: soundUrl || null,
      });
    }
  }

  function handlePlay(soundId) {
    playSound(soundId);
    broadcast(soundId, null);
  }

  function handlePlayCustom(sound) {
    playCustomSound(sound.data);
    broadcast(null, sound.data);
  }

  async function handleAddFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('Sound file must be under 3MB');
      return;
    }
    if (!serverId) { alert('Join a server first'); return; }
    const reader = new FileReader();
    reader.onload = async ev => {
      const name = addingName.trim() || file.name.replace(/\.[^.]+$/, '');
      try {
        await api.post(`/sounds/${serverId}`, { label: name, data: ev.target.result });
        setAddingName('');
        setShowAdd(false);
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to upload sound');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function deleteSound(id) {
    if (!serverId) return;
    await api.delete(`/sounds/${serverId}/${id}`).catch(() => {});
  }

  const btnStyle = inChat
    ? { color: '#2a5870', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }
    : {};

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Soundboard"
        style={inChat ? btnStyle : {}}
        className={inChat ? '' : `flex items-center justify-center gap-1 py-1 px-2 rounded text-xs transition-colors ${
          open ? 'text-nc-brand bg-nc-bg-modifier-active' : 'text-nc-interactive-normal hover:text-nc-interactive-hover'
        }`}
        onMouseEnter={e => { if (inChat) e.currentTarget.style.color = '#00d4ff'; }}
        onMouseLeave={e => { if (inChat) e.currentTarget.style.color = '#2a5870'; }}
      >
        <Music2 size={inChat ? 18 : 14} />
        {!inChat && <span className="hidden sm:inline ml-1">Board</span>}
      </button>

      {open && createPortal(
        <div ref={panelRef} style={{
          position: 'fixed',
          top: panelPos.top,
          left: panelPos.left,
          transform: 'translateY(-100%)',
          marginBottom: 8,
          width: 240,
          background: '#040a0f',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 4,
          padding: 10,
          zIndex: 9500,
          boxShadow: '0 0 24px rgba(0,0,0,0.9), 0 0 40px rgba(0,212,255,0.05)',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(0,212,255,0.1)' }}>
            <span style={{ fontSize: 9, letterSpacing: '0.2em', color: '#2a5870' }}>SOUNDBOARD</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setShowAdd(s => !s)}
                title="Add custom sound"
                style={{ background: 'none', border: 'none', color: showAdd ? '#00d4ff' : '#2a5870', cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#2a5870', cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Add custom sound UI */}
          {showAdd && (
            <div style={{ marginBottom: 8, padding: '8px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 3 }}>
              <div style={{ fontSize: 9, color: '#2a5870', letterSpacing: '0.1em', marginBottom: 4 }}>ADD SOUND (MP3/WAV, max 3MB)</div>
              <input
                placeholder="Sound name (optional)"
                value={addingName}
                onChange={e => setAddingName(e.target.value)}
                style={{ width: '100%', background: '#0b1820', border: '1px solid rgba(0,212,255,0.15)', color: '#9ecfdf', padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none', borderRadius: 2, marginBottom: 4, boxSizing: 'border-box' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', padding: '5px 0', fontSize: 10, fontFamily: 'inherit', letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 2 }}
              >
                CHOOSE FILE
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAddFile} />
            </div>
          )}

          {/* Built-in sounds */}
          <div style={{ fontSize: 9, color: '#1e3d50', letterSpacing: '0.1em', marginBottom: 4 }}>BUILT-IN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: serverSounds.length ? 8 : 0 }}>
            {SOUNDS.map(sound => (
              <button
                key={sound.id}
                onClick={() => handlePlay(sound.id)}
                style={{
                  background: 'rgba(0,212,255,0.04)',
                  border: `1px solid ${sound.color}30`,
                  color: sound.color,
                  padding: '6px 4px',
                  fontSize: 10,
                  fontFamily: 'inherit',
                  letterSpacing: '0.05em',
                  borderRadius: 3,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${sound.color}18`; e.currentTarget.style.boxShadow = `0 0 8px ${sound.color}40`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.04)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {sound.label}
              </button>
            ))}
          </div>

          {/* Server custom sounds */}
          {serverSounds.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: '#1e3d50', letterSpacing: '0.1em', marginBottom: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,212,255,0.08)' }}>CUSTOM</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {serverSounds.map(sound => (
                  <div key={sound.id} style={{ position: 'relative' }}>
                    <button
                      onClick={() => handlePlayCustom(sound)}
                      style={{
                        width: '100%',
                        background: 'rgba(0,255,136,0.04)',
                        border: '1px solid rgba(0,255,136,0.2)',
                        color: '#00ff88',
                        padding: '6px 20px 6px 4px',
                        fontSize: 10,
                        fontFamily: 'inherit',
                        borderRadius: 3,
                        cursor: 'pointer',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,136,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; }}
                      title={`${sound.label} · uploaded by ${sound.uploader_name}`}
                    >
                      🎵 {sound.label}
                    </button>
                    <button
                      onClick={() => deleteSound(sound.id)}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', color: '#2a5870', cursor: 'pointer', padding: 2, display: 'flex' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff3c00'}
                      onMouseLeave={e => e.currentTarget.style.color = '#2a5870'}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
