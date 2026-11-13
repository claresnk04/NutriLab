import * as ort from 'onnxruntime-web';

interface LetterboxResult {
  image: ImageData;
  scale: number;
  offsetX: number;
  offsetY: number;
}

function createCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Peregangan kontras adaptif berbasis persentil (1% - 99% luminans)
 * untuk mengatasi foto label yang redup, pudar, atau berkilau ringan.
 */
export function enhanceContrast(image: ImageData): ImageData {
  const { width, height, data } = image;
  const pixelCount = width * height;
  if (pixelCount === 0) return new ImageData(new Uint8ClampedArray(data), width, height);

  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[Math.max(0, Math.min(255, lum))] += 1;
  }

  const lowTarget = Math.floor(pixelCount * 0.01);
  const highTarget = Math.ceil(pixelCount * 0.99);
  let cumulative = 0;
  let low = 0;
  let high = 255;

  for (let i = 0; i < 256; i += 1) {
    cumulative += histogram[i];
    if (cumulative >= lowTarget) {
      low = i;
      break;
    }
  }

  cumulative = 0;
  for (let i = 0; i < 256; i += 1) {
    cumulative += histogram[i];
    if (cumulative >= highTarget) {
      high = i;
      break;
    }
  }

  const range = high - low;
  if (range < 20 || range >= 250) {
    return new ImageData(new Uint8ClampedArray(data), width, height);
  }

  const scale = 255 / range;
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    output[i] = Math.max(0, Math.min(255, Math.round((data[i] - low) * scale)));
    output[i + 1] = Math.max(0, Math.min(255, Math.round((data[i + 1] - low) * scale)));
    output[i + 2] = Math.max(0, Math.min(255, Math.round((data[i + 2] - low) * scale)));
    output[i + 3] = 255;
  }
  return new ImageData(output, width, height);
}

function resizeDetectorImage(image: ImageData, width: number, height: number): LetterboxResult {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = Math.max(1, Math.round(image.width * scale));
  const drawHeight = Math.max(1, Math.round(image.height * scale));
  const offsetX = Math.floor((width - drawWidth) / 2);
  const offsetY = Math.floor((height - drawHeight) / 2);

  const source = createCanvas(image.width, image.height);
  const context = source.getContext('2d');
  const target = createCanvas(width, height);
  const targetContext = target.getContext('2d');

  if (context && targetContext) {
    context.putImageData(image, 0, 0);
    targetContext.fillStyle = '#000000';
    targetContext.fillRect(0, 0, width, height);
    targetContext.imageSmoothingQuality = 'high';
    targetContext.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
    return {
      image: targetContext.getImageData(0, 0, width, height),
      scale,
      offsetX,
      offsetY,
    };
  }

  // Fallback interpolasi piksel murni bila Canvas 2D tidak tersedia (mis. lingkungan test Node/jsdom).
  const output = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < output.length; i += 4) output[i] = 255;
  for (let y = 0; y < drawHeight; y += 1) {
    const srcY = Math.min(image.height - 1, Math.floor((y * image.height) / drawHeight));
    for (let x = 0; x < drawWidth; x += 1) {
      const srcX = Math.min(image.width - 1, Math.floor((x * image.width) / drawWidth));
      const srcIdx = (srcY * image.width + srcX) * 4;
      const dstIdx = ((y + offsetY) * width + (x + offsetX)) * 4;
      output[dstIdx] = image.data[srcIdx];
      output[dstIdx + 1] = image.data[srcIdx + 1];
      output[dstIdx + 2] = image.data[srcIdx + 2];
    }
  }
  return {
    image: new ImageData(output, width, height),
    scale,
    offsetX,
    offsetY,
  };
}

/**
 * Resize khusus `RecResizeImg` PaddleOCR (PP-OCRv6_tiny_rec) dengan interpolasi bilinear:
 * - Tinggi selalu diskalakan penuh ke `height` (48px) dengan menjaga rasio aspek.
 * - Rata kiri (`offsetX = 0, offsetY = 0`) dan sisa ruang di sebelah kanan diisi padding hitam.
 */
