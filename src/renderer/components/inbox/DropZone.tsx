import { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as ipc from '../../lib/ipc';
import { useAppStore } from '../../stores/app-store';
import type { IngestResult } from '../../../shared/types';

interface DropZoneProps {
  onImportComplete?: (results: IngestResult[], skippedCount: number) => void;
}

export function DropZone({ onImportComplete }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const loadDocuments = useAppStore((s) => s.loadDocuments);
  const refreshCounts = useAppStore((s) => s.refreshCounts);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) setIsDragging(false);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const paths = Array.from(files)
        .map((f) => ipc.getPathForFile(f))
        .filter(Boolean);

      console.log('[DropZone] paths:', paths);
      if (paths.length === 0) return;

      try {
        const { results, skippedCount } = await ipc.ingestFiles(paths, 'dragdrop');
        console.log('[DropZone] results:', results);
        if (onImportComplete) {
          onImportComplete(results, skippedCount);
        }
        await loadDocuments();
        await refreshCounts();
      } catch {
        toast.error('Failed to import files');
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [loadDocuments, refreshCounts, onImportComplete]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent-fg/50 bg-elevated/80 px-16 py-12">
        <Upload className="h-10 w-10 text-accent-fg" />
        <p className="text-lg font-medium text-foreground">Drop files to import</p>
        <p className="text-sm text-muted">Files will be added to your Inbox</p>
      </div>
    </div>
  );
}
