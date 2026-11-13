import { Navigate, Route, Routes } from 'react-router';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import ScanPage from './pages/ScanPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import OnboardingPage from './pages/OnboardingPage';
import AuthPage from './pages/AuthPage';
import { ProtectedRoute, PublicOnlyRoute } from './auth/routeGuards';

/**
 * Peta rute (PRD v1.1 bagian 7 dan 8.1).
 * Alur pengguna baru: /onboarding (F-01) -> /auth (F-02) -> profil opsional (F-03) -> Home.
 * Guard autentikasi/persetujuan ditambahkan saat pengembangan fitur.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/auth" element={<AuthPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="riwayat" element={<HistoryPage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="analitik" element={<AnalyticsPage />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
