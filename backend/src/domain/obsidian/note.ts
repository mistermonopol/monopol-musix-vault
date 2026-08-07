import type { ObsidianCatalogTrack } from './catalog.js';

export const USER_BODY_START = '<!-- OBSIDIAN-SYNC:USER-CONTENT:START -->';
export const USER_BODY_END = '<!-- OBSIDIAN-SYNC:USER-CONTENT:END -->';

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const INVALID_FILENAME_CHARACTER = /[<>:"/\\|?*\u0000-\u001f]/g;

export type NoteType = 'track' | 'artist' | 'album' | 'genre';

export interface CatalogEntityNote {
  readonly id: string;
  readonly name: string;
  readonly tracks: readonly ObsidianCatalogTrack[];
  readonly type: Exclude<NoteType, 'track'>;
}

export function sanitizeFilename(value: string, fallback = 'Untitled'): string {
  let sanitized = value
    .normalize('NFKC')
    .replace(INVALID_FILENAME_CHARACTER, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .replace(/^[. ]+/g, '')
    .trim();

  if (sanitized.length === 0) sanitized = fallback;
  if (WINDOWS_RESERVED_NAME.test(sanitized)) sanitized = `_${sanitized}`;
  if (sanitized.length > 100) sanitized = sanitized.slice(0, 100).replace(/[. ]+$/g, '');
  return sanitized || fallback;
}

export function noteFilename(name: string, id: string): string {
  return `${sanitizeFilename(name)} -- ${sanitizeFilename(id, 'unknown-id')}.md`;
}

export function noteLink(directory: 'Tracks' | 'Artists' | 'Albums' | 'Genres', name: string, id: string): string {
  const basename = noteFilename(name, id).slice(0, -3);
  return `[[${directory}/${basename}|${escapeLinkAlias(name)}]]`;
}

export function preserveUserBody(existing: string | null): string {
  if (existing === null) return '';
  const start = existing.indexOf(USER_BODY_START);
  if (start < 0) return '';
  const contentStart = start + USER_BODY_START.length;
  const end = existing.indexOf(USER_BODY_END, contentStart);
  return end < 0 ? '' : existing.slice(contentStart, end).replace(/^\r?\n|\r?\n$/g, '');
}

export function renderTrackNote(track: ObsidianCatalogTrack, userBody: string): string {
  const artists = track.artists.map((artist) => noteLink('Artists', artist.name, artist.id));
  const genres = track.genres.map((genre) => noteLink('Genres', genre.name, genre.id));
  const album = track.album === null ? null : noteLink('Albums', track.album.title, track.album.id);
  return renderManagedNote([
    ['type', 'track'], ['id', track.id], ['title', track.title],
    ['artists', artists], ['album', album], ['genres', genres], ['year', track.year],
    ['duration_seconds', track.durationSeconds], ['codec', track.codec], ['tags', ['generated/obsidian-sync']],
  ], `# ${track.title}`, userBody);
}

export function renderEntityNote(entity: CatalogEntityNote, userBody: string): string {
  const label = entity.type === 'album' ? 'title' : 'name';
  const tracks = [...entity.tracks]
    .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
    .map((track) => noteLink('Tracks', track.title, track.id));
  return renderManagedNote([
    ['type', entity.type], ['id', entity.id], [label, entity.name], ['tracks', tracks],
    ['tags', ['generated/obsidian-sync']],
  ], `# ${entity.name}`, userBody);
}

function renderManagedNote(fields: readonly (readonly [string, unknown])[], heading: string, userBody: string): string {
  const yaml = fields.map(([key, value]) => `${key}: ${yamlValue(value)}`).join('\n');
  const body = userBody.length === 0 ? '' : `${userBody}\n`;
  return `---\n${yaml}\n---\n\n${heading}\n\n${USER_BODY_START}\n${body}${USER_BODY_END}\n`;
}

function yamlValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  return JSON.stringify(value);
}

function escapeLinkAlias(value: string): string {
  return value.replace(/[|\]]/g, '-');
}
