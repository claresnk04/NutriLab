import { create } from 'zustand';
import type { ExtractionResponse } from '../schemas/extraction';

/** Tahapan alur pemindaian (PRD 8.2). */
export type ScanStep = 'capture' | 'extracting' | 'validate' | 'result';

interface ScanState {
  step: ScanStep;
  image: Blob | null;
  extraction: ExtractionResponse | null;
  setImage: (image: Blob) => void;
  setExtraction: (extraction: ExtractionResponse) => void;
  setStep: (step: ScanStep) => void;
  reset: () => void;
}

const initialState = { step: 'capture' as ScanStep, image: null, extraction: null };

export const useScanStore = create<ScanState>()((set) => ({
  ...initialState,
  setImage: (image) => set({ image, step: 'extracting' }),
  setExtraction: (extraction) => set({ extraction, step: 'validate' }),
  setStep: (step) => set({ step }),
  reset: () => set(initialState),
}));
