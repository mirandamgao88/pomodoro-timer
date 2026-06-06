const { app, BrowserWindow, Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 540,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    alwaysOnTop: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Create a simple 16x16 tray icon using nativeImage
  const iconSize = 16;
  const canvas = Buffer.alloc(iconSize * iconSize * 4);
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const idx = (y * iconSize + x) * 4;
      const cx = 8, cy = 8, r = 7;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        canvas[idx] = 231;     // R
        canvas[idx + 1] = 76;  // G
        canvas[idx + 2] = 60;  // B
        canvas[idx + 3] = 255; // A
      } else {
        canvas[idx + 3] = 0;
      }
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize });

  tray = new Tray(icon);
  tray.setToolTip('Pomodoro Timer');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '置顶窗口',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(menuItem.checked);
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit on macOS - keep tray alive
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// IPC: show native notification
const { ipcMain } = require('electron');
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      silent: false,
    });
    notification.show();

    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
});

// IPC: window controls
ipcMain.on('window-hide', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-always-on-top', (event, isOnTop) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(isOnTop);
});
