import { useEffect } from 'react';

interface ShortcutActions {
  onFile: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onImport: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key) {
        case 'a':
        case 'A':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            actions.onSelectAll?.();
          }
          break;
        case 'Escape':
          actions.onClearSelection?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          actions.onFile();
          break;
        case 'Enter':
          e.preventDefault();
          actions.onPreview();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          actions.onDelete();
          break;
        case 'i':
        case 'I':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            actions.onImport();
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}
