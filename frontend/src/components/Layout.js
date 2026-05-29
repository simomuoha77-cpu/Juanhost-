import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Database, Globe, Users, Activity, CreditCard, Settings, Shield, LogOut, Bell, Sun, Moon, Server, Layers, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notifAPI } from '../api/client';

export default function Layout() {
  const { user, logout, isAdmin, theme, toggleTheme, unreadCount, setUnreadCount } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    notifAPI.list().then(r => setUnreadCount(r.data.unread)).catch(() => {});
    const i = setInterval(() => {
      notifAPI.list().then(r => setUnreadCount(r.data.unread)).catch(() => {});
    }, 30000);
    return () => clearInterval(i);
  }, [setUnreadCount]);

  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/dashboard/new', label: 'New Service', icon: PlusCircle },
    { label: 'RESOURCES', divider: true },
    { to: '/dashboard/databases', label: 'Databases', icon: Database },
    { to: '/dashboard/env-groups', label: 'Env Groups', icon: Layers },
    { to: '/dashboard/domains', label: 'Domains', icon: Globe },
    { label: 'ACCOUNT', divider: true },
    { to: '/dashboard/teams', label: 'Teams', icon: Users },
    { to: '/dashboard/activity', label: 'Activity', icon: Activity },
    { to: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
    ...(isAdmin ? [{ label: 'ADMIN', divider: true }, { to: '/admin', label: 'Admin Panel', icon: Shield }] : [])
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon"><Server size={17} color="#fff" /></div>
            <span className="logo-text">Juan<span>Host</span></span>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '8px 10px', overflow: 'auto' }}>
          {nav.map((item, i) => {
            if (item.divider) return (
              <div key={i} className="sidebar-label" style={{ marginTop: 16 }}>{item.label}</div>
            );
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <item.icon size={16} />
                {item.label}
                {item.label === 'Activity' && unreadCount > 0 && (
                  <span className="nav-badge">{unreadCount}</span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)', textTransform: 'capitalize' }}>{user?.plan} plan</div>
            </div>
            <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
          <NavLink to="/dashboard/activity" className="nav-link" style={{ position: 'relative' }}>
            <Bell size={15} /> Notifications
            {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
          </NavLink>
          <button className="nav-link" onClick={() => { logout(); navigate('/'); }} style={{ width: '100%', border: 'none', background: 'none', color: 'var(--red)', opacity: 0.8 }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
