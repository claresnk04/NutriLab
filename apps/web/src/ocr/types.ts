import type { ExtractionResponse } from '../schemas/extraction';

export interface OcrLine {
  text: string;
  score: number;
  box: [number, number, number, number];
  /** Kemiringan garis teks (dy/dx) bila terdeteksi miring oleh DBNet. */
  slope?: number;
}

export interface OcrProgress {
  phase:
    | 'preparing'
    | 'uploading'
    | 'analyzing'
    | 'validating'
    | 'completed'
    | 'loading-model'
    | 'preprocessing'
    | 'detecting'
    | 'recognizing'
    | 'parsing';
  percent: number;
}

export interface OcrOutput {
  lines: OcrLine[];
  extraction: ExtractionResponse;
  latencyMs: number;
}

export interface OcrModelManifest {
  version: string;
  detector: string;
  recognizer: string;
  dictionary: string;
  detectorInput?: { width: number; height: number };
  recognizerInput?: { width: number; height: number };
}

export interface OcrWorkerRequest {
  type: 'run';
  image: ImageData;
  manifest: OcrModelManifest;
}

export type OcrWorkerResponse =
  | { type: 'progress'; value: OcrProgress }
  | { type: 'result'; value: OcrOutput }
  | { type: 'error'; message: string };
