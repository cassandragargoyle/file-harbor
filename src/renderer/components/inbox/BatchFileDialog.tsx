import { useState, useEffect, useCallback } from 'react';
import { Check, X, Sparkles, Loader2 } from 'lucide-react';
import type { DocumentRecord } from '../../../shared/types';
import { cn } from '../../lib/utils';
import * as ipc from '../../lib/ipc';

interface BatchFileDialogProps {
  onComplete: (acceptedCount: number) => void;
  onClose: () => void;
}

type RowDecision = 'accept' | 'reject' | 'pending';

export function BatchFileDialog({ onComplete, onClose }: BatchFileDialogProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [decisions, setDecisions] = useState<Record<string, RowDecision>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    ipc.getDocumentsWithSuggestions().then((docs) => {
      setDocuments(docs);
      const initial: Record<string, RowDecision> = {};
      for (const doc of docs) {
        initial[doc.id] = 'pending';
      }
      setDecisions(initial);
      setIsLoading(false);
    });
  }, []);

  const setDecision = useCallback((id: string, decision: RowDecision) => {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  }, []);

  const acceptAllHighConfidence = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const doc of documents) {
        if ((doc.suggestion_confidence ?? 0) >= 0.7) {
          next[doc.id] = 'accept';
        }
      }
      return next;
    });
  }, [documents]);

  const acceptAll = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = 'accept';
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const idsToAccept = Object.entries(decisions)
      .filter(([, d]) => d === 'accept')
      .map(([id]) => id);

    const idsToDismiss = Object.entries(decisions)
      .filter(([, d]) => d === 'reject')
      .map(([id]) => id);

    if (idsToAccept.length === 0 && idsToDismiss.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    let acceptedCount = 0;
    if (idsToAccept.length > 0) {
      const result = await ipc.batchAcceptSuggestions(idsToAccept);
      acceptedCount = result.accepted;
    }

    for (const id of idsToDismiss) {
      await ipc.dismissSuggestion(id);
    }

    onComplete(acceptedCount);
  }, [decisions, onComplete, onClose]);

  const acceptCount = Object.values(decisions).filter((d) => d === 'accept').length;
  const rejectCount = Object.values(decisions).filter((d) => d === 'reject').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-xl border border-border bg-base shadow-2xl" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Auto-file inbox</h3>
            <p className="mt-0.5 text-xs text-faint">
              Review suggested categories and file documents in bulk.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-faint transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-faint" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-faint">No documents with suggestions in your inbox.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-faint">
                  <th className="px-5 py-2 text-left font-medium">Document</th>
                  <th className="px-3 py-2 text-left font-medium">Suggested Category</th>
                  <th className="px-3 py-2 text-left font-medium">Confidence</th>
                  <th className="px-3 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <BatchRow
                    key={doc.id}
                    document={doc}
                    decision={decisions[doc.id] ?? 'pending'}
                    onDecision={(d) => setDecision(doc.id, d)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {documents.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <div className="flex gap-2">
              <button
                onClick={acceptAllHighConfidence}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-elevated"
              >
                Accept high-confidence
              </button>
              <button
                onClick={acceptAll}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-elevated"
              >
                Accept all
              </button>
            </div>
            <div className="flex items-center gap-3">
              {(acceptCount > 0 || rejectCount > 0) && (
                <span className="text-xs text-faint">
                  {acceptCount > 0 && <span className="text-accent">{acceptCount} accept</span>}
                  {acceptCount > 0 && rejectCount > 0 && ' · '}
                  {rejectCount > 0 && <span className="text-danger">{rejectCount} dismiss</span>}
                </span>
              )}
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-elevated"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (acceptCount === 0 && rejectCount === 0)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {isSubmitting ? 'Filing...' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BatchRow({
  document,
  decision,
  onDecision,
}: {
  document: DocumentRecord;
  decision: RowDecision;
  onDecision: (d: RowDecision) => void;
}) {
  const confidence = document.suggestion_confidence ?? 0;
  const isHighConfidence = confidence >= 0.7;

  return (
    <tr className={cn(
      'border-b border-border/50 transition-colors',
      decision === 'accept' && 'bg-accent/5',
      decision === 'reject' && 'bg-danger/5 opacity-60'
    )}>
      <td className="max-w-[240px] truncate px-5 py-2.5 text-secondary">
        {document.original_filename}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          isHighConfidence ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning'
        )}>
          <Sparkles className="h-3 w-3" />
          {document.suggested_category}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn(
          'text-xs tabular-nums',
          isHighConfidence ? 'text-accent' : 'text-warning'
        )}>
          {Math.round(confidence * 100)}%
          {!isHighConfidence && ' ?'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <button
            title="Accept"
            onClick={() => onDecision(decision === 'accept' ? 'pending' : 'accept')}
            className={cn(
              'rounded p-1 transition-colors',
              decision === 'accept'
                ? 'bg-accent/20 text-accent'
                : 'text-faint hover:bg-accent/10 hover:text-accent'
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            title="Dismiss"
            onClick={() => onDecision(decision === 'reject' ? 'pending' : 'reject')}
            className={cn(
              'rounded p-1 transition-colors',
              decision === 'reject'
                ? 'bg-danger/20 text-danger'
                : 'text-faint hover:bg-danger/10 hover:text-danger'
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
