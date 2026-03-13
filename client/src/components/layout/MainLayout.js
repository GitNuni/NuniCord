import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from '../chat/ChatArea';
import MemberList from './MemberList';
import UserPanel from './UserPanel';
import VoiceHUD from '../voice/VoiceHUD';
import { useServerStore } from '../../store/servers';
import { useUIStore } from '../../store/ui';
import { useVoiceStore } from '../../store/voice';
import api from '../../services/api';
import DMList from '../chat/DMList';
import WelcomeScreen from '../chat/WelcomeScreen';
import { onChannelChange } from '../../services/socket';

export default function MainLayout() {
  const { fetchServers } = useServerStore();
  const { sidebarOpen, memberListOpen, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const swipeTouchStartX = useRef(null);
  const swipeTouchStartY = useRef(null);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Swipe zone handlers — only attached to the thin edge strip, not the whole layout
  function onEdgeTouchStart(e) {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  }

  function onEdgeTouchEnd(e) {
    if (swipeTouchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && dx > 40) {
      setMobileSidebarOpen(true);
    }
    swipeTouchStartX.current = null;
    swipeTouchStartY.current = null;
  }

  return (
    <div className="flex h-full bg-nc-bg-primary overflow-hidden">
      {/* When sidebar open: transparent tap-zone over chat area to close on tap
          Positioned to the right of the sidebars (72+240=312px) */}
      {mobileSidebarOpen && (
        <div
          className="fixed top-0 bottom-0 right-0 z-40 md:hidden"
          style={{ left: 312 }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Swipe-to-open edge zone — dedicated strip, won't interfere with content taps */}
      {!mobileSidebarOpen && (
        <div
          className="fixed left-0 top-0 h-full z-30 md:hidden flex items-center"
          style={{ width: 24, touchAction: 'pan-y' }}
          onTouchStart={onEdgeTouchStart}
          onTouchEnd={onEdgeTouchEnd}
        >
          <div style={{
            width: 4, height: 56,
            background: 'linear-gradient(to right, transparent, rgba(0,212,255,0.45))',
            borderRadius: '0 4px 4px 0',
          }} />
        </div>
      )}

      {/* Server list */}
      <ServerSidebar />

      {/* Main content */}
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/channels/@me/*" element={<DMLayout />} />
        <Route path="/channels/:serverId/*" element={<ServerLayout />} />
      </Routes>
    </div>
  );
}

function DMLayout() {
  const { memberListOpen } = useUIStore();
  return (
    <>
      <DMList />
      <Routes>
        <Route path=":channelId" element={<ChatArea isDM />} />
        <Route path="/" element={<div className="flex-1 flex items-center justify-center text-nc-text-muted">Select a conversation</div>} />
      </Routes>
    </>
  );
}

function ServerLayout() {
  const { serverId, channelId } = useParams();
  const { setActiveServer, setActiveChannel } = useServerStore();
  const { memberListOpen } = useUIStore();
  const [serverData, setServerData] = useState(null);

  const refreshServerData = useCallback(() => {
    if (serverId) {
      api.get(`/servers/${serverId}`).then(r => setServerData(r.data)).catch(() => {});
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      setActiveServer(serverId);
      refreshServerData();
      api.get(`/servers/${serverId}/voice`)
        .then(r => useVoiceStore.getState().setVoiceChannels(r.data))
        .catch(() => {});
    }
  }, [serverId]);

  // Listen for real-time channel changes via socket.js's global listener registry
  useEffect(() => {
    return onChannelChange((changedServerId) => {
      if (changedServerId === serverId) refreshServerData();
    });
  }, [serverId, refreshServerData]);

  useEffect(() => {
    if (channelId) setActiveChannel(channelId);
  }, [channelId]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChannelSidebar serverId={serverId} serverData={serverData} onRefreshServer={refreshServerData} />
      <div className="flex flex-1 overflow-hidden">
        <Routes>
          <Route path="channels/:channelId" element={<ChatArea serverId={serverId} serverData={serverData} />} />
          <Route path="/" element={<WelcomeScreen server={serverData} />} />
        </Routes>
        {memberListOpen && <MemberList serverId={serverId} />}
      </div>
    </div>
  );
}
