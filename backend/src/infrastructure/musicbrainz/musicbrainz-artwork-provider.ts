import { isConservativeMatch, type DownloadedArtwork, type MissingArtworkAlbum, type MusicBrainzArtworkProvider, type MusicBrainzMatch } from '../../application/artwork-lookup.js';

const MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_HOSTS = ['coverartarchive.org', 'archive.org'];

type Fetch = typeof globalThis.fetch;
type Sleep = (milliseconds: number) => Promise<void>;

interface SearchResponse {
  readonly 'release-groups'?: readonly {
    readonly 'artist-credit'?: readonly { readonly name?: string }[];
    readonly 'first-release-date'?: string;
    readonly id?: string;
    readonly score?: number;
    readonly title?: string;
  }[];
}

export class MusicBrainzHttpArtworkProvider implements MusicBrainzArtworkProvider {
  private lastMusicBrainzRequestAt: number | null = null;

  public constructor(
    private readonly userAgent: string,
    private readonly requestIntervalMs: number,
    private readonly timeoutMs: number,
    private readonly fetchImpl: Fetch = globalThis.fetch,
    private readonly sleep: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    private readonly now: () => number = Date.now,
  ) {}

  public async findReleaseGroup(album: MissingArtworkAlbum): Promise<MusicBrainzMatch | null> {
    await this.throttle();
    const query = [`releasegroup:${quote(album.title)}`, `artist:${quote(album.albumArtist)}`];
    if (album.year !== null) query.push(`firstreleasedate:${album.year}`);
    const url = new URL('https://musicbrainz.org/ws/2/release-group/');
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('query', query.join(' AND '));
    const response = await this.request(url, 'follow');
    if (!response.ok) throw new Error(`MusicBrainz returned ${response.status}`);
    const payload = await response.json() as SearchResponse;
    const candidates = (payload['release-groups'] ?? [])
      .filter((candidate) => candidate.id !== undefined && candidate.title !== undefined)
      .map((candidate): MusicBrainzMatch => ({
        artist: candidate['artist-credit']?.map((credit) => credit.name ?? '').filter(Boolean).join(' & ') ?? '',
        id: candidate.id!,
        score: candidate.score ?? 0,
        title: candidate.title!,
        year: parseYear(candidate['first-release-date']),
      }))
      .filter((candidate) => isConservativeMatch(album, candidate))
      .sort((left, right) => right.score - left.score);
    return candidates[0] ?? null;
  }

  public async fetchFrontCover(releaseGroupId: string): Promise<DownloadedArtwork | null> {
    const deadline = this.now() + this.timeoutMs;
    let url = new URL(`https://coverartarchive.org/release-group/${encodeURIComponent(releaseGroupId)}/front-500`);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      validateCoverUrl(url);
      const response = await this.request(url, 'manual', remainingTimeout(deadline, this.now()));
      if (response.status === 404) return null;
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location === null) throw new Error('Cover redirect omitted location');
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) throw new Error(`Cover Art Archive returned ${response.status}`);
      const declared = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > MAX_ARTWORK_BYTES) throw new Error('Cover exceeds maximum size');
      const data = await readBounded(response, MAX_ARTWORK_BYTES);
      const detected = detectMime(data);
      if (detected === null || declared !== detected) throw new Error('Cover MIME or signature is invalid');
      return { data, mimeType: detected };
    }
    throw new Error('Too many cover redirects');
  }

  private async throttle(): Promise<void> {
    const wait = this.lastMusicBrainzRequestAt === null ? 0 : this.lastMusicBrainzRequestAt + this.requestIntervalMs - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastMusicBrainzRequestAt = this.now();
  }

  private async request(url: URL, redirect: NonNullable<RequestInit['redirect']>, timeoutMs = this.timeoutMs): Promise<Response> {
    return this.fetchImpl(url, { headers: { 'User-Agent': this.userAgent }, redirect, signal: AbortSignal.timeout(timeoutMs) });
  }
}

function quote(value: string): string { return `"${value.replace(/["\\]/g, '\\$&')}"`; }
function parseYear(value: string | undefined): number | null { const year = value?.match(/^\d{4}/)?.[0]; return year === undefined ? null : Number(year); }
function remainingTimeout(deadline: number, now: number): number {
  const remaining = deadline - now;
  if (remaining <= 0) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  return remaining;
}

function validateCoverUrl(url: URL): void {
  const hostAllowed = ALLOWED_COVER_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (url.protocol !== 'https:' || !hostAllowed || url.username !== '' || url.password !== '') throw new Error('Unsafe cover redirect');
}

async function readBounded(response: Response, maximum: number): Promise<Buffer> {
  if (response.body === null) throw new Error('Cover response has no body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maximum) throw new Error('Cover exceeds maximum size');
    chunks.push(chunk);
  }
  if (size === 0) throw new Error('Cover is empty');
  return Buffer.concat(chunks);
}

function detectMime(data: Buffer): DownloadedArtwork['mimeType'] | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
