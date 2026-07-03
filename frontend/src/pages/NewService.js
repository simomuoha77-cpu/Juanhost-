import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Github, Upload, ChevronRight, Check, Zap } from 'lucide-react';
import { servicesAPI, deploysAPI } from '../api/client';

const STEPS = ['Type', 'Source', 'Configure', 'Deploy'];
const SERVICE_TYPES = [
  { type: 'web', icon: '🌐', label: 'Web Service', desc: 'Node.js, Python - any HTTP server' },
  { type: 'static', icon: '📄', label: 'Static Site', desc: 'React, Vue, HTML/CSS/JS' },
  { type: 'worker', icon: '⚙️', label: 'Background Worker', desc: 'Long-running processes' },
  { type: 'cron', icon: '⏰', label: 'Cron Job', desc: 'Scheduled tasks' }
];

export default function NewService() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [zipFile, setZipFile] = useState(null);
  const [form, setForm] = useState({ name: '', type: '', sourceType: 'github', repo: '', branch: 'main', rootDir: '.', runtime: 'node', buildCommand: '', startCommand: '', port: 3000, envVars: [] });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setEnv = (i, field, val) => setForm(f => { const ev = [...f.envVars]; ev[i] = { ...ev[i], [field]: val }; return { ...f, envVars: ev }; });

  const selectType = (type) => { set('type', type); set('runtime', type === 'static' ? 'static' : 'node'); setStep(1); };

  const handleDeploy = async () => {
    if (!form.name) return toast.error('Service name required');
    if (form.sourceType === 'github' && !form.repo) return toast.error('GitHub repo required');
    if (form.sourceType === 'zip' && !zipFile) return toast.error('Please upload a ZIP file');
    setLoading(true);
    try {
      const { data } = await servicesAPI.create(form);
      const service = data.service;
      if (form.sourceType === 'zip' && zipFile) {
        const fd = new FormData(); fd.append('zip', zipFile);
        await servicesAPI.upload(service._id, fd);
      }
      await deploysAPI.deploy(service._id, { trigger: 'manual' });
      toast.success('Service created and deploying!');
      navigate(`/dashboard/services/${service._id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const canNext = () => { if (step === 0) return !!form.type; if (step === 1) return form.sourceType === 'zip' || !!form.repo; if (step === 2) return !!form.name; return true; };

  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">New Service</div><div className="page-subtitle">Configure and deploy in minutes</div></div></div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--bg-3)', fontSize: '0.72rem', fontWeight: 700 }}>
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: i === step ? 700 : 500, color: i === step ? 'var(--text)' : 'var(--text-muted)' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? 'var(--green)' : 'var(--border)', margin: '0 8px' }} />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>What are you deploying?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {SERVICE_TYPES.map(({ type, icon, label, desc }) => (
              <button key={type} onClick={() => selectType(type)} style={{ background: form.type === type ? 'var(--accent-dim)' : 'var(--bg-2)', border: `1px solid ${form.type === type ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: form.type === type ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>Connect your source</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[{ val: 'github', icon: <Github size={18} />, label: 'GitHub' }, { val: 'zip', icon: <Upload size={18} />, label: 'Upload ZIP' }].map(({ val, icon, label }) => (
              <button key={val} onClick={() => set('sourceType', val)} style={{ background: form.sourceType === val ? 'var(--accent-dim)' : 'var(--bg-2)', border: `1px solid ${form.sourceType === val ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: form.sourceType === val ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 600, fontSize: '0.88rem' }}>
                {icon} {label}
              </button>
            ))}
          </div>
          {form.sourceType === 'github' ? (
            <>
              <div className="form-group"><label className="form-label">Repository *</label><input className="input" placeholder="username/repository-name" value={form.repo} onChange={e => set('repo', e.target.value)} /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Branch</label><input className="input" placeholder="main" value={form.branch} onChange={e => set('branch', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Root Directory</label><input className="input" placeholder="." value={form.rootDir} onChange={e => set('rootDir', e.target.value)} /></div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">ZIP File *</label>
              <input type="file" accept=".zip" onChange={e => setZipFile(e.target.files[0])} style={{ color: 'var(--text)' }} />
              {zipFile && <div style={{ marginTop: 8, color: 'var(--green)', fontSize: '0.82rem' }}>{zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(1)} MB)</div>}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>Configure your service</h3>
          <div className="form-group"><label className="form-label">Service Name *</label><input className="input" placeholder="my-app" value={form.name} onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Build Command</label><input className="input" placeholder="npm run build" value={form.buildCommand} onChange={e => set('buildCommand', e.target.value)} /></div>
            {form.type !== 'static' && <div className="form-group"><label className="form-label">Start Command</label><input className="input" placeholder="node index.js" value={form.startCommand} onChange={e => set('startCommand', e.target.value)} /></div>}
          </div>
          <div style={{ marginTop: 4 }}>
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>Environment Variables</label>
              <button className="btn btn-secondary btn-xs" onClick={() => setForm(f => ({ ...f, envVars: [...f.envVars, { key: '', value: '' }] }))}>+ Add</button>
            </div>
            {form.envVars.map((ev, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="KEY" value={ev.key} onChange={e => setEnv(i, 'key', e.target.value.toUpperCase())} style={{ fontSize: '0.82rem' }} />
                <input className="input" placeholder="value" value={ev.value} onChange={e => setEnv(i, 'value', e.target.value)} style={{ fontSize: '0.82rem' }} />
                <button className="btn btn-danger btn-xs" onClick={() => setForm(f => ({ ...f, envVars: f.envVars.filter((_, idx) => idx !== i) }))}>X</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>Review & Deploy</h3>
          <div className="card" style={{ marginBottom: 16 }}>
            {[['Name', form.name], ['Type', form.type], ['Source', form.sourceType === 'github' ? `${form.repo}` : zipFile?.name || 'ZIP'], ['Build', form.buildCommand || '(none)'], ['Env Vars', `${form.envVars.filter(e => e.key).length}`]].map(([k, v]) => (
              <div key={k} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{k}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>{v}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-full" onClick={handleDeploy} disabled={loading} style={{ padding: 14 }}>
            <Zap size={16} /> {loading ? 'Deploying...' : `Deploy ${form.name || 'Service'}`}
          </button>
        </div>
      )}

      <div className="flex-between" style={{ marginTop: 28 }}>
        {step > 0 ? <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button> : <div />}
        {step < 3 && <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>Next <ChevronRight size={15} /></button>}
      </div>
    </div>
  );
}
