import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, types } from 'pg';
import fs from 'fs/promises';
import fsSync from 'fs';
import https from 'https';
import path from 'path';

// Override default pg type parsers to prevent timezone conversion on dates and timestamps
types.setTypeParser(1082, (val) => val); // date
types.setTypeParser(1114, (val) => val); // timestamp without time zone
types.setTypeParser(1184, (val) => val); // timestamp with time zone

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const validateDateField = (field) => ['production_date', 'dtime_ins'].includes(field);

// Helper to connect to Postgres with IPv6 -> IPv4 fallback on certain errors
async function connectWithFallback(connection) {
  const makeClient = (conn) => new Client(conn);
  try {
    const client = makeClient(connection);
    await client.connect();
    return client;
  } catch (err) {
    logToFile('DB connect failed: ' + (err && err.code ? err.code : '') + ' ' + (err && err.message ? err.message : err));
    // Try IPv4 fallback on common network/access errors
    if (err && (err.code === 'EACCES' || err.code === 'ECONNREFUSED' || err.code === 'ENETUNREACH')) {
      try {
        if (typeof connection === 'string') {
          const fallback = connection.replace('host=::1', 'host=127.0.0.1').replace('host=localhost', 'host=127.0.0.1');
          const client2 = makeClient(fallback);
          await client2.connect();
          logToFile('DB connect fallback success to 127.0.0.1 (string)');
          return client2;
        } else if (typeof connection === 'object') {
          const conn2 = { ...connection, host: '127.0.0.1' };
          const client2 = makeClient(conn2);
          await client2.connect();
          logToFile('DB connect fallback success to 127.0.0.1 (object)');
          return client2;
        }
      } catch (err2) {
        logToFile('DB connect fallback failed: ' + (err2 && err2.code ? err2.code : '') + ' ' + (err2 && err2.message ? err2.message : err2));
        // rethrow original error to keep behavior deterministic
        throw err;
      }
    }
    throw err;
  }
}

// Determine settings file path and dist path in a portable way
import os from 'os';
import { exec } from 'child_process';
const isPkg = typeof process.pkg !== 'undefined';
const exeDir = isPkg ? path.dirname(process.execPath) : process.cwd();
const embeddedSettings = path.join(exeDir, 'settings.json');
const appDataDir = process.env.APPDATA || path.join(os.homedir(), '.config');
const appSettingsDir = path.join(appDataDir, 'markview');
const defaultSettingsFile = path.join(appSettingsDir, 'settings.json');
const SETTINGS_FILE = process.env.SETTINGS_FILE || (fsSync.existsSync(embeddedSettings) ? embeddedSettings : defaultSettingsFile);
const DIST_PATH = process.env.DIST_PATH || (fsSync.existsSync(path.join(exeDir, 'dist')) ? path.join(exeDir, 'dist') : path.resolve(process.cwd(), 'dist'));
const SETTINGS_TARGETS = [...new Set([embeddedSettings, defaultSettingsFile].filter(Boolean))];

const DEFAULT_SETTINGS = Object.freeze({ connections: [], products: [], fieldLabels: {} });
let settingsCache = { connections: [], products: [], fieldLabels: {} };
let settingsCacheLoaded = false;

function normalizeSettings(data) {
  if (!data || typeof data !== 'object') {
    return { connections: [], products: [] };
  }

  const normalized = {
    connections: Array.isArray(data.connections) ? data.connections : [],
    products: Array.isArray(data.products) ? data.products : [],
    fieldLabels: (data.fieldLabels && typeof data.fieldLabels === 'object') ? data.fieldLabels : {}
  };

  return normalized;
}

async function removeIfExists(filePath) {
  try {
    await fs.rm(filePath, { force: true });
  } catch (err) {
    logToFile(`Failed removing ${filePath}: ${err?.code || err?.message || err}`);
  }
}

