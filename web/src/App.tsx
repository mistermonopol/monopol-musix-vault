import { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { DesignMenu } from './components/DesignMenu';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { hasSavedSession, logout, refreshSession, subscribeToSession } from './lib/api';
import { getSavedThemePath, resolveThemePath, saveThemePath, themeForPath, type ThemePath } from './lib/themes';
import type { AuthSession, Track } from './lib/types';


export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [restoring, setRestoring] = useState(hasSavedSession());
  const [track, setTrack] = useState<Track | null>(null);
  const [path, setPath] = useState<ThemePath>(() =>
    resolveThemePath(window.location.pathname, getSavedThemePath()),
  );
  const theme = themeForPath(path);

  const navigate = useCallback((nextPath: ThemePath) => {
    if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath);
    saveThemePath(nextPath); setPath(nextPath);
  }, []);

  useEffect(() => {
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path);
    }
    saveThemePath(path);
  }, [path]);
  useEffect(() => {
    const onPopState = () => {
      const nextPath = resolveThemePath(window.location.pathname, getSavedThemePath());
      if (nextPath !== window.location.pathname) window.history.replaceState(null, '', nextPath);
      saveThemePath(nextPath); setPath(nextPath);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => subscribeToSession(setSession), []);
  useEffect(() => {
    if (!hasSavedSession()) { setRestoring(false); return; }
    void refreshSession().then(setSession).catch(() => setSession(null)).finally(() => setRestoring(false));
  }, []);

  if (restoring) return <main className="boot" aria-label="Restoring session"><div className="brand-mark"><span>m</span></div><p>Opening your vault…</p></main>;
  if (session === null) return <><AuthScreen onAuthenticated={setSession} /><DesignMenu activePath={path} onNavigate={navigate} /></>;
  return <div className={`app theme-${theme.id}`}><Library user={session.user} theme={theme} currentTrack={track} onPlay={setTrack} onLogout={() => void logout().finally(() => { setSession(null); setTrack(null); })} /><Player track={track} theme={theme.id} /><DesignMenu activePath={path} onNavigate={navigate} /></div>;
}
