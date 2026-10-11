import { useEffect } from 'react';
import { useAuth } from './auth';
import { Shell } from './components/Shell';
import Wireframe from './wireframe/Wireframe';
import LoginPage from './pages/Login';
import QueuePage from './pages/Queue';
import CallersPage from './pages/Callers';
import InsightsPage from './pages/Insights';
import SetupPage from './pages/Setup';
import { Redirect, linkClick, useLocation } from './router';

export default function App() {
  const { path } = useLocation();
  const isApp = path !== '/';

  // Dashboard type scales with the screen (readable from the back of a room).
  // Scoped to app routes so the landing page keeps its own sizing.
  useEffect(() => {
    document.documentElement.classList.toggle('rung-app', isApp);
  }, [isApp]);

  if (path === '/') return <Wireframe />;
  // The wireframe became the home page; keep old /wireframe links working.
  if (path === '/wireframe') return <Redirect to="/" />;
  if (path === '/login') return <LoginPage />;
  if (path === '/queue' || path === '/setup' || path === '/callers' || path === '/insights') return <Protected path={path} />;
  return <NotFound />;
}

function Protected({ path }: { path: '/queue' | '/setup' | '/callers' | '/insights' }) {
  const { ready, session, me, meError, refreshMe, signOut } = useAuth();

  if (!ready) return <Splash />;
  if (!session) return <Redirect to="/login" />;
  if (!me) {
    if (meError) {
      return (
        <div className="app">
          <div className="page-pad">
            <p className="banner" role="alert">
              Couldn't load your account. {meError}
            </p>
            <div className="inline">
              <button type="button" className="btn" onClick={() => void refreshMe()}>
                Retry
              </button>
              <button type="button" className="btn" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <Splash />;
  }
  if (path !== '/setup' && !me.org) return <Redirect to="/setup" />;

  return (
    <div className="app">
      <Shell path={path}>{path === '/queue' ? <QueuePage /> : path === '/callers' ? <CallersPage /> : path === '/insights' ? <InsightsPage /> : <SetupPage />}</Shell>
    </div>
  );
}

function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <span className="wordmark wordmark-lg">Rung</span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="splash">
      <div>
        <p className="wordmark wordmark-lg">404</p>
        <p>
          <a href="/" onClick={linkClick}>
            Back to Rung
          </a>
        </p>
      </div>
    </div>
  );
}
