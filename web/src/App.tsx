import { useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { hasSavedSession, logout, refreshSession, sendTokenToServiceWorker, subscribeToSession } from './lib/api';
import type { AuthSession, Track } from './lib/types';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [restoring, setRestoring] = useState(hasSavedSession());
  const [track, setTrack] = useState<Track | null>(null);

  useEffect(() => subscribeToSession(setSession), []);
  useEffect(() => {
    if (!hasSavedSession()) { setRestoring(false); return; }
    void refreshSession().then(setSession).catch(() => setSession(null)).finally(() => setRestoring(false));
  }, []);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'object' || event.data === null) return;
      const type = (event.data as { type?: unknown }).type;
      if (type === 'AUTH_REQUIRED') void refreshSession().catch(() => setSession(null));
      if (type === 'AUTH_TOKEN_REQUEST' && session !== null) void sendTokenToServiceWorker(session.accessToken);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [session]);

  if (restoring) return <main className="boot" aria-label="Restoring session"><div className="brand-mark"><span>m</span></div><p>Opening your vault…</p></main>;
  if (session === null) return <AuthScreen onAuthenticated={setSession} />;
  return <>
    <Library user={session.user} currentTrack={track} onPlay={setTrack} onLogout={() => void logout().finally(() => { setSession(null); setTrack(null); })} />
    <Player track={track} />
  </>;
}
