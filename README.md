# Nutri-lab

Pemeriksa kecocokan gizi produk kemasan untuk penyandang diabetes melitus tipe 2.
Aplikasi dibuat sebagai Progressive Web App (PWA). Spesifikasi produk ada di [PRD_Nutri-lab_v1_1.md](./PRD_Nutri-lab_v1_1.md).

> Status: **MVP client-side**. OCR berjalan di browser melalui Web Worker dan ONNX Runtime Web.

## Struktur

```
apps/web/           React + TypeScript + Vite + PWA (klien)
packages/scoring/   Mesin penilaian rule-based (PRD bagian 10), murni TypeScript
tools/ocr-conversion/  Workflow konversi model Paddle ke ONNX (build-time saja)
firebase/           firebase.json, Firestore rules & indexes, tes rules
.github/workflows/  CI (lint, test, build)
```

```
PWA ──(Auth, Firestore)──▶ Firebase
PWA ──▶ Web Worker + ONNX Runtime Web (OCR lokal)
PWA ──▶ packages/scoring (penilaian dihitung di klien)
```

## Prasyarat

| Alat | Versi |
| --- | --- |
| Node.js | 22 LTS |
| Python | 3.12 (hanya untuk konversi model, opsional) |
| Java | 11+ (untuk Firebase Emulator) |
| Firebase CLI | `npm i -g firebase-tools` |

## Mulai

```powershell
# 1. Dependensi JavaScript (semua workspace)
npm install

# 2. Konfigurasi klien Firebase
Copy-Item apps/web/.env.example apps/web/.env.local
```

## Menjalankan secara lokal

```powershell
npm run emulators                     # Firebase Auth (9099) + Firestore (8081), UI di http://localhost:4000
npm run dev                           # PWA di http://localhost:5173
```

## Pengujian & kualitas kode

```powershell
npm run lint                 # ESLint (web + scoring)
npm run format:check         # Prettier
npm test                     # Vitest + React Testing Library
npm run test:rules           # Firestore Security Rules (emulator)
npm run build                # Build produksi PWA

tools/ocr-conversion/.venv/Scripts/python tools/ocr-conversion/convert_models.py
```

## Deployment Firebase

```powershell
npm run build
Copy-Item apps/web/dist/* firebase/public -Recurse -Force
firebase deploy --config firebase/firebase.json --project nutrilab-68a03 --only hosting,firestore
```
