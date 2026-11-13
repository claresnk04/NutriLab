import {
  EmailAuthProvider,
  GoogleAuthProvider,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export function observeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function register(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const customClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const params: Record<string, string> = { prompt: 'select_account' };
  if (customClientId) {
    params.client_id = customClientId;
  }
  provider.setCustomParameters(params);
  return signInWithPopup(auth, provider);
}

export async function resetPassword(email: string) {
  const apiUrl = import.meta.env.VITE_PASSWORD_RESET_API_URL?.trim().replace(/\/$/, '');
  if (!apiUrl) throw new Error('Layanan reset password belum dikonfigurasi.');

  const response = await fetch(`${apiUrl}/api/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Email reset belum dapat dikirim.');
}

export function verifyResetCode(oobCode: string) {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function completePasswordReset(oobCode: string, newPassword: string) {
  const email = await verifyPasswordResetCode(auth, oobCode);
  await confirmPasswordReset(auth, oobCode, newPassword);
  return signInWithEmailAndPassword(auth, email, newPassword);
}

export function isPasswordProviderUser(user: User | null): boolean {
  if (!user) return false;
  if (!user.providerData || user.providerData.length === 0) return true;
  return user.providerData.some((provider) => provider.providerId === 'password');
}

export function updateAccountName(user: User, displayName: string) {
  return updateProfile(user, { displayName: displayName.trim() });
}

export async function changeAccountPassword(user: User, oldPassword: string, newPassword: string) {
  if (!user.email) {
    throw new Error('Akun ini tidak memiliki email untuk verifikasi password.');
  }
  const credential = EmailAuthProvider.credential(user.email, oldPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export function logout() {
  return signOut(auth);
}
