#!/usr/bin/env node
const { execSync } = require('child_process');
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

try {
  console.log('1) Building frontend (vite)...');
  execSync('npm run build:web', { stdio: 'inherit' });

  console.log('2) Bundling server with esbuild...');
  esbuild.buildSync({
    entryPoints: ['server/index.js'],
    bundle: true,
    platform: 'node',
    target: ['node18'],
    outfile: 'build/server.cjs',
    format: 'cjs'
  });

  console.log('3) Packaging exe with pkg (Windows x64)...');
  fs.mkdirSync('release', { recursive: true });
  execSync('npx pkg build/server.cjs --targets node18-win-x64 --output release/postgres-tool.exe', { stdio: 'inherit' });

  console.log('4) Copying frontend assets to release/dist...');
  const src = path.resolve('dist');
  const dest = path.resolve('release', 'dist');
  if (fs.existsSync(src)) {
    copyDir(src, dest);
  } else {
    console.warn('Warning: frontend dist not found at', src);
  }

  console.log('5) Copying settings.json if present...');
  const settingsSrc = path.resolve('server', 'settings.json');
  const settingsDest = path.resolve('release', 'settings.json');
  if (fs.existsSync(settingsSrc)) {
    fs.copyFileSync(settingsSrc, settingsDest);
  }

  // Add convenience scripts: hidden launcher (VBS) and stop script (to kill by pid)
  console.log('6) Writing helper launch/stop scripts to release/');
  const vbs = `Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = fso.BuildPath(scriptPath, "postgres-tool.exe")
WshShell.Run chr(34) & exePath & chr(34), 0, False`;
  fs.writeFileSync(path.resolve('release', 'start-hidden.vbs'), vbs, 'utf-8');

  const stopBat = `@echo off
if not exist "postgres-tool.pid" (
  echo pid file not found
  exit /b 1
)
for /f %%p in (postgres-tool.pid) do taskkill /PID %%p /F || echo failed to kill %%p
if exist postgres-tool.pid del postgres-tool.pid
`;
  fs.writeFileSync(path.resolve('release', 'stop.bat'), stopBat, 'utf-8');

  console.log('\nPortable package built: release/postgres-tool.exe');
  console.log('Release folder contents:');
  console.log(fs.readdirSync(path.resolve('release')).join('\n'));
  console.log('\nInstructions: distribute the whole release/ folder. The user can start the app without a visible console by double-clicking start-hidden.vbs (or run postgres-tool.exe which will spawn a hidden background process). Use stop.bat to stop the background process.');
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const items = fs.readdirSync(src);
  for (const item of items) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
