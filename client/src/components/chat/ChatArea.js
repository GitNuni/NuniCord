import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, AtSign, Pin, Users, Bell, Search, Volume2, Inbox, HelpCircle } from 'lucide-react';
import { useMessageStore } from '../../store/messages';
import { useUIStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VoiceChannel from '../voice/VoiceChannel';
import api from '../../services/api';
import Tooltip from '../common/Tooltip';

export default function ChatArea({ serverId, serverData, isDM }) {
  const { channelId } = useParams();
  const { user } = useAuthStore();
  const { fetchMessages, getChannel } = useMessageStore();
  const { toggleMemberList } = useUIStore();
  const [channelData, setChannelData] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    if (!channelId) return;

    // Fetch channel info
    api.get(`/channels/${channelId}`)
      .then(r => setChannelData(r.data))
      .catch(() => {});

    // Mark as read
    api.put(`/channels/${channelId}/read`).catch(() => {});
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    const ch = getChannel(channelId);
    if (ch.messages.length === 0) {
      fetchMessages(channelId);
    }
  }, [channelId, fetchMessages, getChannel]);

  if (!channelId) return null;

  const isVoice = channelData?.type === 'voice';

  if (isVoice) {
    return <VoiceChannel channelId={channelId} channelData={channelData} serverId={serverId} />;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-nc-bg-primary">
      {/* Channel header */}
      <ChannelHeader
        channelData={channelData}
        isDM={isDM}
        onToggleMemberList={toggleMemberList}
      />

      {/* Messages */}
      <MessageList
        channelId={channelId}
        onReply={setReplyTo}
        currentUser={user}
      />

      {/* Message input */}
      <MessageInput
        channelId={channelId}
        channelData={channelData}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}

function ChannelHeader({ channelData, isDM, onToggleMemberList }) {
  const [searchOpen, setSearchOpen] = useState(false);

  if (!channelData) return (
    <div className="h-12 border-b border-black/30 bg-nc-bg-primary flex items-center px-4">
      <div className="w-32 h-4 bg-nc-bg-secondary rounded animate-pulse" />
    </div>
  );

  const Icon = channelData.type === 'voice' ? Volume2 :
    isDM ? AtSign : Hash;

  return (
    <div className="flex items-center justify-between h-12 border-b border-black/30 bg-nc-bg-primary px-4 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-nc-channel-icon flex-shrink-0" />
        <span className="font-semibold text-nc-header-primary">
          {channelData.name || 'Direct Message'}
        </span>
        {channelData.topic && (
          <>
            <div className="w-px h-5 bg-nc-divider mx-1" />
            <span className="text-sm text-nc-text-muted truncate max-w-xs" title={channelData.topic}>
              {channelData.topic}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip content="Pinned Messages" side="bottom">
          <button className="p-1.5 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover">
            <Pin size={20} />
          </button>
        </Tooltip>

        {!isDM && (
          <Tooltip content="Toggle Member List" side="bottom">
            <button
              onClick={onToggleMemberList}
              className="p-1.5 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover"
            >
              <Users size={20} />
            </button>
          </Tooltip>
        )}

        <Tooltip content="Search Messages" side="bottom">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-1.5 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover"
          >
            <Search size={20} />
          </button>
        </Tooltip>

        <Tooltip content="Notification Settings" side="bottom">
          <button className="p-1.5 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover">
            <Bell size={20} />
          </button>
        </Tooltip>

        <Tooltip content="Inbox" side="bottom">
          <button className="p-1.5 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover">
            <Inbox size={20} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
