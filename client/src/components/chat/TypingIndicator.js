import React from 'react';
import { useMessageStore } from '../../store/messages';

export default function TypingIndicator({ channelId }) {
  const { typingUsers } = useMessageStore();
  const typing = Object.values(typingUsers[channelId] || {});

  if (typing.length === 0) return <div className="h-6" />;

  let text;
  if (typing.length === 1) text = `${typing[0].username} is typing...`;
  else if (typing.length === 2) text = `${typing[0].username} and ${typing[1].username} are typing...`;
  else text = 'Several people are typing...';

  return (
    <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-nc-text-muted h-6">
      <div className="flex gap-0.5 items-end">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span>{text}</span>
    </div>
  );
}
