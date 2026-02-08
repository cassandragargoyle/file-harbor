import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Settings2, Check, X } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { WorkspaceManagerDialog } from './WorkspaceManagerDialog';
import * as ipc from '../../lib/ipc';
import { toast } from 'sonner';

export function WorkspaceSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const activeWorkspaceName = useAppStore((s) => s.activeWorkspaceName);
  const switchWorkspace = useAppStore((s) => s.switchWorkspace);
  const addWorkspace = useAppStore((s) => s.addWorkspace);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPendingPath(null);
        setNameInput('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus name input when it appears
  useEffect(() => {
    if (pendingPath && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [pendingPath]);

  const handleSwitch = async (workspaceId: string) => {
    setIsOpen(false);
    if (workspaceId === activeWorkspaceId) return;
    await switchWorkspace(workspaceId);
  };

  const handlePickFolder = async () => {
    const path = await ipc.chooseLibraryPath();
    if (!path) return;
    setPendingPath(path);
    setNameInput('');
  };

  const handleConfirmAdd = async () => {
    if (!pendingPath || !nameInput.trim()) return;
    const name = nameInput.trim();
    setIsOpen(false);
    setPendingPath(null);
    setNameInput('');

    const success = await addWorkspace(name, pendingPath);
    if (success) {
      toast.success(`Workspace "${name}" created`);
    } else {
      toast.error('Failed to create workspace');
    }
  };

  const handleCancelAdd = () => {
    setPendingPath(null);
    setNameInput('');
  };

  // Don't render if there are no workspaces (still onboarding)
  if (workspaces.length === 0) return null;

  return (
    <div className="relative px-2 mb-1" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-elevated/50"
      >
        <span className="flex-1 truncate text-left">{activeWorkspaceName ?? 'No Workspace'}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>

      {isOpen && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-border bg-base py-1 shadow-lg">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSwitch(ws.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-elevated"
            >
              <span className="flex-1 truncate text-left">{ws.name}</span>
              {ws.id === activeWorkspaceId && (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent-fg" />
              )}
            </button>
          ))}

          <div className="mx-2 my-1 border-t border-border" />

          {pendingPath ? (
            <div className="px-3 py-2">
              <p className="mb-1.5 truncate text-xs text-faint">{pendingPath}</p>
              <div className="flex items-center gap-1.5">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmAdd();
                    if (e.key === 'Escape') handleCancelAdd();
                  }}
                  placeholder="Workspace name"
                  className="flex-1 rounded border border-border bg-base px-2 py-1 text-sm text-foreground outline-none placeholder:text-faint focus:border-accent"
                />
                <button
                  onClick={handleConfirmAdd}
                  disabled={!nameInput.trim()}
                  className="rounded p-1 text-accent-fg transition-colors hover:bg-elevated disabled:opacity-30"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleCancelAdd}
                  className="rounded p-1 text-faint transition-colors hover:bg-elevated hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handlePickFolder}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-muted transition-colors hover:bg-elevated"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Workspace...
            </button>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              setPendingPath(null);
              setNameInput('');
              setShowManager(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-muted transition-colors hover:bg-elevated"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage Workspaces...
          </button>
        </div>
      )}

      {showManager && <WorkspaceManagerDialog onClose={() => setShowManager(false)} />}
    </div>
  );
}
