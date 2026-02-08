import { FileText, Image, File, FolderInput } from 'lucide-react';
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
}: {
  document: DocumentRecord;
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onFile?: () => void;
}) {
  const Icon = getFileIcon(document.mime_type);

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
      {onFile && (
        <span
          role="button"
          tabIndex={-1}
          title="File to..."
          onClick={(e) => {
            e.stopPropagation();
            onFile();
          }}
          className={cn(
            'shrink-0 rounded p-1 text-faint transition-colors hover:bg-highlight hover:text-foreground',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <FolderInput className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
