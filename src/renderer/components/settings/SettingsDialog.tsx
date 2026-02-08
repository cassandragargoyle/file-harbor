import { useState, useEffect } from 'react';
import { X, FolderOpen, Trash2 } from 'lucide-react';
import * as ipc from '../../lib/ipc';
import { useAppStore } from '../../stores/app-store';
import { formatBytes } from '../../lib/format';
import type { LibraryInfo } from '../../../shared/types';

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const libraryPath = useAppStore((s) => s.libraryPath);
  const [watchedFolder, setWatchedFolder] = useState<string | null>(null);
  const [libraryInfo, setLibraryInfo] = useState<LibraryInfo | null>(null);

  useEffect(() => {
    ipc.getWatchedFolder().then(setWatchedFolder);
    ipc.getLibraryInfo().then(setLibraryInfo);
  }, []);

  const handleChooseWatchedFolder = async () => {
    const path = await ipc.setWatchedFolder();
    if (path) setWatchedFolder(path);
  };

  const handleClearWatchedFolder = async () => {
    await ipc.clearWatchedFolder();
    setWatchedFolder(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-base p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Library section */}
        <section className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-muted">Library</h3>
          <div className="space-y-3 rounded-lg border border-border bg-surface/50 p-4">
            <div>
              <p className="text-xs text-faint">Location</p>
              <p className="mt-0.5 truncate text-sm text-secondary">{libraryPath ?? 'Not set'}</p>
            </div>
            {libraryInfo && (
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-faint">Documents</p>
                  <p className="mt-0.5 text-sm text-secondary">{libraryInfo.documentCount}</p>
                </div>
                <div>
                  <p className="text-xs text-faint">Total size</p>
                  <p className="mt-0.5 text-sm text-secondary">{formatBytes(libraryInfo.totalSizeBytes)}</p>
                </div>
              </div>
            )}
            <button
              onClick={() => ipc.openLibraryFolder()}
              className="flex items-center gap-1.5 rounded-md bg-elevated px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-highlight hover:text-foreground"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open in Finder
            </button>
          </div>
        </section>

        {/* Watched folder section */}
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted">Watched Folder</h3>
          <div className="space-y-3 rounded-lg border border-border bg-surface/50 p-4">
            <div>
              <p className="text-xs text-faint">Folder</p>
              <p className="mt-0.5 truncate text-sm text-secondary">
                {watchedFolder ?? 'Not configured'}
              </p>
            </div>
            <p className="text-xs text-faint">
              New files added to this folder will be automatically imported into your Inbox.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleChooseWatchedFolder}
                className="flex items-center gap-1.5 rounded-md bg-elevated px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-highlight hover:text-foreground"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {watchedFolder ? 'Change Folder' : 'Choose Folder'}
              </button>
              {watchedFolder && (
                <button
                  onClick={handleClearWatchedFolder}
                  className="flex items-center gap-1.5 rounded-md bg-elevated px-3 py-1.5 text-xs text-danger transition-colors hover:bg-highlight"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
