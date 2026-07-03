import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { egAPI, domainsAPI, teamsAPI, notifAPI, activityAPI, adminAPI, authAPI, servicesAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Eye, EyeOff, Copy, CheckCircle, Clock, Save, Users, Globe, Layers, Bell, Shield, Lock } from 'lucide-react';

const inp = { background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', color:'var(--text)', fontFamily:'var(--mono)', fontSize:'0.875rem', outline:'none', width:'100%' };
const lbl = { display:'block', fontSize:'0.72rem', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', marginBottom:6 };
const Spinner = () => <div style={{ display:'flex', justifyContent:'center', padding:80 }}><div className="spinner" /></div>;

export function EnvGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [vars, setVars] = useState([{ key:'', value:'' }]);

  useEffect(() => { egAPI.list().then(r => setGroups(r.data.groups)).finally(() => setLoading(false)); }, []);

  const create = async () => {
    if (!name.trim()) return toast.error('Name required');
    try { const { data } = await egAPI.create({ name, vars: vars.filter(v => v.key) }); setGroups(g => [data.group, ...g]); setShowNew(false); setName(''); setVars([{ key:'', value:'' }]); toast.success('Created!'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };
  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this env group?')) return;
    try { await egAPI.delete(id); setGroups(g => g.filter(x => x._id !== id)); toast.success('Deleted'); } catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner />;
  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">Environment Groups</div><div className="page-subtitle">Shared env vars across services</div></div><button className="btn btn-primary" onClick={() => setShowNew(!showNew)}><Plus size={15} /> New Group</button></div>
      {showNew && (
        <div className="card" style={{ marginBottom:16, borderColor:'var(--accent)' }}>
          <div className="form-group"><label style={lbl}>Group Name</label><input style={inp} placeholder="production-secrets" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          {vars.map((v, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, marginBottom:8 }}>
              <input style={inp} placeholder="KEY" value={v.key} onChange={e => { const nv=[...vars]; nv[i]={...nv[i],key:e.target.value.toUpperCase()}; setVars(nv); }} />
              <input style={inp} placeholder="value" value={v.value} onChange={e => { const nv=[...vars]; nv[i]={...nv[i],value:e.target.value}; setVars(nv); }} />
              <button onClick={() => setVars(v => v.filter((_,idx)=>idx!==i))} className="btn btn-danger btn-sm">X</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setVars(v=>[...v,{key:'',value:''}])}><Plus size={13} /> Add Var</button>
            <button className="btn btn-primary btn-sm" onClick={create}>Create</button>
          </div>
        </div>
      )}
      {groups.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Layers size={24} /></div><h3>No environment groups</h3></div>
      ) : groups.map(g => (
        <div key={g._id} className="card" style={{ marginBottom:12 }}>
          <div className="flex-between">
            <div className="flex"><Layers size={16} color="var(--accent)" /><span style={{ fontWeight:700 }}>{g.name}</span><span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{g.vars?.length || 0} vars</span></div>
            <button className="btn btn-danger btn-xs" onClick={() => deleteGroup(g._id)}><Trash2 size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Domains() {
  const [domains, setDomains] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ domain:'', serviceId:'' });
  const [showAdd, setShowAdd] = useState(false);
  const [verifying, setVerifying] = useState({});
  const [dnsInfo, setDnsInfo] = useState(null);
  const [assigning, setAssigning] = useState({});

  useEffect(() => {
    Promise.all([domainsAPI.list(), servicesAPI.list()])
      .then(([d, s]) => { setDomains(d.data.domains); setServices(s.data.services || s.data); })
      .finally(() => setLoading(false));
  }, []);

  const add = async e => {
    e.preventDefault();
    try {
      const { data } = await domainsAPI.add(form);
      setDomains(d => [...d, data.domain]);
      setDnsInfo({ domain: form.domain, verifyTxt: data.verifyTxt, cname: data.cname });
      setShowAdd(false); setForm({ domain:'', serviceId:'' });
      toast.success('Domain added - now add the DNS records shown below');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };
  const verify = async (id) => {
    setVerifying(v => ({...v,[id]:true}));
    try { await domainsAPI.verify(id); toast.success('Verified!'); domainsAPI.list().then(r => setDomains(r.data.domains)); }
    catch (err) { toast.error(err.response?.data?.error || 'DNS not found yet - it can take a few minutes to propagate'); }
    finally { setVerifying(v => ({...v,[id]:false})); }
  };
  const assignTo = async (id, serviceId) => {
    if (!serviceId) return;
    setAssigning(a => ({...a,[id]:true}));
    try { await domainsAPI.assign(id, { serviceId }); toast.success('Domain connected to app!'); domainsAPI.list().then(r => setDomains(r.data.domains)); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed - verify the domain first'); }
    finally { setAssigning(a => ({...a,[id]:false})); }
  };
  const remove = async (id) => { if (!window.confirm('Remove?')) return; try { await domainsAPI.delete(id); setDomains(d => d.filter(x=>x._id!==id)); toast.success('Removed'); } catch { toast.error('Failed'); } };

  if (loading) return <Spinner />;
  const platform = process.env.REACT_APP_DOMAIN || 'juanhost.com';

  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">Domains</div><div className="page-subtitle">Every app gets a free subdomain automatically. Add your own domain here if you have one - it's optional.</div></div><button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add Domain</button></div>

      {showAdd && (
        <div className="card" style={{ marginBottom:16, borderColor:'var(--accent)' }}>
          <form onSubmit={add}>
            <div className="form-group"><label style={lbl}>Domain *</label><input style={inp} placeholder="myapp.com" value={form.domain} onChange={e => setForm(f => ({...f, domain:e.target.value.toLowerCase()}))} required /></div>
            <div className="form-group">
              <label style={lbl}>Connect to App (optional, can assign later)</label>
              <select style={inp} value={form.serviceId} onChange={e => setForm(f => ({...f, serviceId:e.target.value}))}>
                <option value="">Choose later</option>
                {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:8 }}><button className="btn btn-primary btn-sm" type="submit">Add</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowAdd(false)}>Cancel</button></div>
          </form>
        </div>
      )}

      {dnsInfo && (
        <div className="card" style={{ marginBottom:16, borderColor:'var(--yellow)' }}>
          <div style={{ fontWeight:700, marginBottom:8 }}>Add these DNS records at your domain registrar for {dnsInfo.domain}</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'0.8rem', background:'var(--bg-1)', padding:12, borderRadius:8, marginBottom:8, wordBreak:'break-all' }}>
            TXT &nbsp;{dnsInfo.verifyTxt}
          </div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'0.8rem', background:'var(--bg-1)', padding:12, borderRadius:8, wordBreak:'break-all' }}>
            {dnsInfo.cname}
          </div>
          <div style={{ fontSize:'0.78rem', color:'var(--text-dim)', marginTop:8 }}>DNS changes can take a few minutes to a few hours to take effect. Once added, come back and tap Verify below.</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop:10 }} onClick={() => setDnsInfo(null)}>Got it</button>
        </div>
      )}

      {domains.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Globe size={24} /></div><h3>No custom domains yet</h3><p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>Your apps already work fine at their free {platform} subdomain. Add a domain here only if you own one and want to use it instead.</p></div>
      ) : domains.map(d => (
        <div key={d._id} className="card" style={{ marginBottom:12 }}>
          <div className="flex-between">
            <div className="flex">{d.verified ? <CheckCircle size={16} color="var(--green)" /> : <Clock size={16} color="var(--yellow)" />}<span style={{ fontWeight:700 }}>{d.domain}</span></div>
            <div style={{ display:'flex', gap:6 }}>{!d.verified && <button className="btn btn-success btn-xs" onClick={() => verify(d._id)} disabled={verifying[d._id]}>{verifying[d._id]?'Checking...':'Verify'}</button>}<button className="btn btn-danger btn-xs" onClick={() => remove(d._id)}><Trash2 size={12} /></button></div>
          </div>
          {d.verified && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)' }}>
              <label style={lbl}>Connected app</label>
              <select style={inp} value={d.service?._id || d.service || ''} onChange={e => assignTo(d._id, e.target.value)} disabled={assigning[d._id]}>
                <option value="">Not connected</option>
                {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {!d.verified && <div style={{ marginTop:8, fontSize:'0.78rem', color:'var(--text-dim)' }}>Add the DNS TXT record, then tap Verify.</div>}
        </div>
      ))}
    </div>
  );
}

