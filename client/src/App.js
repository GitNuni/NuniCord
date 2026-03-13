import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { Toaster } from './components/common/Toaster';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SetupPage from './pages/SetupPage';
import AdminPage from './pages/AdminPage';
import InvitePage from './pages/InvitePage';
import LoadingScreen from './components/common/LoadingScreen';

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!user) {
    // Remember where they were trying to go so we can redirect after login
    sessionStorage.setItem('nc_post_login_redirect', window.location.pathname + window.location.search);
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AuthRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { init, isLoading } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  if (isLoading) return <LoadingScreen />;

  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/admin/*" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/invite/:code" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
        <Route path="/*" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
