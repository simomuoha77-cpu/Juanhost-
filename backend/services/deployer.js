const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const simpleGit = require('simple-git');
const unzipper = require('unzipper');
const { v4: uuidv4 } = require('uuid');
const { Service, Deployment, Notification } = require('../models/index');

const WORK_DIR = process.env.WORK_DIR || path.join(require('os').homedir(), 'juanhost-builds');
const APPS_DIR = process.env.APPS_DIR || path.join(require('os').homedir(), 'juanhost-apps');
const runningApps = new Map();

async function runDeployment(service, deployment) {
  const buildPath = path.join(WORK_DIR, `${service._id}-${uuidv4()}`);
  const appDir = path.join(APPS_DIR, service.slug);

  const log = async (msg, level='info') => {
    const entry = { ts:new Date(), level, msg };
    await Deployment.findByIdAndUpdate(deployment._id, { $push:{ logs:entry } });
    if (global.broadcastLog) global.broadcastLog(service._id.toString(), { msg, level, ts:new Date() });
    console.log(`[${service.name}] ${msg}`);
  };

  try {
    fs.mkdirSync(buildPath, { recursive:true });
    fs.mkdirSync(APPS_DIR, { recursive:true });
    await Deployment.findByIdAndUpdate(deployment._id, { status:'building' });

    await log('='.repeat(48));
    await log(`🚀 Deploy #${deployment.number} — ${service.name}`);
    await log(`   Type: ${service.type} | Runtime: ${service.runtime}`);
    await log('='.repeat(48));

    // Step 1: Get source
    await log('\n📦 [1/4] Fetching source...');
    if (service.sourceType === 'github' || service.sourceType === 'gitlab') {
      const base = service.sourceType === 'gitlab' ? 'https://gitlab.com' : 'https://github.com';
      await log(`   Cloning ${base}/${service.repo} @ ${service.branch}`);
      await simpleGit().clone(`${base}/${service.repo}.git`, buildPath, ['--branch', service.branch, '--depth','1']);
    } else if (service.zipPath && fs.existsSync(service.zipPath)) {
      await new Promise((res,rej) => {
        fs.createReadStream(service.zipPath).pipe(unzipper.Extract({ path:buildPath })).on('close',res).on('error',rej);
      });
      // Flatten if single nested folder
      const items = fs.readdirSync(buildPath);
      if (items.length===1 && fs.statSync(path.join(buildPath,items[0])).isDirectory()) {
        const nested = path.join(buildPath,items[0]);
        fs.readdirSync(nested).forEach(f => fs.renameSync(path.join(nested,f), path.join(buildPath,f)));
        fs.rmdirSync(nested);
      }
    } else throw new Error('No source found. Connect GitHub or upload a ZIP.');
    await log('✅ Source ready');

    const workDir = service.rootDir && service.rootDir!=='.' ? path.join(buildPath,service.rootDir) : buildPath;

    // Write secret files
    if (service.secretFiles?.length) {
      for (const sf of service.secretFiles) {
        const fp = path.join(workDir, sf.path);
        fs.mkdirSync(path.dirname(fp), { recursive:true });
        fs.writeFileSync(fp, sf.content);
      }
    }

    // Step 2: Install
    await log('\n📦 [2/4] Installing dependencies...');
    if (fs.existsSync(path.join(workDir,'package.json'))) {
      await runCmd('npm', ['install'], workDir, log);
    } else if (fs.existsSync(path.join(workDir,'requirements.txt'))) {
      await runCmd('pip', ['install','-r','requirements.txt'], workDir, log);
    }
    await log('✅ Dependencies installed');

    // Step 3: Build
    if (service.buildCommand?.trim()) {
      await log(`\n🔨 [3/4] Building... (${service.buildCommand})`);
      const parts = service.buildCommand.split(' ');
      await runCmd(parts[0], parts.slice(1), workDir, log);
      await log('✅ Build complete');
    } else {
      await log('\n⏭️  [3/4] No build command — skipped');
    }

    // Step 4: Start
    await log('\n🚀 [4/4] Starting application...');
    await stopService(service._id.toString());
    if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive:true, force:true });
    copyDir(workDir, appDir);

    const port = service.assignedPort || await getFreePort();
    const envVars = { PORT:String(port), NODE_ENV:'production', ...(service.envVars||[]).reduce((a,e) => { if(e.key) a[e.key]=e.value||''; return a; }, {}) };

    let child = null;
    if (service.type !== 'cron') {
      const cmd = service.startCommand || getDefaultCmd(service.runtime);
      await log(`   Starting: ${cmd} on port ${port}`);
      const parts = cmd.split(' ');
      child = await startProcess(service._id.toString(), parts[0], parts.slice(1), appDir, envVars, log);
      if (child) runningApps.set(service._id.toString(), { process:child, port });
    }

    await Service.findByIdAndUpdate(service._id, { status:'live', assignedPort:port, pid:child?.pid, lastDeployedAt:new Date(), uptimeStart:new Date() });
    await Deployment.findByIdAndUpdate(deployment._id, { status:'live', finishedAt:new Date(), buildDuration:Math.round((Date.now()-deployment.startedAt)/1000) });

    const url = `http://localhost:${port}`;
    await log(`\n${'='.repeat(48)}`);
    await log(`🎉 LIVE! → ${url}`);
    await log(`⏱️  Build time: ${Math.round((Date.now()-deployment.startedAt)/1000)}s`);
    await log('='.repeat(48));

    if (global.broadcastLog) global.broadcastLog(service._id.toString(), { msg:`✅ Live at ${url}`, level:'success', ts:new Date() });
    await Notification.create({ user:service.owner, title:'Deploy successful', message:`${service.name} is live`, type:'deploy_success', service:service._id });

  } catch(err) {
    console.error(`Deploy failed [${service.name}]:`, err.message);
    await Deployment.findByIdAndUpdate(deployment._id, { status:'failed', finishedAt:new Date(), errorMessage:err.message });
    await Service.findByIdAndUpdate(service._id, { status:'failed' });
    if (global.broadcastLog) global.broadcastLog(service._id.toString(), { msg:`❌ Failed: ${err.message}`, level:'error', ts:new Date() });
    await Notification.create({ user:service.owner, title:'Deploy failed', message:`${service.name}: ${err.message}`, type:'deploy_fail', service:service._id }).catch(()=>{});
  } finally {
    try { fs.rmSync(buildPath, { recursive:true, force:true }); } catch(e) {}
  }
}