export function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [teamName, setTeamName] = useState('');

  useEffect(() => { teamsAPI.list().then(r => setTeams(r.data.teams)).finally(() => setLoading(false)); }, []);
  const createTeam = async () => { if (!teamName) return toast.error('Required'); try { const { data } = await teamsAPI.create({ name: teamName }); setTeams(t => [data.team,...t]); setShowNew(false); setTeamName(''); toast.success('Created!'); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } };

  if (loading) return <Spinner />;
  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">Teams</div><div className="page-subtitle">Collaborate with your team</div></div><button className="btn btn-primary" onClick={() => setShowNew(!showNew)}><Plus size={15} /> New Team</button></div>
      {showNew && (
        <div className="card" style={{ marginBottom:16, borderColor:'var(--accent)' }}>
          <div className="form-group"><label style={lbl}>Team Name</label><input style={inp} placeholder="Acme Corp" value={teamName} onChange={e => setTeamName(e.target.value)} autoFocus /></div>
          <div style={{ display:'flex', gap:8 }}><button className="btn btn-primary btn-sm" onClick={createTeam}>Create</button><button className="btn btn-secondary btn-sm" onClick={() => setShowNew(false)}>Cancel</button></div>
        </div>
      )}
      {teams.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><Users size={24} /></div><h3>No teams yet</h3></div> : teams.map(team => (
        <div key={team._id} className="card" style={{ marginBottom:14 }}>
          <div className="flex"><div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,var(--accent),var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>{team.name[0]}</div><div><div style={{ fontWeight:700 }}>{team.name}</div><div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{team.members?.length || 0} members</div></div></div>
        </div>
      ))}
    </div>
  );
}

