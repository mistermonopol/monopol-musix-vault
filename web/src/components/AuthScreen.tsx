import { useState, type FormEvent } from 'react';
import { ApiError, authenticate } from '../lib/api';
import type { AuthSession } from '../lib/types';

interface AuthScreenProps { readonly onAuthenticated: (session: AuthSession) => void; }

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try { onAuthenticated(await authenticate(mode, email, password, accessCode)); }
    catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach your vault. Try again.');
    } finally { setSubmitting(false); }
  }

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="brand-mark" aria-hidden="true"><span>m</span></div>
      <p className="eyebrow">Monopol Musix</p>
      <h1 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Open your vault.'}</h1>
      <p className="auth-copy">{mode === 'login' ? 'Your private collection, exactly where you left it.' : 'Create the first administrator account for this vault.'}</p>
      <div className="mode-switch" role="group" aria-label="Authentication mode">
        <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>Sign in</button>
        <button className={mode === 'bootstrap' ? 'active' : ''} type="button" onClick={() => setMode('bootstrap')}>First setup</button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label>Email<input autoComplete="email" inputMode="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={12} maxLength={128} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /></label>
        <label>Access Code<input aria-describedby="access-code-help" autoComplete="off" required type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} /></label>
        <p className="field-help" id="access-code-help">Enter the server access code. It is kept only for this browser tab and is never used in audio stream requests.</p>
        {error !== null && <p className="form-error" role="alert">{error}</p>}
        <button className="primary wide" disabled={submitting} type="submit">{submitting ? 'Opening…' : mode === 'login' ? 'Enter vault' : 'Create vault'}</button>
      </form>
      <p className="privacy-note">Private by design · Streamed from your server</p>
    </section>
  </main>;
}
