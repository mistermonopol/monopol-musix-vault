import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, createPlaylist, deletePlaylist, getBrainGraph, getQueue, listDevices, listFavoriteTrackIds, listPlaylists, listRecentListening, listTracks, registerDevice, replacePlaylistItems, revokeDevice, transferQueue, updatePlaylist } from '../lib/api';
import { formatDuration } from '../lib/format';
import type { BrainGraph, BrainGraphNode, Device, Playlist, QueueSnapshot, RecentListeningItem, Track } from '../lib/types';
import { Artwork } from './Artwork';

export type VaultView = 'library' | 'favorites' | 'recent' | 'playlists' | 'devices' | 'brain';
const views: readonly { id: VaultView; label: string; icon: string }[] = [
  { id: 'library', label: 'Library', icon: '♫' }, { id: 'favorites', label: 'Favorites', icon: '♥' },
  { id: 'recent', label: 'Recent', icon: '◷' }, { id: 'playlists', label: 'Playlists', icon: '≡' },
  { id: 'devices', label: 'Devices', icon: '▣' }, { id: 'brain', label: 'Brain', icon: '◇' },
];

export function VaultNavigation({ active, onNavigate }: { readonly active: VaultView; readonly onNavigate: (view: VaultView) => void }) {
  return <nav className="vault-navigation" aria-label="Vault views">{views.map((view) => <button key={view.id} type="button" className={active === view.id ? 'active' : ''} aria-current={active === view.id ? 'page' : undefined} onClick={() => onNavigate(view.id)}><span aria-hidden="true">{view.icon}</span>{view.label}</button>)}</nav>;
}

export function VaultViewContent({ view, currentTrack, onPlay }: { readonly view: Exclude<VaultView, 'library'>; readonly currentTrack: Track | null; readonly onPlay: (track: Track) => void }) {
  return <main className="vault-view"><header><p className="kicker">Your private collection</p><h1>{views.find((item) => item.id === view)?.label}</h1></header>{view === 'favorites' ? <FavoritesView onPlay={onPlay} /> : view === 'recent' ? <RecentView onPlay={onPlay} /> : view === 'playlists' ? <PlaylistsView currentTrack={currentTrack} onPlay={onPlay} /> : view === 'devices' ? <DevicesView /> : <BrainView />}</main>;
}

function useTrackMap() {
  const [tracks, setTracks] = useState<readonly Track[]>([]);
  useEffect(() => { void listTracks('', 100, 0).then((page) => setTracks(page.tracks)).catch(() => setTracks([])); }, []);
  return useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
}

function FavoritesView({ onPlay }: { readonly onPlay: (track: Track) => void }) {
  const tracks = useTrackMap(); const [ids, setIds] = useState<ReadonlySet<string> | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listFavoriteTrackIds().then(setIds).catch((caught: unknown) => setError(message(caught))); }, []);
  const favorites = ids === null ? [] : [...ids].flatMap((id) => { const track = tracks.get(id); return track ? [track] : []; });
  return <PanelState loading={ids === null && error === null} error={error} empty={ids !== null && ids.size === 0} emptyText="Favorite tracks will appear here."><TrackList tracks={favorites} onPlay={onPlay} /></PanelState>;
}

function RecentView({ onPlay }: { readonly onPlay: (track: Track) => void }) {
  const tracks = useTrackMap(); const [items, setItems] = useState<readonly RecentListeningItem[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listRecentListening(50).then(setItems).catch((caught: unknown) => setError(message(caught))); }, []);
  return <PanelState loading={items === null && error === null} error={error} empty={items?.length === 0} emptyText="Play a track to start your listening history."><div className="data-list">{items?.map((item) => { const track = tracks.get(item.trackId); return <button key={item.trackId} onClick={() => track && onPlay(track)} disabled={!track}><span><strong>{track?.title ?? 'Track unavailable'}</strong><small>{track?.artists.join(', ') || item.eventType}</small></span><span>{formatDuration(item.positionSeconds)} · {new Date(item.occurredAt).toLocaleString()}</span></button>; })}</div></PanelState>;
}

