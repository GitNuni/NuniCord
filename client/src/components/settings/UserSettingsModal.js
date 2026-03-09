import React, { useState } from 'react';
import { X, Upload, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { updateStatus } from '../../services/socket';
import api from '../../services/api';
import { toast } from '../../store/ui';
import Avatar from '../common/Avatar';

const statusOptions = [
  { value: 'online', label: 'Online', color: 'nc-green' },
  { value: 'idle', label: 'Idle', color: 'nc-yellow' },
  { value: 'dnd', label: 'Do Not Disturb', color: 'nc-red' },
  { value: 'invisible', label: 'Invisible', color: 'nc-text-muted' },
];

export default function UserSettingsModal({ onClose }) {
  const { user, logout, updateUser } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    pronouns: user?.pronouns || '',
    status: user?.status || 'online',
    custom_status: user?.custom_status || '',
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/me', form);
      updateUser(data);
      updateStatus(form.status, form.custom_status);
      toast('Profile updated', 'success');
    } catch {
      toast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (passwords.new !== passwords.confirm) {
      toast('Passwords do not match', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: passwords.current,
        new_password: passwords.new,
      });
      setPasswords({ current: '', new: '', confirm: '' });
      toast('Password changed', 'success');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await api.post('/uploads/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ avatar_url: data.avatar_url });
      toast('Avatar updated', 'success');
    } catch {
      toast('Failed to upload avatar', 'error');
    }
  }

  const tabs = [
    { id: 'profile', label: 'My Account' },
    { id: 'profile-info', label: 'Profile' },
    { id: 'privacy', label: 'Privacy & Safety' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'appearance', label: 'Appearance' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex z-50 animate-fade-in">
      <div className="m-auto flex w-full max-w-4xl h-[85vh] bg-nc-bg-primary rounded-lg shadow-2xl overflow-hidden animate-slide-up">
        {/* Sidebar */}
        <div className="w-52 bg-nc-bg-secondary p-3 flex flex-col">
          <div className="text-xs font-semibold uppercase tracking-wide text-nc-text-muted px-3 py-2 mb-1">
            User Settings
          </div>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors mb-0.5 ${
                tab === t.id
                  ? 'bg-nc-bg-modifier-active text-nc-interactive-active'
                  : 'text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="mt-auto">
            <div className="w-full h-px bg-nc-divider my-2" />
            <button
              onClick={async () => { await logout(); onClose(); }}
              className="w-full text-left px-3 py-2 rounded text-sm text-nc-red hover:text-red-400 hover:bg-nc-red/10 flex items-center gap-2"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
          <button onClick={onClose} className="flex items-center gap-1 px-3 py-2 text-sm text-nc-interactive-normal hover:text-nc-interactive-hover mt-1">
            <X size={14} /> Esc
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {tab === 'profile' && (
            <div>
              <h2 className="text-xl font-bold text-nc-header-primary mb-6">My Account</h2>

              {/* Profile banner */}
              <div className="bg-nc-bg-secondary rounded-lg p-4 mb-6">
                <div className="h-20 bg-nc-brand/20 rounded-lg mb-2 relative">
                  <div className="absolute -bottom-6 left-4 relative group">
                    <Avatar user={user} size={64} />
                    <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload size={18} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
                    </label>
                  </div>
                </div>
                <div className="mt-8 px-2">
                  <div className="font-bold text-nc-header-primary">{user?.display_name || user?.username}</div>
                  <div className="text-sm text-nc-text-muted">@{user?.username}</div>
                </div>
              </div>

              {/* Status */}
              <div className="mb-6">
                <label className="nc-label">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map(s => (
                    <label
                      key={s.value}
                      className={`flex items-center gap-2 p-3 rounded cursor-pointer border transition-colors ${
                        form.status === s.value
                          ? 'border-nc-brand bg-nc-brand/10'
                          : 'border-nc-divider hover:border-nc-interactive-normal'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={s.value}
                        checked={form.status === s.value}
                        onChange={() => setForm(p => ({ ...p, status: s.value }))}
                        className="hidden"
                      />
                      <div className={`w-3 h-3 rounded-full status-${s.value} flex-shrink-0`} />
                      <span className="text-sm text-nc-text-normal">{s.label}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-3">
                  <label className="nc-label">Custom Status</label>
                  <input
                    value={form.custom_status}
                    onChange={e => setForm(p => ({ ...p, custom_status: e.target.value }))}
                    className="nc-input"
                    placeholder="What's on your mind?"
                    maxLength={128}
                  />
                </div>
              </div>

              {/* Display name */}
              <div className="mb-4">
                <label className="nc-label">Display Name</label>
                <input
                  value={form.display_name}
                  onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                  className="nc-input"
                  maxLength={64}
                />
              </div>

              <button onClick={saveProfile} disabled={saving} className="nc-btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              {/* Change password */}
              <div className="mt-8 pt-8 border-t border-nc-divider">
                <h3 className="text-lg font-semibold text-nc-header-primary mb-4">Change Password</h3>
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="nc-label">Current Password</label>
                    <input
                      type="password"
                      value={passwords.current}
                      onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                      className="nc-input"
                    />
                  </div>
                  <div>
                    <label className="nc-label">New Password</label>
                    <input
                      type="password"
                      value={passwords.new}
                      onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))}
                      className="nc-input"
                    />
                  </div>
                  <div>
                    <label className="nc-label">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwords.confirm}
                      onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                      className="nc-input"
                    />
                  </div>
                  <button onClick={changePassword} disabled={saving} className="nc-btn-primary">
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'profile-info' && (
            <div>
              <h2 className="text-xl font-bold text-nc-header-primary mb-6">Profile</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="nc-label">Pronouns</label>
                  <input
                    value={form.pronouns}
                    onChange={e => setForm(p => ({ ...p, pronouns: e.target.value }))}
                    className="nc-input"
                    placeholder="e.g. they/them"
                    maxLength={64}
                  />
                </div>
                <div>
                  <label className="nc-label">Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                    className="nc-input resize-none"
                    rows={4}
                    placeholder="Tell us a bit about yourself..."
                    maxLength={512}
                  />
                  <div className="text-xs text-nc-text-muted text-right mt-1">{form.bio.length}/512</div>
                </div>
                <button onClick={saveProfile} disabled={saving} className="nc-btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {(tab === 'privacy' || tab === 'notifications' || tab === 'appearance') && (
            <div>
              <h2 className="text-xl font-bold text-nc-header-primary mb-6">
                {tabs.find(t => t.id === tab)?.label}
              </h2>
              <p className="text-nc-text-muted">This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
