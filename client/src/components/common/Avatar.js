import React from 'react';

const COLORS = [
  '#5865f2', '#eb459e', '#ed4245', '#fee75c', '#57f287',
  '#3ba55d', '#faa61a', '#00b0f4', '#9b59b6', '#e67e22',
];

function getColor(userId) {
  if (!userId) return COLORS[0];
  const num = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLORS[num % COLORS.length];
}

function getInitials(user) {
  const name = user?.display_name || user?.username || '?';
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({ user, size = 40, className = '' }) {
  const sizeClass = `w-[${size}px] h-[${size}px]`;
  const style = { width: size, height: size, minWidth: size, minHeight: size };

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.username}
        style={style}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ ...style, backgroundColor: getColor(user?.id), fontSize: size * 0.4 }}
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none ${className}`}
    >
      {getInitials(user)}
    </div>
  );
}
