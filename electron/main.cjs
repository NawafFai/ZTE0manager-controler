'use strict';

/**
 * Electron main process for ZTE Router Manager (desktop .exe).
 *
 * It runs a tiny local HTTP server on 127.0.0.1 that:
 *   1. serves the built React app (from ../dist), and
 *   2. proxies the router's hidden API + static JS to the real device.
 *
 * This reproduces the Vite dev proxy in production, so the packaged app stays
 * same-origin and localhost-only — no CORS hacks, no disabled web security, and
 * the router session cookie is forwarded transparently. The router IP is
 * user-configurable and persisted; login is done through the router's own page
 * opened at the same 127.0.0.1 origin so the cookie is shared with the app.
 */

const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const DEFAULT_HOST = process.env.ZTE_ROUTER_HOST || 'http://192.168.8.1';
// ZTE firmware paths + Huawei HiLink paths (5G CPE 5 / H155-383 serves its UI
// from /lib, /res, ... and its XML API from /api — all must stay same-origin).
const PROXY_PREFIXES = [
  '/goform', '/js', '/app', '/adm', '/img', '/language', '/style', '/css',
  '/api', '/lib', '/res', '/config', '/locale', '/lang', '/fonts', '/html', '/favicon.ico',
];
const ROUTER_MOUNT = '/__router'; // exposes the router's own root (login page)

let mainWindow = null;
let serverPort = 0;
let routerHost = DEFAULT_HOST;

// --- config persistence ------------------------------------------------------

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg && typeof cfg.routerHost === 'string' && cfg.routerHost) {
      routerHost = normalizeHost(cfg.routerHost);
    }
  } catch {
    /* first run — use default */
  }
}

function saveConfig() {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify({ routerHost }, null, 2));
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

function normalizeHost(input) {
  let h = String(input).trim();
  if (!/^https?:\/\//i.test(h)) h = `http://${h}`;
  return h.replace(/\/+$/, '');
}

// --- static file serving -----------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // Static asset request (has a file extension) → serve from dist, else SPA fallback.
  const candidate = path.join(DIST_DIR, urlPath);
  if (path.extname(urlPath) && candidate.startsWith(DIST_DIR) && fs.existsSync(candidate)) {
    serveFile(res, candidate);
    return;
  }
  serveFile(res, path.join(DIST_DIR, 'index.html'));
}

// --- router proxy ------------------------------------------------------------

/** Remove `Domain=` from Set-Cookie so the router session binds to 127.0.0.1. */
function sanitizeSetCookie(headers) {
  const cookies = headers['set-cookie'];
  if (!Array.isArray(cookies)) return headers;
  headers['set-cookie'] = cookies.map((c) =>
    c
      .split(';')
      .filter((part) => !/^\s*domain=/i.test(part))
      .join(';'),
  );
  return headers;
}

