import { app, Menu, shell, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './ipc-channels';

export function buildAppMenu(getLibraryPath: () => string | null): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Files...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send(IPC_CHANNELS.MENU_IMPORT_FILES);
            }
          },
        },
        {
          label: 'Import Folder...',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send(IPC_CHANNELS.MENU_IMPORT_FOLDER);
            }
          },
        },
        {
          label: 'Open Library Folder',
          click: () => {
            const libraryPath = getLibraryPath();
            if (libraryPath) {
              shell.openPath(libraryPath);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Back Up Workspace...',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send(IPC_CHANNELS.MENU_BACKUP);
          },
        },
        {
          label: 'Restore from Backup...',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send(IPC_CHANNELS.MENU_RESTORE);
          },
        },
        { type: 'separator' },
        {
          label: 'Export All Files...',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send(IPC_CHANNELS.MENU_EXPORT_ALL);
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
