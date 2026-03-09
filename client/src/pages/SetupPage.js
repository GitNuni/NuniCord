import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { toast } from '../store/ui';

export default function SetupPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [form, setForm] = useState({ username: 'admin', email: '', password: '', display_name: 'Admin' });
  const [loading, setLoading] = useState(false);
  const [valid, setValid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) setValid(true);
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/setup', { ...form, token });
      toast('Admin account created!', 'success');
      navigate('/login');
    } catch (err) {
      toast(err.response?.data?.error || 'Setup failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!valid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-nc-bg-tertiary">
        <div className="text-center text-nc-text-muted">
          <h1 className="text-2xl font-bold text-nc-header-primary mb-4">Setup Token Required</h1>
          <p>Please use the setup URL printed in the server logs.</p>
          <a href="/login" className="text-nc-brand hover:underline mt-4 block">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-nc-bg-tertiary">
      <div className="w-full max-w-md p-8 bg-nc-bg-primary rounded-lg shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-nc-brand rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
            N
          </div>
        </div>
        <h1 className="text-2xl font-bold text-nc-header-primary text-center mb-2">
          Welcome to NuniCord
        </h1>
        <p className="text-nc-text-muted text-center mb-6 text-sm">
          Let's create your admin account to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="nc-label">Username</label>
            <input
              className="nc-input"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="nc-label">Display Name</label>
            <input
              className="nc-input"
              value={form.display_name}
              onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="nc-label">Email</label>
            <input
              type="email"
              className="nc-input"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="nc-label">Password</label>
            <input
              type="password"
              className="nc-input"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="nc-btn-primary w-full py-2.5"
          >
            {loading ? 'Setting up...' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
