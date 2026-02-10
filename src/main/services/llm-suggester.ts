import { generateCompletion } from './ollama-service';
import { CATEGORIES } from '../../shared/constants';
import type { Category, SuggestionSource } from '../../shared/types';
import { ollamaLog } from '../lib/logger';

export interface LlmSuggestion {
  category: Category;
  confidence: number;
  filename: string | null;
  source: SuggestionSource;
}

const CATEGORY_LIST = CATEGORIES.join(', ');

function buildPrompt(originalFilename: string, extractedText: string | null): string {
  const textSnippet = (extractedText ?? '').slice(0, 2000);
  return `You are a document filing assistant. Given the following document text, respond with ONLY a JSON object (no markdown, no explanation):

{
  "category": "<one of: ${CATEGORY_LIST}>",
  "confidence": <0.0-1.0>,
  "filename": "<YYYY-MM-DD Description.ext>"
}

Document filename: ${originalFilename}
Document text (first 2000 chars):
${textSnippet}`;
}

function parseResponse(raw: string, originalFilename: string): LlmSuggestion | null {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
    }

    const parsed = JSON.parse(cleaned) as {
      category?: string;
      confidence?: number;
      filename?: string;
    };

    if (!parsed.category || typeof parsed.category !== 'string') return null;

    // Validate category is in our allowed list (case-insensitive match)
    const matchedCategory = CATEGORIES.find(
      (c) => c.toLowerCase() === parsed.category!.toLowerCase()
    );
    if (!matchedCategory) return null;

    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;

    let filename: string | null = null;
    if (parsed.filename && typeof parsed.filename === 'string') {
      const suggested = parsed.filename.trim();
      // Only use if it looks different from the original
      if (suggested && suggested !== originalFilename) {
        filename = suggested;
      }
    }

    return {
      category: matchedCategory,
      confidence: Math.round(confidence * 100) / 100,
      filename,
      source: 'ollama',
    };
  } catch {
    ollamaLog.warn('Failed to parse LLM suggestion response');
    return null;
  }
}

export async function suggestWithLlm(
  extractedText: string | null,
  originalFilename: string
): Promise<LlmSuggestion | null> {
  const prompt = buildPrompt(originalFilename, extractedText);
  const raw = await generateCompletion(prompt);
  if (!raw) return null;
  return parseResponse(raw, originalFilename);
}
