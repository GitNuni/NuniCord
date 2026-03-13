import React, { useState, useRef, useEffect } from 'react';
import { Music2, Plus, Trash2, X } from 'lucide-react';
import { SOUNDS, playSound } from '../../services/sounds';
import { getSocket } from '../../services/socket';
import { useVoiceStore } from '../../store/voice';

const STORAGE_KEY = 'nunicord_custom_sounds';

function loadCustomSounds() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveCustomSounds(sounds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sounds));
}

export default function Soundboard({ inChat = false }) {
  const [open, setOpen] = useState(false);
  const [customSounds, setCustomSounds] = useState(loadCustomSounds);
  const [addingName, setAddingName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const { activeChannelId } = useVoiceStore();
  const panelRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  function broadcast(soundId) {
    const socket = getSocket();
    if (socket && activeChannelId) {
      socket.emit('SOUNDBOARD_PLAY', { channel_id: activeChannelId, sound_id: soundId });
    }
  }

  function handlePlay(soundId) {
    playSound(soundId);
    broadcast(soundId);
  }

  function handlePlayCustom(sound) {
    try {
      const audio = new Audio(sound.url);
      audio.volume = 0.6;
      audio.play();
    } catch (e) {
      console.warn('Custom sound playback error:', e);
    }
  }

  function handleAddFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Sound file must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const name = addingName.trim() || file.name.replace(/\.[^.]+$/, '');
      const newSound = { id: Date.now().toString(), label: name, url: ev.target.result };
      const updated = [...customSounds, newSound];
      setCustomSounds(updated);
      saveCustomSounds(updated);
      setAddingName('');
      setShowAdd(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function deleteCustom(id) {
    const updated = customSounds.filter(s => s.id !== id);
    setCustomSounds(updated);
    saveCustomSounds(updated);
  }

  const btnStyle = inChat
    ? { color: '#2a5870', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }
    : {};

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
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

      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: inChat ? 0 : 'auto',
          left: inChat ? 'auto' : 0,
          marginBottom: 8,
          width: 240,
          background: '#040a0f',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 4,
          padding: 10,
          zIndex: 300,
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
              <div style={{ fontSize: 9, color: '#2a5870', letterSpacing: '0.1em', marginBottom: 4 }}>ADD SOUND (MP3/WAV, max 2MB)</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: customSounds.length ? 8 : 0 }}>
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

          {/* Custom sounds */}
          {customSounds.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: '#1e3d50', letterSpacing: '0.1em', marginBottom: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,212,255,0.08)' }}>CUSTOM</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {customSounds.map(sound => (
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
                      title={sound.label}
                    >
                      🎵 {sound.label}
                    </button>
                    <button
                      onClick={() => deleteCustom(sound.id)}
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
        </div>
      )}
    </div>
  );
}
