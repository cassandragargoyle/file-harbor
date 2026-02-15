import { FolderInput, Download, Trash2, X } from 'lucide-react';

interface BulkActionBarProps {
  count: number;
  onFile: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, onFile, onExport, onDelete, onClear }: BulkActionBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-base px-2 py-1.5 shadow-2xl">
        <span className="px-2 text-sm font-medium tabular-nums text-secondary">
          {count} selected
        </span>
        <div className="mx-1 h-5 w-px bg-border" />
        <BulkButton icon={FolderInput} label="File to..." onClick={onFile} />
        <BulkButton icon={Download} label="Export" onClick={onExport} />
        <BulkButton icon={Trash2} label="Delete" onClick={onDelete} danger />
        <div className="mx-1 h-5 w-px bg-border" />
        <button
          onClick={onClear}
          title="Clear selection"
          className="rounded-lg p-1.5 text-faint transition-colors hover:bg-elevated hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BulkButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        danger
          ? 'text-secondary hover:bg-danger/10 hover:text-danger'
          : 'text-secondary hover:bg-elevated hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
