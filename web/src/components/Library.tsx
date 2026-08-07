import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiError, listTracks, scanLibrary } from '../lib/api';
import { formatDuration } from '../lib/format';
import type { ThemeDefinition } from '../lib/themes';
import type { Track, User } from '../lib/types';
import { Artwork } from './Artwork';

const PAGE_SIZE = 50;

interface LibraryProps {
  readonly user: User;
  readonly theme: ThemeDefinition;
  readonly onLogout: () => void;
  readonly onPlay: (track: Track) => void;
  readonly currentTrack: Track | null;
}

export function Library({ user, theme, onLogout, onPlay, currentTrack }: LibraryProps) {
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
      setTracks(page.tracks); setTotal(page.total);
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof ApiError ? caught.message : 'Could not load your library.');
    } finally { if (signal?.aborted !== true) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(query, controller.signal), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, query]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await listTracks(query, PAGE_SIZE, tracks.length);
      setTracks((current) => [...current, ...page.tracks]); setTotal(page.total);
    } catch (caught: unknown) {
      setNotice(caught instanceof ApiError ? caught.message : 'Could not load more tracks.');
    } finally { setLoadingMore(false); }
  }

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

  const controls = <LibraryControls query={query} onQuery={setQuery} scanning={scanning} onScan={() => void scan()} />;
  const results = loading ? <TrackSkeleton /> : error !== null
    ? <State title="Library unavailable" copy={error} action={<button className="secondary" onClick={() => void load(query)}>Try again</button>} />
    : tracks.length === 0
      ? <State title={query ? 'No matches found' : 'Your library is quiet'} copy={query ? 'Try another title, artist, or album.' : 'Run a scan to discover music on your server.'} action={!query ? <button className="primary" disabled={scanning} onClick={() => void scan()}>Scan library</button> : undefined} />
      : <ThemeContent theme={theme} tracks={tracks} currentTrack={currentTrack} onPlay={onPlay} />;

  return <main className={`library theme-${theme.id}`}>
    <ThemeChrome theme={theme} user={user} onLogout={onLogout} controls={controls} tracks={tracks} currentTrack={currentTrack} onPlay={onPlay} />
    <section className="catalog" aria-labelledby="tracks-heading">
      <div className="catalog-heading"><div><p className="kicker">{theme.kicker}</p><h1 id="tracks-heading">{theme.id === 'applemusic' ? 'New' : theme.id === 'amazonmusic' ? 'Music for every moment' : theme.id === 'soundcloud' ? 'Your stream' : 'Your top tracks'}</h1></div><span>{!loading && error === null ? `${total} tracks` : ''}</span></div>
      {theme.id !== 'soundcloud' && theme.id !== 'amazonmusic' && controls}
      {notice !== null && <p className="notice" role="status">{notice}</p>}
      {results}
      {tracks.length < total && !loading && error === null && <div className="load-more"><button className="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : `Load more (${tracks.length} of ${total})`}</button></div>}
    </section>
  </main>;
}

function ThemeChrome({ theme, user, onLogout, controls, tracks, currentTrack, onPlay }: { readonly theme: ThemeDefinition; readonly user: User; readonly onLogout: () => void; readonly controls: ReactNode; readonly tracks: readonly Track[]; readonly currentTrack: Track | null; readonly onPlay: (track: Track) => void }) {
  const featured = currentTrack ?? tracks[0] ?? null;
  if (theme.id === 'spotify') return <><aside className="spotify-sidebar"><VaultMark /><nav aria-label="Library navigation"><a href="#tracks-heading">⌂ Home</a><a href="#tracks-heading">⌕ Search</a><a href="#tracks-heading" className="active">▥ Your Library</a></nav><p>Your collection</p><div className="side-tracks">{tracks.slice(0, 5).map((track, index) => <TrackTile key={track.id} track={track} index={index} onPlay={onPlay} compact />)}</div></aside><header className="spotify-hero"><div><p>Private playlist</p><h2>After Hours<br />in the Vault</h2><span>{tracks.length} songs · Curated by you</span></div><Artwork track={featured} className="hero-art" /></header><aside className="now-panel"><h2>Now playing</h2><Artwork track={featured} className="now-art" /><strong>{featured?.title ?? 'Pick a track'}</strong><span>{artist(featured)}</span><p>Streamed privately from your music server.</p></aside></>;
  if (theme.id === 'applemusic') return <><aside className="apple-sidebar"><VaultMark /><nav aria-label="Library navigation"><p>Apple-inspired Music</p><a href="#tracks-heading">⌂ Home</a><a href="#tracks-heading">▦ Browse</a><a className="active" href="#tracks-heading">♫ Songs</a><p>Library</p><a href="#tracks-heading">Recently Added</a><a href="#tracks-heading">Albums</a><a href="#tracks-heading">Artists</a></nav><div className="sidebar-account"><span>{user.email}</span><button onClick={onLogout}>Sign out</button></div></aside><header className="apple-top"><div className="apple-search">{controls}</div><button className="avatar" onClick={onLogout} aria-label={`Sign out ${user.email}`}>{user.email.slice(0, 1).toUpperCase()}</button></header><section className="apple-editorial" aria-label="Featured music">{tracks.slice(0, 3).map((track, index) => <button key={track.id} onClick={() => onPlay(track)}><Artwork track={track} index={index} /><span><small>{index === 0 ? 'FEATURED ALBUM' : 'ESSENTIAL LISTENING'}</small><strong>{track.title}</strong><em>{artist(track)}</em></span></button>)}</section></>;
  if (theme.id === 'amazonmusic') return <><header className="amazon-nav"><VaultMark /><nav aria-label="Primary"><a href="#tracks-heading">Home</a><a href="#tracks-heading">Library</a><a href="#tracks-heading">Podcasts</a></nav>{controls}<button className="avatar" onClick={onLogout} aria-label={`Sign out ${user.email}`}>{user.email.slice(0, 1).toUpperCase()}</button></header><section className="amazon-hero"><div><p>MY SOUNDTRACK</p><h2>All your music.<br />Right here.</h2><span>A personal mix from your private collection</span>{featured && <button className="hero-play" onClick={() => onPlay(featured)}>▶ Play</button>}</div><Artwork track={featured} className="hero-art" /></section></>;
  return <><header className="sound-nav"><VaultMark /><nav aria-label="Primary"><a className="active" href="#tracks-heading">Home</a><a href="#tracks-heading">Stream</a><a href="#tracks-heading">Library</a></nav>{controls}<span>{user.email}</span><button onClick={onLogout}>Sign out</button></header><section className="sound-banner"><p>YOUR PRIVATE SOUND</p><h2>Tracks worth<br />turning up.</h2><span>Fresh from your own collection.</span></section><div className="sound-tabs" role="tablist" aria-label="Catalog views"><button role="tab" aria-selected="true">All music</button><button role="tab" aria-selected="false">Recently added</button><button role="tab" aria-selected="false">Albums</button></div></>;
}

