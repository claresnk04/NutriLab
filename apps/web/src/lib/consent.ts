const CONSENT_KEY = 'nutrilab.consent.v1';

/** Persetujuan onboarding disimpan per-browser agar pengguna baru selalu melewati onboarding lebih dulu. */
export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

export function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, 'accepted');
  } catch {
    /* penyimpanan tidak tersedia; alur tetap lanjut di sesi ini */
  }
}
