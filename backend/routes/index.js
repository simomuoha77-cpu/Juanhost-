const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const os = require('os');
const User = require('../models/User');
const { Service, Deployment, Database, EnvGroup, Domain, Team, Activity, Notification, Metric } = require('../models/index');
const { generateToken, requireAdmin } = require('../middleware/auth');
const { runDeployment, stopService, restartService } = require('../services/deployer');

// ── Helper ────────────────────────────────────────────────────
const logActivity = async (data) => { try { await Activity.create(data); } catch(e) {} };

// ══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════
const authRouter = express.Router();

authRouter.post('/register', async (req,res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name||!username||!email||!password) return res.status(400).json({ error:'All fields required' });
    if (password.length<6) return res.status(400).json({ error:'Password must be 6+ characters' });
    const exists = await User.findOne({ $or:[{email:email.toLowerCase()},{username:username.toLowerCase()}] });
    if (exists) return res.status(409).json({ error: exists.email===email.toLowerCase() ? 'Email already taken' : 'Username already taken' });
    const count = await User.countDocuments();
    const user = await User.create({ name, username:username.toLowerCase(), email:email.toLowerCase(), password, role:count===0?'admin':'user' });
    user.lastLogin = new Date(); await user.save();
    await logActivity({ owner:user._id, type:'user.registered', message:`${user.username} joined JuanHost` });
    res.status(201).json({ token:generateToken(user._id), user:user.toSafeObject() });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

authRouter.post('/login', async (req,res) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ error:'Email and password required' });
    const user = await User.findOne({ email:email.toLowerCase() }).select('+password');
    if (!user||!user.isActive) return res.status(401).json({ error:'Invalid credentials' });
    if (!await user.comparePassword(password)) return res.status(401).json({ error:'Invalid credentials' });
    user.lastLogin = new Date(); await user.save();
    res.json({ token:generateToken(user._id), user:user.toSafeObject() });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

authRouter.get('/me', require('../middleware/auth').authenticateToken, (req,res) => res.json({ user:req.user.toSafeObject() }));

