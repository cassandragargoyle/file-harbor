import { useAppStore } from '../../stores/app-store';
import { DocumentList } from '../documents/DocumentList';
import { DocumentPreview } from '../documents/DocumentPreview';
import { cn } from '../../lib/utils';

interface MainContentProps {
  onContextMenu?: (docId: string, x: number, y: number) => void;
  onFile?: (docId: string) => void;
  onDelete?: (docId: string) => void;
}

export function MainContent({ onContextMenu, onFile, onDelete }: MainContentProps) {
  const currentView = useAppStore((s) => s.currentView);
  const documents = useAppStore((s) => s.documents);
  const sortBy = useAppStore((s) => s.sortBy);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const isSearching = useAppStore((s) => s.isSearching);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const previewDocumentId = useAppStore((s) => s.previewDocumentId);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);

  const previewDoc = previewDocumentId
    ? documents.find((d) => d.id === previewDocumentId) ?? null
    : null;

  const viewTitle = isSearching
    ? `Search: "${searchQuery}"`
    : currentView === 'inbox'
      ? 'Inbox'
      : currentView;

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">{viewTitle}</h2>
            <span className="text-xs tabular-nums text-faint">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </span>
          </div>

          {!isSearching && (
            <div className="flex gap-0.5 rounded-md bg-surface p-0.5 text-xs">
              <button
                onClick={() => setSortBy('date')}
                className={cn(
                  'rounded px-2 py-1 transition-colors',
                  sortBy === 'date'
                    ? 'bg-elevated text-foreground'
                    : 'text-faint hover:text-secondary'
                )}
              >
                Date
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={cn(
                  'rounded px-2 py-1 transition-colors',
                  sortBy === 'name'
                    ? 'bg-elevated text-foreground'
                    : 'text-faint hover:text-secondary'
                )}
              >
                Name
              </button>
            </div>
          )}
        </div>

        <DocumentList
          onContextMenu={onContextMenu}
          onDoubleClick={(docId) => setPreviewDocument(docId)}
          onFile={onFile}
        />
      </div>

      {previewDoc && (
        <DocumentPreview
          document={previewDoc}
          onClose={() => setPreviewDocument(null)}
          onFile={() => onFile?.(previewDoc.id)}
          onDelete={() => onDelete?.(previewDoc.id)}
        />
      )}
    </div>
  );
}
