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

export function Artwork({ track, index = 0, className = '' }: { readonly track: Track | null; readonly index?: number; readonly className?: string }) {
  return <span className={`generated-art ${className}`} style={artworkStyle(track, index)} aria-hidden="true"><i />{track === null ? '♪' : initials(track.title)}</span>;
}
