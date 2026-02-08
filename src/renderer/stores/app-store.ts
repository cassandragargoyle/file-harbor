import { create } from 'zustand';
import type { DocumentRecord, Category, DocumentCounts } from '../../shared/types';
import * as ipc from '../lib/ipc';

export type ViewType = 'inbox' | Category;

interface AppState {
  // Library
  libraryPath: string | null;

  // Navigation
  currentView: ViewType;

  // Documents
  documents: DocumentRecord[];
  selectedDocumentId: string | null;
  sortBy: 'date' | 'name';

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
  setSortBy: (sort: 'date' | 'name') => void;
  searchDocuments: (query: string) => Promise<void>;
  clearSearch: () => void;
  initialize: () => Promise<'onboarding' | 'ready'>;
}

export const useAppStore = create<AppState>((set, get) => ({
  libraryPath: null,
  currentView: 'inbox',
  documents: [],
  selectedDocumentId: null,
  sortBy: 'date',
  searchQuery: '',
  isSearching: false,
  sidebarCounts: null,
  isLoading: false,

  setLibraryPath: (path) => set({ libraryPath: path }),

  setCurrentView: async (view) => {
    set({ currentView: view, selectedDocumentId: null, searchQuery: '', isSearching: false });
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

  setSelectedDocument: (id) => set({ selectedDocumentId: id }),

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
    if (settings.libraryPath) {
      set({ libraryPath: settings.libraryPath });
      await get().loadDocuments();
      await get().refreshCounts();
      return 'ready';
    }
    return 'onboarding';
  },
}));
