import { loadOcrSessions } from './modelLoader';
import { detectText } from './detector';
import { recognizeLines } from './recognizer';
import { parseNutritionLines } from './parser';
import type { OcrWorkerRequest } from './types';

let sessionsPromise: ReturnType<typeof loadOcrSessions> | null = null;

self.onmessage = async (event: MessageEvent<OcrWorkerRequest>) => {
  if (event.data.type !== 'run') return;
  const started = performance.now();
  try {
    self.postMessage({ type: 'progress', value: { phase: 'loading-model', percent: 10 } });
    sessionsPromise ??= loadOcrSessions(event.data.manifest);
    const sessions = await sessionsPromise;
    self.postMessage({ type: 'progress', value: { phase: 'preprocessing', percent: 25 } });
    self.postMessage({ type: 'progress', value: { phase: 'detecting', percent: 45 } });
    const detected = await detectText(event.data.image, sessions);
    self.postMessage({ type: 'progress', value: { phase: 'recognizing', percent: 70 } });
    const lines = await recognizeLines(event.data.image, detected, sessions);
    self.postMessage({ type: 'progress', value: { phase: 'parsing', percent: 88 } });
    const extraction = parseNutritionLines(lines);
    self.postMessage({
      type: 'result',
      value: { lines, extraction, latencyMs: Math.round(performance.now() - started) },
    });
    self.postMessage({ type: 'progress', value: { phase: 'completed', percent: 100 } });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'OCR gagal.',
    });
  }
};
