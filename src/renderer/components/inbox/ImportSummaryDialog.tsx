import { CheckCircle2, XCircle, Copy, FileQuestion, X } from 'lucide-react';
import type { IngestResult } from '../../../shared/types';

interface ImportSummaryDialogProps {
  results: IngestResult[];
  skippedCount: number;
  onClose: () => void;
}

export function ImportSummaryDialog({ results, skippedCount, onClose }: ImportSummaryDialogProps) {
  const succeeded = results.filter((r) => r.status === 'success');
  const duplicates = results.filter((r) => r.status === 'duplicate');
  const errors = results.filter((r) => r.status === 'error');

  const hasIssues = errors.length > 0 || duplicates.length > 0 || skippedCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col rounded-xl border border-border bg-base shadow-2xl" style={{ maxHeight: '70vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Import Complete</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-faint transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-xs">
          {succeeded.length > 0 && (
            <span className="flex items-center gap-1 text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {succeeded.length} imported
            </span>
          )}
          {duplicates.length > 0 && (
            <span className="flex items-center gap-1 text-faint">
              <Copy className="h-3.5 w-3.5" />
              {duplicates.length} {duplicates.length === 1 ? 'duplicate' : 'duplicates'} skipped
            </span>
          )}
          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-danger">
              <XCircle className="h-3.5 w-3.5" />
              {errors.length} failed
            </span>
          )}
          {skippedCount > 0 && (
            <span className="flex items-center gap-1 text-faint">
              <FileQuestion className="h-3.5 w-3.5" />
              {skippedCount} unsupported skipped
            </span>
          )}
        </div>

        {/* Detail sections */}
        {hasIssues && (
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {errors.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-medium text-danger">Failed</p>
                <ul className="space-y-1">
                  {errors.map((r, i) => (
                    <li key={i} className="rounded bg-danger/5 px-3 py-1.5 text-xs text-secondary">
                      <span className="font-medium">{basename(r.path)}</span>
                      {r.error && <span className="text-faint"> — {r.error}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {duplicates.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-medium text-faint">Duplicates</p>
                <ul className="space-y-1">
                  {duplicates.map((r, i) => (
                    <li key={i} className="px-3 py-0.5 text-xs text-faint">
                      {basename(r.path)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            autoFocus
            className="rounded-lg bg-accent px-4 py-1.5 text-xs text-white transition-colors hover:bg-accent-hover"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/** Extract the filename from a full path. */
function basename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}
