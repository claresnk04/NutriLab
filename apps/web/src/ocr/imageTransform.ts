const MAX_IMAGE_DIMENSION = 1600;

export async function blobToImageData(blob: Blob, rotation = 0) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const quarterTurns = ((rotation % 360) + 360) % 360;
  const swap = quarterTurns === 90 || quarterTurns === 270;
  const orientedWidth = swap ? bitmap.height : bitmap.width;
  const orientedHeight = swap ? bitmap.width : bitmap.height;
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(orientedWidth, orientedHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(orientedWidth * scale));
  canvas.height = Math.max(1, Math.round(orientedHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas tidak tersedia.');
  context.imageSmoothingQuality = 'high';
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((quarterTurns * Math.PI) / 180);
  context.drawImage(
    bitmap,
    (-bitmap.width * scale) / 2,
    (-bitmap.height * scale) / 2,
    bitmap.width * scale,
    bitmap.height * scale,
  );
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
