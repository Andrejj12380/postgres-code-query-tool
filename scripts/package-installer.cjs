#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const installerScript = path.resolve(root, 'installer', 'postgres-tool.nsi');
const releaseDir = path.resolve(root, 'release');

function checkFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} не найден: ${filePath}`);
  }
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`Команда ${cmd} ${args.join(' ')} завершилась с кодом ${result.status}`);
  }
}

(async () => {
  try {
    console.log('1) Сборка portable релиза (npm run package:portable)...');
    run('npm', ['run', 'package:portable']);

    console.log('2) Проверка наличия NSIS (makensis)...');
    const check = spawnSync('makensis', ['-VERSION'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    if (check.status !== 0) {
      throw new Error('Утилита makensis не найдена. Установите NSIS (https://nsis.sourceforge.io/Download) и добавьте её в PATH.');
    }

    console.log('3) Проверка файлов релиза...');
    checkFile(releaseDir, 'Папка release');
    checkFile(path.join(releaseDir, 'postgres-tool.exe'), 'Собранный exe');
    checkFile(path.join(releaseDir, 'start-hidden.vbs'), 'start-hidden.vbs');
    checkFile(path.join(releaseDir, 'stop.bat'), 'stop.bat');
    checkFile(path.join(releaseDir, 'dist'), 'dist (frontend)');
    checkFile(installerScript, 'NSIS-скрипт установщика');

    console.log('4) Сборка установщика через makensis...');
    run('makensis', [installerScript]);

    console.log('\nInstaller готов:');
    const files = fs.readdirSync(releaseDir);
    files.forEach(file => console.log(' - ' + file));
    console.log('\nУстановщик будет находиться в release/postgres-code-query-tool-setup.exe');
  } catch (err) {
    console.error('\nОшибка при сборке установщика:', err.message || err);
    process.exit(1);
  }
})();