function startProcess(serviceId, cmd, args, cwd, env, log) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env:{ ...process.env, ...env }, detached:false });
    let done = false;
    const finish = () => { if (!done) { done=true; resolve(child); } };
    child.stdout?.on('data', d => { const m=d.toString().trim(); if(m && global.broadcastLog) global.broadcastLog(serviceId, { msg:`  ${m}`, level:'info', ts:new Date() }); finish(); });
    child.stderr?.on('data', d => { const m=d.toString().trim(); if(m && global.broadcastLog) global.broadcastLog(serviceId, { msg:`  ${m}`, level:'warn', ts:new Date() }); finish(); });
    child.on('error', () => finish());
    child.on('exit', code => { if(global.broadcastLog) global.broadcastLog(serviceId, { msg:`Process exited (${code})`, level:code?'error':'info', ts:new Date() }); });
    setTimeout(finish, 3000);
  });
}

async function stopService(serviceId) {
  const app = runningApps.get(serviceId);
  if (app?.process) { try { app.process.kill('SIGTERM'); } catch(e) {} runningApps.delete(serviceId); }
}

async function restartService(service) {
  const appDir = path.join(APPS_DIR, service.slug);
  if (!fs.existsSync(appDir)) throw new Error('No deployed files. Deploy first.');
  await stopService(service._id.toString());
  const port = service.assignedPort || await getFreePort();
  const env = { PORT:String(port), ...(service.envVars||[]).reduce((a,e)=>{ if(e.key) a[e.key]=e.value||''; return a; }, {}) };
  const cmd = (service.startCommand||getDefaultCmd(service.runtime)).split(' ');
  const child = await startProcess(service._id.toString(), cmd[0], cmd.slice(1), appDir, env, console.log);
  if (child) runningApps.set(service._id.toString(), { process:child, port });
  await Service.findByIdAndUpdate(service._id, { status:'live', assignedPort:port, pid:child?.pid });
}

function runCmd(cmd, args, cwd, log) {
  return new Promise((res,rej) => {
    const c = spawn(cmd, args, { cwd, env:process.env });
    c.stdout?.on('data', d => log(`  ${d.toString().trim()}`));
    c.stderr?.on('data', d => log(`  ${d.toString().trim()}`, 'warn'));
    c.on('close', code => code===0 ? res() : rej(new Error(`${cmd} exited ${code}`)));
    c.on('error', rej);
  });
}

function getFreePort() {
  return new Promise(res => { const net=require('net'); const s=net.createServer(); s.listen(0,()=>{ const p=s.address().port; s.close(()=>res(p)); }); });
}

function getDefaultCmd(runtime) {
  return { node:'node index.js', python:'python app.py', ruby:'ruby app.rb', go:'./app', php:'php -S 0.0.0.0:8080' }[runtime] || 'node index.js';
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive:true });
  fs.readdirSync(src, { withFileTypes:true }).forEach(e => {
    if (['node_modules','.git','.env'].includes(e.name)) return;
    const s=path.join(src,e.name), d=path.join(dest,e.name);
    e.isDirectory() ? copyDir(s,d) : fs.copyFileSync(s,d);
  });
}

module.exports = { runDeployment, stopService, restartService, runningApps };
