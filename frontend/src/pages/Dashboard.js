import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Globe, Clock, Zap, Database, Activity, ArrowRight, GitBranch, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { servicesAPI, dbAPI, activityAPI, metricsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const TYPE_COLORS = { web: '#6366f1', static: '#10b981', worker: '#f59e0b', cron: '#8b5cf6', private: '#3b82f6' };
const TYPE_ICONS = { web: '🌐', static: '📄', worker: '⚙️', cron: '⏰', private: '🔒' };

function ServiceCard({ s }) {
  const domain = process.env.REACT_APP_DOMAIN || 'juanhost.com';
  const color = TYPE_COLORS[s.type] || '#6366f1';
  return (
    <Link to={`/dashboard/services/${s._id}`} className="service-card">
      <div className="service-card-header">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div className="service-type-icon" style={{ background: `${color}1a` }}>
            <span style={{ fontSize: '1.1rem' }}>{TYPE_ICONS[s.type] || '🌐'}</span>
          </div>
          <div>
            <div className="service-name">{s.name}</div>
            <div className="service-meta">{s.runtime} · {s.sourceType}</div>
          </div>
        </div>
        <span className={`badge badge-${s.status}`}>{s.status}</span>
      </div>

      <div className="service-url">
        <Globe size={11} />
        {s.subdomain}.{domain}
      </div>

      <div className="service-footer">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} />
          {s.lastDeployedAt ? formatDistanceToNow(new Date(s.lastDeployedAt), { addSuffix: true }) : 'Never deployed'}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          #{s.deployCount || 0} deploys
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [dbs, setDbs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [sysMetrics, setSysMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      servicesAPI.list(),
      dbAPI.list(),
      activityAPI.list(),
      metricsAPI.system()
    ]).then(([s, d, a, m]) => {
      setServices(s.data.services);
      setDbs(d.data.databases);
      setActivity(a.data.activities.slice(0, 8));
      setSysMetrics(m.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const running = services.filter(s => s.status === 'live').length;
  const failed = services.filter(s => s.status === 'failed').length;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome back, {user?.name} 👋</div>
        </div>
        <Link to="/dashboard/new" className="btn btn-primary">
          <PlusCircle size={16} /> New Service
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{services.length}</div>
          <div className="stat-label">Total Services</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{running}</div>
          <div className="stat-label">Running</div>
        </div>
        {failed > 0 && (
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--red)' }}>{failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{dbs.length}</div>
          <div className="stat-label">Databases</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--purple)', textTransform: 'capitalize' }}>{user?.plan}</div>
          <div className="stat-label">Current Plan</div>
        </div>
        {sysMetrics && (
          <div className="stat-card">
            <div className="stat-value" style={{ color: sysMetrics.mem?.percent > 80 ? 'var(--red)' : 'var(--blue)' }}>{sysMetrics.mem?.percent || 0}%</div>
            <div className="stat-label">Memory Used</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div>
          {/* Services */}
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Services</h2>
            <Link to="/dashboard/new" style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
              New <ArrowRight size={13} />
            </Link>
          </div>

          {services.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon"><Zap size={24} /></div>
              <h3>No services yet</h3>
              <p>Deploy your first app in under a minute — from GitHub or a ZIP file.</p>
              <div className="empty-state-actions">
                <Link to="/dashboard/new" className="btn btn-primary"><PlusCircle size={15} /> Deploy First Service</Link>
              </div>
            </div>
          ) : (
            <div className="services-grid">
              {services.map(s => <ServiceCard key={s._id} s={s} />)}
            </div>
          )}

          {/* Databases quick */}
          {dbs.length > 0 && (
            <>
              <div className="flex-between" style={{ margin: '28px 0 14px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Databases</h2>
                <Link to="/dashboard/databases" style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ArrowRight size={13} /></Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {dbs.map(db => (
                  <Link key={db._id} to={`/dashboard/databases/${db._id}`} className="card card-sm card-clickable" style={{ textDecoration: 'none' }}>
                    <div className="flex-between">
                      <div className="flex">
                        <span style={{ fontSize: '1.2rem' }}>🗄️</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{db.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{db.type}</div>
                        </div>
                      </div>
                      <span className={`badge badge-${db.status}`}>{db.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Activity feed */}
        <div>
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Activity</h2>
            <Link to="/dashboard/activity" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>View all</Link>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {activity.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No activity yet</div>
            ) : (
              activity.map((a, i) => (
                <div key={a._id} style={{ padding: '12px 16px', borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>{a.message}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Plan usage */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 14 }}>Plan Usage</div>
            {[
              { label: 'Services', used: services.length, max: user?.planLimits?.maxServices || 3, color: 'var(--accent)' },
              { label: 'Databases', used: dbs.length, max: user?.planLimits?.maxDatabases || 1, color: 'var(--yellow)' },
            ].map(({ label, used, max, color }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div className="flex-between" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{label}</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--mono)', color }}>{used}/{max}</span>
                </div>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${Math.min((used/max)*100, 100)}%`, background: color }} />
                </div>
              </div>
            ))}
            <Link to="/dashboard/billing" className="btn btn-secondary btn-full btn-sm" style={{ marginTop: 8 }}>
              Upgrade Plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
