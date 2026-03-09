import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useMessageStore } from '../../store/messages';
import Message from './Message';
import TypingIndicator from './TypingIndicator';

export default function MessageList({ channelId, onReply, currentUser }) {
  const { getChannel, fetchMessages } = useMessageStore();
  const channelData = getChannel(channelId);
  const { messages, loading, hasMore } = channelData;
  const bottomRef = useRef(null);
  const topRef = useRef(null);
  const containerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [prevMessageCount, setPrevMessageCount] = useState(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom && messages.length > prevMessageCount) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    setPrevMessageCount(messages.length);
  }, [messages.length]);

  // Scroll to bottom when channel changes
  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      setIsAtBottom(true);
    }, 50);
  }, [channelId]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100);

    // Load more messages when near top
    if (scrollTop < 200 && hasMore && !loading && messages.length > 0) {
      const oldScrollHeight = container.scrollHeight;
      fetchMessages(channelId, messages[0]?.id).then(() => {
        // Maintain scroll position
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight - oldScrollHeight;
          }
        });
      });
    }
  }, [channelId, hasMore, loading, messages, fetchMessages]);

  // Group consecutive messages from same author
  const groupedMessages = groupMessages(messages);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto flex flex-col-reverse"
    >
      <div ref={bottomRef} />

      <TypingIndicator channelId={channelId} />

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
    const closeInTime = timeDiff < 5 * 60 * 1000; // 5 minutes
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