async function safeWriteJson(target, json) {
  const dir = path.dirname(target);
  const tmpPath = `${target}.tmp`;
  const bakPath = `${target}.bak`;

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmpPath, json, 'utf-8');

  try {
    if (fsSync.existsSync(bakPath)) {
      await fs.rm(bakPath, { force: true });
    }
  } catch (err) {
    logToFile(`Failed to clear backup before write ${bakPath}: ${err?.code || err?.message || err}`);
  }

  try {
    if (fsSync.existsSync(target)) {
      await fs.rename(target, bakPath);
    }
  } catch (err) {
    await removeIfExists(tmpPath);
    throw err;
  }

  try {
    await fs.rename(tmpPath, target);
  } catch (err) {
    // Attempt to restore from backup on failure and rethrow
    try {
      if (fsSync.existsSync(bakPath)) {
        await fs.rename(bakPath, target);
      }
    } catch (restoreErr) {
      logToFile(`Failed to restore backup for ${target}: ${restoreErr?.code || restoreErr?.message || restoreErr}`);
    }
    await removeIfExists(tmpPath);
    throw err;
  }

  await removeIfExists(bakPath);
}

async function repairSettingsArtifacts(target) {
  const tmpPath = `${target}.tmp`;
  const bakPath = `${target}.bak`;

  try {
    if (fsSync.existsSync(tmpPath)) {
      if (!fsSync.existsSync(target)) {
        await fs.rename(tmpPath, target);
      } else {
        await fs.rm(tmpPath, { force: true });
      }
    }
  } catch (err) {
    logToFile(`Failed to process tmp artifact for ${target}: ${err?.code || err?.message || err}`);
  }

  try {
    if (fsSync.existsSync(bakPath)) {
      if (!fsSync.existsSync(target)) {
        await fs.rename(bakPath, target);
      } else {
        await fs.rm(bakPath, { force: true });
      }
    }
  } catch (err) {
    logToFile(`Failed to process backup artifact for ${target}: ${err?.code || err?.message || err}`);
  }
}

async function writeSettingsToTargets(payload) {
  const json = JSON.stringify(payload, null, 2);
  let primaryPath = null;
  const attempts = [];
  const failedTargets = [];

  for (const target of SETTINGS_TARGETS) {
    try {
      await safeWriteJson(target, json);
      logToFile(`Settings persisted to ${target} (conns=${payload?.connections?.length ?? 0}, prods=${payload?.products?.length ?? 0}, labels=${Object.keys(payload?.fieldLabels ?? {}).length})`);
      if (!primaryPath) primaryPath = target;
      attempts.push({ path: target, ok: true });
    } catch (err) {
      attempts.push({ path: target, ok: false, error: err?.code || err?.message || String(err) });
      logToFile(`Settings write failure for ${target}: ${err?.code || err?.message || err}`);
      failedTargets.push(target);
    }
  }

  if (!primaryPath) {
    const error = new Error('Failed to persist settings');
    error.attempts = attempts;
    throw error;
  }

  if (failedTargets.length > 0) {
    logToFile('Settings write warnings: ' + JSON.stringify(attempts.filter(entry => !entry.ok)));
    try {
      const data = await fs.readFile(primaryPath, 'utf-8');
      for (const target of failedTargets) {
        if (target === primaryPath) continue;
        try {
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, data, 'utf-8');
          logToFile(`Fallback write succeeded for ${target}`);
        } catch (err) {
          logToFile(`Fallback write failed for ${target}: ${err?.code || err?.message || err}`);
        }
      }
    } catch (err) {
      logToFile('Fallback replication failed: ' + (err?.code || err?.message || err));
    }
  }

  return { path: primaryPath, attempts };
}

async function syncEmbeddedSettings(data, sourcePath) {
  if (!embeddedSettings || sourcePath === embeddedSettings) return;
  try {
    await fs.mkdir(path.dirname(embeddedSettings), { recursive: true });
    await fs.writeFile(embeddedSettings, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logToFile(`Embedded settings sync failed from ${sourcePath}: ${err?.code || err?.message || err}`);
  }
}

async function loadSettingsFromTargets() {
  for (const target of SETTINGS_TARGETS) {
    await repairSettingsArtifacts(target);
  }

  const existing = SETTINGS_TARGETS.filter((target) => {
    try { return fsSync.existsSync(target); } catch { return false; }
  });
  if (existing.length === 0) return null;

  let selectedPath = null;
  let selectedMtime = -Infinity;

  for (const target of existing) {
    try {
      const stat = fsSync.statSync(target);
      if (stat.mtimeMs >= selectedMtime) {
        selectedMtime = stat.mtimeMs;
        selectedPath = target;
      }
    } catch (err) {
      logToFile(`Failed to stat settings file ${target}: ${err?.code || err?.message || err}`);
    }
  }

  if (!selectedPath) return null;

  const raw = await fs.readFile(selectedPath, 'utf-8');
  const data = JSON.parse(raw);

  await syncEmbeddedSettings(data, selectedPath);

  logToFile(`Settings loaded from ${selectedPath} (conns=${data?.connections?.length}, prods=${data?.products?.length}, labels=${Object.keys(data?.fieldLabels ?? {}).length})`);

  return { data: normalizeSettings(data), path: selectedPath };
}

async function refreshSettingsCache() {
  try {
    const loaded = await loadSettingsFromTargets();
    if (loaded) {
      settingsCache = loaded.data;
      settingsCacheLoaded = true;
      return loaded;
    }
  } catch (err) {
    logToFile('refreshSettingsCache error: ' + (err?.stack || err));
  }
  settingsCache = { ...DEFAULT_SETTINGS };
  settingsCacheLoaded = true;
  return null;
}

function getCachedSettings() {
  if (!settingsCacheLoaded) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    connections: Array.isArray(settingsCache.connections) ? [...settingsCache.connections] : [],
    products: Array.isArray(settingsCache.products) ? [...settingsCache.products] : []
  };
}

