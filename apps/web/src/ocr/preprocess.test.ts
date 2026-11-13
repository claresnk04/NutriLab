import { describe, expect, it } from 'vitest';
import { enhanceContrast, expandBox, resizeRecognizerImage } from './preprocess';
import { computeUnclipPadding } from './detector';

describe('expandBox', () => {
  it('memperluas box dan tetap berada dalam batas gambar', () => {
    expect(expandBox([0, 0, 20, 10], 100, 80, 1.4)).toEqual([0, 0, 24, 12]);
    expect(expandBox([90, 70, 100, 80], 100, 80, 1.4)).toEqual([88, 68, 100, 80]);
  });
});

describe('resizeRecognizerImage', () => {
  it('menempatkan potongan teks rata kiri (offsetX = 0) dengan tinggi 48px penuh dan padding kanan hitam', () => {
    const srcWidth = 20;
    const srcHeight = 10;
    const srcData = new Uint8ClampedArray(srcWidth * srcHeight * 4);
    for (let i = 0; i < srcData.length; i += 4) {
      srcData[i] = 255;
      srcData[i + 1] = 255;
      srcData[i + 2] = 255;
      srcData[i + 3] = 255;
    }
    const resized = resizeRecognizerImage(new ImageData(srcData, srcWidth, srcHeight), 320, 48);

    expect(resized.width).toBe(320);
    expect(resized.height).toBe(48);
    // Piksel kiri atas (x = 0, y = 0) harus berisi gambar putih (255), bukan padding hitam.
    expect(resized.data[0]).toBe(255);
    // Lebar ter-skala = 48 * (20 / 10) = 96px -> piksel di kanan jauh (x = 200) harus padding hitam (0).
    const rightIdx = (0 * 320 + 200) * 4;
    expect(resized.data[rightIdx]).toBe(0);
  });
});

describe('enhanceContrast', () => {
  it('meregangkan rentang luminans sempit menjadi kontras penuh', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      const value = i < 50 ? 90 : 140;
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
    const enhanced = enhanceContrast(new ImageData(data, width, height));
    expect(enhanced.data[0]).toBe(0);
    expect(enhanced.data[(width * height - 1) * 4]).toBe(255);
  });
});

describe('computeUnclipPadding', () => {
  it('menghitung jarak unclip proporsional tanpa membengkakkan teks panjang secara berlebihan', () => {
    const pad = computeUnclipPadding(200, 20, 1.6);
    // (200 * 20 * 1.6) / (2 * 220) = 6400 / 440 ≈ 14.54px (bukan +80px seperti 200 * 0.4).
    expect(pad).toBeGreaterThan(14);
    expect(pad).toBeLessThan(15);
  });
});
