import React, { useState, useEffect } from 'react';
import { X, Upload, LogOut, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { updateStatus } from '../../services/socket';
import api from '../../services/api';
import { toast } from '../../store/ui';
import Avatar from '../common/Avatar';
import Portal from '../common/Portal';
import AdminModal from '../admin/AdminModal';

const statusOptions = [
  { value: 'online', label: 'Online', color: 'nc-green' },
  { value: 'idle', label: 'Idle', color: 'nc-yellow' },
  { value: 'dnd', label: 'Do Not Disturb', color: 'nc-red' },
  { value: 'invisible', label: 'Invisible', color: 'nc-text-muted' },
];

export default function UserSettingsModal({ onClose }) {
  const { user, logout, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [showAdmin, setShowAdmin] = useState(false);
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    pronouns: user?.pronouns || '',
    status: (user?.status && user.status !== 'offline') ? user.status : 'online',
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
    { id: 'voice', label: 'Voice & Audio' },
    { id: 'privacy', label: 'Privacy & Safety' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'appearance', label: 'Appearance' },
  ];

  return (
    <>
    <Portal>
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
            {user?.is_admin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="w-full text-left px-3 py-2 rounded text-sm text-nc-interactive-normal hover:text-nc-interactive-hover hover:bg-nc-bg-modifier-hover flex items-center gap-2 mb-0.5"
              >
                <ShieldAlert size={16} className="text-nc-brand" />
                Administration
              </button>
            )}
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

          {tab === 'voice' && <VoiceAudioSettings />}

          {tab === 'privacy' && (
            <div>
              <h2 className="text-xl font-bold text-nc-header-primary mb-6">Privacy & Safety</h2>
              <p className="text-nc-text-muted">This section is coming soon.</p>
            </div>
          )}

          {tab === 'notifications' && <NotificationSettings />}

          {tab === 'appearance' && <AppearanceSettings />}
        </div>
      </div>
    </div>
    </Portal>
    {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
    </>
  );
}

// Persisted voice/audio prefs key
const VOICE_PREFS_KEY = 'nc_voice_prefs';
function loadVoicePrefs() {
  try { return JSON.parse(localStorage.getItem(VOICE_PREFS_KEY) || '{}'); } catch { return {}; }
}

function VoiceAudioSettings() {
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const prefs = loadVoicePrefs();
  const [selectedInput, setSelectedInput] = useState(prefs.inputDeviceId || '');
  const [selectedOutput, setSelectedOutput] = useState(prefs.outputDeviceId || '');
  const [noiseCancellation, setNoiseCancellation] = useState(prefs.noiseCancellation ?? true);
  const [echoCancellation, setEchoCancellation] = useState(prefs.echoCancellation ?? true);
  const [inputVolume, setInputVolume] = useState(prefs.inputVolume ?? 100);
  const [outputVolume, setOutputVolume] = useState(prefs.outputVolume ?? 100);
  const [testLevel, setTestLevel] = useState(0);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
    }).catch(() => {});
  }, []);

  function save() {
    const prefs = { inputDeviceId: selectedInput, outputDeviceId: selectedOutput, noiseCancellation, echoCancellation, inputVolume, outputVolume };
    localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(prefs));
    toast('Voice settings saved', 'success');
  }

  async function testMic() {
    if (testing) return;
    setTesting(true);
    setTestLevel(0);
    try {
      const constraints = {
        audio: {
          deviceId: selectedInput ? { exact: selectedInput } : undefined,
          noiseSuppression: noiseCancellation,
          echoCancellation,
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frames = 0;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setTestLevel(Math.min(100, avg * 3));
        if (++frames < 100) requestAnimationFrame(tick);
        else {
          stream.getTracks().forEach(t => t.stop());
          ctx.close();
          setTesting(false);
          setTestLevel(0);
        }
      };
      requestAnimationFrame(tick);
    } catch {
      setTesting(false);
    }
  }

  const Toggle = ({ value, onChange, label, description }) => (
    <div className="flex items-center justify-between py-3 border-b border-nc-divider/40">
      <div>
        <div className="text-sm text-nc-text-normal">{label}</div>
        {description && <div className="text-xs text-nc-text-muted mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-nc-brand' : 'bg-nc-bg-modifier-active'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-nc-header-primary mb-6">Voice & Audio</h2>
      <div className="max-w-lg space-y-6">

        {/* Input device */}
        <div>
          <label className="nc-label">Input Device (Microphone)</label>
          <select
            value={selectedInput}
            onChange={e => setSelectedInput(e.target.value)}
            className="nc-input"
          >
            <option value="">Default</option>
            {inputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>

        {/* Output device */}
        <div>
          <label className="nc-label">Output Device (Speakers/Headphones)</label>
          <select
            value={selectedOutput}
            onChange={e => setSelectedOutput(e.target.value)}
            className="nc-input"
          >
            <option value="">Default</option>
            {outputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
          {outputDevices.length === 0 && (
            <p className="text-xs text-nc-text-muted mt-1">Grant microphone permission first to enumerate devices.</p>
          )}
        </div>

        {/* Input volume */}
        <div>
          <label className="nc-label">Input Volume — {inputVolume}%</label>
          <input type="range" min={0} max={200} value={inputVolume} onChange={e => setInputVolume(Number(e.target.value))} className="w-full" />
        </div>

        {/* Output volume */}
        <div>
          <label className="nc-label">Output Volume — {outputVolume}%</label>
          <input type="range" min={0} max={200} value={outputVolume} onChange={e => setOutputVolume(Number(e.target.value))} className="w-full" />
        </div>

        {/* Mic test */}
        <div>
          <label className="nc-label">Microphone Test</label>
          <div className="flex items-center gap-3">
            <button onClick={testMic} disabled={testing} className="nc-btn-primary text-sm px-4">
              {testing ? 'Testing...' : 'Test Mic'}
            </button>
            <div className="flex-1 h-3 bg-nc-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{ width: `${testLevel}%`, background: testLevel > 70 ? '#ff3c00' : testLevel > 40 ? '#faa61a' : '#00ff88' }}
              />
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="border border-nc-divider/40 rounded">
          <div className="px-4">
            <Toggle
              value={noiseCancellation}
              onChange={setNoiseCancellation}
              label="Noise Cancellation"
              description="Reduces background noise using browser noise suppression"
            />
            <Toggle
              value={echoCancellation}
              onChange={setEchoCancellation}
              label="Echo Cancellation"
              description="Prevents microphone from picking up speaker output"
            />
          </div>
        </div>

        <button onClick={save} className="nc-btn-primary">Save Voice Settings</button>
      </div>
    </div>
  );
}

const USER_THEMES = [
  { id: '',         label: 'Default',         description: 'Apple dark system UI',       preview: '#0a84ff' },
  { id: 'ctos',     label: 'CTOS',            description: 'Watch Dogs cyan on black',   preview: '#00d4ff' },
  { id: 'claude',   label: 'Claude',          description: 'Anthropic dark mode',        preview: '#da7756' },
  { id: 'midnight', label: 'Midnight',        description: 'Deep navy blue-black',       preview: '#4a9eff' },
  { id: 'forest',   label: 'Forest',          description: 'Green terminal aesthetic',   preview: '#00c850' },
  { id: 'crimson',  label: 'Crimson',         description: 'Red alert on dark',          preview: '#ff3c3c' },
  { id: 'mono',     label: 'Monochrome',      description: 'Black & white minimal',      preview: '#c8c8c8' },
  { id: 'sunset',   label: 'Sunset',          description: 'Warm orange & amber',        preview: '#ff8c00' },
  { id: 'vapor',    label: 'Vaporwave',       description: 'Pink & purple neon',         preview: '#ff69b4' },
  { id: 'sepia',    label: 'Sepia',           description: 'Warm parchment & amber',     preview: '#c8a03a' },
];

const USER_THEME_KEY = 'nc_user_theme';

export function applyUserTheme(themeId) {
  const html = document.documentElement;
  html.style.filter = '';
  if (themeId) {
    html.setAttribute('data-theme', themeId);
    localStorage.setItem(USER_THEME_KEY, themeId);
  } else {
    html.removeAttribute('data-theme');
    localStorage.removeItem(USER_THEME_KEY);
  }
}

export function loadSavedUserTheme() {
  const saved = localStorage.getItem(USER_THEME_KEY);
  if (saved) applyUserTheme(saved);
}

function NotificationSettings() {
  const [permission, setPermission] = useState(Notification?.permission || 'default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function enableNotifications() {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') {
        const { subscribeToPush, registerServiceWorker } = await import('../../services/serviceWorker');
        registerServiceWorker();
        const sub = await subscribeToPush();
        setSubscribed(!!sub);
        if (sub) toast('Push notifications enabled!', 'success');
        else toast('Could not subscribe to push notifications', 'error');
      }
    } catch (err) {
      toast('Failed to enable notifications', 'error');
    } finally {
      setLoading(false);
    }
  }

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  return (
    <div>
      <h2 className="text-xl font-bold text-nc-header-primary mb-6">Notifications</h2>
      <div className="max-w-lg space-y-6">

        {/* Current status */}
        <div className="p-4 bg-nc-bg-secondary rounded border border-nc-divider">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${permission === 'granted' ? 'bg-green-500' : permission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <span className="text-sm font-medium text-nc-text-normal">
              {permission === 'granted' ? 'Notifications allowed' : permission === 'denied' ? 'Notifications blocked' : 'Notifications not enabled'}
            </span>
          </div>
          {permission === 'denied' && (
            <p className="text-xs text-nc-text-muted">You've blocked notifications. Reset in your browser/OS settings to re-enable.</p>
          )}
        </div>

        {isSupported && permission !== 'denied' && (
          <button
            onClick={enableNotifications}
            disabled={loading || permission === 'granted'}
            className="nc-btn-primary"
          >
            {loading ? 'Enabling...' : permission === 'granted' ? 'Notifications Enabled' : 'Enable Push Notifications'}
          </button>
        )}

        {!isSupported && (
          <div className="p-3 bg-yellow-900/20 border border-yellow-700/40 rounded text-sm text-yellow-300">
            Push notifications are not supported in this browser.
          </div>
        )}

        {/* Platform instructions */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-nc-text-muted">Setup Instructions</h3>

          {isIOS ? (
            <div className="p-4 bg-nc-bg-secondary rounded border border-nc-divider space-y-2">
              <div className="text-sm font-medium text-nc-header-primary">iOS (iPhone / iPad)</div>
              <ol className="text-sm text-nc-text-muted space-y-1 list-decimal list-inside">
                <li>Open NuniCord in <strong className="text-nc-text-normal">Safari</strong> (required — Chrome/Firefox won't work)</li>
                <li>Tap the <strong className="text-nc-text-normal">Share</strong> button (box with arrow)</li>
                <li>Tap <strong className="text-nc-text-normal">"Add to Home Screen"</strong></li>
                <li>Open the app from your Home Screen</li>
                <li>Come back to this settings page and click Enable</li>
              </ol>
              <p className="text-xs text-nc-text-muted">Requires iOS 16.4+ and Safari. Push notifications don't work in the regular browser tab on iOS.</p>
            </div>
          ) : isAndroid ? (
            <div className="p-4 bg-nc-bg-secondary rounded border border-nc-divider space-y-2">
              <div className="text-sm font-medium text-nc-header-primary">Android</div>
              <ol className="text-sm text-nc-text-muted space-y-1 list-decimal list-inside">
                <li>Open NuniCord in <strong className="text-nc-text-normal">Chrome</strong></li>
                <li>Tap the menu (⋮) and select <strong className="text-nc-text-normal">"Add to Home screen"</strong> (optional but recommended)</li>
                <li>Click <strong className="text-nc-text-normal">Enable Push Notifications</strong> above and allow when prompted</li>
              </ol>
            </div>
          ) : (
            <div className="p-4 bg-nc-bg-secondary rounded border border-nc-divider space-y-2">
              <div className="text-sm font-medium text-nc-header-primary">Desktop (Chrome / Firefox / Edge)</div>
              <ol className="text-sm text-nc-text-muted space-y-1 list-decimal list-inside">
                <li>Click <strong className="text-nc-text-normal">Enable Push Notifications</strong> above</li>
                <li>Click <strong className="text-nc-text-normal">Allow</strong> in the browser prompt</li>
                <li>You'll receive notifications for @mentions even when the tab is in the background</li>
              </ol>
              <p className="text-xs text-nc-text-muted">For persistent notifications, pin the tab or install as a PWA (browser menu → Install app).</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-nc-bg-secondary rounded border border-nc-divider/50 text-xs text-nc-text-muted">
          You'll be notified when someone @mentions you. Notifications require NuniCord to have an active service worker running.
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const saved = localStorage.getItem(USER_THEME_KEY) || 'ctos';
  const [selectedTheme, setSelectedTheme] = useState(saved);

  function pickTheme(id) {
    setSelectedTheme(id);
    applyUserTheme(id);
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-nc-header-primary mb-6">Appearance</h2>
      <div className="max-w-lg">
        <label className="nc-label mb-3 block">Client Theme</label>
        <p className="text-xs text-nc-text-muted mb-4">Themes apply only to your client and are saved locally.</p>
        <div className="grid grid-cols-2 gap-3">
          {USER_THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => pickTheme(theme.id)}
              className={`flex items-center gap-3 p-3 rounded border text-left transition-colors ${
                selectedTheme === theme.id
                  ? 'border-nc-brand bg-nc-brand/10'
                  : 'border-nc-divider hover:border-nc-interactive-normal hover:bg-nc-bg-modifier-hover'
              }`}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: theme.preview, flexShrink: 0, boxShadow: `0 0 8px ${theme.preview}60` }} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-nc-text-normal truncate">{theme.label}</div>
                <div className="text-xs text-nc-text-muted truncate">{theme.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