// Logging helper: write startup and error info to a log next to the exe (helps debugging packaged exe)
const LOG_PATH = path.join(exeDir, 'markview.log');
function logToFile(msg) {
  try { fsSync.appendFileSync(LOG_PATH, `${new Date().toISOString()} - ${msg}\n`); } catch (e) { /* best-effort only */ }
}

function killExistingExeInstances() {
  if (!isPkg || process.platform !== 'win32') return;
  try {
    const cp = require('child_process');
    const exeNames = ['markview.exe', 'postgres-tool.exe'];
    for (const name of exeNames) {
      const result = cp.spawnSync('tasklist', ['/FI', `IMAGENAME eq ${name}`, '/FO', 'CSV', '/NH'], {
        encoding: 'utf-8'
      });
      if (result.error) continue;
      const output = (result.stdout || '').trim();
      if (!output) continue;
      const lines = output.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const parts = line.split('","').map(segment => segment.replace(/^"|"$/g, '').trim());
        if (parts.length < 2) continue;
        const pid = Number(parts[1]);
        if (!Number.isFinite(pid) || pid === process.pid) continue;
        try {
          cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
          logToFile(`Terminated existing ${name} pid=${pid}`);
        } catch (killErr) {
          logToFile(`Failed to terminate ${name} pid=${pid}: ${killErr?.message || killErr}`);
        }
      }
    }
  } catch (err) {
    logToFile('killExistingExeInstances error: ' + (err?.message || err));
  }
}
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err);
  logToFile('Uncaught exception: ' + (err && err.stack ? err.stack : err));
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection', reason);
  logToFile('Unhandled rejection: ' + (reason && reason.stack ? reason.stack : reason));
});

// Simple cross-platform browser opener without external deps
function openBrowser(url) {
  const plat = process.platform;
  try {
    if (plat === 'win32') exec(`start "" "${url.replace(/"/g, '\\"')}"`);
    else if (plat === 'darwin') exec(`open "${url.replace(/"/g, '\\"')}"`);
    else exec(`xdg-open "${url.replace(/"/g, '\\"')}"`);
  } catch (e) {
    console.warn('openBrowser failed:', e?.message || e);
    logToFile('openBrowser failed: ' + (e && e.stack ? e.stack : e));
  }
}

