import { useAppStore } from '../../stores/app-store';
import { DocumentList } from '../documents/DocumentList';
import { cn } from '../../lib/utils';

export function MainContent() {
  const currentView = useAppStore((s) => s.currentView);
  const documents = useAppStore((s) => s.documents);
  const sortBy = useAppStore((s) => s.sortBy);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const isSearching = useAppStore((s) => s.isSearching);
  const searchQuery = useAppStore((s) => s.searchQuery);

  const viewTitle = isSearching
    ? `Search: "${searchQuery}"`
    : currentView === 'inbox'
      ? 'Inbox'
      : currentView;

  return (
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

      <DocumentList />
    </div>
  );
}
