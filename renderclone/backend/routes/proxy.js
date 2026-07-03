const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Service } = require('../models/index');

const APPS_DIR = process.env.APPS_DIR || path.join(require('os').homedir(), 'juanhost-apps');

router.get('/:slug', serveApp);
router.get('/:slug/*', serveApp);

async function serveApp(req, res) {
  try {
    const service = await Service.findOne({ slug: req.params.slug });
    if (!service) return res.status(404).send(errorPage('App not found', `No service named "${req.params.slug}" exists.`));
    if (service.status !== 'live') return res.status(503).send(errorPage('App not running', `"${service.name}" is currently ${service.status}.`, service._id));

    const appDir = path.join(APPS_DIR, service.slug);
    if (!fs.existsSync(appDir)) return res.status(404).send(errorPage('Files not found', `"${service.name}" has no deployed files yet.`, service._id));

    const reqPath = req.params[0] || '';
    let filePath = path.join(appDir, reqPath);
    if (!filePath.startsWith(appDir)) return res.status(403).send('Forbidden');

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      const indexPath = path.join(appDir, 'index.html');
      if (fs.existsSync(indexPath)) filePath = indexPath;
      else return res.status(404).send(errorPage('Page not found', `"${reqPath}" not found.`));
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
    if (types[ext]) res.setHeader('Content-Type', types[ext]);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send(errorPage('Server error', err.message));
  }
}

function errorPage(title, message, serviceId) {
  return `<!DOCTYPE html><html><head><title>${title}</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#060612;color:#e2e8f0;font-family:sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
.box{text-align:center;padding:48px 32px;background:#111128;border:1px solid #252545;border-radius:16px;max-width:420px;width:90%}
h1{font-size:1.5rem;font-weight:800;margin-bottom:10px}p{color:#94a3b8;margin-bottom:24px;line-height:1.6}a{color:#6366f1;font-weight:600}
</style></head><body><div class="box"><div style="font-size:2.5rem;margin-bottom:16px">!</div>
<h1>${title}</h1><p>${message}</p>
${serviceId ? `<a href="/dashboard/services/${serviceId}">View Service</a><br><br>` : ''}
<a href="/">Back to JuanHost</a></div></body></html>`;
}

module.exports = router;
