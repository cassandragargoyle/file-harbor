export const IPC_CHANNELS = {
  // Library
  LIBRARY_CHOOSE_PATH: 'library:choose-path',
  LIBRARY_INITIALIZE: 'library:initialize',
  LIBRARY_GET_INFO: 'library:get-info',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',

  // Documents
  DOCUMENTS_INGEST_FILES: 'documents:ingest-files',
  DOCUMENTS_GET_BY_CATEGORY: 'documents:get-by-category',
  DOCUMENTS_UPDATE_CATEGORY: 'documents:update-category',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_SEARCH: 'documents:search',
  DOCUMENTS_GET_FILE_PATH: 'documents:get-file-path',
  DOCUMENTS_EXPORT: 'documents:export',
  DOCUMENTS_REVEAL_IN_FINDER: 'documents:reveal-in-finder',
  DOCUMENTS_GET_COUNTS: 'documents:get-counts',
  DOCUMENTS_OPEN_FILE_PICKER: 'documents:open-file-picker',
  DOCUMENTS_GET_PROTOCOL_URL: 'documents:get-protocol-url',
  DOCUMENTS_OPEN_EXTERNALLY: 'documents:open-externally',

  // Watcher
  WATCHER_SET_FOLDER: 'watcher:set-folder',
  WATCHER_GET_FOLDER: 'watcher:get-folder',
  WATCHER_CLEAR_FOLDER: 'watcher:clear-folder',
  WATCHER_FILE_INGESTED: 'watcher:file-ingested',
  WATCHER_ERROR: 'watcher:error',

  // Menu events (main -> renderer)
  MENU_IMPORT_FILES: 'menu:import-files',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE_LAST_VIEW: 'settings:save-last-view',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
