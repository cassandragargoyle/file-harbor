import { FileText, Image, File, FolderInput, Download, ExternalLink, FolderSearch, Trash2 } from 'lucide-react';
import type { DocumentRecord } from '../../../shared/types';
import { relativeTime } from '../../lib/format';
import { cn } from '../../lib/utils';

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return Image;
  return File;
}

export function DocumentRow({
  document,
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
  onFile,
  onExport,
  onOpen,
  onReveal,
  onDelete,
}: {
  document: DocumentRecord;
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onFile?: () => void;
  onExport?: () => void;
  onOpen?: () => void;
  onReveal?: () => void;
  onDelete?: () => void;
}) {
  const Icon = getFileIcon(document.mime_type);

  const actionVisibility = selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onClick(); // select on right-click too
        onContextMenu?.(e);
      }}
      data-document-id={document.id}
      className={cn(
        'group flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors',
        selected ? 'bg-elevated' : 'hover:bg-elevated/30'
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-faint" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-secondary">
          {document.original_filename}
        </p>
        <p className="mt-0.5 text-xs text-faint">
          {relativeTime(document.added_at)}
          {document.category && (
            <span className="ml-2 text-dim">&middot; {document.category}</span>
          )}
        </p>
      </div>
      <div className={cn('flex shrink-0 items-center gap-0.5 transition-opacity', actionVisibility)}>
        {onFile && (
          <RowAction icon={FolderInput} label="File to..." onClick={onFile} />
        )}
        {onExport && (
          <RowAction icon={Download} label="Export" onClick={onExport} />
        )}
        {onOpen && (
          <RowAction icon={ExternalLink} label="Open" onClick={onOpen} />
        )}
        {onReveal && (
          <RowAction icon={FolderSearch} label="Reveal" onClick={onReveal} />
        )}
        {onDelete && (
          <RowAction icon={Trash2} label="Delete" onClick={onDelete} danger />
        )}
      </div>
    </button>
  );
}

function RowAction({
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
    <span
      role="button"
      tabIndex={-1}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'rounded p-1 transition-colors',
        danger
          ? 'text-faint hover:bg-danger/10 hover:text-danger'
          : 'text-faint hover:bg-highlight hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
