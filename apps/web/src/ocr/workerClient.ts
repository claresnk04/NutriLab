import type { OcrOutput, OcrProgress, OcrWorkerResponse } from './types';
import { getModelManifest } from './modelLoader';

export interface OcrRunHandlers {
  onProgress?: (progress: OcrProgress) => void;
}

let sharedWorker: Worker | null = null;

function getSharedWorker(): Worker {
  sharedWorker ??= new Worker(new URL('./ocrWorker.ts', import.meta.url), { type: 'module' });
  return sharedWorker;
}

function resetSharedWorker() {
  sharedWorker?.terminate();
  sharedWorker = null;
}

export function runClientOcr(image: ImageData, handlers: OcrRunHandlers = {}) {
  const worker = getSharedWorker();
  // Salin buffer piksel sebelum di-transfer ke Worker agar ImageData milik pemanggil tidak detached.
  const cloned = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);

  return new Promise<OcrOutput>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<OcrWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') handlers.onProgress?.(message.value);
      if (message.type === 'error') {
        reject(new Error(message.message));
      }
      if (message.type === 'result') {
        resolve(message.value);
      }
    };
    worker.onerror = () => {
      resetSharedWorker();
      reject(new Error('Worker OCR tidak dapat dijalankan.'));
    };
    worker.postMessage({ type: 'run', image: cloned, manifest: getModelManifest() }, [
      cloned.data.buffer as ArrayBuffer,
    ]);
  });
}
