import { useEffect, useRef } from 'react';
import { FolderInput, Eye, Download, FolderSearch, Trash2 } from 'lucide-react';

export interface ContextMenuAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Clamp position to keep menu on screen
  const style: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 100,
  };

  return (
    <div ref={menuRef} style={style} className="min-w-44 overflow-hidden rounded-lg border border-border bg-base py-1 shadow-xl">
      {actions.map((action, i) => (
        <div key={action.label}>
          {action.separator && <div className="my-1 border-t border-border" />}
          <button
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors ${
              action.danger
                ? 'text-danger hover:bg-danger/10'
                : 'text-secondary hover:bg-elevated'
            }`}
          >
            <action.icon className="h-4 w-4 shrink-0" />
            {action.label}
          </button>
        </div>
      ))}
    </div>
  );
}

export function getDocumentActions({
  onFile,
  onPreview,
  onExport,
  onReveal,
  onDelete,
}: {
  onFile: () => void;
  onPreview: () => void;
  onExport: () => void;
  onReveal: () => void;
  onDelete: () => void;
}): ContextMenuAction[] {
  return [
    { label: 'File to...', icon: FolderInput, onClick: onFile },
    { label: 'Preview', icon: Eye, onClick: onPreview },
    { label: 'Export...', icon: Download, onClick: onExport },
    { label: 'Reveal in Finder', icon: FolderSearch, onClick: onReveal },
    { label: 'Delete', icon: Trash2, onClick: onDelete, danger: true, separator: true },
  ];
}
