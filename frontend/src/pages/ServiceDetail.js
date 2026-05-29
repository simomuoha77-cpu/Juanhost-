import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ExternalLink, RefreshCw, Square, RotateCcw, Globe, Clock, ChevronLeft, Copy, Eye, EyeOff, Plus, Trash2, Save, AlertTriangle, Terminal, BarChart2 } from 'lucide-react';
import { servicesAPI, deploysAPI, domainsAPI } from '../api/client';
import toast2 from 'react-hot-toast';

const STATUS_CLASS = { live:'badge-live', building:'badge-building', failed:'badge-failed', suspended:'badge-suspended', created:'badge-created', deploying:'badge-building' };

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
  const [metrics, setMetrics] = useState([]);
  const [domains, setDomains] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [shellCmd, setShellCmd] = useState('');
  const [shellOutput, setShellOutput] = useState([]);
  const [settings, setSettings] = useState(null);
  const logsRef = useRef(null);
  const wsRef = useRef(null);
  const domain = process.env.REACT_APP_DOMAIN || 'juanhost.com';

  const fetchData = useCallback(async () => {
    try {
      const [sRes, dRes] = await Promise.all([servicesAPI.get(id), servicesAPI.getDeployments(id)]);
      setService(sRes.data.service);
      setDeployments(dRes.data.deployments);
      if (!settings) setSettings({ ...sRes.data.service });
    } catch { navigate('/dashboard'); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh when building
  useEffect(() => {
    if (!service) return;
    if (service.status === 'building') {
      const t = setInterval(fetchData, 3000);
      return () => clearInterval(t);
    }
  }, [service?.status, fetchData]);

  // WebSocket for live logs
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/logs?serviceId=${id}&token=${localStorage.getItem('jh_token')}`);
    wsRef.current = ws;
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.type === 'log') {
        setLogs(prev => [...prev.slice(-500), d]);
        setTimeout(() => logsRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
      }
    };
    ws.onerror = () => {};
    return () => ws.close();
  }, [id]);

  // Load metrics when tab active
  useEffect(() => {
    if (activeTab === 'metrics') {
      servicesAPI.getMetrics(id, 6).then(r => setMetrics(r.data.metrics)).catch(() => {});
    }
    if (activeTab === 'domains') {
      domainsAPI.list().then(r => setDomains(r.data.domains.filter(d => d.service?._id === id || d.service === id))).catch(() => {});
    }
  }, [activeTab, id]);

  const loadDeployLogs = async (deployId) => {
    try {
      const r = await deploysAPI.getLogs(deployId);
      setLogs(r.data.logs || []);
      setActiveTab('logs');
      setTimeout(() => logsRef.current?.scrollTo({ top: 99999 }), 100);
    } catch { toast.error('Failed to load logs'); }
  };

  const handleDeploy = async () => {
    setDeploying(true); setLogs([]);
    try {
      await deploysAPI.deploy(id);
      toast.success('Deployment started! 🚀');
      setActiveTab('logs');
      setTimeout(fetchData, 1500);
    } catch (err) { toast.error(err.response?.data?.error || 'Deploy failed'); }
    finally { setDeploying(false); }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await servicesAPI.update(id, settings);
      toast.success('Settings saved!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== service.name) return toast.error(`Type "${service.name}" to confirm`);
    try {
      await servicesAPI.delete(id);
      toast.success('Service deleted');
      navigate('/dashboard');
    } catch { toast.error('Delete failed'); }
  };

  const handleAddDomain = async () => {
    if (!newDomain) return;
    try {
      const r = await domainsAPI.add({ domain: newDomain, serviceId: id });
      toast.success('Domain added! Set up DNS to verify.');
      setDomains(d => [...d, r.data.domain]);
      setNewDomain('');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleVerifyDomain = async (dId) => {
    try {
      await domainsAPI.verify(dId);
      toast.success('Domain verified! ✅');
      domainsAPI.list().then(r => setDomains(r.data.domains.filter(d => d.service === id)));
    } catch (err) { toast.error(err.response?.data?.error || 'Verify failed'); }
  };

  const copyText = text => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  const sSet = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const sSetEnv = (i, f, v) => setSettings(s => { const ev = [...(s.envVars || [])]; ev[i] = { ...ev[i], [f]: v }; return { ...s, envVars: ev }; });

  const runShell = () => {
    if (!shellCmd) return;
    const output = `[${format(new Date(), 'HH:mm:ss')}] $ ${shellCmd}\n⚠️  Remote shell available when deployed to a VPS with Docker. Connect via: ssh user@yourserver then docker exec -it juanhost-${service?.slug} /bin/sh`;
    setShellOutput(o => [...o, output]);
    setShellCmd('');
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!service || !settings) return null;

  const appUrl = `http://${service.subdomain}.${domain}`;
  const TABS = ['overview', 'logs', 'metrics', 'environment', 'domains', 'settings', 'shell'];

  const inp = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.875rem', outline: 'none', width: '100%' };

  return (
    <div className="page">
      {/* Back */}
      <Link to="/dashboard" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <ChevronLeft size={14} /> All Services
      </Link>

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, background: 'var(--accent-dim)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
            {{ web:'🌐', static:'📄', worker:'⚙️', cron:'⏰', private:'🔒' }[service.type] || '🌐'}
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{service.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className={`badge ${STATUS_CLASS[service.status] || 'badge-created'}`}>{service.status}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{service.runtime} · {service.type}</span>
              {service.healthStatus && <span className={`badge badge-${service.healthStatus}`}>{service.healthStatus}</span>}
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
          {service.status === 'suspended' && <button className="btn btn-secondary btn-sm" onClick={() => servicesAPI.resume(id).then(fetchData)}>▶ Resume</button>}
        </div>
      </div>

      {/* Info bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'URL', val: <span style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => copyText(appUrl)}><Globe size={11} style={{ display: 'inline', marginRight: 4 }} />{service.subdomain}.{domain}</span> },
          { label: 'Port', val: service.assignedPort || '—' },
          { label: 'Deploys', val: service.deployCount || 0 },
          { label: 'Last Deploy', val: service.lastDeployedAt ? formatDistanceToNow(new Date(service.lastDeployedAt), { addSuffix: true }) : 'Never' }
        ].map(({ label, val }) => (
          <div key={label} className="card card-sm">
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'logs' && service.status === 'building' && <span style={{ width: 6, height: 6, background: 'var(--yellow)', borderRadius: '50%', display: 'inline-block', marginLeft: 6 }} />}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
            {/* Deployment history */}
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: '0.9rem' }}>Deployment History</h3>
              {deployments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 24 }}>No deployments yet</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Status</th><th>Trigger</th><th>Commit</th><th>Duration</th><th>When</th><th></th></tr></thead>
                    <tbody>
                      {deployments.map(d => (
                        <tr key={d._id}>
                          <td style={{ fontFamily: 'var(--mono)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{d.number}</td>
                          <td><span className={`badge ${STATUS_CLASS[d.status] || 'badge-created'}`}>{d.status}</span></td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>{d.trigger}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>{d.commitHash ? <span style={{ color: 'var(--blue)' }}>{d.commitHash}</span> : '—'}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>{d.buildDuration ? `${d.buildDuration}s` : '—'}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-secondary btn-xs" onClick={() => loadDeployLogs(d._id)}>Logs</button>
                              {d.status === 'live' && <button className="btn btn-secondary btn-xs" onClick={() => servicesAPI.rollback(id, d._id).then(fetchData)}>Rollback</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Service info */}
            <div>
              <div className="card" style={{ marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.88rem' }}>Service Info</h3>
                {[
                  ['Type', service.type], ['Runtime', service.runtime],
                  ['Source', service.sourceType === 'github' ? `${service.repo} (${service.branch})` : 'ZIP'],
                  ['Build', service.buildCommand || '(none)'],
                  ['Start', service.startCommand || '(none)'],
                  ['Region', service.region || 'local'],
                  ['Auto Deploy', service.autoDeployEnabled ? '✅ On' : '❌ Off']
                ].map(([k, v]) => (
                  <div key={k} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{k}</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.88rem' }}>Deploy Hook</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.6 }}>POST to this URL to trigger a deploy from external systems:</p>
                <div className="code-block" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {window.location.protocol}//{window.location.hostname}:5000/api/hooks/deploy/{service.deployHookToken}
                  </span>
                  <button className="copy-btn" onClick={() => copyText(`${window.location.protocol}//${window.location.hostname}:5000/api/hooks/deploy/${service.deployHookToken}`)}>
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.88rem' }}>GitHub Webhook</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.6 }}>Add this in GitHub → Repo Settings → Webhooks:</p>
                <div className="code-block" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {window.location.protocol}//{window.location.hostname}:5000/api/hooks/github/{id}
                  </span>
                  <button className="copy-btn" onClick={() => copyText(`${window.location.protocol}//${window.location.hostname}:5000/api/hooks/github/${id}`)}>
                    <Copy size={12} />
                  </button>
                </div>
                <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Content type: application/json</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGS */}
      {activeTab === 'logs' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              Live Logs
              {service.status === 'building' && <span className="badge badge-building">LIVE</span>}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setLogs([])}>Clear</button>
          </div>
          <div className="log-terminal" ref={logsRef}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>
                {service.status === 'building' ? '⏳ Connecting to live logs...' : '— Deploy to see logs. Or click "Logs" on a deployment above.'}
              </div>
            ) : logs.map((log, i) => <LogEntry key={i} log={log} />)}
          </div>
        </div>
      )}

      {/* METRICS */}
      {activeTab === 'metrics' && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: '0.9rem' }}>Performance Metrics (last 6h)</h3>
          {metrics.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon"><BarChart2 size={24} /></div>
              <h3>No metrics yet</h3>
              <p>Metrics are collected every 30 seconds once your service is running.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { key: 'cpuPercent', label: 'CPU Usage (%)', color: '#6366f1', unit: '%' },
                { key: 'memUsedMB', label: 'Memory (MB)', color: '#10b981', unit: 'MB' },
                { key: 'netInKB', label: 'Network In (KB)', color: '#f59e0b', unit: 'KB' },
                { key: 'netOutKB', label: 'Network Out (KB)', color: '#8b5cf6', unit: 'KB' }
              ].map(({ key, label, color, unit }) => (
                <div key={key} className="card">
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 16, color }}>{label}</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={metrics} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#252545" />
                      <XAxis dataKey="timestamp" tickFormatter={v => format(new Date(v), 'HH:mm')} tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                      <Tooltip contentStyle={{ background: '#111128', border: '1px solid #252545', borderRadius: 6, fontSize: '0.75rem' }} labelFormatter={v => format(new Date(v), 'HH:mm:ss')} formatter={v => [`${v} ${unit}`, label]} />
                      <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ENVIRONMENT */}
      {activeTab === 'environment' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Environment Variables</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 3 }}>Available as <code style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>process.env.KEY</code></p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => sSet('envVars', [...(settings.envVars || []), { key: '', value: '' }])}>
              <Plus size={13} /> Add Variable
            </button>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            {(settings.envVars || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No environment variables. Click "Add Variable".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8 }}>
                  <span className="form-label">Key</span>
                  <span className="form-label">Value</span>
                </div>
                {(settings.envVars || []).map((ev, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
                    <input style={inp} placeholder="KEY_NAME" value={ev.key} onChange={e => sSetEnv(i, 'key', e.target.value.toUpperCase().replace(/\s/g, '_'))} />
                    <input style={inp} type={showValues[i] ? 'text' : 'password'} placeholder="value" value={ev.value} onChange={e => sSetEnv(i, 'value', e.target.value)} />
                    <button onClick={() => setShowValues(s => ({ ...s, [i]: !s[i] }))} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, cursor: 'pointer', color: 'var(--text-dim)' }}>
                      {showValues[i] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => sSet('envVars', settings.envVars.filter((_, idx) => idx !== i))} style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 8, cursor: 'pointer', color: 'var(--red)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSaveSettings} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save & Redeploy'}
          </button>
        </div>
      )}

      {/* DOMAINS */}
      {activeTab === 'domains' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>Custom Domains</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 3 }}>Connect your own domain to this service</p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>Platform URL (always active)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="code-block" style={{ flex: 1, fontSize: '0.82rem' }}>{service.subdomain}.{domain}</div>
              <button className="copy-btn btn btn-secondary btn-sm" onClick={() => copyText(`${service.subdomain}.${domain}`)}>
                <Copy size={13} />
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 12 }}>Add Custom Domain</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="myapp.com or app.myapp.com" value={newDomain} onChange={e => setNewDomain(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={handleAddDomain}>Add Domain</button>
            </div>
          </div>

          {domains.length > 0 && (
            <div className="card">
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 12 }}>Your Domains</div>
              {domains.map(d => (
                <div key={d._id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-between" style={{ marginBottom: d.verified ? 0 : 10 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.9rem' }}>{d.domain}</div>
                    <span className={`badge badge-${d.verified ? 'live' : 'building'}`}>{d.verified ? 'Verified' : 'Pending'}</span>
                  </div>
                  {!d.verified && (
                    <div style={{ background: 'var(--bg-1)', borderRadius: 8, padding: 12, marginTop: 10, fontSize: '0.78rem', fontFamily: 'var(--mono)' }}>
                      <div style={{ color: 'var(--yellow)', marginBottom: 6 }}>⚠️ Add these DNS records:</div>
                      <div style={{ marginBottom: 4 }}>TXT <span style={{ color: 'var(--green)' }}>_juanhost-verify.{d.domain}</span> = <span style={{ color: 'var(--accent)' }}>{d.verificationToken}</span></div>
                      <div style={{ marginBottom: 8 }}>CNAME <span style={{ color: 'var(--green)' }}>{d.domain}</span> = <span style={{ color: 'var(--accent)' }}>{domain}</span></div>
                      <button className="btn btn-success btn-sm" onClick={() => handleVerifyDomain(d._id)}>Verify DNS</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SETTINGS */}
      {activeTab === 'settings' && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: '0.9rem' }}>General Settings</h3>
            <div className="form-group">
              <label className="form-label">Build Command</label>
              <input style={inp} value={settings.buildCommand || ''} onChange={e => sSet('buildCommand', e.target.value)} placeholder="npm run build" />
            </div>
            <div className="form-group">
              <label className="form-label">Start Command</label>
              <input style={inp} value={settings.startCommand || ''} onChange={e => sSet('startCommand', e.target.value)} placeholder="node index.js" />
            </div>
            {settings.runtime === 'node' && (
              <div className="form-group">
                <label className="form-label">Node Version</label>
                <select style={inp} value={settings.nodeVersion || '18'} onChange={e => sSet('nodeVersion', e.target.value)}>
                  <option value="20">Node 20 (LTS)</option><option value="18">Node 18</option><option value="16">Node 16</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Health Check Path</label>
              <input style={inp} value={settings.healthCheckPath || '/'} onChange={e => sSet('healthCheckPath', e.target.value)} placeholder="/" />
            </div>
            <div className="flex-between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Health Checks</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>Monitor and alert if service goes down</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={settings.healthCheckEnabled} onChange={e => sSet('healthCheckEnabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="flex-between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Auto Deploy</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>Deploy on every git push</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={settings.autoDeployEnabled} onChange={e => sSet('autoDeployEnabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving} style={{ marginTop: 16 }}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
            <div className="flex" style={{ marginBottom: 14 }}>
              <AlertTriangle size={16} color="var(--red)" />
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--red)' }}>Danger Zone</h3>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.6 }}>
              Permanently delete this service, all deployments, and all logs. This cannot be undone.
            </p>
            <label className="form-label">Type <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{service.name}</strong> to confirm</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={{ ...inp, flex: 1, borderColor: 'rgba(239,68,68,0.4)' }} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={service.name} />
              <button className="btn btn-danger" disabled={deleteConfirm !== service.name} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* SHELL */}
      {activeTab === 'shell' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={16} /> Shell Access
            </h3>
            <span className={`badge ${service.status === 'live' ? 'badge-live' : 'badge-suspended'}`}>
              {service.status === 'live' ? 'Connected' : 'Service offline'}
            </span>
          </div>

          {service.status !== 'live' ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Terminal size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>Service must be running to access shell.</p>
            </div>
          ) : (
            <>
              <div style={{ background: '#04040e', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: '#0c0c1d', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{service.name} — bash</span>
                </div>
                <div style={{ padding: 16, fontFamily: 'var(--mono)', fontSize: '0.8rem', minHeight: 300, maxHeight: 400, overflow: 'auto' }}>
                  <div style={{ color: 'var(--green)' }}>Welcome to JuanHost Shell — {service.name}</div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>Type commands below. For VPS deploy, uses docker exec.</div>
                  {shellOutput.map((o, i) => <div key={i} style={{ whiteSpace: 'pre-wrap', color: '#c8d3e0', marginBottom: 4, lineHeight: 1.6 }}>{o}</div>)}
                </div>
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <span style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: '0.82rem', flexShrink: 0 }}>$</span>
                  <input
                    style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.82rem', outline: 'none', padding: '10px 0' }}
                    placeholder="Enter command..."
                    value={shellCmd}
                    onChange={e => setShellCmd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runShell()}
                  />
                  <button onClick={runShell} style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', color: '#fff', fontFamily: 'var(--mono)', fontSize: '0.8rem', cursor: 'pointer' }}>Run</button>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, fontFamily: 'var(--mono)' }}>
                Full shell available when deployed on VPS with Docker: docker exec -it juanhost-{service.slug} /bin/sh
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
