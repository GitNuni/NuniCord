import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, Server, Settings, Shield, LogOut,
  TrendingUp, MessageSquare, UserCheck, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import api from '../services/api';
import { toast } from '../store/ui';

function AdminSidebar() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const navItems = [
    { to: '/admin', icon: BarChart3, label: 'Overview' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/servers', icon: Server, label: 'Servers' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-56 bg-nc-bg-secondary flex flex-col border-r border-black/20">
      <div className="p-4 border-b border-black/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-nc-brand rounded-lg flex items-center justify-center text-white font-bold text-sm">N</div>
          <span className="font-semibold text-nc-header-primary">Admin Panel</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-3 py-2 rounded text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover text-sm transition-colors"
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-2 border-t border-black/20">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover text-sm"
        >
          <LogOut size={18} />
          Back to App
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = 'nc-brand' }) {
  return (
    <div className="bg-nc-bg-secondary rounded-lg p-4 border border-nc-divider">
      <div className="flex items-center justify-between mb-2">
        <span className="text-nc-text-muted text-sm">{label}</span>
        <Icon size={20} className={`text-${color}`} />
      </div>
      <div className="text-2xl font-bold text-nc-header-primary">{value?.toLocaleString() ?? '—'}</div>
    </div>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(r => {
      setStats(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-nc-header-primary mb-6">Overview</h1>

      {loading ? (
        <div className="text-nc-text-muted">Loading stats...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Users} label="Total Users" value={stats?.total_users} color="nc-brand" />
            <StatCard icon={Server} label="Total Servers" value={stats?.total_servers} color="nc-green" />
            <StatCard icon={MessageSquare} label="Messages (24h)" value={stats?.messages_24h} color="nc-yellow" />
            <StatCard icon={UserCheck} label="Active (15m)" value={stats?.active_users_15m} color="nc-status-info" />
          </div>

          {stats?.message_volume && stats.message_volume.length > 0 && (
            <div className="bg-nc-bg-secondary rounded-lg p-4 border border-nc-divider">
              <h2 className="text-lg font-semibold text-nc-header-primary mb-4 flex items-center gap-2">
                <TrendingUp size={20} />
                Message Volume (7 days)
              </h2>
              <div className="flex items-end gap-2 h-32">
                {stats.message_volume.map((day, idx) => {
                  const max = Math.max(...stats.message_volume.map(d => parseInt(d.count)));
                  const height = max > 0 ? (parseInt(day.count) / max) * 100 : 0;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className="w-full bg-nc-brand rounded-t transition-all"
                        style={{ height: `${height}%`, minHeight: '2px' }}
                        title={`${day.count} messages`}
                      />
                      <span className="text-xxs text-nc-text-muted">
                        {new Date(day.day).toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', { params: { page, search } });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [page, search]);

  async function banUser(userId, username) {
    const reason = prompt(`Ban reason for ${username}:`);
    if (reason === null) return;
    try {
      await api.post(`/admin/users/${userId}/ban`, { reason });
      toast(`User ${username} banned`, 'success');
      fetchUsers();
    } catch (err) {
      toast('Failed to ban user', 'error');
    }
  }

  async function unbanUser(userId, username) {
    try {
      await api.post(`/admin/users/${userId}/unban`);
      toast(`User ${username} unbanned`, 'success');
      fetchUsers();
    } catch (err) {
      toast('Failed to unban user', 'error');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-nc-header-primary">Users</h1>
        <span className="text-nc-text-muted text-sm">{total.toLocaleString()} total</span>
      </div>

      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search users..."
        className="nc-input mb-4 max-w-sm"
      />

      {loading ? (
        <div className="text-nc-text-muted">Loading...</div>
      ) : (
        <div className="bg-nc-bg-secondary rounded-lg border border-nc-divider overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-nc-divider text-nc-text-muted text-sm">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-nc-divider/50 hover:bg-nc-bg-modifier-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-nc-brand flex items-center justify-center text-white text-xs font-bold">
                        {(user.display_name || user.username)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm text-nc-text-normal font-medium">
                          {user.display_name || user.username}
                        </div>
                        <div className="text-xs text-nc-text-muted">@{user.username}</div>
                      </div>
                      {user.is_admin && (
                        <span className="text-xxs bg-nc-brand/20 text-nc-brand px-1 py-0.5 rounded">Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-nc-text-muted">{user.email || '—'}</td>
                  <td className="px-4 py-3">
                    {user.is_banned ? (
                      <span className="text-xs bg-nc-red/20 text-nc-red px-2 py-0.5 rounded">Banned</span>
                    ) : (
                      <span className="text-xs bg-nc-green/20 text-nc-green px-2 py-0.5 rounded capitalize">
                        {user.status || 'offline'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-nc-text-muted">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {user.is_banned ? (
                        <button
                          onClick={() => unbanUser(user.id, user.username)}
                          className="text-xs nc-btn-secondary py-1 px-2"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => banUser(user.id, user.username)}
                          className="text-xs nc-btn-danger py-1 px-2"
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-4 py-3 border-t border-nc-divider">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="nc-btn-secondary py-1 px-3 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-nc-text-muted">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={users.length < 50}
              className="nc-btn-secondary py-1 px-3 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings').then(r => {
      setSettings(r.data);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.patch('/admin/settings', settings);
      toast('Settings saved', 'success');
    } catch {
      toast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  if (loading) return <div className="p-6 text-nc-text-muted">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-nc-header-primary mb-6">Instance Settings</h1>

      <div className="space-y-6">
        <SettingSection title="Registration">
          <SettingToggle
            label="Open Registration"
            description="Allow new users to register accounts"
            value={settings.registration_open === true || settings.registration_open === 'true'}
            onChange={v => update('registration_open', v)}
          />
        </SettingSection>

        <SettingSection title="Limits">
          <SettingInput
            label="Max File Size (MB)"
            value={settings.max_file_size_mb || '100'}
            type="number"
            onChange={v => update('max_file_size_mb', v)}
          />
          <SettingInput
            label="Max Servers per User"
            value={settings.max_servers_per_user || '100'}
            type="number"
            onChange={v => update('max_servers_per_user', v)}
          />
        </SettingSection>

        <SettingSection title="Maintenance">
          <SettingToggle
            label="Maintenance Mode"
            description="Prevent non-admin logins"
            value={settings.maintenance_mode === true || settings.maintenance_mode === 'true'}
            onChange={v => update('maintenance_mode', v)}
          />
        </SettingSection>

        <button onClick={save} disabled={saving} className="nc-btn-primary px-6">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

function SettingSection({ title, children }) {
  return (
    <div className="bg-nc-bg-secondary rounded-lg border border-nc-divider p-4">
      <h3 className="text-nc-header-secondary font-semibold text-sm uppercase tracking-wide mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingToggle({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-nc-text-normal font-medium">{label}</div>
        {description && <div className="text-xs text-nc-text-muted mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors ${value ? 'bg-nc-green' : 'bg-nc-interactive-muted'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white ml-1 transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SettingInput({ label, value, type = 'text', onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-nc-text-normal font-medium flex-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="nc-input w-32 text-sm"
      />
    </div>
  );
}

function AdminServers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/servers').then(r => {
      setServers(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function deleteServer(id, name) {
    if (!window.confirm(`Delete server "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/servers/${id}`);
      setServers(prev => prev.filter(s => s.id !== id));
      toast('Server deleted', 'success');
    } catch {
      toast('Failed to delete server', 'error');
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-nc-header-primary mb-6">Servers</h1>
      {loading ? <div className="text-nc-text-muted">Loading...</div> : (
        <div className="bg-nc-bg-secondary rounded-lg border border-nc-divider overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-nc-divider text-nc-text-muted text-sm">
                <th className="text-left px-4 py-3">Server</th>
                <th className="text-left px-4 py-3">Owner</th>
                <th className="text-left px-4 py-3">Members</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map(server => (
                <tr key={server.id} className="border-b border-nc-divider/50 hover:bg-nc-bg-modifier-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {server.icon_url ? (
                        <img src={server.icon_url} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-nc-brand flex items-center justify-center text-white text-xs font-bold">
                          {server.name[0]}
                        </div>
                      )}
                      <span className="text-sm text-nc-text-normal">{server.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-nc-text-muted">
                    @{server.owner?.username}
                  </td>
                  <td className="px-4 py-3 text-sm text-nc-text-muted">{server.member_count}</td>
                  <td className="px-4 py-3 text-sm text-nc-text-muted">
                    {new Date(server.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteServer(server.id, server.name)}
                      className="text-xs nc-btn-danger py-1 px-2"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();

  if (!user?.is_admin) {
    return (
      <div className="flex items-center justify-center h-full bg-nc-bg-primary">
        <div className="text-center">
          <AlertTriangle size={48} className="text-nc-red mx-auto mb-4" />
          <h1 className="text-xl font-bold text-nc-header-primary">Access Denied</h1>
          <p className="text-nc-text-muted mt-2">You don't have permission to access the admin panel.</p>
          <Link to="/" className="text-nc-brand hover:underline mt-4 block">Go back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-nc-bg-primary">
      <AdminSidebar />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/servers" element={<AdminServers />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
      </div>
    </div>
  );
}
