import { FileText, Image, File } from 'lucide-react';
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
}: {
  document: DocumentRecord;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = getFileIcon(document.mime_type);

  return (
    <button
      onClick={onClick}
      data-document-id={document.id}
      className={cn(
        'flex w-full items-center gap-3 border-b border-neutral-800/50 px-4 py-3 text-left transition-colors',
        selected ? 'bg-neutral-800' : 'hover:bg-neutral-800/30'
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-neutral-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-200">
          {document.original_filename}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {relativeTime(document.added_at)}
          {document.category && (
            <span className="ml-2 text-neutral-600">&middot; {document.category}</span>
          )}
        </p>
      </div>
    </button>
  );
}
