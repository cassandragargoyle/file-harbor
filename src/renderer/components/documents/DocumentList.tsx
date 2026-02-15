import { useEffect, useCallback } from 'react';
import { useAppStore, type ViewType } from '../../stores/app-store';
import { DocumentRow } from './DocumentRow';

interface DocumentListProps {
  onContextMenu?: (docId: string, x: number, y: number) => void;
  onDoubleClick?: (docId: string) => void;
  onSelect?: (docId: string) => void;
  onFile?: (docId: string) => void;
  onExport?: (docId: string) => void;
  onOpen?: (docId: string) => void;
  onReveal?: (docId: string) => void;
  onRename?: (docId: string) => void;
  onDelete?: (docId: string) => void;
  onAcceptSuggestion?: (docId: string) => void;
  onDismissSuggestion?: (docId: string) => void;
}

export function DocumentList({ onContextMenu, onDoubleClick, onSelect, onFile, onExport, onOpen, onReveal, onRename, onDelete, onAcceptSuggestion, onDismissSuggestion }: DocumentListProps) {
  const documents = useAppStore((s) => s.documents);
  const selectedDocumentId = useAppStore((s) => s.selectedDocumentId);
  const selectedDocumentIds = useAppStore((s) => s.selectedDocumentIds);
  const setSelectedDocument = useAppStore((s) => s.setSelectedDocument);
  const toggleDocumentSelection = useAppStore((s) => s.toggleDocumentSelection);
  const rangeSelectDocuments = useAppStore((s) => s.rangeSelectDocuments);
  const isLoading = useAppStore((s) => s.isLoading);
  const currentView = useAppStore((s) => s.currentView);
  const isSearching = useAppStore((s) => s.isSearching);
  const searchQuery = useAppStore((s) => s.searchQuery);

  const isMultiSelecting = selectedDocumentIds.length > 0;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (documents.length === 0) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      e.preventDefault();
      const currentIndex = documents.findIndex((d) => d.id === selectedDocumentId);

      if (e.key === 'ArrowDown') {
        const next = currentIndex < documents.length - 1 ? currentIndex + 1 : 0;
        setSelectedDocument(documents[next].id);
        onSelect?.(documents[next].id);
      } else {
        const prev = currentIndex > 0 ? currentIndex - 1 : documents.length - 1;
        setSelectedDocument(documents[prev].id);
        onSelect?.(documents[prev].id);
      }
    },
    [documents, selectedDocumentId, setSelectedDocument, onSelect]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected row into view
  useEffect(() => {
    if (!selectedDocumentId) return;
    const el = document.querySelector(`[data-document-id="${selectedDocumentId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedDocumentId]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (documents.length === 0) {
    return <EmptyState view={isSearching ? 'search' : currentView} searchQuery={searchQuery} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {documents.map((doc) => (
        <DocumentRow
          key={doc.id}
          document={doc}
          selected={doc.id === selectedDocumentId}
          multiSelected={isMultiSelecting && selectedDocumentIds.includes(doc.id)}
          isMultiSelecting={isMultiSelecting}
          onClick={(e: React.MouseEvent) => {
            if (e.metaKey || e.ctrlKey) {
              toggleDocumentSelection(doc.id);
            } else if (e.shiftKey) {
              rangeSelectDocuments(doc.id);
            } else {
              setSelectedDocument(doc.id);
              onSelect?.(doc.id);
            }
          }}
          onDoubleClick={() => onDoubleClick?.(doc.id)}
          onContextMenu={(e) => onContextMenu?.(doc.id, e.clientX, e.clientY)}
          onFile={onFile ? () => onFile(doc.id) : undefined}
          onExport={onExport ? () => onExport(doc.id) : undefined}
          onOpen={onOpen ? () => onOpen(doc.id) : undefined}
          onReveal={onReveal ? () => onReveal(doc.id) : undefined}
          onRename={onRename ? () => onRename(doc.id) : undefined}
          onDelete={onDelete ? () => onDelete(doc.id) : undefined}
          onAcceptSuggestion={onAcceptSuggestion ? () => onAcceptSuggestion(doc.id) : undefined}
          onDismissSuggestion={onDismissSuggestion ? () => onDismissSuggestion(doc.id) : undefined}
        />
      ))}
    </div>
  );
}

function EmptyState({ view, searchQuery }: { view: ViewType | 'search'; searchQuery?: string }) {
  let message: string;
  if (view === 'search') {
    message = searchQuery
      ? `No documents match '${searchQuery}'.`
      : 'No documents match your search.';
  } else if (view === 'inbox') {
    message = 'All caught up! Drag files here or import to get started.';
  } else {
    message = `No documents filed under ${view}.`;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className="text-center text-sm text-faint">{message}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex-1 space-y-3 px-4 py-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3">
          <div className="h-5 w-5 rounded bg-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-elevated" />
            <div className="h-3 w-1/3 rounded bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}
