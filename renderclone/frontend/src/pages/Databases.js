import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Database, Plus, Copy, Eye, EyeOff, Trash2, ChevronLeft } from 'lucide-react';
import { dbAPI } from '../api/client';

const DB_ICONS = { postgresql: '🐘', mysql: '🐬', mongodb: '🍃', redis: '🔴' };

export function Databases() {
  const [dbs, setDbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'postgresql', plan: 'free', region: 'local' });

  useEffect(() => { dbAPI.list().then(r => setDbs(r.data.databases)).finally(() => setLoading(false)); }, []);

  const create = async e => {
    e.preventDefault(); setCreating(true);
    try { const { data } = await dbAPI.create(form); setDbs(d => [data.database, ...d]); setShowNew(false); setForm({ name: '', type: 'postgresql', plan: 'free', region: 'local' }); toast.success('Database created!'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Databases</div><div className="page-subtitle">Managed PostgreSQL, MySQL, MongoDB, Redis</div></div>
        <button className="btn btn-primary" onClick={() => setShowNew(!showNew)}><Plus size={15} /> New Database</button>
      </div>
      {showNew && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 18, fontSize: '0.95rem' }}>Create Database</h3>
          <form onSubmit={create}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Name *</label><input className="input" placeholder="my-database" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus /></div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="mongodb">MongoDB</option><option value="redis">Redis</option>
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
        <div className="empty-state"><div className="empty-state-icon"><Database size={24} /></div><h3>No databases yet</h3><p>Create a managed database with automated backups.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {dbs.map(db => (
            <Link key={db._id} to={`/dashboard/databases/${db._id}`} className="card card-clickable" style={{ textDecoration: 'none' }}>
              <div className="flex-between" style={{ marginBottom: 14 }}>
                <div className="flex"><span style={{ fontSize: '1.5rem' }}>{DB_ICONS[db.type] || '🗄️'}</span><div><div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{db.name}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{db.type}</div></div></div>
                <span className={`badge badge-${db.status}`}>{db.status}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(db.createdAt), { addSuffix: true })}</div>
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
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => { dbAPI.get(id).then(r => setDb(r.data.database)).catch(() => navigate('/dashboard/databases')).finally(() => setLoading(false)); }, [id, navigate]);

  const copy = text => { navigator.clipboard.writeText(text); toast.success('Copied!'); };
  const handleDelete = async () => {
    if (deleteConfirm !== db.name) return toast.error(`Type "${db.name}" to confirm`);
    try { await dbAPI.delete(id); toast.success('Deleted'); navigate('/dashboard/databases'); }
    catch { toast.error('Delete failed'); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!db) return null;

  const inp = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.82rem', outline: 'none', width: '100%' };

  return (
    <div className="page page-md">
      <Link to="/dashboard/databases" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}><ChevronLeft size={14} /> All Databases</Link>
      <div className="page-header">
        <div className="flex"><span style={{ fontSize: '2rem' }}>{DB_ICONS[db.type] || '🗄️'}</span><div><div className="page-title">{db.name}</div><span className={`badge badge-${db.status}`}>{db.status}</span></div></div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 18, fontSize: '0.9rem' }}>Connection Details</h3>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          {[['Host', db.host], ['Port', db.port], ['Database', db.dbName], ['Username', db.username]].map(([k, v]) => (
            <div key={k}><label className="form-label">{k}</label><div style={{ display: 'flex', gap: 6 }}><input style={inp} value={v || ''} readOnly /><button className="btn btn-secondary btn-sm" onClick={() => copy(String(v))}><Copy size={12} /></button></div></div>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Password</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={inp} type={showPass ? 'text' : 'password'} value={db.password || ''} readOnly />
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPass(s => !s)}>{showPass ? <EyeOff size={12} /> : <Eye size={12} />}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => copy(db.password)}><Copy size={12} /></button>
          </div>
        </div>
        <div>
          <label className="form-label">Connection String</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={inp} type={showPass ? 'text' : 'password'} value={db.connectionString || ''} readOnly />
            <button className="btn btn-secondary btn-sm" onClick={() => copy(db.connectionString)}><Copy size={12} /></button>
          </div>
        </div>
      </div>
      <div className="card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--red)', marginBottom: 12 }}>Delete Database</h3>
        <label className="form-label">Type <strong style={{ color: 'var(--text)' }}>{db.name}</strong> to confirm</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input" style={{ flex: 1, borderColor: 'rgba(239,68,68,0.4)' }} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} />
          <button className="btn btn-danger" disabled={deleteConfirm !== db.name} onClick={handleDelete}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </div>
  );
}
