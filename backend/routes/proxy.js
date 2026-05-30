const express = require('express');
const router = express.Router();
const http = require('http');
const { Service } = require('../models/index');

// Proxy requests to running apps: GET /app/:slug/*
router.all('/:slug/*', async (req, res) => {
  try {
    const service = await Service.findOne({ slug: req.params.slug, status: 'live' });

    if (!service || !service.assignedPort) {
      return res.status(404).send(`
        <html>
          <head><style>body{font-family:sans-serif;background:#060612;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style></head>
          <body>
            <div style="text-align:center">
              <h2>🔍 App not found</h2>
              <p style="color:#94a3b8">Service "${req.params.slug}" is not running or doesn't exist.</p>
              <a href="/" style="color:#6366f1">← Back to JuanHost</a>
            </div>
          </body>
        </html>
      `);
    }

    // Proxy to the running app
    const targetPath = '/' + (req.params[0] || '');
    const options = {
      hostname: 'localhost',
      port: service.assignedPort,
      path: targetPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
      method: req.method,
      headers: { ...req.headers, host: `localhost:${service.assignedPort}` }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', () => {
      res.status(502).send(`
        <html>
          <head><style>body{font-family:sans-serif;background:#060612;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style></head>
          <body>
            <div style="text-align:center">
              <h2>⚠️ App unavailable</h2>
              <p style="color:#94a3b8">"${service.name}" is not responding on port ${service.assignedPort}.</p>
              <a href="/dashboard/services/${service._id}" style="color:#6366f1">View service →</a>
            </div>
          </body>
        </html>
      `);
    });

    if (req.body && req.method !== 'GET') {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();

  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

module.exports = router;
