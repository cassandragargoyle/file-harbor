import { ollamaLog } from '../lib/logger';
import { getOllamaSettings } from '../lib/settings';

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface OllamaStatus {
  reachable: boolean;
  models: OllamaModel[];
}

export async function checkOllamaStatus(baseUrl?: string): Promise<OllamaStatus> {
  const url = baseUrl ?? getOllamaSettings().ollamaBaseUrl;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { reachable: false, models: [] };
    }

    const data = (await response.json()) as { models?: OllamaModel[] };
    const models = (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
    }));

    ollamaLog.info(`Ollama detected at ${url} with ${models.length} model(s)`);
    return { reachable: true, models };
  } catch {
    ollamaLog.info(`Ollama not reachable at ${url}`);
    return { reachable: false, models: [] };
  }
}

export async function generateCompletion(
  prompt: string,
  baseUrl?: string,
  model?: string
): Promise<string | null> {
  const settings = getOllamaSettings();
  const url = baseUrl ?? settings.ollamaBaseUrl;
  const modelName = model ?? settings.ollamaModel;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      ollamaLog.warn(`Ollama generate failed with status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { response?: string };
    return data.response ?? null;
  } catch (err) {
    ollamaLog.warn('Ollama generate request failed:', err);
    return null;
  }
}
