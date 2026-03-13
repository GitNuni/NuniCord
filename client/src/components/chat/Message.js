import React, { useState, useRef, useEffect, memo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Reply, MoreHorizontal, Pencil, Trash2, Pin, Smile, X, ChevronLeft, ChevronRight } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import Avatar from '../common/Avatar';
import EmojiPicker from './EmojiPicker';
import Portal from '../common/Portal';
import UserProfileModal from '../common/UserProfileModal';
import { useAuthStore } from '../../store/auth';
import { useMessageStore } from '../../store/messages';
import { getSocket } from '../../services/socket';
import api from '../../services/api';

marked.setOptions({
  breaks: true,
  gfm: true,
});

// Module-level cache for resolving mention usernames
const userNameCache = {};
export function cacheUserName(userId, name) {
  if (userId && name) userNameCache[userId] = name;
}

function formatDate(date) {
  const d = new Date(date);
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  return format(d, 'MM/dd/yyyy h:mm a');
}

function renderMarkdown(content, currentUserId) {
  // Convert Discord-like formatting
  let text = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^> (.+)/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br>')
    .replace(/<@([a-f0-9-]{36})>/g, (_, userId) => {
      const name = userNameCache[userId] || userId.slice(0, 6) + '…';
      const isMe = userId === currentUserId;
      return `<span class="mention${isMe ? ' mention-me' : ''}">@${name}</span>`;
    });

  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'pre', 'blockquote', 'br', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'class', 'data-user-id'],
  });
}

