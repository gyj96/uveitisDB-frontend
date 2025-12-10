const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('GYJ_DESKTOP', {
  backendBase: process.env.BACKEND_BASE || 'http://127.0.0.1:8080',
  env: process.env.NODE_ENV || 'production',
});
