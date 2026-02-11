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
  DOCUMENTS_RENAME: 'documents:rename',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_SEARCH: 'documents:search',
  DOCUMENTS_GET_FILE_PATH: 'documents:get-file-path',
  DOCUMENTS_EXPORT: 'documents:export',
  DOCUMENTS_EXPORT_ALL: 'documents:export-all',
  DOCUMENTS_REVEAL_IN_FINDER: 'documents:reveal-in-finder',
  DOCUMENTS_GET_COUNTS: 'documents:get-counts',
  DOCUMENTS_OPEN_FILE_PICKER: 'documents:open-file-picker',
  DOCUMENTS_OPEN_FOLDER_PICKER: 'documents:open-folder-picker',
  DOCUMENTS_GET_PROTOCOL_URL: 'documents:get-protocol-url',
  DOCUMENTS_READ_FILE: 'documents:read-file',
  DOCUMENTS_OPEN_EXTERNALLY: 'documents:open-externally',

  // Suggestions
  DOCUMENTS_GET_SUGGESTION: 'documents:get-suggestion',
  DOCUMENTS_ACCEPT_SUGGESTION: 'documents:accept-suggestion',
  DOCUMENTS_DISMISS_SUGGESTION: 'documents:dismiss-suggestion',
  DOCUMENTS_ACCEPT_RENAME_SUGGESTION: 'documents:accept-rename-suggestion',
  DOCUMENTS_SUGGEST_FILENAME: 'documents:suggest-filename',
  DOCUMENTS_GET_WITH_SUGGESTIONS: 'documents:get-with-suggestions',
  DOCUMENTS_BATCH_ACCEPT_SUGGESTIONS: 'documents:batch-accept-suggestions',
  DOCUMENTS_GET_SUGGESTION_STATS: 'documents:get-suggestion-stats',

  // Watcher
  WATCHER_SET_FOLDER: 'watcher:set-folder',
  WATCHER_GET_FOLDER: 'watcher:get-folder',
  WATCHER_CLEAR_FOLDER: 'watcher:clear-folder',
  WATCHER_FILE_INGESTED: 'watcher:file-ingested',
  WATCHER_ERROR: 'watcher:error',

  // Workspaces
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_ADD: 'workspace:add',
  WORKSPACE_RENAME: 'workspace:rename',
  WORKSPACE_REMOVE: 'workspace:remove',
  WORKSPACE_SWITCH: 'workspace:switch',
  WORKSPACE_GET_ACTIVE: 'workspace:get-active',
  WORKSPACE_SWITCHED: 'workspace:switched',

  // Backup
  WORKSPACE_BACKUP: 'workspace:backup',
  WORKSPACE_RESTORE: 'workspace:restore',

  // Menu events (main -> renderer)
  MENU_IMPORT_FILES: 'menu:import-files',
  MENU_IMPORT_FOLDER: 'menu:import-folder',
  MENU_BACKUP: 'menu:backup',
  MENU_RESTORE: 'menu:restore',
  MENU_EXPORT_ALL: 'menu:export-all',

  // Ollama
  OLLAMA_CHECK_STATUS: 'ollama:check-status',
  OLLAMA_GET_SETTINGS: 'ollama:get-settings',
  OLLAMA_UPDATE_SETTINGS: 'ollama:update-settings',

  // Ollama events (main -> renderer)
  DOCUMENTS_SUGGESTION_UPDATED: 'documents:suggestion-updated',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE_LAST_VIEW: 'settings:save-last-view',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