function proxyToRouter(req, res, rewrittenPath) {
  let target;
  try {
    target = new URL(routerHost);
  } catch {
    res.writeHead(500);
    res.end('Invalid router host');
    return;
  }

  const isHttps = target.protocol === 'https:';
  const mod = isHttps ? https : http;
  // ZTE firmware enforces a CSRF check on the Referer/Origin header: unless they
  // point at the router itself, `cmd=RD` (and other calls) return empty, which
  // surfaces as "Could not read RD token". We rewrite them to the router origin.
  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    method: req.method,
    path: rewrittenPath,
    headers: {
      ...req.headers,
      host: target.host,
      origin: routerHost,
      referer: `${routerHost}/index.html`,
    },
    rejectUnauthorized: false,
  };

  const proxyReq = mod.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, sanitizeSetCookie({ ...proxyRes.headers }));
    proxyRes.pipe(res);
  });
  proxyReq.setTimeout(15000, () => proxyReq.destroy(new Error('router timeout')));
  proxyReq.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Router proxy error: ${err.message}\nRouter: ${routerHost}`);
  });
  req.pipe(proxyReq);
}

function shouldProxy(urlPath) {
  return PROXY_PREFIXES.some((p) => urlPath === p || urlPath.startsWith(`${p}/`) || urlPath.startsWith(`${p}?`));
}

// Stable ports keep the app origin (and thus localStorage: theme, history,
// discovered APIs) consistent across launches. We try these in order.
const PREFERRED_PORTS = [42431, 42432, 42433, 42434, 42435];

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://localhost').pathname;

    // Router's own UI (login page) mounted so it shares the app origin.
    if (urlPath === ROUTER_MOUNT || urlPath.startsWith(`${ROUTER_MOUNT}/`)) {
      const stripped = req.url.slice(ROUTER_MOUNT.length) || '/';
      proxyToRouter(req, res, stripped);
      return;
    }

    if (shouldProxy(urlPath)) {
      proxyToRouter(req, res, req.url);
      return;
    }

    serveStatic(req, res);
  });

  return new Promise((resolve, reject) => {
    let attempt = 0;
    const tryListen = () => {
      const port = PREFERRED_PORTS[attempt];
      if (port === undefined) {
        // All preferred ports busy — fall back to an ephemeral one.
        server.listen(0, '127.0.0.1');
        return;
      }
      server.listen(port, '127.0.0.1');
    };
    server.on('listening', () => {
      serverPort = server.address().port;
      resolve(serverPort);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        attempt += 1;
        setTimeout(tryListen, 0);
      } else {
        reject(err);
      }
    });
    tryListen();
  });
}

// --- windows + menu ----------------------------------------------------------

function appUrl(routePath = '/') {
  return `http://127.0.0.1:${serverPort}${routePath}`;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0c0f16',
    title: 'ZTE Router Manager',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(appUrl('/'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function openRouterLogin() {
  const win = new BrowserWindow({
    width: 900,
    height: 720,
    title: 'Router Login',
    parent: mainWindow || undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // The router's own page at the same 127.0.0.1 origin → cookie is shared.
  win.loadURL(appUrl(ROUTER_MOUNT + '/'));
  // When the login window is closed, tell the app to (re)connect so it reflects
  // the now-authenticated session immediately.
  win.on('closed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents
        .executeJavaScript("window.dispatchEvent(new Event('zrm:reconnect'))")
        .catch(() => {});
    }
  });
}

async function promptRouterIp() {
  const current = routerHost;
  // Minimal inline prompt window (Electron has no native text-input dialog).
  const promptWin = new BrowserWindow({
    width: 420,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Set Router IP',
    parent: mainWindow || undefined,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-prompt.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Segoe UI,system-ui,sans-serif;background:#141924;color:#e2e8f0;margin:0;padding:18px}
      label{font-size:12px;color:#94a3b8;display:block;margin-bottom:6px}
      input{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #2a3344;background:#0c0f16;color:#e2e8f0;font-size:14px}
      .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
      button{padding:8px 14px;border-radius:8px;border:0;font-size:13px;cursor:pointer}
      .ok{background:#0ea5e9;color:#fff}.cancel{background:#1e2634;color:#e2e8f0}
    </style></head><body>
    <label>Router address (IP or URL)</label>
    <input id="v" value="${current.replace(/"/g, '&quot;')}" autofocus />
    <div class="row">
      <button class="cancel" onclick="window.promptApi.cancel()">Cancel</button>
      <button class="ok" onclick="window.promptApi.submit(document.getElementById('v').value)">Save</button>
    </div>
    <script>document.getElementById('v').addEventListener('keydown',e=>{if(e.key==='Enter')window.promptApi.submit(e.target.value);if(e.key==='Escape')window.promptApi.cancel();});</script>
    </body></html>`;

  promptWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  const { ipcMain } = require('electron');
  const onSubmit = (_e, value) => {
    routerHost = normalizeHost(value);
    saveConfig();
    buildMenu();
    cleanup();
    if (mainWindow) mainWindow.loadURL(appUrl('/'));
  };
  const onCancel = () => cleanup();
  function cleanup() {
    ipcMain.removeListener('prompt:submit', onSubmit);
    ipcMain.removeListener('prompt:cancel', onCancel);
    if (!promptWin.isDestroyed()) promptWin.close();
  }
  ipcMain.on('prompt:submit', onSubmit);
  ipcMain.on('prompt:cancel', onCancel);
  promptWin.on('closed', () =>
    ipcMain.removeAllListeners('prompt:submit') && ipcMain.removeAllListeners('prompt:cancel'),
  );
}

function buildMenu() {
  const template = [
    {
      label: 'Router',
      submenu: [
        { label: `Set Router IP…  (${routerHost})`, click: () => promptRouterIp() },
        { label: 'Login to Router…', click: () => openRouterLogin() },
        { type: 'separator' },
        {
          label: 'Reload App',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.loadURL(appUrl('/')),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Toggle DevTools', accelerator: 'F12', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'ZTE Router Manager',
              message: 'ZTE Router Manager',
              detail:
                'Local, open-source manager for the hidden ZTE router API.\n' +
                `Router: ${routerHost}\nAll traffic stays on this machine.`,
            }),
        },
        {
          label: 'Project docs',
          click: () => shell.openExternal('https://github.com/'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- lifecycle ---------------------------------------------------------------

app.whenReady().then(async () => {
  loadConfig();
  try {
    await startServer();
  } catch (err) {
    dialog.showErrorBox('Startup error', `Could not start local server: ${err.message}`);
    app.quit();
    return;
  }
  buildMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
