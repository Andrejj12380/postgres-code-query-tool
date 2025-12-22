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
    outfile: 'build/server.js',
    format: 'cjs'
  });

  console.log('3) Packaging exe with pkg (Windows x64)...');
  fs.mkdirSync('release', { recursive: true });
  execSync('npx pkg build/server.js --targets node18-win-x64 --output release/postgres-tool.exe', { stdio: 'inherit' });

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

  console.log('\nPortable package built: release/postgres-tool.exe');
  console.log('Release folder contents:');
  console.log(fs.readdirSync(path.resolve('release')).join('\n'));
  console.log('\nInstructions: distribute the whole release/ folder. User can double-click postgres-tool.exe to start the app.');
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