function ThemeContent({ theme, tracks, currentTrack, onPlay }: { readonly theme: ThemeDefinition; readonly tracks: readonly Track[]; readonly currentTrack: Track | null; readonly onPlay: (track: Track) => void }) {
  if (theme.id === 'soundcloud') return <div className="cover-grid">{tracks.map((track, index) => <TrackTile key={track.id} track={track} index={index} onPlay={onPlay} active={track.id === currentTrack?.id} />)}</div>;
  if (theme.id === 'applemusic') return <div className="apple-columns">{tracks.map((track, index) => <TrackTile key={track.id} track={track} index={index} onPlay={onPlay} compact active={track.id === currentTrack?.id} />)}</div>;
  if (theme.id === 'amazonmusic') return <><div className="amazon-feature-row">{tracks.slice(0, 5).map((track, index) => <TrackTile key={track.id} track={track} index={index} onPlay={onPlay} active={track.id === currentTrack?.id} />)}</div><h2 className="subheading">Songs for you</h2><div className="amazon-rows">{tracks.slice(5).map((track, index) => <TrackRow key={track.id} track={track} index={index + 5} onPlay={onPlay} active={track.id === currentTrack?.id} />)}</div></>;
  return <div className="track-table" role="list">{tracks.map((track, index) => <TrackRow key={track.id} track={track} index={index} onPlay={onPlay} active={track.id === currentTrack?.id} />)}</div>;
}

function LibraryControls({ query, onQuery, scanning, onScan }: { readonly query: string; readonly onQuery: (query: string) => void; readonly scanning: boolean; readonly onScan: () => void }) {
  return <div className="library-controls"><label><span className="sr-only">Search your library</span><b aria-hidden="true">⌕</b><input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search your library" /></label><button className="scan-button" type="button" disabled={scanning} onClick={onScan}>{scanning ? 'Scanning…' : '↻ Scan'}</button></div>;
}

function TrackRow({ track, index, onPlay, active }: { readonly track: Track; readonly index: number; readonly onPlay: (track: Track) => void; readonly active: boolean }) {
  return <button className={`track-row ${active ? 'selected' : ''}`} role="listitem" onClick={() => onPlay(track)} aria-label={`Play ${track.title} by ${artist(track)}`}><span className="track-number">{active ? '▶' : index + 1}</span><Artwork track={track} index={index} /><span className="track-main"><strong>{track.title}</strong><small>{artist(track)}</small></span><span className="track-album">{track.album ?? 'Unknown album'}</span><span className="track-year">{track.year ?? '—'}</span><span>{formatDuration(track.durationSeconds)}</span></button>;
}

function TrackTile({ track, index, onPlay, active = false, compact = false }: { readonly track: Track; readonly index: number; readonly onPlay: (track: Track) => void; readonly active?: boolean; readonly compact?: boolean }) {
  return <button className={`track-tile ${compact ? 'compact' : ''} ${active ? 'selected' : ''}`} onClick={() => onPlay(track)} aria-label={`Play ${track.title} by ${artist(track)}`}><Artwork track={track} index={index} /><span><strong>{track.title}</strong><small>{artist(track)}</small></span><i aria-hidden="true">▶</i></button>;
}

function VaultMark() { return <a className="vault-mark" href="#tracks-heading" aria-label="Monopol Musix Vault home"><b>m</b><span>MONOPOL<small>MUSIX VAULT</small></span></a>; }
function artist(track: Track | null): string { return track?.artists.join(', ') || 'Unknown artist'; }
function State({ title, copy, action }: { readonly title: string; readonly copy: string; readonly action?: ReactNode }) { return <div className="state"><span aria-hidden="true">♫</span><h2>{title}</h2><p>{copy}</p>{action}</div>; }
function TrackSkeleton() { return <div className="skeletons" aria-label="Loading tracks" aria-busy="true">{[1, 2, 3, 4, 5].map((item) => <i key={item} />)}</div>; }
