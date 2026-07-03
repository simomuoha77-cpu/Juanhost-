const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Service, Domain } = require('../models/index');
const { mountedApps } = require('../services/deployer');

const APPS_DIR = process.env.APPS_DIR || path.join(require('os').homedir(), 'juanhost-apps');

// Your own root platform domain(s) - dashboard/API traffic, never treated as
// a hosted app. Set PLATFORM_DOMAIN in env, e.g. "juanhost.co.ke".
const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN || '').toLowerCase();
const RENDER_HOST = (process.env.RENDER_EXTERNAL_HOSTNAME || '').toLowerCase();

router.use(async (req, res, next) => {
  const host = (req.hostname || '').toLowerCase();
  if (!host) return next();

  // Platform's own root/dashboard domain, or the raw onrender.com host,
  // or already using the /app/ path convention -> not a subdomain/custom
  // domain lookup, let normal routing (API, frontend, /app proxy) handle it.
  if (!PLATFORM_DOMAIN || host === PLATFORM_DOMAIN || host === RENDER_HOST || host.endsWith('.onrender.com') || req.path.startsWith('/app/') || req.path.startsWith('/api/')) {
    return next();
  }

  let service = null;

  if (PLATFORM_DOMAIN && host.endsWith('.' + PLATFORM_DOMAIN)) {
    // Free auto-assigned subdomain: sitename.juanhost.co.ke -> slug "sitename"
    const slug = host.slice(0, -('.' + PLATFORM_DOMAIN).length);
    service = await Service.findOne({ slug });
  } else {
    // Custom domain the user attached, e.g. juanapp.com
    const domainDoc = await Domain.findOne({ domain: host, verified: true, status: 'active' }).populate('service');
    if (domainDoc && domainDoc.service) service = domainDoc.service;
  }

  if (!service) return next(); // unknown host, fall through to 404

  return dispatchToService(service, req, res, next);
});

async function dispatchToService(service, req, res, next) {
  try {
    if (service.status !== 'live') {
      return res.status(503).send(errorPage('App not running', `"${service.name}" is currently ${service.status}.`));
    }

    if (service.type !== 'static') {
      const handler = mountedApps.get(service.slug);
      if (!handler) return res.status(503).send(errorPage('App not running', `"${service.name}" has no active process. Try redeploying.`));
      return handler(req, res, next || (() => {}));
    }

    const appDir = path.join(APPS_DIR, service.slug);
    if (!fs.existsSync(appDir)) return res.status(404).send(errorPage('Files not found', `"${service.name}" has no deployed files yet.`));

    let filePath = path.join(appDir, req.path);
    if (!filePath.startsWith(appDir)) return res.status(403).send('Forbidden');

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      const indexPath = path.join(appDir, 'index.html');
      if (fs.existsSync(indexPath)) filePath = indexPath;
      else return res.status(404).send(errorPage('Page not found', `"${req.path}" not found.`));
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
    if (types[ext]) res.setHeader('Content-Type', types[ext]);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send(errorPage('Server error', err.message));
  }
}

function errorPage(title, message) {
  return `<!DOCTYPE html><html><head><title>${title}</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#060612;color:#e2e8f0;font-family:sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
.box{text-align:center;padding:48px 32px;background:#111128;border:1px solid #252545;border-radius:16px;max-width:420px;width:90%}
h1{font-size:1.5rem;font-weight:800;margin-bottom:10px}p{color:#94a3b8;line-height:1.6}
</style></head><body><div class="box"><div style="font-size:2.5rem;margin-bottom:16px">!</div>
<h1>${title}</h1><p>${message}</p></div></body></html>`;
}

module.exports = router;