function PlaylistsView({ currentTrack, onPlay }: { readonly currentTrack: Track | null; readonly onPlay: (track: Track) => void }) {
  const tracks = useTrackMap(); const [items, setItems] = useState<readonly Playlist[] | null>(null); const [selected, setSelected] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(() => listPlaylists().then((value) => { setItems(value); setSelected((id) => id ?? value[0]?.id ?? null); }).catch((caught: unknown) => setError(message(caught))), []);
  useEffect(() => { void load(); }, [load]);
  const playlist = items?.find((item) => item.id === selected);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim(); if (!name) return; setBusy(true); try { const made = await createPlaylist(name); setItems((current) => [...(current ?? []), made]); setSelected(made.id); event.currentTarget.reset(); } catch (caught) { setError(message(caught)); } finally { setBusy(false); } }
  async function addCurrent() { if (!playlist || !currentTrack || playlist.items.some((item) => item.trackId === currentTrack.id)) return; setBusy(true); try { const saved = await replacePlaylistItems(playlist.id, [...playlist.items.map((item) => item.trackId), currentTrack.id]); setItems((all) => all?.map((item) => item.id === saved.id ? saved : item) ?? []); } catch (caught) { setError(message(caught)); } finally { setBusy(false); } }
  async function remove() { if (!playlist || !window.confirm(`Delete “${playlist.name}”?`)) return; await deletePlaylist(playlist.id); setSelected(null); void load(); }
  async function rename() { if (!playlist) return; const name = window.prompt('Playlist name', playlist.name)?.trim(); if (!name) return; const saved = await updatePlaylist(playlist.id, name, playlist.description); setItems((all) => all?.map((item) => item.id === saved.id ? saved : item) ?? []); }
  return <PanelState loading={items === null && error === null} error={error}><div className="split-view"><aside><form className="inline-form" onSubmit={(event) => void create(event)}><label><span className="sr-only">New playlist name</span><input name="name" placeholder="New playlist" maxLength={200} /></label><button className="primary" disabled={busy}>Create</button></form>{items?.map((item) => <button className={selected === item.id ? 'selected' : ''} key={item.id} onClick={() => setSelected(item.id)}><strong>{item.name}</strong><small>{item.items.length} tracks</small></button>)}</aside><section>{playlist ? <><div className="view-actions"><div><h2>{playlist.name}</h2><p>{playlist.description || 'No description'}</p></div><button className="secondary" onClick={() => void rename()}>Rename</button><button className="secondary danger" onClick={() => void remove()}>Delete</button><button className="primary" disabled={!currentTrack || busy} onClick={() => void addCurrent()}>Add playing track</button></div><TrackList tracks={playlist.items.flatMap((item) => { const track = tracks.get(item.trackId); return track ? [track] : []; })} onPlay={onPlay} /></> : <Empty text="Create or select a playlist." />}</section></div></PanelState>;
}

