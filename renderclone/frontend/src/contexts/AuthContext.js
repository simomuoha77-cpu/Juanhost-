import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('jh_user')); } catch { return null; } });
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    const token = localStorage.getItem('jh_token');
    if (token) {
      authAPI.me().then(res => { setUser(res.data.user); localStorage.setItem('jh_user', JSON.stringify(res.data.user)); }).catch(() => logout()).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);
  const login = (token, userData) => { localStorage.setItem('jh_token', token); localStorage.setItem('jh_user', JSON.stringify(userData)); setUser(userData); };
  const logout = () => { localStorage.removeItem('jh_token'); localStorage.removeItem('jh_user'); setUser(null); };
  const updateUser = (data) => { const updated = { ...user, ...data }; setUser(updated); localStorage.setItem('jh_user', JSON.stringify(updated)); };
  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading, unreadCount, setUnreadCount, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
