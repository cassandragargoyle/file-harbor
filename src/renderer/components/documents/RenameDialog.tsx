import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import * as ipc from '../../lib/ipc';

interface RenameDialogProps {
  documentId: string;
  filename: string;
  suggestedFilename?: string;
  onConfirm: (newFilename: string) => void;
  onCancel: () => void;
}

function splitFilename(filename: string): { name: string; ext: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return { name: filename, ext: '' };
  return { name: filename.slice(0, lastDot), ext: filename.slice(lastDot) };
}

export function RenameDialog({ documentId, filename, suggestedFilename, onConfirm, onCancel }: RenameDialogProps) {
  const { name, ext } = splitFilename(filename);
  const [value, setValue] = useState(name);
  const [suggesting, setSuggesting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed + ext !== filename;

  const handleSubmit = () => {
    if (canSubmit) onConfirm(trimmed + ext);
  };

  const handleApplySuggestion = () => {
    if (!suggestedFilename) return;
    const { name: suggestedName } = splitFilename(suggestedFilename);
    setValue(suggestedName);
    inputRef.current?.focus();
  };

  const handleSuggestName = async () => {
    setSuggesting(true);
    try {
      const result = await ipc.suggestFilename(documentId);
      if (result) {
        const { name: suggestedName } = splitFilename(result);
        setValue(suggestedName);
        inputRef.current?.focus();
      }
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-base p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-foreground">Rename document</h3>
        <div className="mt-3 flex items-center gap-0">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onCancel();
            }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            spellCheck={false}
          />
          {ext && (
            <span className="shrink-0 pl-1.5 text-sm text-faint">{ext}</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          {suggestedFilename ? (
            <button
              type="button"
              onClick={handleApplySuggestion}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
            >
              <Sparkles className="h-3 w-3" />
              Apply suggestion
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSuggestName}
              disabled={suggesting}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {suggesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Suggest name
            </button>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-elevated"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