export function Activity() {
  const { setUnreadCount } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { notifAPI.list().then(r => { setNotifs(r.data.notifications); setUnreadCount(0); }).finally(() => setLoading(false)); notifAPI.readAll().catch(() => {}); }, [setUnreadCount]);

  const NOTIF_ICONS = { deploy_success:'✅', deploy_fail:'❌', service_down:'🔴', info:'ℹ️' };
  if (loading) return <Spinner />;
  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">Activity</div><div className="page-subtitle">Notifications</div></div></div>
      {notifs.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><Bell size={24} /></div><h3>All caught up!</h3></div> : notifs.map(n => (
        <div key={n._id} className="card" style={{ marginBottom:10 }}>
          <div className="flex"><span style={{ fontSize:'1.1rem' }}>{NOTIF_ICONS[n.type]||'ℹ️'}</span><div><div style={{ fontWeight:700, fontSize:'0.88rem' }}>{n.title}</div><div style={{ fontSize:'0.8rem', color:'var(--text-dim)' }}>{n.message}</div><div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{formatDistanceToNow(new Date(n.createdAt), {addSuffix:true})}</div></div></div>
        </div>
      ))}
    </div>
  );
}

export function Billing() {
  const { user } = useAuth();
  const PLANS = [
    { id:'free', name:'Free', price:0, features:['3 services','1 database','100GB bandwidth'] },
    { id:'starter', name:'Starter', price:7, features:['10 services','3 databases','Custom domains'] },
    { id:'pro', name:'Pro', price:25, features:['Unlimited services','Unlimited databases','Team collab'] }
  ];
  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">Billing & Plans</div></div></div>
      <div className="card" style={{ marginBottom:20, borderLeft:'3px solid var(--accent)' }}>
        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase' }}>Current Plan</div>
        <div style={{ fontSize:'1.4rem', fontWeight:800, textTransform:'capitalize', color:'var(--accent)' }}>{user?.plan}</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14 }}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{ background:user?.plan===plan.id?'var(--accent-dim)':'var(--bg-2)', border:`1px solid ${user?.plan===plan.id?'var(--accent)':'var(--border)'}`, borderRadius:12, padding:20 }}>
            <div style={{ fontWeight:700, fontSize:'0.8rem', textTransform:'uppercase' }}>{plan.name}</div>
            <div style={{ fontSize:'1.8rem', fontWeight:900 }}>${plan.price}<span style={{ fontSize:'0.8rem', fontWeight:400 }}>/mo</span></div>
            {plan.features.map(f => <div key={f} style={{ display:'flex', alignItems:'center', gap:7, fontSize:'0.78rem', marginBottom:6 }}><CheckCircle size={12} color="var(--green)" />{f}</div>)}
            <button className={`btn ${user?.plan===plan.id?'btn-secondary':'btn-primary'} btn-full btn-sm`} disabled={user?.plan===plan.id} style={{ marginTop:14 }} onClick={() => toast('Contact admin to upgrade')}>{user?.plan===plan.id?'Current':'Upgrade'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccountSettings() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [password, setPassword] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (password.newPassword !== password.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try { await authAPI.changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword }); toast.success('Changed!'); setPassword({ currentPassword:'', newPassword:'', confirm:'' }); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">Account Settings</div></div></div>
      <div className="tabs">{[['profile','Profile'],['password','Password']].map(([t,l]) => <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{l}</button>)}</div>
      {tab === 'profile' && (
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1.3rem' }}>{user?.name?.[0]?.toUpperCase()}</div>
            <div><div style={{ fontWeight:700 }}>{user?.name}</div><div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{user?.email}</div></div>
          </div>
        </div>
      )}
      {tab === 'password' && (
        <div className="card">
          <h3 style={{ fontWeight:700, marginBottom:18, display:'flex', alignItems:'center', gap:8 }}><Lock size={16} /> Change Password</h3>
          <div className="form-group"><label style={lbl}>Current Password</label><input style={inp} type="password" value={password.currentPassword} onChange={e => setPassword(p=>({...p,currentPassword:e.target.value}))} /></div>
          <div className="grid-2">
            <div className="form-group"><label style={lbl}>New Password</label><input style={inp} type="password" value={password.newPassword} onChange={e => setPassword(p=>({...p,newPassword:e.target.value}))} /></div>
            <div className="form-group"><label style={lbl}>Confirm</label><input style={inp} type="password" value={password.confirm} onChange={e => setPassword(p=>({...p,confirm:e.target.value}))} /></div>
          </div>
          <button className="btn btn-primary" onClick={changePassword} disabled={saving}><Lock size={14} /> {saving?'Changing...':'Change Password'}</button>
        </div>
      )}
    </div>
  );
}

