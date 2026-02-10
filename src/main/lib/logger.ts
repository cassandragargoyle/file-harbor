import log from 'electron-log';

log.transports.console.level = 'info';
log.transports.file.level = 'info';

export const mainLog = log.scope('main');
export const ipcLog = log.scope('ipc');
export const dbLog = log.scope('db');
export const fileLog = log.scope('file');
export const watcherLog = log.scope('watcher');
export const ollamaLog = log.scope('ollama');
