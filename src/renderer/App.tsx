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
import { RenameDialog } from './components/documents/RenameDialog';
import { BatchFileDialog } from './components/inbox/BatchFileDialog';
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
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ docId: string; x: number; y: number } | null>(null);
  const [showBatchFile, setShowBatchFile] = useState(false);

  const selectedDoc: DocumentRecord | undefined = documents.find((d) => d.id === selectedDocumentId);
  const deleteDoc: DocumentRecord | undefined = deleteDocId ? documents.find((d) => d.id === deleteDocId) : undefined;
  const renameDoc: DocumentRecord | undefined = renameDocId ? documents.find((d) => d.id === renameDocId) : undefined;

  // ── Initialization ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    initialize().then((result) => {
      if (!cancelled) setPhase(result);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Action callbacks ──────────────────────────────────────
  const handleFileAction = useCallback((docId?: string) => {
    const id = docId ?? selectedDocumentId;
    if (id) setCategoryPickerDocId(id);
  }, [selectedDocumentId]);

  const handlePreviewAction = useCallback((docId?: string) => {
    const id = docId ?? selectedDocumentId;
    if (id) setPreviewDocument(id);
  }, [selectedDocumentId, setPreviewDocument]);

  const handleRenameAction = useCallback((docId?: string) => {
    const id = docId ?? selectedDocumentId;
    if (id) setRenameDocId(id);
  }, [selectedDocumentId]);

  const handleDeleteAction = useCallback((docId?: string) => {
    const id = docId ?? selectedDocumentId;
    if (id) setDeleteDocId(id);
  }, [selectedDocumentId]);

  const handleImportAction = useCallback(async () => {
    const paths = await ipc.openFilePicker();
    if (!paths) return;
    try {
      const { results, skippedCount } = await ipc.ingestFiles(paths, 'file_picker');
      showIngestToasts(results, skippedCount);
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to import files');
    }
  }, [loadDocuments, refreshCounts]);

  const handleImportFolderAction = useCallback(async () => {
    const paths = await ipc.openFolderPicker();
    if (!paths) return;
    try {
      const { results, skippedCount } = await ipc.ingestFiles(paths, 'file_picker');
      showIngestToasts(results, skippedCount);
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to import folder');
    }
  }, [loadDocuments, refreshCounts]);

  // Subscribe to watcher, menu, and suggestion events
  useEffect(() => {
    if (phase !== 'ready') return;

    const cleanupWatcher = ipc.onFileIngested((doc) => {
      toast.success(`New file imported: ${doc.original_filename}`);
      loadDocuments();
      refreshCounts();
    });

    const cleanupMenu = ipc.onMenuImportFiles(() => {
      handleImportAction();
    });

    const cleanupMenuFolder = ipc.onMenuImportFolder(() => {
      handleImportFolderAction();
    });

    const cleanupWatcherError = ipc.onWatcherError((message) => {
      toast.error(message);
    });

    // Listen for LLM suggestion updates (Phase 2)
    const cleanupSuggestionUpdated = ipc.onSuggestionUpdated(() => {
      loadDocuments();
    });

    // Ollama detection nudge (Phase 2) — one-time toast
    ipc.getOllamaSettings().then(async (settings) => {
      if (!settings || settings.ollamaEnabled || settings.ollamaNudgeShown) return;
      const status = await ipc.checkOllamaStatus();
      if (status.reachable) {
        toast('Ollama detected — enable AI suggestions in Settings for smarter filing', {
          duration: 8000,
        });
        ipc.updateOllamaSettings({ ollamaNudgeShown: true });
      }
    });

    return () => {
      cleanupWatcher();
      cleanupMenu();
      cleanupMenuFolder();
      cleanupWatcherError();
      cleanupSuggestionUpdated();
    };
  }, [phase, loadDocuments, refreshCounts, handleImportAction, handleImportFolderAction]);

  const handleAcceptSuggestion = useCallback(async (docId: string) => {
    try {
      await ipc.acceptSuggestion(docId);
      toast.success('Suggestion accepted');
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to accept suggestion');
    }
  }, [loadDocuments, refreshCounts]);

  const handleDismissSuggestion = useCallback(async (docId: string) => {
    try {
      await ipc.dismissSuggestion(docId);
      await loadDocuments();
    } catch {
      toast.error('Failed to dismiss suggestion');
    }
  }, [loadDocuments]);

  const handleBatchFileComplete = useCallback(async (acceptedCount: number) => {
    setShowBatchFile(false);
    if (acceptedCount > 0) {
      toast.success(`Filed ${acceptedCount} ${acceptedCount === 1 ? 'document' : 'documents'}`);
    }
    await loadDocuments();
    await refreshCounts();
  }, [loadDocuments, refreshCounts]);

  const handleCategorySelect = useCallback(async (category: Category | null) => {
    if (!categoryPickerDocId) return;
    try {
      await ipc.updateDocumentCategory(categoryPickerDocId, category);
      toast.success(category ? `Filed to ${category}` : 'Moved to Inbox');
      await loadDocuments();
      await refreshCounts();
    } catch {
      toast.error('Failed to file document');
    }
    setCategoryPickerDocId(null);
  }, [categoryPickerDocId, loadDocuments, refreshCounts]);

  const handleRenameConfirm = useCallback(async (newFilename: string) => {
    if (!renameDocId) return;
    try {
      await ipc.renameDocument(renameDocId, newFilename);
      toast.success('Document renamed');
      await loadDocuments();
    } catch {
      toast.error('Failed to rename document');
    }
    setRenameDocId(null);
  }, [renameDocId, loadDocuments]);

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
        onRename: () => handleRenameAction(contextMenu.docId),
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
        <WelcomeScreen onComplete={async () => {
          const result = await initialize();
          setPhase(result);
        }} />
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
            onExport={(docId) => ipc.exportDocument(docId)}
            onOpen={(docId) => ipc.openDocumentExternally(docId)}
            onReveal={(docId) => ipc.revealInFinder(docId)}
            onRename={handleRenameAction}
            onDelete={handleDeleteAction}
            onAcceptSuggestion={handleAcceptSuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onBatchFile={() => setShowBatchFile(true)}
          />
        </div>
      </div>
      <DropZone />

      {/* Category Picker overlay */}
      {categoryPickerDocId && (
        <CategoryPicker
          onSelect={handleCategorySelect}
          onClose={() => setCategoryPickerDocId(null)}
          suggestedCategory={documents.find((d) => d.id === categoryPickerDocId)?.suggested_category ?? undefined}
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

      {/* Rename dialog */}
      {renameDoc && renameDocId && (
        <RenameDialog
          documentId={renameDocId}
          filename={renameDoc.original_filename}
          suggestedFilename={renameDoc.suggested_filename ?? undefined}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenameDocId(null)}
        />
      )}

      {/* Batch auto-file dialog */}
      {showBatchFile && (
        <BatchFileDialog
          onComplete={handleBatchFileComplete}
          onClose={() => setShowBatchFile(false)}
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
