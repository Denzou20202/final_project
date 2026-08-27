import { Navigate, Route, Routes } from 'react-router-dom';
// Side-effect import: applies the persisted light/dark theme to <html>
// before first paint, even on routes with no themed component mounted
// (login, register, public FAQ).
import '../store/theme.store.js';
import { AppLayout } from '../components/layout/AppLayout.js';
import { ProtectedRoute } from '../components/common/ProtectedRoute.js';
import FaqArticlePage from '../pages/FaqArticlePage.js';
import FaqPage from '../pages/FaqPage.js';
import LoginPage from '../pages/LoginPage.js';
import NewTicketPage from '../pages/NewTicketPage.js';
import OidcCallbackPage from '../pages/OidcCallbackPage.js';
import RegisterPage from '../pages/RegisterPage.js';
import TicketDetailPage from '../pages/TicketDetailPage.js';
import TicketsPage from '../pages/TicketsPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<OidcCallbackPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/faq/:articleId" element={<FaqArticlePage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/new" element={<NewTicketPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
        </Route>

        {/* Nested under ProtectedRoute (not a top-level sibling) so a staff
            token visiting a path this app doesn't own goes through
            ProtectedRoute's own cross-app redirect first, instead of
            bouncing to "/" and re-entering the ProtectedRoute tree from
            scratch. See operator-app/src/app/app.tsx's identical fix for
            the full loop mechanism this avoids. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
