import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';

import { DatabaseService } from './services/database';
import { PdfExtractor } from './services/pdf-extractor';
import { WatcherService } from './services/watcher-service';
import { IPC_CHANNELS } from './ipc-channels';
import { registerIpcHandlers } from './ipc-handlers';
import { loadSettings, updateSettings, getActiveWorkspace, updateWorkspace } from './lib/settings';
import { validateLibrary } from './lib/library-manager';
import { mainLog } from './lib/logger';
import { buildAppMenu } from './menu';
import type { Workspace } from '../shared/types';

app.name = 'File Harbor';

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
  activeWorkspaceId: string | null;
} = {
  db: null,
  libraryPath: null,
  pdfExtractor: null,
  watcher: null,
  activeWorkspaceId: null,
};

function initializeLibraryServices(workspace: Workspace): void {
  try {
    appState.libraryPath = workspace.libraryPath;
    appState.activeWorkspaceId = workspace.id;
    appState.db = new DatabaseService(workspace.libraryPath);
    appState.pdfExtractor = new PdfExtractor(appState.db);
    appState.watcher = new WatcherService(
      appState,
      (doc) => {
        BrowserWindow.getAllWindows().forEach((w) => {
          w.webContents.send(IPC_CHANNELS.WATCHER_FILE_INGESTED, doc);
        });
      },
      (errorMessage) => {
        mainLog.warn(`Watcher error: ${errorMessage}`);
        if (appState.activeWorkspaceId) {
          updateWorkspace(appState.activeWorkspaceId, { watchedFolderPath: undefined });
        }
        BrowserWindow.getAllWindows().forEach((w) => {
          w.webContents.send(IPC_CHANNELS.WATCHER_ERROR, errorMessage);
        });
      }
    );

    // Restore watched folder from workspace config
    if (workspace.watchedFolderPath) {
      appState.watcher.start(workspace.watchedFolderPath);
    }

    mainLog.info(`Library opened at ${workspace.libraryPath} (workspace: ${workspace.name})`);
  } catch (err) {
    mainLog.error('Failed to initialize library services:', err);
    appState.db = null;
    appState.libraryPath = null;
    appState.pdfExtractor = null;
    appState.watcher = null;
    appState.activeWorkspaceId = null;
  }
}

async function teardownLibraryServices(): Promise<void> {
  if (appState.watcher) {
    await appState.watcher.stop();
  }
  if (appState.pdfExtractor) {
    await appState.pdfExtractor.shutdown();
  }
  if (appState.db) {
    appState.db.close();
  }
  appState.db = null;
  appState.libraryPath = null;
  appState.pdfExtractor = null;
  appState.watcher = null;
  appState.activeWorkspaceId = null;
}

async function switchWorkspace(workspaceId: string): Promise<boolean> {
  const settings = loadSettings();
  const workspace = settings.workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return false;

  if (!validateLibrary(workspace.libraryPath)) return false;

  await teardownLibraryServices();
  initializeLibraryServices(workspace);

  updateSettings({ activeWorkspaceId: workspaceId, lastView: 'inbox' });

  return true;
}

// ── Window ──────────────────────────────────────────────────────

const createWindow = () => {
  const settings = loadSettings();
  const bounds = settings.windowBounds;

  const mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1200,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Persist window bounds on move/resize (debounced)
  let boundsTimer: ReturnType<typeof setTimeout> | null = null;
  const saveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        const b = mainWindow.getBounds();
        updateSettings({ windowBounds: b });
      }
    }, 500);
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

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
  const activeWorkspace = getActiveWorkspace(settings);
  if (activeWorkspace && validateLibrary(activeWorkspace.libraryPath)) {
    initializeLibraryServices(activeWorkspace);
  } else {
    mainLog.info('No valid workspace found — waiting for user to configure one');
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

  // Build application menu
  buildAppMenu(() => appState.libraryPath);

  // Register all IPC handlers
  registerIpcHandlers(appState, {
    initializeServices: initializeLibraryServices,
    teardownServices: teardownLibraryServices,
    switchWorkspace,
  });

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

// ── Global Error Handlers ────────────────────────────────────────

process.on('uncaughtException', (err) => {
  mainLog.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  mainLog.error('Unhandled rejection:', reason);
});

// Graceful shutdown
app.on('before-quit', async () => {
  mainLog.info('Shutting down...');
  await teardownLibraryServices();
});
