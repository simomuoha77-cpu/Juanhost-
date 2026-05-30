import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { egAPI, domainsAPI, teamsAPI, notifAPI, activityAPI, adminAPI, authAPI, metricsAPI, servicesAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Eye, EyeOff, Copy, CheckCircle, Clock, Save, Users, Globe, Layers, Bell, Settings, Shield, CreditCard, Activity as ActivityIcon, Lock, Key, Upload } from 'lucide-react';

// ─── Shared helpers ──────────────────────────────────────────
const inp = { background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', color:'var(--text)', fontFamily:'var(--mono)', fontSize:'0.875rem', outline:'none', width:'100%' };
const lbl = { display:'block', fontSize:'0.72rem', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, fontFamily:'var(--mono)' };
const Spinner = () => <div style={{ display:'flex', justifyContent:'center', padding:80 }}><div className="spinner" /></div>;

// ════════════════════════════════════════════════════════════
// ENV GROUPS
// ════════════════════════════════════════════════════════════
export function EnvGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  const [vars, setVars] = useState([{ key:'', value:'' }]);
  const [showVals, setShowVals] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { egAPI.list().then(r => setGroups(r.data.groups)).finally(() => setLoading(false)); }, []);

  const create = async () => {
    if (!name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      const { data } = await egAPI.create({ name, vars: vars.filter(v => v.key) });
      setGroups(g => [data.group, ...g]);
      setShowNew(false); setName(''); setVars([{ key:'', value:'' }]);
      toast.success('Env group created!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const saveGroup = async (g) => {
    try {
      const { data } = await egAPI.update(g._id, { name: g.name, vars: g.vars });
      setGroups(gs => gs.map(x => x._id === g._id ? data.group : x));
      toast.success('Saved!');
    } catch { toast.error('Save failed'); }
  };

  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this env group?')) return;
    try { await egAPI.delete(id); setGroups(g => g.filter(x => x._id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="page page-md">
      <div className="page-header">
        <div><div className="page-title">Environment Groups</div><div className="page-subtitle">Shared env vars across multiple services</div></div>
        <button className="btn btn-primary" onClick={() => setShowNew(!showNew)}><Plus size={15} /> New Group</button>
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom:16, borderColor:'var(--accent)' }}>
          <h3 style={{ fontWeight:700, marginBottom:16, fontSize:'0.9rem' }}>Create Environment Group</h3>
          <div className="form-group"><label style={lbl}>Group Name</label><input style={inp} placeholder="production-secrets" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          {vars.map((v, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, marginBottom:8 }}>
              <input style={inp} placeholder="KEY" value={v.key} onChange={e => { const nv=[...vars]; nv[i]={...nv[i],key:e.target.value.toUpperCase()}; setVars(nv); }} />
              <input style={inp} placeholder="value" value={v.value} onChange={e => { const nv=[...vars]; nv[i]={...nv[i],value:e.target.value}; setVars(nv); }} />
              <button onClick={() => setVars(v => v.filter((_,idx)=>idx!==i))} className="btn btn-danger btn-sm">✕</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setVars(v=>[...v,{key:'',value:''}])}><Plus size={13} /> Add Var</button>
            <button className="btn btn-primary btn-sm" onClick={create} disabled={saving}>{saving?'Creating...':'Create Group'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Layers size={24} /></div><h3>No environment groups</h3><p>Create shared env var groups to reuse across multiple services.</p></div>
      ) : groups.map(g => (
        <div key={g._id} className="card" style={{ marginBottom:12 }}>
          <div className="flex-between" style={{ marginBottom:12 }}>
            <div className="flex"><Layers size={16} color="var(--accent)" /><span style={{ fontWeight:700, fontSize:'0.9rem' }}>{g.name}</span><span style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{g.vars?.length || 0} vars · {g.linkedServices?.length || 0} services</span></div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-secondary btn-xs" onClick={() => setSelected(selected===g._id?null:g._id)}>{selected===g._id?'Close':'Edit'}</button>
              <button className="btn btn-danger btn-xs" onClick={() => deleteGroup(g._id)}><Trash2 size={12} /></button>
            </div>
          </div>
          {selected === g._id && (
            <div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {(g.vars||[]).map((v,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8 }}>
                    <input style={inp} value={v.key} onChange={e => { const ng={...g}; ng.vars[i]={...ng.vars[i],key:e.target.value.toUpperCase()}; setGroups(gs=>gs.map(x=>x._id===g._id?ng:x)); }} />
                    <input style={inp} type={showVals[`${g._id}-${i}`]?'text':'password'} value={v.value} onChange={e => { const ng={...g,vars:[...g.vars]}; ng.vars[i]={...ng.vars[i],value:e.target.value}; setGroups(gs=>gs.map(x=>x._id===g._id?ng:x)); }} />
                    <button onClick={() => setShowVals(s=>({...s,[`${g._id}-${i}`]:!s[`${g._id}-${i}`]}))} style={{ background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:6, padding:8, cursor:'pointer', color:'var(--text-dim)' }}>{showVals[`${g._id}-${i}`]?<EyeOff size={12}/>:<Eye size={12}/>}</button>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-xs" onClick={() => { const ng={...g,vars:[...(g.vars||[]),{key:'',value:''}]}; setGroups(gs=>gs.map(x=>x._id===g._id?ng:x)); }}><Plus size={12} /> Add</button>
                <button className="btn btn-primary btn-xs" onClick={() => saveGroup(g)}><Save size={12} /> Save</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DOMAINS
// ════════════════════════════════════════════════════════════
export function Domains() {
  const [domains, setDomains] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ domain:'', serviceId:'' });
  const [showAdd, setShowAdd] = useState(false);
  const [verifying, setVerifying] = useState({});

  useEffect(() => {
    Promise.all([domainsAPI.list(), servicesAPI.list()])
      .then(([d,s]) => { setDomains(d.data.domains); setServices(s.data.services); })
      .finally(() => setLoading(false));
  }, []);

  const add = async e => {
    e.preventDefault();
    try {
      const { data } = await domainsAPI.add(form);
      setDomains(d => [...d, data.domain]);
      setShowAdd(false); setForm({ domain:'', serviceId:'' });
      toast.success('Domain added! Set up DNS to verify.');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const verify = async (id) => {
    setVerifying(v => ({...v,[id]:true}));
    try {
      await domainsAPI.verify(id);
      toast.success('Domain verified! ✅');
      domainsAPI.list().then(r => setDomains(r.data.domains));
    } catch (err) { toast.error(err.response?.data?.error || 'Not verified yet'); }
    finally { setVerifying(v => ({...v,[id]:false})); }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this domain?')) return;
    try { await domainsAPI.delete(id); setDomains(d => d.filter(x=>x._id!==id)); toast.success('Removed'); }
    catch { toast.error('Failed'); }
  };

  const copy = t => { navigator.clipboard.writeText(t); toast.success('Copied!'); };

  if (loading) return <Spinner />;

  const platform = process.env.REACT_APP_DOMAIN || 'juanhost.com';

  return (
    <div className="page page-md">
      <div className="page-header">
        <div><div className="page-title">Domains</div><div className="page-subtitle">Connect custom domains to your services</div></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add Domain</button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom:16, borderColor:'var(--accent)' }}>
          <h3 style={{ fontWeight:700, marginBottom:16, fontSize:'0.9rem' }}>Add Custom Domain</h3>
          <form onSubmit={add}>
            <div className="grid-2" style={{ marginBottom:12 }}>
              <div><label style={lbl}>Domain *</label><input style={inp} placeholder="myapp.com" value={form.domain} onChange={e => setForm(f=>({...f,domain:e.target.value.toLowerCase()}))} required /></div>
              <div><label style={lbl}>Assign to Service</label>
                <select style={inp} value={form.serviceId} onChange={e => setForm(f=>({...f,serviceId:e.target.value}))}>
                  <option value="">— None —</option>
                  {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" type="submit">Add Domain</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom:16, borderLeft:'3px solid var(--accent)' }}>
        <div style={{ fontWeight:700, fontSize:'0.88rem', marginBottom:4, display:'flex', alignItems:'center', gap:8 }}><Globe size={15} color="var(--accent)" /> Platform Subdomains</div>
        <p style={{ fontSize:'0.8rem', color:'var(--text-dim)', lineHeight:1.6 }}>Every service automatically gets: <code style={{ color:'var(--blue)', fontFamily:'var(--mono)' }}>servicename.{platform}</code></p>
      </div>

      {domains.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Globe size={24} /></div><h3>No custom domains</h3><p>Add your own domain and point it to any service.</p></div>
      ) : domains.map(d => (
        <div key={d._id} className="card" style={{ marginBottom:12 }}>
          <div className="flex-between" style={{ marginBottom: d.verified ? 0 : 12 }}>
            <div className="flex">
              {d.verified ? <CheckCircle size={16} color="var(--green)" /> : <Clock size={16} color="var(--yellow)" />}
              <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:'0.9rem' }}>{d.domain}</span>
              <span className={`badge badge-${d.verified?'live':'building'}`}>{d.verified?'Active':'Pending DNS'}</span>
              {d.service && <span className="tag">{d.service?.name || 'assigned'}</span>}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {!d.verified && <button className="btn btn-success btn-xs" onClick={() => verify(d._id)} disabled={verifying[d._id]}>{verifying[d._id]?'Checking...':'Verify DNS'}</button>}
              <button className="btn btn-danger btn-xs" onClick={() => remove(d._id)}><Trash2 size={12} /></button>
            </div>
          </div>
          {!d.verified && (
            <div className="code-block" style={{ fontSize:'0.75rem', lineHeight:1.9 }}>
              <div style={{ color:'var(--yellow)', marginBottom:4 }}>⚠️ Add these DNS records at your domain registrar:</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                <span style={{ flex:1 }}>TXT &nbsp;<span style={{ color:'var(--green)' }}>_juanhost-verify.{d.domain}</span>&nbsp;=&nbsp;<span style={{ color:'var(--accent)' }}>{d.verificationToken}</span></span>
                <button className="copy-btn" onClick={() => copy(d.verificationToken)}><Copy size={11} /></button>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ flex:1 }}>CNAME <span style={{ color:'var(--green)' }}>{d.domain}</span>&nbsp;→&nbsp;<span style={{ color:'var(--accent)' }}>{platform}</span></span>
                <button className="copy-btn" onClick={() => copy(platform)}><Copy size={11} /></button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TEAMS
// ════════════════════════════════════════════════════════════
export function Teams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [invitingTeam, setInvitingTeam] = useState(null);

  useEffect(() => { teamsAPI.list().then(r => setTeams(r.data.teams)).finally(() => setLoading(false)); }, []);

  const createTeam = async () => {
    if (!teamName) return toast.error('Team name required');
    try { const { data } = await teamsAPI.create({ name: teamName }); setTeams(t => [data.team,...t]); setShowNew(false); setTeamName(''); toast.success('Team created!'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const invite = async (teamId) => {
    if (!inviteEmail) return toast.error('Email required');
    try {
      const { data } = await teamsAPI.invite(teamId, { email: inviteEmail, role: inviteRole });
      toast.success('Invite sent!');
      navigator.clipboard.writeText(data.inviteLink);
      toast('Invite link copied to clipboard!');
      setInviteEmail(''); setInvitingTeam(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const removeMember = async (teamId, userId) => {
    if (!window.confirm('Remove this member?')) return;
    try { await teamsAPI.removeMember(teamId, userId); teamsAPI.list().then(r => setTeams(r.data.teams)); toast.success('Removed'); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="page page-md">
      <div className="page-header">
        <div><div className="page-title">Teams</div><div className="page-subtitle">Collaborate with your team members</div></div>
        <button className="btn btn-primary" onClick={() => setShowNew(!showNew)}><Plus size={15} /> New Team</button>
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom:16, borderColor:'var(--accent)' }}>
          <h3 style={{ fontWeight:700, marginBottom:14, fontSize:'0.9rem' }}>Create Team</h3>
          <div className="form-group"><label style={lbl}>Team Name</label><input style={inp} placeholder="Acme Corp" value={teamName} onChange={e => setTeamName(e.target.value)} autoFocus /></div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={createTeam}>Create</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon"><Users size={24} /></div><h3>No teams yet</h3><p>Create a team to collaborate with others on services and databases.</p></div>
      ) : teams.map(team => (
        <div key={team._id} className="card" style={{ marginBottom:14 }}>
          <div className="flex-between" style={{ marginBottom:16 }}>
            <div className="flex">
              <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg, var(--accent), var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1rem' }}>{team.name[0]}</div>
              <div><div style={{ fontWeight:700, fontSize:'0.95rem' }}>{team.name}</div><div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{team.members?.length || 0} members · {team.plan} plan</div></div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setInvitingTeam(invitingTeam===team._id?null:team._id)}>Invite Member</button>
          </div>

          {invitingTeam === team._id && (
            <div style={{ padding:14, background:'var(--bg-1)', borderRadius:8, border:'1px solid var(--border)', marginBottom:14 }}>
              <div className="grid-2" style={{ marginBottom:8 }}>
                <div><label style={lbl}>Email</label><input style={inp} type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
                <div><label style={lbl}>Role</label>
                  <select style={inp} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    <option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => invite(team._id)}>Send Invite</button>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(team.members||[]).map(m => (
              <div key={m.user?._id} className="flex-between" style={{ padding:'8px 10px', background:'var(--bg-1)', borderRadius:8 }}>
                <div className="flex">
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.78rem', color:'var(--accent)' }}>{m.user?.name?.[0]?.toUpperCase() || '?'}</div>
                  <div><div style={{ fontSize:'0.83rem', fontWeight:600 }}>{m.user?.name || 'Unknown'}</div><div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{m.user?.email}</div></div>
                </div>
                <div className="flex">
                  <span className="tag">{m.role}</span>
                  {m.user?._id !== user?._id && m.role !== 'owner' && (
                    <button className="btn btn-danger btn-xs" onClick={() => removeMember(team._id, m.user._id)}><Trash2 size={11} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ACTIVITY + NOTIFICATIONS
// ════════════════════════════════════════════════════════════
export function Activity() {
  const { setUnreadCount } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('notifications');

  useEffect(() => {
    Promise.all([notifAPI.list(), activityAPI.list()])
      .then(([n, a]) => { setNotifs(n.data.notifications); setActivities(a.data.activities); setUnreadCount(0); })
      .finally(() => setLoading(false));
    notifAPI.readAll().catch(() => {});
  }, [setUnreadCount]);

  const deleteNotif = async (id) => { await notifAPI.delete(id); setNotifs(n => n.filter(x => x._id !== id)); };

  const NOTIF_ICONS = { deploy_success:'✅', deploy_fail:'❌', service_down:'🔴', info:'ℹ️', warning:'⚠️' };

  if (loading) return <Spinner />;

  return (
    <div className="page page-md">
      <div className="page-header">
        <div><div className="page-title">Activity</div><div className="page-subtitle">Notifications and audit log</div></div>
        {tab === 'notifications' && notifs.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { notifAPI.readAll(); setNotifs(n => n.map(x=>({...x,read:true}))); }}>Mark all read</button>}
      </div>

      <div className="tabs">
        <button className={`tab ${tab==='notifications'?'active':''}`} onClick={() => setTab('notifications')}>Notifications ({notifs.filter(n=>!n.read).length} unread)</button>
        <button className={`tab ${tab==='activity'?'active':''}`} onClick={() => setTab('activity')}>Audit Log</button>
      </div>

      {tab === 'notifications' && (
        notifs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><Bell size={24} /></div><h3>All caught up!</h3><p>No notifications yet.</p></div>
        ) : notifs.map(n => (
          <div key={n._id} className="card" style={{ marginBottom:10, borderLeft:`3px solid ${n.read?'var(--border)':n.type==='deploy_fail'||n.type==='service_down'?'var(--red)':'var(--accent)'}`, opacity:n.read?0.7:1 }}>
            <div className="flex-between">
              <div className="flex" style={{ alignItems:'flex-start' }}>
                <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{NOTIF_ICONS[n.type]||'ℹ️'}</span>
                <div><div style={{ fontWeight:n.read?500:700, fontSize:'0.88rem' }}>{n.title}</div><div style={{ fontSize:'0.8rem', color:'var(--text-dim)', marginTop:2 }}>{n.message}</div><div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:3, fontFamily:'var(--mono)' }}>{formatDistanceToNow(new Date(n.createdAt), { addSuffix:true })}</div></div>
              </div>
              <button onClick={() => deleteNotif(n._id)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:4, flexShrink:0 }}>✕</button>
            </div>
          </div>
        ))
      )}

      {tab === 'activity' && (
        activities.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><ActivityIcon size={24} /></div><h3>No activity yet</h3><p>Actions like creating services and deploying will appear here.</p></div>
        ) : (
          <div className="card" style={{ padding:0 }}>
            {activities.map((a, i) => (
              <div key={a._id} style={{ padding:'12px 18px', borderBottom:i<activities.length-1?'1px solid var(--border)':'none', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', flexShrink:0 }}>
                  {a.type.includes('deploy')?'🚀':a.type.includes('delete')?'🗑️':a.type.includes('create')?'✨':'📝'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.85rem', fontWeight:500 }}>{a.message}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--mono)', marginTop:2 }}>{a.type} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix:true })}</div>
                </div>
                {a.service && <Link to={`/dashboard/services/${a.service._id}`} style={{ fontSize:'0.75rem', color:'var(--accent)', fontFamily:'var(--mono)' }}>{a.service.name}</Link>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BILLING
// ════════════════════════════════════════════════════════════
export function Billing() {
  const { user } = useAuth();
  const PLANS = [
    { id:'free', name:'Free', price:0, features:['3 web services','1 database','100GB bandwidth','400 build min/mo','Free subdomains'], color:'var(--text-dim)' },
    { id:'starter', name:'Starter', price:7, features:['10 services','3 databases','500GB bandwidth','2000 build min/mo','Custom domains + SSL','Priority deploys'], color:'var(--accent)', popular:true },
    { id:'pro', name:'Pro', price:25, features:['Unlimited services','Unlimited databases','Unlimited bandwidth','Unlimited build minutes','Custom domains + SSL','Team collaboration','Advanced analytics','Dedicated support'], color:'var(--purple)' },
  ];

  return (
    <div className="page page-md">
      <div className="page-header">
        <div><div className="page-title">Billing & Plans</div><div className="page-subtitle">Manage your subscription and usage</div></div>
      </div>

      {/* Current plan */}
      <div className="card" style={{ marginBottom:20, borderLeft:'3px solid var(--accent)' }}>
        <div className="flex-between">
          <div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--mono)', textTransform:'uppercase', marginBottom:4 }}>Current Plan</div>
            <div style={{ fontSize:'1.4rem', fontWeight:800, textTransform:'capitalize', color:'var(--accent)' }}>{user?.plan}</div>
            <div style={{ fontSize:'0.82rem', color:'var(--text-dim)', marginTop:4 }}>{user?.plan === 'free' ? 'Free forever · Upgrade anytime' : 'Billed monthly'}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'2rem', fontWeight:900 }}>${{ free:0, starter:7, pro:25, team:99 }[user?.plan] || 0}</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>/month</div>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, marginBottom:24 }}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{ background:user?.plan===plan.id?'var(--accent-dim)':'var(--bg-2)', border:`1px solid ${user?.plan===plan.id?'var(--accent)':'var(--border)'}`, borderRadius:12, padding:22, position:'relative' }}>
            {plan.popular && <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'var(--accent)', color:'#fff', fontSize:'0.65rem', fontWeight:700, padding:'2px 10px', borderRadius:10, fontFamily:'var(--mono)' }}>POPULAR</div>}
            <div style={{ fontWeight:700, fontSize:'0.8rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>{plan.name}</div>
            <div style={{ fontSize:'1.8rem', fontWeight:900, marginBottom:16 }}>${plan.price}<span style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:400 }}>/mo</span></div>
            {plan.features.map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7, fontSize:'0.78rem' }}>
                <CheckCircle size={12} color="var(--green)" style={{ flexShrink:0 }} />
                <span style={{ color:'var(--text-dim)' }}>{f}</span>
              </div>
            ))}
            <button className={`btn ${user?.plan===plan.id?'btn-secondary':'btn-primary'} btn-full btn-sm`} style={{ marginTop:14 }} disabled={user?.plan===plan.id} onClick={() => toast('Payment integration coming soon! Contact admin to upgrade.')}>
              {user?.plan===plan.id ? '✓ Current Plan' : `Upgrade to ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Usage */}
      <div className="card">
        <h3 style={{ fontWeight:700, marginBottom:16, fontSize:'0.9rem' }}>This Month's Usage</h3>
        {[
          { label:'Services Used', used:0, max:user?.planLimits?.maxServices||3, unit:'services', color:'var(--accent)' },
          { label:'Databases', used:0, max:user?.planLimits?.maxDatabases||1, unit:'databases', color:'var(--yellow)' },
          { label:'Build Minutes', used:user?.usageStats?.buildMinutesUsed||0, max:user?.planLimits?.buildMinutes||400, unit:'min', color:'var(--blue)' },
        ].map(({ label, used, max, unit, color }) => (
          <div key={label} style={{ marginBottom:16 }}>
            <div className="flex-between" style={{ marginBottom:6 }}>
              <span style={{ fontSize:'0.82rem', color:'var(--text-dim)' }}>{label}</span>
              <span style={{ fontSize:'0.78rem', fontFamily:'var(--mono)', color }}>{used}/{max} {unit}</span>
            </div>
            <div className="progress"><div className="progress-bar" style={{ width:`${Math.min((used/max)*100,100)}%`, background:color }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ACCOUNT SETTINGS
// ════════════════════════════════════════════════════════════
export function AccountSettings() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ name: user?.name||'', billingEmail: user?.billingEmail||'' });
  const [password, setPassword] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(user?.notificationPrefs || {});

  useEffect(() => { authAPI.getApiKeys().then(r => setApiKeys(r.data.keys)); }, []);

  const saveProfile = async () => {
    setSaving(true);
    try { const { data } = await authAPI.updateProfile(profile); updateUser(data.user); toast.success('Profile saved!'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (password.newPassword !== password.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try { await authAPI.changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword }); toast.success('Password changed!'); setPassword({ currentPassword:'', newPassword:'', confirm:'' }); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const createApiKey = async () => {
    if (!newKeyName) return toast.error('Key name required');
    try {
      const { data } = await authAPI.createApiKey({ name: newKeyName });
      toast.success(`Key created: ${data.key}`, { duration: 10000 });
      navigator.clipboard.writeText(data.key);
      toast('Key copied to clipboard! Save it — you won\'t see it again.', { duration: 8000 });
      setNewKeyName('');
      authAPI.getApiKeys().then(r => setApiKeys(r.data.keys));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const deleteKey = async (name) => {
    try { await authAPI.deleteApiKey(name); setApiKeys(k => k.filter(x => x.name !== name)); toast.success('Key deleted'); }
    catch { toast.error('Failed'); }
  };

  const saveNotifPrefs = async () => {
    try { await authAPI.updateProfile({ notificationPrefs: notifPrefs }); toast.success('Preferences saved!'); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="page page-md">
      <div className="page-header"><div><div className="page-title">Account Settings</div><div className="page-subtitle">Manage your profile and security</div></div></div>
      <div className="tabs">
        {[['profile','Profile'],['password','Password'],['notifications','Notifications'],['api-keys','API Keys']].map(([t,l]) => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="card">
          <h3 style={{ fontWeight:700, marginBottom:18, fontSize:'0.9rem' }}>Profile Information</h3>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, padding:14, background:'var(--bg-1)', borderRadius:10, border:'1px solid var(--border)' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1.3rem' }}>{user?.name?.[0]?.toUpperCase()}</div>
            <div><div style={{ fontWeight:700 }}>{user?.name}</div><div style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{user?.email}</div><div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2, textTransform:'capitalize' }}>{user?.role} · {user?.plan} plan</div></div>
          </div>
          <div className="grid-2" style={{ marginBottom:14 }}>
            <div className="form-group"><label style={lbl}>Full Name</label><input style={inp} value={profile.name} onChange={e => setProfile(p=>({...p,name:e.target.value}))} /></div>
            <div className="form-group"><label style={lbl}>Billing Email</label><input style={inp} type="email" placeholder={user?.email} value={profile.billingEmail} onChange={e => setProfile(p=>({...p,billingEmail:e.target.value}))} /></div>
          </div>
          <div className="form-group"><label style={lbl}>Username (cannot change)</label><input style={{ ...inp, opacity:0.6, cursor:'not-allowed' }} value={user?.username} disabled /></div>
          <div className="form-group"><label style={lbl}>Email (cannot change)</label><input style={{ ...inp, opacity:0.6, cursor:'not-allowed' }} value={user?.email} disabled /></div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}><Save size={14} /> {saving?'Saving...':'Save Profile'}</button>
        </div>
      )}

      {/* Password */}
      {tab === 'password' && (
        <div className="card">
          <h3 style={{ fontWeight:700, marginBottom:18, fontSize:'0.9rem', display:'flex', alignItems:'center', gap:8 }}><Lock size={16} /> Change Password</h3>
          <div className="form-group"><label style={lbl}>Current Password</label><input style={inp} type="password" placeholder="••••••••" value={password.currentPassword} onChange={e => setPassword(p=>({...p,currentPassword:e.target.value}))} /></div>
          <div className="grid-2">
            <div className="form-group"><label style={lbl}>New Password</label><input style={inp} type="password" placeholder="Min. 6 chars" value={password.newPassword} onChange={e => setPassword(p=>({...p,newPassword:e.target.value}))} /></div>
            <div className="form-group"><label style={lbl}>Confirm</label><input style={inp} type="password" placeholder="Repeat" value={password.confirm} onChange={e => setPassword(p=>({...p,confirm:e.target.value}))} /></div>
          </div>
          <button className="btn btn-primary" onClick={changePassword} disabled={saving}><Lock size={14} /> {saving?'Changing...':'Change Password'}</button>
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="card">
          <h3 style={{ fontWeight:700, marginBottom:18, fontSize:'0.9rem' }}>Notification Preferences</h3>
          {[['deploySuccess','Deploy Success','Notify when a deployment completes successfully'],['deployFail','Deploy Failed','Notify when a deployment fails'],['serviceDown','Service Down','Notify when health check fails'],['email','Email Notifications','Receive notifications via email']].map(([key, label, desc]) => (
            <div key={key} className="flex-between" style={{ padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
              <div><div style={{ fontWeight:600, fontSize:'0.88rem' }}>{label}</div><div style={{ fontSize:'0.78rem', color:'var(--text-dim)', marginTop:2 }}>{desc}</div></div>
              <label className="toggle"><input type="checkbox" checked={notifPrefs[key]??true} onChange={e => setNotifPrefs(p=>({...p,[key]:e.target.checked}))} /><span className="toggle-slider" /></label>
            </div>
          ))}
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={saveNotifPrefs}><Save size={14} /> Save Preferences</button>
        </div>
      )}

      {/* API Keys */}
      {tab === 'api-keys' && (
        <div>
          <div className="card" style={{ marginBottom:14 }}>
            <h3 style={{ fontWeight:700, marginBottom:8, fontSize:'0.9rem', display:'flex', alignItems:'center', gap:8 }}><Key size={16} /> Create API Key</h3>
            <p style={{ fontSize:'0.8rem', color:'var(--text-dim)', marginBottom:14, lineHeight:1.6 }}>Use API keys to access JuanHost from scripts or CI/CD pipelines via <code style={{ color:'var(--accent)', fontFamily:'var(--mono)' }}>X-Api-Key</code> header.</p>
            <div style={{ display:'flex', gap:8 }}>
              <input style={{ ...inp, flex:1 }} placeholder="Key name (e.g. github-actions)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} onKeyDown={e => e.key==='Enter' && createApiKey()} />
              <button className="btn btn-primary btn-sm" onClick={createApiKey}>Create Key</button>
            </div>
          </div>
          {apiKeys.length > 0 && (
            <div className="card">
              <h3 style={{ fontWeight:700, marginBottom:14, fontSize:'0.9rem' }}>Your API Keys</h3>
              {apiKeys.map(k => (
                <div key={k.name} className="flex-between" style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{k.name}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--mono)', marginTop:2 }}>{k.keyPreview} · Created {formatDistanceToNow(new Date(k.createdAt), {addSuffix:true})}</div>
                  </div>
                  <button className="btn btn-danger btn-xs" onClick={() => deleteKey(k.name)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ADMIN PANEL
// ════════════════════════════════════════════════════════════
export function AdminPanel() {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, u, sv] = await Promise.all([adminAPI.stats(), adminAPI.users(), adminAPI.services()]);
      setStats(s.data.stats);
      setUsers(u.data.users);
      setServices(sv.data.services);
    } catch { toast.error('Failed to load admin data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); const i = setInterval(() => adminAPI.stats().then(r => setStats(r.data.stats)).catch(()=>{}), 15000); return () => clearInterval(i); }, []);

  const toggleUser = async (id, isActive) => {
    try { await adminAPI.updateUser(id, { isActive: !isActive }); setUsers(u => u.map(x => x.id===id ? {...x,isActive:!isActive} : x)); toast.success(isActive?'User deactivated':'User activated'); }
    catch { toast.error('Failed'); }
  };

  const upgradeUser = async (id, plan) => {
    try {
      const limits = { free:{maxServices:3,maxDatabases:1}, starter:{maxServices:10,maxDatabases:3}, pro:{maxServices:999,maxDatabases:999} };
      await adminAPI.updateUser(id, { plan, planLimits: limits[plan] || limits.free });
      setUsers(u => u.map(x => x.id===id ? {...x,plan} : x));
      toast.success(`User upgraded to ${plan}`);
    } catch { toast.error('Failed'); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user and all their data?')) return;
    try { await adminAPI.deleteUser(id); setUsers(u => u.filter(x => x.id!==id)); toast.success('User deleted'); }
    catch { toast.error('Failed'); }
  };

  const restartService = async (id) => {
    try { await adminAPI.restartService(id); toast.success('Restarted'); }
    catch { toast.error('Failed'); }
  };

  const deleteService = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    try { await adminAPI.deleteService(id); setServices(s => s.filter(x => x._id!==id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const filteredUsers = users.filter(u => u.email?.includes(search) || u.username?.includes(search));

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title" style={{ display:'flex', alignItems:'center', gap:10 }}><Shield size={24} /> Admin Panel</div><div className="page-subtitle">Platform overview and management</div></div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}>↻ Refresh</button>
      </div>

      <div className="tabs">
        {[['stats','Stats'],['users',`Users (${users.length})`],['services',`Services (${services.length})`]].map(([t,l]) => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div>
          <div className="stats-grid" style={{ marginBottom:24 }}>
            {[
              { label:'Total Users', value:stats.users, color:'var(--blue)' },
              { label:'Total Services', value:stats.services, color:'var(--accent)' },
              { label:'Running', value:stats.running, color:'var(--green)' },
              { label:'Databases', value:stats.databases, color:'var(--yellow)' },
              { label:'Deployments', value:stats.deployments, color:'var(--purple)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="stat-card"><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
            ))}
          </div>
          <div className="grid-2">
            <div className="card">
              <h3 style={{ fontWeight:700, marginBottom:14, fontSize:'0.88rem' }}>System Info</h3>
              {[['Platform',stats.system?.platform],['CPUs',stats.system?.cpus],['Memory',`${stats.system?.memGB}GB`],['Uptime',`${Math.floor(stats.system?.uptime/3600)}h`]].map(([k,v]) => (
                <div key={k} className="flex-between" style={{ padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'0.82rem' }}>
                  <span style={{ color:'var(--text-dim)', fontFamily:'var(--mono)' }}>{k}</span>
                  <span style={{ fontWeight:600, fontFamily:'var(--mono)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={{ fontWeight:700, marginBottom:14, fontSize:'0.88rem' }}>Quick Actions</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button className="btn btn-secondary btn-sm btn-full" onClick={() => setTab('users')}>Manage Users</button>
                <button className="btn btn-secondary btn-sm btn-full" onClick={() => setTab('services')}>Manage Services</button>
                <button className="btn btn-secondary btn-sm btn-full" onClick={fetchAll}>Refresh All Data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div style={{ marginBottom:14 }}>
            <input style={{ ...inp, maxWidth:320 }} placeholder="Search by email or username..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{u.name}</div>
                        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{u.email}</div>
                      </td>
                      <td><span className={`badge badge-${u.role==='admin'?'live':'idle'}`}>{u.role}</span></td>
                      <td>
                        <select style={{ background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', color:'var(--text)', fontFamily:'var(--mono)', fontSize:'0.75rem', cursor:'pointer' }} value={u.plan} onChange={e => upgradeUser(u.id, e.target.value)}>
                          <option value="free">Free</option><option value="starter">Starter</option><option value="pro">Pro</option>
                        </select>
                      </td>
                      <td style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{formatDistanceToNow(new Date(u.createdAt), { addSuffix:true })}</td>
                      <td><span className={`badge badge-${u.isActive?'live':'failed'}`}>{u.isActive?'Active':'Inactive'}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className={`btn btn-xs ${u.isActive?'btn-danger':'btn-success'}`} onClick={() => toggleUser(u.id, u.isActive)}>{u.isActive?'Deactivate':'Activate'}</button>
                          <button className="btn btn-danger btn-xs" onClick={() => deleteUser(u.id)}><Trash2 size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'services' && (
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Service</th><th>Owner</th><th>Status</th><th>Type</th><th>Port</th><th>Deployed</th><th>Actions</th></tr></thead>
              <tbody>
                {services.map(s => (
                  <tr key={s._id}>
                    <td><div style={{ fontWeight:600, fontSize:'0.85rem' }}>{s.name}</div><div style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{s.subdomain}</div></td>
                    <td style={{ fontSize:'0.8rem' }}>{s.owner?.username}</td>
                    <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:'0.75rem', color:'var(--text-dim)' }}>{s.type}/{s.runtime}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:'0.78rem' }}>{s.assignedPort||'—'}</td>
                    <td style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{s.lastDeployedAt?formatDistanceToNow(new Date(s.lastDeployedAt),{addSuffix:true}):'Never'}</td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        {s.status==='live' && <button className="btn btn-secondary btn-xs" onClick={() => restartService(s._id)}>↺</button>}
                        <button className="btn btn-danger btn-xs" onClick={() => deleteService(s._id)}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnvGroups;
