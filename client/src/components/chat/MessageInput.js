import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Smile, X, Image, SendHorizonal } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { sendMessage, startTyping, stopTyping } from '../../services/socket';
import { useAuthStore } from '../../store/auth';
import { useServerStore } from '../../store/servers';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import Soundboard from '../voice/Soundboard';
import api from '../../services/api';
import { toast } from '../../store/ui';
import Avatar from '../common/Avatar';

const MAX_FILE_SIZE = parseInt(process.env.REACT_APP_MAX_FILE_SIZE_MB || '100') * 1024 * 1024;

export default function MessageInput({ channelId, channelData, replyTo, onCancelReply }) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mentionState, setMentionState] = useState(null); // { query, startIdx }
  const [allMembers, setAllMembers] = useState(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const containerRef = useRef(null);
  const membersLoadedRef = useRef(false);
  const { user } = useAuthStore();
  const { activeServerId } = useServerStore();

  const mentionMatches = mentionState && allMembers
    ? allMembers.filter(m => {
        const name = (m.display_name || m.username || '').toLowerCase();
        return name.includes(mentionState.query.toLowerCase());
      }).slice(0, 8)
    : [];

  async function loadMembers() {
    if (membersLoadedRef.current || !activeServerId) return;
    membersLoadedRef.current = true;
    try {
      const { data } = await api.get(`/servers/${activeServerId}/members`);
      setAllMembers(Array.isArray(data) ? data : []);
    } catch { setAllMembers([]); }
  }

  function insertMention(member) {
    if (!mentionState || !textareaRef.current) return;
    const { startIdx } = mentionState;
    const cursor = textareaRef.current.selectionStart;
    const newContent = content.slice(0, startIdx) + `<@${member.user_id}>` + content.slice(cursor);
    setContent(newContent);
    setMentionState(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    const oversized = acceptedFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast(`Files too large: ${oversized.map(f => f.name).join(', ')}`, 'error');
      return;
    }
    setFiles(prev => [...prev, ...acceptedFiles].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop, noClick: true, noKeyboard: true, maxSize: MAX_FILE_SIZE,
  });

  function handleTyping() {
    if (!isTypingRef.current) { startTyping(channelId); isTypingRef.current = true; }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(channelId); isTypingRef.current = false;
    }, 3000);
  }

  async function handleSubmit(customContent) {
    const trimmed = (customContent ?? content).trim();
    if (!trimmed && files.length === 0) return;
    if (!channelId) return;

    clearTimeout(typingTimeoutRef.current);
    stopTyping(channelId);
    isTypingRef.current = false;

    let attachments = [];
    if (files.length > 0) {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        const { data } = await api.post('/uploads/attachments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          },
        });
        attachments = data.attachments;
      } catch {
        toast('Failed to upload files', 'error');
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }
      setIsUploading(false);
      setUploadProgress(0);
    }

    sendMessage(channelId, trimmed, replyTo?.id || null, attachments);
    setContent('');
    setFiles([]);
    onCancelReply?.();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e) {
    if (mentionState && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(0, i - 1)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); insertMention(mentionMatches[mentionIdx]); return; }
      if (e.key === 'Escape') { setMentionState(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  function handleChange(e) {
    const val = e.target.value;
    setContent(val);
    handleTyping();
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 350) + 'px';

    // @mention detection
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      setMentionState({ query: atMatch[1], startIdx: cursor - atMatch[1].length - 1 });
      setMentionIdx(0);
      loadMembers();
    } else {
      setMentionState(null);
    }
  }

  function insertEmoji(emoji) {
    const str = emoji.native || emoji;
    setContent(prev => prev + str);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  function insertGif(url) {
    // Send gif as a message with the URL wrapped in a special format
    handleSubmit(url);
    setShowGif(false);
  }

  const channelName = channelData?.name || 'channel';

  return (
    <div
      ref={containerRef}
      style={{ padding: '8px 16px 14px', flexShrink: 0, position: 'relative' }}
    >
      {/* Reply preview */}
      {replyTo && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: '#040a0f',
            border: '1px solid rgba(0,212,255,0.15)',
            borderBottom: 'none',
            fontSize: 12,
            color: '#5a8fa8',
          }}
        >
          <span>REPLYING TO</span>
          <span style={{ color: '#00d4ff' }}>
            {replyTo.author?.display_name || replyTo.author?.username}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {replyTo.content?.slice(0, 80)}
          </span>
          <button
            onClick={onCancelReply}
            style={{ background: 'none', border: 'none', color: '#2e5568', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ff3c00'}
            onMouseLeave={e => e.currentTarget.style.color = '#2e5568'}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* File preview */}
      {files.length > 0 && (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            padding: '8px 12px',
            background: '#040a0f',
            border: '1px solid rgba(0,212,255,0.15)',
            borderBottom: 'none',
          }}
        >
          {files.map((file, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  style={{ width: 80, height: 80, objectFit: 'cover', border: '1px solid rgba(0,212,255,0.2)' }}
                />
              ) : (
                <div style={{
                  width: 80, height: 80,
                  background: '#0b1820',
                  border: '1px solid rgba(0,212,255,0.15)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: 4, fontSize: 11, color: '#5a8fa8',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: 24 }}>📎</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{file.name}</span>
                </div>
              )}
              <button
                onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 16, height: 16,
                  background: '#ff3c00',
                  border: 'none', color: '#fff',
                  cursor: 'pointer', fontSize: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Main input row */}
      <div
        {...getRootProps()}
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: '#0b1820',
          border: `1px solid ${isDragActive ? '#00d4ff' : 'rgba(0,212,255,0.15)'}`,
          borderStyle: isDragActive ? 'dashed' : 'solid',
          boxShadow: isDragActive ? '0 0 16px rgba(0,212,255,0.3)' : 'none',
          padding: '8px 12px',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          position: 'relative',
        }}
      >
        <input {...getInputProps()} />

        {/* Attach */}
        <IconBtn onClick={openFileDialog} title="Attach file" disabled={isUploading}>
          <Plus size={18} />
        </IconBtn>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={e => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItems = items.filter(item => item.type.startsWith('image/'));
            if (imageItems.length > 0) {
              e.preventDefault();
              const pastedFiles = imageItems.map(item => item.getAsFile()).filter(Boolean);
              setFiles(prev => [...prev, ...pastedFiles].slice(0, 10));
            }
          }}
          placeholder={`// MSG #${channelName}`}
          rows={1}
          disabled={isUploading}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#9ecfdf',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'none',
            maxHeight: 350,
            lineHeight: 1.5,
            padding: '2px 0',
          }}
        />

        {/* Soundboard */}
        <Soundboard inChat />

        {/* GIF button */}
        <IconBtn
          onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
          title="GIF"
          active={showGif}
        >
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '-0.05em' }}>GIF</span>
        </IconBtn>

        {/* Emoji button */}
        <IconBtn
          onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
          title="Emoji"
          active={showEmoji}
        >
          <Smile size={18} />
        </IconBtn>

        {/* Send button */}
        <IconBtn
          onClick={() => handleSubmit()}
          title="Send"
          active={!!(content.trim() || files.length > 0) && !isUploading}
          disabled={(!content.trim() && files.length === 0) || isUploading}
        >
          <SendHorizonal size={18} />
        </IconBtn>

        {/* Upload progress bar */}
        {isUploading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <div style={{ height: 3, background: 'rgba(0,212,255,0.15)', position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
                transition: 'width 0.15s ease',
                boxShadow: '0 0 8px rgba(0,212,255,0.6)',
              }} />
            </div>
            <div style={{
              position: 'absolute', right: 8, top: 4,
              fontSize: 10, color: '#00d4ff', letterSpacing: '0.1em',
            }}>
              UPLOADING {uploadProgress}%
            </div>
          </div>
        )}
      </div>

      {/* Drag overlay */}
      {isDragActive && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(7,13,18,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, pointerEvents: 'none',
          border: '2px dashed #00d4ff',
        }}>
          <div style={{ textAlign: 'center', color: '#00d4ff' }}>
            <Image size={32} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Drop to attach
            </div>
          </div>
        </div>
      )}

      {/* @mention dropdown */}
      {mentionState && mentionMatches.length > 0 && (
        <div className="mention-dropdown">
          {mentionMatches.map((member, i) => (
            <div
              key={member.user_id}
              className={`mention-dropdown-item${i === mentionIdx ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); insertMention(member); }}
            >
              <Avatar user={{ id: member.user_id, username: member.username, avatar_url: member.avatar_url }} size={24} />
              <span style={{ fontWeight: 600 }}>{member.display_name || member.username}</span>
              {member.display_name && <span style={{ opacity: 0.6, fontSize: 12 }}>@{member.username}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div style={{ position: 'absolute', bottom: '100%', right: 16, zIndex: 200, marginBottom: 4 }}>
          <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
        </div>
      )}

      {/* GIF picker */}
      {showGif && (
        <GifPicker onSelect={insertGif} onClose={() => setShowGif(false)} />
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, active, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        color: disabled ? '#142030' : active ? '#00d4ff' : '#2a5870',
        cursor: disabled ? 'default' : 'pointer',
        padding: '2px 4px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'color 0.15s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#00d4ff'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = active ? '#00d4ff' : '#2a5870'; }}
    >
      {children}
    </button>
  );
}
