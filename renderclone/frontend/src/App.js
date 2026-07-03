import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewService from './pages/NewService';
import ServiceDetail from './pages/ServiceDetail';
import { Databases, DatabaseDetail } from './pages/Databases';
import { EnvGroups, Domains, Teams, Activity, Billing, AccountSettings, AdminPanel } from './pages/AllPages';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}
function Admin({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="splash"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
function Guest({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { background: '#111128', color: '#e2e8f0', border: '1px solid #252545' } }} />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Guest><Login /></Guest>} />
          <Route path="/register" element={<Guest><Register /></Guest>} />
          <Route path="/forgot-password" element={<Guest><ForgotPassword /></Guest>} />
          <Route path="/reset-password/:token" element={<Guest><ResetPassword /></Guest>} />

          <Route path="/dashboard" element={<Private><Layout /></Private>}>
            <Route index element={<Dashboard />} />
            <Route path="new" element={<NewService />} />
            <Route path="services/:id" element={<ServiceDetail />} />
            <Route path="databases" element={<Databases />} />
            <Route path="databases/:id" element={<DatabaseDetail />} />
            <Route path="env-groups" element={<EnvGroups />} />
            <Route path="domains" element={<Domains />} />
            <Route path="teams" element={<Teams />} />
            <Route path="activity" element={<Activity />} />
            <Route path="billing" element={<Billing />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>

          <Route path="/admin" element={<Admin><Layout /></Admin>}>
            <Route index element={<AdminPanel />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
