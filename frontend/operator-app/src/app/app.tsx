import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
// Side-effect import: applies the persisted light/dark theme to <html>
// before first paint, even on routes with no themed component mounted.
import '../store/theme.store.js';
import { AppLayout } from '../components/layout/AppLayout.js';
import { PageLoading } from '../components/common/PageLoading.js';
import { ProtectedRoute } from '../components/common/ProtectedRoute.js';
import { UpdatePrompt } from '../components/common/UpdatePrompt.js';
import TicketDetailPage from '../pages/TicketDetailPage.js';
import TicketsPage from '../pages/TicketsPage.js';

// Everything but the ticket list/detail (the landing experience on every
// login) is code-split — these were previously eager imports here, which
// meant every operator downloaded the knowledge-base rich-text editor, the
// analytics dashboard, and the trash page on first load whether they ever
// visited them or not. Lazy here plus the same treatment in SettingsModal/
// ReportsHubModal (each pulling in 7-9 more pages) is what was actually
// inflating the single main JS chunk past the 500kB warning threshold.
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage.js'));
const KnowledgeEditorPage = lazy(() => import('../pages/KnowledgeEditorPage.js'));
const KnowledgeListPage = lazy(() => import('../pages/KnowledgeListPage.js'));
const SearchResultsPage = lazy(() => import('../pages/SearchResultsPage.js'));
const TrashPage = lazy(() => import('../pages/TrashPage.js'));

export function App() {
  return (
    <>
      {/* Rendered outside ProtectedRoute so the service worker registers
          (and update prompts surface) regardless of auth state. There's no
          /login route here at all — client-portal's /login is the one
          shared login page for every role; ProtectedRoute bounces an
          unauthenticated visitor there with a real page navigation. */}
      <UpdatePrompt />
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/tickets" replace />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
            <Route path="/search" element={<Suspense fallback={<PageLoading />}><SearchResultsPage /></Suspense>} />
            <Route path="/knowledge" element={<Suspense fallback={<PageLoading />}><KnowledgeListPage /></Suspense>} />
            <Route
              path="/knowledge/new"
              element={<Suspense fallback={<PageLoading />}><KnowledgeEditorPage /></Suspense>}
            />
            <Route
              path="/knowledge/:articleId"
              element={<Suspense fallback={<PageLoading />}><KnowledgeEditorPage /></Suspense>}
            />
            <Route path="/analytics" element={<Suspense fallback={<PageLoading />}><AnalyticsPage /></Suspense>} />

            {/* Корзина is staff-wide (operator + admin), same as the
                backend's @Roles(OPERATOR, ADMIN) on /tickets/trash. */}
            <Route path="/trash" element={<Suspense fallback={<PageLoading />}><TrashPage /></Suspense>} />

            {/* SLA-политики/Макросы/Кастомные поля/Диспетчер/Пользователи/
                Отчёты moved into modals (SettingsModal/ReportsHubModal,
                opened from IconRail) — no standalone routes for them
                anymore, one nav path instead of two. */}
          </Route>

          {/* Nested under ProtectedRoute (not a top-level sibling) so an
              unauthenticated visit here goes through ProtectedRoute's own
              exit-the-app redirect first, instead of bouncing to "/" and
              re-entering the ProtectedRoute tree from scratch. A path this
              app doesn't own (like /login, which only exists in
              client-portal's bundle) only reaches this catch-all when
              Vite's dev-server SPA fallback serves this bundle for it
              directly — real prod's nginx never does that, /login is a
              different app entirely. With the catch-all outside
              ProtectedRoute, that combination was an infinite loop:
              catch-all -> "/" -> ProtectedRoute (no token) -> real
              navigation back to /login -> catch-all again. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
