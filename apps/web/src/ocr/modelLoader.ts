import * as ort from 'onnxruntime-web';
import type { OcrModelManifest } from './types';

ort.env.wasm.numThreads = 1;
// OCR sudah berjalan dalam Web Worker; proxy tambahan hanya menambah peak memory.
ort.env.wasm.proxy = false;

export interface OcrSessions {
  detector: ort.InferenceSession;
  recognizer: ort.InferenceSession;
  dictionary: string[];
}

const defaultBase = '/models/ocr/ppocrv6-tiny';

export function getModelManifest(): OcrModelManifest {
  const base = import.meta.env.VITE_OCR_MODEL_BASE_URL ?? defaultBase;
  return {
    version: 'ppocrv6-tiny-v1',
    detector: `${base}/det.onnx`,
    recognizer: `${base}/rec.onnx`,
    dictionary: `${base}/rec_dict.txt`,
    detectorInput: { width: 736, height: 736 },
    recognizerInput: { width: 320, height: 48 },
  };
}

async function loadDictionary(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Kamus OCR tidak dapat dimuat (${response.status}).`);
  return (await response.text()).split(/\r?\n/).filter(Boolean);
}

export async function loadOcrSessions(manifest = getModelManifest()): Promise<OcrSessions> {
  // Muat berurutan agar dua graph ONNX tidak melakukan inisialisasi bersamaan.
  const detector = await ort.InferenceSession.create(manifest.detector, {
    executionProviders: ['wasm'],
  });
  const recognizer = await ort.InferenceSession.create(manifest.recognizer, {
    executionProviders: ['wasm'],
  });
  const dictionary = await loadDictionary(manifest.dictionary);
  return { detector, recognizer, dictionary };
}
