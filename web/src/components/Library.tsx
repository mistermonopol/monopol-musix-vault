import { useCallback, useEffect, useState } from 'react';
import { ApiError, listTracks, scanLibrary } from '../lib/api';
import { formatDuration, initials } from '../lib/format';
import type { Track, User } from '../lib/types';

const PAGE_SIZE = 50;

interface LibraryProps {
  readonly user: User;
  readonly onLogout: () => void;
  readonly onPlay: (track: Track) => void;
  readonly currentTrack: Track | null;
}

export function Library({ user, onLogout, onPlay, currentTrack }: LibraryProps) {
  const [tracks, setTracks] = useState<readonly Track[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (search: string, signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const page = await listTracks(search, PAGE_SIZE, 0, signal);
      setTracks(page.tracks);
      setTotal(page.total);
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof ApiError ? caught.message : 'Could not load your library.');
    } finally { if (signal?.aborted !== true) setLoading(false); }
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await listTracks(query, PAGE_SIZE, tracks.length);
      setTracks((current) => [...current, ...page.tracks]);
      setTotal(page.total);
    } catch (caught: unknown) {
      setNotice(caught instanceof ApiError ? caught.message : 'Could not load more tracks.');
    } finally { setLoadingMore(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(query, controller.signal), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, query]);

  async function scan() {
    setScanning(true); setNotice(null);
    try {
      const result = await scanLibrary();
      setNotice(`Scan ${result.status}: ${result.processed} processed, ${result.failed} failed.`);
      await load(query);
    } catch (caught: unknown) {
      setNotice(caught instanceof ApiError ? caught.message : 'Scan could not be completed.');
    } finally { setScanning(false); }
  }

  return <main className="library-shell">
    <header className="topbar">
      <a className="wordmark" href="#library" aria-label="Monopol Musix Vault home"><span className="brand-dot">m</span><b>MONOPOL</b><span>MUSIX VAULT</span></a>
      <div className="account"><span>{user.email}</span><button type="button" onClick={onLogout}>Sign out</button></div>
    </header>
    <section className="hero" id="library">
      <p className="eyebrow">Your collection</p>
      <h1>Library</h1>
      <p>Every record. Every late night. All in one place.</p>
    </section>
    <section className="library-panel" aria-labelledby="tracks-heading">
      <div className="toolbar">
        <div className="search"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="track-search">Search your library</label><input id="track-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tracks, artists, albums…" /></div>
        <button className="secondary" type="button" disabled={scanning} onClick={() => void scan()}>{scanning ? 'Scanning…' : '↻  Scan library'}</button>
      </div>
      {notice !== null && <p className="notice" role="status">{notice}</p>}
      <div className="section-title"><h2 id="tracks-heading">Tracks</h2>{!loading && error === null && <span>{total} {total === 1 ? 'track' : 'tracks'}</span>}</div>
      {loading ? <TrackSkeleton /> : error !== null ? <State icon="!" title="Library unavailable" copy={error} action={<button className="secondary" onClick={() => void load(query)}>Try again</button>} /> : tracks.length === 0 ? <State icon="♫" title={query ? 'No matches found' : 'Your library is quiet'} copy={query ? 'Try a different title, artist, or album.' : 'Run a scan to discover music on your server.'} action={!query ? <button className="primary" disabled={scanning} onClick={() => void scan()}>Scan library</button> : undefined} /> : <>
        <div className="track-list" role="list">
          {tracks.map((track, index) => <button className={`track-row ${currentTrack?.id === track.id ? 'selected' : ''}`} type="button" role="listitem" key={track.id} onClick={() => onPlay(track)} aria-label={`Play ${track.title} by ${track.artists.join(', ') || 'Unknown artist'}`}>
            <span className="track-number">{currentTrack?.id === track.id ? '▶' : index + 1}</span><span className="track-art">{initials(track.title)}</span><span className="track-main"><strong>{track.title}</strong><span>{track.artists.join(', ') || 'Unknown artist'}</span></span><span className="track-album">{track.album ?? 'Unknown album'}</span><span className="track-year">{track.year ?? '—'}</span><span className="track-duration">{formatDuration(track.durationSeconds)}</span>
          </button>)}
        </div>
        {tracks.length < total && <div className="load-more"><button className="secondary" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : `Load more (${tracks.length} of ${total})`}</button></div>}
      </>}
    </section>
  </main>;
}

function State({ icon, title, copy, action }: { readonly icon: string; readonly title: string; readonly copy: string; readonly action?: React.ReactNode }) {
  return <div className="state"><span className="state-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{copy}</p>{action}</div>;
}

function TrackSkeleton() {
  return <div className="skeletons" aria-label="Loading tracks" aria-busy="true">{[1, 2, 3, 4, 5].map((item) => <div className="skeleton" key={item}><i /><span /><b /></div>)}</div>;
}
