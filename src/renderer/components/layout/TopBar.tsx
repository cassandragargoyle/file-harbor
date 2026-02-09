import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Settings, ChevronDown, FolderOpen, File } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../stores/app-store';
import { SettingsDialog } from '../settings/SettingsDialog';
import { showIngestToasts } from '../../lib/toast-helpers';
import * as ipc from '../../lib/ipc';

export function TopBar() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const searchDocuments = useAppStore((s) => s.searchDocuments);
  const clearSearch = useAppStore((s) => s.clearSearch);
  const loadDocuments = useAppStore((s) => s.loadDocuments);
  const refreshCounts = useAppStore((s) => s.refreshCounts);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [showSettings, setShowSettings] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleChange = (value: string) => {
    setLocalQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        searchDocuments(value);
      } else {
        clearSearch();
      }
    }, 300);
  };

  const handleClear = () => {
    setLocalQuery('');
    clearSearch();
    inputRef.current?.focus();
  };

  const handleImportFiles = async () => {
    setShowImportMenu(false);
    const paths = await ipc.openFilePicker();
    if (!paths) return;

    try {
      const { results, skippedCount } = await ipc.ingestFiles(paths, 'file_picker');
      showIngestToasts(results, skippedCount);
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to import files');
    }
  };

  const handleImportFolder = async () => {
    setShowImportMenu(false);
    const paths = await ipc.openFolderPicker();
    if (!paths) return;

    try {
      const { results, skippedCount } = await ipc.ingestFiles(paths, 'file_picker');
      showIngestToasts(results, skippedCount);
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to import folder');
    }
  };

  // Close import menu when clicking outside
  useEffect(() => {
    if (!showImportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showImportMenu]);

  return (
    <>
      <div className="shrink-0">
        <div className="h-10 [-webkit-app-region:drag]" />
        <div className="flex h-12 items-center gap-3 border-b border-border px-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              ref={inputRef}
              type="text"
              value={localQuery}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-8 text-sm text-foreground placeholder-faint outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
            {localQuery && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1" />

          <div ref={importMenuRef} className="relative">
            <div className="flex items-center">
              <button
                onClick={handleImportFiles}
                className="flex items-center gap-1.5 rounded-l-lg bg-elevated px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-highlight hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Import
              </button>
              <button
                onClick={() => setShowImportMenu((v) => !v)}
                className="flex items-center self-stretch rounded-r-lg border-l border-border bg-elevated px-1.5 text-secondary transition-colors hover:bg-highlight hover:text-foreground"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            {showImportMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-border bg-elevated py-1 shadow-lg">
                <button
                  onClick={handleImportFiles}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-secondary hover:bg-highlight hover:text-foreground"
                >
                  <File className="h-4 w-4" />
                  Import Files...
                </button>
                <button
                  onClick={handleImportFolder}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-secondary hover:bg-highlight hover:text-foreground"
                >
                  <FolderOpen className="h-4 w-4" />
                  Import Folder...
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-elevated hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  );
}
