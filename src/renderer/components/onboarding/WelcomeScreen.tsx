import { useState } from 'react';
import { FolderOpen, Archive } from 'lucide-react';
import * as ipc from '../../lib/ipc';

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChooseLibrary = async () => {
    setError(null);
    const path = await ipc.chooseLibraryPath();
    if (!path) return;

    setIsInitializing(true);
    try {
      const result = await ipc.initializeLibrary(path);
      if (result.success) {
        onComplete();
      } else {
        setError(result.error || 'Failed to initialize library');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-base text-foreground [-webkit-app-region:drag]">
      <div className="flex max-w-md flex-col items-center text-center [-webkit-app-region:no-drag]">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-elevated">
          <Archive className="h-8 w-8 text-accent-fg" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Welcome to File Harbor</h1>
        <p className="mt-3 leading-relaxed text-muted">
          Your personal document cabinet. Choose a folder to store your
          library — all your documents and metadata will live there.
        </p>

        <button
          onClick={handleChooseLibrary}
          disabled={isInitializing}
          className="mt-8 flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <FolderOpen className="h-4 w-4" />
          {isInitializing ? 'Setting up...' : 'Choose Library Location'}
        </button>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
