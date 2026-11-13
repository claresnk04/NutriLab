import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-nutri-lab.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-nutri-lab',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:000000000000:web:0000000000000000',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
};

export const useEmulators =
  env.VITE_USE_EMULATORS === 'true' && env.MODE !== 'production' && env.MODE !== 'test';

export const app: FirebaseApp = initializeApp(firebaseConfig);

// App Check: membatasi pemanggilan layanan hanya dari aplikasi sah (aktif di produksi bila site key diisi).
if (env.VITE_APPCHECK_SITE_KEY && env.MODE === 'production') {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth: Auth = getAuth(app);

// Cache luring persisten agar Home dan Riwayat dapat dibuka tanpa koneksi (PRD 9.14).
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
}
