import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, Users, Server, Settings, MessageSquare, Clock, Bug, LogOut } from 'lucide-react';
import {
  AdminOverview, AdminUsers, AdminPendingUsers, AdminServers,
  AdminSettings, AdminAIChat, AdminBugReports,
} from '../../pages/AdminPage';

const VIEWS = [
  { key: 'overview', icon: BarChart3, label: 'Overview', component: AdminOverview },
  { key: 'users', icon: Users, label: 'Users', component: AdminUsers },
  { key: 'pending', icon: Clock, label: 'Pending Approvals', component: AdminPendingUsers },
  { key: 'servers', icon: Server, label: 'Servers', component: AdminServers },
  { key: 'settings', icon: Settings, label: 'Settings', component: AdminSettings },
  { key: 'ai', icon: MessageSquare, label: 'Feature Requests', component: AdminAIChat },
  { key: 'bugs', icon: Bug, label: 'Bug Reports', component: AdminBugReports },
];

export default function AdminModal({ onClose }) {
  const [activeView, setActiveView] = useState('overview');

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const ActiveComponent = VIEWS.find(v => v.key === activeView)?.component ?? AdminOverview;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 1100, height: '85vh',
          background: 'var(--nc-bg-primary)',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          display: 'flex',
          overflow: 'hidden',
          border: '1px solid var(--nc-divider)',
          position: 'relative',
        }}
      >
        {/* Sidebar */}
        <div className="w-56 bg-nc-bg-secondary flex flex-col border-r border-black/20 flex-shrink-0">
          <div className="p-4 border-b border-black/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-nc-brand rounded-lg flex items-center justify-center text-white font-bold text-sm">N</div>
              <span className="font-semibold text-nc-header-primary">Admin Panel</span>
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {VIEWS.map(view => (
              <button
                key={view.key}
                onClick={() => setActiveView(view.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors text-left ${
                  activeView === view.key
                    ? 'bg-nc-bg-modifier-selected text-nc-interactive-active'
                    : 'text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover'
                }`}
              >
                <view.icon size={18} />
                {view.label}
              </button>
            ))}
          </nav>
          <div className="p-2 border-t border-black/20">
            <button
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2 rounded text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover text-sm text-left"
            >
              <LogOut size={18} />
              Back to App
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <ActiveComponent />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          title="Close"
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            background: 'none', border: 'none',
            color: 'var(--nc-interactive-normal)', cursor: 'pointer',
            padding: 4, borderRadius: 4, display: 'flex',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--nc-header-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--nc-interactive-normal)'}
        >
          <X size={20} />
        </button>
      </div>
    </div>,
    document.body
  );
}
