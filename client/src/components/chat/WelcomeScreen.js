import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function WelcomeScreen({ server }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-nc-bg-primary">
      <div className="text-center max-w-md px-4">
        {server ? (
          <>
            {server.icon_url ? (
              <img src={server.icon_url} alt={server.name} className="w-24 h-24 rounded-full mx-auto mb-4" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-nc-brand flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold">
                {server.name?.split(' ').map(w => w[0]).join('').slice(0, 3)}
              </div>
            )}
            <h1 className="text-3xl font-bold text-nc-header-primary mb-2">Welcome to {server.name}!</h1>
            <p className="text-nc-text-muted text-sm">
              {server.description || 'Select a channel to start chatting.'}
            </p>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full bg-nc-brand flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold">
              N
            </div>
            <h1 className="text-3xl font-bold text-nc-header-primary mb-2">Welcome to NuniCord!</h1>
            <p className="text-nc-text-muted text-sm mb-4">
              Select a server or start a direct message to get chatting.
            </p>
            <div className="flex items-center gap-2 justify-center text-nc-text-muted text-sm">
              <MessageSquare size={16} />
              <span>Your conversations are waiting</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
