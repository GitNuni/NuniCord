import React, { useState } from 'react';
import { Mic, MicOff, Headphones, VolumeX, Settings, Bug } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useVoiceStore } from '../../store/voice';
import { updateStatus } from '../../services/socket';
import Avatar from '../common/Avatar';
import Tooltip from '../common/Tooltip';
import UserSettingsModal from '../settings/UserSettingsModal';
import BugReportModal from '../common/BugReportModal';

export default function UserPanel() {
  const { user, logout } = useAuthStore();
  const { isMuted, isDeafened, toggleMute, toggleDeafen } = useVoiceStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-2 bg-nc-bg-secondary/80 border-t border-black/20 mt-auto h-[52px]">
      {/* User info */}
      <div className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer hover:bg-nc-bg-modifier-hover rounded px-1 py-0.5 min-w-0">
        <div className="relative flex-shrink-0">
          <Avatar user={user} size={32} />
          <span className={`status-indicator absolute -bottom-0.5 -right-0.5 status-${user.status || 'offline'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-nc-header-primary truncate leading-tight">
            {user.display_name || user.username}
          </div>
          <div className="text-xs text-nc-text-muted truncate leading-tight">
            {user.custom_status || `@${user.username}`}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5">
        <Tooltip content={isMuted ? 'Unmute' : 'Mute'} side="top">
          <button
            onClick={() => toggleMute()}
            className={`p-1.5 rounded hover:bg-nc-bg-modifier-hover transition-colors ${isMuted ? 'text-nc-red' : 'text-nc-interactive-normal hover:text-nc-interactive-hover'}`}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </Tooltip>

        <Tooltip content={isDeafened ? 'Undeafen' : 'Deafen'} side="top">
          <button
            onClick={() => toggleDeafen()}
            className={`p-1.5 rounded hover:bg-nc-bg-modifier-hover transition-colors ${isDeafened ? 'text-nc-red' : 'text-nc-interactive-normal hover:text-nc-interactive-hover'}`}
          >
            {isDeafened ? <VolumeX size={18} /> : <Headphones size={18} />}
          </button>
        </Tooltip>

        <Tooltip content="Report a Bug" side="top">
          <button
            onClick={() => setShowBugReport(true)}
            className="p-1.5 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover transition-colors"
          >
            <Bug size={18} />
          </button>
        </Tooltip>

        <Tooltip content="User Settings" side="top">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-nc-bg-modifier-hover text-nc-interactive-normal hover:text-nc-interactive-hover transition-colors"
          >
            <Settings size={18} />
          </button>
        </Tooltip>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
      {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}
    </div>
  );
}
