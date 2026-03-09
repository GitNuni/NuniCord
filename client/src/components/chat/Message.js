import React, { useState, memo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Reply, MoreHorizontal, Pencil, Trash2, Pin, Smile } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import Avatar from '../common/Avatar';
import EmojiPicker from './EmojiPicker';
import { useAuthStore } from '../../store/auth';
import { useMessageStore } from '../../store/messages';
import { getSocket } from '../../services/socket';
import api from '../../services/api';

marked.setOptions({
  breaks: true,
  gfm: true,
});

function formatDate(date) {
  const d = new Date(date);
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  return format(d, 'MM/dd/yyyy h:mm a');
}

function renderMarkdown(content) {
  // Convert Discord-like formatting
  let text = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^> (.+)/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br>');

  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'pre', 'blockquote', 'br', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'class'],
  });
}

const Message = memo(function Message({ message, isFirst, onReply, currentUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { user } = useAuthStore();
  const { updateMessage, deleteMessage } = useMessageStore();
  const socket = getSocket();

  const isOwn = message.author?.id === user?.id;
  const showFullHeader = isFirst || !!message.reply_to;

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

  return (
    <div className="message-hover group relative flex gap-4 px-4 py-0.5 hover:bg-nc-bg-modifier-hover/30 transition-colors">
      {/* Avatar or spacer */}
      <div className="flex-shrink-0 w-10">
        {showFullHeader ? (
          <Avatar user={message.author} size={40} className="mt-0.5 cursor-pointer" />
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
            <span className="font-medium text-nc-header-primary cursor-pointer hover:underline">
              {message.author?.display_name || message.author?.username}
            </span>
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
          <div className="mt-1">
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
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
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

      {/* Action bar on hover */}
      <div className="message-actions absolute right-4 top-0 -translate-y-1/2 bg-nc-bg-secondary border border-nc-divider rounded shadow-lg flex items-center">
        <ActionButton icon={<Smile size={16} />} tooltip="Add Reaction" onClick={() => setShowEmojiPicker(true)} />
        <ActionButton icon={<Reply size={16} />} tooltip="Reply" onClick={() => onReply(message)} />
        {isOwn && <ActionButton icon={<Pencil size={16} />} tooltip="Edit" onClick={() => setIsEditing(true)} />}
        {isOwn && <ActionButton icon={<Trash2 size={16} />} tooltip="Delete" onClick={handleDelete} danger />}
        <ActionButton icon={<MoreHorizontal size={16} />} tooltip="More" onClick={() => {}} />
      </div>

      {showEmojiPicker && (
        <div className="absolute right-4 top-8 z-50">
          <EmojiPicker onSelect={handleReact} onClose={() => setShowEmojiPicker(false)} />
        </div>
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

function Attachment({ attachment }) {
  const isImage = attachment.content_type?.startsWith('image/');

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="max-w-xs max-h-72 rounded object-cover cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
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
