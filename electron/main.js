const { app, BrowserWindow, nativeTheme, Menu } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
const devServerURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f6f8fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  if (isDev) {
    console.log('👀 Loading URL:', devServerURL); // 方便调试看日志
    win.loadURL(devServerURL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  if (isDev) {
    process.env.NODE_ENV = 'development';
  }

  nativeTheme.themeSource = 'light';
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});