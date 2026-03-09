import React from 'react';

export default function ServerIcon({ server, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`server-icon w-12 h-12 relative group ${isActive ? 'active' : ''} transition-all duration-200`}
      style={!server.icon_url ? { backgroundColor: isActive ? '#5865f2' : '#36393f' } : {}}
    >
      {server.icon_url ? (
        <img
          src={server.icon_url}
          alt={server.name}
          className="w-full h-full object-cover rounded-full group-hover:rounded-2xl transition-all duration-200"
        />
      ) : (
        <span className="text-white text-sm font-semibold select-none">
          {server.name
            .split(' ')
            .map(w => w[0])
            .join('')
            .slice(0, 3)}
        </span>
      )}

      {/* Active indicator */}
      <div
        className={`absolute -left-3 w-1 rounded-r-full bg-white transition-all duration-200 ${
          isActive ? 'h-10' : 'h-0 group-hover:h-5'
        }`}
      />
    </button>
  );
}
