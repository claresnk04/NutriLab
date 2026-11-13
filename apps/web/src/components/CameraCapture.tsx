import { useEffect, useRef, useState } from 'react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onError: (message: string) => void;
}

const MAX_CAPTURE_DIMENSION = 1280;

export default function CameraCapture({ onCapture, onError }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }

  async function startCamera(mode = facingMode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError('Browser ini tidak mendukung kamera langsung. Gunakan pilihan upload foto.');
      return;
    }

    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: MAX_CAPTURE_DIMENSION, max: MAX_CAPTURE_DIMENSION },
          height: { ideal: MAX_CAPTURE_DIMENSION, max: MAX_CAPTURE_DIMENSION },
        },
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setActive(true);
    } catch {
      stopCamera();
      onError('Kamera tidak dapat diakses. Periksa izin kamera atau gunakan upload foto.');
    }
  }

  async function switchCamera() {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      onError('Kamera belum siap. Tunggu sebentar lalu coba lagi.');
      return;
    }

    const scale = Math.min(
      1,
      MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      onError('Canvas kamera tidak tersedia di browser ini.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onError('Foto kamera gagal dibuat. Coba lagi.');
          return;
        }
        onCapture(new File([blob], 'label-camera.jpg', { type: 'image/jpeg' }));
        stopCamera();
      },
      'image/jpeg',
      0.9,
    );
  }

  useEffect(() => stopCamera, []);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Kamera aplikasi</h3>
          <p className="text-sm text-slate-600">
            Foto dibatasi maksimal 1280 px agar lebih ringan.
          </p>
        </div>
        {!active && (
          <button
            className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
            type="button"
            onClick={() => void startCamera()}
          >
            Buka kamera
          </button>
        )}
      </div>
      <video
        ref={videoRef}
        className="max-h-80 w-full rounded-xl bg-black object-contain"
        autoPlay
        playsInline
        muted
        hidden={!active}
        aria-label="Pratinjau kamera"
      />
      {active && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={capturePhoto}
            >
              Ambil foto
            </button>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="button"
              onClick={() => void switchCamera()}
            >
              Ganti kamera
            </button>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="button"
              onClick={stopCamera}
            >
              Tutup kamera
            </button>
          </div>
        </>
      )}
    </div>
  );
}
