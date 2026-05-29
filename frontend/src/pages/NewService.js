import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Github, Upload, Globe, Code, Settings, Cpu, ChevronRight, Check, Zap } from 'lucide-react';
import { servicesAPI, deploysAPI } from '../api/client';

const STEPS = ['Type', 'Source', 'Configure', 'Deploy'];

const SERVICE_TYPES = [
  { type: 'web', icon: '🌐', label: 'Web Service', desc: 'Node.js, Python, Ruby, Go, Rust — any HTTP server' },
  { type: 'static', icon: '📄', label: 'Static Site', desc: 'React, Vue, HTML/CSS/JS — served via CDN' },
  { type: 'worker', icon: '⚙️', label: 'Background Worker', desc: 'Long-running processes, queues, jobs' },
  { type: 'cron', icon: '⏰', label: 'Cron Job', desc: 'Scheduled tasks on a cron schedule' },
  { type: 'private', icon: '🔒', label: 'Private Service', desc: 'Internal APIs not exposed to internet' }
];

const RUNTIMES = [
  { val: 'node', label: 'Node.js', icon: '🟢', versions: ['20', '18', '16'] },
  { val: 'python', label: 'Python', icon: '🐍', versions: ['3.12', '3.11', '3.10'] },
  { val: 'ruby', label: 'Ruby', icon: '💎', versions: ['3.2', '3.1'] },
  { val: 'go', label: 'Go', icon: '🐹', versions: ['1.21', '1.20'] },
  { val: 'static', label: 'Static', icon: '📄', versions: [] },
  { val: 'docker', label: 'Docker', icon: '🐳', versions: [] }
];

const DEFAULT_CMDS = {
  node: { build: 'npm install', start: 'node index.js' },
  python: { build: 'pip install -r requirements.txt', start: 'python app.py' },
  ruby: { build: 'bundle install', start: 'ruby app.rb' },
  go: { build: 'go build -o app', start: './app' },
  static: { build: 'npm run build', start: '' },
  docker: { build: '', start: '' }
};

