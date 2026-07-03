const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type:String, required:true, trim:true },
  slug: { type:String, unique:true },
  owner: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  type: { type:String, enum:['web','worker','static','cron','private'], default:'web' },
  description: String,
  sourceType: { type:String, enum:['github','gitlab','zip'], default:'github' },
  repo: String, branch: { type:String, default:'main' }, rootDir: { type:String, default:'.' },
  zipPath: String,
  runtime: { type:String, default:'node' },
  nodeVersion: { type:String, default:'18' },
  buildCommand: String, startCommand: String,
  envVars: [{ key:String, value:String }],
  secretFiles: [{ path:String, content:String }],
  port: { type:Number, default:3000 },
  assignedPort: Number,
  subdomain: { type:String, unique:true, sparse:true },
  plan: { type:String, default:'free' },
  region: { type:String, default:'local' },
  status: { type:String, enum:['created','building','live','failed','suspended'], default:'created' },
  pid: Number,
  deployHookToken: String,
  autoDeployEnabled: { type:Boolean, default:true },
  healthCheckPath: { type:String, default:'/' },
  healthCheckEnabled: { type:Boolean, default:false },
  healthStatus: { type:String, enum:['healthy','unhealthy','unknown'], default:'unknown' },
  lastHealthCheck: Date,
  deployCount: { type:Number, default:0 },
  lastDeployedAt: Date,
  uptimeStart: Date,
  cronSchedule: String,
  maxMemoryMB: { type:Number, default:512 },
  customDomains: [{ type:mongoose.Schema.Types.ObjectId, ref:'Domain' }]
}, { timestamps:true });
serviceSchema.pre('save', function(next) {
  if (!this.slug) { const s = this._id.toString().slice(-6); this.slug = `${this.name}-${s}`; this.subdomain = this.slug; }
  next();
});

const deploymentSchema = new mongoose.Schema({
  service: { type:mongoose.Schema.Types.ObjectId, ref:'Service', required:true },
  owner: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  number: { type:Number, required:true },
  trigger: { type:String, enum:['manual','push','hook','rollback'], default:'manual' },
  status: { type:String, enum:['pending','building','live','failed','cancelled'], default:'pending' },
  commitHash: String, commitMessage: String, commitAuthor: String, branch: String,
  logs: [{ ts:{type:Date,default:Date.now}, level:{type:String,default:'info'}, msg:String }],
  startedAt: Date, finishedAt: Date, buildDuration: Number, errorMessage: String
}, { timestamps:true });

const databaseSchema = new mongoose.Schema({
  name: { type:String, required:true },
  owner: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  type: { type:String, enum:['postgresql','mysql','mongodb','redis'], default:'postgresql' },
  version: String, plan: { type:String, default:'free' }, region: { type:String, default:'local' },
  status: { type:String, enum:['creating','available','unavailable','deleted'], default:'available' },
  host: String, port: Number, dbName: String, username: String,
  password: { type:String, select:false },
  connectionString: { type:String, select:false },
  sizeGB: { type:Number, default:1 }, maxConnections: { type:Number, default:97 },
  backupEnabled: { type:Boolean, default:true }, lastBackupAt: Date, expiresAt: Date
}, { timestamps:true });

const envGroupSchema = new mongoose.Schema({
  name: { type:String, required:true },
  owner: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  vars: [{ key:String, value:String }],
  linkedServices: [{ type:mongoose.Schema.Types.ObjectId, ref:'Service' }]
}, { timestamps:true });

const domainSchema = new mongoose.Schema({
  domain: { type:String, required:true, unique:true, lowercase:true },
  service: { type:mongoose.Schema.Types.ObjectId, ref:'Service' },
  owner: { type:mongoose.Schema.Types.ObjectId, ref:'User' },
  verified: { type:Boolean, default:false },
  verificationToken: String,
  sslEnabled: { type:Boolean, default:false },
  status: { type:String, enum:['pending','active','failed'], default:'pending' },
  dnsTarget: String
}, { timestamps:true });

const teamSchema = new mongoose.Schema({
  name: { type:String, required:true },
  slug: { type:String, unique:true },
  owner: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  plan: { type:String, default:'team' },
  members: [{ user:{type:mongoose.Schema.Types.ObjectId, ref:'User'}, role:{type:String,enum:['owner','admin','member','viewer'],default:'member'}, joinedAt:{type:Date,default:Date.now} }],
  invites: [{ email:String, role:String, token:String, expiresAt:Date }]
}, { timestamps:true });

const activitySchema = new mongoose.Schema({
  owner: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  type: { type:String, required:true },
  message: { type:String, required:true },
  service: { type:mongoose.Schema.Types.ObjectId, ref:'Service' },
  deployment: { type:mongoose.Schema.Types.ObjectId, ref:'Deployment' }
}, { timestamps:true });

const notificationSchema = new mongoose.Schema({
  user: { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  title: String, message: String,
  type: { type:String, enum:['deploy_success','deploy_fail','service_down','info','warning'], default:'info' },
  read: { type:Boolean, default:false },
  link: String,
  service: { type:mongoose.Schema.Types.ObjectId, ref:'Service' }
}, { timestamps:true });

const metricSchema = new mongoose.Schema({
  service: { type:mongoose.Schema.Types.ObjectId, ref:'Service', required:true },
  timestamp: { type:Date, default:Date.now },
  cpuPercent: Number, memUsedMB: Number, memLimitMB: Number,
  netInKB: Number, netOutKB: Number
}, { timestamps:false });
metricSchema.index({ service:1, timestamp:-1 });

module.exports = {
  Service: mongoose.model('Service', serviceSchema),
  Deployment: mongoose.model('Deployment', deploymentSchema),
  Database: mongoose.model('Database', databaseSchema),
  EnvGroup: mongoose.model('EnvGroup', envGroupSchema),
  Domain: mongoose.model('Domain', domainSchema),
  Team: mongoose.model('Team', teamSchema),
  Activity: mongoose.model('Activity', activitySchema),
  Notification: mongoose.model('Notification', notificationSchema),
  Metric: mongoose.model('Metric', metricSchema)
};
