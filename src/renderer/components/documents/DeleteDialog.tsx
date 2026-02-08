interface DeleteDialogProps {
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDialog({ filename, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-base p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-foreground">Delete document</h3>
        <p className="mt-2 text-sm text-muted">
          Delete <span className="font-medium text-secondary">{filename}</span>? This permanently removes it from your library.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-elevated"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-danger px-3 py-1.5 text-sm text-white transition-colors hover:bg-danger/90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
