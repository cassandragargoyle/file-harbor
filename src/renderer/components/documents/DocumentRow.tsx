import { FileText, Image, File, FolderInput, Download, ExternalLink, FolderSearch, Trash2, Check, X, Sparkles, Pencil } from 'lucide-react';
import type { DocumentRecord, Category } from '../../../shared/types';
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
  onRename,
  onDelete,
  onAcceptSuggestion,
  onDismissSuggestion,
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
  onRename?: () => void;
  onDelete?: () => void;
  onAcceptSuggestion?: () => void;
  onDismissSuggestion?: () => void;
}) {
  const Icon = getFileIcon(document.mime_type);

  const actionVisibility = selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  const hasSuggestion =
    document.suggested_category &&
    document.category === null &&
    (document.suggestion_confidence ?? 0) >= 0.3;

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
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-faint">
            {relativeTime(document.added_at)}
            {document.category && (
              <span className="ml-2 text-dim">&middot; {document.category}</span>
            )}
          </span>
          {hasSuggestion && (
            <SuggestionChip
              category={document.suggested_category!}
              confidence={document.suggestion_confidence!}
              onAccept={onAcceptSuggestion}
              onDismiss={onDismissSuggestion}
            />
          )}
        </div>
      </div>
      <div className={cn('flex shrink-0 items-center gap-0.5 transition-opacity', actionVisibility)}>
        {onFile && (
          <RowAction icon={FolderInput} label="File to..." onClick={onFile} />
        )}
        {onRename && (
          <RowAction icon={Pencil} label="Rename" onClick={onRename} />
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

function SuggestionChip({
  category,
  confidence,
  onAccept,
  onDismiss,
}: {
  category: Category;
  confidence: number;
  onAccept?: () => void;
  onDismiss?: () => void;
}) {
  const isHighConfidence = confidence >= 0.7;

  const chipClasses = isHighConfidence
    ? 'bg-accent/10 text-accent'
    : 'bg-warning/10 text-warning';

  const actionClasses = isHighConfidence
    ? 'hover:bg-accent/20'
    : 'hover:bg-warning/20';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', chipClasses)}>
      <Sparkles className="h-3 w-3" />
      {category}{!isHighConfidence ? '?' : ''}
      {onAccept && (
        <span
          role="button"
          tabIndex={-1}
          title="Accept suggestion"
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          className={cn('ml-0.5 rounded p-0.5 transition-colors', actionClasses)}
        >
          <Check className="h-3 w-3" />
        </span>
      )}
      {onDismiss && (
        <span
          role="button"
          tabIndex={-1}
          title="Dismiss suggestion"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className={cn('rounded p-0.5 transition-colors', actionClasses)}
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </span>
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