export function AdminPanel() {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try { const [s,u,sv] = await Promise.all([adminAPI.stats(),adminAPI.users(),adminAPI.services()]); setStats(s.data.stats); setUsers(u.data.users); setServices(sv.data.services); }
    catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const toggleUser = async (id, isActive) => { try { await adminAPI.updateUser(id, { isActive: !isActive }); setUsers(u => u.map(x => x.id===id ? {...x,isActive:!isActive} : x)); toast.success('Updated'); } catch { toast.error('Failed'); } };
  const deleteService = async (id) => { if (!window.confirm('Delete?')) return; try { await adminAPI.deleteService(id); setServices(s => s.filter(x => x._id!==id)); toast.success('Deleted'); } catch { toast.error('Failed'); } };

  if (loading) return <Spinner />;
  return (
    <div className="page">
      <div className="page-header"><div className="page-title" style={{ display:'flex', alignItems:'center', gap:10 }}><Shield size={24} /> Admin Panel</div></div>
      <div className="tabs">{[['stats','Stats'],['users',`Users (${users.length})`],['services',`Services (${services.length})`]].map(([t,l]) => <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{l}</button>)}</div>
      {tab === 'stats' && stats && (
        <div className="stats-grid">
          {[['Users',stats.users,'var(--blue)'],['Services',stats.services,'var(--accent)'],['Running',stats.running,'var(--green)'],['Databases',stats.databases,'var(--yellow)'],['Deployments',stats.deployments,'var(--purple)']].map(([l,v,c]) => (
            <div key={l} className="stat-card"><div className="stat-value" style={{ color:c }}>{v}</div><div className="stat-label">{l}</div></div>
          ))}
        </div>
      )}
      {tab === 'users' && (
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {users.map(u => (
              <tr key={u.id}><td>{u.name}<div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{u.email}</div></td><td>{u.role}</td><td><span className={`badge badge-${u.isActive?'live':'failed'}`}>{u.isActive?'Active':'Inactive'}</span></td>
              <td><button className={`btn btn-xs ${u.isActive?'btn-danger':'btn-success'}`} onClick={() => toggleUser(u.id, u.isActive)}>{u.isActive?'Deactivate':'Activate'}</button></td></tr>
            ))}
          </tbody></table></div>
        </div>
      )}
      {tab === 'services' && (
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap"><table><thead><tr><th>Service</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {services.map(s => (
              <tr key={s._id}><td>{s.name}</td><td>{s.owner?.username}</td><td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
              <td><button className="btn btn-danger btn-xs" onClick={() => deleteService(s._id)}><Trash2 size={11} /></button></td></tr>
            ))}
          </tbody></table></div>
        </div>
      )}
    </div>
  );
}
