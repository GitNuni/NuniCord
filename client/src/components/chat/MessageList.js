import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useMessageStore } from '../../store/messages';
import Message from './Message';
import TypingIndicator from './TypingIndicator';

export default function MessageList({ channelId, onReply, currentUser }) {
  const { getChannel, fetchMessages } = useMessageStore();
  const channelData = getChannel(channelId);
  const { messages, loading, hasMore } = channelData;
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevChannelRef = useRef(null);

  // Scroll to bottom immediately when channel changes
  useEffect(() => {
    if (prevChannelRef.current !== channelId) {
      prevChannelRef.current = channelId;
      isAtBottomRef.current = true;
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
    }
  });

  // Auto-scroll when new messages arrive and user is at bottom
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;

    // Load more messages when near top
    if (scrollTop < 200 && hasMore && !loading && messages.length > 0) {
      const oldScrollHeight = container.scrollHeight;
      fetchMessages(channelId, messages[0]?.id).then(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop =
              containerRef.current.scrollHeight - oldScrollHeight;
          }
        });
      });
    }
  }, [channelId, hasMore, loading, messages, fetchMessages]);

  const groupedMessages = groupMessages(messages);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto min-h-0"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div className="flex flex-col min-h-full justify-end px-0 py-4">
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-nc-text-muted">
            Loading messages...
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <ChannelWelcome channelId={channelId} />
        )}

        {loading && messages.length > 0 && (
          <div className="flex items-center justify-center py-4 text-nc-text-muted text-sm">
            Loading older messages...
          </div>
        )}

        {groupedMessages.map((group, idx) => (
          <MessageGroup
            key={group[0].id}
            messages={group}
            onReply={onReply}
            currentUser={currentUser}
            isFirst={idx === 0}
          />
        ))}

        <TypingIndicator channelId={channelId} />
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function groupMessages(messages) {
  if (messages.length === 0) return [];

  const groups = [];
  let currentGroup = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    const timeDiff = new Date(curr.created_at) - new Date(prev.created_at);
    const sameAuthor = curr.author?.id === prev.author?.id;
    const closeInTime = timeDiff < 5 * 60 * 1000;
    const noReply = !curr.reply_to;

    if (sameAuthor && closeInTime && noReply) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);
  return groups;
}

function MessageGroup({ messages, onReply, currentUser, isFirst }) {
  return (
    <div className="message-group">
      {messages.map((msg, idx) => (
        <Message
          key={msg.id}
          message={msg}
          isFirst={idx === 0}
          onReply={onReply}
          currentUser={currentUser}
        />
      ))}
    </div>
  );
}

function ChannelWelcome({ channelId }) {
  return (
    <div className="px-4 pb-4 pt-8 border-b border-nc-divider/30 mb-4">
      <div className="w-16 h-16 bg-nc-bg-secondary rounded-full flex items-center justify-center mb-4">
        <span className="text-3xl">#</span>
      </div>
      <h3 className="text-2xl font-bold text-nc-header-primary mb-2">
        Welcome to the beginning!
      </h3>
      <p className="text-nc-text-muted text-sm">
        This is the start of this channel's history.
      </p>
    </div>
  );
}
