import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: electron
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const map: Record<string, string> = {
        userData: '/tmp/file-harbor-test/userData',
        documents: '/tmp/file-harbor-test/documents',
      };
      return map[name] ?? `/tmp/file-harbor-test/${name}`;
    }),
    getAppPath: vi.fn(() => process.cwd()),
    isPackaged: false,
  },
}));

// ---------------------------------------------------------------------------
// Mock: electron-log
// ---------------------------------------------------------------------------
const noopLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
};

vi.mock('electron-log', () => ({
  default: {
    transports: {
      console: { level: 'info' },
      file: { level: 'info' },
    },
    scope: vi.fn(() => ({ ...noopLog })),
    ...noopLog,
  },
}));
