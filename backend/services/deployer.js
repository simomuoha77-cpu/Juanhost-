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
// slug -> Express (or compatible) handler for apps mounted in-process on Render
const mountedApps = new Map();

/**
 * Render's free web service only exposes ONE port - ours. We can't spawn
 * independent child servers bound to their own ports like on a VPS. So for
 * Node "web" services we require the deployed app's entry file to export an
 * Express app (or any (req,res[,next]) => handler) instead of calling
 * app.listen() itself, and we mount that handler in-process at /app/:slug.
 *
 * Entry file resolution order: service.startCommand's last arg (e.g.
 * "node server.js" -> server.js), then package.json "main", then index.js.
 */
async function mountApp(service, appDir, log) {
  const slug = service.slug;

  // Clear this app's require cache so redeploys pick up new code
  const resolveEntry = () => {
    if (service.startCommand && service.startCommand.trim()) {
      const parts = service.startCommand.trim().split(' ');
      const last = parts[parts.length - 1];
      if (last && last.endsWith('.js')) return path.join(appDir, last);
    }
    const pkgPath = path.join(appDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.main) return path.join(appDir, pkg.main);
      } catch (e) {}
    }
    return path.join(appDir, 'index.js');
  };

  const entryFile = resolveEntry();
  if (!fs.existsSync(entryFile)) {
    throw new Error(`Entry file not found: ${path.relative(appDir, entryFile)}. Set a Start Command like "node server.js" pointing at a file that module.exports an Express app.`);
  }

  // Bust require cache for this app's files so redeploys aren't stale
  Object.keys(require.cache).forEach(k => {
    if (k.startsWith(appDir)) delete require.cache[k];
  });

  await log(`Loading entry file in-process: ${path.relative(appDir, entryFile)}`);

  const envVars = (service.envVars || []).reduce((a, e) => { if (e.key) a[e.key] = e.value || ''; return a; }, {});
  const prevEnv = {};
  Object.keys(envVars).forEach(k => { prevEnv[k] = process.env[k]; process.env[k] = envVars[k]; });

  let exported;
  try {
    exported = require(entryFile);
  } finally {
    Object.keys(prevEnv).forEach(k => {
      if (prevEnv[k] === undefined) delete process.env[k]; else process.env[k] = prevEnv[k];
    });
  }

  const handler = (exported && exported.app) ? exported.app : exported;
  if (typeof handler !== 'function') {
    throw new Error(`"${path.relative(appDir, entryFile)}" must do "module.exports = app" (an Express app) instead of calling app.listen(). Remove/guard the app.listen() call, e.g. "if (require.main === module) app.listen(...)".`);
  }

  mountedApps.set(slug, handler);
  await log('App mounted successfully - live at /app/' + slug);
}

function unmountApp(slug) {
  mountedApps.delete(slug);
}

