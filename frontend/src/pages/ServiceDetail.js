import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { ExternalLink, RefreshCw, Square, RotateCcw, Globe, Clock, ChevronLeft, Eye, EyeOff, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { servicesAPI, deploysAPI } from '../api/client';

const STATUS_CLASS = { live:'badge-live', building:'badge-building', failed:'badge-failed', suspended:'badge-suspended', created:'badge-created' };

function LogEntry({ log }) {
  const t = log.ts ? format(new Date(log.ts), 'HH:mm:ss') : '';
  return (
    <div className={`log-entry log-${log.level || 'info'}`}>
      <span className="log-ts">{t}</span>
      <span className="log-msg">{log.msg || log.message}</span>
    </div>
  );
}

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [settings, setSettings] = useState(null);
  const logsRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, dRes] = await Promise.all([servicesAPI.get(id), servicesAPI.getDeployments(id)]);
      setService(sRes.data.service);
      setDeployments(dRes.data.deployments);
      if (!settings) setSettings({ ...sRes.data.service });
    } catch { navigate('/dashboard'); }
    finally { setLoading(false); }
  }, [id, navigate, settings]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!service) return;
    if (service.status === 'building') {
      const t = setInterval(fetchData, 3000);
      return () => clearInterval(t);
    }
  }, [service?.status, fetchData]);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const apiHost = (process.env.REACT_APP_API_URL || '').replace(/^https?:\/\//, '').replace('/api', '') || window.location.host;
    const ws = new WebSocket(`${proto}://${apiHost}/?serviceId=${id}`);
    ws.onmessage = e => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'log') {
          setLogs(prev => [...prev.slice(-500), d]);
          setTimeout(() => logsRef.current?.scrollTo({ top: 99999 }), 50);
        }
      } catch (err) {}
    };
    ws.onerror = () => {};
    return () => ws.close();
  }, [id]);

  const loadDeployLogs = async (deployId) => {
    try { const r = await deploysAPI.getLogs(deployId); setLogs(r.data.logs || []); setActiveTab('logs'); setTimeout(() => logsRef.current?.scrollTo({ top: 99999 }), 100); }
    catch { toast.error('Failed to load logs'); }
  };

  const handleDeploy = async () => {
    setDeploying(true); setLogs([]);
    try { await deploysAPI.deploy(id); toast.success('Deployment started!'); setActiveTab('logs'); setTimeout(fetchData, 1500); }
    catch (err) { toast.error(err.response?.data?.error || 'Deploy failed'); }
    finally { setDeploying(false); }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try { await servicesAPI.update(id, settings); toast.success('Settings saved!'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== service.name) return toast.error(`Type "${service.name}" to confirm`);
    try { await servicesAPI.delete(id); toast.success('Service deleted'); navigate('/dashboard'); }
    catch { toast.error('Delete failed'); }
  };

  const copyText = text => { navigator.clipboard.writeText(text); toast.success('Copied!'); };
  const sSet = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const sSetEnv = (i, f, v) => setSettings(s => { const ev = [...(s.envVars || [])]; ev[i] = { ...ev[i], [f]: v }; return { ...s, envVars: ev }; });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!service || !settings) return null;

  const apiBase = (process.env.REACT_APP_API_URL || '').replace('/api', '');
  const appUrl = `${apiBase}/app/${service.slug}`;
  const TABS = ['overview', 'logs', 'environment', 'settings'];
  const inp = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.875rem', outline: 'none', width: '100%' };

  return (
    <div className="page">
      <Link to="/dashboard" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <ChevronLeft size={14} /> All Services
      </Link>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, background: 'var(--accent-dim)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
            {{ web:'🌐', static:'📄', worker:'⚙️', cron:'⏰' }[service.type] || '🌐'}
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{service.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className={`badge ${STATUS_CLASS[service.status] || 'badge-created'}`}>{service.status}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{service.runtime} - {service.type}</span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          {service.status === 'live' && <a href={appUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><ExternalLink size={13} /> Open</a>}
          <button className="btn btn-success btn-sm" onClick={handleDeploy} disabled={deploying || service.status === 'building'}>
            <RefreshCw size={13} /> {deploying ? 'Starting...' : 'Deploy'}
          </button>
          {service.status === 'live' && <button className="btn btn-secondary btn-sm" onClick={() => servicesAPI.restart(id).then(fetchData)}><RotateCcw size={13} /> Restart</button>}
          {service.status === 'live' && <button className="btn btn-secondary btn-sm" onClick={() => servicesAPI.suspend(id).then(fetchData)}><Square size={13} /> Suspend</button>}
          {service.status === 'suspended' && <button className="btn btn-secondary btn-sm" onClick={() => servicesAPI.resume(id).then(fetchData)}>Resume</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 24 }}>
        <div className="card card-sm">
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>URL</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--blue)', cursor: 'pointer', wordBreak: 'break-all' }} onClick={() => copyText(appUrl)}><Globe size={11} style={{ display: 'inline', marginRight: 4 }} />{appUrl.replace('https://','').replace('http://','')}</div>
        </div>
        <div className="card card-sm"><div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>Deploys</div><div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{service.deployCount || 0}</div></div>
        <div className="card card-sm"><div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>Last Deploy</div><div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{service.lastDeployedAt ? formatDistanceToNow(new Date(service.lastDeployedAt), { addSuffix: true }) : 'Never'}</div></div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'logs' && service.status === 'building' && <span style={{ width: 6, height: 6, background: 'var(--yellow)', borderRadius: '50%', display: 'inline-block', marginLeft: 6 }} />}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: '0.9rem' }}>Deployment History</h3>
          {deployments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 24 }}>No deployments yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Status</th><th>Trigger</th><th>Duration</th><th>When</th><th></th></tr></thead>
                <tbody>
                  {deployments.map(d => (
                    <tr key={d._id}>
                      <td style={{ color: 'var(--text-muted)' }}>#{d.number}</td>
                      <td><span className={`badge ${STATUS_CLASS[d.status] || 'badge-created'}`}>{d.status}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{d.trigger}</td>
                      <td style={{ fontSize: '0.75rem' }}>{d.buildDuration ? `${d.buildDuration}s` : '-'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}</td>
                      <td><button className="btn btn-secondary btn-xs" onClick={() => loadDeployLogs(d._id)}>Logs</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Live Logs {service.status === 'building' && <span className="badge badge-building">LIVE</span>}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setLogs([])}>Clear</button>
          </div>
          <div className="log-terminal" ref={logsRef}>
            {logs.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No logs yet. Deploy to see output.</div> : logs.map((log, i) => <LogEntry key={i} log={log} />)}
          </div>
        </div>
      )}

      {activeTab === 'environment' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Environment Variables</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => sSet('envVars', [...(settings.envVars || []), { key: '', value: '' }])}><Plus size={13} /> Add</button>
          </div>
          <div className="card" style={{ marginBottom: 12 }}>
            {(settings.envVars || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>No environment variables.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(settings.envVars || []).map((ev, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8 }}>
                    <input style={inp} placeholder="KEY" value={ev.key} onChange={e => sSetEnv(i, 'key', e.target.value.toUpperCase())} />
                    <input style={inp} type={showValues[i] ? 'text' : 'password'} placeholder="value" value={ev.value} onChange={e => sSetEnv(i, 'value', e.target.value)} />
                    <button onClick={() => setShowValues(s => ({ ...s, [i]: !s[i] }))} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, cursor: 'pointer', color: 'var(--text-dim)' }}>{showValues[i] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    <button onClick={() => sSet('envVars', settings.envVars.filter((_, idx) => idx !== i))} style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 8, cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSaveSettings} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save & Redeploy'}</button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: '0.9rem' }}>General Settings</h3>
            <div className="form-group"><label className="form-label">Build Command</label><input style={inp} value={settings.buildCommand || ''} onChange={e => sSet('buildCommand', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Start Command</label><input style={inp} value={settings.startCommand || ''} onChange={e => sSet('startCommand', e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving} style={{ marginTop: 8 }}><Save size={14} /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
            <div className="flex" style={{ marginBottom: 14 }}><AlertTriangle size={16} color="var(--red)" /><h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--red)' }}>Danger Zone</h3></div>
            <label className="form-label">Type <strong style={{ color: 'var(--text)' }}>{service.name}</strong> to confirm</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={{ ...inp, flex: 1, borderColor: 'rgba(239,68,68,0.4)' }} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={service.name} />
              <button className="btn btn-danger" disabled={deleteConfirm !== service.name} onClick={handleDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