export function resizeRecognizerImage(image: ImageData, width: number, height: number): ImageData {
  const aspect = image.width / Math.max(1, image.height);
  const drawWidth = Math.min(width, Math.max(1, Math.round(height * aspect)));
  const drawHeight = height;

  const output = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < output.length; i += 4) {
    output[i] = 255;
  }

  for (let y = 0; y < drawHeight; y += 1) {
    const sy = ((y + 0.5) * image.height) / drawHeight - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(image.height - 1, y0 + 1);
    const wy = Math.max(0, sy - y0);
    for (let x = 0; x < drawWidth; x += 1) {
      const sx = ((x + 0.5) * image.width) / drawWidth - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(image.width - 1, x0 + 1);
      const wx = Math.max(0, sx - x0);
      const dstIdx = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const v00 = image.data[(y0 * image.width + x0) * 4 + c];
        const v01 = image.data[(y0 * image.width + x1) * 4 + c];
        const v10 = image.data[(y1 * image.width + x0) * 4 + c];
        const v11 = image.data[(y1 * image.width + x1) * 4 + c];
        const val = (1 - wy) * ((1 - wx) * v00 + wx * v01) + wy * ((1 - wx) * v10 + wx * v11);
        output[dstIdx + c] = Math.round(val);
      }
      output[dstIdx + 3] = 255;
    }
  }
  return new ImageData(output, width, height);
}

export function imageToTensor(image: ImageData, width: number, height: number) {
  const resized = resizeRecognizerImage(image, width, height);
  const values = new Float32Array(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = y * width + x;
      // PP-OCR preprocessing uses BGR input normalized to [-1, 1], while ImageData is RGBA.
      values[target] = resized.data[source + 2] / 127.5 - 1;
      values[width * height + target] = resized.data[source + 1] / 127.5 - 1;
      values[2 * width * height + target] = resized.data[source] / 127.5 - 1;
    }
  }
  return new ort.Tensor('float32', values, [1, 3, height, width]);
}

export function imageToDetectorTensor(image: ImageData, width: number, height: number) {
  const enhanced = enhanceContrast(image);
  const resized = resizeDetectorImage(enhanced, width, height);
  const pixels = resized.image;
  const values = new Float32Array(width * height * 3);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = y * width + x;
      values[target] = (pixels.data[source + 2] / 255 - mean[0]) / std[0];
      values[width * height + target] = (pixels.data[source + 1] / 255 - mean[1]) / std[1];
      values[2 * width * height + target] = (pixels.data[source] / 255 - mean[2]) / std[2];
    }
  }
  return {
    tensor: new ort.Tensor('float32', values, [1, 3, height, width]),
    scale: resized.scale,
    offsetX: resized.offsetX,
    offsetY: resized.offsetY,
  };
}

export function expandBox(
  box: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
  ratio = 1.08,
): [number, number, number, number] {
  const [x0, y0, x1, y1] = box;
  const width = (x1 - x0) * ratio;
  const height = (y1 - y0) * ratio;
  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;
  return [
    Math.max(0, centerX - width / 2),
    Math.max(0, centerY - height / 2),
    Math.min(imageWidth, centerX + width / 2),
    Math.min(imageHeight, centerY + height / 2),
  ];
}

/**
 * Potong area gambar mengikuti kemiringan baris (`slope = dy/dx`).
 * Bila `slope = 0`, bekerja identik dengan crop persegi biasa.
 */
export function cropImage(
  image: ImageData,
  box: [number, number, number, number],
  slope = 0,
): ImageData {
  const [x0, y0, x1, y1] = box;
  const width = Math.max(1, Math.round(Math.min(image.width, x1) - Math.max(0, x0)));
  const height = Math.max(1, Math.round(Math.min(image.height, y1) - Math.max(0, y0)));
  const startX = Math.max(0, Math.round(x0));
  const yCenterLeft = (y0 + y1) / 2;
  const output = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.max(0, startX + x));
      const yCenterAtX = yCenterLeft + slope * x;
      const sourceY = Math.min(
        image.height - 1,
        Math.max(0, Math.round(yCenterAtX - height / 2 + y)),
      );
      const source = (sourceY * image.width + sourceX) * 4;
      const target = (y * width + x) * 4;
      output[target] = image.data[source];
      output[target + 1] = image.data[source + 1];
      output[target + 2] = image.data[source + 2];
      output[target + 3] = 255;
    }
  }
  return new ImageData(output, width, height);
}