async function runDeployment(service, deployment) {
  const buildPath = path.join(WORK_DIR, `${service._id}-${uuidv4()}`);
  const appDir = path.join(APPS_DIR, service.slug);
  const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

  const log = async (msg, level = 'info') => {
    const entry = { ts: new Date(), level, msg };
    await Deployment.findByIdAndUpdate(deployment._id, { $push: { logs: entry } });
    if (global.broadcastLog) global.broadcastLog(service._id.toString(), { msg, level, ts: new Date() });
    console.log(`[${service.name}] ${msg}`);
  };

  try {
    fs.mkdirSync(buildPath, { recursive: true });
    fs.mkdirSync(APPS_DIR, { recursive: true });
    await Deployment.findByIdAndUpdate(deployment._id, { status: 'building' });

    await log('='.repeat(48));
    await log(`Deploy #${deployment.number} - ${service.name}`);
    await log(`Type: ${service.type} | Runtime: ${service.runtime}`);
    await log('='.repeat(48));

    await log('\n[1/3] Fetching source code...');
    if (service.sourceType === 'github' || service.sourceType === 'gitlab') {
      const base = service.sourceType === 'gitlab' ? 'https://gitlab.com' : 'https://github.com';
      await log(`Cloning ${base}/${service.repo} @ ${service.branch}`);
      await simpleGit().clone(`${base}/${service.repo}.git`, buildPath, ['--branch', service.branch, '--depth', '1']);
    } else if (service.zipPath && fs.existsSync(service.zipPath)) {
      await new Promise((res, rej) => {
        fs.createReadStream(service.zipPath)
          .pipe(unzipper.Extract({ path: buildPath }))
          .on('close', res).on('error', rej);
      });
      const items = fs.readdirSync(buildPath);
      if (items.length === 1 && fs.statSync(path.join(buildPath, items[0])).isDirectory()) {
        const nested = path.join(buildPath, items[0]);
        fs.readdirSync(nested).forEach(f => fs.renameSync(path.join(nested, f), path.join(buildPath, f)));
        fs.rmdirSync(nested);
      }
    } else {
      throw new Error('No source found. Connect GitHub or upload a ZIP file.');
    }
    await log('Source ready');

    const workDir = service.rootDir && service.rootDir !== '.' ? path.join(buildPath, service.rootDir) : buildPath;

    if (service.secretFiles?.length) {
      for (const sf of service.secretFiles) {
        const fp = path.join(workDir, sf.path);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, sf.content);
      }
    }

    await log('\n[2/3] Building...');
    if (fs.existsSync(path.join(workDir, 'package.json'))) {
      await log('Running npm install...');
      await runCmd('npm', ['install'], workDir, log);
    }
    if (service.buildCommand && service.buildCommand.trim()) {
      await log(`Running: ${service.buildCommand}`);
      const parts = service.buildCommand.split(' ');
      await runCmd(parts[0], parts.slice(1), workDir, log);
    }
    await log('Build complete');

    await log('\n[3/3] Deploying files...');
    await stopService(service._id.toString(), service.slug);
    if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
    copyDir(workDir, appDir);
    await log('Files saved');

    let assignedPort = 0;
    let pid = null;

    if (service.type === 'static') {
      await log('Static site - no process needed, serving files directly');
    } else if (service.type !== 'cron') {
      if (!isRender) {
        const port = service.assignedPort || await getFreePort();
        const envVars = {
          PORT: String(port), NODE_ENV: 'production',
          ...(service.envVars || []).reduce((a, e) => { if (e.key) a[e.key] = e.value || ''; return a; }, {})
        };
        const cmd = (service.startCommand || getDefaultCmd(service.runtime)).split(' ');
        await log(`Starting: ${cmd.join(' ')} on port ${port}`);
        const child = await startProcess(service._id.toString(), cmd[0], cmd.slice(1), appDir, envVars, log);
        if (child) {
          runningApps.set(service._id.toString(), { process: child, port });
          assignedPort = port;
          pid = child.pid;
        }
      } else {
        if (service.runtime === 'node') {
          await log('Render mode: mounting app in-process (no separate port)');
          try {
            await mountApp(service, appDir, log);
            assignedPort = -1;
          } catch (mountErr) {
            throw new Error(`In-process mount failed: ${mountErr.message}`);
          }
        } else {
          throw new Error(`Runtime "${service.runtime}" not supported on Render free tier. Use type "static", or deploy as its own separate Render Web Service.`);
        }
      }
    }

    await Service.findByIdAndUpdate(service._id, {
      status: 'live', assignedPort, pid,
      lastDeployedAt: new Date(), uptimeStart: new Date()
    });

    await Deployment.findByIdAndUpdate(deployment._id, {
      status: 'live', finishedAt: new Date(),
      buildDuration: Math.round((Date.now() - deployment.startedAt) / 1000)
    });

    const backendUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 5000}`;
    const appUrl = `${backendUrl}/app/${service.slug}`;

    await log('\n' + '='.repeat(48));
    await log('DEPLOYED SUCCESSFULLY!');
    await log(`App URL: ${appUrl}`);
    await log(`Build time: ${Math.round((Date.now() - deployment.startedAt) / 1000)}s`);
    await log('='.repeat(48));

    if (global.broadcastLog) global.broadcastLog(service._id.toString(), { msg: `Live at ${appUrl}`, level: 'success', ts: new Date() });
    await Notification.create({ user: service.owner, title: 'Deploy successful', message: `${service.name} is live`, type: 'deploy_success', service: service._id }).catch(() => {});

  } catch (err) {
    console.error(`Deploy failed [${service.name}]:`, err.message);
    await Deployment.findByIdAndUpdate(deployment._id, { status: 'failed', finishedAt: new Date(), errorMessage: err.message });
    await Service.findByIdAndUpdate(service._id, { status: 'failed' });
    if (global.broadcastLog) global.broadcastLog(service._id.toString(), { msg: `Failed: ${err.message}`, level: 'error', ts: new Date() });
    await Notification.create({ user: service.owner, title: 'Deploy failed', message: `${service.name}: ${err.message}`, type: 'deploy_fail', service: service._id }).catch(() => {});
  } finally {
    try { fs.rmSync(buildPath, { recursive: true, force: true }); } catch (e) {}
  }
}

function startProcess(serviceId, cmd, args, cwd, env, log) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, detached: false });
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(child); } };
    child.stdout && child.stdout.on('data', d => { const m = d.toString().trim(); if (m && global.broadcastLog) global.broadcastLog(serviceId, { msg: m, level: 'info', ts: new Date() }); finish(); });
    child.stderr && child.stderr.on('data', d => { const m = d.toString().trim(); if (m && global.broadcastLog) global.broadcastLog(serviceId, { msg: m, level: 'warn', ts: new Date() }); finish(); });
    child.on('error', () => finish());
    child.on('exit', code => { if (global.broadcastLog) global.broadcastLog(serviceId, { msg: `Process exited (${code})`, level: code ? 'error' : 'info', ts: new Date() }); });
    setTimeout(finish, 3000);
  });
}

async function stopService(serviceId, slug) {
  const app = runningApps.get(serviceId);
  if (app && app.process) { try { app.process.kill('SIGTERM'); } catch (e) {} runningApps.delete(serviceId); }
  if (slug) unmountApp(slug);
}

async function restartService(service) {
  const appDir = path.join(APPS_DIR, service.slug);
  if (!fs.existsSync(appDir)) throw new Error('No deployed files. Deploy first.');
  await stopService(service._id.toString(), service.slug);
  const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

  if (service.type === 'static') {
    await Service.findByIdAndUpdate(service._id, { status: 'live' });
    return;
  }

  if (isRender) {
    if (service.runtime !== 'node') throw new Error(`Runtime "${service.runtime}" not supported on Render free tier.`);
    await mountApp(service, appDir, (msg) => console.log(`[${service.name}] ${msg}`));
    await Service.findByIdAndUpdate(service._id, { status: 'live', assignedPort: -1 });
    return;
  }

  const port = service.assignedPort || await getFreePort();
  const env = { PORT: String(port), ...(service.envVars || []).reduce((a, e) => { if (e.key) a[e.key] = e.value || ''; return a; }, {}) };
  const cmd = (service.startCommand || getDefaultCmd(service.runtime)).split(' ');
  const child = await startProcess(service._id.toString(), cmd[0], cmd.slice(1), appDir, env, console.log);
  if (child) runningApps.set(service._id.toString(), { process: child, port });
  await Service.findByIdAndUpdate(service._id, { status: 'live', assignedPort: port, pid: child ? child.pid : null });
}

function runCmd(cmd, args, cwd, log) {
  return new Promise((res, rej) => {
    const c = spawn(cmd, args, { cwd, env: process.env });
    c.stdout && c.stdout.on('data', d => log(d.toString().trim()));
    c.stderr && c.stderr.on('data', d => log(d.toString().trim(), 'warn'));
    c.on('close', code => code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`)));
    c.on('error', rej);
  });
}

function getFreePort() {
  return new Promise(res => {
    const net = require('net');
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

function getDefaultCmd(runtime) {
  const cmds = { node: 'node index.js', python: 'python app.py', ruby: 'ruby app.rb', go: './app' };
  return cmds[runtime] || 'node index.js';
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(e => {
    if (e.name === '.git') return;
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  });
}

module.exports = { runDeployment, stopService, restartService, runningApps, mountedApps };
