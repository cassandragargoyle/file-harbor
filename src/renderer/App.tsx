import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useAppStore } from './stores/app-store';
import { WelcomeScreen } from './components/onboarding/WelcomeScreen';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MainContent } from './components/layout/MainContent';
import { DropZone } from './components/inbox/DropZone';
import * as ipc from './lib/ipc';

type AppPhase = 'loading' | 'onboarding' | 'ready';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('loading');
  const initialize = useAppStore((s) => s.initialize);
  const loadDocuments = useAppStore((s) => s.loadDocuments);
  const refreshCounts = useAppStore((s) => s.refreshCounts);

  useEffect(() => {
    let cancelled = false;
    initialize().then((result) => {
      if (!cancelled) setPhase(result);
    });
    return () => { cancelled = true; };
  }, []);

  // Subscribe to watcher events for real-time UI updates
  useEffect(() => {
    if (phase !== 'ready') return;

    const cleanup = ipc.onFileIngested((doc) => {
      toast.success(`New file imported: ${doc.original_filename}`);
      loadDocuments();
      refreshCounts();
    });

    return cleanup;
  }, [phase, loadDocuments, refreshCounts]);

  if (phase === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-base text-foreground [-webkit-app-region:drag]">
        <p className="text-sm text-faint">Loading...</p>
      </div>
    );
  }

  if (phase === 'onboarding') {
    return (
      <>
        <WelcomeScreen onComplete={() => setPhase('ready')} />
        <Toaster theme="light" position="bottom-right" richColors />
      </>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-base text-foreground">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <MainContent />
        </div>
      </div>
      <DropZone />
      <Toaster theme="light" position="bottom-right" richColors />
    </>
  );
}
