import { toast } from 'sonner';
import type { IngestResult } from '../../shared/types';

export function showIngestToasts(results: IngestResult[]): void {
  const success = results.filter((r) => r.status === 'success').length;
  const dupes = results.filter((r) => r.status === 'duplicate').length;
  const errors = results.filter((r) => r.status === 'error').length;

  if (success > 0) {
    toast.success(
      success === 1
        ? '1 document imported'
        : `${success} documents imported`
    );
  }

  if (dupes > 0) {
    toast(
      dupes === 1
        ? '1 duplicate skipped'
        : `${dupes} duplicates skipped`
    );
  }

  if (errors > 0) {
    const firstError = results.find((r) => r.status === 'error');
    const detail = firstError?.error ? `: ${firstError.error}` : '';
    toast.error(
      errors === 1
        ? `1 file failed to import${detail}`
        : `${errors} files failed to import${detail}`
    );
  }
}
