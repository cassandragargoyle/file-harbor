import { useEffect, useCallback } from 'react';
import { useAppStore, type ViewType } from '../../stores/app-store';
import { DocumentRow } from './DocumentRow';

export function DocumentList() {
  const documents = useAppStore((s) => s.documents);
  const selectedDocumentId = useAppStore((s) => s.selectedDocumentId);
  const setSelectedDocument = useAppStore((s) => s.setSelectedDocument);
  const isLoading = useAppStore((s) => s.isLoading);
  const currentView = useAppStore((s) => s.currentView);
  const isSearching = useAppStore((s) => s.isSearching);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (documents.length === 0) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      // Don't hijack when typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      e.preventDefault();
      const currentIndex = documents.findIndex((d) => d.id === selectedDocumentId);

      if (e.key === 'ArrowDown') {
        const next = currentIndex < documents.length - 1 ? currentIndex + 1 : 0;
        setSelectedDocument(documents[next].id);
      } else {
        const prev = currentIndex > 0 ? currentIndex - 1 : documents.length - 1;
        setSelectedDocument(documents[prev].id);
      }
    },
    [documents, selectedDocumentId, setSelectedDocument]
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
    return <EmptyState view={isSearching ? 'search' : currentView} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {documents.map((doc) => (
        <DocumentRow
          key={doc.id}
          document={doc}
          selected={doc.id === selectedDocumentId}
          onClick={() => setSelectedDocument(doc.id)}
        />
      ))}
    </div>
  );
}

function EmptyState({ view }: { view: ViewType | 'search' }) {
  let message: string;
  if (view === 'search') {
    message = 'No documents match your search.';
  } else if (view === 'inbox') {
    message = 'Your inbox is empty. Drag and drop files or use Import to get started.';
  } else {
    message = `No documents filed under ${view} yet.`;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className="text-center text-sm text-neutral-500">{message}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex-1 space-y-3 px-4 py-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3">
          <div className="h-5 w-5 rounded bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-neutral-800" />
            <div className="h-3 w-1/3 rounded bg-neutral-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
