import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Globe, Clock, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { servicesAPI, dbAPI, activityAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const TYPE_ICONS = { web: '🌐', static: '📄', worker: '⚙️', cron: '⏰', private: '🔒' };

function ServiceCard({ s }) {
  const apiBase = (process.env.REACT_APP_API_URL || '').replace('/api', '');
  const appUrl = `${apiBase}/app/${s.slug}`;
  return (
    <Link to={`/dashboard/services/${s._id}`} className="service-card">
      <div className="service-card-header">
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="service-type-icon" style={{ background: 'var(--accent-dim)' }}>
            <span style={{ fontSize: '1.1rem' }}>{TYPE_ICONS[s.type] || '🌐'}</span>
          </div>
          <div>
            <div className="service-name">{s.name}</div>
            <div className="service-meta">{s.runtime} - {s.sourceType}</div>
          </div>
        </div>
        <span className={`badge badge-${s.status}`}>{s.status}</span>
      </div>
      <div className="service-url"><Globe size={11} />{appUrl.replace('https://', '').replace('http://', '')}</div>
      <div className="service-footer">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
          {s.lastDeployedAt ? formatDistanceToNow(new Date(s.lastDeployedAt), { addSuffix: true }) : 'Never deployed'}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>#{s.deployCount || 0} deploys</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [dbs, setDbs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([servicesAPI.list(), dbAPI.list(), activityAPI.list()])
      .then(([s, d, a]) => { setServices(s.data.services); setDbs(d.data.databases); setActivity(a.data.activities.slice(0, 8)); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const running = services.filter(s => s.status === 'live').length;
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Dashboard</div><div className="page-subtitle">Welcome back, {user?.name}</div></div>
        <Link to="/dashboard/new" className="btn btn-primary"><PlusCircle size={16} /> New Service</Link>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--accent)' }}>{services.length}</div><div className="stat-label">Total Services</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--green)' }}>{running}</div><div className="stat-label">Running</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--yellow)' }}>{dbs.length}</div><div className="stat-label">Databases</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--purple)', textTransform: 'capitalize' }}>{user?.plan}</div><div className="stat-label">Current Plan</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        <div>
          <div className="flex-between" style={{ marginBottom: 14 }}><h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Services</h2></div>
          {services.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon"><Zap size={24} /></div>
              <h3>No services yet</h3>
              <p>Deploy your first app from GitHub or a ZIP file.</p>
              <div className="empty-state-actions"><Link to="/dashboard/new" className="btn btn-primary"><PlusCircle size={15} /> Deploy First Service</Link></div>
            </div>
          ) : (
            <div className="services-grid">{services.map(s => <ServiceCard key={s._id} s={s} />)}</div>
          )}
        </div>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>Recent Activity</h2>
          <div className="card" style={{ padding: 0 }}>
            {activity.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No activity yet</div>
            ) : activity.map((a, i) => (
              <div key={a._id} style={{ padding: '12px 16px', borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{a.message}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
