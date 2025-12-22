import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import net from 'net';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const logsDir = path.join(projectRoot, 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createWriteStream = (name) => {
  const filePath = path.join(logsDir, name);
  return fs.createWriteStream(filePath, { flags: 'a' });
};

const backendLog = createWriteStream('backend.log');
const frontendLog = createWriteStream('frontend.log');
const launcherLog = createWriteStream('launcher.log');

const log = (message) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  launcherLog.write(line);
};

async function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, host);
  });
}

async function findAvailablePort(start, host = '127.0.0.1', attempts = 100) {
  let port = start;
  for (let i = 0; i < attempts; i += 1, port += 1) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(`No free ports found starting from ${start}`);
}

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getPidsUsingPort(port) {
  const pids = new Set();
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('netstat', ['-ano', '-p', 'tcp']);
      const output = result.stdout?.toString() || '';
      const lines = output.split(/\r?\n/);
      const target = `:${port}`;
      for (const rawLine of lines) {
        if (!rawLine.includes(target)) continue;
        const line = rawLine.trim();
        if (!line) continue;
        const parts = line.split(/\s+/);
        if (parts.length < 5) continue;
        const localAddress = parts[1] || '';
        const state = (parts[3] || '').toUpperCase();
        const pid = parseNumber(parts[4]);
        if (!localAddress.endsWith(target)) continue;
        if (state !== 'LISTENING') continue;
        if (pid && pid > 0) pids.add(pid);
      }
    } else {
      let result = spawnSync('lsof', ['-ti', `:${port}`]);
      if (result.status !== 0 || !result.stdout?.length) {
        result = spawnSync('fuser', ['-n', 'tcp', String(port)]);
      }
      const output = result.stdout?.toString() || '';
      const matches = output.match(/\d+/g) || [];
      matches.forEach(pidStr => {
        const pid = parseNumber(pidStr);
        if (pid && pid > 0) pids.add(pid);
      });
    }
  } catch (err) {
    log(`Failed to inspect port ${port}: ${err?.message || err}`);
  }
  return Array.from(pids);
}

function forceKillPid(pid) {
  if (!pid || pid === process.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
      }
    }
    log(`Force-terminated PID ${pid} occupying required port`);
  } catch (err) {
    log(`Failed to terminate PID ${pid}: ${err?.message || err}`);
  }
}

async function ensurePortAvailable(port, host = '127.0.0.1') {
  if (await isPortAvailable(port, host)) {
    return;
  }

  const pids = getPidsUsingPort(port);
  if (pids.length === 0) {
    throw new Error(`Port ${port} is busy and owning process could not be determined.`);
  }

  pids.forEach(forceKillPid);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(200);
    if (await isPortAvailable(port, host)) {
      return;
    }
  }

  throw new Error(`Port ${port} is still busy after attempting to terminate processes (${pids.join(', ')}).`);
}

async function waitForHttp(port, pathName = '/', attempts = 60, interval = 500) {
  const url = `http://127.0.0.1:${port}${pathName}`;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const resp = await fetch(url, { method: 'GET' });
      if (resp.status < 500) {
        return;
      }
    } catch (err) {
      // ignore and retry
    }
    await delay(interval);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' });
    return;
  }
  if (platform === 'darwin') {
    spawn('open', [url], { windowsHide: true, stdio: 'ignore' });
    return;
  }
  spawn('xdg-open', [url], { windowsHide: true, stdio: 'ignore' });
}

let shuttingDown = false;
let backendProcess = null;
let frontendProcess = null;
let controllerServer = null;
let heartbeatTimer = null;

const HEARTBEAT_TIMEOUT_MS = 10000;
const HEARTBEAT_INITIAL_GRACE_MS = 60000;

