/* eslint-disable no-console */
const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

const vite = spawn('npm', ['run', 'dev:renderer'], {
  shell: true,
  stdio: 'inherit',
});

function launchElectron() {
  const electronBinary = path.join(__dirname, '..', 'node_modules', '.bin', 'electron');
  const child = spawn(electronBinary, ['.'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
      BACKEND_BASE: process.env.BACKEND_BASE || 'http://127.0.0.1:8080',
    },
  });
  child.on('close', (code) => {
    console.log(`electron exited with code ${code}`);
    vite.kill('SIGINT');
    process.exit(code ?? 0);
  });
}

waitOn(
  {
    resources: ['tcp:5173', 'http://localhost:5173'],
    timeout: 45000,
    interval: 500,
  },
  (err) => {
    if (err) {
      console.error('wait-on error', err);
      process.exit(1);
    }
    launchElectron();
  },
);
