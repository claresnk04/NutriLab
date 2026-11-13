import type { Tensor } from 'onnxruntime-web';
import type { OcrSessions } from './modelLoader';
import type { OcrLine } from './types';
import { cropImage, enhanceContrast, expandBox, imageToTensor } from './preprocess';

function firstTensor(outputs: Record<string, Tensor>) {
  const tensor =
    Object.values(outputs).find(
      (candidate) => candidate.dims.length === 3 && Number(candidate.dims.at(-1)) > 100,
    ) ?? Object.values(outputs)[0];
  if (!tensor) throw new Error('Model recognition tidak mengembalikan output.');
  return tensor;
}

/**
 * Dekode output CTCLabelDecode PaddleOCR:
 * - indeks 0: blank CTC
 * - indeks 1..dictionary.length: karakter pada rec_dict.txt
 * - indeks dictionary.length + 1: karakter spasi (' ') bila use_space_char aktif
 */
export function decodeCtc(tensor: Tensor, dictionary: string[]) {
  const values = tensor.data as Float32Array;
  const dimensions = tensor.dims.map(Number);
  const time = dimensions.at(-2) ?? 0;
  const classes = dimensions.at(-1) ?? 0;
  const spaceClassIndex = dictionary.length + 1;
  let previous = -1;
  let text = '';
  let total = 0;
  let count = 0;

  for (let index = 0; index < time; index += 1) {
    let best = 0;
    let bestValue = -Infinity;
    for (let klass = 0; klass < classes; klass += 1) {
      const value = values[index * classes + klass] ?? -Infinity;
      if (value > bestValue) {
        bestValue = value;
        best = klass;
      }
    }
    if (best === previous) continue;
    previous = best;
    if (best <= 0) continue;
    if (best === spaceClassIndex) {
      text += ' ';
      total += bestValue;
      count += 1;
      continue;
    }
    if (best > dictionary.length) continue;
    text += dictionary[best - 1] ?? '';
    total += bestValue;
    count += 1;
  }
  return {
    text: text.replace(/\s+/g, ' ').trim(),
    score: count ? Math.max(0, Math.min(1, total / count)) : 0,
  };
}

export async function recognizeLines(image: ImageData, lines: OcrLine[], sessions: OcrSessions) {
  const enhanced = enhanceContrast(image);
  const inputName = sessions.recognizer.inputNames[0];
  const output: OcrLine[] = [];
  for (const line of lines) {
    const expanded =
      line.slope !== undefined
        ? line.box
        : expandBox(line.box, enhanced.width, enhanced.height, 1.04);
    const boxWidth = expanded[2] - expanded[0];
    const boxHeight = expanded[3] - expanded[1];
    if (boxWidth < 3 || boxHeight < 3) continue;
    const crop = cropImage(enhanced, expanded, line.slope ?? 0);
    const result = await sessions.recognizer.run({
      [inputName]: imageToTensor(crop, 320, 48),
    });
    const decoded = decodeCtc(firstTensor(result), sessions.dictionary);
    output.push({ ...line, text: decoded.text, score: decoded.score || line.score });
  }
  return output.filter((line) => line.text.trim().length > 0);
}
