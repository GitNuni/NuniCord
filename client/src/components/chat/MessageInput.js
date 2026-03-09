import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Gift, Sticker, Smile, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { sendMessage, startTyping, stopTyping } from '../../services/socket';
import { useAuthStore } from '../../store/auth';
import EmojiPicker from './EmojiPicker';
import api from '../../services/api';
import { toast } from '../../store/ui';
import Avatar from '../common/Avatar';

const MAX_FILE_SIZE = parseInt(process.env.REACT_APP_MAX_FILE_SIZE_MB || '100') * 1024 * 1024;

export default function MessageInput({ channelId, channelData, replyTo, onCancelReply }) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const { user } = useAuthStore();

  const onDrop = useCallback(async (acceptedFiles) => {
    const oversized = acceptedFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast(`Files too large: ${oversized.map(f => f.name).join(', ')}`, 'error');
      return;
    }
    setFiles(prev => [...prev, ...acceptedFiles].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    maxSize: MAX_FILE_SIZE,
  });

  function handleTyping() {
    if (!isTypingRef.current) {
      startTyping(channelId);
      isTypingRef.current = true;
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(channelId);
      isTypingRef.current = false;
    }, 3000);
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed && files.length === 0) return;
    if (!channelId) return;

    clearTimeout(typingTimeoutRef.current);
    stopTyping(channelId);
    isTypingRef.current = false;

    let attachments = [];

    if (files.length > 0) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        const { data } = await api.post('/uploads/attachments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        attachments = data.attachments;
      } catch (err) {
        toast('Failed to upload files', 'error');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    sendMessage(channelId, trimmed, replyTo?.id || null, attachments);
    setContent('');
    setFiles([]);
    onCancelReply?.();

    // Resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleChange(e) {
    setContent(e.target.value);
    handleTyping();

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
  }

  function insertEmoji(emoji) {
    const str = emoji.native || emoji;
    setContent(prev => prev + str);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  const channelName = channelData?.name || 'this channel';

  return (
    <div className="px-4 pb-4 flex-shrink-0">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-nc-bg-secondary/50 rounded-t-lg border border-b-0 border-nc-divider text-sm">
          <span className="text-nc-text-muted">Replying to</span>
          <span className="font-medium text-nc-interactive-normal">
            {replyTo.author?.display_name || replyTo.author?.username}
          </span>
          <span className="text-nc-text-muted truncate flex-1">
            {replyTo.content?.slice(0, 100)}
          </span>
          <button onClick={onCancelReply} className="text-nc-text-muted hover:text-nc-interactive-hover ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* File preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2 bg-nc-bg-secondary/50 rounded-t-lg border border-b-0 border-nc-divider">
          {files.map((file, idx) => (
            <div key={idx} className="relative group">
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-24 h-24 object-cover rounded"
                />
              ) : (
                <div className="w-24 h-24 bg-nc-bg-tertiary rounded flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-2xl">📎</span>
                  <span className="text-xs text-nc-text-muted truncate w-full">{file.name}</span>
                </div>
              )}
              <button
                onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1 -right-1 w-5 h-5 bg-nc-bg-floating rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        {...getRootProps()}
        className={`flex items-end gap-2 bg-nc-bg-secondary rounded-lg px-3 py-2 border ${
          isDragActive ? 'border-nc-brand border-dashed' : 'border-transparent'
        }`}
      >
        <input {...getInputProps()} />

        <button
          onClick={openFileDialog}
          className="flex-shrink-0 p-1 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover transition-colors"
          title="Attach File"
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${channelData?.type === 'dm' ? '' : '#'}${channelName}`}
          rows={1}
          className="flex-1 bg-transparent text-nc-text-normal placeholder-nc-text-muted text-sm outline-none resize-none max-h-96 leading-relaxed py-1"
          disabled={isUploading}
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-1 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover transition-colors"
            title="Emoji"
          >
            <Smile size={20} />
          </button>
        </div>
      </div>

      {isDragActive && (
        <div className="absolute inset-0 bg-nc-bg-primary/90 flex items-center justify-center z-50 text-nc-brand text-xl font-semibold pointer-events-none">
          Drop files to upload
        </div>
      )}

      {showEmoji && (
        <div className="absolute bottom-20 right-4 z-50">
          <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
        </div>
      )}
    </div>
  );
}
