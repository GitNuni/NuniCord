import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast('Password must be at least 8 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, form.display_name);
      navigate('/');
    } catch (err) {
      const errors = err.response?.data?.errors;
      const message = errors
        ? errors.map(e => e.msg).join(', ')
        : err.response?.data?.error || 'Registration failed';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
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
          Create an account
        </h1>
        <p className="text-nc-text-muted text-center mb-6 text-sm">
          Join NuniCord today!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="nc-label">Username <span className="text-nc-red">*</span></label>
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              className="nc-input"
              placeholder="Choose a unique username"
              required
              minLength={2}
              maxLength={32}
              pattern="[a-zA-Z0-9_.\-]+"
              autoFocus
            />
            <p className="text-xs text-nc-text-muted mt-1">Letters, numbers, _, ., - only</p>
          </div>

          <div>
            <label className="nc-label">Display Name</label>
            <input
              name="display_name"
              type="text"
              value={form.display_name}
              onChange={handleChange}
              className="nc-input"
              placeholder="Your display name (optional)"
              maxLength={64}
            />
          </div>

          <div>
            <label className="nc-label">Email <span className="text-nc-text-muted text-xs font-normal">(optional)</span></label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="nc-input"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="nc-label">Password <span className="text-nc-red">*</span></label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="nc-input"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          <p className="text-xs text-nc-text-muted">
            By registering, you agree to our{' '}
            <a href="#" className="text-nc-brand hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-nc-brand hover:underline">Privacy Policy</a>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="nc-btn-primary w-full py-2.5 text-sm"
          >
            {loading ? 'Creating account...' : 'Continue'}
          </button>
        </form>

        <p className="text-center text-nc-text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-nc-brand hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
