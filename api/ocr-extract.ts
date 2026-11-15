import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  GEMINI_MODEL_CHAIN,
  GROQ_MODEL_CHAIN,
  runGeminiOcrServer,
  runGroqOcrServer,
} from './ocr-shared.js';

type Provider = 'gemini' | 'groq';
type RequestBody = {
  provider?: unknown;
  imageBase64?: unknown;
  mimeType?: unknown;
};

const MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024;
const OCR_WINDOW_MS = 60_000;
const recentRequests = new Map<string, number>();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function optionalEnv(name: string) {
  return process.env[name]?.trim() || '';
}

function getAdminAuth() {
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: requiredEnv('FIREBASE_PROJECT_ID'),
        clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
        privateKey: requiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
    });
  return getAuth(app);
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function setCors(response: VercelResponse, requestOrigin?: string) {
  const origins = allowedOrigins();
  if (requestOrigin && !origins.includes(requestOrigin)) return false;
  if (requestOrigin) response.setHeader('Access-Control-Allow-Origin', requestOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Vary', 'Origin');
  return true;
}

function requestIp(request: VercelRequest) {
  const forwarded = request.headers['x-forwarded-for'];
  return typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() || 'unknown' : 'unknown';
}

function isRateLimited(key: string) {
  const now = Date.now();
  const previous = recentRequests.get(key);
  if (previous && now - previous < OCR_WINDOW_MS) return true;
  recentRequests.set(key, now);
  for (const [storedKey, timestamp] of recentRequests) {
    if (now - timestamp >= OCR_WINDOW_MS) recentRequests.delete(storedKey);
  }
  return false;
}

function parseBody(request: VercelRequest): RequestBody {
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body) as RequestBody;
    } catch {
      throw new Error('Invalid JSON body.');
    }
  }
  return (request.body ?? {}) as RequestBody;
}

function modelChain(primary: string, defaults: readonly string[]) {
  return [...new Set([primary, ...defaults])];
}

function bearerToken(request: VercelRequest) {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (!setCors(response, request.headers.origin)) {
      return response.status(403).json({ message: 'Origin tidak diizinkan.' });
    }

    if (request.method === 'OPTIONS') return response.status(204).end();
    if (request.method !== 'POST') {
      return response.status(405).json({ message: 'Method tidak diizinkan.' });
    }

    const token = bearerToken(request);
    if (!token) return response.status(401).json({ message: 'Autentikasi diperlukan.' });

    let decodedToken: { uid: string };
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch {
      return response.status(401).json({ message: 'Sesi login tidak valid.' });
    }

    if (isRateLimited(`${decodedToken.uid}:${requestIp(request)}`)) {
      return response.status(429).json({ message: 'Terlalu banyak permintaan. Coba lagi nanti.' });
    }

    const body = parseBody(request);
    const provider = body.provider;
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';

    if (provider !== 'gemini' && provider !== 'groq') {
      return response.status(400).json({ message: 'Provider OCR tidak valid.' });
    }
    if (mimeType !== 'image/jpeg') {
      return response.status(400).json({ message: 'Format gambar tidak didukung.' });
    }
    if (!imageBase64 || imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return response.status(413).json({ message: 'Ukuran gambar terlalu besar.' });
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) {
      return response.status(400).json({ message: 'Data gambar tidak valid.' });
    }

    const result =
      provider === 'gemini'
        ? await runGeminiOcrServer(
            imageBase64,
            requiredEnv('GEMINI_API_KEY'),
            modelChain(optionalEnv('GEMINI_MODEL'), GEMINI_MODEL_CHAIN),
          )
        : await runGroqOcrServer(
            imageBase64,
            requiredEnv('GROQ_API_KEY'),
            modelChain(optionalEnv('GROQ_MODEL'), GROQ_MODEL_CHAIN),
          );

    return response.status(200).json({ extraction: result, modelUsed: result.modelUsed });
  } catch (error) {
    console.error('OCR proxy failed:', error);
    return response.status(502).json({ message: 'Analisis label belum dapat dilakukan.' });
  }
}
