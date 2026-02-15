import { create } from 'zustand';
import type { DocumentRecord, Category, DocumentCounts, Workspace } from '../../shared/types';
import * as ipc from '../lib/ipc';

export type ViewType = 'inbox' | Category;

interface AppState {
  // Library
  libraryPath: string | null;

  // Workspaces
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspaceName: string | null;

  // Navigation
  currentView: ViewType;

  // Documents
  documents: DocumentRecord[];
  selectedDocumentId: string | null;
  selectedDocumentIds: string[];
  lastClickedDocId: string | null;
  sortBy: 'date' | 'name';

  // Preview
  previewDocumentId: string | null;

  // Search
  searchQuery: string;
  isSearching: boolean;

  // Counts
  sidebarCounts: DocumentCounts | null;

  // Loading
  isLoading: boolean;

  // Actions
  setLibraryPath: (path: string) => void;
  setCurrentView: (view: ViewType) => Promise<void>;
  loadDocuments: () => Promise<void>;
  refreshCounts: () => Promise<void>;
  setSelectedDocument: (id: string | null) => void;
  toggleDocumentSelection: (id: string) => void;
  rangeSelectDocuments: (id: string) => void;
  selectAllDocuments: () => void;
  clearSelection: () => void;
  setPreviewDocument: (id: string | null) => void;
  setSortBy: (sort: 'date' | 'name') => void;
  searchDocuments: (query: string) => Promise<void>;
  clearSearch: () => void;
  initialize: () => Promise<'onboarding' | 'ready'>;

  // Workspace actions
  switchWorkspace: (workspaceId: string) => Promise<void>;
  addWorkspace: (name: string, libraryPath: string) => Promise<boolean>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  removeWorkspace: (id: string) => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  libraryPath: null,
  workspaces: [],
  activeWorkspaceId: null,
  activeWorkspaceName: null,
  currentView: 'inbox',
  documents: [],
  selectedDocumentId: null,
  selectedDocumentIds: [],
  lastClickedDocId: null,
  sortBy: 'date',
  previewDocumentId: null,
  searchQuery: '',
  isSearching: false,
  sidebarCounts: null,
  isLoading: false,

  setLibraryPath: (path) => set({ libraryPath: path }),

  setCurrentView: async (view) => {
    set({ currentView: view, selectedDocumentId: null, selectedDocumentIds: [], lastClickedDocId: null, previewDocumentId: null, searchQuery: '', isSearching: false });
    ipc.saveLastView(view); // fire-and-forget
    await get().loadDocuments();
  },

  loadDocuments: async () => {
    const { currentView, sortBy } = get();
    set({ isLoading: true });
    try {
      const category = currentView === 'inbox' ? null : currentView;
      const docs = await ipc.getDocumentsByCategory(category);

      const sorted = [...docs].sort((a, b) => {
        if (sortBy === 'name') return a.original_filename.localeCompare(b.original_filename);
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      });

      set({ documents: sorted, isLoading: false });
    } catch {
      set({ documents: [], isLoading: false });
    }
  },

  refreshCounts: async () => {
    try {
      const counts = await ipc.getDocumentCounts();
      set({ sidebarCounts: counts });
    } catch {
      // ignore
    }
  },

  setSelectedDocument: (id) => set({ selectedDocumentId: id, selectedDocumentIds: [], lastClickedDocId: id }),

  toggleDocumentSelection: (id) => {
    const { selectedDocumentIds, selectedDocumentId } = get();
    // First cmd-click: start multi-select including the currently selected doc
    if (selectedDocumentIds.length === 0 && selectedDocumentId) {
      const ids = selectedDocumentId === id ? [] : [selectedDocumentId, id];
      set({ selectedDocumentIds: ids, lastClickedDocId: id });
    } else {
      const next = selectedDocumentIds.includes(id)
        ? selectedDocumentIds.filter((i) => i !== id)
        : [...selectedDocumentIds, id];
      set({ selectedDocumentIds: next, lastClickedDocId: id });
    }
  },

  rangeSelectDocuments: (id) => {
    const { documents, lastClickedDocId, selectedDocumentIds, selectedDocumentId } = get();
    const anchorId = lastClickedDocId ?? selectedDocumentId;
    if (!anchorId) {
      set({ selectedDocumentIds: [id], lastClickedDocId: id });
      return;
    }
    const anchorIdx = documents.findIndex((d) => d.id === anchorId);
    const targetIdx = documents.findIndex((d) => d.id === id);
    if (anchorIdx === -1 || targetIdx === -1) return;
    const start = Math.min(anchorIdx, targetIdx);
    const end = Math.max(anchorIdx, targetIdx);
    const rangeIds = documents.slice(start, end + 1).map((d) => d.id);
    // Merge with existing selection
    const merged = [...new Set([...selectedDocumentIds, ...rangeIds])];
    set({ selectedDocumentIds: merged });
  },