authRouter.patch('/me', require('../middleware/auth').authenticateToken, async (req,res) => {
  try {
    const { name, billingEmail, notificationPrefs } = req.body;
    if (name) req.user.name = name;
    if (billingEmail) req.user.billingEmail = billingEmail;
    if (notificationPrefs) req.user.notificationPrefs = { ...req.user.notificationPrefs, ...notificationPrefs };
    await req.user.save();
    res.json({ user:req.user.toSafeObject() });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

authRouter.patch('/password', require('../middleware/auth').authenticateToken, async (req,res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!await user.comparePassword(currentPassword)) return res.status(401).json({ error:'Current password incorrect' });
    if (!newPassword || newPassword.length<6) return res.status(400).json({ error:'New password must be 6+ characters' });
    user.password = newPassword; await user.save();
    res.json({ message:'Password updated' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

authRouter.post('/forgot-password', async (req,res) => {
  try {
    const user = await User.findOne({ email:req.body.email?.toLowerCase() });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
      user.resetPasswordExpire = Date.now() + 30*60*1000;
      await user.save();
    }
    res.json({ message:'If that email exists, a reset link was sent.' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

authRouter.post('/reset-password/:token', async (req,res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken:hashed, resetPasswordExpire:{ $gt:Date.now() } }).select('+resetPasswordToken +resetPasswordExpire');
    if (!user) return res.status(400).json({ error:'Invalid or expired token' });
    if (!req.body.password || req.body.password.length<6) return res.status(400).json({ error:'Password must be 6+ characters' });
    user.password = req.body.password; user.resetPasswordToken=undefined; user.resetPasswordExpire=undefined;
    await user.save();
    res.json({ message:'Password reset. You can now login.' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

authRouter.get('/api-keys', require('../middleware/auth').authenticateToken, (req,res) => res.json({ keys:req.user.apiKeys.map(k=>({ name:k.name, createdAt:k.createdAt, lastUsed:k.lastUsed, keyPreview:k.key.slice(0,12)+'...' })) }));
authRouter.post('/api-keys', require('../middleware/auth').authenticateToken, async (req,res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error:'Name required' });
    const key = `jh_${uuidv4().replace(/-/g,'')}`;
    req.user.apiKeys.push({ name, key, createdAt:new Date() }); await req.user.save();
    res.json({ key, name, message:'Save this key — it will not be shown again.' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
authRouter.delete('/api-keys/:name', require('../middleware/auth').authenticateToken, async (req,res) => {
  req.user.apiKeys = req.user.apiKeys.filter(k=>k.name!==req.params.name); await req.user.save(); res.json({ message:'Deleted' });
});

// ══════════════════════════════════════════════════════════════
// SERVICES ROUTES
// ══════════════════════════════════════════════════════════════
const servicesRouter = express.Router();
const upload = multer({ storage:multer.diskStorage({ destination:(req,file,cb)=>{ const d=path.join(__dirname,'../uploads',req.user._id.toString()); fs.mkdirSync(d,{recursive:true}); cb(null,d); }, filename:(req,file,cb)=>cb(null,`${uuidv4()}.zip`) }), limits:{ fileSize:500*1024*1024 } });

servicesRouter.get('/', async (req,res) => { const s=await Service.find({ owner:req.user._id }).sort({ createdAt:-1 }); res.json({ services:s }); });
servicesRouter.get('/:id', async (req,res) => { const s=await Service.findOne({ $or:[{_id:req.params.id},{slug:req.params.id}], owner:req.user._id }); if(!s) return res.status(404).json({ error:'Not found' }); res.json({ service:s }); });

servicesRouter.post('/', async (req,res) => {
  try {
    const { name, type, sourceType, repo, branch, rootDir, runtime, buildCommand, startCommand, envVars, port, cronSchedule, nodeVersion } = req.body;
    if (!name) return res.status(400).json({ error:'Name required' });
    if (!/^[a-z0-9-]+$/.test(name)) return res.status(400).json({ error:'Name: lowercase letters, numbers, hyphens only' });
    const count = await Service.countDocuments({ owner:req.user._id });
    if (count >= (req.user.planLimits?.maxServices||3)) return res.status(403).json({ error:`Plan limit of ${req.user.planLimits?.maxServices||3} services reached` });
    const deployHookToken = crypto.randomBytes(24).toString('hex');
    const s = await Service.create({ name, type:type||'web', owner:req.user._id, sourceType:sourceType||'github', repo, branch:branch||'main', rootDir:rootDir||'.', runtime:runtime||'node', buildCommand, startCommand, envVars:envVars||[], port:port||3000, cronSchedule, nodeVersion:nodeVersion||'18', deployHookToken });
    await logActivity({ owner:req.user._id, type:'service.created', message:`Created service "${name}"`, service:s._id });
    res.status(201).json({ service:s });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

servicesRouter.patch('/:id', async (req,res) => {
  try {
    const s = await Service.findOne({ _id:req.params.id, owner:req.user._id });
    if (!s) return res.status(404).json({ error:'Not found' });
    ['description','branch','rootDir','buildCommand','startCommand','nodeVersion','envVars','secretFiles','port','healthCheckPath','healthCheckEnabled','autoDeployEnabled','cronSchedule'].forEach(k=>{ if(req.body[k]!==undefined) s[k]=req.body[k]; });
    await s.save(); res.json({ service:s });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

servicesRouter.delete('/:id', async (req,res) => {
  try {
    const s = await Service.findOne({ _id:req.params.id, owner:req.user._id });
    if (!s) return res.status(404).json({ error:'Not found' });
    await stopService(s._id.toString()).catch(()=>{});
    await Deployment.deleteMany({ service:s._id }); await s.deleteOne();
    await logActivity({ owner:req.user._id, type:'service.deleted', message:`Deleted service "${s.name}"` });
    res.json({ message:'Deleted' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

servicesRouter.post('/:id/upload', upload.single('zip'), async (req,res) => {
  try {
    const s = await Service.findOne({ _id:req.params.id, owner:req.user._id });
    if (!s) return res.status(404).json({ error:'Not found' });
    if (!req.file) return res.status(400).json({ error:'No file' });
    s.zipPath=req.file.path; s.sourceType='zip'; await s.save();
    res.json({ message:'ZIP uploaded' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

servicesRouter.get('/:id/deployments', async (req,res) => {
  const s = await Service.findOne({ _id:req.params.id, owner:req.user._id });
  if (!s) return res.status(404).json({ error:'Not found' });
  const d = await Deployment.find({ service:s._id }).sort({ createdAt:-1 }).limit(50).select('-logs');
  res.json({ deployments:d });
});

servicesRouter.get('/:id/metrics', async (req,res) => {
  const s = await Service.findOne({ _id:req.params.id, owner:req.user._id });
  if (!s) return res.status(404).json({ error:'Not found' });
  const since = new Date(Date.now()-(parseInt(req.query.hours)||6)*60*60*1000);
  const m = await Metric.find({ service:s._id, timestamp:{ $gte:since } }).sort({ timestamp:1 }).limit(300);
  res.json({ metrics:m });
});

servicesRouter.post('/:id/suspend', async (req,res) => {
  const s=await Service.findOne({ _id:req.params.id, owner:req.user._id }); if(!s) return res.status(404).json({ error:'Not found' });
  await stopService(s._id.toString()); s.status='suspended'; await s.save(); res.json({ message:'Suspended' });
});
servicesRouter.post('/:id/resume', async (req,res) => {
  const s=await Service.findOne({ _id:req.params.id, owner:req.user._id }); if(!s) return res.status(404).json({ error:'Not found' });
  const d=await Deployment.create({ service:s._id, owner:req.user._id, number:(s.deployCount||0)+1, trigger:'manual', status:'pending', startedAt:new Date() });
  s.status='building'; s.deployCount=d.number; await s.save();
  runDeployment(s,d).catch(console.error); res.json({ message:'Resuming' });
});
servicesRouter.post('/:id/restart', async (req,res) => {
  const s=await Service.findOne({ _id:req.params.id, owner:req.user._id }); if(!s) return res.status(404).json({ error:'Not found' });
  await restartService(s); res.json({ message:'Restarted' });
});
servicesRouter.post('/:id/rollback/:deployId', async (req,res) => {
  const s=await Service.findOne({ _id:req.params.id, owner:req.user._id });
  const prev=await Deployment.findById(req.params.deployId);
  if(!s||!prev) return res.status(404).json({ error:'Not found' });
  const d=await Deployment.create({ service:s._id, owner:req.user._id, number:(s.deployCount||0)+1, trigger:'rollback', status:'pending', startedAt:new Date() });
  s.status='building'; s.deployCount=d.number; await s.save();
  runDeployment(s,d).catch(console.error); res.json({ message:'Rollback started' });
});

// ══════════════════════════════════════════════════════════════
// DEPLOYMENTS ROUTES
// ══════════════════════════════════════════════════════════════
const deployRouter = express.Router();
deployRouter.post('/:serviceId/deploy', async (req,res) => {
  try {
    const s=await Service.findOne({ _id:req.params.serviceId, owner:req.user._id });
    if(!s) return res.status(404).json({ error:'Service not found' });
    if(s.status==='building') return res.status(409).json({ error:'Already deploying' });
    const d=await Deployment.create({ service:s._id, owner:req.user._id, number:(s.deployCount||0)+1, trigger:req.body.trigger||'manual', branch:s.branch, status:'pending', startedAt:new Date() });
    s.status='building'; s.deployCount=d.number; await s.save();
    runDeployment(s,d).catch(console.error);
    await logActivity({ owner:req.user._id, type:'deploy.started', message:`Deploy #${d.number} started for "${s.name}"`, service:s._id });
    res.status(202).json({ deployment:d });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
deployRouter.get('/:id/logs', async (req,res) => {
  const d=await Deployment.findById(req.params.id).select('logs status owner');
  if(!d) return res.status(404).json({ error:'Not found' });
  if(d.owner.toString()!==req.user._id.toString()&&req.user.role!=='admin') return res.status(403).json({ error:'Forbidden' });
  res.json({ logs:d.logs, status:d.status });
});
deployRouter.post('/:id/cancel', async (req,res) => {
  const d=await Deployment.findById(req.params.id);
  if(!d) return res.status(404).json({ error:'Not found' });
  d.status='cancelled'; d.finishedAt=new Date(); await d.save();
  await Service.findByIdAndUpdate(d.service, { status:'created' });
  res.json({ message:'Cancelled' });
});

// ══════════════════════════════════════════════════════════════
// DATABASES ROUTES
// ══════════════════════════════════════════════════════════════
const dbRouter = express.Router();
dbRouter.get('/', async (req,res) => { res.json({ databases:await Database.find({ owner:req.user._id }).sort({ createdAt:-1 }) }); });
dbRouter.get('/:id', async (req,res) => {
  const db=await Database.findOne({ _id:req.params.id, owner:req.user._id }).select('+password +connectionString');
  if(!db) return res.status(404).json({ error:'Not found' }); res.json({ database:db });
});
dbRouter.post('/', async (req,res) => {
  try {
    const { name, type, plan, region } = req.body;
    if(!name) return res.status(400).json({ error:'Name required' });
    const count = await Database.countDocuments({ owner:req.user._id });
    if(count>=(req.user.planLimits?.maxDatabases||1)) return res.status(403).json({ error:'Database limit reached. Upgrade plan.' });
    const dbName=name.toLowerCase().replace(/[^a-z0-9]/g,'_');
    const username=`user_${crypto.randomBytes(4).toString('hex')}`;
    const password=crypto.randomBytes(16).toString('hex');
    const portMap={ postgresql:5432, mysql:3306, mongodb:27017, redis:6379 };
    const port=portMap[type||'postgresql'];
    const connStr=`${type||'postgresql'}://${username}:${password}@localhost:${port}/${dbName}`;
    const db=await Database.create({ name, owner:req.user._id, type:type||'postgresql', plan:plan||'free', region:region||'local', status:'available', host:'localhost', port, dbName, username, password, connectionString:connStr, expiresAt:plan==='free'?new Date(Date.now()+90*24*60*60*1000):null });
    await logActivity({ owner:req.user._id, type:'database.created', message:`Created ${type||'postgresql'} database "${name}"` });
    res.status(201).json({ database:db });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
dbRouter.delete('/:id', async (req,res) => {
  const db=await Database.findOne({ _id:req.params.id, owner:req.user._id });
  if(!db) return res.status(404).json({ error:'Not found' });
  await db.deleteOne(); res.json({ message:'Deleted' });
});

// ══════════════════════════════════════════════════════════════
// ENV GROUPS ROUTES
// ══════════════════════════════════════════════════════════════
const egRouter = express.Router();
egRouter.get('/', async (req,res) => res.json({ groups:await EnvGroup.find({ owner:req.user._id }) }));
egRouter.post('/', async (req,res) => { try { const g=await EnvGroup.create({ name:req.body.name, owner:req.user._id, vars:req.body.vars||[] }); res.status(201).json({ group:g }); } catch(e) { res.status(500).json({ error:e.message }); } });
egRouter.get('/:id', async (req,res) => { const g=await EnvGroup.findOne({ _id:req.params.id, owner:req.user._id }).populate('linkedServices','name slug status'); if(!g) return res.status(404).json({ error:'Not found' }); res.json({ group:g }); });
egRouter.patch('/:id', async (req,res) => { try { const g=await EnvGroup.findOne({ _id:req.params.id, owner:req.user._id }); if(!g) return res.status(404).json({ error:'Not found' }); if(req.body.name) g.name=req.body.name; if(req.body.vars) g.vars=req.body.vars; await g.save(); res.json({ group:g }); } catch(e) { res.status(500).json({ error:e.message }); } });
egRouter.post('/:id/link/:serviceId', async (req,res) => { try { const g=await EnvGroup.findOne({ _id:req.params.id, owner:req.user._id }); const s=await Service.findOne({ _id:req.params.serviceId, owner:req.user._id }); if(!g||!s) return res.status(404).json({ error:'Not found' }); if(!g.linkedServices.includes(s._id)) g.linkedServices.push(s._id); await g.save(); res.json({ message:'Linked' }); } catch(e) { res.status(500).json({ error:e.message }); } });
egRouter.delete('/:id', async (req,res) => { const g=await EnvGroup.findOne({ _id:req.params.id, owner:req.user._id }); if(!g) return res.status(404).json({ error:'Not found' }); await g.deleteOne(); res.json({ message:'Deleted' }); });

// ══════════════════════════════════════════════════════════════
// DOMAINS ROUTES
// ══════════════════════════════════════════════════════════════
const domainRouter = express.Router();
domainRouter.get('/', async (req,res) => res.json({ domains:await Domain.find({ owner:req.user._id }).populate('service','name slug') }));
domainRouter.post('/', async (req,res) => {
  try {
    const { domain, serviceId } = req.body;
    if(!domain) return res.status(400).json({ error:'Domain required' });
    if(await Domain.findOne({ domain:domain.toLowerCase() })) return res.status(409).json({ error:'Domain already exists' });
    const token=crypto.randomBytes(16).toString('hex');
    const d=await Domain.create({ domain:domain.toLowerCase(), service:serviceId||null, owner:req.user._id, verificationToken:token, dnsTarget:process.env.PLATFORM_DOMAIN||'juanhost.com' });
    res.status(201).json({ domain:d, verifyTxt:`_juanhost-verify.${domain} TXT ${token}`, cname:`${domain} CNAME ${process.env.PLATFORM_DOMAIN||'juanhost.com'}` });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
domainRouter.post('/:id/verify', async (req,res) => {
  const d=await Domain.findOne({ _id:req.params.id, owner:req.user._id });
  if(!d) return res.status(404).json({ error:'Not found' });
  if(process.env.NODE_ENV==='development') { d.verified=true; d.status='active'; await d.save(); return res.json({ message:'Verified (dev mode)', domain:d }); }
  let verified=false;
  try { const recs=await require('dns').promises.resolveTxt(`_juanhost-verify.${d.domain}`); verified=recs.flat().includes(d.verificationToken); } catch(e){}
  if(!verified) return res.status(400).json({ error:'TXT record not found. DNS can take up to 48h to propagate.' });
  d.verified=true; d.status='active'; await d.save();
  if(d.service) await Service.findByIdAndUpdate(d.service, { $addToSet:{ customDomains:d._id } });
  res.json({ message:'Domain verified!', domain:d });
});
domainRouter.patch('/:id/assign', async (req,res) => {
  const d=await Domain.findOne({ _id:req.params.id, owner:req.user._id });
  if(!d) return res.status(404).json({ error:'Not found' });
  if(!d.verified) return res.status(400).json({ error:'Verify domain first' });
  d.service=req.body.serviceId; await d.save();
  await Service.findByIdAndUpdate(req.body.serviceId, { $addToSet:{ customDomains:d._id } });
  res.json({ message:'Assigned', domain:d });
});
domainRouter.delete('/:id', async (req,res) => {
  const d=await Domain.findOne({ _id:req.params.id, owner:req.user._id });
  if(!d) return res.status(404).json({ error:'Not found' });
  await d.deleteOne(); res.json({ message:'Removed' });
});

// ══════════════════════════════════════════════════════════════
// TEAMS ROUTES
// ══════════════════════════════════════════════════════════════
const teamRouter = express.Router();
teamRouter.get('/', async (req,res) => res.json({ teams:await Team.find({ 'members.user':req.user._id }).populate('members.user','name username email') }));
teamRouter.post('/', async (req,res) => {
  try {
    const { name } = req.body; if(!name) return res.status(400).json({ error:'Name required' });
    const slug=`${name.toLowerCase().replace(/[^a-z0-9]/g,'-')}-${uuidv4().slice(0,4)}`;
    const t=await Team.create({ name, slug, owner:req.user._id, members:[{ user:req.user._id, role:'owner' }] });
    res.status(201).json({ team:t });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
teamRouter.post('/:id/invite', async (req,res) => {
  try {
    const t=await Team.findById(req.params.id); if(!t) return res.status(404).json({ error:'Not found' });
    const { email, role } = req.body;
    const inviteToken=crypto.randomBytes(24).toString('hex');
    t.invites.push({ email, role:role||'member', token:inviteToken, expiresAt:new Date(Date.now()+7*24*60*60*1000) });
    await t.save();
    res.json({ message:'Invite created', inviteLink:`${process.env.FRONTEND_URL}/accept-invite/${inviteToken}` });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
teamRouter.post('/accept/:token', async (req,res) => {
  const t=await Team.findOne({ 'invites.token':req.params.token });
  if(!t) return res.status(404).json({ error:'Invalid invite' });
  const inv=t.invites.find(i=>i.token===req.params.token);
  if(new Date()>inv.expiresAt) return res.status(400).json({ error:'Invite expired' });
  t.members.push({ user:req.user._id, role:inv.role });
  t.invites=t.invites.filter(i=>i.token!==req.params.token);
  await t.save(); res.json({ message:'Joined team' });
});
teamRouter.delete('/:id/members/:userId', async (req,res) => {
  const t=await Team.findById(req.params.id); if(!t) return res.status(404).json({ error:'Not found' });
  t.members=t.members.filter(m=>m.user.toString()!==req.params.userId);
  await t.save(); res.json({ message:'Removed' });
});

// ══════════════════════════════════════════════════════════════
// OTHER ROUTES
// ══════════════════════════════════════════════════════════════
const metricsRouter = express.Router();
metricsRouter.get('/system', async (req,res) => {
  try { const si=require('systeminformation'); const [cpu,mem]=await Promise.all([si.currentLoad(),si.mem()]); res.json({ cpu:{ load:cpu.currentLoad.toFixed(1) }, mem:{ used:Math.round(mem.used/1024/1024), total:Math.round(mem.total/1024/1024), percent:Math.round(mem.used/mem.total*100) } }); }
  catch(e) { res.json({ cpu:{ load:0 }, mem:{ used:0, total:0, percent:0 } }); }
});

const notifRouter = express.Router();
notifRouter.get('/', async (req,res) => { const n=await Notification.find({ user:req.user._id }).sort({ createdAt:-1 }).limit(50); const unread=await Notification.countDocuments({ user:req.user._id, read:false }); res.json({ notifications:n, unread }); });
notifRouter.patch('/read-all', async (req,res) => { await Notification.updateMany({ user:req.user._id, read:false },{ read:true }); res.json({ message:'Done' }); });
notifRouter.patch('/:id/read', async (req,res) => { await Notification.findOneAndUpdate({ _id:req.params.id, user:req.user._id },{ read:true }); res.json({ message:'Done' }); });
notifRouter.delete('/:id', async (req,res) => { await Notification.findOneAndDelete({ _id:req.params.id, user:req.user._id }); res.json({ message:'Deleted' }); });

const actRouter = express.Router();
actRouter.get('/', async (req,res) => res.json({ activities:await Activity.find({ owner:req.user._id }).sort({ createdAt:-1 }).limit(100).populate('service','name slug') }));

const hooksRouter = express.Router();
hooksRouter.post('/deploy/:token', async (req,res) => {
  const s=await Service.findOne({ deployHookToken:req.params.token });
  if(!s) return res.status(404).json({ error:'Invalid token' });
  const d=await Deployment.create({ service:s._id, owner:s.owner, number:(s.deployCount||0)+1, trigger:'hook', branch:s.branch, status:'pending', startedAt:new Date() });
  s.status='building'; s.deployCount=d.number; await s.save();
  runDeployment(s,d).catch(console.error);
  res.json({ message:'Deploy triggered', deploymentId:d._id });
});
hooksRouter.post('/github/:serviceId', async (req,res) => {
  const s=await Service.findById(req.params.serviceId);
  if(!s||!s.autoDeployEnabled) return res.status(404).json({ error:'Not found' });
  const branch=req.body.ref?.replace('refs/heads/','');
  if(branch!==s.branch) return res.json({ message:`Skipping ${branch}` });
  const d=await Deployment.create({ service:s._id, owner:s.owner, number:(s.deployCount||0)+1, trigger:'push', branch:s.branch, commitHash:req.body.head_commit?.id?.slice(0,7), commitMessage:req.body.head_commit?.message, status:'pending', startedAt:new Date() });
  s.status='building'; s.deployCount=d.number; await s.save();
  runDeployment(s,d).catch(console.error);
  res.json({ message:'Deploying' });
});

const adminRouter = express.Router();
adminRouter.use(requireAdmin);
adminRouter.get('/stats', async (req,res) => {
  const [users,services,running,dbs,deploys]=await Promise.all([User.countDocuments(),Service.countDocuments(),Service.countDocuments({ status:'live' }),Database.countDocuments(),Deployment.countDocuments()]);
  res.json({ stats:{ users, services, running, databases:dbs, deployments:deploys, system:{ platform:os.platform(), cpus:os.cpus().length, memGB:Math.round(os.totalmem()/1024/1024/1024), uptime:Math.floor(os.uptime()) } } });
});
adminRouter.get('/users', async (req,res) => { const u=await User.find().sort({ createdAt:-1 }).limit(200); res.json({ users:u.map(x=>x.toSafeObject()) }); });
adminRouter.patch('/users/:id', async (req,res) => { try { const u=await User.findById(req.params.id); if(!u) return res.status(404).json({ error:'Not found' }); ['role','plan','isActive','planLimits'].forEach(k=>{ if(req.body[k]!==undefined) u[k]=req.body[k]; }); await u.save(); res.json({ user:u.toSafeObject() }); } catch(e) { res.status(500).json({ error:e.message }); } });
adminRouter.delete('/users/:id', async (req,res) => { if(req.params.id===req.user._id.toString()) return res.status(400).json({ error:"Can't delete yourself" }); await User.findByIdAndDelete(req.params.id); await Service.deleteMany({ owner:req.params.id }); res.json({ message:'User deleted' }); });
adminRouter.get('/services', async (req,res) => res.json({ services:await Service.find().populate('owner','username email').sort({ createdAt:-1 }).limit(200) }));
adminRouter.post('/services/:id/restart', async (req,res) => { const s=await Service.findById(req.params.id); if(!s) return res.status(404).json({ error:'Not found' }); await restartService(s).catch(()=>{}); res.json({ message:'Restarted' }); });
adminRouter.delete('/services/:id', async (req,res) => { const s=await Service.findById(req.params.id); if(!s) return res.status(404).json({ error:'Not found' }); await stopService(s._id.toString()).catch(()=>{}); await s.deleteOne(); res.json({ message:'Deleted' }); });

// ── Metrics collector (background) ───────────────────────────
setInterval(async () => {
  try {
    const services=await Service.find({ status:'live' });
    for(const s of services) {
      await Metric.create({ service:s._id, timestamp:new Date(), cpuPercent:Math.random()*25, memUsedMB:Math.floor(50+Math.random()*200), memLimitMB:s.maxMemoryMB||512, netInKB:Math.floor(Math.random()*500), netOutKB:Math.floor(Math.random()*300) });
    }
    await Metric.deleteMany({ timestamp:{ $lt:new Date(Date.now()-7*24*60*60*1000) } });
  } catch(e){}
}, 30000);

module.exports = { authRouter, servicesRouter, deployRouter, dbRouter, egRouter, domainRouter, teamRouter, metricsRouter, notifRouter, actRouter, hooksRouter, adminRouter };
