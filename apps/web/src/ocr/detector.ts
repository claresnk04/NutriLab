import type { Tensor } from 'onnxruntime-web';
import type { OcrLine } from './types';
import { expandBox, imageToDetectorTensor } from './preprocess';
import type { OcrSessions } from './modelLoader';

function firstTensor(outputs: Record<string, Tensor>) {
  const tensor = Object.values(outputs)[0];
  if (!tensor) throw new Error('Model detection tidak mengembalikan output.');
  return tensor;
}

/**
 * Hitung jarak ekspansi kotak sesuai rumus DBPostProcess:
 * distance = (area * unclipRatio) / perimeter.
 */
export function computeUnclipPadding(width: number, height: number, unclipRatio = 1.6): number {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return (w * h * unclipRatio) / (2 * (w + h));
}

interface RawComponent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scoreAverage: number;
  slope: number | null;
  pixels: Array<[number, number]>;
}

/** Decoder untuk output peta probabilitas DBNet (PP-OCRv6_tiny_det) dengan kompensasi kemiringan tabel. */
export async function detectText(image: ImageData, sessions: OcrSessions) {
  const width = 736;
  const height = 736;
  const inputName = sessions.detector.inputNames[0];
  const prepared = imageToDetectorTensor(image, width, height);
  const output = await sessions.detector.run({ [inputName]: prepared.tensor });
  const tensor = firstTensor(output);
  const values = tensor.data as Float32Array;
  const shape = tensor.dims;
  const mapHeight = Number(shape.at(-2) ?? height);
  const mapWidth = Number(shape.at(-1) ?? width);
  const threshold = 0.2;
  const boxThreshold = 0.35;
  const unclipRatio = 1.6;
  const visited = new Uint8Array(mapWidth * mapHeight);
  const components: RawComponent[] = [];
  const candidateSlopes: number[] = [];

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const index = y * mapWidth + x;
      if (visited[index] || (values[index] ?? 0) <= threshold) continue;
      const queue = [index];
      visited[index] = 1;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let count = 0;
      let score = 0;
      let sumX = 0;
      let sumY = 0;
      let sumXX = 0;
      let sumXY = 0;
      const pixels: Array<[number, number]> = [];

      while (queue.length) {
        const current = queue.pop() ?? 0;
        const currentX = current % mapWidth;
        const currentY = Math.floor(current / mapWidth);
        const value = values[current] ?? 0;
        minX = Math.min(minX, currentX);
        minY = Math.min(minY, currentY);
        maxX = Math.max(maxX, currentX);
        maxY = Math.max(maxY, currentY);
        score += value;
        count += 1;
        sumX += currentX;
        sumY += currentY;
        sumXX += currentX * currentX;
        sumXY += currentX * currentY;
        pixels.push([currentX, currentY]);

        for (const [nextX, nextY] of [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
        ]) {
          if (nextX < 0 || nextY < 0 || nextX >= mapWidth || nextY >= mapHeight) continue;
          const next = nextY * mapWidth + nextX;
          if (!visited[next] && (values[next] ?? 0) > threshold) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }

      if (count >= Math.max(4, (mapWidth * mapHeight) / 100000)) {
        const scoreAverage = score / count;
        if (scoreAverage < boxThreshold) continue;
        const bw = maxX - minX;
        const bh = maxY - minY;
        let slope: number | null = null;
        if (count >= 25 && bw >= 35 && bw > bh * 1.4) {
          const denom = count * sumXX - sumX * sumX;
          if (denom > 0) {
            const s = (count * sumXY - sumX * sumY) / denom;
            if (Math.abs(s) <= 0.35) {
              slope = s;
              if (count >= 30 && bw >= 60 && bw > bh * 1.6) {
                candidateSlopes.push(s);
              }
            }
          }
        }
        components.push({ minX, maxX, minY, maxY, scoreAverage, slope, pixels });
      }
    }
  }

  candidateSlopes.sort((a, b) => a - b);
  const globalSlope =
    candidateSlopes.length >= 2
      ? (candidateSlopes[Math.floor(candidateSlopes.length / 2)] ?? 0)
      : 0;
  const tableSlope = Math.abs(globalSlope) >= 0.015 ? globalSlope : 0;

  const scaleX = width / mapWidth;
  const scaleY = height / mapHeight;
  const detected: OcrLine[] = [];

  const isLowRes = prepared.scale >= 1;

  for (const comp of components) {
    const lineSlope =
      !isLowRes && comp.slope !== null && Math.abs(comp.slope - tableSlope) <= 0.055
        ? comp.slope
        : tableSlope;
    let minYAtLeft = comp.minY;
    let maxYAtLeft = comp.maxY;
    if (lineSlope !== 0 && comp.maxX - comp.minX >= 35) {
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [px, py] of comp.pixels) {
        const deTiltedY = py - lineSlope * (px - comp.minX);
        if (deTiltedY < y0) y0 = deTiltedY;
        if (deTiltedY > y1) y1 = deTiltedY;
      }
      minYAtLeft = y0;
      maxYAtLeft = y1;
    }

    const inputMinX = comp.minX * scaleX;
    const inputMinY = minYAtLeft * scaleY;
    const inputMaxX = (comp.maxX + 1) * scaleX;
    const inputMaxY = (maxYAtLeft + 1) * scaleY;
    const sourceMinX = (inputMinX - prepared.offsetX) / prepared.scale;
    const sourceMinY = (inputMinY - prepared.offsetY) / prepared.scale;
    const sourceMaxX = (inputMaxX - prepared.offsetX) / prepared.scale;
    const sourceMaxY = (inputMaxY - prepared.offsetY) / prepared.scale;
    const rawWidth = Math.max(1, sourceMaxX - sourceMinX);
    const rawHeight = Math.max(1, sourceMaxY - sourceMinY);
    const unclipPad = computeUnclipPadding(rawWidth, rawHeight, unclipRatio);
    const padX = isLowRes && image.height <= 450 ? unclipPad : Math.min(10, Math.max(3, unclipPad));
    const padY = isLowRes
      ? image.height <= 450
        ? unclipPad
        : Math.min(4.2, unclipPad)
      : Math.min(4.5, Math.max(2, rawHeight * 0.22 + 1.5));

    detected.push({
      text: '',
      score: comp.scoreAverage,
      slope: lineSlope,
      box: [
        Math.max(0, sourceMinX - padX),
        Math.max(0, sourceMinY - padY),
        Math.min(image.width, sourceMaxX + padX),
        Math.min(image.height, sourceMaxY + padY),
      ],
    });
  }

  // Tambahkan strip baris / kolom nilai untuk baris label gizi di kolom kiri
  // agar angka yang terlewat atau menyatu secara vertikal pada detektor tetap terbaca akurat.
  if (detected.length >= 3) {
    const leftEdges = detected.map((d) => d.box[0]).sort((a, b) => a - b);
    const rightEdges = detected.map((d) => d.box[2]).sort((a, b) => a - b);
    const tableLeftX = leftEdges[Math.floor(leftEdges.length * 0.08)] ?? 0;
    const tableRightX = Math.min(
      image.width - 2,
      rightEdges[Math.floor(rightEdges.length * 0.92)] ?? image.width,
    );
    const tableWidth = Math.max(1, tableRightX - tableLeftX);
    const rowStrips: OcrLine[] = [];

    for (const item of detected) {
      const [x0, y0, x1, y1] = item.box;
      const w = x1 - x0;
      const h = y1 - y0;
      if (
        x0 <= tableLeftX + tableWidth * 0.28 &&
        x1 < tableRightX - tableWidth * 0.15 &&
        w >= 14 &&
        h >= 10 &&
        h <= image.height * 0.12
      ) {
        if (tableRightX - x0 <= 240) {
          if (w >= 42) {
            const cy = (y0 + y1) / 2;
            const tightHalf = Math.max(5.5, h * 0.36);
            rowStrips.push({
              text: '',
              score: item.score,
              slope: item.slope ?? tableSlope,
              box: [x0, cy - tightHalf, tableRightX, cy + tightHalf],
            });
          }
          const extraY = image.height <= 450 ? 0 : w >= 42 ? 1.5 : 0.3;
          rowStrips.push({
            text: '',
            score: item.score,
            slope: item.slope ?? tableSlope,
            box: expandBox(
              [x0, Math.max(0, y0 - extraY), tableRightX, Math.min(image.height, y1 + extraY)],
              image.width,
              image.height,
              1.04,
            ),
          });
        } else {
          const stripSlope = item.slope || tableSlope;
          item.slope = stripSlope;
          const valX0 = Math.max(x1 + 2, tableLeftX + tableWidth * 0.6);
          if (tableRightX - valX0 >= 30) {
            const dy = stripSlope * (valX0 - x0);
            const cy = (y0 + y1) / 2 + dy;
            const halfH = Math.max(7.5, h * 0.42);
            rowStrips.push({
              text: '',
              score: item.score,
              slope: stripSlope,
              box: [
                valX0,
                Math.max(0, cy - halfH),
                tableRightX,
                Math.min(image.height, cy + halfH),
              ],
            });
          }
        }
      }
    }
    detected.push(...rowStrips);
  }

  return detected.sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]).slice(0, 200);
}