const clearHeartbeat = () => {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const scheduleHeartbeat = (timeout = HEARTBEAT_TIMEOUT_MS) => {
  clearHeartbeat();
  heartbeatTimer = setTimeout(() => {
    log('Heartbeat timeout reached');
    shutdown('heartbeat timeout');
  }, timeout).unref?.();
};

async function shutdown(reason = 'unknown') {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Shutdown requested: ${reason}`);

  clearHeartbeat();

  const killChild = (child, label) => {
    if (!child) return;
    try {
      child.removeAllListeners();
      child.kill();
      log(`${label} terminated`);
    } catch (err) {
      log(`${label} termination error: ${err?.message || err}`);
    }
  };

  killChild(frontendProcess, 'frontend');
  killChild(backendProcess, 'backend');

  if (controllerServer) {
    try {
      controllerServer.close();
    } catch (err) {
      log(`controller close error: ${err?.message || err}`);
    }
  }

  await delay(300);
  process.exit(0);
}

function attachProcessGuards(child, label) {
  child.on('exit', (code, signal) => {
    log(`${label} exited (code: ${code}, signal: ${signal})`);
    if (!shuttingDown) {
      shutdown(`${label} exited`);
    }
  });
  child.on('error', (err) => {
    log(`${label} error: ${err?.message || err}`);
    if (!shuttingDown) {
      shutdown(`${label} error`);
    }
  });
}

async function main() {
  try {
    const backendPort = await findAvailablePort(Number(process.env.SERVER_PORT) || 3005);
    const desiredFrontendPort = Number(process.env.FRONTEND_PORT) || 3000;
    await ensurePortAvailable(desiredFrontendPort);
    const frontendPort = desiredFrontendPort;
    const controllerPort = await findAvailablePort(45700);

    log(`Ports resolved backend=${backendPort}, frontend=${frontendPort}, controller=${controllerPort}`);

    const envBase = {
      ...process.env,
      SERVER_PORT: String(backendPort),
      PORT: String(backendPort),
      SUPPRESS_AUTO_OPEN: '1'
    };

    const backendEntry = path.join(projectRoot, 'server', 'index.js');
    backendProcess = spawn(process.execPath, [backendEntry], {
      env: envBase,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    backendProcess.stdout.pipe(backendLog);
    backendProcess.stderr.pipe(backendLog);
    attachProcessGuards(backendProcess, 'backend');

    const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
    const frontendEnv = {
      ...envBase,
      VITE_BACKEND_PORT: String(backendPort),
      VITE_CONTROLLER_PORT: String(controllerPort),
      BROWSER: 'none'
    };
    frontendProcess = spawn(process.execPath, [viteBin, '--port', String(frontendPort), '--host', '127.0.0.1'], {
      env: frontendEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    frontendProcess.stdout.pipe(frontendLog);
    frontendProcess.stderr.pipe(frontendLog);
    attachProcessGuards(frontendProcess, 'frontend');

    await waitForHttp(backendPort, '/', 80, 250);
    await waitForHttp(frontendPort, '/', 80, 250);

    controllerServer = http.createServer((req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/ping') {
        scheduleHeartbeat();
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*'
        });
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/shutdown') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('ok');
        shutdown('controller request');
        return;
      }

      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
      res.end('not found');
    });

    await new Promise((resolve, reject) => {
      controllerServer.once('error', reject);
      controllerServer.listen(controllerPort, '127.0.0.1', resolve);
    });
    log(`Controller listening on ${controllerPort}`);

    scheduleHeartbeat(HEARTBEAT_INITIAL_GRACE_MS);

    const url = `http://localhost:${frontendPort}/?controllerPort=${controllerPort}`;
    openBrowser(url);
    log(`Browser opened at ${url}`);

    const handleExit = (type) => () => shutdown(type);
    process.on('SIGINT', handleExit('SIGINT'));
    process.on('SIGTERM', handleExit('SIGTERM'));
    process.on('SIGHUP', handleExit('SIGHUP'));
  } catch (err) {
    log(`Launcher failed: ${err?.stack || err}`);
    await delay(200);
    process.exit(1);
  }
}

main();
