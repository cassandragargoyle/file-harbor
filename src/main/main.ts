import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';

import { DatabaseService } from './services/database';
import { PdfExtractor } from './services/pdf-extractor';
import { WatcherService } from './services/watcher-service';
import { IPC_CHANNELS } from './ipc-channels';
import { registerIpcHandlers } from './ipc-handlers';
import { loadSettings } from './lib/settings';
import { validateLibrary } from './lib/library-manager';
import { mainLog } from './lib/logger';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// ── App State ───────────────────────────────────────────────────

const appState: {
  db: DatabaseService | null;
  libraryPath: string | null;
  pdfExtractor: PdfExtractor | null;
  watcher: WatcherService | null;
} = {
  db: null,
  libraryPath: null,
  pdfExtractor: null,
  watcher: null,
};

function initializeLibraryServices(libraryPath: string): void {
  try {
    appState.libraryPath = libraryPath;
    appState.db = new DatabaseService(libraryPath);
    appState.pdfExtractor = new PdfExtractor(appState.db);
    appState.watcher = new WatcherService(appState, (doc) => {
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send(IPC_CHANNELS.WATCHER_FILE_INGESTED, doc);
      });
    });

    // Restore watched folder if previously configured
    const settings = loadSettings();
    if (settings.watchedFolderPath) {
      appState.watcher.start(settings.watchedFolderPath);
    }

    mainLog.info(`Library opened at ${libraryPath}`);
  } catch (err) {
    mainLog.error('Failed to initialize library services:', err);
    appState.db = null;
    appState.libraryPath = null;
    appState.pdfExtractor = null;
    appState.watcher = null;
  }
}

// ── Window ──────────────────────────────────────────────────────

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

// ── Custom Protocol ──────────────────────────────────────────────

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'file-harbor',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

// ── Lifecycle ───────────────────────────────────────────────────

app.on('ready', () => {
  // Load saved settings and try to open existing library
  const settings = loadSettings();
  if (settings.libraryPath && validateLibrary(settings.libraryPath)) {
    initializeLibraryServices(settings.libraryPath);
  } else {
    mainLog.info('No valid library found — waiting for user to configure one');
  }

  // Register custom protocol handler for serving library files
  protocol.handle('file-harbor', (request) => {
    const url = new URL(request.url);
    const requestedPath = decodeURIComponent(url.pathname);

    // Only allow objects/ path prefix
    if (!requestedPath.startsWith('/objects/')) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!appState.libraryPath) {
      return new Response('No library configured', { status: 503 });
    }

    const resolved = path.resolve(appState.libraryPath, requestedPath.slice(1)); // strip leading /

    // Verify resolved path stays within library objects directory
    if (!resolved.startsWith(path.join(appState.libraryPath, 'objects'))) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(resolved).toString());
  });

  // Register all IPC handlers
  registerIpcHandlers(appState, initializeLibraryServices);

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Graceful shutdown
app.on('before-quit', async () => {
  mainLog.info('Shutting down...');
  if (appState.watcher) {
    await appState.watcher.stop();
  }
  if (appState.pdfExtractor) {
    await appState.pdfExtractor.shutdown();
  }
  if (appState.db) {
    appState.db.close();
  }
});
