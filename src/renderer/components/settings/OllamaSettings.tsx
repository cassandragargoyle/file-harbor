import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import * as ipc from '../../lib/ipc';
import { cn } from '../../lib/utils';

interface OllamaSettingsState {
  ollamaEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  suggestionConfidenceThreshold: number;
}

interface OllamaModel {
  name: string;
  size: number;
}

export function OllamaSettings() {
  const [settings, setSettings] = useState<OllamaSettingsState | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    ipc.getOllamaSettings().then((s) => {
      if (s) setSettings(s);
    });
    ipc.checkOllamaStatus().then((status) => {
      setReachable(status.reachable);
      setModels(status.models);
    });
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof OllamaSettingsState>(key: K, value: OllamaSettingsState[K]) => {
      const updated = await ipc.updateOllamaSettings({ [key]: value });
      if (updated) setSettings(updated);
    },
    []
  );

  const handleTestConnection = useCallback(async () => {
    if (!settings) return;
    setTesting(true);
    try {
      const status = await ipc.checkOllamaStatus(settings.ollamaBaseUrl);
      setReachable(status.reachable);
      setModels(status.models);
    } finally {
      setTesting(false);
    }
  }, [settings]);

  if (!settings) return null;

  return (
    <section>
      <h3 className="mb-3 text-sm font-medium text-muted">AI Suggestions</h3>
      <div className="space-y-4 rounded-lg border border-border bg-surface/50 p-4">
        {/* Enable toggle */}
        <label className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-accent-fg" />
            <div>
              <p className="text-sm text-secondary">AI-powered suggestions</p>
              <p className="text-xs text-faint">Requires Ollama running locally</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.ollamaEnabled}
            onClick={() => updateSetting('ollamaEnabled', !settings.ollamaEnabled)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              settings.ollamaEnabled ? 'bg-accent' : 'bg-highlight'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                settings.ollamaEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
              )}
            />
          </button>
        </label>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {reachable === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />
          ) : reachable ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-danger" />
          )}
          <span className="text-xs text-faint">
            {reachable === null
              ? 'Checking Ollama...'
              : reachable
                ? `Ollama connected (${models.length} model${models.length !== 1 ? 's' : ''})`
                : 'Ollama not detected'}
          </span>
        </div>

        {/* Model selector */}
        {models.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-faint">Model</p>
            <select
              value={settings.ollamaModel}
              onChange={(e) => updateSetting('ollamaModel', e.target.value)}
              className="w-full rounded-md border border-border bg-base px-3 py-1.5 text-sm text-secondary outline-none focus:border-accent"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
              {/* Include current setting even if not in detected models */}
              {!models.find((m) => m.name === settings.ollamaModel) && (
                <option value={settings.ollamaModel}>
                  {settings.ollamaModel} (not installed)
                </option>
              )}
            </select>
          </div>
        )}

        {/* Advanced section */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-faint hover:text-secondary"
        >
          {showAdvanced ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Advanced
        </button>

        {showAdvanced && (
          <div className="space-y-3 pl-1">
            {/* URL input */}
            <div>
              <p className="mb-1.5 text-xs text-faint">Ollama URL</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.ollamaBaseUrl}
                  onChange={(e) => updateSetting('ollamaBaseUrl', e.target.value)}
                  className="flex-1 rounded-md border border-border bg-base px-3 py-1.5 text-sm text-secondary outline-none focus:border-accent"
                  placeholder="http://localhost:11434"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-1.5 rounded-md bg-elevated px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-highlight hover:text-foreground disabled:opacity-50"
                >
                  {testing && <Loader2 className="h-3 w-3 animate-spin" />}
                  Test
                </button>
              </div>
            </div>

            {/* Confidence threshold */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs text-faint">Keyword confidence threshold</p>
                <span className="text-xs tabular-nums text-secondary">
                  {settings.suggestionConfidenceThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.95"
                step="0.05"
                value={settings.suggestionConfidenceThreshold}
                onChange={(e) =>
                  updateSetting('suggestionConfidenceThreshold', parseFloat(e.target.value))
                }
                className="w-full accent-accent"
              />
              <p className="mt-1 text-xs text-faint">
                Below this, the LLM will be used instead of keyword matching.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
