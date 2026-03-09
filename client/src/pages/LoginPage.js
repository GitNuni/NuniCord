import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/ui';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await doLogin(login, password);
      navigate('/');
    } catch (err) {
      toast(err.response?.data?.error || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-nc-bg-tertiary">
      <div className="w-full max-w-md p-8 bg-nc-bg-primary rounded-lg shadow-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-nc-brand rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
            N
          </div>
        </div>

        <h1 className="text-2xl font-bold text-nc-header-primary text-center mb-2">
          Welcome back!
        </h1>
        <p className="text-nc-text-muted text-center mb-8 text-sm">
          We're so excited to see you again!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="nc-label">Email or Username</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              className="nc-input"
              placeholder="Enter your email or username"
              required
              autoFocus
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="nc-label mb-0">Password</label>
              <a href="#" className="text-xs text-nc-brand hover:underline">Forgot your password?</a>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="nc-input"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="nc-btn-primary w-full py-2.5 text-sm mt-2"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-nc-text-muted text-sm mt-6">
          Need an account?{' '}
          <Link to="/register" className="text-nc-brand hover:underline">
            Register
          </Link>
        </p>

        {/* OAuth buttons */}
        {process.env.REACT_APP_OAUTH_GOOGLE === 'true' && (
          <div className="mt-4">
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-nc-divider" />
              <span className="text-nc-text-muted text-xs">OR</span>
              <div className="flex-1 h-px bg-nc-divider" />
            </div>
            <a
              href="/api/auth/google"
              className="nc-btn-secondary w-full flex items-center justify-center gap-2 py-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Continue with Google
            </a>
          </div>
        )}

        {process.env.REACT_APP_OAUTH_GITHUB === 'true' && (
          <a
            href="/api/auth/github"
            className="nc-btn-secondary w-full flex items-center justify-center gap-2 py-2.5 mt-2"
          >
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            Continue with GitHub
          </a>
        )}
      </div>
    </div>
  );
}
