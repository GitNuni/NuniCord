import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Compass, MessageSquare } from 'lucide-react';
import { useServerStore } from '../../store/servers';
import { useUIStore } from '../../store/ui';
import ServerIcon from '../common/ServerIcon';
import Tooltip from '../common/Tooltip';
import CreateServerModal from '../server/CreateServerModal';
import JoinServerModal from '../server/JoinServerModal';

export default function ServerSidebar() {
  const { servers } = useServerStore();
  const navigate = useNavigate();
  const { serverId } = useParams();
  const { mobileSidebarOpen } = useUIStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <div
      className={`flex flex-col items-center w-[72px] min-w-[72px] bg-nc-bg-tertiary py-3 gap-2 overflow-y-auto overflow-x-hidden
                  scrollbar-thin select-none
                  fixed md:relative top-0 left-0 h-full z-50 md:z-auto
                  transition-transform duration-300 ease-in-out
                  ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      onClick={e => e.stopPropagation()}
    >
      {/* DMs button */}
      <Tooltip content="Direct Messages" side="right">
        <button
          onClick={() => navigate('/channels/@me')}
          className={`server-icon w-12 h-12 ${!serverId && window.location.pathname.includes('@me') ? 'active bg-nc-brand' : 'bg-nc-bg-secondary hover:bg-nc-brand'} transition-all duration-200`}
        >
          <MessageSquare size={24} className="text-nc-interactive-normal" />
        </button>
      </Tooltip>

      <div className="w-8 h-px bg-nc-divider my-1 rounded-full" />

      {/* Server list */}
      {servers.map(server => (
        <Tooltip key={server.id} content={server.name} side="right">
          <ServerIcon
            server={server}
            isActive={serverId === server.id}
            onClick={() => navigate(`/channels/${server.id}`)}
          />
        </Tooltip>
      ))}

      <div className="w-8 h-px bg-nc-divider my-1 rounded-full" />

      {/* Add server */}
      <Tooltip content="Add a Server" side="right">
        <button
          onClick={() => setShowCreateModal(true)}
          className="server-icon w-12 h-12 bg-nc-bg-secondary hover:bg-nc-green text-nc-green hover:text-white transition-all duration-200"
        >
          <Plus size={24} />
        </button>
      </Tooltip>

      {/* Join server */}
      <Tooltip content="Explore Servers" side="right">
        <button
          onClick={() => setShowJoinModal(true)}
          className="server-icon w-12 h-12 bg-nc-bg-secondary hover:bg-nc-green text-nc-green hover:text-white transition-all duration-200"
        >
          <Compass size={24} />
        </button>
      </Tooltip>

      {showCreateModal && <CreateServerModal onClose={() => setShowCreateModal(false)} />}
      {showJoinModal && <JoinServerModal onClose={() => setShowJoinModal(false)} />}
    </div>
  );
}
