import { Navigate, Outlet, useLocation } from 'react-router';
import { hasConsent } from '../lib/consent';
import { useAuth } from './useAuth';

/** Halaman utama: belum login → onboarding (jika belum setuju) atau halaman auth. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="p-6 text-slate-600">Memuat sesi…</p>;
  }
  if (!user) {
    return hasConsent()
      ? <Navigate to="/auth" replace state={{ from: location.pathname }} />
      : <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}

/** Halaman publik (onboarding & auth): pengguna yang sudah login langsung ke Home. */
export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-slate-600">Memuat sesi…</p>;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

/** Halaman auth hanya dapat dibuka setelah pengguna menyetujui persetujuan di onboarding. */
export function ConsentRequiredRoute() {
  return hasConsent() ? <Outlet /> : <Navigate to="/onboarding" replace />;
}
