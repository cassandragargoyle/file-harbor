import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the ipc module so the store can be imported without window.electronAPI
vi.mock('../lib/ipc', () => ({
  getDocumentsByCategory: vi.fn().mockResolvedValue([]),
  getDocumentCounts: vi.fn().mockResolvedValue({}),
  saveLastView: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({ version: 2, workspaces: [], activeWorkspaceId: '' }),
  searchDocuments: vi.fn().mockResolvedValue([]),
  listWorkspaces: vi.fn().mockResolvedValue([]),
  switchWorkspace: vi.fn().mockResolvedValue({ success: true }),
  addWorkspace: vi.fn().mockResolvedValue({ success: true }),
  renameWorkspace: vi.fn(),
  removeWorkspace: vi.fn().mockResolvedValue({ success: true }),
  getActiveWorkspaceId: vi.fn().mockResolvedValue(null),
}));

import { useAppStore } from './app-store';
import type { DocumentRecord } from '../../shared/types';

function makeDocs(count: number): DocumentRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `doc-${i}`,
    original_filename: `file-${i}.pdf`,
    stored_path: `objects/file-${i}.pdf`,
    mime_type: 'application/pdf',
    size_bytes: 1024,
    added_at: new Date(2024, 0, i + 1).toISOString(),
    source: 'file_picker' as const,
    source_path: null,
    category: null,
    content_hash: `hash-${i}`,
    extracted_text: null,
    suggested_category: null,
    suggestion_confidence: null,
    suggestion_source: null,
    suggested_filename: null,
    suggestion_outcome: null,
    updated_at: new Date().toISOString(),
  }));
}

describe('app-store selection', () => {
  beforeEach(() => {
    // Reset store to clean state with test documents
    useAppStore.setState({
      documents: makeDocs(5),
      selectedDocumentId: null,
      selectedDocumentIds: [],
      lastClickedDocId: null,
    });
  });

  describe('setSelectedDocument', () => {
    it('sets selectedDocumentId and clears multi-selection', () => {
      useAppStore.getState().setSelectedDocument('doc-2');
      const state = useAppStore.getState();
      expect(state.selectedDocumentId).toBe('doc-2');
      expect(state.selectedDocumentIds).toEqual([]);
      expect(state.lastClickedDocId).toBe('doc-2');
    });

    it('clears any existing multi-selection', () => {
      useAppStore.setState({ selectedDocumentIds: ['doc-0', 'doc-1', 'doc-2'] });
      useAppStore.getState().setSelectedDocument('doc-3');
      expect(useAppStore.getState().selectedDocumentIds).toEqual([]);
    });
  });

  describe('toggleDocumentSelection', () => {
    it('starts multi-select including the currently selected doc', () => {
      useAppStore.getState().setSelectedDocument('doc-0');
      useAppStore.getState().toggleDocumentSelection('doc-2');
      const state = useAppStore.getState();
      expect(state.selectedDocumentIds).toEqual(['doc-0', 'doc-2']);
    });

    it('deselects a doc if toggled again while multi-selecting', () => {
      useAppStore.setState({ selectedDocumentIds: ['doc-0', 'doc-1', 'doc-2'] });
      useAppStore.getState().toggleDocumentSelection('doc-1');
      expect(useAppStore.getState().selectedDocumentIds).toEqual(['doc-0', 'doc-2']);
    });

    it('adds a doc if not already in selection', () => {
      useAppStore.setState({ selectedDocumentIds: ['doc-0', 'doc-1'] });
      useAppStore.getState().toggleDocumentSelection('doc-3');
      expect(useAppStore.getState().selectedDocumentIds).toEqual(['doc-0', 'doc-1', 'doc-3']);
    });

    it('produces empty selection if toggling the only selected doc while single-selecting', () => {
      useAppStore.getState().setSelectedDocument('doc-1');
      useAppStore.getState().toggleDocumentSelection('doc-1');
      expect(useAppStore.getState().selectedDocumentIds).toEqual([]);
    });
  });

  describe('rangeSelectDocuments', () => {
    it('selects a range from the last-clicked doc to the target', () => {
      useAppStore.getState().setSelectedDocument('doc-1');
      useAppStore.getState().rangeSelectDocuments('doc-3');
      expect(useAppStore.getState().selectedDocumentIds).toEqual(['doc-1', 'doc-2', 'doc-3']);
    });

    it('works in reverse direction', () => {
      useAppStore.getState().setSelectedDocument('doc-3');
      useAppStore.getState().rangeSelectDocuments('doc-1');
      expect(useAppStore.getState().selectedDocumentIds).toEqual(['doc-1', 'doc-2', 'doc-3']);
    });

    it('merges with existing multi-selection', () => {
      useAppStore.setState({
        selectedDocumentIds: ['doc-0'],
        lastClickedDocId: 'doc-2',
      });
      useAppStore.getState().rangeSelectDocuments('doc-4');
      const ids = useAppStore.getState().selectedDocumentIds;
      expect(ids).toContain('doc-0'); // previously selected
      expect(ids).toContain('doc-2');
      expect(ids).toContain('doc-3');
      expect(ids).toContain('doc-4');
    });

    it('selects just the target if no anchor exists', () => {
      useAppStore.getState().rangeSelectDocuments('doc-2');
      expect(useAppStore.getState().selectedDocumentIds).toEqual(['doc-2']);
    });
  });

  describe('selectAllDocuments', () => {
    it('selects all documents in the current list', () => {
      useAppStore.getState().selectAllDocuments();
      const ids = useAppStore.getState().selectedDocumentIds;
      expect(ids).toHaveLength(5);
      expect(ids).toEqual(['doc-0', 'doc-1', 'doc-2', 'doc-3', 'doc-4']);
    });
  });

  describe('clearSelection', () => {
    it('clears multi-selection and lastClickedDocId', () => {
      useAppStore.setState({
        selectedDocumentIds: ['doc-0', 'doc-1'],
        lastClickedDocId: 'doc-1',
      });
      useAppStore.getState().clearSelection();
      const state = useAppStore.getState();
      expect(state.selectedDocumentIds).toEqual([]);
      expect(state.lastClickedDocId).toBeNull();
    });
  });

  describe('view switching clears selection', () => {
    it('clears selectedDocumentIds when switching views', async () => {
      useAppStore.setState({ selectedDocumentIds: ['doc-0', 'doc-1'] });
      await useAppStore.getState().setCurrentView('Taxes');
      expect(useAppStore.getState().selectedDocumentIds).toEqual([]);
    });
  });
});