export default function NewService() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [zipFile, setZipFile] = useState(null);
  const [form, setForm] = useState({
    name: '', type: '', sourceType: 'github', repo: '', branch: 'main', rootDir: '.',
    runtime: 'node', nodeVersion: '18', buildCommand: '', startCommand: '', port: 3000,
    envVars: [], plan: 'free', cronSchedule: '0 * * * *', healthCheckPath: '/', healthCheckEnabled: false,
    autoDeployEnabled: true
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setEnv = (i, field, val) => setForm(f => { const ev = [...f.envVars]; ev[i] = { ...ev[i], [field]: val }; return { ...f, envVars: ev }; });

  const selectType = (type) => {
    const rt = type === 'static' ? 'static' : form.runtime;
    set('type', type);
    set('runtime', rt);
    set('buildCommand', DEFAULT_CMDS[rt]?.build || '');
    set('startCommand', DEFAULT_CMDS[rt]?.start || '');
    setStep(1);
  };

  const selectRuntime = (rt) => {
    set('runtime', rt);
    set('buildCommand', DEFAULT_CMDS[rt]?.build || '');
    set('startCommand', DEFAULT_CMDS[rt]?.start || '');
    if (rt === 'node') set('nodeVersion', '18');
  };

  const handleDeploy = async () => {
    if (!form.name) return toast.error('Service name required');
    if (form.sourceType === 'github' && !form.repo) return toast.error('GitHub repo required (username/repo)');
    if (form.sourceType === 'zip' && !zipFile) return toast.error('Please upload a ZIP file');
    setLoading(true);
    try {
      const { data } = await servicesAPI.create(form);
      const service = data.service;

      if (form.sourceType === 'zip' && zipFile) {
        const fd = new FormData();
        fd.append('zip', zipFile);
        await servicesAPI.upload(service._id, fd);
      }

      await deploysAPI.deploy(service._id, { trigger: 'manual' });
      toast.success('🚀 Service created and deploying!');
      navigate(`/dashboard/services/${service._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create service');
    } finally { setLoading(false); }
  };

  const canNext = () => {
    if (step === 0) return !!form.type;
    if (step === 1) return form.sourceType === 'zip' || !!form.repo;
    if (step === 2) return !!form.name;
    return true;
  };

  return (
    <div className="page page-md">
      <div className="page-header">
        <div>
          <div className="page-title">New Service</div>
          <div className="page-subtitle">Configure and deploy in minutes</div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, gap: 0 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--bg-3)', border: `2px solid ${i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--border)'}`, fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s', flexShrink: 0 }}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: i === step ? 700 : 500, color: i === step ? 'var(--text)' : 'var(--text-muted)' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? 'var(--green)' : 'var(--border)', margin: '0 8px', minWidth: 20, transition: 'all 0.2s' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 0: Type */}
      {step === 0 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>What are you deploying?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {SERVICE_TYPES.map(({ type, icon, label, desc }) => (
              <button key={type} onClick={() => selectType(type)} style={{ background: form.type === type ? 'var(--accent-dim)' : 'var(--bg-2)', border: `1px solid ${form.type === type ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 18, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: form.type === type ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 1: Source */}
      {step === 1 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>Connect your source</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[{ val: 'github', icon: <Github size={18} />, label: 'GitHub' }, { val: 'zip', icon: <Upload size={18} />, label: 'Upload ZIP' }].map(({ val, icon, label }) => (
              <button key={val} onClick={() => set('sourceType', val)} style={{ background: form.sourceType === val ? 'var(--accent-dim)' : 'var(--bg-2)', border: `1px solid ${form.sourceType === val ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: form.sourceType === val ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'var(--font)', fontWeight: 600, fontSize: '0.88rem' }}>
                {icon} {label}
              </button>
            ))}
          </div>

          {form.sourceType === 'github' ? (
            <>
              <div className="form-group">
                <label className="form-label">Repository *</label>
                <input className="input" placeholder="username/repository-name" value={form.repo} onChange={e => set('repo', e.target.value)} />
                <div className="form-hint">e.g. torvalds/linux or myname/my-app</div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input className="input" placeholder="main" value={form.branch} onChange={e => set('branch', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Root Directory</label>
                  <input className="input" placeholder="." value={form.rootDir} onChange={e => set('rootDir', e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">ZIP File *</label>
              <input type="file" accept=".zip" onChange={e => setZipFile(e.target.files[0])} style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text)' }} />
              <div className="form-hint">Max 500MB. Must contain your full app directory.</div>
              {zipFile && <div style={{ marginTop: 8, color: 'var(--green)', fontSize: '0.82rem', fontFamily: 'var(--mono)' }}>✅ {zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(1)} MB)</div>}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Configure */}
      {step === 2 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>Configure your service</h3>

          <div className="form-group">
            <label className="form-label">Service Name *</label>
            <input className="input" placeholder="my-awesome-app" value={form.name} onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            <div className="form-hint">Lowercase letters, numbers, hyphens only</div>
          </div>

          {/* Runtime */}
          {form.type !== 'static' && (
            <div className="form-group">
              <label className="form-label">Runtime</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                {RUNTIMES.filter(r => r.val !== 'static' || form.type === 'static').map(rt => (
                  <button key={rt.val} onClick={() => selectRuntime(rt.val)} style={{ background: form.runtime === rt.val ? 'var(--accent-dim)' : 'var(--bg-2)', border: `1px solid ${form.runtime === rt.val ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', color: form.runtime === rt.val ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'var(--font)', fontSize: '0.78rem', fontWeight: 600 }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{rt.icon}</div>
                    {rt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.runtime === 'node' && (
            <div className="form-group">
              <label className="form-label">Node Version</label>
              <select className="select" value={form.nodeVersion} onChange={e => set('nodeVersion', e.target.value)}>
                <option value="20">Node 20 (LTS)</option>
                <option value="18">Node 18</option>
                <option value="16">Node 16</option>
              </select>
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Build Command</label>
              <input className="input" placeholder="npm run build" value={form.buildCommand} onChange={e => set('buildCommand', e.target.value)} />
            </div>
            {form.type !== 'static' && (
              <div className="form-group">
                <label className="form-label">Start Command</label>
                <input className="input" placeholder="node index.js" value={form.startCommand} onChange={e => set('startCommand', e.target.value)} />
              </div>
            )}
          </div>

          {form.type === 'cron' && (
            <div className="form-group">
              <label className="form-label">Cron Schedule</label>
              <input className="input" placeholder="0 * * * *" value={form.cronSchedule} onChange={e => set('cronSchedule', e.target.value)} />
              <div className="form-hint">Standard cron syntax. e.g. "0 2 * * *" runs at 2am daily.</div>
            </div>
          )}

          {form.type !== 'static' && form.type !== 'cron' && (
            <div className="form-group">
              <label className="form-label">Port</label>
              <input className="input" type="number" value={form.port} onChange={e => set('port', parseInt(e.target.value))} />
              <div className="form-hint">Your app must listen on process.env.PORT</div>
            </div>
          )}

          {/* Env vars */}
          <div style={{ marginTop: 4 }}>
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>Environment Variables</label>
              <button className="btn btn-secondary btn-xs" onClick={() => setForm(f => ({ ...f, envVars: [...f.envVars, { key: '', value: '' }] }))}>+ Add</button>
            </div>
            {form.envVars.map((ev, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="KEY" value={ev.key} onChange={e => setEnv(i, 'key', e.target.value.toUpperCase())} style={{ fontSize: '0.82rem' }} />
                <input className="input" placeholder="value" value={ev.value} onChange={e => setEnv(i, 'value', e.target.value)} style={{ fontSize: '0.82rem' }} />
                <button className="btn btn-danger btn-xs" onClick={() => setForm(f => ({ ...f, envVars: f.envVars.filter((_, idx) => idx !== i) }))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Review & Deploy */}
      {step === 3 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: '0.95rem', fontWeight: 700 }}>Review & Deploy</h3>
          <div className="card" style={{ marginBottom: 16 }}>
            {[
              ['Service Name', form.name],
              ['Type', form.type],
              ['Runtime', form.runtime],
              ['Source', form.sourceType === 'github' ? `github.com/${form.repo} (${form.branch})` : zipFile?.name || 'ZIP'],
              ['Build Command', form.buildCommand || '(none)'],
              ['Start Command', form.startCommand || '(none)'],
              ['Env Variables', `${form.envVars.filter(e => e.key).length} defined`],
              ...(form.type === 'cron' ? [['Schedule', form.cronSchedule]] : [])
            ].map(([k, v]) => (
              <div key={k} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{k}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: 14, background: 'var(--accent-dim)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', marginBottom: 16, fontSize: '0.83rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent)' }}>What happens next:</strong><br />
            Your code will be cloned/extracted → dependencies installed → build command run → app started on an available port → accessible via subdomain.
          </div>

          <button className="btn btn-primary btn-full" onClick={handleDeploy} disabled={loading} style={{ padding: 14, fontSize: '1rem' }}>
            <Zap size={16} /> {loading ? 'Creating & Deploying...' : `Deploy ${form.name || 'Service'}`}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-between" style={{ marginTop: 28 }}>
        {step > 0 ? (
          <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>← Back</button>
        ) : <div />}
        {step < 3 && (
          <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
            Next <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