  selectAllDocuments: () => {
    const { documents } = get();
    set({ selectedDocumentIds: documents.map((d) => d.id) });
  },

  clearSelection: () => set({ selectedDocumentIds: [], lastClickedDocId: null }),

  setPreviewDocument: (id) => set({ previewDocumentId: id }),

  setSortBy: (sort) => {
    set({ sortBy: sort });
    get().loadDocuments();
  },

  searchDocuments: async (query) => {
    if (!query.trim()) {
      get().clearSearch();
      return;
    }
    set({ isSearching: true, searchQuery: query, isLoading: true });
    try {
      const docs = await ipc.searchDocuments(query);
      set({ documents: docs, isLoading: false });
    } catch {
      set({ documents: [], isLoading: false });
    }
  },

  clearSearch: () => {
    set({ searchQuery: '', isSearching: false });
    get().loadDocuments();
  },

  initialize: async () => {
    const settings = await ipc.getSettings();
    if (settings.workspaces && settings.workspaces.length > 0) {
      const activeId = settings.activeWorkspaceId;
      const activeWs = settings.workspaces.find((w) => w.id === activeId);
      const lastView = settings.lastView as ViewType | undefined;

      set({
        workspaces: settings.workspaces,
        activeWorkspaceId: activeId,
        activeWorkspaceName: activeWs?.name ?? null,
        libraryPath: activeWs?.libraryPath ?? null,
        currentView: lastView ?? 'inbox',
      });
      await get().loadDocuments();
      await get().refreshCounts();
      return 'ready';
    }
    return 'onboarding';
  },

  switchWorkspace: async (workspaceId) => {
    set({ isLoading: true });
    const result = await ipc.switchWorkspace(workspaceId);
    if (result.success) {
      const workspaces = await ipc.listWorkspaces();
      const ws = workspaces.find((w) => w.id === workspaceId);
      set({
        workspaces,
        activeWorkspaceId: workspaceId,
        activeWorkspaceName: ws?.name ?? null,
        libraryPath: ws?.libraryPath ?? null,
        currentView: 'inbox',
        documents: [],
        selectedDocumentId: null,
        previewDocumentId: null,
        searchQuery: '',
        isSearching: false,
      });
      await get().loadDocuments();
      await get().refreshCounts();
    }
    set({ isLoading: false });
  },

  addWorkspace: async (name, libraryPath) => {
    const result = await ipc.addWorkspace(name, libraryPath);
    if (result.success && result.workspace) {
      const workspaces = await ipc.listWorkspaces();
      set({
        workspaces,
        activeWorkspaceId: result.workspace.id,
        activeWorkspaceName: result.workspace.name,
        libraryPath: result.workspace.libraryPath,
        currentView: 'inbox',
        documents: [],
        selectedDocumentId: null,
        previewDocumentId: null,
        searchQuery: '',
        isSearching: false,
      });
      await get().loadDocuments();
      await get().refreshCounts();
      return true;
    }
    return false;
  },

  renameWorkspace: async (id, name) => {
    await ipc.renameWorkspace(id, name);
    const workspaces = await ipc.listWorkspaces();
    const activeId = get().activeWorkspaceId;
    const activeWs = workspaces.find((w) => w.id === activeId);
    set({
      workspaces,
      activeWorkspaceName: activeWs?.name ?? get().activeWorkspaceName,
    });
  },

  removeWorkspace: async (id) => {
    const result = await ipc.removeWorkspace(id);
    if (result.success) {
      const workspaces = await ipc.listWorkspaces();
      const activeId = await ipc.getActiveWorkspaceId();
      const activeWs = workspaces.find((w) => w.id === activeId);
      set({
        workspaces,
        activeWorkspaceId: activeId,
        activeWorkspaceName: activeWs?.name ?? null,
        libraryPath: activeWs?.libraryPath ?? null,
        currentView: 'inbox',
        documents: [],
        selectedDocumentId: null,
        previewDocumentId: null,
      });
      await get().loadDocuments();
      await get().refreshCounts();
      return true;
    }
    return false;
  },
}));
