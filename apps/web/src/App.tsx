import { Navigate, Route, Routes } from 'react-router';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import ScanPage from './pages/ScanPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import OnboardingPage from './pages/OnboardingPage';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import EvaluationPage from './pages/EvaluationPage';
import { ConsentRequiredRoute, ProtectedRoute, PublicOnlyRoute } from './auth/routeGuards';

/**
 * Peta rute (PRD v1.1 bagian 7 dan 8.1).
 * Alur pengguna baru: /onboarding + persetujuan (F-01) -> /auth (F-02) -> profil opsional (F-03) -> Home.
 * Browser tanpa persetujuan selalu diarahkan ke /onboarding; /auth hanya terbuka setelah setuju.
 * Tautan konfirmasi email lupa kata sandi mengarah ke /reset-password?oobCode=...
 */
export default function App() {
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<PublicOnlyRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<ConsentRequiredRoute />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route index element={<HomePage />} />
        <Route path="riwayat" element={<HistoryPage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="evaluasi" element={<EvaluationPage />} />
        <Route path="evaluation" element={<EvaluationPage />} />
        <Route path="analitik" element={<AnalyticsPage />} />
        <Route path="profil" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
