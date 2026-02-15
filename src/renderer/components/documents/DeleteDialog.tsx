interface DeleteDialogProps {
  filename?: string;
  count?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDialog({ filename, count, onConfirm, onCancel }: DeleteDialogProps) {
  const isBulk = count !== undefined && count > 1;
  const title = isBulk ? `Delete ${count} documents` : 'Delete document';
  const message = isBulk
    ? `Delete ${count} selected documents? This permanently removes them from your library.`
    : <>Delete <span className="font-medium text-secondary">{filename}</span>? This permanently removes it from your library.</>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-base p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted">{message}</p>
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