const Message = memo(function Message({ message, isFirst, onReply, currentUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const messageRef = useRef(null);
  const editRef = useRef(null);
  const { user } = useAuthStore();
  const { updateMessage, deleteMessage } = useMessageStore();
  const socket = getSocket();

  const isOwn = message.author?.id === user?.id;
  const showFullHeader = isFirst || !!message.reply_to;

  // Populate username cache so mentions in this message can resolve
  if (message.author?.id) {
    cacheUserName(message.author.id, message.author.display_name || message.author.username);
  }

  // Close edit box when clicking/tapping outside it
  useEffect(() => {
    if (!isEditing) return;
    function handleClickOutside(e) {
      if (editRef.current && !editRef.current.contains(e.target)) {
        setIsEditing(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isEditing]);

  // Close actions when clicking outside the message row
  useEffect(() => {
    if (!showActions) return;
    function handleClickOutside(e) {
      if (messageRef.current && !messageRef.current.contains(e.target)) {
        setShowActions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showActions]);

  function handleEdit() {
    if (!editContent.trim()) return;
    socket?.emit('MESSAGE_UPDATE', { message_id: message.id, content: editContent.trim() });
    setIsEditing(false);
  }

  function handleDelete() {
    if (window.confirm('Delete this message?')) {
      socket?.emit('MESSAGE_DELETE', { message_id: message.id });
    }
  }

  function handleReact(emoji) {
    const hasReacted = message.reaction_counts?.find(r => r.emoji === emoji && r.me);
    if (hasReacted) {
      socket?.emit('REACTION_REMOVE', { message_id: message.id, emoji });
    } else {
      socket?.emit('REACTION_ADD', { message_id: message.id, emoji });
    }
    setShowEmojiPicker(false);
  }

  // System join announcement
  if (message.type === 'member_join') {
    return (
      <div className="flex items-center gap-3 px-4 py-1.5 text-sm text-nc-text-muted">
        <Avatar user={message.author} size={24} />
        <span dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '', user?.id) }} />
        <span className="text-xs opacity-60 ml-auto flex-shrink-0">{formatDate(message.created_at)}</span>
      </div>
    );
  }

  return (
    <div
      ref={messageRef}
      className="message-hover group relative flex gap-4 px-4 py-0.5 hover:bg-nc-bg-modifier-hover/30 transition-colors"
      onTouchEnd={e => {
        // On touch: tap message body (not interactive elements) toggles action bar
        if (!e.target.closest('a, button, textarea, input')) {
          setShowActions(prev => !prev);
        }
      }}
    >
      {/* Avatar or spacer */}
      <div className="flex-shrink-0 w-10">
        {showFullHeader ? (
          <button
            onClick={e => { setProfileUser(message.author); setProfileAnchor(e.currentTarget); }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <Avatar user={message.author} size={40} className="mt-0.5" />
          </button>
        ) : (
          <span className="opacity-0 group-hover:opacity-100 text-xxs text-nc-text-muted leading-none pt-1 select-none block text-right">
            {format(new Date(message.created_at), 'h:mm')}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Reply preview */}
        {message.reply_to && (
          <div className="flex items-center gap-1 text-xs text-nc-text-muted mb-1">
            <div className="w-4 h-2 border-t-2 border-l-2 border-nc-interactive-muted rounded-tl ml-2" />
            <Avatar user={message.reply_to.author} size={16} />
            <span className="font-medium text-nc-interactive-normal">
              {message.reply_to.author?.display_name || message.reply_to.author?.username}
            </span>
            <span className="truncate max-w-xs">{message.reply_to.content}</span>
          </div>
        )}

        {/* Header */}
        {showFullHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <button
              onClick={e => { setProfileUser(message.author); setProfileAnchor(e.currentTarget); }}
              className="font-medium text-nc-header-primary hover:underline"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {message.author?.display_name || message.author?.username}
            </button>
            {message.author?.is_bot && (
              <span className="text-xxs bg-nc-brand text-white px-1 py-0.5 rounded font-bold">BOT</span>
            )}
            <span className="text-xxs text-nc-text-muted">
              {formatDate(message.created_at)}
            </span>
            {message.edited_at && (
              <span className="text-xxs text-nc-text-muted italic">(edited)</span>
            )}
          </div>
        )}

        {/* Message body */}
        {isEditing ? (
          <div className="mt-1" ref={editRef}>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-full nc-input text-sm resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-1 text-xs text-nc-text-muted">
              <button className="text-nc-brand hover:underline" onClick={handleEdit}>Save</button>
              <span>•</span>
              <button className="hover:underline" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          message.content && (
            <div
              className="message-content text-nc-text-normal text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content, user?.id) }}
            />
          )
        )}

        {/* Attachments */}
        {message.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att, idx) => (
              <Attachment key={idx} attachment={att} />
            ))}
          </div>
        )}

        {/* Embeds */}
        {message.embeds?.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.embeds.map((embed, idx) => (
              <Embed key={idx} embed={embed} />
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reaction_counts?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reaction_counts.map(reaction => (
              <button
                key={reaction.emoji}
                onClick={() => handleReact(reaction.emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors ${
                  reaction.me
                    ? 'bg-nc-brand/20 border-nc-brand text-nc-brand'
                    : 'bg-nc-bg-secondary border-nc-divider text-nc-text-normal hover:bg-nc-bg-modifier-hover'
                }`}
              >
                <span>{reaction.emoji}</span>
                <span className="text-xs">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Three-dots action trigger */}
      <div className={`message-actions absolute right-2 top-0 -translate-y-1/2${showActions ? ' force-show' : ''}`}>
        <button
          className="p-1.5 bg-nc-bg-secondary border border-nc-divider rounded shadow-lg text-nc-interactive-normal hover:text-nc-interactive-hover transition-colors"
          onClick={() => setShowActions(prev => !prev)}
          title="More options"
        >
          <MoreHorizontal size={16} />
        </button>
        {showActions && (
          <div className="absolute right-0 top-full mt-1 bg-nc-bg-floating border border-nc-divider rounded shadow-xl z-50 py-1 min-w-[140px]">
            <DropdownItem icon={<Smile size={14} />} label="Add Reaction" onClick={() => { setShowEmojiPicker(true); setShowActions(false); }} />
            <DropdownItem icon={<Reply size={14} />} label="Reply" onClick={() => { onReply(message); setShowActions(false); }} />
            {isOwn && <DropdownItem icon={<Pencil size={14} />} label="Edit Message" onClick={() => { setIsEditing(true); setShowActions(false); }} />}
            {isOwn && <DropdownItem icon={<Trash2 size={14} />} label="Delete Message" onClick={() => { handleDelete(); setShowActions(false); }} danger />}
          </div>
        )}
      </div>

      {showEmojiPicker && (
        <div className="absolute right-4 top-8 z-50">
          <EmojiPicker onSelect={handleReact} onClose={() => setShowEmojiPicker(false)} />
        </div>
      )}

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          anchorEl={profileAnchor}
          onClose={() => { setProfileUser(null); setProfileAnchor(null); }}
        />
      )}
    </div>
  );
});

function ActionButton({ icon, tooltip, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-1.5 hover:bg-nc-bg-modifier-hover transition-colors first:rounded-l last:rounded-r ${
        danger ? 'text-nc-red hover:text-red-400' : 'text-nc-interactive-normal hover:text-nc-interactive-hover'
      }`}
    >
      {icon}
    </button>
  );
}

function DropdownItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors text-left ${
        danger
          ? 'text-nc-red hover:bg-nc-red/10'
          : 'text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Attachment({ attachment }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImage = attachment.content_type?.startsWith('image/');

  if (isImage) {
    return (
      <>
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="max-w-xs max-h-72 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setLightboxOpen(true)}
        />
        {lightboxOpen && (
          <Portal>
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.9)' }}
              onClick={() => setLightboxOpen(false)}
            >
              <button
                onClick={() => setLightboxOpen(false)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', borderRadius: 4, padding: 8, cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
              <img
                src={attachment.url}
                alt={attachment.filename}
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </Portal>
        )}
      </>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-3 bg-nc-bg-secondary rounded border border-nc-divider hover:border-nc-interactive-normal transition-colors"
    >
      <span className="text-nc-text-muted">📎</span>
      <div>
        <div className="text-sm text-nc-brand">{attachment.filename}</div>
        <div className="text-xs text-nc-text-muted">{formatFileSize(attachment.size)}</div>
      </div>
    </a>
  );
}

function Embed({ embed }) {
  if (!embed.title && !embed.description) return null;

  return (
    <div
      className="border-l-4 bg-nc-bg-secondary rounded p-3 max-w-lg"
      style={{ borderColor: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#4f545c' }}
    >
      {embed.author && (
        <div className="text-xs text-nc-text-muted mb-1">{embed.author.name}</div>
      )}
      {embed.title && (
        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-nc-brand font-medium text-sm hover:underline block mb-1"
        >
          {embed.title}
        </a>
      )}
      {embed.description && (
        <p className="text-nc-text-normal text-sm">{embed.description}</p>
      )}
      {embed.image && (
        <img src={embed.image.url} alt="" className="mt-2 rounded max-w-full max-h-48 object-cover" />
      )}
      {embed.footer && (
        <div className="text-xs text-nc-text-muted mt-2">{embed.footer.text}</div>
      )}
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default Message;
