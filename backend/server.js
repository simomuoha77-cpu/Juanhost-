require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();

global.broadcastLog = (serviceId, data) => {
  const set = clients.get(serviceId);
  if (!set) return;
  const payload = JSON.stringify({ type:'log', ...data });
  set.forEach(ws => { if (ws.readyState === 1) ws.send(payload); });
};

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const serviceId = url.searchParams.get('serviceId');
  if (!serviceId) return ws.close();
  if (!clients.has(serviceId)) clients.set(serviceId, new Set());
  clients.get(serviceId).add(ws);
  ws.send(JSON.stringify({ type:'connected' }));
  ws.on('close', () => { const s=clients.get(serviceId); if(s){s.delete(ws); if(!s.size)clients.delete(serviceId);} });
  ws.on('error', ()=>{});
});

app.use(helmet({ contentSecurityPolicy:false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001', credentials:true }));
app.use(rateLimit({ windowMs:15*60*1000, max:300 }));
app.use(express.json({ limit:'50mb' }));
app.use(express.urlencoded({ extended:true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

const { authenticateToken } = require('./middleware/auth');
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/services',      authenticateToken, require('./routes/services'));
app.use('/api/deployments',   authenticateToken, require('./routes/deployments'));
app.use('/api/databases',     authenticateToken, require('./routes/databases'));
app.use('/api/envgroups',     authenticateToken, require('./routes/envgroups'));
app.use('/api/domains',       authenticateToken, require('./routes/domains'));
app.use('/api/teams',         authenticateToken, require('./routes/teams'));
app.use('/api/metrics',       authenticateToken, require('./routes/metrics'));
app.use('/api/notifications', authenticateToken, require('./routes/notifications'));
app.use('/api/activity',      authenticateToken, require('./routes/activity'));
app.use('/api/hooks',         require('./routes/hooks'));
app.use('/api/admin',         authenticateToken, require('./routes/admin'));
app.use('/app',               require('./routes/proxy'));

app.get('/api/health', (req,res) => res.json({ status:'ok', platform:process.env.PLATFORM_NAME||'JuanHost', version:'2.0.0', uptime:process.uptime() }));
app.use((req,res) => res.status(404).json({ error:'Not found' }));
app.use((err,req,res,next) => res.status(err.status||500).json({ error:err.message||'Server error' }));

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('✅ MongoDB connected'); server.listen(PORT, () => console.log(`🚀 JuanHost running on port ${PORT}`)); })
  .catch(err => { console.error('❌ DB failed:', err.message); process.exit(1); });

module.exports = { app, server };
