import { useState, useEffect, useCallback, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { useAppStore } from './stores/app-store';
import { WelcomeScreen } from './components/onboarding/WelcomeScreen';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MainContent } from './components/layout/MainContent';
import { DropZone } from './components/inbox/DropZone';
import { CategoryPicker } from './components/filing/CategoryPicker';
import { ContextMenu, getDocumentActions } from './components/documents/ContextMenu';
import { DeleteDialog } from './components/documents/DeleteDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { showIngestToasts } from './lib/toast-helpers';
import type { Category, DocumentRecord } from '../shared/types';
import * as ipc from './lib/ipc';

type AppPhase = 'loading' | 'onboarding' | 'ready';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('loading');
  const initialize = useAppStore((s) => s.initialize);
  const loadDocuments = useAppStore((s) => s.loadDocuments);
  const refreshCounts = useAppStore((s) => s.refreshCounts);
  const selectedDocumentId = useAppStore((s) => s.selectedDocumentId);
  const documents = useAppStore((s) => s.documents);
  const setPreviewDocument = useAppStore((s) => s.setPreviewDocument);

  // ── Overlay state ──────────────────────────────────────────
  const [categoryPickerDocId, setCategoryPickerDocId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ docId: string; x: number; y: number } | null>(null);

  const selectedDoc: DocumentRecord | undefined = documents.find((d) => d.id === selectedDocumentId);
  const deleteDoc: DocumentRecord | undefined = deleteDocId ? documents.find((d) => d.id === deleteDocId) : undefined;

  // ── Initialization ─────────────────────────────────────────
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

  // ── Action callbacks ──────────────────────────────────────
  const handleFileAction = useCallback((docId?: string) => {
    const id = docId ?? selectedDocumentId;
    if (id) setCategoryPickerDocId(id);
  }, [selectedDocumentId]);

  const handlePreviewAction = useCallback((docId?: string) => {
    const id = docId ?? selectedDocumentId;
    if (id) setPreviewDocument(id);
  }, [selectedDocumentId, setPreviewDocument]);

  const handleDeleteAction = useCallback((docId?: string) => {
    const id = docId ?? selectedDocumentId;
    if (id) setDeleteDocId(id);
  }, [selectedDocumentId]);

  const handleImportAction = useCallback(async () => {
    const paths = await ipc.openFilePicker();
    if (!paths) return;
    try {
      const results = await ipc.ingestFiles(paths, 'file_picker');
      showIngestToasts(results);
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to import files');
    }
  }, [loadDocuments, refreshCounts]);

  const handleCategorySelect = useCallback(async (category: Category) => {
    if (!categoryPickerDocId) return;
    try {
      await ipc.updateDocumentCategory(categoryPickerDocId, category);
      toast.success(`Filed to ${category}`);
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to file document');
    }
    setCategoryPickerDocId(null);
  }, [categoryPickerDocId, loadDocuments, refreshCounts]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDocId) return;
    try {
      await ipc.deleteDocument(deleteDocId);
      toast.success('Document deleted');
      // Clear preview if deleting the previewed doc
      const previewId = useAppStore.getState().previewDocumentId;
      if (previewId === deleteDocId) {
        setPreviewDocument(null);
      }
      // Clear selection if deleting the selected doc
      if (selectedDocumentId === deleteDocId) {
        useAppStore.getState().setSelectedDocument(null);
      }
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to delete document');
    }
    setDeleteDocId(null);
  }, [deleteDocId, selectedDocumentId, loadDocuments, refreshCounts, setPreviewDocument]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  const shortcutActions = useMemo(
    () => ({
      onFile: () => handleFileAction(),
      onPreview: () => handlePreviewAction(),
      onDelete: () => handleDeleteAction(),
      onImport: handleImportAction,
    }),
    [handleFileAction, handlePreviewAction, handleDeleteAction, handleImportAction]
  );
  useKeyboardShortcuts(shortcutActions);

  // ── Context menu ───────────────────────────────────────────
  const handleContextMenu = useCallback((docId: string, x: number, y: number) => {
    setContextMenu({ docId, x, y });
  }, []);

  const contextMenuActions = contextMenu
    ? getDocumentActions({
        onFile: () => handleFileAction(contextMenu.docId),
        onPreview: () => handlePreviewAction(contextMenu.docId),
        onExport: () => ipc.exportDocument(contextMenu.docId),
        onReveal: () => ipc.revealInFinder(contextMenu.docId),
        onDelete: () => handleDeleteAction(contextMenu.docId),
      })
    : [];

  // ── Render ─────────────────────────────────────────────────

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
          <MainContent
            onContextMenu={handleContextMenu}
            onFile={handleFileAction}
            onDelete={handleDeleteAction}
          />
        </div>
      </div>
      <DropZone />

      {/* Category Picker overlay */}
      {categoryPickerDocId && (
        <CategoryPicker
          onSelect={handleCategorySelect}
          onClose={() => setCategoryPickerDocId(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteDoc && (
        <DeleteDialog
          filename={deleteDoc.original_filename}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteDocId(null)}
        />
      )}

      <Toaster theme="light" position="bottom-right" richColors />
    </>
  );
}
