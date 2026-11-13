import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const RESET_WINDOW_MS = 60_000;
const recentRequests = new Map<string, number>();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function getAdminAuth() {
  const app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: requiredEnv('FIREBASE_PROJECT_ID'),
      clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: requiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
  });
  return getAuth(app);
}

function setCors(response: VercelResponse, requestOrigin?: string) {
  const allowedOrigin = requiredEnv('ALLOWED_ORIGIN');
  if (requestOrigin && requestOrigin !== allowedOrigin) return false;
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Vary', 'Origin');
  return true;
}

function getClientKey(request: VercelRequest, email: string) {
  const forwarded = request.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : 'unknown';
  return `${ip}:${email}`;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const previous = recentRequests.get(key);
  if (previous && now - previous < RESET_WINDOW_MS) return true;
  recentRequests.set(key, now);
  for (const [storedKey, timestamp] of recentRequests) {
    if (now - timestamp >= RESET_WINDOW_MS) recentRequests.delete(storedKey);
  }
  return false;
}

function extractOobCode(generatedLink: string) {
  const outer = new URL(generatedLink);
  const directCode = outer.searchParams.get('oobCode');
  if (directCode) return directCode;
  const nestedLink = outer.searchParams.get('link');
  return nestedLink ? new URL(nestedLink).searchParams.get('oobCode') : null;
}

async function sendWithEmailJs(email: string, resetLink: string) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: requiredEnv('EMAILJS_SERVICE_ID'),
      template_id: requiredEnv('EMAILJS_TEMPLATE_ID'),
      user_id: requiredEnv('EMAILJS_PUBLIC_KEY'),
      accessToken: requiredEnv('EMAILJS_PRIVATE_KEY'),
      template_params: {
        to_email: email,
        email,
        user_email: email,
        app_name: 'NutriLab',
        from_name: 'NutriLab',
        reset_link: resetLink,
        link: resetLink,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`EmailJS returned ${response.status}`);
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (!setCors(response, request.headers.origin)) {
      return response.status(403).json({ message: 'Origin tidak diizinkan.' });
    }

    if (request.method === 'OPTIONS') return response.status(204).end();
    if (request.method !== 'POST') return response.status(405).json({ message: 'Method tidak diizinkan.' });

    const rawEmail = typeof request.body?.email === 'string' ? request.body.email : '';
    const email = rawEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return response.status(400).json({ message: 'Format email tidak valid.' });
    }

    if (isRateLimited(getClientKey(request, email))) {
      return response.status(429).json({ message: 'Terlalu banyak permintaan. Coba lagi nanti.' });
    }

    try {
      const resetBaseUrl = requiredEnv('APP_RESET_URL');
      try {
        await getAdminAuth().getUserByEmail(email);
      } catch (error) {
        if ((error as { code?: string }).code === 'auth/user-not-found') {
          return response.status(200).json({
            message: 'Jika email terdaftar, link reset akan dikirim.',
          });
        }
        throw error;
      }

      const generatedLink = await getAdminAuth().generatePasswordResetLink(email, {
        url: resetBaseUrl,
        // We only use Firebase to mint the oobCode; the actual link opens
        // NutriLab's custom page, so an in-app/dynamic link is unnecessary.
        handleCodeInApp: false,
      });
      const oobCode = extractOobCode(generatedLink);
      if (!oobCode) throw new Error('Firebase reset link tidak memiliki oobCode.');
      const resetLink = `${resetBaseUrl}?oobCode=${encodeURIComponent(oobCode)}`;
      await sendWithEmailJs(email, resetLink);
    } catch (error) {
      // Jangan membocorkan apakah email terdaftar atau detail provider ke client.
      if ((error as { code?: string }).code !== 'auth/user-not-found') {
        console.error('Password reset delivery failed:', error);
        return response.status(502).json({ message: 'Email reset belum dapat dikirim.' });
      }
    }

    return response.status(200).json({
      message: 'Jika email terdaftar, link reset akan dikirim.',
    });
  } catch (error) {
    console.error('Password reset endpoint failed:', error);
    return response.status(500).json({ message: 'Layanan reset password belum tersedia.' });
  }
}
