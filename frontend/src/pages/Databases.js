import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Database, Plus, Copy, Eye, EyeOff, Trash2, ChevronLeft, RefreshCw } from 'lucide-react';
import { dbAPI } from '../api/client';

const DB_ICONS = { postgresql: '🐘', mysql: '🐬', mongodb: '🍃', redis: '🔴' };
const DB_COLORS = { postgresql: '#3b82f6', mysql: '#f59e0b', mongodb: '#10b981', redis: '#ef4444' };

export function Databases() {
  const [dbs, setDbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'postgresql', version: '', plan: 'free', region: 'local' });

  useEffect(() => {
    dbAPI.list().then(r => setDbs(r.data.databases)).finally(() => setLoading(false));
  }, []);

  const create = async e => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await dbAPI.create(form);
      setDbs(d => [data.database, ...d]);
      setShowNew(false);
      setForm({ name: '', type: 'postgresql', version: '', plan: 'free', region: 'local' });
      toast.success('Database created!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Databases</div>
          <div className="page-subtitle">Managed PostgreSQL, MySQL, MongoDB, Redis</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(!showNew)}>
          <Plus size={15} /> New Database
        </button>
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 18, fontSize: '0.95rem' }}>Create Database</h3>
          <form onSubmit={create}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="input" placeholder="my-database" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mongodb">MongoDB</option>
                  <option value="redis">Redis</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select className="select" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="free">Free (expires 90 days)</option>
                  <option value="starter">Starter — $7/mo</option>
                  <option value="standard">Standard — $20/mo</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Region</label>
                <select className="select" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="local">Local</option>
                  <option value="us-east">US East</option>
                  <option value="eu-west">EU West</option>
                  <option value="ap-southeast">Asia Pacific</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Database'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {dbs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Database size={24} /></div>
          <h3>No databases yet</h3>
          <p>Create a managed database. We handle backups, scaling, and maintenance.</p>
          <div className="empty-state-actions">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={15} /> Create Database</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {dbs.map(db => (
            <Link key={db._id} to={`/dashboard/databases/${db._id}`} className="card card-clickable" style={{ textDecoration: 'none' }}>
              <div className="flex-between" style={{ marginBottom: 14 }}>
                <div className="flex">
                  <span style={{ fontSize: '1.5rem' }}>{DB_ICONS[db.type] || '🗄️'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{db.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'capitalize' }}>{db.type} · {db.region}</div>
                  </div>
                </div>
                <span className={`badge badge-${db.status}`}>{db.status}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                <span>localhost:{db.port}</span>
                <span>{formatDistanceToNow(new Date(db.createdAt), { addSuffix: true })}</span>
              </div>
              {db.plan === 'free' && db.expiresAt && (
                <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--yellow-dim)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--yellow)' }}>
                  ⚠️ Free plan expires {formatDistanceToNow(new Date(db.expiresAt), { addSuffix: true })}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DatabaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [showConnStr, setShowConnStr] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    dbAPI.get(id).then(r => setDb(r.data.database)).catch(() => navigate('/dashboard/databases')).finally(() => setLoading(false));
  }, [id, navigate]);

  const copy = text => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  const handleDelete = async () => {
    if (deleteConfirm !== db.name) return toast.error(`Type "${db.name}" to confirm`);
    try { await dbAPI.delete(id); toast.success('Database deleted'); navigate('/dashboard/databases'); }
    catch { toast.error('Delete failed'); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!db) return null;

  const color = DB_COLORS[db.type] || '#6366f1';
  const inp = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.82rem', outline: 'none', width: '100%' };

  return (
    <div className="page page-md">
      <Link to="/dashboard/databases" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <ChevronLeft size={14} /> All Databases
      </Link>

      <div className="page-header">
        <div className="flex">
          <span style={{ fontSize: '2rem' }}>{DB_ICONS[db.type] || '🗄️'}</span>
          <div>
            <div className="page-title">{db.name}</div>
            <div className="flex" style={{ marginTop: 4 }}>
              <span className={`badge badge-${db.status}`}>{db.status}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)', textTransform: 'capitalize' }}>{db.type} · {db.plan} plan · {db.region}</span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <span className="badge badge-free">{db.sizeGB}GB</span>
          <span className="badge badge-free">Max {db.maxConnections} connections</span>
        </div>
      </div>

      {/* Connection Info */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 18, fontSize: '0.9rem' }}>Connection Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[
            ['Host', db.host], ['Port', db.port],
            ['Database', db.dbName], ['Username', db.username]
          ].map(([k, v]) => (
            <div key={k}>
              <label className="form-label">{k}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={inp} value={v || ''} readOnly />
                <button className="btn btn-secondary btn-sm" onClick={() => copy(String(v))}><Copy size={12} /></button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Password</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={inp} type={showPass ? 'text' : 'password'} value={db.password || '••••••••••••'} readOnly />
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPass(s => !s)}>{showPass ? <EyeOff size={12} /> : <Eye size={12} />}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => copy(db.password)}><Copy size={12} /></button>
          </div>
        </div>

        <div>
          <label className="form-label">Connection String</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={inp} type={showConnStr ? 'text' : 'password'} value={db.connectionString || ''} readOnly />
            <button className="btn btn-secondary btn-sm" onClick={() => setShowConnStr(s => !s)}>{showConnStr ? <EyeOff size={12} /> : <Eye size={12} />}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => copy(db.connectionString)}><Copy size={12} /></button>
          </div>
          <div className="form-hint">Use in your app as DATABASE_URL or MONGO_URI etc.</div>
        </div>
      </div>

      {/* Backups */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Backups</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 3 }}>Automated daily backups with 7-day retention</p>
          </div>
          <span className={`badge badge-${db.backupEnabled ? 'live' : 'suspended'}`}>{db.backupEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-1)', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
          {db.lastBackupAt ? (
            <span>Last backup: {formatDistanceToNow(new Date(db.lastBackupAt), { addSuffix: true })}</span>
          ) : (
            <span>No backups yet. Backups run daily at midnight UTC.</span>
          )}
        </div>
        {db.plan === 'free' && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--yellow-dim)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--yellow)' }}>
            ⚠️ Free plan: no point-in-time recovery. <Link to="/dashboard/billing" style={{ color: 'var(--yellow)', fontWeight: 700 }}>Upgrade</Link> for full backups.
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
        <div className="flex" style={{ marginBottom: 12 }}>
          <span style={{ color: 'var(--red)', fontSize: '1rem' }}>⚠️</span>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--red)' }}>Delete Database</h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.6 }}>
          All data will be permanently deleted. This cannot be undone.
        </p>
        <label className="form-label">Type <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{db.name}</strong> to confirm</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input" style={{ flex: 1, borderColor: 'rgba(239,68,68,0.4)' }} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={db.name} />
          <button className="btn btn-danger" disabled={deleteConfirm !== db.name} onClick={handleDelete}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </div>
  );
}

export default Databases;
