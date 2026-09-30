import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Footer, Nav } from '@/components/Nav';
import { ToastHost } from '@/components/ui';
import { NexaProvider } from '@/store/AppContext';
import Home from '@/pages/Home';

const Atlas = lazy(() => import('@/pages/Atlas'));
const Districts = lazy(() => import('@/pages/Districts'));
const DistrictDetail = lazy(() => import('@/pages/DistrictDetail'));
const Sectors = lazy(() => import('@/pages/Sectors'));
const SectorDetail = lazy(() => import('@/pages/SectorDetail'));
const Solutions = lazy(() => import('@/pages/Solutions'));
const Report = lazy(() => import('@/pages/Report'));
const Insights = lazy(() => import('@/pages/Insights'));
const Ask = lazy(() => import('@/pages/Ask'));
const Settings = lazy(() => import('@/pages/Settings'));
const About = lazy(() => import('@/pages/About'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/** The theme is applied by the inline script in index.html before paint. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // The chat view manages its own scroll container.
    if (pathname !== '/ask') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '58vh', gap: 12 }}>
      <span className="spinner" style={{ width: 26, height: 26 }} />
      <span className="tiny muted">Loading…</span>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const isChat = pathname === '/ask';

  return (
    <>
      <Nav />
      <main id="main" style={{ minHeight: '58vh' }}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/atlas" element={<Atlas />} />
            <Route path="/districts" element={<Districts />} />
            <Route path="/districts/:id" element={<DistrictDetail />} />
            <Route path="/sectors" element={<Sectors />} />
            <Route path="/sectors/:id" element={<SectorDetail />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/report" element={<Report />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isChat && <Footer />}
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    // BASE_URL is "/" for a user site and "/<repo>/" for a GitHub Pages
    // project site; without it every client route would 404.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NexaProvider>
        <ScrollToTop />
        <Shell />
      </NexaProvider>
    </BrowserRouter>
  );
}