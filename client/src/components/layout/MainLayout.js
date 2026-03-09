import React, { useEffect, useCallback, useState } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from '../chat/ChatArea';
import MemberList from './MemberList';
import UserPanel from './UserPanel';
import VoiceHUD from '../voice/VoiceHUD';
import { useServerStore } from '../../store/servers';
import { useUIStore } from '../../store/ui';
import api from '../../services/api';
import DMList from '../chat/DMList';
import WelcomeScreen from '../chat/WelcomeScreen';

export default function MainLayout() {
  const { fetchServers } = useServerStore();
  const { sidebarOpen, memberListOpen } = useUIStore();

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return (
    <div className="flex h-full bg-nc-bg-primary overflow-hidden">
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

  useEffect(() => {
    if (serverId) {
      setActiveServer(serverId);
      api.get(`/servers/${serverId}`).then(r => setServerData(r.data)).catch(() => {});
    }
  }, [serverId]);

  useEffect(() => {
    if (channelId) setActiveChannel(channelId);
  }, [channelId]);

  return (
    <>
      <ChannelSidebar serverId={serverId} serverData={serverData} />
      <div className="flex flex-1 overflow-hidden">
        <Routes>
          <Route path="channels/:channelId" element={<ChatArea serverId={serverId} serverData={serverData} />} />
          <Route path="/" element={<WelcomeScreen server={serverData} />} />
        </Routes>
        {memberListOpen && <MemberList serverId={serverId} />}
      </div>
    </>
  );
}
