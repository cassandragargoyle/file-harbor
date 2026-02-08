import { parentPort } from 'node:worker_threads';
import fs from 'node:fs/promises';

import { MAX_EXTRACTED_TEXT_LENGTH } from '../../shared/constants';

interface ExtractionJob {
  filePath: string;
  documentId: string;
}

interface ExtractionResult {
  documentId: string;
  text: string | null;
  error?: string;
}

parentPort?.on('message', async (job: ExtractionJob) => {
  const result: ExtractionResult = { documentId: job.documentId, text: null };

  try {
    const buffer = await fs.readFile(job.filePath);
    const { extractText } = await import('unpdf');
    const { text } = await extractText(buffer);

    if (text && text.trim().length > 0) {
      result.text =
        text.length > MAX_EXTRACTED_TEXT_LENGTH
          ? text.slice(0, MAX_EXTRACTED_TEXT_LENGTH)
          : text;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  parentPort?.postMessage(result);
});
