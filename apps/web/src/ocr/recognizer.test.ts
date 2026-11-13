import { describe, expect, it } from 'vitest';
import type { Tensor } from 'onnxruntime-web';
import { decodeCtc } from './recognizer';

describe('decodeCtc', () => {
  it('memetakan blank dan seluruh karakter dictionary tanpa off-by-one', () => {
    const tensor = {
      dims: [1, 3, 3],
      data: new Float32Array([0.1, 0.8, 0.1, 0.9, 0.05, 0.05, 0.1, 0.1, 0.8]),
    } as unknown as Tensor;

    expect(decodeCtc(tensor, ['A', 'B']).text).toBe('AB');
  });

  it('memetakan kelas dictionary.length + 1 menjadi karakter spasi sesuai CTCLabelDecode', () => {
    // dictionary = ['5', 'g'] (length = 2) -> class 0 = blank, 1 = '5', 2 = 'g', 3 = ' '
    const tensor = {
      dims: [1, 3, 4],
      data: new Float32Array([
        0.05,
        0.9,
        0.02,
        0.03, // '5' (class 1)
        0.05,
        0.02,
        0.03,
        0.9, // ' ' (class 3 = dictionary.length + 1)
        0.05,
        0.02,
        0.9,
        0.03, // 'g' (class 2)
      ]),
    } as unknown as Tensor;

    expect(decodeCtc(tensor, ['5', 'g']).text).toBe('5 g');
  });
});
