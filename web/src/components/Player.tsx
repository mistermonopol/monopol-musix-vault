import { useEffect, useRef, useState } from 'react';
import { formatDuration, initials } from '../lib/format';
import type { Track } from '../lib/types';

interface PlayerProps { readonly track: Track | null; }

export function Player({ track }: PlayerProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = audio.current;
    if (element === null || track === null) return;
    setError(false); setCurrentTime(0);
    element.load();
    void element.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [track]);

  function toggle() {
    const element = audio.current;
    if (element === null || track === null) return;
    if (element.paused) void element.play(); else element.pause();
  }

  return <aside className="player" aria-label="Audio player">
    <audio ref={audio} src={track === null ? undefined : `/api/tracks/${encodeURIComponent(track.id)}/stream`} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onEnded={() => setPlaying(false)} onError={() => setError(true)} />
    <div className="now-playing">
      <div className="mini-art" aria-hidden="true">{track === null ? '♪' : initials(track.title)}</div>
      <div className="ellipsis"><strong>{track?.title ?? 'Nothing playing'}</strong><span>{error ? 'Stream unavailable' : track?.artists.join(', ') || 'Choose a track'}</span></div>
    </div>
    <div className="transport">
      <button className="play-button" type="button" onClick={toggle} disabled={track === null} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button>
      <span>{formatDuration(currentTime)}</span>
      <input aria-label="Seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={track === null || duration === 0} onChange={(event) => { const value = Number(event.target.value); if (audio.current !== null) audio.current.currentTime = value; setCurrentTime(value); }} />
      <span>{formatDuration(duration || track?.durationSeconds)}</span>
    </div>
    <div className="volume"><span aria-hidden="true">◖</span><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (audio.current !== null) audio.current.volume = value; }} /></div>
  </aside>;
}