// --- Daemonize behavior: when the EXE is double-clicked on Windows we spawn
// a detached background child (with --child) and exit the parent so the user
// doesn't see a long-running console window. The child writes a PID file so
// users can stop it later.
try {
  killExistingExeInstances();
  if (process.platform === 'win32' && !process.argv.includes('--child')) {
    const cp = require('child_process');
    const spawnArgs = process.argv.slice(1).concat(['--child']);
    try {
      const child = cp.spawn(process.execPath, spawnArgs, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
      try { fsSync.writeFileSync(path.join(exeDir, 'markview.pid'), String(child.pid)); } catch (e) { logToFile('Cannot write pid file: ' + e); }
      logToFile('Spawned background child pid=' + child.pid);
      // Parent exits immediately (no server started here)
      process.exit(0);
    } catch (spawnErr) {
      logToFile('Daemon spawn failed: ' + (spawnErr && spawnErr.stack ? spawnErr.stack : spawnErr));
      // fall through and continue in the current process (useful for debugging)
    }
  }
} catch (e) {
  logToFile('Daemon wrapper top-level error: ' + e);
}

// If this is the child, write the pidfile and ensure it's removed on exit
if (process.argv.includes('--child')) {
  try { fsSync.writeFileSync(path.join(exeDir, 'markview.pid'), String(process.pid)); } catch (e) { logToFile('Cannot write pid file: ' + e); }
  process.on('exit', () => {
    try { fsSync.rmSync(path.join(exeDir, 'markview.pid')); } catch (e) { /* ignore */ }
  });
}

// Serve static front-end if built into a dist folder
try {
  if (fsSync.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));
    app.get('*', (req, res, next) => {
      if (req.path && req.path.toLowerCase().startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
  }
} catch (err) {
  console.warn('Static assets not found or could not be served:', err?.message || err);
}

app.post('/api/summary', async (req, res) => {
  const { connection, selectedGtin, startDate, endDate, dateField, status } = req.body;
  if (!connection || !startDate || !dateField) return res.status(400).send('Missing parameters');
  if (!validateDateField(dateField)) return res.status(400).send('Invalid dateField');

  const params = [];
  let where = '';

  // Build date filters: if endDate provided, use range inclusive; otherwise match single date exactly
  if (endDate) {
    params.push(startDate);
    where += `${dateField}::date >= $${params.length}`;

    params.push(endDate);
    where += ` AND ${dateField}::date <= $${params.length}`;
  } else {
    params.push(startDate);
    where += `${dateField}::date = $${params.length}`;
  }

  // Optional code filter when selecting a specific GTIN
  if (selectedGtin && selectedGtin !== 'all') {
    params.push(`%${selectedGtin}%`);
    where = `code LIKE $${params.length} AND ` + where;
  }

  // Filter by status if provided and not 'all'
  if (status && status !== 'all') {
    params.push(status);
    where = `status = $${params.length} AND ` + where;
  }

  try {
    const client = await connectWithFallback(connection);

    // 1) counts grouped by extracted GTIN but only for rows where code starts with '01046' (as requested)
    const paramsGtin = params.slice();
    // we will add a constant pattern param for the prefix
    paramsGtin.push(`01046%`);
    const sqlGtin = `SELECT SUBSTRING(code FROM '01([0-9]{14})') AS gtin, COUNT(*)::int AS count FROM codes WHERE ${where} AND code LIKE $${paramsGtin.length} AND SUBSTRING(code FROM '01([0-9]{14})') IS NOT NULL GROUP BY SUBSTRING(code FROM '01([0-9]{14})') ORDER BY count DESC;`;
    const gtinResult = await client.query(sqlGtin, paramsGtin);

    // 2) total rows in the range (all codes, regardless of prefix)
    const sqlTotal = `SELECT COUNT(*)::int AS total FROM codes WHERE ${where};`;
    const totalResult = await client.query(sqlTotal, params);
    const totalCount = totalResult.rows[0] ? Number(totalResult.rows[0].total) : 0;

    // 3) count of codes that start with '01046' (exact prefix match at start of code)
    const paramsPrefix = params.slice();
    paramsPrefix.push(`01046%`);
    const sqlPrefix = `SELECT COUNT(*)::int AS prefixCount FROM codes WHERE ${where} AND code LIKE $${paramsPrefix.length};`;
    const prefixResult = await client.query(sqlPrefix, paramsPrefix);
    const prefixCount = prefixResult.rows[0] ? Number(prefixResult.rows[0].prefixcount) : 0;

    // non-prefix (suspect) count = total - prefix
    const nonPrefixCount = Math.max(0, totalCount - prefixCount);

    await client.end();

    res.json({ rows: gtinResult.rows, totalCount, prefixCount, nonPrefixCount });
  } catch (err) {
    console.error('Query error', err);
    res.status(500).send(err?.message || 'Query error');
  }
});

app.post('/api/print-summary', async (req, res) => {
  const { connection, selectedGtin, expirationDays } = req.body;
  if (!connection) return res.status(400).send('Missing parameters');

  const params = [];
  let where = 'status = 0';

  if (selectedGtin && selectedGtin !== 'all') {
    params.push(`%${selectedGtin}%`);
    where += ` AND code LIKE $${params.length}`;
  }

  // Filter out codes older than expirationDays
  if (expirationDays && !isNaN(expirationDays) && Number(expirationDays) > 0) {
    params.push(Number(expirationDays));
    where += ` AND dtime_ins >= NOW() - ($${params.length} || ' days')::interval`;
  }

  try {
    const client = await connectWithFallback(connection);

    // Filter printable_codes with status = 0
    // Group by extracted GTIN from code where it starts with '01' followed by 14 digits
    const paramsGtin = params.slice();
    paramsGtin.push(`01046%`);
    const sqlGtin = `SELECT SUBSTRING(code FROM '01([0-9]{14})') AS gtin, COUNT(*)::int AS count FROM printable_codes WHERE ${where} AND code LIKE $${paramsGtin.length} AND SUBSTRING(code FROM '01([0-9]{14})') IS NOT NULL GROUP BY SUBSTRING(code FROM '01([0-9]{14})') ORDER BY count DESC;`;
    const gtinResult = await client.query(sqlGtin, paramsGtin);

    // Total unprinted codes in the table matching the filters
    const sqlTotal = `SELECT COUNT(*)::int AS total FROM printable_codes WHERE ${where};`;
    const totalResult = await client.query(sqlTotal, params);
    const totalCount = totalResult.rows[0] ? Number(totalResult.rows[0].total) : 0;

    await client.end();

    res.json({ rows: gtinResult.rows, totalCount });
  } catch (err) {
    console.error('Print summary query error', err);
    res.status(500).send(err?.message || 'Print summary query error');
  }
});

app.post('/api/full', async (req, res) => {
  const { connection, selectedGtin, startDate, endDate, dateField, limit, exportAll, columns, markAsExported, status, searchCode } = req.body;
  console.log('[/api/full] Request received:', { markAsExported, columnsCount: columns?.length });
  if (!connection || !startDate || !dateField) return res.status(400).send('Missing parameters');
  if (!validateDateField(dateField)) return res.status(400).send('Invalid dateField');

  const params = [];
  let where = '';

  // date filters: equality for single date, range if endDate provided
  if (endDate) {
    params.push(startDate);
    where += `${dateField}::date >= $${params.length}`;

    params.push(endDate);
    where += ` AND ${dateField}::date <= $${params.length}`;
  } else {
    params.push(startDate);
    where += `${dateField}::date = $${params.length}`;
  }

  // If selectedGtin provided, apply code filter
  if (selectedGtin && selectedGtin !== 'all') {
    params.push(`%${selectedGtin}%`);
    where = `code LIKE $${params.length} AND ` + where;
  }

  // If searchCode provided, apply granular code filter
  if (searchCode) {
    params.push(`%${searchCode}%`);
    where = `code LIKE $${params.length} AND ` + where;
  }

  // Filter by status if provided and not 'all'
  if (status && status !== 'all') {
    params.push(status);
    where = `status = $${params.length} AND ` + where;
  }

  const lim = Number(limit) || null; // null means no LIMIT — fetch all matching rows

  // Whitelist allowed columns to prevent SQL injection
  const ALLOWED_COLUMNS = [
    'id', 'dtime_ins', 'code', 'status',
    'dtime_status', 'grcode', 'dtime_grcode',
    'sscc', 'dtime_sscc', 'production_date'
  ];

  let selectClause = '*';
  let requestedId = true;
  if (Array.isArray(columns) && columns.length > 0) {
    const validColumns = columns.filter(c => ALLOWED_COLUMNS.includes(c));
    requestedId = validColumns.includes('id');

    if (validColumns.length > 0) {
      // Internal requirement: we MUST have 'id' to perform batch status updates
      if (markAsExported && !requestedId) {
        validColumns.push('id');
      }
      selectClause = validColumns.join(', ');
    }
  }

  try {
    const client = await connectWithFallback(connection);

    const sql = `SELECT ${selectClause} FROM codes WHERE ${where}${lim ? ` LIMIT ${lim}` : ''};`;
    const result = await client.query(sql, params);
    if (result.rows.length > 0) {
      console.log('[/api/full] Sample row structure:', Object.keys(result.rows[0]));
    }

    // If markAsExported is true, update the status of the returned rows to 9
    if (markAsExported && result.rows.length > 0) {
      const ids = result.rows.map(r => r.id).filter(val => val !== undefined && val !== null);
      console.log(`[/api/full] Found ${result.rows.length} rows, extracted ${ids.length} valid IDs`);
      if (ids.length > 0) {
        try {
          const updateRes = await client.query('UPDATE codes SET status = 9, dtime_status = NOW() WHERE id = ANY($1)', [ids]);
          console.log(`[/api/full] Update success: changed ${updateRes.rowCount} rows`);
          logToFile(`Updated status to 9 for ${ids.length} records`);
        } catch (updateErr) {
          console.error('[/api/full] Status update failed:', updateErr);
          logToFile(`Status update failed: ${updateErr?.message || updateErr}`);
        }
      }
    }

    await client.end();

    // If we added 'id' internally but the user didn't ask for it, strip it now
    if (markAsExported && !requestedId && Array.isArray(columns) && columns.length > 0) {
      const finalRows = result.rows.map(row => {
        const { id, ...rest } = row;
        return rest;
      });
      res.json(finalRows);
    } else {
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Query error', err);
    res.status(500).send(err?.message || 'Query error');
  }
});

app.post('/api/delete', async (req, res) => {
  const { connection, selectedGtin, startDate, endDate, dateField, status, ids, searchCode } = req.body;
  console.log('[/api/delete] Request received:', { selectedGtin, startDate, endDate, idsCount: ids?.length });
  
  if (!connection || !startDate || !dateField) return res.status(400).send('Missing parameters');
  if (!validateDateField(dateField)) return res.status(400).send('Invalid dateField');

  const params = [];
  let where = '';

  // date filters
  if (endDate) {
    params.push(startDate);
    where += `${dateField}::date >= $${params.length}`;

    params.push(endDate);
    where += ` AND ${dateField}::date <= $${params.length}`;
  } else {
    params.push(startDate);
    where += `${dateField}::date = $${params.length}`;
  }

  // product filter
  if (selectedGtin && selectedGtin !== 'all') {
    params.push(`%${selectedGtin}%`);
    where = `code LIKE $${params.length} AND ` + where;
  }

  // searchCode filter
  if (searchCode) {
    params.push(`%${searchCode}%`);
    where = `code LIKE $${params.length} AND ` + where;
  }

  // status filter
  if (status && status !== 'all') {
    params.push(status);
    where = `status = $${params.length} AND ` + where;
  }

  // specific IDs filter
  if (Array.isArray(ids) && ids.length > 0) {
    params.push(ids);
    where += ` AND id = ANY($${params.length})`;
  }

  try {
    const client = await connectWithFallback(connection);
    
    // Safety check: Don't allow deletion if WHERE clause is empty (shouldn't happen with date check but let's be safe)
    if (!where) {
      await client.end();
      return res.status(400).send('Empty WHERE clause');
    }

    const sql = `DELETE FROM codes WHERE ${where};`;
    const result = await client.query(sql, params);
    
    await client.end();
    
    logToFile(`Deleted ${result.rowCount} records with filters: GTIN=${selectedGtin}, Start=${startDate}, End=${endDate}`);
    res.json({ deletedCount: result.rowCount });
  } catch (err) {
    console.error('Delete error', err);
    res.status(500).send(err?.message || 'Delete error');
  }
});

app.get('/api/settings', async (_, res) => {
  try {
    if (!settingsCacheLoaded) {
      await refreshSettingsCache();
    }
    const data = getCachedSettings();

    return res.json(data);
  } catch (err) {
    console.error('Failed to read settings', err);
    logToFile('Settings read failed: ' + (err?.stack || err));
    return res.status(500).send('Failed to read settings');
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const body = req.body || { connections: [], products: [] };
    const normalized = normalizeSettings(body);
    if (!settingsCacheLoaded) {
      await refreshSettingsCache();
    }
    settingsCache = normalizeSettings(normalized);
    settingsCacheLoaded = true;

    const result = await writeSettingsToTargets(normalized);
    return res.json({ ok: true, path: result.path, attempts: result.attempts });
  } catch (err) {
    console.error('Failed to write settings', err);
    logToFile('Settings write failed: ' + (err?.stack || err));
    return res.status(500).send('Failed to write settings');
  }
});

// --- Auto-Update System ---
let CURRENT_VERSION = '2.1.1';
try {
  if (process.env.APP_VERSION) {
    CURRENT_VERSION = process.env.APP_VERSION;
  } else {
    // Dev mode fallback
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fsSync.existsSync(pkgPath)) {
      CURRENT_VERSION = JSON.parse(fsSync.readFileSync(pkgPath, 'utf8')).version;
    }
  }
} catch (e) {}
const REPO_OWNER = 'Andrejj12380';
const REPO_NAME = 'postgres-code-query-tool';

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      headers: { 'User-Agent': 'markview-updater' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`GitHub API error: ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

app.get('/api/check-update', async (req, res) => {
  try {
    const latest = await getLatestRelease();
    const latestVersion = latest.tag_name.replace(/^v/, '');
    const updateAvailable = latestVersion !== CURRENT_VERSION;
    res.json({
      currentVersion: CURRENT_VERSION,
      latestVersion,
      updateAvailable,
      releaseNotes: latest.body,
      releaseUrl: latest.html_url
    });
  } catch (err) {
    console.error('Update check failed:', err);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

let downloadProgress = 0;
app.post('/api/download-update', async (req, res) => {
  try {
    const latest = await getLatestRelease();
    const asset = latest.assets.find(a => a.name.endsWith('.exe'));
    if (!asset) return res.status(404).send('No executable asset found in latest release');

    const tempPath = path.join(exeDir, 'markview_new.exe');
    downloadProgress = 0;
    
    // Respond immediately that we started
    res.json({ started: true });

    // Start download in "background"
    const file = fsSync.createWriteStream(tempPath);
    file.on('error', (err) => {
      console.error('File write error:', err);
      downloadProgress = -1;
    });

    const download = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          download(response.headers.location);
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;
        
        response.pipe(file);
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize) {
            downloadProgress = Math.floor((downloaded / totalSize) * 100);
          }
        });

        file.on('finish', () => {
          file.close();
          downloadProgress = 100;
        });
      }).on('error', (err) => {
        console.error('Download error:', err);
        downloadProgress = -1; // Indicate error
        fsSync.unlink(tempPath, () => {});
      });
    };

    download(asset.browser_download_url);
    
  } catch (err) {
    console.error('Download start failed:', err);
    if (!res.headersSent) res.status(500).send(err.message);
  }
});

app.get('/api/download-progress', (req, res) => {
  res.json({ progress: downloadProgress });
});

app.post('/api/apply-update', (req, res) => {
  const isDevelopment = !isPkg;
  if (isDevelopment) {
    return res.status(400).send('Update cannot be applied in development mode');
  }

  const currentExe = process.execPath;
  const newExe = path.join(exeDir, 'markview_new.exe');
  const batchPath = path.join(exeDir, 'apply_update.bat');

  const batchContent = `@echo off
timeout /t 2 /nobreak > nul
if exist "${newExe}" (
    move /y "${newExe}" "${currentExe}"
    start "" "${currentExe}" --child
)
del "%~f0"
`;

  try {
    fsSync.writeFileSync(batchPath, batchContent, 'utf-8');
    logToFile('Update script created. Exiting app to apply update...');
    res.json({ ok: true });
    
    // Give time for response to reach client before exiting
    setTimeout(() => {
      require('child_process').exec(`start "" "${batchPath}"`, { cwd: exeDir });
      process.exit(0);
    }, 1000);
  } catch (err) {
    console.error('Failed to apply update:', err);
    res.status(500).send(err.message);
  }
});

app.get('/', (_, res) => res.send('Postgres query server is running'));

const shouldAutoOpen = process.env.SUPPRESS_AUTO_OPEN !== '1';

const startServer = async () => {
  let port = Number(process.env.SERVER_PORT) || Number(process.env.PORT) || 3005;
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const serverInstance = await new Promise((resolve, reject) => {
        const s = app.listen(port)
          .once('listening', () => resolve(s))
          .once('error', err => reject(err));
      });
      console.log(`Server listening on port ${port}`);
      logToFile(`Server listening on port ${port}`);
      if (shouldAutoOpen) {
        // Try to open default browser to the UI (best-effort)
        try {
          openBrowser(`http://localhost:${port}`);
        } catch (e) {
          console.warn('Failed to open browser:', e?.message || e);
          logToFile('Failed to open browser: ' + (e && e.stack ? e.stack : e));
        }
      }
      return serverInstance;
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        port += 1;
        continue;
      }
      console.error('Failed to start server', err);
      process.exit(1);
    }
  }
  console.error('No free ports found');
  process.exit(1);
};

startServer();
