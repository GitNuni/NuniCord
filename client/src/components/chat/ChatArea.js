import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, AtSign, Pin, Users, Bell, Search, Volume2, Inbox, Menu } from 'lucide-react';
import { useMessageStore } from '../../store/messages';
import { useUIStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VoiceChannel from '../voice/VoiceChannel';
import VoiceBar from '../voice/VoiceBar';
import api from '../../services/api';
import Tooltip from '../common/Tooltip';

export default function ChatArea({ serverId, serverData, isDM }) {
  const { channelId } = useParams();
  const { user } = useAuthStore();
  const { fetchMessages, getChannel } = useMessageStore();
  const { toggleMemberList, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const [channelData, setChannelData] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    if (!channelId) return;
    api.get(`/channels/${channelId}`).then(r => setChannelData(r.data)).catch(() => {});
    api.put(`/channels/${channelId}/read`).catch(() => {});
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    const ch = getChannel(channelId);
    if (ch.messages.length === 0) fetchMessages(channelId);
  }, [channelId, fetchMessages, getChannel]);

  if (!channelId) return null;

  // Pure voice channels get the full voice view
  if (channelData?.type === 'voice') {
    return <VoiceChannel channelId={channelId} channelData={channelData} serverId={serverId} />;
  }

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: 'var(--nc-bg-primary)' }}
      onClick={() => { if (mobileSidebarOpen) setMobileSidebarOpen(false); }}
    >
      {/* Top bar */}
      <ChannelHeader
        channelData={channelData}
        isDM={isDM}
        onToggleMemberList={toggleMemberList}
        mobileSidebarOpen={mobileSidebarOpen}
        onToggleSidebar={() => setMobileSidebarOpen(o => !o)}
      />

      {/* Voice bar — shows active voice channels in this server */}
      {!isDM && serverId && (
        <VoiceBar
          serverId={serverId}
          serverData={serverData}
        />
      )}

      {/* Messages */}
      <MessageList channelId={channelId} onReply={setReplyTo} currentUser={user} />

      {/* Input */}
      <MessageInput
        channelId={channelId}
        channelData={channelData}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}

function ChannelHeader({ channelData, isDM, onToggleMemberList, mobileSidebarOpen, onToggleSidebar }) {
  const [searchOpen, setSearchOpen] = useState(false);

  if (!channelData) return (
    <div
      className="flex items-center px-4"
      style={{
        height: 52,
        borderBottom: '1px solid rgba(var(--nc-divider-rgb), 0.4)',
        background: 'var(--nc-bg-secondary)',
      }}
    >
      <div style={{ width: 140, height: 14, background: 'var(--nc-bg-tertiary)', borderRadius: 7 }} />
    </div>
  );

  const Icon = channelData.type === 'voice' ? Volume2 : isDM ? AtSign : Hash;

  return (
    <div
      className="flex items-center justify-between flex-shrink-0 px-4"
      style={{
        height: 52,
        background: 'var(--nc-bg-secondary)',
        borderBottom: '1px solid rgba(var(--nc-divider-rgb), 0.4)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.15)',
      }}
    >
      <div className="flex items-center gap-2">
        {/* Mobile panel toggle */}
        <button
          onClick={e => { e.stopPropagation(); onToggleSidebar(); }}
          className="flex-shrink-0 md:hidden"
          style={{
            background: 'transparent', border: 'none',
            padding: '4px 6px 4px 0', cursor: 'pointer',
            color: mobileSidebarOpen ? 'var(--nc-interactive-active)' : 'var(--nc-interactive-normal)',
            transition: 'color 0.2s', display: 'flex', alignItems: 'center',
          }}
        >
          <Menu size={20} />
        </button>

        <Icon size={18} style={{ color: 'var(--nc-channel-icon)', flexShrink: 0 }} />
        <span className="font-semibold text-base" style={{ color: 'var(--nc-header-primary)' }}>
          {channelData.name || 'Direct Message'}
        </span>
        {channelData.topic && (
          <>
            <div style={{ width: 1, height: 16, background: 'rgba(var(--nc-divider-rgb), 0.5)' }} />
            <span
              className="text-xs truncate max-w-xs"
              style={{ color: 'var(--nc-text-muted)' }}
              title={channelData.topic}
            >
              {channelData.topic}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {[
          { Icon: Pin,    tip: 'Pinned' },
          !isDM && { Icon: Users,  tip: 'Members', fn: onToggleMemberList },
          { Icon: Search, tip: 'Search', fn: () => setSearchOpen(!searchOpen) },
          { Icon: Bell,   tip: 'Notifications' },
          { Icon: Inbox,  tip: 'Inbox' },
        ].filter(Boolean).map(({ Icon: I, tip, fn }) => (
          <Tooltip key={tip} content={tip} side="bottom">
            <button
              onClick={fn}
              className="p-1.5 rounded-lg transition-colors text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover/10"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <I size={18} />
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
