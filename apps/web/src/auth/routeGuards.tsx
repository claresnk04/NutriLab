import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="p-6 text-slate-600">Memuat sesi…</p>;
  }
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-slate-600">Memuat sesi…</p>;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}
