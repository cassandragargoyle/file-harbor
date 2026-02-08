import { useState, useEffect } from 'react';
import { useAppStore } from './stores/app-store';
import { WelcomeScreen } from './components/onboarding/WelcomeScreen';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MainContent } from './components/layout/MainContent';

type AppPhase = 'loading' | 'onboarding' | 'ready';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('loading');
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    let cancelled = false;
    initialize().then((result) => {
      if (!cancelled) setPhase(result);
    });
    return () => { cancelled = true; };
  }, []);

  if (phase === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-base text-foreground [-webkit-app-region:drag]">
        <p className="text-sm text-faint">Loading...</p>
      </div>
    );
  }

  if (phase === 'onboarding') {
    return <WelcomeScreen onComplete={() => setPhase('ready')} />;
  }

  return (
    <div className="flex h-screen bg-base text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <MainContent />
      </div>
    </div>
  );
}
