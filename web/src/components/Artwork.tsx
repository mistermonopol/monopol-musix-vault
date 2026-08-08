import { useEffect, useState } from 'react';
import { getTrackArtwork } from '../lib/api';
import { initials } from '../lib/format';
import type { Track } from '../lib/types';

function hash(value: string): number {
  return [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
}

export function artworkStyle(track: Track | null, index = 0): React.CSSProperties {
  const seed = Math.abs(hash(track?.id ?? `empty-${index}`));
  const first = seed % 360;
  const second = (first + 55 + (index * 17)) % 360;
  return { '--art-a': `hsl(${first} 58% 48%)`, '--art-b': `hsl(${second} 64% 20%)`, '--art-turn': `${(seed % 50) + 115}deg` } as React.CSSProperties;
}

interface ArtworkCacheEntry {
  refs: number;
  url: string | null;
  promise: Promise<string | null>;
  revokeTimer?: ReturnType<typeof setTimeout>;
}

const artworkCache = new Map<string, ArtworkCacheEntry>();

function acquireArtwork(trackId: string): Promise<string | null> {
  let entry = artworkCache.get(trackId);
  if (entry === undefined) {
    entry = { refs: 0, url: null, promise: Promise.resolve(null) };
    const current = entry;
    current.promise = getTrackArtwork(trackId).then((blob) => {
      current.url = blob === null ? null : URL.createObjectURL(blob);
      return current.url;
    }).catch(() => null);
    artworkCache.set(trackId, current);
  }
  entry.refs += 1;
  if (entry.revokeTimer !== undefined) clearTimeout(entry.revokeTimer);
  return entry.promise;
}

function releaseArtwork(trackId: string): void {
  const entry = artworkCache.get(trackId);
  if (entry === undefined) return;
  entry.refs = Math.max(0, entry.refs - 1);
  entry.revokeTimer = setTimeout(() => {
    void entry.promise.finally(() => {
      if (entry.refs > 0) return;
      if (entry.url !== null) URL.revokeObjectURL(entry.url);
      artworkCache.delete(trackId);
    });
  }, 0);
}

export function Artwork({ track, index = 0, className = '' }: { readonly track: Track | null; readonly index?: number; readonly className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setUrl(null); setFailed(false);
    if (track === null || !track.hasArtwork) return;
    let active = true;
    void acquireArtwork(track.id).then((value) => { if (active) setUrl(value); });
    return () => { active = false; releaseArtwork(track.id); };
  }, [track?.id, track?.hasArtwork]);
  return <span className={`generated-art ${className}`} style={artworkStyle(track, index)} aria-hidden="true">{url !== null && !failed && <img src={url} alt="" onError={() => setFailed(true)} />}<i />{track === null ? '♪' : initials(track.title)}</span>;
}
