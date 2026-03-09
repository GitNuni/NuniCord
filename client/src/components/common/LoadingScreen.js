import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full bg-nc-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-nc-brand rounded-2xl flex items-center justify-center text-white text-2xl font-bold animate-pulse">
          N
        </div>
        <div className="text-nc-text-muted text-sm">Loading NuniCord...</div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-nc-brand animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-nc-brand animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-nc-brand animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
