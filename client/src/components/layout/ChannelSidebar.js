import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Hash, Volume2, ChevronDown, ChevronRight, Plus, Settings,
  BookOpen, Rss, Users, Lock, Megaphone
} from 'lucide-react';
import { useVoiceStore } from '../../store/voice';
import UserPanel from './UserPanel';
import VoiceHUD from '../voice/VoiceHUD';
import CreateChannelModal from '../channel/CreateChannelModal';
import ServerSettingsModal from '../server/ServerSettingsModal';

const channelTypeIcons = {
  text: Hash,
  voice: Volume2,
  forum: BookOpen,
  thread: Hash,
  announcement: Megaphone,
};

export default function ChannelSidebar({ serverId, serverData }) {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showCreateChannel, setShowCreateChannel] = useState(null);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const voiceState = useVoiceStore();

  const categories = serverData?.categories || [];
  const channels = serverData?.channels || [];

  // Group channels by category
  const channelsByCategory = channels.reduce((acc, ch) => {
    const catId = ch.category_id || 'uncategorized';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(ch);
    return acc;
  }, {});

  const toggleCategory = (catId) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <div className="flex flex-col w-60 min-w-60 bg-nc-bg-secondary overflow-hidden">
      {/* Server header */}
      <button
        onClick={() => setShowServerSettings(true)}
        className="flex items-center justify-between px-4 h-12 border-b border-black/30 hover:bg-nc-bg-modifier-hover font-semibold text-nc-header-primary truncate shadow-sm transition-colors"
      >
        <span className="truncate">{serverData?.name || 'Loading...'}</span>
        <ChevronDown size={16} className="text-nc-interactive-normal flex-shrink-0" />
      </button>

      {/* Voice HUD */}
      {voiceState.activeChannelId && <VoiceHUD />}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {categories.map(category => {
          const catChannels = channelsByCategory[category.id] || [];
          const isCollapsed = collapsedCategories[category.id];

          return (
            <div key={category.id} className="mt-2">
              {/* Category header */}
              <div
                className="flex items-center justify-between px-2 py-0.5 cursor-pointer group"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-1 text-nc-interactive-normal hover:text-nc-interactive-hover">
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span className="text-xs font-semibold uppercase tracking-wide truncate">
                    {category.name}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCreateChannel(category.id); }}
                  className="opacity-0 group-hover:opacity-100 text-nc-interactive-normal hover:text-nc-interactive-hover transition-opacity"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Channels in category */}
              {!isCollapsed && catChannels.map(ch => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isActive={channelId === ch.id}
                  onClick={() => navigate(`/channels/${serverId}/channels/${ch.id}`)}
                />
              ))}
            </div>
          );
        })}

        {/* Channels without category */}
        {(channelsByCategory['uncategorized'] || []).map(ch => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            isActive={channelId === ch.id}
            onClick={() => navigate(`/channels/${serverId}/channels/${ch.id}`)}
          />
        ))}
      </div>

      {/* User Panel */}
      <UserPanel />

      {showCreateChannel && (
        <CreateChannelModal
          serverId={serverId}
          categoryId={showCreateChannel}
          onClose={() => setShowCreateChannel(null)}
        />
      )}

      {showServerSettings && (
        <ServerSettingsModal
          serverId={serverId}
          serverData={serverData}
          onClose={() => setShowServerSettings(false)}
        />
      )}
    </div>
  );
}

function ChannelItem({ channel, isActive, onClick }) {
  const Icon = channelTypeIcons[channel.type] || Hash;
  const voiceState = useVoiceStore();
  const isInVoice = voiceState.activeChannelId === channel.id;

  return (
    <div
      className={`channel-item ${isActive ? 'active' : ''} group`}
      onClick={onClick}
    >
      {channel.nsfw && <Lock size={14} className="text-nc-text-muted flex-shrink-0" />}
      {!channel.nsfw && <Icon size={18} className="text-nc-channel-icon flex-shrink-0" />}
      <span className="text-sm truncate flex-1">{channel.name}</span>

      {channel.type === 'voice' && isInVoice && (
        <div className="flex gap-0.5 items-end h-3">
          <div className="voice-bar w-0.5 bg-nc-green rounded-full" style={{ animationDelay: '0ms', height: '8px' }} />
          <div className="voice-bar w-0.5 bg-nc-green rounded-full" style={{ animationDelay: '150ms', height: '12px' }} />
          <div className="voice-bar w-0.5 bg-nc-green rounded-full" style={{ animationDelay: '300ms', height: '8px' }} />
        </div>
      )}

      {isActive && (
        <button
          className="opacity-0 group-hover:opacity-100 text-nc-interactive-normal hover:text-nc-interactive-hover ml-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  );
}