function DevicesView() {
  const [devices, setDevices] = useState<readonly Device[] | null>(null); const [queues, setQueues] = useState<ReadonlyMap<string, QueueSnapshot | null>>(new Map()); const [source, setSource] = useState(''); const [target, setTarget] = useState(''); const [notice, setNotice] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const result = await listDevices(); setDevices(result); const values = await Promise.all(result.map(async (device) => [device.id, await getQueue(device.id)] as const)); setQueues(new Map(values)); } catch (caught) { setError(message(caught)); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function register(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); await registerDevice(String(data.get('name')), String(data.get('kind') || 'web')); event.currentTarget.reset(); void load(); }
  async function transfer() { try { const result = await transferQueue(source, target); setNotice(`Queue transferred (${result.queue.items.length} tracks). Playback was not started.`); void load(); } catch (caught) { setError(message(caught)); } }
  return <PanelState loading={devices === null && error === null} error={error}><form className="device-form" onSubmit={(event) => void register(event)}><label>Name<input required name="name" maxLength={200} placeholder="Living room" /></label><label>Kind<input required name="kind" maxLength={50} defaultValue="web" /></label><button className="primary">Register device</button></form>{notice && <p role="status" className="notice">{notice}</p>}<div className="device-grid">{devices?.map((device) => <article key={device.id}><div><strong>{device.name}</strong><small>{device.kind} · seen {new Date(device.lastSeenAt).toLocaleString()}</small></div><p>{queues.get(device.id)?.items.length ?? 0} queued tracks</p><button className="secondary danger" onClick={() => void revokeDevice(device.id).then(load)}>Revoke</button></article>)}</div>{(devices?.length ?? 0) > 1 && <section className="transfer"><h2>Transfer queue</h2><select aria-label="Source device" value={source} onChange={(event) => setSource(event.target.value)}><option value="">From…</option>{devices?.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select><select aria-label="Target device" value={target} onChange={(event) => setTarget(event.target.value)}><option value="">To…</option>{devices?.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select><button className="primary" disabled={!source || !target || source === target} onClick={() => void transfer()}>Transfer</button></section>}</PanelState>;
}

function BrainView() {
  const [graph, setGraph] = useState<BrainGraph | null>(null); const [query, setQuery] = useState(''); const [selected, setSelected] = useState<BrainGraphNode | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void getBrainGraph().then(setGraph).catch((caught: unknown) => setError(message(caught))); }, []);
  const shown = useMemo(() => { if (!graph) return []; const found = query.trim().toLowerCase(); return graph.nodes.filter((node) => !found || node.label.toLowerCase().includes(found)).slice(0, 160); }, [graph, query]);
  const positions = useMemo(() => new Map(shown.map((node, index) => { const angle = index * 2.399; const radius = 45 + 14 * Math.sqrt(index); return [node.id, { x: 400 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius }]; })), [shown]);
  return <PanelState loading={graph === null && error === null} error={error} empty={graph?.nodes.length === 0} emptyText="The graph has no nodes yet."><div className="graph-tools"><label>Search nodes<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><p aria-live="polite">{shown.length} nodes shown{selected ? ` · Selected: ${selected.label} (${selected.type})` : ''}</p></div><div className="brain-graph"><svg viewBox="0 0 800 600" role="img" aria-label="Music relationship graph">{graph?.edges.map((edge) => { const source = positions.get(edge.source); const target = positions.get(edge.target); return source && target ? <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} /> : null; })}{shown.map((node) => { const point = positions.get(node.id)!; return <g key={node.id} className={`node node-${node.type} ${selected?.id === node.id ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`${node.label}, ${node.type}`} onClick={() => setSelected(node)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(node); }}><circle cx={point.x} cy={point.y} r={selected?.id === node.id ? 10 : 7} /><title>{node.label} ({node.type})</title></g>; })}</svg><div className="graph-legend">{(['track', 'artist', 'album', 'genre'] as const).map((type) => <span key={type} className={`node-${type}`}>● {type}</span>)}</div></div></PanelState>;
}

function TrackList({ tracks, onPlay }: { readonly tracks: readonly Track[]; readonly onPlay: (track: Track) => void }) { return <div className="simple-tracks">{tracks.map((track) => <button key={track.id} onClick={() => onPlay(track)}><Artwork track={track} /><span><strong>{track.title}</strong><small>{track.artists.join(', ') || 'Unknown artist'}</small></span><span>{formatDuration(track.durationSeconds)}</span></button>)}</div>; }
function PanelState({ loading, error, empty, emptyText, children }: { readonly loading?: boolean; readonly error?: string | null; readonly empty?: boolean; readonly emptyText?: string; readonly children: ReactNode }) { if (loading) return <p className="view-status" aria-busy="true">Loading…</p>; if (error) return <Empty text={error} />; if (empty) return <Empty text={emptyText ?? 'Nothing here yet.'} />; return <>{children}</>; }
function Empty({ text }: { readonly text: string }) { return <div className="view-empty"><span aria-hidden="true">♫</span><p>{text}</p></div>; }
function message(error: unknown) { return error instanceof ApiError ? error.message : 'This view could not be loaded.'; }
