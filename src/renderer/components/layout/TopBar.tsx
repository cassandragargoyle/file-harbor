import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Settings } from 'lucide-react';
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

  const handleImport = async () => {
    const paths = await ipc.openFilePicker();
    if (!paths) return;

    try {
      const results = await ipc.ingestFiles(paths, 'file_picker');
      showIngestToasts(results);
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to import files');
    }
  };

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

          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 rounded-lg bg-elevated px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-highlight hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Import
          </button>

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
