import { useState } from 'react';
import { X, Pencil, Trash2, Check } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';
import { toast } from 'sonner';

export function WorkspaceManagerDialog({ onClose }: { onClose: () => void }) {
  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const removeWorkspace = useAppStore((s) => s.removeWorkspace);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleConfirmRename = async () => {
    if (!editingId || !editName.trim()) return;
    await renameWorkspace(editingId, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const handleRemove = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Remove workspace "${name}"?\n\nThe library folder and its files will not be deleted.`
    );
    if (!confirmed) return;

    const success = await removeWorkspace(id);
    if (success) {
      toast.success(`Workspace "${name}" removed`);
    } else {
      toast.error('Cannot remove the last workspace');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-base p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Manage Workspaces</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                {editingId === ws.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="w-full rounded border border-border bg-base px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleConfirmRename}
                      className="rounded p-1 text-accent-fg transition-colors hover:bg-elevated"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {ws.name}
                      {ws.id === activeWorkspaceId && (
                        <span className="ml-2 text-xs text-faint">(active)</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-faint">{ws.libraryPath}</p>
                  </>
                )}
              </div>

              {editingId !== ws.id && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleStartRename(ws.id, ws.name)}
                    className="rounded p-1.5 text-faint transition-colors hover:bg-elevated hover:text-foreground"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemove(ws.id, ws.name)}
                    disabled={workspaces.length <= 1}
                    className="rounded p-1.5 text-faint transition-colors hover:bg-elevated hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
