import { useEffect, useRef, useState } from 'react';
import { ApiError, getArtworkLookupStatus, startArtworkLookup, syncObsidianBrain } from '../lib/api';
import { THEMES, type ThemeDefinition, type ThemePath } from '../lib/themes';
import type { ArtworkLookupProgress, BrainSyncResult, User } from '../lib/types';
import type { UiSettings } from '../lib/uiSettings';
import type { VaultView } from './VaultViews';

interface SettingsViewProps {
  readonly user: User;
  readonly theme: ThemeDefinition;
  readonly uiSettings: UiSettings;
  readonly onUiSettingsChange: (settings: UiSettings) => void;
  readonly onThemeChange: (path: ThemePath) => void;
  readonly onNavigate: (view: VaultView) => void;
  readonly onLibraryRefresh: () => void;
}

export function SettingsView({ user, theme, uiSettings, onUiSettingsChange, onThemeChange, onNavigate, onLibraryRefresh }: SettingsViewProps) {
  const isAdmin = user.role === 'admin';
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<BrainSyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [artworkStatus, setArtworkStatus] = useState<ArtworkLookupProgress | null>(null);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [retryArtwork, setRetryArtwork] = useState(false);
  const sawRunningArtwork = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void getArtworkLookupStatus().then((status) => {
      if (!active) return;
      setArtworkStatus(status);
      sawRunningArtwork.current = status.state === 'running';
    }).catch((error: unknown) => {
      if (active) setArtworkError(apiMessage(error, 'Artwork lookup status could not be loaded.'));
    });
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || artworkStatus?.state !== 'running') return;
    sawRunningArtwork.current = true;
    const timer = window.setInterval(() => {
      void getArtworkLookupStatus().then((status) => {
        setArtworkStatus(status);
        setArtworkError(null);
        if (status.state === 'completed' && sawRunningArtwork.current) {
          sawRunningArtwork.current = false;
          onLibraryRefresh();
        }
      }).catch((error: unknown) => setArtworkError(apiMessage(error, 'Artwork lookup status could not be updated.')));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [artworkStatus?.state, isAdmin, onLibraryRefresh]);

  async function syncBrain() {
    setSyncing(true); setResult(null); setSyncError(null);
    try { setResult(await syncObsidianBrain()); }
    catch (error: unknown) { setSyncError(apiMessage(error, 'Brain sync could not be completed.')); }
    finally { setSyncing(false); }
  }

  async function lookupArtwork() {
    setArtworkError(null);
    try {
      sawRunningArtwork.current = true;
      setArtworkStatus(await startArtworkLookup(retryArtwork));
    } catch (error: unknown) {
      sawRunningArtwork.current = false;
      setArtworkError(apiMessage(error, 'Artwork lookup could not be started.'));
    }
  }

  return <main className="vault-view settings-view">
    <header><p className="kicker">Vault preferences</p><h1>Settings</h1></header>
    <div className="settings-grid">
      <section className="settings-card" aria-labelledby="account-heading">
        <h2 id="account-heading">Account</h2>
        <dl className="settings-details">
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Role</dt><dd>{user.role ?? 'member'}</dd></div>
        </dl>
        <p className="settings-help">{isAdmin ? 'Your administrator role allows library and Brain maintenance.' : 'Your role has access to personal settings and vault views. Administrative actions are hidden.'}</p>
      </section>

      <section className="settings-card" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <label className="settings-field">Theme
          <select value={theme.path} onChange={(event) => onThemeChange(event.target.value as ThemePath)}>
            {THEMES.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
          </select>
        </label>
        <label className="toggle-setting"><input type="checkbox" checked={uiSettings.denseLayout} onChange={(event) => onUiSettingsChange({ ...uiSettings, denseLayout: event.target.checked })} /><span><strong>Dense layout</strong><small>Use tighter spacing in vault lists and panels. Saved in this browser.</small></span></label>
      </section>

      <section className="settings-card" aria-labelledby="api-heading">
        <h2 id="api-heading">API connection</h2>
        <dl className="settings-details">
          <div><dt>Browser route</dt><dd><code>/api</code></dd></div>
          <div><dt>Transport</dt><dd>Same origin</dd></div>
          <div><dt>Session</dt><dd>Authenticated</dd></div>
        </dl>
        <p className="settings-help">Only public routing information is shown. Access codes, tokens, cookies, and server configuration are never displayed here.</p>
      </section>

      {isAdmin ? <section className="settings-card admin-card" aria-labelledby="admin-heading">
        <p className="kicker">Role restricted</p><h2 id="admin-heading">Admin</h2>
        <p className="settings-help">Run role-restricted library maintenance and publish current music metadata to the Brain.</p>
        <div className="admin-operation">
          <h3>Missing cover artwork</h3>
          <p className="settings-help">Look up covers for albums that currently have no artwork. The lookup continues on the server if you leave Settings.</p>
          <label className="toggle-setting"><input type="checkbox" checked={retryArtwork} disabled={artworkStatus?.state === 'running'} onChange={(event) => setRetryArtwork(event.target.checked)} /><span><strong>Retry previous attempts</strong><small>Reconsider albums already checked by an earlier lookup.</small></span></label>
          <div className="settings-actions"><button className="primary" type="button" disabled={artworkStatus?.state === 'running'} onClick={() => void lookupArtwork()}>{artworkStatus?.state === 'running' ? 'Looking up covers…' : 'Start cover lookup'}</button></div>
          <div aria-live="polite">
            {artworkError && <p className="form-error" role="alert">{artworkError}</p>}
            {artworkStatus && <div className="artwork-lookup-status"><p className="notice">Status: <strong>{artworkStatus.state}</strong></p><dl className="sync-counts artwork-counts"><Count label="queued" value={artworkStatus.queued} /><Count label="attempted" value={artworkStatus.attempted} /><Count label="matched" value={artworkStatus.matched} /><Count label="applied" value={artworkStatus.coversApplied} /><Count label="failed" value={artworkStatus.failed} /><Count label="updated tracks" value={artworkStatus.tracksUpdated} /></dl>{artworkStatus.errors.length > 0 && <><h3>Lookup errors ({artworkStatus.errors.length})</h3><ul className="lookup-errors">{artworkStatus.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></>}</div>}
          </div>
        </div>
        <div className="admin-operation"><h3>Brain metadata</h3><div className="settings-actions"><button className="brain-button" type="button" disabled={syncing} onClick={() => void syncBrain()}>{syncing ? 'Syncing…' : '◇ Brain Sync'}</button><button className="secondary" type="button" onClick={() => onNavigate('brain')}>Open Brain graph</button></div></div>
        <div aria-live="polite">
          {syncError && <p className="form-error" role="alert">{syncError}</p>}
          {result && <div className="sync-result"><h3>Sync complete</h3><dl className="sync-counts">{Object.entries(result.counts).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl>{result.errors.length > 0 ? <><h3>Errors ({result.errors.length})</h3><ul>{result.errors.map((error, index) => <li key={`${index}-${error.message}`}>{error.message}</li>)}</ul></> : <p className="notice">No sync errors reported.</p>}<button className="secondary" type="button" onClick={() => onNavigate('brain')}>Refresh in Brain</button></div>}
        </div>
      </section> : null}
    </div>
  </main>;
}

function Count({ label, value }: { readonly label: string; readonly value: number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
